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
| `ordering` | `?ordering=price` | `newest`, `oldest`, `price`, `-price`, `popular`, `best-selling`, `least-sold`. Sales ordering uses `sold_count`, which a ticket raises when staff mark it `claimed` |
| `page` | `?page=2` | Page size is 20 (global DRF setting) |

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
| GET | `/api/v1/store/daily-counts/` | Office Staff | Physical counts |
| POST | `/api/v1/store/daily-counts/` | Office Staff | Body `{"variant": 3, "counted_quantity": 8, "reason": "..."}` |
| GET | `/api/v1/store/settings/` | public | Ordering window, limits, thresholds |
| PATCH | `/api/v1/store/settings/` | Office Staff | |

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

Still local (localStorage): forum, reviews, and the admin user/audit screens.
Cart, orders, chat, moderation, the store screens and favourites are now
server-backed; the bridges live in `frontend/src/features/marketplace/api/`.

## 6. What is still missing

- Forum posts, reports and the admin user/audit log have no models yet.
  Everything else on the buy/sell path reads and writes the API.
- The AI screening pass has never been reviewed against real listings: the
  provider is wired (`apps/screening`), but the prompt and flag thresholds
  are untuned, so a flagged listing still waits for a moderator.
- "Small sellers" sort stays blocked on a product decision: nobody has defined
  what "small" means (listing count or sales volume).

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
