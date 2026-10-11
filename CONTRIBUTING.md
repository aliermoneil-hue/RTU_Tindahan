# Contributing to RTU Tindahan

This document is the team agreement. Follow it and merges stay painless.

---

## 1. The one rule that matters

**Never commit or push directly to `main`.**

`main` is always the version we can demo. It only changes through a reviewed
pull request. Everything else is a branch.

> Note: this repository is on the free GitHub plan, so branch protection is not
> available on a private repo. The rule is enforced by us, not by GitHub. If
> someone breaks it, `git log --first-parent main` will show it.

---

## 2. First-time setup (once per person)

    git clone https://github.com/aliermoneil-hue/RTU_Tindahan.git
    cd RTU_Tindahan

    # Tell Git who you are, or your commits are attributed to nobody.
    git config user.name  "Your Name"
    git config user.email "your.name@rtu.edu.ph"

Then set up the two tiers you will work on. See `README.md` section 4.

---

## 3. Daily workflow

### Start from the latest main

    git switch main
    git pull

### Create your branch

Name it `feature/<your-name>-<short-task>`.

    git switch -c feature/neil-login-form

Use `fix/` for bug fixes and `docs/` for documentation only.

    git switch -c fix/neil-cart-total
    git switch -c docs/neil-srs-update

### Work, then commit

    git add .
    git commit -m "Add email and password validation to the login form"

Write commit messages that say what changed and why. If the work maps to a
requirement in the SRS, put the ID in the message:

    git commit -m "Add seller listing approval flow (FR-18)"

### Push and open the pull request

    git push -u origin feature/neil-login-form

GitHub prints a link in the terminal. Open it, fill in the pull request
template, and request a review from another member.

### Merge

A second member reviews. One approval is enough. Then click
**Squash and merge** — it is the only merge button enabled, on purpose.
Your branch is deleted automatically afterwards.

---

## 4. Keeping your branch up to date

If `main` moved while you were working, do **not** merge main into your branch
by hand unless you know what you are doing. Use the **Update branch** button
that appears on your pull request page. It keeps history clean.

If you must do it locally:

    git switch main
    git pull
    git switch feature/your-branch
    git merge main

---

## 5. What must never be committed

| Never commit | Why |
| --- | --- |
| `.env` or any file with real keys | Leaks the LLM API key and email credentials. The root `.gitignore` already blocks these. |
| `node_modules/` | Tens of thousands of files. `npm install` recreates it. |
| `venv/` or `.venv/` | Machine-specific. `requirements.txt` recreates it. |
| `db.sqlite3` | Local test data. Migrations recreate the schema. |
| Large videos and installers | Slows every clone for everyone. |

If you ever commit a secret by accident, tell the team immediately and
**rotate the key**. Deleting the file in a later commit does not remove it from
history.

---

## 6. Review checklist

When you review someone's pull request, check:

- [ ] It does what the description claims.
- [ ] No `.env`, keys, or `node_modules` in the diff.
- [ ] It runs locally (the author states how they tested it).
- [ ] Existing features were not broken.

Be specific and kind. Comment on the code, not the person.

---

## 7. Commit message style

    Add seller listing approval flow (FR-18)
    Fix cart total rounding on multiple quantities
    Update SRS section 3.2 with the new moderation states
    Remove unused Tailwind classes from the product card

Start with a verb. Keep the first line under 72 characters. No "update stuff".
