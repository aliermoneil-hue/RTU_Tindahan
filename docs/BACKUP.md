# Nightly database copies

The marketplace lives in one SQLite file on kallisto-1. This is how it is
copied, how the copy is proved readable, and how a restore is done when it is
needed.

    cd backend
    .venv/bin/python manage.py backup_database            # take one, verify, prune
    .venv/bin/python manage.py backup_database --dry-run  # say what would happen
    .venv/bin/python manage.py backup_database --keep 30  # keep 30 copies

It runs from cron at **02:10** daily, before the token sweep at 03:10:

    10 2 * * * cd /home/kallisto/RTU_Tindahan/backend && .venv/bin/python manage.py backup_database >> /home/kallisto/backups/tindahan/backup.log 2>&1

---

## 1. Where the copies go

    ~/backups/tindahan/db-YYYYMMDD-HHMMSS.sqlite3    mode 600
    ~/backups/tindahan/backup.log                    what each run said

Outside the repository on purpose: a backup inside the working tree gets
committed, swept into a deploy, or deleted by the next `git clean`.

| Setting | `.env` key | Default |
| --- | --- | --- |
| Directory | `BACKUP_DIR` | `~/backups/tindahan` |
| Copies kept | `BACKUP_KEEP` | `14` |

Pruning counts only files named `db-*.sqlite3`, so the log and anything else a
person puts in that directory are left alone. The new copy is written and
verified **before** anything is pruned: a failed run never costs a backup.

---

## 2. Why a command and not a `cp`

The only honest backup of a SQLite database is the copy sqlite3 makes itself.
`backup_database` copies through the connection Django is already holding, so
it takes a consistent snapshot while the site is serving. A plain `cp` of the
file can catch a half-written transaction and produce a file that opens but has
lost rows — the worst kind of backup, because it looks fine.

For an in-memory database (the test runner) the backup API cannot be used: the
shared cache holds a lock the same process can never get. The command uses
`Connection.serialize()` there, which is the supported way to dump an
in-memory database and includes the current transaction.

---

## 3. Every copy is read back

After writing, the command opens the copy read-only and checks it:

    PRAGMA integrity_check   -> must answer "ok", or the file is deleted and
                                the run fails
    row counts               -> users, listings, orders, forum posts, store
                                tickets, printed into the log

The row counts are not a pass/fail rule — an empty marketplace is legal — they
are there so a restore can be compared against them, and so a copy that is
suddenly empty is visible in the log instead of discovered months later.

A real run looks like this:

    Wrote /home/kallisto/backups/tindahan/db-20261124-183839.sqlite3 (786432 bytes)
    Verified: users=10, listings=10, orders=3, forum posts=3, store tickets=7
    1 copy/copies kept, 0 pruned.

---

## 4. Restoring

Stop the service first. Replacing a live database from inside the running
process is how a demo loses its data.

    # 1. pick the copy
    ls -t ~/backups/tindahan/db-*.sqlite3 | head

    # 2. prove it before trusting it (read-only, changes nothing)
    sqlite3 "file:$HOME/backups/tindahan/db-YYYYMMDD-HHMMSS.sqlite3?mode=ro" \
      'PRAGMA integrity_check; SELECT COUNT(*) FROM accounts_user;'

    # 3. stop, keep the damaged file, swap, start
    systemctl --user stop rtu-tindahan
    mv /home/kallisto/RTU_Tindahan/backend/db.sqlite3 \
       /home/kallisto/RTU_Tindahan/backend/db.sqlite3.broken-$(date +%Y%m%d-%H%M)
    cp ~/backups/tindahan/db-YYYYMMDD-HHMMSS.sqlite3 \
       /home/kallisto/RTU_Tindahan/backend/db.sqlite3
    chmod 600 /home/kallisto/RTU_Tindahan/backend/db.sqlite3
    systemctl --user start rtu-tindahan

    # 4. confirm the site answers and the rows are the ones expected
    curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/health/

### The drill that was actually run

A copy is not a backup until something reads it back. The copy taken on
2026-11-24 was opened **by Django's own ORM**, not just by sqlite3, using a
throwaway settings module that pointed `DATABASES["default"]["NAME"]` at the
file:

    restored copy reads: 10 users, 10 listings, 3 orders, 3 posts,
                         6 comments, 4 screening rows, 7 tickets
    an account resolves: admin@rtu.edu.ph | verified: True
    latest migrations recorded: 49 rows

That proves the file is a working Django database — schema, migration history,
password hashes and foreign keys included — rather than merely a readable file.

---

## 5. What this does not cover

- **Uploaded photos are files, not rows.** Listing photos and forum images live
  under `backend/media/`. A database restore brings back the row that names a
  photo, not the photo. Copy `backend/media/` alongside the database when a
  restore matters: `rsync -a backend/media/ ~/backups/tindahan/media-$(date +%F)/`.
- **Everything is on one disk.** Copies sit on the same machine as the database,
  so a disk failure or a lost host takes both. An offsite copy is one line —
  `rsync -a ~/backups/tindahan/ <another-host>:backups/tindahan/` — and is not
  configured here because it needs a destination someone owns.
- **PostgreSQL deployments use `pg_dump`.** The command refuses with that
  message on a non-SQLite engine rather than pretending to have a backup.
