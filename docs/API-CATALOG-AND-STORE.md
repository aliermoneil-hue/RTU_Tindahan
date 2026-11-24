# Catalogue and Official Store API

Sprint 2 work. Before this change the `catalog` and `store` apps had models,
migrations, and tested business rules, but no HTTP surface at all: `views.py`
was a stub and `config/urls.py` only mounted `apps.accounts`. Now both are
reachable at `/api/v1/`.

Everything uses DRF token authentication:

```
Authorization: Token <token from /api/v1/auth/login/>
```

---

## 1. Files added or changed

| File | What it does |
| --- | --- |
| `backend/apps/catalog/serializers.py` | Category, listing (read + write), photo, variant serializers; photo rules mirror the model |
| `backend/apps/catalog/views.py` | `CategoryViewSet`, `ListingViewSet` with visibility, ownership, and approve/reject actions |
| `backend/apps/catalog/urls.py` | `SimpleRouter` for categories and listings |
| `backend/apps/store/serializers.py` | Ticket, stock ledger, daily count, and settings serializers |
| `backend/apps/store/views.py` | Ticket viewset + stock/daily-count/settings views, all thin wrappers over `services.py` |
| `backend/apps/store/urls.py` | Store routes |
| `backend/config/urls.py` | Mounts both new routers |
| `backend/config/views.py` | API index now lists the new endpoints |
| `backend/apps/catalog/tests_api.py` | 15 API tests (visibility, ownership, moderation, uploads) |
| `backend/apps/store/tests_api.py` | 13 API tests (tickets, stock, counts, settings) |

Test suite: 54 tests before, **82 after**, all passing (`python manage.py test`).

---

## 2. Catalogue endpoints

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/categories/` | public | Active categories only, unpaginated |
| GET | `/api/v1/listings/` | public | Only `approved` listings; a seller also sees their own; moderators see everything |
| GET | `/api/v1/listings/<slug>/` | public | Same visibility rule; increments `view_count` |
| POST | `/api/v1/listings/` | verified members | Created as `pending_screening`; always |
| PATCH | `/api/v1/listings/<slug>/` | the seller | `is_official` and `status` are never writable over HTTP |
| DELETE | `/api/v1/listings/<slug>/` | the seller | |
| POST | `/api/v1/listings/<slug>/approve/` | moderator | Sets `approved` + `published_at` |
| POST | `/api/v1/listings/<slug>/reject/` | moderator | Body `{"reason": "..."}` is required |

Query parameters on `GET /api/v1/listings/`:

| Parameter | Example | Effect |
| --- | --- | --- |
| `status` | `?status=pending_screening` | Comma-separated listing statuses, for the moderator queue (`pending_screening,needs_review`). Visibility is applied first, so a visitor cannot use it to see hidden listings; an unknown value returns `400` |
| `category` | `?category=uniforms` | Filter by category slug |
| `search` | `?search=lumpia` | Match title or description (case-insensitive) |
| `type` | `?type=service` | `product` or `service` |
| `min_price` | `?min_price=50` | Inclusive lower bound on price |
| `max_price` | `?max_price=300` | Inclusive upper bound on price; combining the two gives a range. A value that is not a number, a negative number, or a range where the maximum sits below the minimum returns `400` with the offending key |
| `official` | `?official=true` | Official Store items only — this is what the Store page should call |
| `seller` | `?seller=me` | Your own listings, any status (the "My shop" page) |
| `ordering` | `?ordering=small-sellers` | `newest`, `oldest`, `price`, `-price`, `popular`, `best-selling`, `least-sold`, `small-sellers`. Sales ordering uses `sold_count`, which a ticket raises when staff mark it `claimed` |
| `page` | `?page=2` | Page size is 20 (global DRF setting) |

The bare list is the marketplace: approved and available only. A detail route —
`GET`, `PATCH` or `DELETE /listings/<slug>/` — also accepts the listing's own
seller for any status, so a pending item can be edited or withdrawn without a
moderator approving it first. Anyone else gets a 404 for an unpublished row.

### Posting an item (multipart, up to 10 photos)

```bash
curl -X POST http://localhost:8000/api/v1/listings/ \
  -H "Authorization: Token $TOKEN" \
  -F "category=2" \
  -F "title=Fresh Lumpia" \
  -F "description=Homemade, ready at the main gate." \
  -F "listing_type=product" \
  -F "condition=new" \
  -F "price=50.00" \
  -F "quantity=3" \
  -F "meetup_place=Main gate" \
  -F "upload_photos=@lumpia1.jpg" \
  -F "upload_photos=@lumpia2.jpg"
```

Each photo must be JPG, PNG, or WebP and at most 5 MB. The response is the read
shape, including `slug`, `status`, and the photo URLs.

### Rules the API enforces

- **BR-01** — only verified members may post; anonymous callers get 401.
- **LS-05 / AI-02** — `POST` always creates `pending_screening`, even if the
  body asks for `approved`. Only `POST .../approve/` publishes.
- **BR-04** — `is_official` is read-only, so only Office Staff (through Django
  Admin, today) can create official items.
- Services need `condition=na`; products need `new` or `used`. The same rule is
  in `Listing.clean()` and in the serializer, because DRF does not call
  `full_clean()`.
- Stock numbers (`on_hand`, `available`) are read-only everywhere. They move
  only through the store ledger.

---

## 3. Official Store endpoints

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/store/tickets/` | signed in | Your own tickets; Office Staff see all. `?status=` filters |
| POST | `/api/v1/store/tickets/` | verified members | Reserves stock; enforces windows and quantity limits |
| GET | `/api/v1/store/tickets/<reference>/` | owner or staff | Reference looks like `TXN-261111-001` |
| POST | `/api/v1/store/tickets/<reference>/transition/` | staff, or buyer cancelling | Body `{"status": "...", "note": "..."}` |
| GET | `/api/v1/store/stock/` | Office Staff | Ledger, newest last. `?variant=<id>` filters |
| POST | `/api/v1/store/stock-in/` | Office Staff | Body `{"variant": 3, "quantity": 5, "reason": "Delivery"}` |
| POST | `/api/v1/store/sales/` | Office Staff | A walk-in sale: `{"items": [{"variant": 3, "quantity": 1}], "reason": "Cash sale"}`. Writes a `sold` ledger row, drops on-hand and available, and raises the listing's `sold_count`. No ticket and no student account. One size per sale; a failure rolls the whole sale back |
| GET | `/api/v1/store/daily-counts/` | Office Staff | Physical counts |
| POST | `/api/v1/store/daily-counts/` | Office Staff | Body `{"variant": 3, "counted_quantity": 8, "reason": "..."}` |
| GET | `/api/v1/store/settings/` | public | Ordering window, limits, thresholds |
| PATCH | `/api/v1/store/settings/` | Office Staff | |

A walk-in sale is a **ledger** row, not a ticket: it appears in Store inventory
(the stock ledger) and moves `sold_count`, but it has no row in the
Transactions list, which is built from tickets. That is deliberate — there is no
student account to attach it to, and inventing one would put a stranger's name
on a sale.

### Placing a request

```bash
curl -X POST http://localhost:8000/api/v1/store/tickets/ \
  -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"listing":3,"variant":7,"quantity":2}],"claim_notes":"Please hold until Friday"}'
```

The view calls `services.place_official_order()`, so all existing rules apply
unchanged: only official listings, a variant is required, stock is reserved
atomically, `max_quantity_per_ticket` and `max_quantity_per_student` are
enforced, and the ordering window is respected. A rule violation comes back as
**400 with a readable message**, not a 500.

Status moves follow `services.TRANSITIONS`:

```
request_received → confirmed | on_hold | cancelled
confirmed        → ready_for_pickup | on_hold | cancelled
on_hold          → confirmed | ready_for_pickup | cancelled
ready_for_pickup → claimed | on_hold | cancelled
claimed, cancelled → (final)
```

A student may only ever send `cancelled`, and only while the ticket is in a
status listed in `StoreSetting.cancel_from` (default: `request_received`).
Cancelling releases the reserved stock; claiming issues it from `on_hand`.

---

## 4. Error format

Field problems come back as DRF's standard map; rule violations raised by
`services.py` are converted to `{"detail": ["..."]}`:

```json
{ "detail": ["Official Uniform — Medium: not enough stock. On hand 1, available 1."] }
```

The frontend's `ApiRequestError` in `src/common/api/client.ts` already reads
`detail` (string or list) and the optional `code`, so these messages can be
shown to the user as they are.

---

## 5. What the frontend does now

`frontend/src/features/marketplace/api/listings.ts` is the bridge to the UI.
On start, `TindahanProvider` calls `fetchListings()` once and merges the result
into the same snapshot the pages already read, so no page component changed:

- Backend ids get an `api:` prefix, so the merge can replace backend data
  without touching anything created in the prototype.
- Listings with `is_official` go into `db.official` with `cat: 'Official'` and
  the seller key `official` — that is what the Official Store page filters on.
- Everything else becomes a `live` `UserListingRecord`.
- Backend category names are translated into the UI's `CATEGORIES` by
  `mapCategory()`; unknown names become 'Other Items'.
- Variants become the `vars` shape the size picker expects (`Size`).
- Photos keep their absolute URLs; `imgSrc()` already passes those through.
- If the backend is unreachable, the request fails silently and the local
  catalogue stands.
- The catalogue, the seller's own rows and the moderation queue are re-read on
  a timer (20–30 s) and on focus, so an approval or a new listing lands without
  a reload. Store tickets poll too: a buyer's own every 30 s, the staff queue
  and ledger every 60 s.

Every member-facing list is server-backed now: listings, orders, chat, store,
moderation, favourites, reviews, forum, notifications, users, audit and
announcements. The bridges live in `frontend/src/features/marketplace/api/`;
what remains in the browser snapshot is the staff backup tooling's residue and
demo-only content.

## 6. What is still missing

- The staff backup is server-side now (`GET /api/v1/admin/backup/`, administrator
  only); restore is the host file-swap procedure in §11, not an upload.
- The AI screening pass follows `POSTING-AND-SELLING-GUIDELINE.md`; the
  remaining work there is watching the moderator queue for false flags, not
  writing rules.

"Small sellers" now has a definition: a verified student (`member_type =
student`) whose live catalogue — approved and available listings — is at most
`SMALL_SELLER_MAX_LISTINGS` (3 by default; `SMALL_SELLER_MAX_LISTINGS` in
`backend/.env` overrides it). Each listing carries `seller_active_listings`
and `is_small_seller`, and `?ordering=small-sellers` puts those sellers first,
then the smallest catalogues, then the newest. The Browse screen's "Small
sellers first" sort uses the same fields.

---

## 6a. The store's mail: outbox, preview, export (EM-01 to EM-06, NT-02)

Nothing in the store sends email. Every status change and every low-stock crossing
writes a row to the outbox, and the sending switch stays off until the IT Office
decides (EM-05). The outbox is therefore the complete, honest record of what would
have gone out.

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/store/outbox/` | Office Staff | Newest first, paginated 20. `?kind=student\|staff`, `?state=prepared\|skipped`, `?event=<status>` |
| GET | `/api/v1/store/outbox/<id>/` | Office Staff | One message in full — the preview |
| GET | `/api/v1/store/outbox/export/` | Office Staff | The same rows as a JSON file (`Content-Disposition: attachment`), honouring the same filters |

Read-only by design: a message here is a record, not a draft to edit. The rows
carry `subject`, `body` (plain text), `recipients`, `kind`, `event`, `state`,
`note`, `ticket_reference`, `sent_at` (always null while sending is off) and
`created_at`.

What a student message says (EM-03): the reference, the status, one line per item
(`1 x Official PE Shirt (Medium)`), the pickup date or "To be confirmed", the
claim notes, and the line "This message is automatic." What it never says: the
student number, the member's name, or a payment link — payment is at the counter.

What decides `state`:

- **EM-02** — a student message needs an RTU address (`…@rtu.edu.ph`). Without
  one the row is `skipped` with a note saying so, rather than being quietly
  dropped.
- **EM-04** — a low-stock message goes to `low_stock_emails` in the store
  settings; with none set it is `skipped`, again with a note. Only the movement
  that crosses the threshold writes one, so a busy day does not repeat the same
  warning.
- **EM-06** — the table keeps the newest 500 rows.

The office sets `low_stock_emails` with `PATCH /api/v1/store/settings/`
(`{"low_stock_emails": ["bao@rtu.edu.ph"]}`); a value that is not a list of email
addresses is refused. For tickets that predate the switch, `manage.py
prepare_store_mail [--dry-run]` writes the message each of them would have had.

The screen is under **ADMIN → Email outbox** for Office Staff: the list with
audience and state filters, a count, "Preview" per row showing the recipients and
the plain-text body, and **Download JSON**, which fetches the same filtered rows.

---

## 7. Favorites API (saved listings and sellers)

Favourites used to live in the browser snapshot, so a heart on one device did
not exist on another and the seller never saw it. They are now rows on the
server, private to the member.

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/favorites/` | verified members | The caller's rows only; unpaginated |
| POST | `/api/v1/favorites/toggle/` | verified members | `{"listing": 13}` or `{"seller": "a@rtu.edu.ph"}`; returns `{"saved": true|false}` |
| DELETE | `/api/v1/favorites/<id>/` | owner | Remove by row id |

Rules enforced in the model and serializer:

- exactly one target per row (`favorite_exactly_one_target`), with partial
  unique constraints so a double click cannot write two rows;
- a member cannot save their own listing or their own shop;
- a listing must still be `approved` + `available` to be saved;
- deleting a listing cascades its favourites away.

`frontend/src/features/marketplace/api/favorites.ts` is the bridge: it turns
`listing_slug` into the UI id `api:<slug>` and a saved seller into their email,
then the provider merges both lists into `account.favs` / `account.sfavs`.
`Official RTU Store` is a bucket with no user behind it, so that one heart
stays local. The heart updates optimistically and rolls back with the server's
message if the write is refused.

---

## 8. Reviews API (verified ratings)

A rating is written against the order it came from, so "Verified pickup" on the
product page means the server checked a completed order, not that the client
said so.

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/reviews/` | public | `?listing=<id>`, `?listing_slug=`, `?seller=<email>`, `?order=<reference>`, `?mine=1`; paginated |
| POST | `/api/v1/reviews/` | the order's buyer | `{"order": "ORD-…", "listing": 5, "stars": 1-5, "text": "…"}`; omit/null `listing` for a seller review |
| DELETE | `/api/v1/reviews/<id>/` | buyer, or a moderator | |

Rules enforced in the model and serializer:

- only a `completed` order can be rated, and only by its buyer;
- an item review must name a listing that was on that order;
- one seller review per order and one item review per order per listing
  (partial unique constraints); POST is create-or-update;
- stars are 1–5, text up to 500 characters;
- the buyer's email is never exposed. The row carries `is_mine` instead, which
  is what the Edit/Delete checks read;
- listing reads carry `rating_avg` and `rating_count` for item reviews.

`frontend/src/features/marketplace/api/reviews.ts` is the bridge. It maps
`order.reference` + `listing_slug` back to the UI's review keys
(`seller:<ref>`, `item:<ref>:api:<slug>`), and `refreshReviews` merges the rows
into `db.reviews` with the server winning for the same key. `submitReview`
writes optimistically and rolls back with the server's message if the write is
refused; the product page's Delete goes through `confirmDeleteReview`.

Server orders are also merged into the buyer's My Orders snapshot
(`orderRecordFromApi` in `api/orders.ts`), which is what makes the Completed
tab, the rating panel and the "requests you sent" summary agree. Order lines
carry the backend listing id, so an item stays rateable after it sells out.

**Sales history (SD-03, SD-04).** `GET /orders/` takes `?role=seller|buyer`,
`?status=`, and a date window `?from=YYYY-MM-DD&to=YYYY-MM-DD` on the day the
order was placed; a malformed date is a 400 that says `Use YYYY-MM-DD.` rather
than an empty list. `GET /orders/export/` returns the same rows as
`text/csv` with `Content-Disposition: attachment; filename="tindahan-<role>-sales-<date>.csv"`,
and defaults to `role=seller` — a member can only ever export rows they are
party to. Cells that begin with `=`, `+`, `-` or `@` are prefixed with a quote so
a listing title cannot become a formula in someone's spreadsheet. The seller
dashboard renders the filters over the rows it already holds and asks the server
for the same window when downloading, so screen and file cannot disagree.

**Request expiry (OT-12).** An unanswered request carries `expires_at`, set at
creation from `ORDER_REQUEST_TTL_HOURS` (default 48). The orders list, a single
order and the CSV export sweep before they answer, so a lapsed request is never
shown as still waiting; `manage.py expire_order_requests` does the same on cron
at 04:00 and notifies both parties — the buyer that the seller did not answer,
the seller that the item is back on their shelf. The sweep locks each row and
re-checks it, so a seller accepting at the same moment wins. `0` hours switches
the clock off and `expires_at` stays null.

**Payment method (OT-06).** The platform records *how* money will move and never
moves any. Two choices only: `cash` — "Cash at the campus meet-up" — and `p2p` —
"Person-to-person transfer (GCash, Maya or bank)". The buyer picks one when
sending the request (`payment_method` on `POST /orders/`, default `cash`), and
either party may change it while the order is open via
`POST /orders/<ref>/payment/ {"method": "cash"|"p2p"}`; the other party is
notified, and a closed order keeps the method it was settled with. There is no
wallet, no gateway, no card field anywhere in the codebase — the requirement says
the choice is only recorded, and that is all that was built.

**Contact numbers (OT-07).** An order payload carries `buyer_contact` and
`seller_contact`, and both are `null` unless the order is **Accepted** — then
each party receives the *other* party's number, and only that one. The rule
lives in `OrderSerializer._contact_for_other_party`. Before acceptance there is
no meet-up to arrange; after completion the number has no business travelling
with the record. The UI shows it as a `tel:` pill on the buyer's Orders page
and on the seller's Incoming orders tab.

---

## 8c. Screening rules (AI-10)

`GET /api/v1/screening-rules/?kind=&active=` reads the phrases (moderator or
administrator); `POST`, `PATCH` and `DELETE` change them (administrator only).
The list is unpaginated on purpose — the screen shows what the check looks for.
Every write is audited. With the table empty the shipped list applies; see
`SCREENING-RULES.md`.

## 8a. Messaging reports (MS-04, MS-05)

`POST /conversations/<id>/report/` files a report from a participant — `reason`,
optional `details`, optional `message`. `GET /message-reports/?status=` is the
queue: staff see all of it, a member only their own. Each row carries
`reported_messages` — the text of the reported message, copied at filing time —
and no other message of the thread, ever; a whole-thread report carries none.
`POST /message-reports/<id>/resolve/` takes `action` (`dismiss`, `warn`,
`suspend`) and a `note`, which is required for anything but a dismissal because
it is what the sender is told. See `MESSAGE-REPORTS.md`.

## 8a1. Confirming a handover (OT-10)

An order becomes **completed** only when both sides say the meet-up happened.
Each party calls `POST /orders/<reference>/confirm/`; the first call stamps that
side and leaves the order `accepted` with `awaiting_confirmation` naming the other
party, who is notified. The second call completes the order and moves the stock,
once. `POST /orders/<reference>/transition/ {"status": "completed"}` still works
and means the same thing — the caller's half.

A stranger gets 404 (the queryset is already scoped to their orders), a request
that was never accepted gets 400, and confirming a completed order gets 400 rather
than counting the sale twice.

## 8a2. Reporting a listing or a member (RM-01)

`POST /forum/reports/` now takes `type` of `listing` (with the listing `slug`),
`user` (with the member's email) and `review` (with the review id), alongside the
post, comment and order rows it already took — six targets in all, with a
conversation covered by the message reports above. The screen offers the SRS's
reasons: Misleading, Scam, Inappropriate, Not from RTU, Other. The snapshot rule holds: the listing's title and description, or the
member's display name, are copied at filing time so an edit cannot change the
evidence. You cannot report your own listing or yourself, and the reported person
never sees the report (RM-07). They land in the same staff queue as everything
else, labelled **Listing** or **Member**.

On screen: **Report listing** and **Report seller** beside the seller card on a
product page, both opening `#/report?type=…`.

## 8b. Appeals API (AI-06, RM-08)

`GET /appeals/?status=` lists a member's own appeals, or the whole queue for
staff. `POST /appeals/` files one — `kind` of `listing`, `post`, `comment` or
`account`, plus the target id and a reason of at least a sentence.
`POST /appeals/<id>/decide/` takes `grant` and a required `note`; the server
refuses the appellant and the person who made the original decision.
`POST /appeals/suspension/` is the one unauthenticated door: email, password and
reason, for an account that cannot sign in to appeal. See `APPEALS.md` for the
rules and the outcome of each kind.

## 9. Forum API (posts, comments, reactions, reports)

**Selling schedule posts (CF-05).** A post whose `topic` is `Selling schedule`
is an appointment, and the server enforces it: `event_date`, `event_start` and
`event_place` are required (an `event_end` is optional but must be after the
start), the date cannot be in the past, and a missing field returns a sentence
that names what is missing — `A selling schedule needs a date, a start time and a
campus location.` The four fields are blank on every other topic. Both the forum
card and the post page render the appointment as one line under the title.

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/forum/posts/` | public | Hidden and screening-held posts are excluded for everyone except their author and staff; `?topic=`, `?kind=`, `?author=me`, `?moderation=visible,needs_review` |
| POST | `/api/v1/forum/posts/` | verified members | `{kind, topic, title, body, images}`; `kind=notice` is staff-only; the post is screened and a flagged one comes back `moderation_status=needs_review` (held), not deleted |
| GET | `/api/v1/forum/posts/<id>/` | public | Includes comments, react counts and the caller's own reaction; `screening` is populated for moderators only |
| PATCH | `/api/v1/forum/posts/<id>/` | the author | Blocked while staff have the post hidden; a title/body/topic edit is re-screened |
| DELETE | `/api/v1/forum/posts/<id>/` | author or moderator | Staff deletion closes open reports on it |
| POST | `/api/v1/forum/posts/<id>/comments/` | verified members | `{text, parent}`; a reply must belong to the same post; screened like a post, so a flagged comment returns `moderation_status=needs_review` and is hidden from everyone but its author and staff |
| PATCH | `/api/v1/forum/comments/<id>/` | the author | An edit is re-screened |
| DELETE | `/api/v1/forum/comments/<id>/` | author or moderator | A comment with replies is soft-deleted into a tombstone |
| POST | `/api/v1/forum/posts/<id>/react/` | verified members | `{key}` from like/love/haha/wow/sad; same key removes |
| POST | `/api/v1/forum/posts/<id>/moderate/` | moderators | `hide`, `restore` (also clears a screening hold), `pin`, `unpin`, `delete` |
| POST | `/api/v1/forum/comments/<id>/moderate/` | moderators | `hide`, `restore` (also clears a screening hold), `delete` |
| POST | `/api/v1/forum/reports/` | verified members | `{type: post|comment|order, post, comment, order, reason, details}` |
| GET | `/api/v1/forum/reports/` | staff see all; a member sees their own | `?status=`, `?type=` |
| POST | `/api/v1/forum/reports/<id>/resolve/` | moderators | `{status, action, note}`; `hide`/`restore`/`delete` change the content, `warn` does not |

Rules:

- one reaction per member per post; a different emoji replaces the old one;
- a member cannot report their own content, and the same member cannot file the
  same open report twice;
- an order report may only be filed by that order's buyer or seller;
- hiding is reversible (a timestamp, not a delete), which is what lets a
  moderator take a second look; deleting is final;
- post photos arrive as browser data URLs, are decoded to media files under
  `media/forum/`, and are returned as absolute URLs. JPEG, PNG and WebP only,
  2 MB each, 4 per post.

`frontend/src/features/marketplace/api/forum.ts` maps server rows back into
`db.feed` and `db.freports`. Server ids carry the `api:` prefix; author and
reporter emails are not exposed, only `is_mine`, so the ownership checks read
the caller's own rows. Reaction counts are rebuilt with synthetic keys because
the UI's map is keyed by email, and the caller's own choice stays keyed by their
email. `refreshForum` runs with the startup fetches and after every write.

Announcements are notice posts: `kind=notice`. The Staff tools composer posts
one, the profile card and its archive read `/forum/posts/?kind=notice`, and
deleting an announcement deletes that post. Posting a notice notifies every
active verified member (the author and staff are skipped).

---

## 10. Notifications API

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications/` | verified members | The caller's inbox, newest first, unpaginated; `?unread=1` |
| POST | `/api/v1/notifications/read/` | verified members | `{"ids": [1, 2]}` or `{"all": true}` |
| POST | `/api/v1/notifications/<id>/read/` | the recipient | Marks one row |

Rows are written by the service that caused the event, never by the client:

- an order is placed → the seller (`shop` link, order reference);
- the seller accepts/declines/completes → the buyer (`order` link);
- the buyer cancels → the seller (`shop` link);
- a message is sent → the other participant (`message`, `cv-<id>`);
- a comment or reply → the post author and the parent author (`post`, post id);
- a report is filed → every moderator/admin (`freports`); resolving it →
  the reporter;
- a new rating → the seller (`reviews`); an edit does not re-notify;
- a staff notice → every active verified member (`post` link); the author and
  staff are skipped;
- a listing is approved or rejected → the seller (`shop`);
- an Official Store request → office staff/admin (`baoorders`); a ticket status
  change → the buyer (no link yet).

`link_kind` uses the UI's own vocabulary (`order`, `shop`, `message`, `post`,
`freports`, `reviews`, `baoorders`, …). The bridge
(`frontend/src/features/marketplace/api/notifications.ts`) prefixes ids for
posts, conversations and listings so `openNotification` can find the local row.
`refreshNotifications` replaces the account's list with the server's and runs
at startup, every 20 seconds, on focus, after a write, and on Mark all read.
A self-notification is never written; a missing recipient is skipped rather
than failing the action that caused it.

---

## 11. Admin users and audit API

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/users/` | staff | Every account; `?q=`, `?role=`, `?status=`; counts included |
| GET | `/api/v1/admin/users/<id>/` | staff | One account |
| POST | `/api/v1/admin/users/<id>/status/` | administrators | `{"status": "active|suspended|banned", "note": "..."}` |
| POST | `/api/v1/admin/users/<id>/role/` | administrators | `{"role": "user|office_staff|moderator|administrator"}` |
| GET | `/api/v1/admin/audit/` | staff | Newest first; `?action=`, `?target_type=`, `?q=` |
| GET | `/api/v1/admin/backup/` | administrators | A consistent copy of the live SQLite database, as a download; recorded in the audit log |

Rules:

- staff = moderator or administrator; only an administrator may write;
- a staff account, or your own account, cannot be suspended or banned here;
- suspending or banning needs a reason of at least five characters;
- the account's token is deleted immediately, and the token class also refuses
  any copy of it (`can_sign_in` is checked on every authenticated request);
- a suspended or banned seller's listings drop out of the public catalogue
  without being deleted;
- restoring access notifies the member;
- the last administrator cannot be demoted, and nobody can change their own
  role;
- every status/role write, listing approve/reject and forum moderation action
  appends an `AuditLog` row (actor, action, target, note). The log has no
  update or delete endpoint.

`frontend/src/features/marketplace/api/admin.ts` merges the account list into
`db.accounts` by email — the server wins on role, status, verification, join
date and the authoritative listing/order/post counts, while the local record
keeps its cart, orders, notifications and listing rows. Accounts the browser
has never seen are created through `mkAcct`. Audit rows are merged oldest-first
so the screen's reverse view stays newest-first. `refreshAdminData` runs only
for staff, at startup and after a status change.

### Backups

`GET /api/v1/admin/backup/` streams the database itself, not the browser
snapshot: the view asks sqlite3's backup API for a consistent copy through the
connection Django is already using, so the copy is valid while the site keeps
serving. It is administrator-only because the file contains every account row
and password hash, and each download appends a `backup_download` row to the
audit log. On a PostgreSQL deployment the endpoint answers `501` and points at
`pg_dump` instead of pretending.

**Restore is deliberately not an endpoint.** Replacing a live database from
inside the running process is how a demo loses its data. `docs/BACKUP.md` keeps
a verified nightly copy and documents the full procedure; the short version:

    1. systemctl --user stop rtu-tindahan
    2. cp db.sqlite3 db.sqlite3.before-restore
    3. cp rtu-tindahan-YYYYMMDD-HHMMSS.sqlite3 db.sqlite3
    4. systemctl --user start rtu-tindahan
    5. curl -s 127.0.0.1:8000/health/   # {"status":"ok","database":"ok",...}

The old Staff tools file import looked like a restore but only replaced the
browser's snapshot, so it was removed.
