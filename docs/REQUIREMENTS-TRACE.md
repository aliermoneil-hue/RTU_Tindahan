# Requirements trace: SRS requirement to code to proof

What the panel asks for is not "did you build it" but "show me". This file maps
each requirement ID that this repository actually cites to the file that
enforces it, the surface a person can touch, and the test that would fail if it
stopped being true.

Read it with one warning: the SRS itself is not in this repository (see
`docs/README.md` — it lives in the CapStone folder). The wording column is how
this codebase states each requirement, not a quotation from the SRS. IDs the
code never cites are not listed here; if the SRS has requirements with no row,
that is the place to look before the defence.

Proof column legend: `test` is an automated test, `live` is a step in
`docs/DEMO-RUNBOOK.md`.

---

## Accounts and access

| ID | Requirement as cited here | Enforced in | Surface | Proof |
| --- | --- | --- | --- | --- |
| AV-01 | Only official RTU email addresses may register | `apps/accounts/validators.py` | `POST /auth/register/` | `apps/accounts/tests/test_api.py` |
| AV-02 | Address must match the RTU student pattern | `apps/accounts/validators.py` | same | same |
| AV-03 | The account stays a visitor until the emailed 6-digit code is used | `apps/accounts/views.py`, `verification.py` | `POST /auth/verify-code/`, sign-up screen | `tests/test_codes.py`, live |
| AV-04 | Registration collects the fields the profile needs | `apps/accounts/serializers.py` | sign-up form | `tests/test_api.py` |
| AV-05 | A signed-in member can read their own account | `apps/accounts/views.py` | `GET /auth/me/` | `tests/test_api.py` |
| AV-06 | Sign-in, sign-out, and a forgotten password | `apps/accounts/views.py`, `authentication.py` | `POST /auth/login/`, `/auth/password-reset/` | `tests/test_hardening.py`, live |
| AV-07 | A member may edit their profile | `apps/accounts/serializers.py` | `PATCH /auth/me/` | `tests/test_api.py` |
| AV-08 | Email and role are not editable from the profile | `apps/accounts/serializers.py` | same | `tests/test_api.py` |
| SE-05 | Repeated failed sign-ins are slowed down | `apps/accounts/lockout.py` | 400 with `attempts_left`, 429 with `retry_after` | `tests/test_login_lockout.py`, live |
| SE-06 | Uploaded photos are validated (type, size, side ≥ 100 px) | `apps/catalog/models.py`, `serializers.py` | create-listing form | `apps/catalog/tests*.py` |

## Listings and catalogue

| ID | Requirement as cited here | Enforced in | Surface | Proof |
| --- | --- | --- | --- | --- |
| BR-01 | Only verified members may post; anonymous callers get 401 | `apps/accounts/permissions.py` | `POST /listings/` | `apps/catalog/tests*.py` |
| BR-04 | Only Office Staff decide what is an official item | `apps/catalog/serializers.py` | `is_official` is read-only | `apps/catalog/tests*.py` |
| LS-01 | Categories, listings, and photos exist as one catalogue | `apps/catalog/models.py` | Browse, product page | `apps/catalog/tests*.py` |
| LS-02 | The SRS categories and their sub-types are seeded | `management/commands/seed_categories.py` | Browse category filter | command output |
| LS-05 | Nothing publishes itself: only `POST .../approve/` makes a listing live | `apps/catalog/views.py`, `screening/services.py` | moderation queue | `apps/catalog/tests*.py`, `apps/screening/tests.py` |
| LS-06 | A listing carries its condition, price, quantity and meetup place | `apps/catalog/models.py` | product page, cart | `apps/catalog/tests*.py` |

## Screening (AI-01 to AI-16)

| ID | Requirement as cited here | Enforced in | Surface | Proof |
| --- | --- | --- | --- | --- |
| AI-01 | Every listing passes a screening step before a moderator may publish | `apps/screening/models.py`, `services.py` | create listing | `apps/screening/tests.py` |
| AI-02 | `POST` always creates `pending_screening`, even if the body asks otherwise | `apps/catalog/serializers.py` | `POST /listings/` | `apps/catalog/tests*.py` |
| AI-03 | A flagged item goes to a human, not to the public | `apps/screening/services.py`, `apps/forum/views.py` | listings, posts, comments | `apps/screening/tests.py`, `apps/forum/tests_api.py`, live |
| AI-04 | The rules provider is deterministic and needs no network | `apps/screening/providers.py` | `LLM_PROVIDER=stub` | `apps/screening/tests.py` |
| AI-16 | Every decision is kept with its verdict, score and reasons | `apps/screening/models.py`, admin | Django admin → Screening results | `apps/screening/tests.py` |

## Roles, moderation, audit

| ID | Requirement as cited here | Enforced in | Surface | Proof |
| --- | --- | --- | --- | --- |
| RM-03 | Moderators review flagged content, reports and appeals | `apps/accounts/permissions.py` | Moderation, Forum reports | `apps/forum/tests_api.py`, `apps/catalog/tests*.py` |
| RM-05 | Staff actions leave a trail | `apps/audit/models.py`, `services.py` | Staff → Users & audit | `apps/forum/tests_api.py`, `apps/catalog/tests*.py` |
| AD-01 | Suspended and banned accounts keep their rows | `apps/accounts/models.py` | Staff → Users | `apps/accounts/tests/test_api.py` |
| AD-05 | Administrators manage accounts, roles, categories and audit | `apps/accounts/admin_api.py`, `permissions.py` | Staff → Users & audit | `apps/accounts/tests/test_admin_api*.py` |
| ST-01 | Only Office Staff manage official items and announcements | `apps/accounts/permissions.py` | Staff tools, store inventory | `apps/store/tests*.py` |
| ST-02 | The Official Store reuses the catalogue model | `apps/catalog/models.py` | Official Store page | `apps/store/tests*.py` |

## Platform

| ID | Requirement as cited here | Enforced in | Surface | Proof |
| --- | --- | --- | --- | --- |
| RL-01 | The service reports availability | `config/urls.py` | `GET /health/` | live |
| PR-02 | Sign-up records privacy consent | `apps/accounts/serializers.py` | sign-up form | `apps/accounts/tests/test_api.py` |

---

## What is deliberately not claimed

- **Reviews are not screened** (documented in `docs/SCREENING.md` §6). Holding a
  buyer's opinion of a completed order for a word like "fake" would suppress
  legitimate complaints; that needs a narrower rule set and a panel decision.
- **Per-device sessions and a JWT access/refresh pair are not implemented**
  (`docs/AUTH-HARDENING.md` §6). The current opaque token expires, rotates and
  can be ended everywhere; it cannot refresh silently.
- **Auto-publishing after a clean verdict is absent on purpose.** A clean score
  still waits for a human, which is what keeps LS-05 true.
