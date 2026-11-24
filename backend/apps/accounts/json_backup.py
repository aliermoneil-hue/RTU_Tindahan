"""PX-06: a JSON backup of the content, an import of one, and a reset.

Two boundaries are drawn on purpose, and both are written into the response and
the docs rather than left for someone to discover:

* **Accounts travel as references, not as credentials.** The export names the
  people a row belongs to (an id and an email) so a restored listing still has a
  seller, but it carries no password hash and the import never writes an account
  row. Credentials move in the SQLite backup, which is the file an administrator
  downloads from `GET /admin/backup/` and restores on the host. A JSON file that
  could overwrite an account would be an account-takeover tool wearing a backup's
  clothes.
* **Import never deletes.** It writes the rows in the file over the rows with the
  same primary key and leaves everything else alone, so a half-remembered import
  cannot remove today's work. Removing everything is `reset`, which is a separate,
  separately-confirmed action.

The reset returns the system to its seeded source: the demo accounts, the
category taxonomy and the official store catalogue stay, and everything members
made is cleared. That is what "reset everything from its source" can honestly mean
for a prototype whose source is a seeder, and the audit log records who did it.
"""

import json

from django.apps import apps
from django.db import transaction
from django.utils import timezone

# Content models, in dependency order: a row is written after everything it
# points at, and cleared before everything that points at it.
CONTENT_MODELS = [
    ("catalog", "Category"),
    ("catalog", "Listing"),
    ("catalog", "ListingPhoto"),
    ("catalog", "ListingVariant"),
    ("forum", "ForumPost"),
    ("forum", "ForumComment"),
    ("forum", "ForumReaction"),
    ("forum", "ForumReport"),
    ("orders", "Order"),
    ("orders", "OrderLine"),
    ("messaging", "Conversation"),
    ("messaging", "Message"),
    ("messaging", "ConversationReport"),
    ("reviews", "Review"),
    ("favorites", "Favorite"),
    ("notifications", "Notification"),
    ("screening", "ScreeningRule"),
    ("screening", "ScreeningResult"),
    ("store", "StoreSetting"),
    ("store", "OfficialTicket"),
    ("store", "TicketItem"),
    ("store", "TicketStatusHistory"),
    ("store", "DailyCount"),
    ("store", "StockMovement"),
    ("store", "EmailOutbox"),
    ("appeals", "Appeal"),
]

# What a reset keeps: the seeder's own rows, and the settings an administrator
# tuned. Everything member-made is cleared.
KEEP_ON_RESET = {
    ("catalog", "Category"),
    ("screening", "ScreeningRule"),
    ("store", "StoreSetting"),
}

FORMAT = "tindahan-json-backup"
VERSION = 1

# Fields that are never exported: a credential, a session, or a pointer to a file
# whose bytes live outside the database and would not travel with this file.
SKIP_FIELDS = {"password", "last_login", "is_superuser"}


def model_for(label):
    app_label, model_name = label
    return apps.get_model(app_label, model_name)


def _field_value(field, value):
    if value is None:
        return None
    if field.is_relation:
        return value  # already an id
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def export_rows(label):
    model = model_for(label)
    fields = [
        field
        for field in model._meta.concrete_fields
        if field.name not in SKIP_FIELDS
    ]
    rows = []
    for obj in model.objects.all().order_by("pk"):
        row = {}
        for field in fields:
            # Relations are written under their attname (`seller_id`), which is
            # what a restore can hand back to the model constructor. Writing
            # `seller` with a bare id would look tidier and restore nothing.
            value = getattr(obj, field.attname, None)
            row[field.attname] = _field_value(field, value)
        rows.append(row)
    return fields, rows


def export_payload():
    """Every content row, as JSON-ready data, with counts to check it against."""
    objects = {}
    counts = {}
    for label in CONTENT_MODELS:
        _fields, rows = export_rows(label)
        key = f"{label[0]}.{label[1]}"
        objects[key] = rows
        counts[key] = len(rows)
    return {
        "format": FORMAT,
        "version": VERSION,
        "exported_at": timezone.now().isoformat(),
        "database_path": "content only — accounts and credentials travel in the SQLite backup",
        "counts": counts,
        "objects": objects,
    }


def as_download(payload) -> bytes:
    return json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")


class ImportRefused(Exception):
    """A file this module will not write: wrong shape, wrong version, unknown model."""


def parse_payload(raw: bytes) -> dict:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportRefused(f"That file is not JSON: {exc}.") from exc
    if not isinstance(data, dict):
        raise ImportRefused("A backup file is a JSON object, not a list or a value.")
    if data.get("format") != FORMAT:
        raise ImportRefused(
            f'This is not a Tindahan backup: expected "format": "{FORMAT}".'
        )
    if data.get("version") != VERSION:
        raise ImportRefused(
            f"That backup is version {data.get('version')!r}; this build reads version {VERSION}."
        )
    if not isinstance(data.get("objects"), dict):
        raise ImportRefused("The backup has no `objects` to restore.")
    allowed = {f"{app_label}.{name}" for app_label, name in CONTENT_MODELS}
    unknown = [key for key in data["objects"] if key not in allowed]
    if unknown:
        raise ImportRefused(f"This build does not know these tables: {', '.join(sorted(unknown))}.")
    return data


@transaction.atomic
def import_payload(data: dict) -> dict:
    """Write the file's rows over the rows with the same key. Nothing is deleted."""
    written = {}
    for app_label, name in CONTENT_MODELS:
        key = f"{app_label}.{name}"
        rows = data["objects"].get(key) or []
        if not rows:
            written[key] = 0
            continue
        model = model_for((app_label, name))
        field_names = {field.attname for field in model._meta.concrete_fields}
        objects = []
        pk_name = model._meta.pk.attname
        for row in rows:
            if not isinstance(row, dict):
                raise ImportRefused(f"{key}: every row must be an object.")
            # The exporter writes the field's own name (`id` on these tables);
            # `pk` is accepted too, because that is what a hand-edited file says.
            primary = row.get("pk", row.get(pk_name))
            if primary is None:
                raise ImportRefused(
                    f"{key}: a row has neither `pk` nor `{pk_name}`, so it cannot be matched."
                )
            clean = {name_: value for name_, value in row.items() if name_ in field_names}
            clean[pk_name] = primary
            objects.append(model(**clean))
        model.objects.bulk_create(
            objects,
            update_conflicts=True,
            unique_fields=["pk"],
            update_fields=[
                field
                for field in field_names
                if field not in {"pk", "id", "created_at", "updated_at"}
            ],
        )
        written[key] = len(objects)
    return written


@transaction.atomic
def reset_content() -> dict:
    """Clear everything members made, keep the seeded source, and say what went."""
    cleared = {}
    # The official catalogue is the office's stock, not member content: a reset
    # clears what members made and leaves the store shelf standing, so a demo
    # does not lose the items the office actually sells.
    official_listing_ids = None
    if apps.is_installed("apps.catalog"):
        Listing = model_for(("catalog", "Listing"))
        official_listing_ids = list(
            Listing.objects.filter(is_official=True).values_list("pk", flat=True)
        )

    for app_label, name in reversed(CONTENT_MODELS):
        key = f"{app_label}.{name}"
        if (app_label, name) in KEEP_ON_RESET:
            cleared[key] = 0
            continue
        model = model_for((app_label, name))
        queryset = model.objects.all()
        if (app_label, name) == ("catalog", "Listing"):
            queryset = queryset.exclude(is_official=True)
        elif (app_label, name) in {("catalog", "ListingVariant"), ("catalog", "ListingPhoto")}:
            # A variant or photo of an official item goes only with that item.
            queryset = queryset.exclude(listing_id__in=official_listing_ids or [])
        deleted, _details = queryset.delete()
        cleared[key] = deleted

    from django.core.management import call_command

    # Re-run the seeders so the prototype is left in a demonstrable state: the
    # taxonomy and the official store catalogue come back if they were missing.
    for command in ("seed_categories", "seed_official_store"):
        try:
            call_command(command, verbosity=0)
        except Exception:  # noqa: BLE001 - a seeder that is absent must not undo a reset
            continue
    return cleared
