# Reporting a conversation (MS-04, MS-05)

A private conversation is the one place on the platform that was never
moderated, because reading it to find a problem means reading everything in it.
These two requirements settle that with a narrow door.

## MS-04 — a participant may report

The people in a thread, and nobody else, can report it: `POST
/api/v1/conversations/<id>/report/` with a `reason` from the fixed list — harass-
ment, scam, payment outside the platform, prohibited item, spam, something else —
plus an optional note, and optionally one `message` id to point at. Reporting a
message you wrote yourself is refused, and so is a second open report about the
same message.

On screen, the thread carries a **Report** button in its header and a **Report
this message** link under every incoming message. Both open the same small panel:
the reason, an optional note, send.

## MS-05 — a moderator sees only what was reported

This is the part that had to be built carefully. A report row carries:

- who reported it and who it is against;
- the reporter's own words (`details`);
- `reported_messages` — one entry: the text of the message the report names,
  **copied when the report was filed** (`snapshot_body`, `snapshot_at`). A copy,
  not a join: a later edit or delete cannot change what the moderator reviews, and
  the serializer never selects another message of the conversation.

There is no endpoint, and no serializer, that hands a moderator a reported
thread's other messages. When the whole thread is reported rather than one
message, `reported_messages` is empty by design and the moderator reads the
reporter's description — the thread itself stays closed.

The queue is `GET /api/v1/message-reports/?status=open`; a member only ever sees
the reports they filed.

## The decision

`POST /api/v1/message-reports/<id>/resolve/` with `action` of `dismiss`, `warn` or
`suspend`, and a `note`. A dismissal needs no note; a warning or a suspension
does, because that sentence is what the sender is told. Every decision writes an
audit entry (`conversation.report.<action>`), tells the reporter whether action
was taken, and — only when there is a warning or a suspension — tells the sender
what was decided and why.

## Who is not told what

- The person reported is **not** told a report exists when it is filed: naming it
  invites retaliation, and RM-07 makes the reporter's identity the thing to
  protect.
- The reporter is **not** named to the person reported, ever.
- The reporter cannot decide their own report.

## Tests

`apps/messaging/tests_api.py`, 14 cases: a participant reports one message; a
non-participant cannot; you cannot report your own message; the same message
cannot be reported twice while open; the queue holds only the reported message
and not the rest of the thread; the reported person sees no report; the sender is
told nothing until a warning is issued; a warning marks the report actioned and
audits it; a dismissal closes quietly; a suspension takes the account out; a
member cannot handle a report; the reporter cannot decide their own; and a
whole-thread report carries no message text.
