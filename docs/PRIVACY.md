# Privacy notice (PR-01)

RTU Tindahan is a campus marketplace for Rizal Technological University, Pasig
Campus. It is a student project run for the university community, and it is built
to follow the **Data Privacy Act of 2012 (RA 10173)**: collect what the service
needs to work, say plainly why, keep it only as long as it is useful, and let a
person see, correct or delete it.

This is the formal statement. The same notice is in the application itself, in
plain language, at `#/privacy` — linked from the sign-up checkbox, the sign-in
page and the Help Center.

---

## 1. What is collected and why

| Data | Why it is needed | Where it lives |
| --- | --- | --- |
| RTU email address | It is the account and the proof the person belongs to the campus; the verification code is sent to it | `accounts.User.email`, `LoginAttempt` (failed attempts only) |
| First and last name | Shown to the other side of a transaction so two people can meet; the display name is what the marketplace shows | `accounts.User` |
| Program and year level | Campus context for a seller's listings and the Official Store's records | `accounts.User` |
| Contact number (optional) | Only so the two parties can arrange the meet-up. It is **withheld until an order is accepted** and hidden again when the order closes (OT-07) | `accounts.User.contact_number`, shown through `orders` only inside that window |
| Listings, photos, forum posts, comments | The content the person chose to publish | `catalog`, `forum` |
| Orders, reviews, messages, notifications | The record of a transaction and the conversation around it | `orders`, `reviews`, `messaging`, `notifications` |
| Password | Never stored in readable form — Django's PBKDF2 hash only | `accounts.User.password` |
| Sign-in activity | When a session was last used, so a session can end after 30 idle minutes (SE-05) | `accounts.TokenActivity` |

Two things are deliberately **not** collected: no student number, no birthdate,
no address, no government ID. The Official Store's ticket mail was built without
the student number and name for that reason.

## 2. What is never done with it

- No advertising, no profiling, no analytics vendor, no sale or sharing with a
  third party. There is no tracker on the site.
- The screening step sends **the text of a listing or post** to a language model
  (Google Gemini) to check it against the posting guideline. Nothing else
  accompanies it: no email, no name, no number, no photo, no order. If the model
  is unavailable, a local rules check answers instead and nothing leaves the
  server.
- The contact number is never sent to the language model and never shown to a
  visitor, a moderator's queue, or anyone but the counterpart of an accepted
  order.

## 3. Who can see what

| Who | Sees |
| --- | --- |
| Anyone (visitor) | Approved listings, the seller's display name, the forum, ratings |
| The other party in an order | The contact number, only while the order is accepted |
| Office Staff | The Official Store's tickets and stock |
| Moderators | Held and reported content, the screening verdict, and the reason a report was filed. **Never who reported whom** (RM-07) |
| Administrators | Accounts, the audit log, the screening rules |

Every staff action that changes something writes an audit row naming the person
who did it, so a decision can be traced.

## 4. How long it is kept

| Data | Kept | Then |
| --- | --- | --- |
| Orders (completed, declined, cancelled) | `DATA_RETENTION_DAYS` — **730** | Purged with their reviews (`manage.py purge_expired_data`) |
| Requests still open | Not purged, ever | A live obligation is not housekeeping |
| Read notifications | `NOTIFICATION_RETENTION_DAYS` — **90** | Purged |
| Sign-in tokens | 14 days, or 30 minutes idle | Deleted |
| Failed-login records | 24 hours after the last failure | Reset |
| Ban and moderation records | Until the case is closed | — |

Both windows are settings, not constants, so the university can shorten them
without a code change.

## 5. Rights, and how to use them

Under RA 10173 a person may be informed, object, access, correct, and erasure.
Here is where each one happens:

- **Be informed** — this notice, the in-app notice, and the screening disclosure
  on every posting screen.
- **Access** — Profile shows the account's own data; orders and listings are
  visible to their owner.
- **Correct** — Profile edits the name, program, year, contact number and photo.
- **Erase** — `POST /auth/delete-account/` with the password. If the account has
  no listings or store tickets it is deleted outright; if it has history that
  other people rely on, the account is deactivated and the personal fields are
  scrubbed (a placeholder name, a deleted-address email, no contact number, no
  photo), so the other party's record stays honest without the person's data.
- **Object or complain** — the project's data protection contact is the
  capstone adviser; a complaint may also go to the National Privacy Commission.

## 6. Where the behaviour is verified

| Claim | Evidence |
| --- | --- |
| The contact number is only visible inside an accepted order | `apps/orders/tests_api.py`, the OT-07 cases |
| Retention runs and spares live orders | `apps/accounts/tests/test_retention.py` |
| A reporter's identity is not shown to the reported party | `apps/forum/tests_api.py`, `apps/messaging/tests_api.py` |
| Deletion scrubs personal data when history must stay | `apps/accounts/tests/test_hardening.py` |
| No secret reaches the browser | `SE-08` note in `docs/AUTH-HARDENING.md`; the only key lives in `backend/.env` |
| Screening sends text and nothing else | `apps/screening/tests.py`, the payload tests |

What this document cannot claim: a **review by the university's Data Protection
Officer**. That is an organisational act, not a code change, and it has not
happened. Until it does, this notice is the project's own statement of what it
does, written to be checked against the code.
