# Setting up the integrated build

This branch connects the React app to the Django backend. Before it, the two
halves ran independently: the frontend kept everything in `localStorage` and
the backend had models but almost no HTTP surface.

After pulling this, a fresh checkout needs **one extra step** — `migrate` — and
optionally some email settings. Follow this top to bottom.

> Related docs: [`AUTH-CODE-FLOW.md`](AUTH-CODE-FLOW.md) explains the 6-digit
> code flow, [`API-CATALOG-AND-STORE.md`](API-CATALOG-AND-STORE.md) is the
> endpoint reference.

---

## 1. Pull and install

If you already have the repository and a working `.venv`:

```powershell
git switch main
git pull
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

New to the project entirely? Do sections 1–4 of [`TEAM-SETUP.md`](TEAM-SETUP.md)
first, then come back here.

---

## 2. Create the new table (required)

This branch adds the `VerificationCode` model. Without this step every
registration fails with `no such table: accounts_verificationcode`.

```powershell
python manage.py migrate
```

You should see `Applying accounts.0002_verificationcode... OK`.

---

## 3. Set up `backend/.env`

If you do not have one yet:

```powershell
copy .env.example .env
```

**Nothing here is required just to run the app.** With `EMAIL_BACKEND` unset,
Django prints the verification email to the `runserver` window instead of
sending it, which is enough to test the full sign-up flow.

### Optional: receive the code in a real inbox

Pick one, paste it into `backend/.env`, then restart the server.

**Mailtrap sandbox** — accepts any recipient address, keeps messages in a web
inbox. Best for a demo or a screenshot.

```ini
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USE_TLS=True
EMAIL_HOST_USER=<16-character username>
EMAIL_HOST_PASSWORD=<16-character password>
DEFAULT_FROM_EMAIL=RTU Tindahan <no-reply@rtu.edu.ph>
```

Both values come from Mailtrap: **Email Testing → Inboxes → My Inbox → SMTP
Settings → Show credentials**. They are not the same as an API token.

**Gmail** — delivers to real mailboxes.

```ini
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your.address@gmail.com
EMAIL_HOST_PASSWORD=<16-character app password>
DEFAULT_FROM_EMAIL=RTU Tindahan <your.address@gmail.com>
```

Gmail needs 2-Step Verification turned on before App Passwords exist, and
`DEFAULT_FROM_EMAIL` must be the same Gmail address — otherwise SPF/DKIM fails
and the message is rejected.

**Mailtrap "Email Sending"** (live SMTP) also works, but only for a domain you
have verified in Mailtrap. Sending from the shared demo domain is refused with
`550 5.7.1 Sending from domain demomailtrap.com is not allowed`.

> Never commit `backend/.env`. It is gitignored; keep it that way.

---

## 4. Run both tiers

Two terminals, both from the repository root.

```powershell
# terminal 1
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

```powershell
# terminal 2
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

The frontend talks to `http://localhost:8000/api/v1` by default (see
`src/common/api/client.ts`). To point it elsewhere, copy `frontend/.env.example`
to `frontend/.env.local` and set `VITE_API_BASE_URL`.

---

## 5. Check that it works

1. **Catalogue from the database** — sign in and open **Browse All**. You
   should see the seeded *Official PE Shirt* and *Official RTU Uniform* with
   Small / Medium / Large and real stock counts. These come from
   `GET /api/v1/listings/`, not from `localStorage`.
2. **Sign up** — create an account with any `0000-000000@rtu.edu.ph` address.
   A 6-digit code is issued:
   - console backend → read it in the `runserver` window
   - Mailtrap/Gmail → read it in the inbox
3. **Verify** — enter the code. You land signed in, and Django Admin
   (`http://127.0.0.1:8000/admin/`, user `admin@rtu.edu.ph` / `Tindahan2026!`)
   now lists your account as a *Verified User*.
4. **Existing demo logins still work**: `2024-000001@rtu.edu.ph` /
   `Tindahan2026!`.

---

## 6. Tests and CI

```powershell
cd backend
python manage.py test        # 99 tests
```

The GitHub Actions workflow runs this suite plus a frontend build on every pull
request, so a red PR is a real failure, not a slow machine.

---

## 7. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `no such table: accounts_verificationcode` | You skipped `python manage.py migrate`. |
| Registration returns 500 and the log says `SMTPSenderRefused` | `DEFAULT_FROM_EMAIL` is not an address your mail provider allows. With Mailtrap live SMTP, verify a domain first, or switch to the sandbox block. |
| `535 Authentication failed` | Wrong password, or you pasted an API token where the SMTP password belongs. |
| Code email never arrives, nothing in the terminal either | The server was not restarted after editing `.env` — settings are read once at startup. |
| `429` on "Send a new code" | 30-second cooldown, on purpose. Wait, then retry. |
| `400 That code is expired` | Codes live 5 minutes. Ask for a new one. |
| Browser console shows a CORS error | The backend must run on port 8000 and the frontend on 5173; both are in `DJANGO_CORS_ALLOWED_ORIGINS`. |
| Browse page is empty | No approved listings. Approve one in Django Admin (Catalog → Listings), or check `/api/v1/listings/` directly. |
| A new listing does not appear in Browse | New listings are created `pending_screening`. Approve it in Django Admin. |

---

## 8. What is connected, and what is not

**Connected (reads the database):**

- sign up with a 6-digit emailed code, sign in, sign out, session restore
- profile fields via `/auth/me/`
- browse, product page, official store listing, category display

**Still local (`localStorage`):**

- posting an item ("Sell an item" saves locally instead of `POST /listings/`)
- cart, orders, chat, forum, reviews, moderation screens
- photos on cards (seeded listings have none, so cards use the category icon)

Those are the next slices. The API for posting a listing, approving it, and
placing an official-store ticket already exists and is tested — only the screen
wiring is missing.
