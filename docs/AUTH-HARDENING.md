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

All four are in `apps/accounts/urls.py`; the logic lives in `views.py` with the
code plumbing in `verification.py`.

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

The new password goes through Django's own validators, the same ones sign-up
uses, so a reset cannot install something sign-up would have refused.

### Screens

Built: `frontend/src/features/authentication/pages/ResetPasswordPage.tsx`, routed at
`#/reset-password` and reachable from the sign-in page's "Forgot password?" link.
Two states (ask, then code + new password) plus a done state; "Send a new code"
re-asks after the 60-second cooldown; "Use a different address" returns to step 1.

The page deliberately repeats the backend's hedge — *"If that address has an
account, a 6-digit code is on its way"* — because the API cannot tell it
anything more specific without becoming an account-lookup service.

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

## 5. Not done, and why

- **Per-device sessions.** Needs a token table with a label per device (knox or
  a custom model). Worth doing when "sign out my other phone" becomes a real
  requirement.
- **JWT access + refresh pair.** Cleaner lifetime semantics than rotating an
  opaque token, at the cost of a dependency and a client change. The current
  scheme expires and rotates correctly; it just cannot refresh silently.
- **A "your password changed" confirmation email.** Standard practice, cheap to
  add, not yet written.
- **Deleting expired tokens.** They are refused but kept. A management command
  (`manage.py clearsessions`-style) should sweep them once the table grows.

---

## 6. Checking it by hand

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

`python manage.py test apps.accounts` runs the 18 tests behind this document.

---

## 7. Files

| File | Change |
| --- | --- |
| `backend/apps/accounts/models.py` | `PasswordResetCode` |
| `backend/apps/accounts/migrations/0003_passwordresetcode.py` | new table |
| `backend/apps/accounts/verification.py` | generic issue / check, reset wrappers |
| `backend/apps/accounts/emails.py` | `send_password_reset_code_email()` |
| `backend/apps/accounts/serializers.py` | request + confirm serializers |
| `backend/apps/accounts/authentication.py` | `ExpiringTokenAuthentication` |
| `backend/apps/accounts/views.py` | four views, fresh-token-on-login |
| `backend/apps/accounts/urls.py` | four routes |
| `backend/apps/accounts/tests/test_hardening.py` | 18 tests |
| `backend/config/settings.py` | auth class, `AUTH_TOKEN_TTL_DAYS`, throttle scope |
| `frontend/src/features/authentication/api/passwordReset.ts` | the two calls |
| `frontend/src/features/authentication/pages/ResetPasswordPage.tsx` | the screen |
| `frontend/src/features/core/AppRoutes.tsx` | `#/reset-password` route |
| `frontend/src/features/authentication/pages/LoginPage.tsx` | "Forgot password?" now navigates |

Run `python manage.py migrate` after pulling this, or the reset table is
missing.
