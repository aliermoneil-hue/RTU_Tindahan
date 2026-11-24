# Screening rules an administrator owns (AI-10)

The list of things the automatic check looks for used to live in
`apps/screening/providers.py`. That meant a seller could find a phrasing nobody
had written down, and closing the gap took a code change, a test run and a
release. It lives in a table now, and an administrator edits it on the screen.

## Two kinds, because they behave differently

| Kind | Effect on a verdict |
| --- | --- |
| `prohibited` | A hit alone scores 90 — enough to hold a listing, post or comment for review. |
| `scam` | A hit scores 85 and applies only to listing text: a pay-first or off-app contact pattern. |

## Where the terms come from, and what happens if the table is empty

The code's original tuples — `PROHIBITED_TERMS` and `SCAM_PATTERNS` — are both
the seed and the floor:

- `screening/migrations/0005_seed_screening_rules.py` copies them into the table,
  so the starting point is exactly the screening the platform already had;
- `apps/screening/rules.py` reads the active rows through a 60-second cache. If
  the table is empty, unreadable, or half-migrated, it falls back to the code
  lists — screening never silently stops working because a row went missing.

Every save or delete clears the cache, so an edit is live on the **next item
screened**, not on the next minute.

## Filipino and Taglish (AI-14)

The lists carry the offers as they are typed on this campus, not only the English:
`may answer key ako`, `sagot ko exam mo`, `sasagutan ko exam mo`, `gagawa ako ng
assignment mo`, `peke na school id` on the prohibited side, and `bayad muna`,
`bayad bago meetup`, `gcash muna`, `mag send ka ng gcash`, `downpayment muna` on
the scam side.

They are written as **phrases, not single words**, on purpose: `sagot` alone means
"answer" in ordinary conversation, and a rule that fires on it would bury the
moderator queue. The tests assert both directions — a Taglish answer-key listing
flags at 90, and "Maganda pa ang calculator, may case at manual. Meetup sa main
lobby, bayad pag meetup." comes back clean.

Migration `0006_seed_taglish_rules.py` copies them into the table for a database
seeded before this change; `get_or_create` keeps an administrator's own note if
the phrase was already there.

## The language model is told the same list

`GeminiProvider._payload` appends the current phrases to its instruction:

    The current prohibited terms, maintained by the administrator: …
    The current scam patterns, maintained by the administrator: …

So an administrator's edit changes what the model is asked to look for, without
touching the prose that frames the task.

## Who may change it

- **Administrators** add, edit, switch off and remove phrases.
- **Moderators** may read the list — they work the queue it produces.
- **Members** see nothing of it.

Every write is audited: `screening rule added`, `screening rule changed` (with
`before -> after` and the active state), `screening rule removed`.

The list is returned whole, not paginated: a screen that shows 20 of 50 phrases is
a screen that lies about what the check looks for.

## The screen

**Screening rules** in the staff sidebar: two tabs (prohibited, scam patterns), an
add row with the phrase and an optional reason, a live count, and switch-off /
remove on every row.

## Tests

`apps/screening/tests.py`, 11 cases in `ScreeningRuleTableTests`: the table starts
from the code list; a new phrase flags the next listing; switching a phrase off
stops it flagging; an edit reaches the language model's payload; a member cannot
read or change anything; a moderator may read but not write; every change is
audited; a duplicate phrase is refused; an empty table falls back to the code
list; and the whole list comes back in one page.
