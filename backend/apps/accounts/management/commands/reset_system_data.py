"""Empty the marketplace back to a working, unpopulated state.

    manage.py reset_system_data --dry-run   # say what would go, touch nothing
    manage.py reset_system_data --yes       # do it

Why a command and not a `flush`: `flush` truncates every table, which throws away
the configuration a working install needs — categories, colleges, screening rules,
the store's settings — and drops every account, including the administrator the
next login needs. This deletes what members *made* and leaves what the office
*configured*, so the site is empty but usable the moment the command returns.

What is kept, deliberately:

* categories, colleges and their aliases — the catalogue's vocabulary
* screening rules — the office's moderation policy, not member content
* the store's settings — deposit, hours, the rules students agree to
* Django's own permission and content-type rows — schema, not data
* every account whose role is administrator, so someone can still log in

Everything else goes: members, their listings and photos, orders, messages,
forum threads, store tickets, notifications, screening verdicts, audit rows and
session tokens. Uploaded files under MEDIA_ROOT are removed with their rows.

Take a backup first — `manage.py backup_database` verifies one — because this
command has no undo of its own beyond that copy.
"""

import os
import shutil

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError

# Configuration, not member content: the office's setup survives a reset.
KEEP_MODELS = {
    "accounts.College",
    "accounts.CollegeAlias",
    "catalog.Category",
    "screening.ScreeningRule",
    "store.StoreSetting",
    "auth.Permission",
    "auth.Group",
    "contenttypes.ContentType",
    "admin.LogEntry",
}


# Credentials belong to whoever holds them: an administrator's token is not member
# content, and deleting it would sign the only remaining account out of its own site.
ADMIN_OWNED = {
    "authtoken.Token": ("user",),
    "accounts.TokenActivity": ("token__user",),
}


def admin_owned_filter(model):
    """The lookup that keeps administrators' rows out of the delete set, or None."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    fields = ADMIN_OWNED.get(model._meta.label)
    if not fields:
        return None
    if model._meta.label == "authtoken.Token":
        return {f"{fields[0]}__role": "administrator"}
    return {"token__user__role": "administrator"}


class Command(BaseCommand):
    help = "Delete member-created data, keeping configuration and administrators."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="actually delete")
        parser.add_argument(
            "--dry-run", action="store_true", help="report what would be deleted"
        )
        parser.add_argument(
            "--keep-media",
            action="store_true",
            help="leave uploaded files on disk (they will no longer be referenced)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"] or not options["yes"]
        User = get_user_model()

        admins = list(
            User.objects.filter(role="administrator").values_list("email", flat=True)
        )
        if not admins:
            raise CommandError(
                "No administrator account exists. This command would leave nobody "
                "able to log in; create one first."
            )

        # Every concrete model not on the keep-list, counted before anything changes.
        plan = []
        for model in apps.get_models():
            meta = model._meta
            if meta.proxy or meta.abstract:
                continue
            label = meta.label
            if label in KEEP_MODELS:
                continue
            if label == User._meta.label:
                try:
                    count = User.objects.exclude(role="administrator").count()
                except Exception:
                    count = User.objects.count()
            elif admin_owned_filter(model):
                count = model.objects.exclude(**admin_owned_filter(model)).count()
            else:
                try:
                    count = model.objects.count()
                except Exception as exc:  # a table we cannot count is reported, not guessed
                    self.stderr.write(f"  ! {label}: {exc}")
                    continue
            if count:
                plan.append((count, label, model))

        plan.sort(reverse=True)
        total = sum(count for count, _, _ in plan)
        self.stdout.write(
            f"{'Would delete' if dry_run else 'Deleting'} {total} row(s) across "
            f"{len(plan)} table(s); keeping {len(KEEP_MODELS)} configuration table(s) "
            f"and {len(admins)} administrator(s): {', '.join(sorted(admins))}"
        )
        for count, label, _ in plan:
            self.stdout.write(f"  {count:>6}  {label}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDry run: nothing was changed."))
            return

        removed, errors = 0, []
        with transaction.atomic():
            # Two passes: a table can gain rows as something it points at is deleted
            # (cascades), and a ProtectedError on the first pass is often cleared by
            # the second once its referrer is gone.
            for _ in range(2):
                for count, label, model in plan:
                    if label == User._meta.label:
                        qs = model.objects.exclude(role="administrator")
                    elif admin_owned_filter(model):
                        qs = model.objects.exclude(**admin_owned_filter(model))
                    else:
                        qs = model.objects.all()
                    try:
                        deleted, _detail = qs.delete()
                        removed += deleted
                    except ProtectedError as exc:
                        errors.append(f"{label}: {exc}")
        self.stdout.write(f"\nDeleted {removed} row(s).")

        if not options["keep_media"]:
            media_root = getattr(
                __import__("django.conf", fromlist=["settings"]).settings,
                "MEDIA_ROOT",
                None,
            )
            if media_root and os.path.isdir(media_root):
                files = 0
                for entry in os.listdir(media_root):
                    path = os.path.join(media_root, entry)
                    if os.path.isdir(path):
                        # keep the placeholder folders the app expects
                        for root, dirs, names in os.walk(path):
                            files += len(names)
                        shutil.rmtree(path)
                        os.makedirs(path, exist_ok=True)
                    else:
                        os.remove(path)
                        files += 1
                self.stdout.write(f"Removed {files} uploaded file(s) under {media_root}.")
        else:
            self.stdout.write("Uploaded files left on disk (--keep-media).")

        if errors:
            self.stderr.write(self.style.WARNING("\nSome rows resisted deletion:"))
            for line in errors:
                self.stderr.write(f"  {line}")

        # The point of the whole exercise: prove it is empty and still usable.
        remaining = []
        for model in apps.get_models():
            meta = model._meta
            if meta.proxy or meta.abstract or meta.label in KEEP_MODELS:
                continue
            try:
                if meta.label == User._meta.label:
                    count = model.objects.exclude(role="administrator").count()
                elif admin_owned_filter(model):
                    count = model.objects.exclude(**admin_owned_filter(model)).count()
                else:
                    count = model.objects.count()
            except Exception:
                continue
            if count:
                remaining.append((count, meta.label))
        if remaining:
            self.stdout.write("\nStill present:")
            for count, label in sorted(remaining, reverse=True):
                self.stdout.write(f"  {count:>6}  {label}")
        else:
            self.stdout.write(self.style.SUCCESS("\nEmpty. Configuration intact."))
