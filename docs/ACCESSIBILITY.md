# Contrast (UX-05)

UX-05 asks for WCAG 2.1 level AA: **4.5:1** for normal text and **3:1** for large
text (18.66 px bold or 24 px). The palette lives in one file — the `:root` block
for light and `:root[data-theme="dark"]` for dark in
`frontend/src/styles/variables.css` — so it can be measured rather than eyeballed.

    python scripts/contrast_audit.py
    python scripts/contrast_audit.py --json docs/performance/contrast.json

The script reads both blocks, computes the relative luminance of every pair the
interface actually paints, prints the ratios and exits non-zero if any pair is
below its threshold. It is deliberately dependency-free so it can be run in CI
later without being rewritten.

## The result

Fourteen pairs, both themes: **0 failures**. The full table is in
`docs/performance/contrast.json`; the tightest margins are:

| Pair | Light | Dark | Needs |
| --- | --- | --- | --- |
| Secondary text on a soft panel | 4.71 | 5.25 | 4.5 |
| Danger text on its tint | 4.67 | 5.33 | 4.5 |
| Secondary text on the page | 4.94 | 6.81 | 4.5 |
| Sidebar secondary text | 5.36 | 7.01 | 4.5 |
| Success text on its tint | 5.19 | 7.81 | 4.5 |
| Secondary text on a card | 5.40 | 6.13 | 4.5 |
| Link text on a card | 6.35 | 6.30 | 4.5 |
| Button label on the accent | 7.68 | 9.43 | 4.5 |
| Body text on a card | 15.75 | 12.91 | 4.5 |

## Three values changed, because the audit found them

The first run failed three pairs. They were real, not rounding:

| Token | Was | Now | Pair | Was | Now |
| --- | --- | --- | --- | --- | --- |
| `--muted` (light) | `#5f6f87` | `#5c6b83` | secondary text on a soft panel | 4.46 | 4.71 |
| `--green` (light) | `#1e8e5a` | `#17734a` | success text on its tint | 3.67 | 5.19 |
| `--red` (dark) | `#ef6b6b` | `#f48383` | danger text on its tint | 4.42 | 5.33 |

The dark `--red-bg` was also `rgba(239, 107, 107, 0.14)`, which cannot be audited
because its result depends on what is behind it. It is now the solid colour that
mixture equals over the dark card (`#3c2b2f`), so the pair is measurable instead
of assumed.

A one-step change to a grey or a red is invisible in use and it is the difference
between claiming AA and passing it. The three failures are the reason this
document exists rather than a sentence in the status table.

## What is not covered

- **Photographs and the hero artwork.** Text over an image, or an image's own
  contrast, is outside a palette audit; the landing page and the carousel use
  dark overlays for that reason, but they were not machine-checked.
- **Focus indicators and non-text contrast** (WCAG 1.4.11) — the 3:1 rule for
  borders and controls — is a separate check and was not measured here.
- **A human usability pass** — `UX-02`, which asks that 8 of 10 new users post a
  listing within five minutes, needs ten people and a stopwatch, not a script. It
  remains the one unmeasured requirement, and saying otherwise would be a fiction.
