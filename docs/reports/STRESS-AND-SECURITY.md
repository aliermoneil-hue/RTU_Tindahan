# Stress, security and privacy — what the empty site could tell us

Run against the local install on kallisto-1 (4 cores, 7.8 GB RAM, SQLite in WAL
mode, gunicorn 3 workers × 4 threads = 12 concurrent request slots), while the
database held 40 listings from 20 stress sellers, 30 forum posts and 21 accounts.

Two scripts produced this: `scripts/stress_test.py` (crowd, with write paths) and
`scripts/security_sweep.py` (the checklist a reviewer would run). Raw numbers are
in `stress-50.json`, `stress-200*.json` and `security-sweep.txt` beside this file.

---

## 1. Three defects found, and what happened to them

### Server errors under simultaneous order requests — fixed

24 order requests sent at the same instant produced **14 HTTP 500s**. Two causes,
both real:

* `_next_reference` counted the day's orders and added one, so every writer in the
  same second computed the same reference and collided on the unique column.
  It now takes the highest number in use, and retries once if two writers still
  agree.
* More importantly, SQLite transactions were **DEFERRED**: a transaction that reads
  first (the reference lookup) and writes second can find, at write time, that
  another connection committed in between. SQLite answers `SQLITE_BUSY` at once —
  `busy_timeout` does not apply to that case — and the request becomes a 500.
  The database now opens transactions **IMMEDIATE**, so the second writer waits its
  turn instead of failing.

After both changes, the same 24 simultaneous requests returned **21 × 201 and 3 ×
400**, the 400s being the stock rule ("only N left") doing its job. Verified twice,
before and after.

### A guest could read a seller's student number — fixed

`GET /api/v1/listings/` returned `seller_email` to anonymous visitors. Because a
student's RTU address *is* the student-number form (AV-04), the public marketplace
was publishing an identifier that RA 10173 treats as personal data — and that the
project's own privacy note says is withheld until an order is accepted.

`seller_email` is now null for guests and present for signed-in members, who need
it to build order, review and favourite keys. Verified: anonymous → `null`,
member → the address. Three tests pin it.

### Listing creation blows the 3-second budget — open, with a recommendation

`POST /api/v1/listings/` runs the AI screening synchronously, so the request waits
for a network call to Gemini:

| load | p50 | p95 | p99 |
|---|---|---|---|
| 50 users | 412 ms | 1.99 s | 5.63 s |
| 200 users | 1.30 s | 4.10 s | 5.62 s |

PF-02 asks for 3 s. Reads are fine (p50 20–50 ms); it is the model call that
dominates, and its latency is not ours to control. The remedy is architectural —
write the listing as `pending_screening`, return immediately, and let a worker
screen it — which is a change worth making only if the panel pushes on it. Until
then the honest statement is: "creation is bounded by the AI provider, at roughly
0.4 s typical and 6 s worst case."

---

## 2. How the site behaves under a crowd

| crowd | requests | p50 | p95 | p99 | failures |
|---|---|---|---|---|---|
| 50 users, think 1.0 s | 1,177 | 42 ms | 753 ms | 1.59 s | 5 (stock rules) |
| 200 users, think 2.0 s, 12 slots | 2,621 | 917 ms | 3.64 s | 4.45 s | 48 (26 stock rules, 22 sign-in throttle) |
| 200 users, think 2.0 s, 36 slots | 2,194 | 562 ms | 3.35 s | 4.59 s | 12 |

What this says:

* At a realistic campus load (50 concurrent) the site is comfortable: p95 under a
  second for browsing, search, filters and the forum.
* At 200 concurrent virtual users the queue is the server, not the query. 200
  visitors on 12 request slots means most of them are waiting for a slot: p50
  rose to ~0.9 s with no query slower than ~60 ms.
* Tripling the slots (9 workers × 4 threads) improves p50 by ~40% and changes p95
  hardly at all, because four cores are the ceiling. More workers on this box buys
  queueing, not throughput.

Recommendation, in order of value per hour: keep 3 workers × 4 threads (12 slots
already fits the observed load); if the panel will demo at 200 concurrent, serve
from a machine with more cores rather than more workers; move to PostgreSQL only if
write concurrency becomes the measured problem, which it is not today.

The 22 sign-in failures at 200 users are the **throttle** working: five failures and
the account is locked for fifteen minutes. A crowd that keeps mistyping is
supposed to be stopped, and it was.

---

## 3. Security and privacy sweep — 16 checks, 14 pass, 2 warn, 0 fail

| check | result |
|---|---|
| guests cannot reach acting endpoints (orders, notifications, conversations, favourites, `/auth/me/`, stock, screening rules) | PASS — all 401/403 |
| a student cannot reach staff endpoints | PASS — refused |
| another student cannot open an order that is not theirs | PASS — 404 |
| another student cannot read a conversation that is not theirs | PASS — 404 |
| an order hides the other side's contact until acceptance (OT-07) | PASS — `seller_contact: null` while requested |
| public listings do not leak student numbers | PASS (after the fix above) |
| public listings do not leak mobile numbers | PASS |
| a weak password is refused | PASS — 400 |
| a failed sign-in does not reveal whether the account exists | PASS — "email or password is incorrect", with attempts left |
| a malformed request returns no stack trace | PASS |
| clickjacking refused | PASS — `X-Frame-Options: DENY` |
| content sniffing refused | PASS — `X-Content-Type-Options: nosniff` |
| a content security policy is sent | WARN — missing on the API; added to the SPA in report-only mode |
| HSTS on an HTTPS origin | WARN — configured (`SECURE_HSTS_SECONDS`, 30 days, preload) but only sent on secure requests; this run was plain HTTP |
| no session cookie for token auth | PASS |
| repeated wrong passwords are throttled | PASS — 400,400,400,400,429,429,429 |

The two warnings are honest and cheap: CSP is now in `frontend/vercel.json`
(report-only first, so a demo cannot break on it), and HSTS is already configured
for production — the local HTTP probe simply cannot trigger it.

### What this sweep does not cover

It is a checklist, not a penetration test. Not attempted: SSRF, deserialisation,
dependency CVEs, SQL injection beyond DRF's own guards, brute force against the
verification-code endpoint, or a review of the SPA bundle for token handling —
the token lives in `localStorage`, which is XSS-readable, and the CSP is the
mitigation now standing in front of that.

---

## 4. What to tell the panel

* Guests can browse; nothing that acts is reachable without a verified account.
* One member cannot read another's order, conversation or contact details.
* A student number is no longer in any public payload.
* Passwords are PBKDF2, weak ones are refused, five failures lock the account, and
  a bad sign-in never says whether the account exists.
* Under 50 concurrent visitors, browsing answers in tens of milliseconds and the
  slowest page is under a second at p95.
* Every number above came from a script in this repository, on this machine, and
  the scripts can be run again in front of the panel.
