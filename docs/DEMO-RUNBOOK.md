# Demo runbook

A scripted eight minutes, in the order that tells the story with the fewest
surprises. Every step has an expected result; if one does not appear, stop and
use the recovery notes at the end rather than improvising in front of the panel.

---

## 0. The numbers to quote

    tests            374 backend tests, green on every push (CI), ~5 s locally
    response times   a screened listing or post publishes in ~1 s
    backups          nightly at 02:10, database + uploads, verified, 14 kept
    roles            visitor, student member, office staff, moderator, administrator
    surface          11 Django apps, 30 models, 35 views
    requirements     174 in the SRS: 151 implemented, 16 partial,
                     0 open, 2 deliberately not done, 5 unmeasured
                     (docs/SRS-STATUS.md, regenerated from the SRS itself)

---

## 1. Pre-flight, ten minutes before

    # backend alive and answering
    systemctl --user is-active rtu-tindahan        # -> active
    curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/health/   # -> 200

    # public origin (the URL the panel will see)
    curl -s -o /dev/null -w '%{http_code}\n' https://kallisto-1.tail69492d.ts.net/health/   # -> 200

    # the deployed frontend matches the build you are demonstrating
    curl -s https://rtu-tindahan-nine.vercel.app/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
    grep -o 'index-[A-Za-z0-9_-]*\.js' ~/RTU_Tindahan/frontend/dist/index.html

    # no probe rows left behind
    cd ~/RTU_Tindahan/backend && .venv/bin/python manage.py shell -c \
      "from apps.forum.models import ForumPost; from apps.forum.models import ForumComment; \
       print(ForumPost.objects.filter(moderation_status='needs_review').count(), \
             ForumComment.objects.filter(moderation_status='needs_review').count())"

Expected: `0 0`. Anything else means a previous attempt left a held item — release
or delete it first so the queue starts empty and the demo can show a real hold.

**Accounts.** All four demo accounts are verified and active:

| Email | Role | Used for |
| --- | --- | --- |
| `2024-000001@rtu.edu.ph` | user (student) | browsing, posting, ordering |
| `2024-000002@rtu.edu.ph` | office_staff | Official Store, inventory, walk-in sale |
| `2024-000003@rtu.edu.ph` | moderator | moderation queue, forum reports |
| `admin@rtu.edu.ph` | administrator | users and audit, database download |

Passwords are never stored in this repository. Sign in with the one you set; if
it is forgotten, reset it once from the host (the value stays out of the repo
and out of the transcript):

    cd ~/RTU_Tindahan/backend && .venv/bin/python manage.py shell -c \
      "from apps.accounts.models import User; u=User.objects.get(email='2024-000001@rtu.edu.ph'); \
       u.set_password(input('new password: ')); u.save(update_fields=['password'])"

Do that for each role you will use, before the demo, not during it.

---

## 2. The script

### 2.1 A visitor, thirty seconds

1. Open https://rtu-tindahan-nine.vercel.app/ in a fresh private window.
2. Browse → sort by **Small sellers first**.

   Expected: the grid fills with student sellers; the badge on a card reads
   *Student seller*. No sign-in was needed.
3. Open any product. Expected: price, condition, quantity, meetup place, photos,
   seller name, and a **Sign in to continue** action instead of a cart button.

Point being made: the catalogue is public, the transaction is not.

### 2.2 A student posts, and screening holds nothing (ninety seconds)

1. Sign in as `2024-000001`.
2. Sell an item → title "Second-hand calculator", description at least a
   sentence, price 800, quantity 1, meetup "Main gate", one photo.
3. Submit.

   Expected: the listing is saved and reads **Pending review** in *My shop*. It
   is *not* in the public catalogue yet.

4. Still signed in, post to the forum: title "Study group", body ordinary.

   Expected: it appears in the forum at once, and the test suite's rules
   provider found nothing to flag.

### 2.3 A moderator publishes it (sixty seconds)

1. Sign in as `2024-000003`.
2. Admin → Moderation. The calculator is in the queue with its screening verdict
   and reasons.
3. Approve it.

   Expected: the listing appears in the visitor's catalogue on the next refresh
   (the page polls), and the audit screen gains a row naming the moderator.

4. Admin → Forum reports. Expected: empty, because nothing was flagged.

### 2.4 Screening actually blocks something (ninety seconds)

1. Back as the student, post to the forum: title "Selling answer keys", body
   "Complete exam answers for the midterm, cheap."

   Expected: **Held for review** pill on your own row; it never appears for
   anyone else; your inbox gains "Your post … is held for review".

2. Sign in as the moderator → Admin → Forum reports.

   Expected: **Held by screening (1)** with the reason ("Mentions a prohibited
   item: answer key…"), plus **Open / Release / Delete**.

3. Press **Release**.

   Expected: the panel empties and the post is public. Say plainly that Release
   is the only way back — a clean score never publishes anything by itself.

### 2.5 A comment, same gate (sixty seconds)

1. As the student, comment on your own study-group post: "Selling vape pens,
   meet at the gate."

   Expected: the comment is held — visible to you with the pill, absent for
   everyone else, and listed under **Held comments** for the moderator.

2. Delete it from the staff panel. Expected: it is gone for every reader.

Point being made: the gate covers conversations, not only listings.

### 2.6 The order path (ninety seconds)

1. As a second student (or `2024-200374`), add the approved calculator to the
   request cart, continue to confirmation, tick the agreement, send the request.
2. Expected: an order reference `ORD-…` appears in *My orders* → Requests you
   sent, and the seller's *My shop → Incoming orders* shows it without a reload.
3. As the seller, accept it; then message the buyer from the order.

   Expected: the thread opens on both sides and the message arrives without a
   refresh (chat polls).

### 2.7 Official Store and back-office (sixty seconds)

1. As `2024-000002`, Official Store → pick a size → request a ticket.
2. Staff → Store orders: confirm, mark ready for pickup, then claim it.

   Expected: stock drops on each claim and the ledger shows the movement.
3. Staff → Store inventory → **Record sale** for a walk-in: one unit.

   Expected: the row drops by one and a Sold ledger row is written.

### 2.8 The safety net (sixty seconds)

1. Admin → Users & audit: suspend a throwaway account, then suspend it again to
   restore. Expected: the audit trail records both decisions.
2. Admin → Backup: download the database.

   Expected: a `.sqlite3` file arrives; say that the same copy is taken nightly,
   verified by reading it back, and that the uploads travel with it
   (`docs/BACKUP.md`).

---

## 3. If something goes wrong

| Symptom | Check | Fix |
| --- | --- | --- |
| "Cannot reach the server" in the browser | `systemctl --user is-active rtu-tindahan`, `curl /health/` | `systemctl --user restart rtu-tindahan` |
| The site loads but every screen is empty | The funnel: `curl https://kallisto-1.tail69492d.ts.net/health/` | Start the tailnet funnel again; the site falls back to the last deploy meanwhile |
| A listing sits in *Pending review* | That is correct behaviour | Approve it as the moderator |
| A post or comment vanished | It may be held; check the moderator queue | Release it (the author was also told by inbox) |
| Screening takes six seconds | The provider is degraded; the rules fallback answers | Say so — the fallback is the designed behaviour, not a fault |
| Sign-in says the account is locked | Five wrong passwords trip a cooldown; seven a restriction | Reset the password (that clears the lock), or wait 60 s |

The honest fallback, if the network or the home machine fails entirely: run the
suite on the host. `manage.py test` finishes in about five seconds and covers
374 behaviours, and `docs/REQUIREMENTS-TRACE.md` shows the panel where each
requirement is enforced. A demo that fails over to evidence is stronger than one
that stalls.

---

## 4. Do not do these on the day

- Do not sign in as four accounts in one window without a hard reload; the token
  is per browser session and the app re-reads it on load.
- Do not demonstrate the database **restore** live. The procedure is in
  `docs/BACKUP.md`, and it stops the service on purpose.
- Do not promise reviews screening or per-device sessions; both are documented
  as not done, with reasons (`docs/SCREENING.md` §6, `docs/AUTH-HARDENING.md` §6).
- Do not leave the student's "answer keys" post public after the demo — delete
  it, and check the queue reads `0 0` again.
