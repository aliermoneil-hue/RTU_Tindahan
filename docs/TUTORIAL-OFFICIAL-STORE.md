# Tutorial: testing an Official Store order

This is a hands-on walkthrough of the ordering flow in the backend. You will
place an order, watch the stock move, claim it, then try cancelling one.

**Time:** about 10 minutes.

There is no store API or React screen yet, so orders are placed through the
Django shell. Everything else is visible in Django Admin.

---

## 0. Setup

Run these once, from the `backend` folder:

```powershell
.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py seed_demo_users
python manage.py seed_categories
python manage.py seed_official_store
python manage.py runserver
```

Open <http://127.0.0.1:8000/admin/> and sign in as:

```
admin@rtu.edu.ph / Tindahan2026!
```

`seed_official_store` creates two official items:

| Listing | Variants | Opening stock |
| --- | --- | --- |
| Official RTU Uniform | Small, Medium, Large | 10 each |
| Official PE Shirt | Small, Medium, Large | 5 each |

It is safe to run more than once; it does not add stock twice.

## 1. Look at the stock before you order

In the admin:

1. **Catalog → Listings** → open **Official RTU Uniform**.
2. Scroll to the **variants** inline.

You should see:

| Name | On hand | Available |
| --- | --- | --- |
| Small | 10 | 10 |
| Medium | 10 | 10 |
| Large | 10 | 10 |

On hand and available are read-only. Stock only changes through the ledger.

**Official Store → Stock movements** already has one **Stock In** row per
variant. Those are the opening balances.

## 2. Place an order

Leave `runserver` running; open a **second terminal** and start the shell:

```powershell
cd backend
.venv\Scripts\Activate.ps1
python manage.py shell
```

Paste this:

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
print("total:", ticket.total_amount)
```

Expected output:

```
before: 10 10 0
ticket: TXN-260101-001 request_received
after: 10 8 2
total: 1100.00
```

What happened:

- `on_hand` stayed at **10** — nothing left the shelf yet.
- `available` dropped to **8** — 2 units are now held for this ticket.
- `reserved` became **2** — `on_hand - available`.

## 3. Check the ticket in the admin

Open **Official Store → Official tickets**.

You should see:

| Field | Value |
| --- | --- |
| Reference | `TXN-...` (format `TXN-YYMMDD-NNN`) |
| Buyer | `2024-000001@rtu.edu.ph` |
| Status | Request Received |
| Pickup date | blank unless you passed one |

Click the ticket:

- **Items**: 2 × Official RTU Uniform (Medium), unit price 550.00.
- **Status history**: one row, `"" → Request Received`, note "Ticket created".

Now open **Official Store → Stock movements**. The newest row is **Reserved**:

| Field | Value |
| --- | --- |
| Variant | Official RTU Uniform — Medium |
| Kind | Reserved |
| Quantity | 2 |
| On hand after | 10 |
| Available after | 8 |
| Ticket | the reference above |

## 4. Confirm, prepare, and claim it

Back in the shell:

```python
from apps.store.services import change_ticket_status

change_ticket_status(ticket, "confirmed", by=staff)
change_ticket_status(ticket, "ready_for_pickup", by=staff)
change_ticket_status(ticket, "claimed", by=staff)

variant.refresh_from_db()
print("after claim:", variant.on_hand, variant.available, variant.reserved)
```

Expected:

```
after claim: 8 8 0
```

Why:

- **Confirmed** and **Ready for Pickup** do not move stock. The reservation
  stays.
- **Claimed** issues the units: on hand drops from 10 to 8 and the reservation
  is gone.

In the admin:

- The ticket status is **Claimed**.
- Status history has every step.
- Stock movements has a new **Issued** row with `on_hand_after=8`,
  `available_after=8`.

## 5. Try a cancellation

Place a new order, then cancel it:

```python
ticket2 = place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 2}],
)
variant.refresh_from_db()
print("reserved:", variant.on_hand, variant.available, variant.reserved)

change_ticket_status(
    ticket2, "cancelled", by=staff, note="Student changed their mind"
)
variant.refresh_from_db()
print("cancelled:", variant.on_hand, variant.available, variant.reserved)
```

Expected:

```
reserved: 8 6 2
cancelled: 8 8 0
```

Cancelling writes a **Released** row and gives the units back to available.

## 6. Count the shelf (Daily count)

```python
from apps.store.services import record_daily_count

count = record_daily_count(
    variant, variant.on_hand - 1, by=staff, reason="One unit missing"
)
variant.refresh_from_db()
print("difference:", count.difference)
print("stock:", variant.on_hand, variant.available, variant.reserved)
```

Expected:

```
difference: -1
stock: 7 7 0
```

The difference is written as an **Adjustment** in the ledger. A count with a
difference but no reason is refused.

## 7. Rules the system enforces

Run these in the shell. Each one must raise `ValidationError`:

```python
# 1. Not enough stock (Medium has 7 now).
place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 99}],
)

# 2. Skipping a step.
t = place_official_order(
    buyer=student,
    items=[{"listing": listing, "variant": variant, "quantity": 1}],
)
change_ticket_status(t, "claimed", by=staff)

# 3. On Hold needs a reason.
change_ticket_status(t, "on_hold", by=staff)

# 4. A student listing cannot be ordered here.
from apps.catalog.models import Listing as AnyListing
student_listing = AnyListing.objects.filter(is_official=False).first()
place_official_order(
    buyer=student,
    items=[{"listing": student_listing, "variant": variant, "quantity": 1}],
)
```

The normal transition graph:

```
Request Received ──► Confirmed ──► Ready for Pickup ──► Claimed
       │                 │                  │
       ├──► On Hold ◄────┘                  │
       │        │                          │
       └────────┴──────────► Cancelled ◄───┘
```

`Claimed` and `Cancelled` are final.

## 8. Test the limits and the ordering window

Open **Official Store → Store settings** in the admin.

| Change | Then try | Expected |
| --- | --- | --- |
| `max_quantity_per_ticket = 3` | order 4 units | refused |
| `max_quantity_per_student = 3` | place two open orders totalling 4 | second refused |
| Enable window, set a past time range | place an order | refused |

Reset the values when you are done.

## 9. Reset the demo data

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

Then run `python manage.py seed_official_store` again to reopen the stock.

## Appendix: the stock rules in one table

| Movement | On Hand | Available | When |
| --- | --- | --- | --- |
| Stock In | +n | +n | New delivery |
| Reserved | — | −n | Student sends a request |
| Released | — | +n | Request is cancelled |
| Issued | −n | — | Request is claimed |
| Sold | −n | −n | Face to face sale at the window (Staff → Store inventory → Record sale) |
| Adjustment | ±n | ±n | Daily count correction |

Two invariants are enforced on every change:

- Available never goes below zero.
- Available never exceeds On Hand (you cannot release more than was reserved).

The full model-level test list is in `docs/TESTING-STORE.md`.
