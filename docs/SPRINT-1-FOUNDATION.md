# Sprint 1 — Foundation (backend)

Branch: `feature/neil-sprint1-foundation`

This note records what the foundation branch adds, the decisions behind it,
and what the next branch can build on.

---

## 1. What is in this branch

| Area | Result |
| --- | --- |
| Settings | `.env`-driven secret key, debug flag, hosts, database, CORS, CSRF, email, media |
| Database | PostgreSQL when `POSTGRES_DB` is set; SQLite fallback for a fresh clone |
| Apps | `apps.accounts` installed; `rest_framework`, `rest_framework.authtoken`, `corsheaders` |
| User model | Custom `accounts.User` with five roles (set before the first migration) |
| Roles | Visitor, Verified User, Office Staff, Moderator, Administrator |
| RTU identity | Email domain and student-number pattern configurable in `.env` |
| Account status | Active, Suspended, Banned (AD-01) |
| Verification | Register → email link → account verified → login allowed |
| Auth API | Token login/logout, current profile, profile update |
| Permissions | `IsVerifiedUser`, `IsOfficeStaff`, `IsModerator`, `IsAdministrator` |
| Hardening | 30-minute session timeout, login/registration throttles, password hashing, image size cap |
| Tests | 31 tests covering the model, validators, registration, verification, login, profile |

The `AUTH_USER_MODEL` decision is now locked in. Do not change it after a real
database exists; it would require rebuilding every foreign key.

---

## 2. Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # Windows
python manage.py migrate
python manage.py seed_demo_users
python manage.py runserver
```

Demo accounts created by the seeder (development only):

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@rtu.edu.ph` | `Tindahan2026!` |
| Office Staff | `staff@rtu.edu.ph` | `Tindahan2026!` |
| Moderator | `moderator@rtu.edu.ph` | `Tindahan2026!` |
| Verified User | `2024-000001@rtu.edu.ph` | `Tindahan2026!` |

Django Admin: <http://localhost:8000/admin/>

To create a real superuser instead: `python manage.py createsuperuser`.

---

## 3. API

Base path: `/api/v1`

| Method | Endpoint | Access | Requirement |
| --- | --- | --- | --- |
| GET | `/` | Public | Service index |
| GET | `/health/` | Public | RL-01 availability check |
| POST | `/auth/register/` | Public | AV-01 to AV-04, PR-02 |
| POST | `/auth/verify-email/` | Public | AV-03 |
| POST | `/auth/resend-verification/` | Public | AV-03 |
| POST | `/auth/login/` | Public | AV-06, SE-05 |
| POST | `/auth/logout/` | Token | AV-06 |
| GET | `/auth/me/` | Token | AV-05 |
| PATCH | `/auth/me/` | Token | AV-07, AV-08 |

Authentication is DRF token authentication:

```
Authorization: Token <token>
```

In development, verification emails print in the `runserver` terminal. The
link points to `FRONTEND_URL/verify-email?uid=...&token=...`.

### Register example

```json
POST /api/v1/auth/register/
{
  "email": "2024-123456@rtu.edu.ph",
  "display_name": "Juan Dela Cruz",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!",
  "member_type": "student",
  "college": "College of Information and Communications Technology",
  "year_level": 2,
  "contact_number": "09171234567",
  "privacy_consent": true
}
```

### Verify example

```json
POST /api/v1/auth/verify-email/
{ "uid": "...", "token": "..." }
```

The response contains a token and the user record, so the frontend can sign the
user in immediately after verification.

---

## 4. Decisions and assumptions

1. **Visitor is a role for unverified accounts.** Anonymous browsing is handled
   by Django's anonymous user. A registered account stays a `visitor` until the
   email link is used, then becomes a `user`.
2. **The RTU email format is configurable.** Appendix B of the SRS still marks
   it as "to confirm". `RTU_EMAIL_DOMAIN` and `RTU_STUDENT_EMAIL_REGEX` live in
   `.env`; students must match the student-number form.
3. **SQLite fallback.** PostgreSQL is the approved stack, but the fallback lets
   a new member run `manage.py test` before installing PostgreSQL. Set
   `POSTGRES_DB` to switch.
4. **DRF token auth.** No extra package was needed (`rest_framework.authtoken`).
   Tokens do not expire yet; moving to expiring tokens (SimpleJWT or a custom
   expiry) is a Sprint 2 item.
5. **Suspended and banned accounts keep their rows.** Status blocks login; the
   account is not deleted (AD-01, audit trail).
6. **Role checks run on the server.** The React app may hide a control, but
   every protected endpoint repeats the check.

---

## 5. Next steps (Sprint 2 candidates)

- Password reset endpoints and email templates (AV-06).
- Expiring tokens or refresh tokens; logout everywhere.
- `listings` app: categories, listings, photos, listing status (LS-01 to LS-06).
- `orders`, `messaging`, `reviews`, `forum`, `reports` apps from the SRS.
- AI screening service boundary (`screening` app) with a moderator queue
  (AI-01 to AI-16). Keep the provider key server-side only.
- React: auth context, login, register, verify-email, profile screens.
- Audit log model (RM-05, AD-05).
- Replace `seed_demo_users` with fixtures for automated demos.
