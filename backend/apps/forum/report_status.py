"""One vocabulary for report statuses, for both kinds of report (RM-02).

The SRS names three: Received, Under Review, Resolved. The four words this
platform used before — open, reviewed, dismissed, actioned — still arrive from
clients and saved links, so they are translated here rather than refused: a
bookmark that says `?status=open` should still show the incoming reports.
"""

STATUSES = ("received", "under_review", "resolved")
RESOLUTIONS = ("actioned", "dismissed")

ALIASES = {
    "open": "received",
    "reviewed": "under_review",
    "dismissed": "resolved",
    "actioned": "resolved",
}

# A legacy word that also settles the outcome.
LEGACY_RESOLUTION = {
    "dismissed": "dismissed",
    "actioned": "actioned",
}


def normalize_status(value: str) -> str:
    """Map any accepted word onto the three the SRS names. Unknown words pass through."""
    text = (value or "").strip()
    return ALIASES.get(text, text)


def normalize_resolution(value: str) -> str:
    return (value or "").strip()
