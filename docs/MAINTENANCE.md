
## Emptying the data for a stress test

    manage.py backup_database              # verified copy first: db, uploads, counts
    manage.py reset_system_data --dry-run  # what would go, touching nothing
    manage.py reset_system_data --yes      # empty it; configuration and admins stay

`reset_system_data` deletes what members *made* — accounts, listings and their
photos, orders, messages, forum threads, store tickets, notifications, screening
verdicts, audit rows, sessions — and keeps what the office *configured*:
categories, colleges and aliases, screening rules, the store's settings, Django's
permission and content-type rows, and every account whose role is administrator
(with its token, so the remaining admin is not signed out of its own site).

It refuses to run when no administrator exists, because that would leave a site
nobody can log into, and it reports what is left behind so "empty" is verified
rather than assumed. Uploaded files under `MEDIA_ROOT` go with their rows;
`--keep-media` leaves them for forensics. `flush` is the wrong tool here: it
truncates the configuration the next login and the catalogue depend on.

Restore is the file, not a merge: `cp db-<stamp>.sqlite3 backend/db.sqlite3` and
restart the unit. The `data.json` export loads too, but only after clearing the
seeded screening rules (`ScreeningRule.objects.all().delete()`), otherwise the
fixture collides with the rows the migrations already inserted.
