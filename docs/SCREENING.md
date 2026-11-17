# Content screening (AI-01 to AI-16)

Every listing passes a screening step before a moderator can publish it. This
file explains where that step lives, how to test it today, and how to put a
real language model behind it later without touching the rest of the system.

---

## 1. Where it sits

    seller POSTs /api/v1/listings/
              |
              v
      Listing created as  pending_screening
              |
              v
      apps.screening.services.run_screening(listing)
              |
              +--> provider returns clean   -> status unchanged (pending_screening)
              |
              +--> provider returns flagged -> status becomes needs_review
              |
              +--> provider raises          -> status becomes needs_review
              |
              v
      moderator queue: ?status=pending_screening,needs_review
              |
              v
      POST /approve/  or  /reject/   (the only way a listing goes live)

Screening never publishes anything. A clean verdict means "no obvious
problem, a human may approve it", not "publish it". That keeps LS-05 true and
keeps the approval decision where the SRS puts it.

A listing is screened again when the seller edits it, because an edit changes
the words a moderator would have judged.

---

## 2. The provider boundary

All model calls happen in one file: `apps/screening/providers.py`. Nothing
else in the project talks to a provider.

| Piece | Where it comes from | Rule |
| --- | --- | --- |
| Which provider | `LLM_PROVIDER` in `backend/.env` | Read through Django settings. A request cannot change it. |
| The key | `LLM_API_KEY` in `backend/.env` | Server-side only. Never serialised, never in a response, never in an error message that reaches the browser. |
| The answer | `Verdict` dataclass | Verdict, score, reasons. No database access, no side effects. |

The client receives a verdict at most — `screening` in the listing payload,
and only for moderators. A seller sees `null`.

Naming a provider that is not registered raises `ImproperlyConfigured`, which
the service catches and turns into `needs_review`. A typo in `.env` sends
listings to a human; it does not wave them through.

---

## 3. The stub provider

`StubProvider` is deterministic. The same listing always produces the same
verdict, which is what makes the moderation tests meaningful instead of a coin
toss.

It reads the same fields a model would read, and scores each rule it trips:

| Rule | Score | Why |
| --- | --- | --- |
| A term from `PROHIBITED_TERMS` appears | 90 | Counterfeit goods, pirated copies, exam answers, weapons, drugs, gambling |
| Description shorter than 20 characters | 55 | Not enough text to judge |
| Price above 50,000 | 55 | Far outside a campus resale |
| Title is all capitals, longer than 12 characters | 40 | Common spam shape |
| The text contains a link | 60 | Listings must not carry external links |

A score of 50 or more (`FLAG_THRESHOLD`) is flagged; below that is clean. The
reasons are stored, so a moderator reads *why* rather than a bare verdict.

The stub is a placeholder for the real thing, and it is honest about that: it
cannot read intent, and it will not catch anything written to dodge a keyword
list. Do not describe it to the panel as an AI checker.

---

## 4. Putting a real model behind it

Three steps, none of them outside `providers.py`:

1. Add a class with a `name` and a `screen(self, listing) -> Verdict` method.
   Read `settings.SCREENING_API_KEY` inside it. Never accept a key as an
   argument passed down from a view.
2. Register it in the `PROVIDERS` dict at the bottom of that file.
3. Set `LLM_PROVIDER` and `LLM_API_KEY` in `backend/.env`, then run
   `python manage.py test apps.screening`. The existing tests still apply: a
   provider that raises, returns nonsense, or times out must leave the listing
   in `needs_review`.

Keep provider calls inside a timeout. A hung request in `run_screening` hangs
the seller's POST, because screening runs inline. If that becomes a problem,
the fix is a background job — not a longer timeout.

---

## 5. The moderator queue

There is no separate queue endpoint. The catalogue API answers it:

    GET /api/v1/listings/?status=pending_screening
    GET /api/v1/listings/?status=pending_screening,needs_review

Moderators see every status, so one request covers the whole queue. Statuses
are comma-separated, and an unknown value returns `400` listing the valid
ones. Visitors cannot use `status` to see anything they could not already see,
because visibility is applied first.

Each listing in that response carries, for moderators only:

```json
"screening": {
  "verdict": "flagged",
  "score": 90,
  "reasons": ["Mentions a prohibited item: answer key."],
  "provider": "stub",
  "model": "rules-v1",
  "at": "2026-11-17T17:40:12Z"
}
```

---

## 6. What is not done

- **The moderation screen in the browser still reads local prototype data.**
  `frontend/src/features/core/routes.ts` marks `moderation` as
  `backend: 'missing'`, and `ModerationPage` renders `db.flags`. Wiring it to
  `?status=needs_review` is the next step after this service.
- **Only listings are screened.** Forum posts, comments, and reviews have no
  backend yet; when they arrive they should call `run_screening` with their
  own text, or a sibling function that accepts plain strings.
- **Nothing publishes automatically.** If the team later wants clean listings
  to go live without a moderator, that is a deliberate change to
  `run_screening` plus its tests — not a side effect.
- **Buyer-to-seller orders are not modelled in the backend**, so only Official
  Store tickets can complete a sale.

---

## 7. Checking it by hand

```bash
# a listing that should be flagged
curl -X POST http://localhost:8000/api/v1/listings/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"category":2,"title":"Answer key","description":"Complete exam answers for the midterm.",
       "listing_type":"product","condition":"used","price":"50.00","quantity":1,
       "meetup_place":"Main gate"}'

# expect "status": "needs_review"

# the queue, as a moderator
curl "http://localhost:8000/api/v1/listings/?status=pending_screening,needs_review" \
  -H "Authorization: Token <moderator token>"
```

The audit trail is in Django admin under **Screening results**: listing,
verdict, score, reasons, provider, and when it ran.
