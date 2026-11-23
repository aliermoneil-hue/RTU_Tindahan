# Posting and selling guideline (working copy)

This is the team's working summary of
`RTU_Tindahan_Posting_and_Selling_Guideline.pdf`, kept in Markdown so the rules
can be reviewed in a diff and checked against the code. The PDF in the CapStone
papers folder remains the document submitted to the panel; this file is how the
system follows it.

Every rule below names where it is enforced. When the guideline and the code
disagree, the guideline wins — change the code, then change this file.

---

## 1. What may be sold

Allowed on RTU Tindahan:

- Second-hand school items: books, calculators, uniforms, PE clothes, lab gowns,
  drafting tools, art materials.
- Student-made items: food, pastries, reviewers, digital templates, crafts.
- Services between students: tutoring, commissions, printing, editing.
- Official RTU merchandise, sold only through the Official Store.

Never allowed:

| Category | Examples |
| --- | --- |
| Counterfeit, fake, or pirated goods | "Replica RTU uniform", pirated software, fake IDs |
| Exam answers, answer keys, leaked exams | Midterm answer keys, quiz answers |
| Weapons or ammunition | Firearms, ammunition |
| Illegal drugs | Shabu, marijuana, cocaine |
| Vapes, e-cigarettes, tobacco, and alcohol | Vape kits, pods, beer, liquor |
| Medicines, prescription or not | Antibiotics, prescription drugs |
| Gambling or betting items | Jueteng, sabong, casino chips |
| Stolen goods | Items the seller cannot prove are theirs |
| Another person's ID or personal details | Fake student IDs, other students' data |
| Resold event tickets without permission | Concert or university event tickets |
| Sexual or offensive content, or harassment | Nude photos, abusive text |
| Help that is academic cheating | "Do my homework", thesis for hire |

Enforced in `PROHIBITED_TERMS` and the Gemini instruction in
`backend/apps/screening/providers.py`. A hit scores 90, which is above the flag
threshold.

---

## 2. Before posting

Checklist for a seller (shown on the Create Listing page):

1. The item is yours and you can prove you own it.
2. It is not on the "cannot sell" list.
3. It is a real item on a campus. No pre-orders from online shops.
4. The photos show the actual item — current, clear, yours.
5. The description is honest about wear, missing parts, and the real price.
6. You read the meetup rules.
7. The guidelines box is ticked.

The box is enforced in the browser (`draft.agree` in
`frontend/src/features/marketplace/pages/CreateListingPage.tsx`). The API does
not record the tick; the screening and moderation steps are what actually hold
the seller to the rules.

---

## 3. Photos and description

| Rule | Enforced |
| --- | --- |
| 1–10 photos | Maximum: `PhotoListField` `max_length=10` in `apps/catalog/serializers.py` |
| JPG, PNG, or WebP | `PHOTO_TYPES` + `FileExtensionValidator` |
| Under 5 MB each | `validate_image_size` and `PhotoListField` |
| At least 100 × 100 pixels | `validate_image_size` (model and API) |
| Description at least 20 characters | Screening rule, score 55 |
| Price at ₱50,000 or below | Screening rule, score 55 |
| No external links | Screening rule, score 60 |
| No off-app contact or payment | Screening rule, score 85 |

The description guidance (write 3–5 clear sentences, include size, brand,
condition, and the reason for selling) is advice, not a rule; only the length
minimum is enforced.

At least one photo is asked for but not required by the API: the demo catalogue
carries photo-less rows labelled "No photo yet", and the guideline's "1 to 10"
is enforced as a maximum of 10.

---

## 4. Screening signals and the threshold

The guideline asks for a score from 0 to 100, with 50 or above flagged and a
statement for the moderator:

| Signal | Score | Notes |
| --- | --- | --- |
| A word matching the new "cannot sell" list | 90 | Banned word in title or description |
| Scam pattern: pay-first, no meetup, off-app contact/payment | 85 | Includes Philippine mobile numbers |
| A web link in the text | 60 | Listings carry no external links |
| Description under 20 characters | 55 | Not enough to judge |
| Price above ₱50,000 | 55 | Far outside a campus resale |
| Title in all capitals, over 12 characters | 40 | Spam shape; alone it does not flag |

`FLAG_THRESHOLD = 50`. A flagged listing moves to `needs_review` and waits for
a moderator. Screening never publishes anything: a clean score still waits for
approval. Details in `SCREENING.md`.

The deterministic rules provider and the Gemini instruction implement the same
list, so a provider failure changes the wording of the reasons, not the policy.
A live check on this project's database:

    vape starter kit            -> flagged, 100, gemini
    "Pay first via GCash ..."   -> flagged,  95, gemini
    "Shoes."                    -> flagged,  50, gemini
    ₱52,000 laptop              -> flagged,  55, gemini+fallback
    calculator, food listing    -> clean,     0, gemini
    99 × 99 photo               -> HTTP 400 "at least 100 x 100 pixels"

---

## 5. What is policy, not code

These parts of the guideline are promises the system makes to the user but
cannot fully verify by itself:

- The seller owns the item and can prove it.
- The item really is on campus.
- The photos are current and show the actual item.
- Meetups happen in public, well-lit campus places (Main Gate, Lobby, Guard
  House, Food Court, Library Entrance); no meetups at home or off campus, and
  no advance payment or deposit.
- Office Staff are the final approvers; the guideline's Section 1 boundary is
  what the screening step and the moderator queue enforce.

Screening and moderation enforce the written rules; the rest is trust, review,
and the report path.
