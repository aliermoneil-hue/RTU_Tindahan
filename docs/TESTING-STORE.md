# Testing the Official Store core

> New to the flow? Start with the step-by-step ordering walkthrough:
> `docs/TUTORIAL-OFFICIAL-STORE.md`.


This branch has **models, services, and admin only**. There is no store API and
no React screens yet. Test through Django Admin and the Django shell.

## 1. Start

```powershell
cd backend
.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py seed_demo_users
python manage.py seed_categories
python manage.py seed_official_store
python manage.py runserver
```

Sign in at <http://127.0.0.1:8000/admin/> as `admin@rtu.edu.ph` /
`Tindahan2026!`.

`seed_official_store` creates:

| Listing | Variants | Opening stock |
| --- | --- | --- |
| Official RTU Uniform | Small, Medium, Large | 10 each |
| Official PE Shirt | Small, Medium, Large | 5 each |

The seeder is safe to run again: it does not add stock twice.

## 2. What to inspect in the admin

Open **Official Store**:

| Screen | Check |
| --- | --- |
| Store settings | One row only. Change the low-stock threshold, limits, and window. You cannot add a second row or delete it. |
| Official tickets | Empty until you place an order. Reference looks like `TXN-YYMMDD-NNN`. Status is read-only. |
| Stock movements | One **Stock In** row per variant from the seeder. Rows cannot be added, edited, or deleted. |
| Daily counts | Empty until you record one. |
| Email outbox | Empty until a message is prepared. `sent_at` stays null. |

Open **Catalog → Listings → Official RTU Uniform**:

- Variants show Small/Medium/Large with on-hand and available.
- On-hand and available are read-only; stock moves only through the ledger.

## 3. Place a test order

```powershell
python manage.py shell
```

```python
from apps.accounts.models import User
from apps.catalog.models import Listing
from apps.store.services import place_official_order

staff = User.objects.get(email="staff@rtu.edu.ph")
student = User.objects.get(email="2024-000001@rtu.edu.ph")
listing = Listing.objects.get(title="Official RTU Uniform")
variant = listing.variants.get(name="Medium")

print("before:", variant.on_hand, variant.available, variant.reserved)

ticket = place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 2}],
    created_by=student,
)

variant.refresh_from_db()
print("ticket:", ticket.reference, ticket.status)
print("after:", variant.on_hand, variant.available, variant.reserved)
```

Expected:

```
before: 10 10 0
ticket: TXN-... request_received
after: 10 8 2
```

In the admin:

- **Official tickets** has the new ticket with one item and status history.
- **Stock movements** has a **Reserved** row with `on_hand_after=10`,
  `available_after=8`.

## 4. Cancel it

```python
from apps.store.services import change_ticket_status

change_ticket_status(
    ticket, "cancelled", by=staff, note="Test cancel"
)
variant.refresh_from_db()
print(variant.on_hand, variant.available, variant.reserved)
```

Expected: `10 10 0`, plus a **Released** ledger row.

## 5. Full claim flow

```python
ticket2 = place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 2}],
    created_by=student,
)
change_ticket_status(ticket2, "confirmed", by=staff)
change_ticket_status(ticket2, "ready_for_pickup", by=staff)
change_ticket_status(ticket2, "claimed", by=staff)

variant.refresh_from_db()
print(variant.on_hand, variant.available, variant.reserved)
```

Expected: `8 8 0`, plus an **Issued** ledger row.

## 6. Rules to try breaking

Run each and confirm it raises `ValidationError`:

```python
# Wrong order: cannot jump from Request Received to Claimed.
ticket3 = place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 1}],
)
change_ticket_status(ticket3, "claimed", by=staff)

# More than available (Medium has 8).
place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 99}],
)

# A student listing is not an official item.
from apps.catalog.models import Listing as L
student_listing = L.objects.filter(is_official=False).first()
place_official_order(
    buyer=student,
    items=[{"listing": student_listing, "variant": variant, "quantity": 1}],
)

# On Hold and Cancelled need a reason.
change_ticket_status(ticket3, "on_hold", by=staff)
```

## 7. Daily count

```python
from apps.store.services import record_daily_count

count = record_daily_count(
    variant, variant.on_hand - 1, by=staff, reason="One unit missing"
)
variant.refresh_from_db()
print(count.difference, variant.on_hand, variant.available)
```

Expected: `-1`, on-hand and available both drop by 1, and the admin shows a
**Daily count** plus an **Adjustment** ledger row.

Try a count with a difference and no reason — it must raise.

## 8. Stock in

```powershell
python manage.py stock_in 3 5 --email staff@rtu.edu.ph --reason "New delivery"
```

The output shows the new on-hand and available. A **Stock In** row appears in
the ledger.

## 9. Limits and window

In **Official Store → Store settings**:

- Set `max_quantity_per_ticket = 3`, then try to order 4 → refused.
- Set `max_quantity_per_student = 3`, then place a second open order → refused.
- Enable the ordering window and set a window that has already passed → refused.

Remember to reset the settings after testing.

## 10. Email outbox

```python
from apps.store.services import prepare_email

prepare_email(
    ticket=ticket,
    kind="student",
    event="Request Received",
    recipients=[student.email],
    subject="Ticket received",
    body="This is a prepared message. Nothing is sent.",
)
```

It appears under **Official Store → Email outbox** with state **Prepared** and
`sent_at` empty.

## 11. What is not testable yet

- No `POST /api/v1/...` store endpoints.
- No React screens for the store.
- No email is sent. The outbox is a preview only.
- Status names are proposals; the BAO must confirm them.

## 12. Reset the demo data

```powershell
python manage.py shell
```

```python
from apps.catalog.models import ListingVariant
from apps.store.models import DailyCount, OfficialTicket, StockMovement

StockMovement.objects.all().delete()
DailyCount.objects.all().delete()
OfficialTicket.objects.all().delete()
ListingVariant.objects.update(on_hand=0, available=0)
```

Then run `python manage.py seed_official_store` again. This only resets the
local development database.
