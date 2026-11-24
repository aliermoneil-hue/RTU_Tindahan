# Appeals (AI-06, RM-08)

Two requirements ask for the same thing from different angles:

- **AI-06** — a person may appeal a rejected item after a moderator confirmed the
  rejection, and the moderator who confirmed it may not review the appeal;
- **RM-08** — a person may appeal a removal, a warning or a suspension, reviewed
  by an administrator who did not make the original decision.

So there is one model and one workflow. `apps/appeals` holds the model, the
rules, and the endpoints.

## What can be appealed

| Kind | Target | Allowed when |
| --- | --- | --- |
| `listing` | a listing the appellant sells | it is `rejected`, or its availability is `removed` |
| `post` | a forum post the appellant wrote | a moderator hid it |
| `comment` | a forum comment the appellant wrote | a moderator hid it |
| `account` | the appellant's own account | its status is `suspended` |

Nothing else. An approved listing has no decision to argue with, and an active
account has no suspension.

## The rules, and where they live

All of them are in `services.open_appeal` and `services.decide_appeal`, so the
API cannot be talked around:

- **ownership** — only the seller of the listing, or the author of the post or
  comment, may appeal it;
- **state** — only a decision that actually went against them;
- **one at a time** — a second appeal about the same target while one is pending
  or granted is refused;
- **a real reason** — at least a sentence, not "unfair";
- **separation** — the appellant cannot decide their own appeal, and neither can
  the person who made the original decision. That person is captured on the
  appeal when it is filed: `hidden_by` for a post or comment, and for a listing
  the most recent moderator entry in the audit trail against that slug. If no
  decider is recorded, the rule has nothing to exclude and the appeal is opened
  to any other moderator;
- **a reason for the decision** — both granting and denying require a note, and
  the note reaches the appellant in a notification.

## Granting

| Kind | Effect |
| --- | --- |
| `listing` | `moderation_status` → `approved`; availability back to `available` if it was `removed` |
| `post` / `comment` | the hide is cleared (`hidden_by`, `hidden_at` = null) |
| `account` | status → `active`, account reactivated |

Every decision writes an audit entry (`appeal.granted` / `appeal.denied`) with
the target and the note — RM-05 asks for a record of every moderation action, and
this is one.

## The suspended account problem

A suspended account cannot sign in, so the usual authenticated endpoint would
make a suspension unappealable — which is the gap RM-08 exists to close.
`POST /api/v1/appeals/suspension/` takes the email, the password the person
already has, and the reason, checks the password the way sign-in does, and files
the appeal **without issuing a token**. A wrong password and an unknown address
answer with the identical message, and the endpoint is throttled at 5/hour per
client (`THROTTLE_SUSPENSION_APPEAL`). A banned account is refused with a plain
sentence pointing at the Office of Student Affairs: a ban is an institutional
decision, not a moderation one.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/api/v1/appeals/?status=pending` | a member sees their own; staff see the queue |
| `POST` | `/api/v1/appeals/` | the owner of the target |
| `POST` | `/api/v1/appeals/<id>/decide/` | a moderator or administrator who did not decide originally |
| `POST` | `/api/v1/appeals/suspension/` | anyone with valid credentials for a suspended account |

## On screen

- the seller's **My shop** shows an **Appeal** button beside a rejected listing;
- a removed forum post shows **Appeal this removal** to its author;
- **Appeals** in the staff sidebar is the queue, with the appellant's words, who
  decided originally, a note field, and Grant / Deny;
- the sign-in screen offers **Appeal the suspension** for someone who cannot get
  in.

## Tests

`apps/appeals/tests_api.py`, 17 cases: owner files; a stranger cannot; an
approved listing cannot be appealed; a two-word reason is refused; a duplicate is
refused; another moderator grants and the listing returns with an audit entry and
a notification; the original decider is refused; nobody decides their own appeal;
a decision without a reason is refused; a denial leaves the item alone and tells
the appellant why; a decided appeal cannot be decided twice; a member cannot
decide anything; visibility splits by role; a suspension is appealed from the
public endpoint and lifted when granted; an active account has nothing to appeal;
a wrong password and an unknown address answer identically; a ban is refused.
