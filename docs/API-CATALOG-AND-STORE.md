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

Still local (localStorage): cart, orders, chat, forum, reviews, favourites,
moderation. Still missing: the write path from the UI — posting a listing or
placing a ticket needs the auth swap first, because the frontend has no real
token yet.

## 6. What is still missing

- The write path from the UI: posting a listing, approving from the moderation
  screen, and placing official-store tickets still go to localStorage. The
  token is real now (see `docs/AUTH-CODE-FLOW.md`), so these can call the API.
- `src/features/core/routes.ts`: product, browse, store, create, and shop are
  now marked `backend: 'available'`. Orders, cart, favourites, messages, forum,
  and the admin pages stay `missing`.
- The AI screening service (`screening` app) does not exist, so listings stay
  `pending_screening` until a moderator approves them by hand. That is
  intended for now.
- No student-to-student orders, cart, chat, forum, reviews, or reports: those
  have no models yet.
