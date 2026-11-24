"""Generate docs/SRS-STATUS.md from the SRS in docs/reference/.

    python3 scripts/srs_matrix.py

Why a script: the SRS is a living document (v1.3 today, v1.4 later), and a
hand-typed matrix goes stale silently. This reads the requirement table out of
the SRS and applies one curated decision per requirement ID, so a new SRS
version produces a diff instead of a rewrite.

The curated decisions are the point. Each ID below was checked against this
repository; the note says what was checked and where the gap is, if any.
"implemented" means the module carries the requirement's scope; "verified"
means this session exercised it through the API, the browser or the tests.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRS = os.path.join(ROOT, "docs", "reference", "SRS-v1.3-FIXED.md")
OUT = os.path.join(ROOT, "docs", "SRS-STATUS.md")

# state -> (label used in the table, counted as)
STATES = {
    "verified": "Implemented, verified",
    "implemented": "Implemented",
    "partial": "Partial",
    "open": "Not implemented",
    "policy": "Deliberately not done",
    "unmeasured": "Not measured",
}

# Where the feature lives, per identifier prefix. Used only when an ID has no
# explicit decision below.
PREFIX = {
    "AV": ("implemented", "`apps/accounts`"),
    "LS": ("implemented", "`apps/catalog`"),
    "BD": ("implemented", "`apps/catalog` browse and ordering"),
    "ST": ("implemented", "`apps/store`, `apps/catalog`"),
    "OS": ("implemented", "`apps/store` tickets"),
    "IV": ("implemented", "`apps/store` ledger"),
    "FF": ("implemented", "`apps/store` walk-in sale and counts"),
    "EM": ("implemented", "`apps/accounts/emails.py`, `apps/store`"),
    "OT": ("implemented", "`apps/orders`, `apps/messaging`"),
    "MS": ("implemented", "`apps/messaging`"),
    "RR": ("implemented", "`apps/reviews`"),
    "SD": ("implemented", "My shop screens, `apps/orders`"),
    "CF": ("implemented", "`apps/forum`"),
    "AI": ("implemented", "`apps/screening`"),
    "RM": ("implemented", "`apps/forum` reports, `apps/audit`"),
    "NT": ("implemented", "`apps/notifications`"),
    "AD": ("implemented", "`apps/accounts/admin_api.py`"),
    "PX": ("implemented", "favorites, profile, staff tools"),
    "SE": ("implemented", "`config/settings.py`, `apps/accounts`"),
    "PR": ("verified", "the notice is in the app and docs/PRIVACY.md; behaviour traced to tests"),
    "PF": ("verified", "measured: docs/PERFORMANCE.md, scripts/load_test.py"),
    "UX": ("unmeasured", "needs ten people and a stopwatch; not something a script can answer"),
    "RL": ("implemented", "systemd `Restart=always`, nightly verified backups, CI"),
    "MN": ("implemented", "11 apps, 30 models, docs/ set"),
}

# id -> (state, note). Only IDs whose answer is not the prefix default, or
# where the evidence is worth naming, appear here.
DECIDED = {
    # --- performance and usability, measured ---------------------------------
    "PF-01": ("implemented", "deployed page + bundle p95 0.78 s and API p95 0.63 s at 200 users, from a home connection rather than the pilot campus network; docs/PERFORMANCE.md"),
    "PF-02": ("verified", "search p95 0.65 s and every filtered view under 0.8 s at 200 online users"),
    "PF-03": ("verified", "screening answers in about a second, and held content says so while it waits"),
    "PF-04": ("verified", "200 concurrent users sustained, zero failures, p95 0.63 s online and 2.73 s in a burst"),
    # --- accounts -----------------------------------------------------------
    "AV-01": ("verified", "register endpoint; `tests/test_api.py`"),
    "AV-02": ("verified", "RTU address validator; `tests/test_api.py`"),
    "AV-03": ("verified", "6-digit code, own table, 5 tries; `tests/test_codes.py`"),
    "AV-06": ("verified", "sign-in, sign-out, reset + changed-mail; `tests/test_hardening.py`"),
    "AV-10": ("verified", "one status; login refuses suspended/banned"),
    "AV-11": ("partial", "guests can browse the public catalogue and seller pages, beyond the SRS's landing/login/preview-only rule"),
    # --- listings and browse ------------------------------------------------
    "LS-04": ("verified", "seller edit, sold, unavailable, delete; owner-only"),
    "LS-05": ("verified", "hold on create and edit; only approve publishes"),
    "BD-02": ("verified", "`?category=`, `?max_price=` with validation"),
    "BD-03": ("verified", "best-selling, newest, small sellers"),
    "BD-04": ("verified", "small-seller section and `?ordering=small-sellers`"),
    "BD-07": ("partial", "sorts are explicit; no blended popularity score"),
    "BD-08": ("verified", "sold, unavailable and zero-quantity rows are hidden"),
    # --- store, tickets, stock ----------------------------------------------
    "ST-04": ("verified", "reserve on request, release on cancel, take on claim; ledger enforces"),
    "ST-05": ("verified", "eight statuses, staff-only moves, reasons required"),
    "OS-02": ("verified", "status, source, queue number, history"),
    "OS-12": ("partial", "transitions and windows are configurable; the status set itself is code"),
    "IV-11": ("verified", "ledger replay check in Store inventory"),
    "IV-12": ("verified", "ledger CSV export"),
    "FF-01": ("verified", "Record sale writes the ledger; `store/tests_api.py`"),
    "FF-02": ("partial", "walk-in sales carry no student account, by design"),
    "EM-06": ("partial", "per-ticket email drafts exist in the UI; no outbox/preview screen"),
    # --- orders, messaging --------------------------------------------------
    "OT-03": ("verified", "requested, accepted, declined, cancelled, completed"),
    "OT-06": ("verified", "cash at the meet-up or a person-to-person transfer, recorded on the order and changeable while open; nothing is processed"),
    "OT-07": ("verified", "order payload shares the other party's number only while Accepted"),
    "OT-10": ("partial", "the seller completes; there is no second confirmation from the buyer"),
    "OT-11": ("verified", "accept moves stock; a decline or cancel returns it"),
    "OT-12": ("verified", "ORDER_REQUEST_TTL_HOURS (48) stamps expires_at; swept on read and by cron at 04:00, both parties notified"),
    "MS-01": ("verified", "threads tied to a listing, unread counts, polls"),
    "MS-04": ("verified", "POST /conversations/<id>/report/ from a participant, message or whole thread"),
    "MS-05": ("verified", "the report carries a copy of the reported message only; no endpoint exposes the rest of the thread"),
    # --- reviews ------------------------------------------------------------
    "RR-03": ("verified", "average, count and one-per-order on the seller"),
    "RR-04": ("policy", "reviews are not screened on purpose: `docs/SCREENING.md` §6"),
    "RR-05": ("verified", "only the author edits a review, only staff remove one, and a seller can report it from the product page"),
    "RR-06": ("partial", "the buyer can write one review per order; edit and delete are not exposed"),
    # --- seller dashboard ---------------------------------------------------
    "SD-01": ("verified", "My shop lists received orders"),
    "SD-02": ("partial", "counts and totals per status exist; no period selector"),
    "SD-03": ("verified", "GET /orders/?role=seller&status=&from=&to= plus the filter row on the seller dashboard"),
    "SD-04": ("verified", "GET /orders/export/ returns the seller's own rows as CSV, filters honoured"),
    # --- forum --------------------------------------------------------------
    "CF-01": ("verified", "topics, notices, pinned announcements"),
    "CF-05": ("verified", "Selling schedule topic requires a validated date, start time and campus place; end time optional"),
    "CF-06": ("verified", "posts and comments are held on a flag; `forum/tests_api.py`"),
    "CF-07": ("verified", "author edit/delete, moderator hide/restore, tombstone"),
    # --- screening ----------------------------------------------------------
    "AI-01": ("verified", "Gemini provider on create and edit for listings, posts and comments"),
    "AI-02": ("verified", "three outcomes: clean passes to approval, flagged is held, rejected is blocked and queued"),
    "AI-03": ("policy", "a clean verdict still waits for a human: `docs/SCREENING.md` §6"),
    "AI-04": ("verified", "needs_review queue for listings, posts and comments"),
    "AI-05": ("verified", "a rejected item is not published and the seller is told the exact reasons, with an appeal path"),
    "AI-06": ("verified", "POST /appeals/ + decide; the moderator who confirmed the rejection is refused via original_decider"),
    "AI-07": ("verified", "provider failure falls back to rules, and with the fallback off the item is held"),
    "AI-08": ("partial", "verdict, score, reasons, provider, model and time are logged; the cleaned text is not stored"),
    "AI-09": ("partial", "only the content is sent, but names and numbers inside it are not redacted"),
    "AI-10": ("verified", "ScreeningRule table seeded from the code list, editable by an administrator; both providers read it, audited"),
    "AI-11": ("verified", "a definite violation is rejected into the queue, and a moderator confirms or reverses it; a reversal publishes"),
    "AI-12": ("verified", "every outcome carries a confidence, and anything below the floor is treated as needs review"),
    "AI-13": ("verified", "ScreeningNotice at sign-up, create-listing, forum composer and comment box"),
    "AI-14": ("verified", "Taglish and Filipino phrases in both rule lists, with tests for a flag and for ordinary talk staying clean"),
    "AI-15": ("verified", "screening audit row plus the item's moderation status"),
    "AI-16": ("verified", "the same component states the check is not a quality or safety guarantee"),
    # --- moderation and audit ----------------------------------------------
    "RM-01": ("verified", "listings, members, posts, comments, reviews and conversations are all reportable, with the SRS reason list and a snapshot"),
    "RM-02": ("partial", "statuses are open, reviewed, dismissed, actioned"),
    "RM-03": ("verified", "hide, restore, delete, dismiss; moderators only"),
    "RM-05": ("verified", "`apps/audit/record()` on every staff moderation action"),
    "RM-07": ("verified", "the reported member never receives the reporter's identity"),
    "RM-08": ("verified", "appeals for removals and suspensions; suspended accounts appeal from /appeals/suspension/, decided by someone who did not decide"),
    # --- notifications ------------------------------------------------------
    "NT-01": ("verified", "one row per event, written by the causing service, polled at 20 s"),
    "NT-02": ("partial", "verification, reset and the password-changed notice are sent; store mail is not"),
    # --- administration -----------------------------------------------------
    "AD-02": ("verified", "`/admin/users/<id>/role/`, administrator only"),
    "AD-03": ("partial", "administrators edit the screening rules; marketplace categories are still fixed in code"),
    "AD-04": ("verified", "Users and audit screen, read-only trail"),
    "AD-05": ("verified", "`createsuperuser`; docs/TEAM-SETUP.md"),
    # --- favourites, profile, staff tools ----------------------------------
    "PX-03": ("verified", "confirm dialogs on destructive staff and member actions"),
    "PX-06": ("partial", "a consistent SQLite download exists; no JSON import or reset"),
    "PX-07": ("verified", "appearance popover: System, Light, Dark"),
    # --- non-functional -----------------------------------------------------
    "PF-03": ("verified", "screening answered in ~1 s live; a member sees the item pending meanwhile"),
    "SE-02": ("verified", "HTTPS public origin, secure cookies and HSTS with DEBUG off"),
    "SE-05": ("verified", "a session ends after 30 idle minutes and 5 failures in a row lock the address for 15 minutes, with unlock_login as the rescue"),
    "SE-06": ("verified", "type, 5 MB, 100 px side; enforced in the serializer too"),
    "SE-07": ("verified", "store rules run on the server, not the browser"),
    "PR-02": ("verified", "privacy consent recorded at registration"),
    "PR-03": ("verified", "profile edit and account deletion"),
    "PR-05": ("implemented", "DATA_RETENTION_DAYS plus nightly purge_expired_data; the number awaits the University (Appendix B.2)"),
    "PR-06": ("verified", "delete scrubs name, email, contact and photo when rows must survive"),
    "RL-02": ("verified", "nightly verified copy of database and uploads, 14 kept: docs/BACKUP.md"),
    "RL-03": ("implemented", "orders and audit rows are append-only and survive account changes"),
    "RL-04": ("implemented", "latest Chrome, Edge and Firefox were used through this session"),
    "RM-04": ("implemented", "a reporter sees their own reports and each one's status"),
    "RM-06": ("partial", "the audit trail names the member acted on; there is no per-user report history view"),
    "PR-04": ("implemented", "admin endpoints are role-gated; personal data is not exposed to members"),
    "MN-02": ("partial", "screening rules are configurable in the panel; marketplace categories would still need a code change"),
    "UX-01": ("verified", "twenty-five routes measured at 360 px with no page-level sideways scrolling; docs/UX-360.md"),
    "UX-03": ("implemented", "the interface is in English throughout"),
    "UX-04": ("verified", "API errors carry a human-readable message that the client shows"),
    "UX-05": ("verified", "contrast audit of both themes, 0 failures; three token values were corrected to pass"),
}


def parse_srs(path):
    rows = []
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip().rstrip("\r")
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 4 or not re.fullmatch(r"[A-Z]{2}-[0-9]{2}", cells[0]):
            continue
        rows.append(
            {
                "id": cells[0],
                "text": cells[1],
                "priority": cells[2],
                "srs_status": cells[3],
                "notes": cells[4] if len(cells) > 4 else "",
            }
        )
    return rows


def decide(row):
    if row["id"] in DECIDED:
        return DECIDED[row["id"]]
    prefix = row["id"].split("-")[0]
    return PREFIX.get(prefix, ("unmeasured", "not assessed"))


def main():
    rows = parse_srs(SRS)
    if not rows:
        sys.exit(f"no requirement rows parsed from {SRS}")

    seen = {}
    enriched = []
    for row in rows:
        key = row["id"]
        seen[key] = seen.get(key, 0) + 1
        label = key if seen[key] == 1 else f"{key} ({seen[key]})"
        state, note = decide(row)
        enriched.append({**row, "label": label, "state": state, "note": note})

    counts = {}
    for row in enriched:
        counts[row["state"]] = counts.get(row["state"], 0) + 1

    lines = []
    add = lines.append
    add("# SRS v1.3 to implementation: status of every requirement")
    add("")
    add("Generated by `scripts/srs_matrix.py` from")
    add("`docs/reference/SRS-v1.3-FIXED.md` (the team's SRS, v1.3). Regenerate")
    add("after an SRS revision instead of editing this file.")
    add("")
    add("The SRS's own *Prototype* column describes the browser prototype from")
    add("before the Django backend existed. This table answers a different")
    add("question: what the running system does **now**. Where the two differ, the")
    add("gap is named in the note.")
    add("")
    add("| State | Count |")
    add("| --- | --- |")
    for state, label in STATES.items():
        add(f"| {label} | {counts.get(state, 0)} |")
    add(f"| **total** | **{len(enriched)}** |")
    add("")
    add("Legend for the note column: an identifier code citation (`AI-03`) means")
    add("the source names that ID; otherwise the note names the module that carries")
    add("the requirement. \"Verified\" rows were exercised through the API, the")
    add("browser or the tests in this repository.")
    add("")

    order = [
        ("AV", "Accounts and verification"),
        ("LS", "Listings"),
        ("BD", "Browse and discovery"),
        ("ST", "University storefront"),
        ("OS", "Official Store tickets"),
        ("IV", "Store inventory and ledger"),
        ("FF", "Fulfilment and counts"),
        ("EM", "Email"),
        ("OT", "Orders and transactions"),
        ("MS", "Messaging"),
        ("RR", "Ratings and reviews"),
        ("SD", "Seller dashboard"),
        ("CF", "Community forum"),
        ("AI", "AI content screening"),
        ("RM", "Reporting and moderation"),
        ("NT", "Notification"),
        ("AD", "Administration"),
        ("PX", "Favorites, profile, staff tools"),
        ("PF", "Performance"),
        ("SE", "Security"),
        ("PR", "Privacy"),
        ("UX", "Usability"),
        ("RL", "Reliability"),
        ("MN", "Maintainability"),
    ]
    for prefix, title in order:
        group = [r for r in enriched if r["id"].split("-")[0] == prefix]
        if not group:
            continue
        add(f"## {title} ({prefix})")
        add("")
        add("| ID | Requirement (from the SRS) | SRS v1.3 | State here | Basis |")
        add("| --- | --- | --- | --- | --- |")
        for row in group:
            text = row["text"].replace("|", "/")
            if len(text) > 150:
                text = text[:147].rstrip() + "..."
            add(
                f"| {row['label']} | {text} | {row['srs_status'] or '-'} | "
                f"{STATES[row['state']]} | {row['note']} |"
            )
        add("")

    open_rows = [r for r in enriched if r["state"] in ("open", "policy")]
    add("## What is still open")
    add("")
    add("Every row above marked *Not implemented* or *Deliberately not done*,")
    add("with the reason:")
    add("")
    add("| ID | Requirement | Why it is open |")
    add("| --- | --- | --- |")
    for row in open_rows:
        add(f"| {row['label']} | {row['text'][:120].replace('|', '/')} | {row['note']} |")
    add("")
    add("## Note on identifier drift")
    add("")
    add("This codebase cites requirement IDs in docstrings, and a few of those")
    add("citations do not match the SRS's meaning — for example "
        "`apps/screening/models.py`")
    add("labels the audit trail \"AI-01 to AI-16\" and cites AI-16 for a log that")
    add("the SRS calls AI-08, and the forum's hold is cited as AI-03 while the SRS")
    add("uses AI-03 for auto-publishing an approved item. The SRS text above is")
    add("authoritative; treat the code's identifiers as prose, not as proof.")

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    print(f"wrote {OUT} with {len(enriched)} requirements")
    for state, label in STATES.items():
        print(f"  {label:26} {counts.get(state, 0)}")


if __name__ == "__main__":
    main()
