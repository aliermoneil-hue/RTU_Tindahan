"""Take a verified nightly copy of the database.

    manage.py backup_database            # take one, verify it, prune old ones
    manage.py backup_database --dry-run  # say what would happen
    manage.py backup_database --keep 30  # keep 30 copies instead of the default

Why a command rather than a `cp` in cron: the only honest backup of a SQLite
database is the copy sqlite3 makes itself. The backup API takes a consistent
snapshot while the site is serving; a plain file copy can catch a half-written
transaction and produce a file that opens but has lost rows.

Every copy is read back before it is kept: `PRAGMA integrity_check` must answer
`ok`, otherwise the file is deleted and the command fails, because a backup
nobody verified is a hope rather than a backup. The row counts of the core
tables are printed so a restore can be compared against them.
"""

import os
import sqlite3
import tarfile

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone

BACKUP_PREFIX = "db-"
BACKUP_SUFFIX = ".sqlite3"
MEDIA_PREFIX = "media-"
MEDIA_SUFFIX = ".tar.gz"

# Enough to notice a truncated or emptying database without guessing at the
# whole schema. Each entry is (label, table) and is reported, not enforced —
# an empty marketplace is legal, a corrupt file is not.
CORE_TABLES = (
    ("users", "accounts_user"),
    ("listings", "catalog_listing"),
    ("orders", "orders_order"),
    ("forum posts", "forum_forumpost"),
    ("store tickets", "store_officialticket"),
)


def backup_dir():
    return os.path.expanduser(
        getattr(settings, "BACKUP_DIR", "~/backups/tindahan")
    )


def is_sqlite():
    return connection.vendor == "sqlite"


def existing_backups(directory, prefix=BACKUP_PREFIX, suffix=BACKUP_SUFFIX):
    """Our own copies of one kind, newest first. Unrelated files are left alone."""
    try:
        names = [
            name
            for name in os.listdir(directory)
            if name.startswith(prefix) and name.endswith(suffix)
        ]
    except FileNotFoundError:
        return []
    paths = [os.path.join(directory, name) for name in names]
    return sorted(paths, key=os.path.getmtime, reverse=True)


def media_root():
    return getattr(settings, "MEDIA_ROOT", None) or os.path.join(settings.BASE_DIR, "media")


def archive_media(path):
    """tar.gz the uploads. Returns how many files went in.

    A database copy alone restores rows that name photos the disk no longer
    has: listings and forum threads come back with broken images. The uploads
    are small (hundreds of KB), so they travel with the same nightly run.
    """
    source = media_root()
    added = 0
    with tarfile.open(path, "w:gz") as archive:
        for root, _dirs, files in os.walk(source):
            for name in files:
                full = os.path.join(root, name)
                archive.add(full, arcname=os.path.relpath(full, source))
                added += 1
    return added


def verify_media(path, expected):
    with tarfile.open(path, "r:gz") as archive:
        names = [member.name for member in archive.getmembers() if member.isfile()]
    if len(names) != expected:
        raise CommandError(
            f"{os.path.basename(path)} holds {len(names)} file(s), expected {expected}"
        )
    return names


def is_in_memory():
    name = str(connection.settings_dict.get("NAME") or "")
    return name in (":memory:", "") or "mode=memory" in name


def take_snapshot(path):
    """Copy the live database through Django's own connection.

    Opening the file path instead would copy an empty database when the
    deployment (or a test) uses in-memory SQLite, which is exactly the case
    that produces a "backup" with no rows in it.

    For an in-memory database the backup API is not usable: Django puts the
    test database in a shared cache, and `backup()` waits on a lock it can
    never get from the same process. `Connection.serialize()` is the supported
    way to dump an in-memory database, and it includes the current transaction,
    so the copy is still consistent.
    """
    connection.ensure_connection()
    if is_in_memory():
        payload = connection.connection.serialize()
        with open(path, "wb") as handle:
            handle.write(payload)
        return
    target = sqlite3.connect(path)
    try:
        connection.connection.backup(target)
    finally:
        target.close()


def verify(path):
    """Open the copy and prove it is readable and intact. Returns the counts."""
    counts = {}
    probe = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        verdict = probe.execute("PRAGMA integrity_check").fetchone()[0]
        if verdict != "ok":
            raise CommandError(f"{os.path.basename(path)} failed integrity_check: {verdict}")
        for label, table in CORE_TABLES:
            try:
                counts[label] = probe.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except sqlite3.OperationalError:
                counts[label] = None  # table not in this schema; reported, not fatal
    finally:
        probe.close()
    return counts


class Command(BaseCommand):
    help = "Take a consistent, verified copy of the SQLite database and prune old copies."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep",
            type=int,
            default=int(getattr(settings, "BACKUP_KEEP", 14)),
            help="How many copies to keep, newest first (default: 14).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be written and pruned, and change nothing.",
        )
        parser.add_argument(
            "--skip-media",
            action="store_true",
            help="Take the database copy only, without the uploads archive.",
        )

    def handle(self, *args, **options):
        if not is_sqlite():
            raise CommandError(
                "backup_database is implemented for the SQLite deployment. "
                "On PostgreSQL, schedule pg_dump on the host instead."
            )

        directory = backup_dir()
        keep = options["keep"]
        if keep < 1:
            raise CommandError("--keep must be at least 1.")

        stamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
        name = f"{BACKUP_PREFIX}{stamp}{BACKUP_SUFFIX}"
        final_path = os.path.join(directory, name)
        partial_path = final_path + ".partial"

        media_path = os.path.join(directory, f"{MEDIA_PREFIX}{stamp}{MEDIA_SUFFIX}")
        want_media = not options["skip_media"] and os.path.isdir(media_root())

        old = existing_backups(directory)
        old_media = existing_backups(directory, MEDIA_PREFIX, MEDIA_SUFFIX)

        if options["dry_run"]:
            self.stdout.write(f"Would write {final_path}")
            if want_media:
                self.stdout.write(f"Would write {media_path}")
            self.stdout.write(f"Would keep {keep} copy/copies; {len(old)} exist now.")
            for path in old[max(keep - 1, 0):]:
                self.stdout.write(f"Would delete {path}")
            for path in old_media[max(keep - 1, 0):]:
                self.stdout.write(f"Would delete {path}")
            return

        os.makedirs(directory, exist_ok=True)

        try:
            take_snapshot(partial_path)
            counts = verify(partial_path)
        except CommandError:
            self._discard(partial_path)
            raise
        except Exception as exc:  # noqa: BLE001 - any failure leaves no half-backup
            self._discard(partial_path)
            raise CommandError(f"Backup failed and was discarded: {type(exc).__name__}: {exc}")

        size = os.path.getsize(partial_path)
        if size == 0:
            self._discard(partial_path)
            raise CommandError("Backup failed: the copy is empty.")

        os.replace(partial_path, final_path)
        os.chmod(final_path, 0o600)

        self.stdout.write(self.style.SUCCESS(f"Wrote {final_path} ({size} bytes)"))
        self.stdout.write(
            "Verified: " + ", ".join(f"{label}={count}" for label, count in counts.items())
        )

        # The uploads travel with the same stamp: a database restored without
        # them comes back with listings whose photos no longer exist.
        if want_media:
            media_partial = media_path + ".partial"
            try:
                added = archive_media(media_partial)
                verify_media(media_partial, added)
            except CommandError:
                self._discard(media_partial)
                raise
            except Exception as exc:  # noqa: BLE001 - keep the database copy
                self._discard(media_partial)
                raise CommandError(
                    "Database copy is safe, but the uploads archive failed and was "
                    f"discarded: {type(exc).__name__}: {exc}"
                )
            os.replace(media_partial, media_path)
            os.chmod(media_path, 0o600)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Wrote {media_path} ({os.path.getsize(media_path)} bytes, "
                    f"{added} file(s) verified)"
                )
            )

        # Prune after the new copies are safe, so a failed run never costs one.
        for prefix, suffix, old_kind in (
            (BACKUP_PREFIX, BACKUP_SUFFIX, "database copy"),
            (MEDIA_PREFIX, MEDIA_SUFFIX, "uploads archive"),
        ):
            ranked = existing_backups(directory, prefix, suffix)
            keepers, doomed = ranked[:keep], ranked[keep:]
            for path in doomed:
                os.unlink(path)
                self.stdout.write(f"Pruned {path}")
            self.stdout.write(f"{len(keepers)} {old_kind}(s) kept, {len(doomed)} pruned.")

    def _discard(self, path):
        try:
            os.unlink(path)
        except OSError:
            pass
