# Auth hardening: password reset, token lifetime, ending sessions

Three gaps closed in Sprint 2 (AV-06), with the migration path for each. The
sign-up flow keeps its own document: `AUTH-CODE-FLOW.md`.

---

## 1. New endpoints

| Method | Path | Who | What |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/password-reset/` | anyone | Email a 6-digit reset code |
| POST | `/api/v1/auth/password-reset/confirm/` | anyone | Spend the code, set the new password |
| POST | `/api/v1/auth/token/refresh/` | signed in | Rotate the caller's token |
| POST | `/api/v1/auth/logout-all/` | signed in | End every session for the account |
| POST | `/api/v1/auth/login-status/` | anyone | Is this address locked right now, and for how long |
| POST | `/api/v1/auth/change-password/` | signed in | Change the password from Profile → Security |
| POST | `/api/v1/auth/delete-account/` | signed in | Delete the account, or scrub it when orders/listings must survive |

All of them are in `apps/accounts/urls.py`; the logic lives in `views.py` with
the code plumbing in `verification.py` and the lockout policy in `lockout.py`.

---

## 2. Password reset (AV-06)

    POST auth/password-reset/            {"email": "2024-123456@rtu.edu.ph"}
    → 200 {"detail": "If that RTU address has an account, we emailed a 6-digit code to it.",
           "code_expires_in_minutes": 15}

    POST auth/password-reset/confirm/    {"email": "...", "code": "123456",
                                          "password": "...", "password_confirm": "..."}
    → 200 {"detail": "Password changed. Sign in with the new password."}

Rules, all of them enforced in code and covered by tests:

- **15 minutes**, longer than the 5-minute sign-up code, because this email is
  read later and often on a different device. Five wrong tries burn the code.
- **One live code per account**, hash-only in the database, in its own table
  (`PasswordResetCode`) so a sign-up code and a reset code cannot overwrite each
  other.
- **60-second cooldown** between requests, plus a 5-per-hour throttle per IP.
- **The same answer for every address.** Requesting a reset for an unknown
  address returns byte-identical text and no email. Confirming with a wrong
  code, an expired code, too many tries, or an address that does not exist all
  return *"That code is not right or has expired. Ask for a new code."* The real
  reason is logged server-side. Anything more specific turns this endpoint into
  a way to discover which students have accounts. (That was a defect in the
  first draft: the "N tries left" message leaked account existence, and a test
  caught it.)
- **Changing the password ends every session.** All tokens for the account are
  deleted, so whoever held the old password — or a token lifted from a shared
  laptop — is locked out.
- **The email tells the reader what to do if they did not ask.** A reset mail
  that arrives unrequested is the first sign of someone probing the account.
- **A second mail says the change happened.** Sent only after the password is
  actually replaced — never for a wrong, expired or burnt code — with the local
  time, the fact that every session was signed out, and what to do if the
  reader did not do it. It carries no code, so nothing in it can be spent. A
  failure to send it is logged and swallowed: the password is already changed
  and the code is already spent, so a 500 would only leave the student
  retrying a dead code.

The new password goes through Django's own validators, the same ones sign-up
uses, so a reset cannot install something sign-up would have refused.

### Frontend note

The reset screens are built: `frontend/src/features/authentication/pages/
ForgotPasswordPage.tsx` (route `#/forgot-password`) has the two states (ask for
the code, then enter code + new password) and calls `auth/password-reset/`
followed by `auth/password-reset/confirm/`.

---

## 3. Token lifetime

`AUTH_TOKEN_TTL_DAYS` (default **14**, `0` disables) is enforced by
`apps/accounts/authentication.py`, which subclasses DRF's token authentication
and checks the token's age.

**The token format is unchanged.** The React app still sends
`Authorization: Token <key>`; nothing on the client needed editing. That is the
migration path: existing tokens keep working until they age past the limit, so
a deploy does not sign everybody out at once.

    > 14 days old
    GET /api/v1/auth/me/
    ← 401 {"detail": "Your sign-in has expired. Sign in again to continue."}

Two things worth knowing:

- **Signing in after expiry mints a fresh token.** `authtoken` keeps exactly one
  row per account, so `get_or_create` would hand back the dead key and the
  account would look permanently broken. `auth_payload()` compares the stored
  token's age and rotates it when needed. A test covers it.
- **`auth/token/refresh/` rotates rather than extends.** The old key stops
  working immediately and the client must store the new one. This is a
  stop-gap: a real refresh-token pair (short access token, long refresh token)
  needs `djangorestframework-simplejwt` and a client change, and is the next
  step if the panel asks for one.

### Cleaning up dead tokens

An aged token is refused but not removed, so the table would grow one dead row
per rotation. `manage.py prune_tokens` deletes the rows past the limit; because
they can never authenticate again, this changes no behaviour.

    cd backend
    .venv/bin/python manage.py prune_tokens --dry-run   # report only
    .venv/bin/python manage.py prune_tokens             # delete

`--days N` overrides the setting for one run. With `AUTH_TOKEN_TTL_DAYS=0`
tokens never expire, so the command says so and deletes nothing.

It runs daily from cron on this host. The line is installed (03:10, kallisto-1);
if you rebuild a machine, add it again rather than assuming it is there:

    10 3 * * * cd /home/kallisto/RTU_Tindahan/backend && .venv/bin/python manage.py prune_tokens >/dev/null 2>&1

Four tests cover the age cutoff, `--dry-run`, the `--days` override, and the
unlimited-lifetime case (`apps/accounts/tests/test_token_cleanup.py`).

Set `AUTH_TOKEN_TTL_DAYS=0` on a teammate's machine if their long-lived
development token keeps expiring mid-session.

---

## 4. "Log out everywhere"

    POST /api/v1/auth/logout-all/
    → {"detail": "Signed out of every device.", "sessions_ended": 1}

Honest note: **today this is the same as `auth/logout/`.** DRF's `authtoken`
issues one token per account, so every logout is already global — the backlog
item that said "no such endpoint" was right about the endpoint and wrong about
the consequence. The separate route exists so that the meaning survives the
move to per-device tokens, which is the change that will actually need it.

---

## 5. Login lockout (SE-05)

Guessing a password is now rate-limited per address, in the database, so a
restart does not forgive an attacker. `apps/accounts/lockout.py` is the whole
policy; `LoginView` only asks it questions.

| Setting | Default | Meaning |
| --- | --- | --- |
| `LOGIN_COOLDOWN_AFTER` | 5 | failures before the first cooldown |
| `LOGIN_COOLDOWN_SECONDS` | 60 | how long that cooldown lasts |
| `LOGIN_RESTRICT_AFTER` | 7 | failures before a restriction |
| `LOGIN_RESTRICT_SECONDS` | 900 | how long a restriction lasts |
| `LOGIN_ATTEMPT_WINDOW_HOURS` | 24 | an older count is stale and starts again |

    wrong password, 1st time
    → 400 {"detail": "Email or password is incorrect.",
           "attempts_left": 4, "next_penalty": "cooldown"}

    the 5th
    → 429 {"detail": "Too many failed attempts. ...", "code": "login_cooldown",
           "retry_after": 60}   + Retry-After: 60

    the 7th
    → 429 {"code": "login_restricted", "retry_after": 900}

    POST auth/login-status/  {"email": "..."}
    → {"locked": true, "code": "login_cooldown", "retry_after": 59}

Rules that matter:

- **Keyed by email, not by user row.** An address that does not exist behaves
  exactly like one that does, so this endpoint cannot be used to discover which
  RTU addresses have accounts.
- **A correct password does not bypass an active lock.** The lock is checked
  before the password, so a locked address cannot be used to confirm a guess.
- **It is cleared on success, on a password reset, and by hand.** A reset is
  the way out when a student is locked out: the confirm view calls
  `lockout.reset(email)`, so the new password signs in immediately instead of
  waiting out a cooldown earned on the old one. Staff can also select rows in
  Django admin and run **Clear selected lockouts**.
- **The per-IP throttle is separate.** `THROTTLE_LOGIN` (30/min) still exists
  and answers `429` with DRF's own wording; the lockout above is per address
  and survives a new IP.

---

## 6. Not done, and why

- **Per-device sessions.** Needs a token table with a label per device (knox or
  a custom model). Worth doing when "sign out my other phone" becomes a real
  requirement.
- **JWT access + refresh pair.** Cleaner lifetime semantics than rotating an
  opaque token, at the cost of a dependency and a client change. The current
  scheme expires and rotates correctly; it just cannot refresh silently.

---

## 7. Checking it by hand

```bash
BASE=http://localhost:8000/api/v1

# ask for a code
curl -s -X POST $BASE/auth/password-reset/ \
  -H "Content-Type: application/json" \
  -d '{"email":"2024-123456@rtu.edu.ph"}'

# read the code from the inbox (or the runserver window in console mode), then
curl -s -X POST $BASE/auth/password-reset/confirm/ \
  -H "Content-Type: application/json" \
  -d '{"email":"2024-123456@rtu.edu.ph","code":"123456","password":"NewPass456!","password_confirm":"NewPass456!"}'

# sign in, then rotate and end sessions
TOKEN=$(curl -s -X POST $BASE/auth/login/ -H "Content-Type: application/json" \
  -d '{"email":"2024-123456@rtu.edu.ph","password":"NewPass456!"}' | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -s -X POST $BASE/auth/token/refresh/ -H "Authorization: Token $TOKEN"
curl -s -X POST $BASE/auth/logout-all/  -H "Authorization: Token $TOKEN"
```

`python manage.py test apps.accounts` runs the 22 tests behind this document.

---

## 8. Files

| File | Change |
| --- | --- |
| `backend/apps/accounts/models.py` | `PasswordResetCode` |
| `backend/apps/accounts/migrations/0003_passwordresetcode.py` | new table |
| `backend/apps/accounts/verification.py` | generic issue / check, reset wrappers |
| `backend/apps/accounts/emails.py` | `send_password_reset_code_email()`, `send_password_changed_email()` |
| `backend/apps/accounts/serializers.py` | request + confirm serializers |
| `backend/apps/accounts/authentication.py` | `ExpiringTokenAuthentication` |
| `backend/apps/accounts/views.py` | four views, fresh-token-on-login, the changed-mail on reset |
| `backend/apps/accounts/urls.py` | four routes |
| `backend/apps/accounts/tests/test_hardening.py` | 22 tests |
| `backend/apps/accounts/lockout.py` | cooldown / restriction policy and its lock rows |
| `backend/apps/accounts/migrations/0006_loginattempt.py` | `LoginAttempt` table |
| `backend/apps/accounts/tests/test_login_lockout.py` | lockout tests |
| `backend/config/settings.py` | auth class, `AUTH_TOKEN_TTL_DAYS`, throttle scopes, `LOGIN_*` |

Run `python manage.py migrate` after pulling this, or the reset and lockout
tables are missing.

`manage.py test apps.accounts` covers this whole document; the lockout suite is
`apps/accounts/tests/test_login_lockout.py`.
