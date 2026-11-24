# Who can see what, and the one deliberate deviation (AV-11)

AV-11, as written, is stricter than what this platform does:

> The system shall show visitors only the landing page, registration, login, and the
> preview of RTU merchandise. Everything else shall need a log-in.

The platform does not enforce that. A visitor with no account can browse the public
catalogue, open a listing, and read the forum. Everything that acts — ordering,
messaging, posting, selling, reporting, anything staff — needs a session and a
verified account, and is refused with `401` at the door.

This file records the deviation, what it is, why it was chosen, and what it costs,
so the row is answered with a decision rather than an omission.

## What a visitor can actually reach

Measured against the running service, with no token:

| Request | Anonymous result |
| --- | --- |
| `GET /api/v1/listings/` | 200 — the public catalogue, 8 rows on the demo data |
| `GET /api/v1/listings/<slug>/` | 200 — one listing in full, seller name included |
| `GET /api/v1/categories/` | 200 — the taxonomy, for the browse filters |
| `GET /api/v1/forum/posts/` | 200 — the public forum |
| `GET /api/v1/reviews/?listing=<id>` | 200 — the ratings of a listing |
| `GET /api/v1/orders/` | 401 |
| `GET /api/v1/store/tickets/` | 401 |
| `GET /api/v1/notifications/` | 401 |
| `GET /api/v1/forum/reports/` | 401 |

Nothing private is open: no order, no message, no ticket, no notification, no
report, no member's email outside what a listing already shows. The rules are
per-endpoint (`AllowAny` only on the four reading endpoints above), not a global
switch, so what a visitor sees is a short list that can be read and tested.

## Why

A campus marketplace is judged at a booth. A prospective student or a panel member
who lands on a page that says "sign in to see anything" has no way to tell whether
there is a marketplace behind it. The SRS's own note for AV-11 already softens the
rule to "visitors can also see a limited preview of Books and RTU Merchandise" —
this platform simply does not cap the preview at four items or two categories.

The cost is real and worth naming: the catalogue is public, so a seller's listing
title, description, price and display name are public. That is the same information
a poster on a campus noticeboard gives. Contact details are not: a phone number is
only ever exchanged inside an accepted order (OT-07), which needs a session.

## What would change if the rule were enforced literally

A landing-page-only gate would mean:

- the Browse screen becomes a sign-in wall, and the four preview items would need a
  separate public endpoint with its own serialiser and its own tests;
- a guest following a shared link to a listing would land on the login page, so
  every share becomes a dead end;
- the forum, which the campus uses as a noticeboard, becomes invisible until
  verification, which takes an email round-trip.

None of that makes the platform safer — the private data is already behind the
session — and all of it makes the demo worse. The decision is therefore to keep the
catalogue public and to say so here, rather than to enforce a rule whose only effect
would be to hide the product.

## Where the rule is still enforced

- Buying, ordering, reserving stock: verified session required.
- Messaging and reporting: verified session required.
- Selling, posting, reacting: verified session required.
- Any staff action: staff role required, checked per view.

The tests that hold this line live in the API suites for those apps; the four public
reads are asserted in `apps/catalog/tests_api.py` and `apps/forum/tests_api.py`.
