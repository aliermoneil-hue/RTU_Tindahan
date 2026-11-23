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
              +--> provider raises          -> with LLM_FALLBACK on, the rules provider
              |                                answers and the audit row says so;
              |                                with it off, status becomes needs_review
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
| A term from `PROHIBITED_TERMS` appears | 90 | The guideline's "cannot sell" list: counterfeit, exam answers, weapons, drugs, vapes, tobacco, alcohol, medicines, gambling, stolen goods, IDs, sexual content |
| A `SCAM_PATTERNS` hit, or a Philippine mobile number | 85 | Pay-first, no meetup, contact or payment outside the app |
| The text contains a link | 60 | Listings must not carry external links |
| Description shorter than 20 characters | 55 | Not enough text to judge |
| Price above 50,000 | 55 | Far outside a campus resale |
| Title is all capitals, longer than 12 characters | 40 | Common spam shape; alone it stays below the threshold |

A score of 50 or more (`FLAG_THRESHOLD`) is flagged; below that is clean. The
reasons are stored, so a moderator reads *why* rather than a bare verdict.

The rules follow `RTU_Tindahan_Posting_and_Selling_Guideline.pdf`, summarised
in `POSTING-AND-SELLING-GUIDELINE.md`. Single words are matched from their left
boundary, so "vape" catches "vapes" without "wine" firing inside "twine".
Photos are capped separately: 1–10 per listing, JPG/PNG/WebP, 5 MB, and at
least 100 × 100 pixels (`validate_image_size` in `apps/catalog/models.py`).

The stub is a placeholder for the real thing, and it is honest about that: it
cannot read intent, and it will not catch anything written to dodge a keyword
list. Do not describe it to the panel as an AI checker.

---

## 4. Gemini (the configured provider)

    LLM_PROVIDER=gemini
    LLM_API_KEY=<the key>
    LLM_MODEL=gemini-3.1-flash-lite
    LLM_TIMEOUT=12
    LLM_FALLBACK=True

`GeminiProvider` sends the title, description, and price with a system
instruction and a response schema, so the answer comes back as JSON with a
verdict, a score, and at most three reasons written for a moderator. Measured
on this project's machine: 1.0–2.1 seconds per listing, about 160 tokens each.

**The model name lives in `.env`, never in code, and is taken from the
provider's own model list.** That is not fussiness. The first name tried here
was `gemini-2.5-flash`; the API answered *"no longer available to new users"*
and pointed at a successor that then returned `503 UNAVAILABLE` for minutes at
a time. `gemini-3.1-flash-lite` answered 6 of 6 test listings correctly. When a
model is retired again, change one line in `.env` — and check the list first:

    curl -s -H "x-goog-api-key: $KEY" \
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200" \
      | grep -o '"name": "models/[^"]*"' | sort

The key travels in the `x-goog-api-key` header, never in the query string — a
URL ends up in logs and error messages far more often than a header does.

### When the provider fails

`LLM_FALLBACK=True` (the default) means a timeout, an exhausted free tier, or a
retired model name does not leave a listing unscreened: `run_screening` catches
the failure, runs the deterministic rules instead, and records it as
`provider: "gemini+fallback"` with the sentence *"The gemini provider failed
(HTTPError), so the rules check answered."*

This is safe only because screening never publishes. The worst outcome is a
flagged item reaching the moderator's pending queue instead of the review
queue, and a human still decides. With `LLM_FALLBACK=False` the same failure
sends the listing straight to `needs_review` with the error as the reason.

Verified by pointing `LLM_MODEL` at the retired name on purpose:

    provider : gemini+fallback
    verdict  : clean | score: 0
    status   : pending_screening
    reasons  : ['The gemini provider failed (HTTPError), so the rules check answered.']

### Adding a different provider

Three steps, none of them outside `providers.py`:

1. Add a class with a `name` and a `screen(self, listing) -> Verdict` method.
   Read `settings.SCREENING_API_KEY` inside it. Never accept a key as an
   argument passed down from a view.
2. Register it in the `PROVIDERS` dict at the bottom of that file.
3. Set `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY` in `backend/.env`, then run
   `python manage.py test apps.screening`. The existing tests still apply: a
   provider that raises, returns nonsense, or times out must not publish.

Pass the transport into the constructor when you write tests — both providers
accept one — so the suite answers from a fixture instead of the network.

Keep provider calls inside the `LLM_TIMEOUT`. A hung request in
`run_screening` hangs the seller's POST, because screening runs inline. If that
becomes a real problem the fix is a background job, not a longer timeout.

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

- **Only listings are screened.** Forum posts and comments rely on reporting
  and moderator action instead of a screening pass; if that changes, the
  provider needs an entry point that takes plain text rather than a `Listing`.
- **Nothing publishes automatically.** A clean verdict still waits for a
  moderator. Auto-publishing would be a deliberate change to `run_screening`
  plus its tests — not a side effect.
- **The keyword list is high-precision, not exhaustive.** It cannot read
  intent, and the model is what handles semantic cases; see the calibration
  below.

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

---

## 8. Calibration against a realistic sample

On 2026-11-23 the rules provider was run against 20 listings chosen to look like
the real catalogue: 14 ordinary ones (calculator, reviewer, food, uniform, lab
gown, tutoring, printing, Arduino kit), three deliberate traps, and three that
must flag (vape, answer key, pay-first GCash scam).

| Set | Listings | Rules result |
| --- | --- | --- |
| Ordinary | 14 | 14 clean, score 0 |
| Traps: "Nude color heels", "Root beer float", "The Stolen Heir" | 3 | 3 clean after the fixes below |
| Prohibited: vape, answer key, pay-first scam | 3 | 3 flagged (90, 90, 85) |

Two traps were false positives in the first pass, both at score 90:

    Root beer float  -> "Mentions a prohibited item: beer."
    The Stolen Heir  -> "Mentions a prohibited item: stolen."

A moderator who sees a book and a float in the queue learns to ignore the queue,
so the list was tightened rather than widened:

- `beer` and `wine` dropped — root beer, ginger beer and cooking wine are food
  words. `liquor`, `vodka` and `whiskey` stay.
- `stolen` became `stolen goods` / `stolen items`; a novel title is not a
  confession.
- `casino` became `casino chips` (a film title is not gambling), and
  `ecstasy` became `ecstasy pills` (a perfume shares the name).

Regression tests pin each decision: root beer and the book stay clean, while
`stolen goods` and `liquor` still flag.

### The model during this window

Gemini answered only a handful of the samples: the API returned `503 Service
Unavailable` or timed out on 18 of 20 with three attempts each, while the few
answers it gave were right — "Vape starter kit" flagged 100, the GCash scam
flagged 90, and ordinary listings including "Nude color heels" scored 0.

That is the fallback doing its job, not a screening failure: every listing still
received a verdict and still waits for a moderator. It is also a reminder for
the panel — if the free tier is exhausted during a demo, the queue will show
"gemini+fallback" as the provider and the deterministic rules' reasons.
