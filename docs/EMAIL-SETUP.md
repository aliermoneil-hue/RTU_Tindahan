# Email setup: Mailtrap for local testing, Gmail for the deployed backend

Sign-up verification, sign-in codes, and password reset all send email from the
Django server. This file explains the three ways to send it, which one to use
where, and how to obtain the credentials.

Read this before setting up a new machine. Every credential below goes into
`backend/.env`, which is gitignored — never into a file that is committed.

---

## 1. The three modes

`EMAIL_MODE` in `backend/.env` selects the transport. The credentials are the
same two keys in both SMTP modes, so switching is a one-line change.

| Mode | Where it sends | Used for | Account needed |
| --- | --- | --- | --- |
| `console` | Your terminal | Local development, no network | None |
| `mailtrap` | Mailtrap sandbox inbox | Local development that looks like the real thing | Free Mailtrap account |
| `gmail` | Real inboxes | The deployed backend | A Gmail account with 2-Step Verification |

The rule the team follows:

    Local machine   ->  EMAIL_MODE=mailtrap   (or console if you prefer speed)
    Deployed server ->  EMAIL_MODE=gmail

Mailtrap is deliberately **not** used for anything deployed: its sandbox
catches every message and delivers nothing, so a student signing up on the live
site would never receive a code. Its relay product (Email Sending) can deliver
for real, but only for a domain whose DNS records you control — we do not
control `rtu.edu.ph`, so Gmail is our deployed transport.

---

## 2. Mode 1 — console (default)

Nothing to configure. `backend/.env.example` already ships `EMAIL_MODE=console`.

    EMAIL_MODE=console

Start the server and register an account. The full message, including the
6-digit code, is printed in the `runserver` window. This is the fastest way to
test the sign-up flow and it costs nothing.

---

## 3. Mode 2 — Mailtrap sandbox (local development)

Use this when you want the flow to behave exactly like production without
sending mail to real people, and without spending the Gmail account's daily
sending quota.

### 3.1 Get the credentials

1. Sign in at <https://mailtrap.io> (free plan is enough).
2. Go to **Email Testing → Inboxes → My Inbox**.
3. Open the **SMTP Settings** tab (or the **Django** / **Nodemailer** integration
   tab, which prints the same values).
4. Copy the **username** and **password**. Both are 16-character strings, such
   as `4f1a2b3c9d8e7f01`. They are not your Mailtrap login.

The host and port are fixed and already handled by settings:
`sandbox.smtp.mailtrap.io:2525`, STARTTLS.

### 3.2 Put them in `backend/.env`

    EMAIL_MODE=mailtrap
    EMAIL_HOST_USER=4f1a2b3c9d8e7f01
    EMAIL_HOST_PASSWORD=9c8b7a6d5e4f3a2b

Then restart the server and register an account. The message appears in the
Mailtrap inbox within a few seconds.

### 3.3 Things to know about the sandbox

- Any recipient address is accepted, including `2024-000001@rtu.edu.ph`. Nothing
  leaves Mailtrap.
- Our own validation still applies: student sign-ups need the
  `0000-000000@rtu.edu.ph` form, so use that shape when testing.
- Messages are retained on the free plan for a limited time and a limited count.
  Generate a code fresh when you test; do not rely on an old message.
- Codes expire after 5 minutes (see `apps/accounts/verification.py`), so read
  the code as soon as it lands.

---

## 4. Mode 3 — Gmail (the deployed backend)

Real delivery to any address, including `@rtu.edu.ph` student mailboxes, with no
domain of our own. Gmail authenticates the message, so it is not junked.

### 4.1 Get an App Password

1. Open <https://myaccount.google.com/security> on the account that will send.
2. Turn on **2-Step Verification** if it is not already on. App passwords do not
   appear without it.
3. Open **App passwords**, name it `RTU Tindahan`, and copy the 16-character
   password Google shows once.

> **Institutional accounts.** RTU Workspace accounts
> (`…@rtu.edu.ph`) usually have App passwords disabled by the domain
> administrator, and SMTP authentication from them fails with
> `SMTPServerDisconnected` or `535 5.7.8 Username and Password not accepted`.
> If that happens, use a personal Gmail account as the sender. The recipient
> addresses do not change.

### 4.2 Put them in `backend/.env`

    EMAIL_MODE=gmail
    EMAIL_HOST_USER=your.account@gmail.com
    EMAIL_HOST_PASSWORD=abcdefghijklmnop

Spaces inside the App Password are irrelevant; Google displays it in groups of
four. `DEFAULT_FROM_EMAIL` can be left empty — in the SMTP modes it is built
from `EMAIL_HOST_USER`, because Gmail rejects a From address that is not the
authenticated account.

### 4.3 Changing the sender name

The visible name is a header field, so it is free to change:

    DEFAULT_FROM_EMAIL=RTU Tindahan Marketplace <your.account@gmail.com>

The address part cannot be invented. Sending from `no-reply@rtu.edu.ph` needs
either the school's IT to authorise a relay for that domain, or a domain you own
with SPF and DKIM records pointed at a provider such as Mailtrap, Brevo, or
Resend. Until then the From address is the Gmail account, and anyone who
inspects the headers will see it.

### 4.4 The deployment sender

The deployed backend on `kallisto-1` sends as **rtutindahan@gmail.com**, the
project account rather than a member's personal address, so the sender outlives
any one person's ownership of the repo. Switching it again is three lines in
`backend/.env` (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
`DEFAULT_FROM_EMAIL`); `backend/set-sender.sh` does it in one step, backs up
`.env`, and restarts the service:

    cd ~/RTU_Tindahan/backend
    ./set-sender.sh --dry-run                 # show the diff, write nothing
    ./set-sender.sh                           # change to rtutindahan@gmail.com
    ./set-sender.sh --test you@example.com    # apply and send a real message

The App Password is prompted without echo, so it never lands in shell history.
A new App Password has to be generated for the new account first — an App
Password is bound to the account that created it, and reusing the old one makes
Gmail answer `535 5.7.8 Username and Password not accepted`.

### 4.5 Limits to plan around

- Gmail allows roughly 500 recipients per day from a free account.
- Our throttles are 10 registrations per hour and 20 code resends per hour per
  IP (`THROTTLE_REGISTER`, `THROTTLE_VERIFY`). A room full of students on one
  wifi can reach them; raise the limits in `.env` for a class-wide demo.
- First messages from a new sender occasionally land in Spam on Workspace
  inboxes. Mark one as "Not spam" and later messages go to the inbox.

---

## 5. Verifying that mail actually leaves

Fastest check, no browser needed. From `backend/` with the virtual environment
active:

    python - <<'PY'
    import os, django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()
    from django.conf import settings
    from django.core.mail import send_mail
    print("backend:", settings.EMAIL_BACKEND)
    print("host   :", settings.EMAIL_HOST, settings.EMAIL_PORT)
    print("from   :", settings.DEFAULT_FROM_EMAIL)
    print("sent   :", send_mail("RTU Tindahan test", "Mail path check.",
                                 settings.DEFAULT_FROM_EMAIL, ["2024-000001@rtu.edu.ph"]))
    PY

`sent: 1` means the SMTP server accepted the message. Then look where that mode
delivers — the terminal, the Mailtrap inbox, or the real mailbox.

To exercise the real application path instead, register a throwaway account
through the API and watch for the code:

    curl -X POST http://localhost:8000/api/v1/auth/register/ \
      -H "Content-Type: application/json" \
      -d '{"email":"2024-999999@rtu.edu.ph","display_name":"Mail Test",
           "password":"Tindahan2026!","password_confirm":"Tindahan2026!",
           "member_type":"student","college":"CCS","year_level":3,
           "contact_number":"09171234567","privacy_consent":true}'

A `201` carrying "We emailed a 6-digit code" means the message was handed to the
mail server. Delete the throwaway account afterwards.

---

## 6. Troubleshooting

| Message or symptom | Cause | Fix |
| --- | --- | --- |
| Code never arrives, nothing in the terminal | `EMAIL_MODE` still `console` but you are looking at an inbox | Set `EMAIL_MODE=gmail` or `mailtrap` and restart |
| `535 5.7.8 Username and Password not accepted` | Wrong App Password, or 2-Step Verification is off | Regenerate the App Password at myaccount.google.com |
| `SMTPServerDisconnected` on login | Institutional account with App passwords disabled | Use a personal Gmail account |
| Mailtrap inbox stays empty | Credentials swapped, or inbox is not the active one | Recheck the 16-character pair in Email Testing → Inboxes |
| Gmail accepts but the message never leaves `Sent` | Recipient address rejected by our own validator | Students need `0000-000000@rtu.edu.ph`; faculty and personnel may use other locals |
| `From` rejected at send time | `DEFAULT_FROM_EMAIL` does not match `EMAIL_HOST_USER` | Leave `DEFAULT_FROM_EMAIL` empty, or use a verified alias |
| `429`/throttle response when registering | Rate limit reached | Wait out the window or raise `THROTTLE_REGISTER` in `.env` |
| Code rejected as expired | Codes live 5 minutes | Use "resend code" and verify promptly |
| `Connection refused` to port 587 | Network blocks the port | Try port 465 with `EMAIL_USE_TLS=False` and implicit TLS, or another network |

---

## 7. House rules

- `backend/.env` is gitignored and must stay that way. Only `.env.example` is
  committed, and it contains placeholders, never real values.
- On a shared machine, `chmod 600 backend/.env`.
- An App Password is a password. Do not paste it into chat, an issue, a pull
  request, or a screenshot; move it straight into `.env`.
- Rotate the App Password at the end of every term, and immediately if it has
  ever been exposed: myaccount.google.com → Security → App passwords → remove,
  then create a new one.
- If a credential is committed by accident, rotate it. Deleting the file in a
  later commit does not remove it from history.

---

## 8. Deployment checklist

For the arrangement this project uses — backend on a machine behind a tunnel,
frontend on Netlify:

1. Backend machine: `EMAIL_MODE=gmail`, credentials filled, `.env` mode 600.
2. Backend machine: `DJANGO_ALLOWED_HOSTS` includes the tunnel hostname,
   `DJANGO_CSRF_TRUSTED_ORIGINS` and `DJANGO_CORS_ALLOWED_ORIGINS` include both
   the Netlify origin and the tunnel origin.
3. Backend exposed through the tunnel; `curl https://<tunnel>/health/` returns
   200 with `"database": "ok"`.
4. Netlify: `VITE_API_BASE_URL` set to `https://<tunnel>/api/v1`, then redeploy —
   Vite bakes the value in at build time, so changing the variable alone does
   nothing.
5. Register a throwaway account on the deployed site and confirm the code
   arrives in a real inbox. Delete the account after.
