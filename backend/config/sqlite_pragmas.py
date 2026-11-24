"""SQLite pragmas that make concurrent reading possible (PF-04).

SQLite's default journal serialises readers against a writer: while one row is
being written, a read waits or fails. On a laptop serving a marketplace that
matters, because a listing view is a read and every order or report is a write.
Write-ahead logging lets a reader see the last committed state while a writer
works, and a busy timeout turns the remaining contention into a short wait
instead of "database is locked".

  journal_mode=WAL      readers do not block the writer
  synchronous=NORMAL    safe with WAL; a crash can lose the last transaction,
                        not the database
  busy_timeout=20000    wait up to twenty seconds rather than raise
  foreign_keys=ON       Django's own setting, restated because a raw pragma
                        change can leave it off per connection

Applied per connection, so the signal is the right hook: a pragma is a property
of the connection, not of the file (except journal_mode, which is stored).
"""

from django.db.backends.signals import connection_created
from django.dispatch import receiver

PRAGMAS = (
    "PRAGMA journal_mode=WAL;",
    "PRAGMA synchronous=NORMAL;",
    "PRAGMA busy_timeout=20000;",
    "PRAGMA foreign_keys=ON;",
)


@receiver(connection_created)
def apply_sqlite_pragmas(sender, connection, **kwargs):
    if connection.vendor != "sqlite":
        return
    with connection.cursor() as cursor:
        for pragma in PRAGMAS:
            try:
                cursor.execute(pragma)
            except Exception:  # noqa: BLE001 - a read-only database cannot set WAL
                pass
