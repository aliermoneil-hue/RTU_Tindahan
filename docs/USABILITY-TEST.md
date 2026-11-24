# Usability test for UX-02

The requirement, word for word:

> **UX-02** — In a test with 10 new users, at least 8 shall post a listing within 5
> minutes without instructions.

This is the only requirement in the SRS that no amount of code can answer. It needs
ten people who have never seen the app, a stopwatch, and twenty minutes. This sheet
is the whole procedure: say the same four sentences to everybody, record one number
per person, and the result writes itself.

---

## Before you start (5 minutes)

1. **Pick ten people who have not used Tindahan.** Classmates from another block,
   a dorm mate, a cousin — anyone who is not in the group and has not watched a demo.
   Ten is the requirement; a seventh or eighth person is a spare.
2. **Have ten RTU emails ready** that can receive the verification code, or let them
   use their own. One saved email per tester on a sheet of paper speeds the flow but
   is optional.
3. **Set the phone or laptop up yourself** to the sign-in screen
   (`https://rtu-tindahan-nine.vercel.app`) and hand it over already open. Do not
   log anyone in for them.
4. **The item each person posts**: say *"sell this"* and show a physical object you
   brought — a ballpen, a notebook, a calculator. Same object for everyone keeps the
   task equal. Have one photo of it ready in the phone's gallery, because a listing
   with a photo is the real flow.
5. **Two people run the test.** One talks to the participant and holds the phone;
   the other keeps time and writes. Never more than one person giving hints.

## What you say (and nothing more)

Exactly these sentences, in this order. If they ask how, the answer is **"just do
what you would do"**. That is the whole point of the requirement.

> 1. "Thanks for helping. This is a school project — a marketplace for RTU.
>    Nothing you do is graded and nothing is public."
> 2. "Your task is to sell this pen on the app. You have five minutes."
> 3. "I cannot answer questions about how, but tell me out loud if you get stuck
>    and I'll write it down."
> 4. "Start now."

Do **not** say "sign up first", "tap the plus button", "you need to verify your
email", or anything else that names a step. Those are the instructions the
requirement exists to remove.

## What you record

One row per person, filled in as it happens:

| # | Name (or T1…T10) | Started | Posted (time) | Minutes | Reached the listing form? | Stuck where (their words) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  | yes / no |  |
| 2 |  |  |  |  | yes / no |  |
| … |  |  |  |  | yes / no |  |

**"Posted" means what?** The listing exists and shows the seller's own "waiting for
approval" state — i.e. they pressed the final button and the app accepted it.
Screening and moderator approval are not part of the task; a listing that is held
for review still counts as posted, because the person did what was asked. Note it
if the item was held, so the group can explain why afterwards.

**When the clock starts:** when you finish sentence 4. **When it stops:** when they
say they are done, or at five minutes, whichever comes first.

**Help allowed:** none. If a person is completely stuck at four minutes, you may
say *"try the menu"* — once per person — and mark the row "helped", which does not
count as a success even if they finish.

## After each person (1 minute)

Ask two questions and write the answers verbatim:

> "What was the hardest part?"
> "Was there anything you expected to see that was not there?"

Their words, not your summary. These are worth more in the defense than the score.

## The result

Count the rows that say **posted in under 5 minutes without help**.

| Posted in time, unassisted | Result |
| --- | --- |
| 8, 9 or 10 | **UX-02 met** — write the number and the date in `docs/SRS-STATUS.md` |
| 7 | Not met. The test worked; the flow did not. Fix what the "stuck where" column says, then re-run with ten new people |
| 6 or fewer | Not met, and the flow needs a design pass before another test |

Whatever the number, record it honestly, with the date and the ten names reduced to
initials. A "9 of 10" that can be defended is worth more than a "10 of 10" nobody
believes.

## Where it goes

- The result goes into `docs/SRS-STATUS.md` next to UX-02, and the row stops saying
  "not measured".
- The filled sheet is evidence: photograph it, put it in the project folder
  (`docs/evidence/ux-02-<date>.jpg`), and bring it to the defense.
- File names and dates matter more than neatness. A photograph of a hand-written
  sheet with ten rows and times is the strongest thing you can hold up.

## Two practical warnings

- **Do not demo first.** If one of the ten watches you post a listing before their
  turn, that person is no longer a new user. Test one at a time, out of sight of the
  next.
- **Do not test on an account already signed in.** Sign-up and email verification are
  part of the five minutes, and are usually where people actually get stuck.
