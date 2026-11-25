# Learning Guide — How to Read This Codebase

This is a map for learning the project file by file. Everything here reflects
the actual tree in this repository. Read it once top to bottom, then keep it
open while you browse the code.

---

## 1. What this project is

RTU Tindahan is a campus marketplace for the Rizal Technological University,
Pasig Campus: verified students buy and sell food, merchandise, books and
manuals. Every listing, forum post, comment and review passes through an LLM
(Gemini) screen before publication; anything flagged goes to a human moderator.

- **Course:** ICS-501A — System Integration and Architecture Laboratory 1
- **Client:** React 19 + TypeScript + Vite (this folder: `frontend/`)
- **Server:** Django + Django REST Framework (this folder: `backend/`)
- **Databases in use:** SQLite on kallisto-1, PostgreSQL 18 on kallisto2 —
  the code picks one from environment variables (see §9)

---

## 2. The 60-second map

```
RTU_Tindahan/
├── backend/            Django project — the API, the database, the screening
│   ├── config/         Project wiring: settings, root URLs, error handling
│   └── apps/           12 Django apps, one per feature area (see §4)
├── frontend/           React SPA — every screen the user sees
│   └── src/
│       ├── features/   3 feature bundles: authentication, core, marketplace
│       └── common/     Shared API client, components, hooks, routing, types
├── scripts/            Standalone measurement tools (stress test, security sweep)
└── docs/               30+ written docs, reports, and the SRS references
```

Two services talk to each other over HTTP/JSON. The frontend never touches the
database; it only calls `https://.../api/v1/...` endpoints. That split is the
"system integration" the course title refers to.

---

## 3. Backend wiring — `backend/config/`

| File | What it does |
| --- | --- |
| `settings.py` | All Django settings. Reads `POSTGRES_*` env vars — if they are set you get PostgreSQL, otherwise SQLite. Holds the SQLite pragmas (busy_timeout, IMMEDIATE transactions) and the allowed hosts/CORS. |
| `urls.py` | The front door. Mounts `/admin/`, `/health/`, and all 12 app routers under `/api/v1/`. Also serves `/media/` with a 7-day browser cache so listing photos do not re-travel on every visit. |
| `api_errors.py` | One place that formats every error response, so no view ever leaks a stack trace or internals to a client. |
| `sqlite_pragmas.py` | SQLite tuning. The IMMEDIATE transaction mode is the fix for the 500-errors-under-simultaneous-orders defect — read the comment in the file, it explains the SQLITE_BUSY race in six lines. |
| `wsgi.py` / `asgi.py` | Entry points for production servers (gunicorn uses `config.wsgi`). |
| `tests.py` | Cross-cutting tests that do not belong to one app. |

How a request flows: browser → `config/urls.py` → the matching app's `urls.py`
→ a function in that app's `views.py` → `serializers.py` validates the payload
→ `models.py` rows change → JSON goes back. Keep that loop in your head; every
app follows it identically.

---

## 4. The 12 apps — `backend/apps/`

Every app has the same skeleton: `models.py` (tables), `serializers.py`
(JSON in/out), `views.py` (endpoints), `urls.py` (routes), `tests_api.py`
(behaviour tests). The extras are what make each app interesting.

| App | Owns | Notable files |
| --- | --- | --- |
| `accounts` | Users, roles, sign-in, verification, password reset | `authentication.py` (token sign-in), `lockout.py` (5 failed sign-ins → temporary lockout), `verification.py` (RTU email codes), `permissions.py` (role rules), `emails.py`, `json_backup.py`, `managers.py` (email is the username) |
| `catalog` | Listings, categories, photos, the public feed | `feed.py` (what the marketplace page shows and in what order), `photos.py` (upload handling) |
| `orders` | Orders and order lines, the checkout flow | `services.py` (order reference generation — highest-in-use + retry, the concurrency fix), `tests_reference.py` (tests that pin that fix) |
| `messaging` | Conversations and messages between buyer and seller | `services.py` (conversation creation rules) |
| `forum` | Forum posts, comments, reactions, reports | `report_status.py` (report lifecycle states) |
| `reviews` | Seller reviews left after orders | — |
| `favorites` | Saved listings per user | — |
| `screening` | The LLM gate before publication | `providers.py` (Gemini call), `rules.py` (screening rules configurable in the DB), `images.py`, `redact.py` (strips personal data before the prompt leaves the machine), `signals.py` (hooks screening into publish events) |
| `store` | The official RTU store: stock, tickets, counters | `mail.py`, `services.py` |
| `appeals` | Users appealing a moderation decision | `services.py` |
| `notifications` | In-app notifications (new order, new message…) | `services.py` |
| `audit` | Audit log of staff actions | `services.py` |

Models live one per concept — `Listing`, `Order`, `OrderLine`,
`Conversation`, `Message`, `ScreeningResult`, `ScreeningRule`,
`OfficialTicket`, `StockMovement`, `EmailOutbox`, `AuditLog`, and so on
(~30 tables in total). `EmailOutbox` is worth knowing: outbound mail is
written to the database first and sent by a worker, which is why e-mail
never blocks a web request.

---

## 5. Roles — who may do what

| Role | Powers |
| --- | --- |
| Visitor | Browse the public catalogue and forum, no account |
| Verified user | Buy, sell, post, review, favourite, message |
| Office staff | Verify accounts and school credentials |
| Moderator | Review flagged content, resolve reports, approve listings |
| Administrator | Everything, through Django Admin (`is_staff`) |

The enforcement points, in order: `accounts/permissions.py` (role rules used
by views), per-view checks in each app's `views.py`, and Django's `is_staff`
gate on `/admin/`. When you change any permission, check it from the *other*
roles too — that is what `scripts/security_sweep.py` automates.

---

## 6. The screening flow — the most interview-worthy part

1. A listing, post, comment or review is submitted.
2. `screening/services.py` builds a prompt from the text (personal data is
   stripped first by `redact.py`).
3. `screening/providers.py` calls Gemini. Rules come from the `ScreeningRule`
   table, so moderators can tighten screening without a code change.
4. Result is stored in `ScreeningResult`. Clean → published. Flagged → held
   for a moderator, and the user may file an `appeals` case.

Known open item (be honest about it if asked): screening runs *synchronously*
during creation — measured p50 0.42 s, p99 6.2 s against a 3-second budget.
The planned fix is to move screening into a background worker.

---

## 7. Frontend — `frontend/src/`

| Path | What it does |
| --- | --- |
| `main.tsx` | Boots React, mounts `App.tsx` |
| `App.tsx` | Providers: auth context, router, theme |
| `features/authentication/` | Sign-in, sign-up, verification, password reset. `AuthContext.tsx` holds the session; every screen reads it |
| `features/core/` | Layout shell, routing (`routes.ts`, `AppRoutes.tsx`, `lazyPages.ts` — code-splitting so each page loads only when visited), shared components |
| `features/marketplace/` | The actual product: catalogue, listing pages, orders, messages, forum, profile. `api/` holds the fetch wrappers, `context/` shared state, `imageStore.ts` photo handling |
| `common/api/` | One HTTP client that attaches the auth token and normalises errors |
| `common/components/` | Buttons, modals, tables — reused everywhere |
| `common/router/`, `common/types/`, `common/hooks/`, `common/utils/` | Shared plumbing |

Frontend rule of thumb: pages never call `fetch` directly; they go through
`common/api/` and `features/marketplace/api/`. Follow one flow (e.g. placing
an order) across the split — page → api wrapper → backend view → serializer →
model — and the whole architecture becomes concrete.

---

## 8. Scripts — `scripts/`

Run from `backend/` (they need the venv) unless noted:

| Script | Purpose |
| --- | --- |
| `stress_test.py` | Simulated crowd: `python3 scripts/stress_test.py --users 50 --seconds 30`. Prints p50/p95 and per-endpoint latency. |
| `security_sweep.py` | The 16-check security/privacy checklist (guest blocks, IDOR, lockout, headers). |
| `load_test.py` | Simpler single-endpoint load measurement. |
| `srs_matrix.py` | Cross-checks implemented features against the SRS requirement IDs. |
| `contrast_audit.py` | WCAG colour-contrast audit of the UI palette. |

Raw evidence for the load runs lives in `docs/reports/`
(`stress-50-clean.json`, `stress-200-9workers.json`, …) with the written
summary in `docs/reports/STRESS-AND-SECURITY.md`.

---

## 9. Running it locally (kallisto2 / Windows)

The backend chooses its database from environment variables, so your
PostgreSQL 18 setup on :5001 is untouched by pulling new code — it lives in
`.env`, which git never overwrites.

```powershell
cd C:\dev\RTU_Tindahan

# backend — first time only
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# .env needs (Postgres on kallisto2):
#   POSTGRES_DB=..., POSTGRES_USER=..., POSTGRES_PASSWORD=..., POSTGRES_PORT=5001

python manage.py migrate
python manage.py runserver        # API on http://127.0.0.1:8000

# tests — the suite is the project's safety net (609 tests)
python manage.py test

# frontend — separate terminal
cd C:\dev\RTU_Tindahan\frontend
npm install
npm run dev                       # SPA on http://127.0.0.1:5173
```

If `.env` sets the `POSTGRES_*` variables you are on PostgreSQL; delete them
and you fall back to SQLite. Nothing in the code changes.

---

## 10. A reading order for learning (suggest one item per sitting)

1. `README.md` — the system, roles, stack.
2. `backend/config/urls.py` — see all endpoints mounted in one screen.
3. `accounts/models.py` then `accounts/views.py` — how sign-in and roles work.
4. `catalog/models.py` then `catalog/feed.py` — what a listing is and what the
   marketplace shows.
5. Follow one full flow end to end: **place an order**
   (`features/marketplace` page → api wrapper → `orders/views.py` →
   `orders/serializers.py` → `orders/services.py` → `Order`/`OrderLine`).
6. `screening/services.py` + `SCREENING.md` in docs/ — the LLM gate.
7. `orders/services.py` + `orders/tests_reference.py` + `sqlite_pragmas.py` —
   the concurrency fix; be able to explain it in two sentences.
8. Run the test suite and read one test file top to bottom
   (`orders/tests_api.py` is a good one).

Deeper reference docs when you need them: `docs/SCREENING.md`,
`docs/POSTGRES.md`, `docs/AUTH-HARDENING.md`, `docs/BACKUP.md`,
`docs/DEMO-RUNBOOK.md`, and `docs/REQUIREMENTS-TRACE.md` (maps every SRS
requirement to where it lives).

---

## 11. Three fixes you should be able to defend (panel prep)

1. **Duplicate order references under simultaneous orders.** The old code
   counted rows and added one — every writer in the same second computed the
   same number. Now the reference derives from the highest one in use, with a
   retry on collision, and SQLite transactions open IMMEDIATE so the write
   lock is taken at the start. Evidence: 24 simultaneous orders → 21 × 201,
   3 × 400 (the stock rule refusing, as designed).
2. **Seller privacy.** `GET /api/v1/listings/` used to return the seller's
   e-mail — and an RTU e-mail is a student number. It is now `null` for
   guests, visible only to signed-in members who need it for orders,
   reviews and favourites. Three tests pin it.
3. **Capacity honesty.** 50 concurrent users: p50 48 ms. 200 concurrent:
   handled with no failures, p50 ~0.6–0.9 s, p95 ~3.4–3.6 s on four cores —
   queueing, not slow queries. Say what was measured, on what hardware.
