# RTU Tindahan — SRS v1.3 change and gap analysis

**Date:** November 2, 2026
**Prepared for:** Capstone team review
**Code baseline:** `main` at `966b358`
**New source:** [RTU TINDAHAN - Software Requirements Specifications V2.pdf](source/RTU%20TINDAHAN%20-%20Software%20Requirements%20Specifications%20V2.pdf)
**Highlighted copy:** [RTU-Tindahan-SRS-v1.3-highlighted.pdf](source/RTU-Tindahan-SRS-v1.3-highlighted.pdf)
**Fixed edition:** [RTU-Tindahan-SRS-v1.3-FIXED.md](RTU-Tindahan-SRS-v1.3-FIXED.md) · [fix log](SRS-v1.3-FIXES.md)

---

## 1. Executive summary

The November 1 SRS document was incomplete: it referenced sections
3.2.14–3.2.18 but did not contain them.

The new PDFs downloaded on November 2 contain the **full requirement set**. The
**highlighted PDF is the finalized v1.3**; the plain V2 PDF is content-complete
but internally mislabeled (see section 2). Together they include:

- 3.2.14 Official Store Tickets (`OS-01` to `OS-12`)
- 3.2.15 Official Store Stock (`IV-01` to `IV-14`)
- 3.2.16 Face to Face Entry, Order Sheet, Daily Count (`FF-01` to `FF-05`)
- 3.2.17 Email Preparation (`EM-01` to `EM-06`)
- 3.2.18 Other Prototype Features (`PX-01` to `PX-07`)
- New NFRs (`SE-07`, `SE-08`, `RL-05`, `MN-03`)
- New business rules (`BR-09` to `BR-14`)
- Appendix B (BAO / IT Office / University / Proponents decisions)
- Appendix C (prototype test record)
- Appendix D (changes from version 1.1)

The current backend already implements the **core** of the stock model:
tickets with `TXN-YYMMDD-NNN`, the six statuses, reserve → release → issue,
the append-only ledger, and daily-count adjustments. The large gaps are in
**policy configuration, ticket metadata, item types, per-item rules, low-stock
alerts, face-to-face sales, the order sheet, automatic email preparation, staff
pages, audit, and marketplace category alignment**.

One important ambiguity is now resolved: SRS v1.3 `ST-04` and `IV-06` say stock
is **reserved when the request is made, released when cancelled, and issued when
claimed**. That is exactly what the current `apps.store.services` does.

---

## 2. Completeness check

| Item | Oct 31 docx | Nov 2 V2 PDF |
| --- | --- | --- |
| Sections 3.2.14–3.2.18 | referenced, missing | present |
| Appendix C | referenced, missing | present |
| Appendix D | missing | present |
| Unique requirement IDs detected | 134 | 187 |
| Official Store ticket IDs (`OS-`) | 0 | 12 |
| Stock IDs (`IV-`) | 0 | 14 |
| Face-to-face / order sheet IDs (`FF-`) | 0 | 5 |
| Email IDs (`EM-`) | 0 | 6 |
| Prototype-feature IDs (`PX-`) | 0 | 7 |

`OS-02` appears in the plain V2 as **`0S-02`** (zero instead of the letter O).
The document should fix that typo. With it, the intended total is 188 IDs.
The highlighted PDF has the same requirement set; its IDs wrap across table
cells, so an automated regex undercounts them.

### V2 PDF vs highlighted PDF

| Item | Plain V2 PDF | Highlighted PDF |
| --- | --- | --- |
| Pages | 64 | 55 |
| Cover | Version 2 | Version 1.3 |
| Document info and body | Version 1.2 | Version 1.3 |
| Section headings | "added in 1.2" | "new in 1.3" |
| Table of contents | stale; omits 1.6, 1.7, 3.2.14–18, A.6, Appendix C/D | complete |
| A.6 section | referenced but absent | present |
| `OS-02` | printed as `0S-02` | ID wraps across the table cell |
| Requirement content | complete | complete |

Use the **highlighted PDF** for review and citation. The plain V2 is still useful
for automated text extraction because all 187 IDs appear on single lines.

### Other document inconsistencies

- Revision history jumps 1.0 → 1.1 → 1.3; there is no 1.2 row, even though the
  plain V2 uses the 1.2 label throughout.
- Appendix B.4 asks the proponents to add the missing 1.2 row and merge the
  old Appendix B items.
- `AV-03` says a verification **link**, while its own note says the prototype
  uses a **6-digit code**.

---

## 3. New requirement groups

### 3.1 Official Store tickets — `OS-01` to `OS-12`

| ID | Requirement in short | Current code |
| --- | --- | --- |
| OS-01 | Permanent `TXN-YYMMDD-NNN` reference, never changes | ✅ generated, unique, read-only in admin; no hard immutability guard |
| OS-02 | Status, source (online / in person), optional queue number, pickup date, staff note, full history (old, new, who, when, note) | 🟡 status/history/pickup/claim notes exist; **source, queue number, staff note missing** |
| OS-03 | Six statuses and the default transition table | ✅ implemented in `services.TRANSITIONS`; ❌ not editable |
| OS-04 | Reason required for On Hold and Cancelled | ✅ |
| OS-05 | Only staff change status; write to history **and audit log**; notify the student | 🟡 status change is staff-only by convention; ❌ audit log and notification |
| OS-06 | Student progress bar, On Hold/Cancelled marker, pickup date, claim notes | 🟡 backend fields exist; ❌ UI |
| OS-07 | Users see/cancel only their own tickets, only from staff-allowed statuses | 🟡 no API; `StoreSetting.cancel_from` exists but is not enforced |
| OS-08 | Optional daily queue number, off by default, configurable format | ❌ |
| OS-09 | Staff Store orders page: filters, overview, detail, print, CSV | ❌ (Django admin only) |
| OS-10 | Claim notes, store-wide and per item, editable, empty until BAO supplies wording | 🟡 ticket claim note exists; ❌ store/item settings |
| OS-11 | Upgrade older official requests without deleting or renaming | ❌ no legacy import (N/A for a fresh DB; needed if old data exists) |
| OS-12 | Staff edit transitions, reason statuses, cancel statuses, queue settings, claim note | 🟡 only limits, window, low-stock threshold, cancel list |

**Default transitions from the SRS:**

```
Request Received → Confirmed, On Hold, Cancelled
Confirmed        → Ready for Pickup, On Hold, Cancelled
On Hold          → Confirmed, Ready for Pickup, Cancelled
Ready for Pickup → Claimed, On Hold, Cancelled
Claimed          → none
Cancelled        → none
```

These match the current service.

### 3.2 Stock — `IV-01` to `IV-14`

| ID | Requirement in short | Current code |
| --- | --- | --- |
| IV-01 | On Hand, Reserved, Available per item and size; Available = On Hand − Reserved | ✅ `ListingVariant.on_hand`, `available`, `reserved` |
| IV-02 | Ledger row: type, item, size, quantity, change in On Hand, change in Reserved, resulting balance, ticket, reason, user, timestamp | 🟡 `StockMovement` stores kind, quantity, snapshots, ticket, reason, user, time; **explicit on-hand/reserved deltas missing** (derivable) |
| IV-03 | Six ledger types with the specified effects | ✅ all six kinds implemented; `Sold` has no service yet |
| IV-04 | Stock only through the ledger; refuse negatives; multi-line request all-or-nothing | ✅ admin stock read-only; `transaction.atomic` in services |
| IV-05 | Only staff add Stock In or Adjustment; adjustment needs a reason | 🟡 `stock_in` command checks staff; `record_daily_count` does not check the role (API layer must) |
| IV-06 | Reserve on request, release on cancel, issue on claim | ✅ |
| IV-07 | Item types: Sablay, Book, Uniform, Merchandise, Other; tabs; mapping to category | ❌ |
| IV-08 | Per-item/per-size low-stock level; warn staff once in app; prepare low-stock email | 🟡 `is_low_stock` property only; no warning, no email |
| IV-09 | Ordering window store-wide **and per item**, with message | 🟡 store-wide only |
| IV-10 | Limit per student store-wide **and per item**; 0 = none; **claimed tickets count** | 🟡 store-wide limit exists but **excludes claimed tickets**; per-item limit missing |
| IV-11 | Ledger replay check against stock and open tickets, report anomalies | ❌ |
| IV-12 | Export ledger as CSV | ❌ |
| IV-13 | Cannot remove official item while it has open tickets | ❌ no explicit guard |
| IV-14 | Upgrade existing stock: opening Stock In, open tickets Reserved, marked migrated | ❌ (N/A on a fresh DB) |

**Ledger effects (from the SRS):**

| Type | On Hand | Reserved | When |
| --- | --- | --- | --- |
| Stock In | +q | — | Staff add stock |
| Reserved | — | +q | Student request |
| Released | — | −q | Ticket cancelled |
| Issued | −q | −q | Ticket claimed |
| Sold | −q | — | Face-to-face sale |
| Adjustment | ±q | — | Correction or daily count |

The current implementation matches these effects. `Sold` exists as a kind but
has no caller.

### 3.3 Face to face, order sheet, daily count — `FF-01` to `FF-05`

| ID | Requirement in short | Current code |
| --- | --- | --- |
| FF-01 | Walk-in sale with items/sizes/quantities; ticket source Face to face, status Claimed; take stock out as `Sold`; `FTF-YYMMDD-NNN` reference; reverse with Adjustment if ticket creation fails | ❌ |
| FF-02 | Link a face-to-face sale to a student account by email or student number; check the student limit but not the ordering window | ❌ |
| FF-03 | Compiled order sheet of open online tickets, grouped by item/size, requested vs On Hand/Reserved/Available/Shortage + references; exclude claimed, cancelled, face-to-face | ❌ |
| FF-04 | Shortage = requested − On Hand, never below zero | ❌ |
| FF-05 | Daily count per item/size; difference needs a reason; write `Adjustment` named `Daily count R-000N`; refuse a count below Reserved | 🟡 core implemented with reason and adjustment; ❌ `R-000N` naming; the "below Reserved" rule is enforced indirectly (available would go negative) |

### 3.4 Email — `EM-01` to `EM-06`

| ID | Requirement in short | Current code |
| --- | --- | --- |
| EM-01 | Prepare a message for every ticket status and every low stock; put it in the outbox | 🟡 model + `prepare_email` helper; ❌ automatic preparation |
| EM-02 | Student messages only to an RTU address; otherwise mark Skipped | 🟡 `recipients` exists; ❌ skip logic |
| EM-03 | Student message holds reference, queue number, status, items, pickup date, claim notes; no student number, name, or payment link; say it is automatic | 🟡 no template |
| EM-04 | Low-stock message to staff addresses from settings; none → Skipped | ❌ |
| EM-05 | Never send from the browser; sending switch off and locked until IT decisions; no provider/address/secret in frontend | ✅ no sending code; ✅ no frontend secrets |
| EM-06 | Staff view outbox, preview each message, export as JSON | 🟡 admin read-only view; ❌ preview/export |

The `docs/EMAIL_INTEGRATION.md` in prototype v1.6 remains the reference for the
IT Office decisions.

### 3.5 Other prototype features — `PX-01` to `PX-07`

| ID | Requirement in short | Current code |
| --- | --- | --- |
| PX-01 | Favorites for products and sellers, Favorites page | ❌ |
| PX-02 | Profile picture upload, replace, remove; shown across the app | 🟡 `profile_photo` field; ❌ upload API/UI |
| PX-03 | Cancel/Confirm dialog + toast before critical actions | ❌ (frontend) |
| PX-04 | Staff Transactions page with TXN id, items, quantity, total, buyer, seller, date, status, history; search, filter, CSV | ❌ |
| PX-05 | Staff user and audit page: manage accounts, remove/restore listings, hide items, read audit log | 🟡 Django admin user management; ❌ audit log and listing actions |
| PX-06 | JSON backup, import, reset (prototype only; production uses database backups) | ❌ |
| PX-07 | Light and dark theme | ❌ (frontend) |

### 3.6 New quality requirements and business rules

| ID | Requirement in short | Current code |
| --- | --- | --- |
| SE-05 | 30-minute idle timeout; 5 failed logins → 15-minute account lock | 🟡 30-minute session ✅; ❌ lockout (only a 5/min throttle) |
| SE-07 | Every Official Store protection repeated on the server | 🟡 services enforce stock/transitions; ❌ no API role enforcement yet |
| SE-08 | No email key, password, or provider secret in frontend | ✅ |
| RL-05 | Stock counts always agree with the ledger and open tickets | 🟡 core ledger; ❌ replay check |
| MN-03 | Upgrades repeatable, keep TXN references/history, delete nothing | 🟡 additive migrations; ❌ explicit upgrade command/checks |
| BR-09 | Official stock changes only through the ledger, with a reason or ticket | ✅ |
| BR-10 | TXN reference never changes; upgrades never delete or rename | 🟡 generated once; no hard guard |
| BR-11 | Every store rule is a proposal until BAO verifies it, editable without code | 🟡 partial (limits/window/cancel list) |
| BR-12 | Official Store emails not sent until IT decisions; no student number, name, or payment link | ✅ prepared only |
| BR-13 | Only staff admin change ticket status or stock | 🟡 no API; services do not check the role |
| BR-14 | Face-to-face sale counts toward the limit but is not blocked by the window | ❌ face-to-face not implemented |

---

## 4. Existing requirements that changed and affect the code

| ID | Change in v1.3 | Impact |
| --- | --- | --- |
| AV-03 | Requirement says a verification **link**; note says the prototype uses a **6-digit code**, 5-minute expiry, 5 tries, resend every 30 seconds | Current backend uses a link. Decide which behavior is the system of record. |
| AV-10 | Active / Suspended / Banned; prototype creates the account only after the code is confirmed | Current backend creates an unverified Visitor row at registration and blocks login. Review whether this is acceptable. |
| AV-11 | Guests see landing, registration, login, and a **preview of RTU merchandise** | ❌ no guest preview endpoints. |
| LS-01 | Services have **no condition or quantity**; products may have **up to two variation options**; seller can set time windows/days | 🟡 service condition is enforced as Not applicable, but quantity is still required; no two-option rule; no time-window fields. |
| LS-02 | **New category list**: Books and Academic Materials; School Supplies; RTU Merchandise; Clothing and Accessories; Knickknacks and Collectibles; Electronics and Gadgets; Food and Snacks; Other Items; Services. Clothing has a Uniform type; Books has Textbook, Manual, Reviewer or notes. | ❌ current `seed_categories` uses the old v1.1 list. This is the most immediate code mismatch. |
| LS-04 | A listing with an open order cannot be deleted | ❌ no guard. |
| LS-05 | Staff approval replaces AI screening in the prototype; approve/reject with a note | 🟡 listing status fields exist; ❌ approval flow. |
| ST-04 | Reserve on request, release on cancel, issue on claim | ✅ current implementation matches. |
| ST-05 | Six ticket statuses, staff updates, date/time recorded, buyer sees current status | ✅ backend; ❌ UI. |
| ST-06 | Buyer can cancel an official order only from statuses staff allow; default Request Received | 🟡 `StoreSetting.cancel_from`; ❌ enforcement/API. |
| NT-02 | Official Store emails are allowed once the IT Office approves | ✅ nothing is sent yet. |
| PR-06 | Account deletion removes personal data; order records and reviews remain without the name | ❌ no deletion/anonymization flow. |
| RM-08 | Appeal of a moderator's removal, warning, or suspension, decided by another administrator | ❌ outside the store scope. |
| AD-05 | First administrator created at setup; administrators can grant the role | 🟡 seeder/createsuperuser; role changes via Django admin, not a dedicated flow. |

---

## 5. What is already aligned

These are worth keeping as-is while the rest is extended:

- `TXN-YYMMDD-NNN` reference generation.
- The six status names and the default transition graph.
- Reason required for On Hold and Cancelled.
- Reserve → release → issue stock behavior (matches `ST-04` and `IV-06`).
- The six ledger movement types and their effects.
- Stock fields read-only in admin; all changes through services/ledger.
- Atomic multi-line orders and negative-stock refusal.
- Daily count with a reason and an adjustment row.
- No email provider, address, or credential in the frontend; nothing is sent.
- 54 passing tests (accounts, catalog, store).

---

## 6. Gap summary by priority

### P0 — correct the existing catalogue

1. **Replace the category seed with the LS-02 list** and add sub-types:
   - Books and Academic Materials → Textbook, Manual, Reviewer or Notes
   - Clothing and Accessories → Uniform
2. **Write a data migration** mapping old categories to new ones:
   - Food and Snacks → Food and Snacks
   - Uniforms → Clothing and Accessories (Uniform)
   - Books, Modules, and School Supplies → Books and Academic Materials + School Supplies
   - Merchandise, Clothes, Accessories, and Gadgets → RTU Merchandise / Clothing and Accessories / Electronics and Gadgets / Knickknacks and Collectibles
   - Services → Services
   - Other → Other Items
3. **LS-01 service rules**: no condition or quantity for services; products may have at most two variation options.
4. **LS-05 staff approval**: approve/reject a listing with a note; price/quantity edits publish immediately.

### P1 — align the Official Store with OS/IV

5. Add `OfficialTicket.source` (`online` / `face_to_face`), `queue_number`, `staff_note`.
6. Move transitions, reason-required statuses, student-cancel statuses, queue settings, and claim notes into `StoreSetting` (editable, no code changes).
7. Add `Listing.item_type` (Sablay, Book, Uniform, Merchandise, Other) and the category mapping.
8. Add per-item ordering windows and limits; fix the per-student limit to count **all tickets that are not cancelled, including claimed**.
9. Add low-stock warning (once) and automatic low-stock email preparation.
10. Add ledger replay check and CSV export.
11. Block removal of an official item while it has open tickets.
12. Add explicit `on_hand_delta` and `reserved_delta` fields to `StockMovement` (IV-02) or document the derivation.

### P2 — API, audit, notifications, staff pages

13. Store API: create ticket, my tickets, staff status changes, stock-in, daily count, outbox.
14. Enforce Office Staff in the API; repeat every service rule server-side (SE-07).
15. Add an audit log for ticket, stock, and policy changes (OS-05, RM-05, AD-04).
16. Add in-app notifications for status changes, screening, reports, and warnings.
17. Staff Store orders page: filters, overview, detail, print, CSV (OS-09).
18. Outbox preview and JSON export (EM-06).

### P3 — face to face and email automation

19. Face-to-face sale with `FTF-YYMMDD-NNN`, `Sold` movement, and reversal on failure (FF-01).
20. Link a face-to-face sale to a student account and apply the limit but not the window (FF-02).
21. Compiled order sheet and shortage calculation (FF-03/04).
22. Daily count `R-000N` reference and the "count below Reserved" rule (FF-05).
23. Automatic email preparation for every status and low stock; skip non-RTU addresses; no PII (EM-01–EM-04).

### P4 — broader SRS items

24. Guest preview of RTU merchandise (AV-11).
25. Verification link vs 6-digit code decision (AV-03); account-state semantics (AV-10).
26. Login lockout after 5 failures (SE-05).
27. Account deletion and anonymization (PR-06).
28. Favorites, profile-picture upload, transactions page, user/audit page, backup/reset, themes (PX-01–PX-07).
29. Moderator-action appeals (RM-08).

---

## 7. Decisions the BAO and IT Office still owe

From Appendix B of the SRS:

**BAO (13):** status names/order, student cancellation statuses, whether On Hold
keeps stock, definitions of On Hand/Reserved/Available, Issued vs Sold, item
types and category mapping (including Sablay), windows and per-student limit
scope/period, face-to-face status and whether the window applies, queue number
format, claim-note wording, daily-count schedule, low-stock levels and
recipients, item information/sizes/stock rules.

**IT Office (8):** mail service, sender address/name, server and secret holder,
sending limits/SPF/DKIM/DMARC, DPO review, bounce handling, wording sign-off,
keep or replace the EmailJS sign-up mailer, and server-side login, hashing,
roles, and repeated store-rule checks.

**University (3):** footer contact/privacy/terms, retention period, LLM service
and written screening rules.

**Proponents (4):** add the missing 1.2 revision row; merge the old Appendix B
items; keep the SRS version consistent.

---

## 8. Suggested delivery plan

| Sprint | Scope |
| --- | --- |
| **3A** | Catalogue alignment: LS-02 categories + migration, LS-01 service/variation rules, LS-05 staff approval. |
| **3B** | Store alignment: OS-02 fields, OS-12 editable policy, IV-07 item types, IV-09/10 per-item rules, IV-08 low stock, IV-11/12 checks/export, IV-13 guard. |
| **4** | Store API, audit log, notifications, staff orders page. |
| **5** | FF-01–FF-05 face-to-face and order sheet; EM-01–EM-06 email preparation and outbox UI. |
| **6** | PX features, frontend integration, SRS/lockout/deletion items, ISO 25010 testing. |

This order keeps the working stock core intact and makes each sprint demoable.

---

## 9. How this analysis was produced

```bash
pdftotext -layout "source/RTU TINDAHAN - Software Requirements Specifications V2.pdf" new_v2.txt
pdftotext -layout "source/RTU-Tindahan-SRS-v1.3-highlighted.pdf" highlighted.txt
```

Requirement IDs were extracted with:

```python
import re
ids = sorted(set(re.findall(r"\b[A-Z]{2,3}-\d{2}\b", text)))
```

The comparison baseline is the October 31 docx previously in
`CapStone/Latest/.../Papers/RTU TINDAHAN - Software Requirements Specifications V2.docx`.

The plain V2 PDF was used for the ID counts (187 on single lines). The highlighted
PDF was checked separately: its IDs wrap across table cells, so a regex undercounts
them, but it contains the same sections and adds A.6. Use the highlighted PDF as the
final v1.3 document of record.

---

## 10. Bottom line

- The new SRS is the **complete v1.3**; the earlier file was not.
- The current backend is **correct on the core stock flow** and does not need a
  rewrite.
- The next work is **alignment, not redesign**: categories, service/variation
  rules, staff approval, editable store policy, ticket metadata, item types,
  per-item rules, low-stock alerts, ledger checks, face-to-face sales, the order
  sheet, audit/notifications, and email preparation.
- The most urgent mismatch is **LS-02**: the seeded categories no longer match
  the approved list.
