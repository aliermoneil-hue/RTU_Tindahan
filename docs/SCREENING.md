# Content screening (AI-01 to AI-16)

Every listing, every forum post and every forum comment passes a screening step
before it can be seen by the public. This file explains where that step lives, how to
test it today, and how to put a real language model behind it later without
touching the rest of the system.

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

### Forum posts

A post has no "pending" state to leave alone: it is live the moment it is
written. So the gate inverts, and the safe default stays safe.

    member POSTs /api/v1/forum/posts/
              |
              v
      ForumPost created as  visible
              |
              v
      apps.screening.services.run_post_screening(post)
              |
              +--> clean    -> stays visible, and is in the feed at once
              +--> flagged  -> moderation_status = needs_review ("held")
                               + the author is notified, once
                               + every moderator is notified into the forum
                                 report queue
              +--> provider fails -> fallback answers; with LLM_FALLBACK off
                                     the post is held unscreened

    moderator: GET /api/v1/forum/posts/?moderation=needs_review
               POST /api/v1/forum/posts/<id>/moderate/  {"action": "restore"}
               -> back in the public feed, hold cleared

A held post is **not hidden**: it keeps its row, its author still sees it (so
it does not vanish without explanation), staff see it, and nobody else does.

### Forum comments

A comment is the loudest channel on the site: it publishes inside somebody
else's thread the moment it is typed. It runs the same gate as a post —
`run_comment_screening` on create and again on edit — with the same shape: a
flagged comment is held (`moderation_status=needs_review`), leaves the thread
for everyone but its author and staff, notifies its author once, and notifies
the moderators. It is released by the comment `moderate` action with
`{"action": "restore"}`, which also clears the hold, and it appears under
**Held comments** in Staff → Forum reports next to the held posts.

Reviews are deliberately **not** screened: a review is a buyer's opinion of a
completed order, and holding one because it contains a word like "fake" would
suppress legitimate complaints. If the panel wants a review gate, it should be
a separate, narrower rule set.
Hiding is a separate human decision on top of the hold. An edit re-screens the
post, because an edit changes the words a moderator would have judged; a clean
re-screening does **not** release a held post, because releasing is a
moderator's decision. A held notice never fans out to the campus: the
announcement notification is only sent when screening leaves the post visible.

Posts are judged by the prohibited-content rules only. Links, phone numbers,
"message me on Facebook" and one-line replies are ordinary in a conversation,
and flagging them would bury the queue; the price, description-length, link
and all-caps rules apply to listings.

---

## 1b. Telling the member (AI-13, AI-16)

Screening a member's words without ever saying so is a quiet kind of
dishonesty, and the SRS asks for both notices in plain language. One component
carries the wording — `frontend/src/common/components/ScreeningNotice.tsx` — so
the text cannot drift between screens:

- **at sign-up** (under the privacy consent): *"Listings, posts and comments
  are checked automatically for prohibited content before other students can
  see them. A moderator reviews anything the check flags."*
- **on the posting screens** (create-listing form, forum composer, comment
  box): *"Checked automatically before it is published. The check looks for
  prohibited content only — it is not a guarantee of quality or safety."*

The second sentence is the AI-16 notice: the check is not a promise about the
seller, the item or the thread. The listing form also says the submission is
reviewed before it becomes available, which is the same fact in the seller's
own words.

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
    LLM_MODEL=gemini-3.5-flash-lite
    LLM_TIMEOUT=6
    LLM_FALLBACK=True

`GeminiProvider` sends the title, description, and price with a system
instruction and a response schema, so the answer comes back as JSON with a
verdict, a score, and at most three reasons written for a moderator. Measured
on this project's machine: 0.9–1.8 seconds per listing and per post, about 160
tokens each, which is why the whole create request lands in under 2 s.

`LLM_TIMEOUT=6` is deliberate. Screening runs inline, so the timeout is the
worst-case wait a member pays when the provider is down; 6 s is long enough for
a slow-but-working call and short enough that the rules fallback answers before
anyone assumes the form is broken. Twelve seconds was the old value and it was
felt on every post.

**The model name lives in `.env`, never in code, and is taken from the
provider's own model list.** That is not fussiness. The first name tried here
was `gemini-2.5-flash`; the API answered *"no longer available to new users"*
and pointed at a successor that then returned `503 UNAVAILABLE` for minutes at
a time. `gemini-3.1-flash-lite` then served 6 of 6 test listings correctly for
months, but on 2026-11-24 it began answering `503` on some calls while staying
available on others — a flaky model is worse than a retired one, because the
fallback hides it behind a 6-second stall. `gemini-3.5-flash-lite` was measured
on the same day at 0.9–1.3 s with 4 of 4 correct verdicts (clean listing,
answer-key listing, ordinary post, vape post), and is the one now in `.env`.
When a model is retired again, change one line in `.env` — and check the list
first:

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

The suite never touches the network for this: `config/settings.py` forces
`SCREENING_PROVIDER="stub"` whenever `manage.py test` is the entry point, because
`load_dotenv()` would otherwise carry a laptop's `LLM_PROVIDER=gemini` into the
run. A test that wants the real provider pins it with `@override_settings`.

Pass the transport into the constructor when you write tests — both providers
accept one — so the suite answers from a fixture instead of the network.

Keep provider calls inside the `LLM_TIMEOUT`. A hung request in
`run_screening` hangs the seller's POST, and in `run_post_screening` it hangs
the member's post, because screening runs inline. If that becomes a real
problem the fix is a background job, not a longer timeout.

---

## 5. The moderator queue

There is no separate queue endpoint. The catalogue API answers it:

    GET /api/v1/listings/?status=pending_screening
    GET /api/v1/listings/?status=pending_screening,needs_review

Moderators see every status, so one request covers the whole queue. Statuses
are comma-separated, and an unknown value returns `400` listing the valid
ones. Visitors cannot use `status` to see anything they could not already see,
because visibility is applied first.

Posts use the same shape on the forum endpoint:

    GET /api/v1/forum/posts/?moderation=needs_review

The frontend queue is **Staff → Forum reports**, which lists held posts under
"Held by screening" and held comments under "Held comments", each with the
moderator's reason, an *Open* link, and *Release* / *Delete*. Release calls the
existing `moderate` action with `{"action": "restore"}` on the post or the
comment.

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

- **Reviews are not screened, on purpose.** Listings, posts and comments are;
  a review relies on reporting and moderator action. Screening a rating is a
  product-policy decision (see above), not a missing adapter.
- **Nothing publishes automatically.** A clean verdict still waits for a
  moderator on a listing, and a flagged post is held rather than deleted.
  Auto-publishing would be a deliberate change to `run_screening` plus its
  tests — not a side effect.
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

# a forum post that should be held
curl -X POST http://localhost:8000/api/v1/forum/posts/ \
  -H "Authorization: Token ***" \
  -H "Content-Type: application/json" \
  -d '{"kind":"post","topic":"General","title":"Selling answer keys",
       "body":"Complete exam answers for the midterm, cheap."}'

# expect "moderation_status": "needs_review", and an empty public feed:
curl http://localhost:8000/api/v1/forum/posts/

# the held queue and the release, as a moderator
curl "http://localhost:8000/api/v1/forum/posts/?moderation=needs_review" \
  -H "Authorization: Token ***"
curl -X POST http://localhost:8000/api/v1/forum/posts/<id>/moderate/ \
  -H "Authorization: Token ***" -H "Content-Type: application/json" \
  -d '{"action":"restore"}'
```

The audit trail is in Django admin under **Screening results**: target
(listing or post), verdict, score, reasons, provider, and when it ran.

Tests: `python manage.py test apps.screening` (provider boundary, all three
targets) and `python manage.py test apps.forum` (the feed, the post hold, the
comment hold, the queue filter, the releases, the re-screen on edit).

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
