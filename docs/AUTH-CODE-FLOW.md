# Sign-up with a 6-digit code

The React app and Django now share one authentication flow. The prototype's
offline accounts (`rtu_auth_accounts`) and EmailJS are gone: the backend owns
accounts, and it sends the code itself.

---

## 1. The flow

```
React (VerifyForm)                     Django                          Inbox
──────────────────                     ──────                          ─────
step 1: name, program, year,
        RTU email, password,
        privacy consent
      │
      └─ POST /api/v1/auth/register/ ─▶ creates a visitor account
                                        issues a 6-digit code
                                        stores only its hash ──────▶ "Your verification
                                        sends the email               code is: 123456"
      ◀─ 201 {detail, email, code_expires_in_minutes}
      │
step 2: enter the code
      │
      └─ POST /api/v1/auth/verify-code/ ─▶ checks code, attempts, expiry
                                           marks the account verified
                                           promotes visitor → verified user
      ◀─ 200 {token, user, detail}
      │
step 3: "welcome" screen — the user is signed in
```

The token from step 2 is stored in `localStorage` under `rtu_token` and sent as
`Authorization: Token <key>` on every later request.

---

## 2. Endpoints

| Method | Path | Body | Answers |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register/` | `email`, `display_name`, `password`, `password_confirm`, `member_type`, `college`, `year_level`, `privacy_consent` | 201 + `code_expires_in_minutes`; 400 with field errors |
| POST | `/api/v1/auth/verify-code/` | `email`, `code` | 200 + `token` + `user`; 400 `code_invalid`; 403 `account_suspended` |
| POST | `/api/v1/auth/resend-code/` | `email` | 200 always; 429 `code_cooldown` if asked too soon |
| POST | `/api/v1/auth/login/` | `email`, `password` | 200 + `token` + `user`; 403 `email_not_verified` before verification |
| GET | `/api/v1/auth/me/` | — | the signed-in profile |
| POST | `/api/v1/auth/logout/` | — | 204, deletes the token |

Link-based verification (`/auth/verify-email/`, `/auth/resend-verification/`)
still exists for accounts verified by hand or by an administrator. Ordinary
sign-up uses the code.

---

## 3. The rules

| Rule | Value | Where |
| --- | --- | --- |
| Code length | 6 digits, leading zeros kept | `verification.generate_code()` |
| Lifetime | 5 minutes | `CODE_TTL_MINUTES` |
| Wrong tries | 5, then the code is burned | `MAX_ATTEMPTS` |
| Resend cooldown | 30 seconds | `RESEND_SECONDS` |
| Storage | PBKDF2 hash only, one row per account | `VerificationCode` |
| Replay | a used code cannot sign anyone in | `VerifyCodeView` |

`VerificationCode` has a `OneToOneField` to the user, so asking for a new code
replaces the old one — an interrupted sign-up can never leave two valid codes.

Beyond the rules above, the endpoint reuses what Sprint 1 already had: the RTU
email format check, the unique-email check, Django's password validators,
`ScopedRateThrottle` (`register` 10/hour, `verify` 20/hour), and the active /
suspended / banned account statuses.

---

## 4. Frontend mapping

| `AuthContext` | Call |
| --- | --- |
| `register({first, last, email, pass, prog, year, consent})` | `POST /auth/register/` |
| `resendCode(email)` | `POST /auth/resend-code/` |
| `confirmCode(email, code)` | `POST /auth/verify-code/` → stores the token |
| `login(email, password)` | `POST /auth/login/` → stores the token |
| `logout()` | `POST /auth/logout/` → clears the token |
| first page load | `GET /auth/me/` when a token is stored |

The pending sign-up code survives a page reload: `AuthContext` remembers the
address and the code screen resumes instead of asking for the details again.

---

## 5. Seeing the email locally

By default `DEBUG=True` uses the **console** backend: the email is printed in
the `runserver` window rather than delivered. That is enough to test the flow —
copy the 6 digits from the terminal.

To receive real email, add to `backend/.env`:

```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your.address@gmail.com
EMAIL_HOST_PASSWORD=<16-character app password>
DEFAULT_FROM_EMAIL=RTU Tindahan <your.address@gmail.com>
```

Set `DEFAULT_FROM_EMAIL` to the **same address** you authenticate with. Sending
"as" an `@rtu.edu.ph` address through a personal mailbox fails SPF/DKIM checks
and is rejected or spam-filed. For a demo, Mailtrap avoids the problem
entirely.

Remember: with `DEBUG=False` the project switches to SMTP automatically, so a
deployment without these values breaks registration.

---

## 6. Files

| File | Change |
| --- | --- |
| `backend/apps/accounts/models.py` | `VerificationCode` model |
| `backend/apps/accounts/migrations/0002_verificationcode.py` | new table |
| `backend/apps/accounts/verification.py` | issue / check / cooldown logic |
| `backend/apps/accounts/emails.py` | `send_verification_code_email()` |
| `backend/apps/accounts/serializers.py` | `VerifyCodeSerializer`, `ResendCodeSerializer`; registration no longer sends the link email |
| `backend/apps/accounts/views.py` | register issues a code; `VerifyCodeView`, `ResendCodeView` |
| `backend/apps/accounts/urls.py` | two new routes |
| `backend/apps/accounts/tests/test_codes.py` | 17 tests for the code flow |
| `frontend/src/features/authentication/AuthContext.tsx` | rewritten against the API |
| `frontend/src/features/authentication/components/VerifyForm.tsx` | year level + privacy consent; calls the API |
| `frontend/src/common/config.ts` | EmailJS removed |

Run `python manage.py migrate` after pulling this, or the new table is missing.
