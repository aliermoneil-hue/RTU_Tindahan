# Data retention (PR-05, PR-06)

The SRS asks for "a data retention period that is defined and documented" and
then hands the number itself to the University (Appendix B.2, item 2): it is one
of the items the proponents cannot invent. This document is how that is handled
honestly — the mechanism is ours, the number is a setting.

## The period

| Setting | Default | What it governs |
| --- | --- | --- |
| `DATA_RETENTION_DAYS` | `730` (two years) | An order in a terminal state (`declined`, `completed`, `cancelled`) that has not moved since before the cutoff, and the reviews attached to it. |
| `NOTIFICATION_RETENTION_DAYS` | `90` | Notifications the member has already read. |
| `AUTH_TOKEN_TTL_DAYS` | `14` | Sign-in tokens (the authentication class already refuses an aged token; `prune_tokens` removes the rows). |

Two years is a working default chosen so a student can look back at last year's
transactions; it is a single environment variable, and the University's answer —
when it comes — is a one-line change in `backend/.env`, not a code change.
`0` disables a purge entirely, which is the right setting while the number is
still under discussion.

## What is deleted, and what is not

`manage.py purge_expired_data` deletes:

- terminal orders past the cutoff, **with their reviews** — the FK cascades, and
  that is the intent: PR-06 keeps a review for the same span as the order it
  judges;
- read notifications past their cutoff.

It never deletes:

- an order that is `requested` or `accepted`, however old — that is a live
  obligation between two students, not a record;
- accounts, listings, forum posts or comments;
- a review whose order is still inside the period.

Deleting an account is a separate path (PR-06): the account is deactivated and
its name, email, contact number and photo are scrubbed, while orders and
published reviews survive without the person's name.

```
# what would go, without deleting anything
.venv/bin/python manage.py purge_expired_data --dry-run

# ask about a different period without waiting two years
.venv/bin/python manage.py purge_expired_data --dry-run --days 30
```

## When it runs

Nightly, after the backup window, logging to the same folder:

```
30 3 * * *  cd /home/kallisto/RTU_Tindahan/backend && .venv/bin/python manage.py purge_expired_data >> /home/kallisto/backups/tindahan/retention.log 2>&1
```

Because it runs *after* the 02:10 backup, every purge is preceded by a snapshot
that still contains the rows — a mistaken period is recoverable for as long as
backups are kept (14 days, see `BACKUP.md`).

## Tests

`apps/accounts/tests/test_retention.py`, seven cases: a finished order past the
period goes with its review; one inside the period stays; an open order is never
touched however old; a dry run changes nothing; `--days` overrides the period; a
read notification expires and an unread one does not; `DATA_RETENTION_DAYS=0`
disables the purge and says so.
