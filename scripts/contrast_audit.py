"""Measure the theme's colour contrast against WCAG 2.1 AA (UX-05).

The palette lives in one file, `frontend/src/styles/variables.css`, in two
blocks: `:root` (light) and `:root[data-theme="dark"]`. This reads those blocks
and computes the contrast ratio of every pair the interface actually paints —
text on a card, muted text on the page, sidebar text on navy, button labels on
their fills — for both themes.

    python scripts/contrast_audit.py
    python scripts/contrast_audit.py --json docs/performance/contrast.json

WCAG 2.1 AA asks for 4.5:1 for normal text and 3:1 for large text (18.66 px bold
or 24 px). Anything below its threshold is reported as a failure and the script
exits non-zero, so it can be run in CI later without being rewritten.
"""

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "frontend", "src", "styles", "variables.css")

# (label, foreground token, background token, is this large text?)
PAIRS = [
    ("Body text on a card", "ink", "card", False),
    ("Body text on the page", "ink", "bg", False),
    ("Secondary text on a card", "muted", "card", False),
    ("Secondary text on the page", "muted", "bg", False),
    ("Text on a soft panel", "ink", "soft", False),
    ("Secondary text on a soft panel", "muted", "soft", False),
    ("Sidebar text", "side-ink", "navy", False),
    ("Sidebar secondary text", "side-mute", "navy", False),
    ("Button label (blue)", "blue-ink", "blue", False),
    ("Button label (yellow)", "yellow-ink", "yellow", False),
    ("Success text", "green", "green-bg", False),
    ("Danger text", "red", "red-bg", False),
    ("Link text on a card", "blue", "card", False),
    ("Heading on the page (large)", "ink", "bg", True),
]


def parse_blocks(css):
    """Return {'light': {token: hex}, 'dark': {token: hex}} from the CSS.

    The blocks are taken up to the first line that closes them at column 0, so a
    value containing a newline (the awning gradient does) cannot truncate the
    parse and silently drop the tokens below it.
    """
    def block(opening_pattern):
        """Read one rule block.

        Anchored to the start of a line on purpose: `:root {` also appears in the
        comment above the rule, and taking the first occurrence read the comment.
        """
        start = re.search(opening_pattern, css, re.M)
        if not start:
            return {}
        # The pattern ends with the opening brace, so the body starts right there.
        body_start = start.end()
        end = css.find("\n}", body_start)
        body = css[body_start : end if end > 0 else len(css)]
        return {
            name: value.strip()
            for name, value in re.findall(r"--([\w-]+):\s*([^;]+);", body)
            if value.strip().startswith("#")
        }

    return {
        "light": block(r"^:root \{"),
        "dark": block(r'^:root\[data-theme="dark"\] \{'),
    }


def hex_to_rgb(value):
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))


def luminance(rgb):
    def channel(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg, bg):
    a, b = luminance(hex_to_rgb(fg)), luminance(hex_to_rgb(bg))
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def audit(theme_tokens):
    rows = []
    for label, fg, bg, large in PAIRS:
        if fg not in theme_tokens or bg not in theme_tokens:
            rows.append(
                {
                    "label": label,
                    "fg": fg,
                    "bg": bg,
                    "ratio": None,
                    "required": 3.0 if large else 4.5,
                    "pass": None,
                    "note": "token missing or not a hex colour (e.g. rgba)",
                }
            )
            continue
        value = ratio(theme_tokens[fg], theme_tokens[bg])
        required = 3.0 if large else 4.5
        rows.append(
            {
                "label": label,
                "fg": theme_tokens[fg],
                "bg": theme_tokens[bg],
                "ratio": round(value, 2),
                "required": required,
                "pass": value >= required,
                "note": "",
            }
        )
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", default="")
    args = parser.parse_args(argv)

    with open(CSS, encoding="utf-8") as handle:
        blocks = parse_blocks(handle.read())

    report = {}
    failures = 0
    for theme in ("light", "dark"):
        print(f"\n{theme.upper()}")
        print(f"{'pair':34} {'fg':9} {'bg':9} {'ratio':>6} {'min':>5}  result")
        rows = audit(blocks.get(theme, {}))
        report[theme] = rows
        for row in rows:
            if row["ratio"] is None:
                print(f"{row['label']:34} {'-':9} {'-':9} {'-':>6} {'-':>5}  SKIPPED ({row['note']})")
                continue
            verdict = "pass" if row["pass"] else "FAIL"
            if not row["pass"]:
                failures += 1
            print(
                f"{row['label']:34} {row['fg']:9} {row['bg']:9} "
                f"{row['ratio']:>6} {row['required']:>5}  {verdict}"
            )

    print(f"\n{failures} failure(s)")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
        print(f"written {args.json}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
