"""
Swap BBC's gold chromatic glow shadows for neutral elevation shadows.

A colored halo in the brand gold (rgba(184,146,62, a)) reads as the default
"AI-generated UI" look. This keeps every shadow's geometry (offset + blur) so
the layout and depth are unchanged, and only swaps the colour to the warm
neutral already used elsewhere on the site (rgba(85,60,35, a)).

Alpha is scaled down because a light gold needs a high alpha to register, while
a dark neutral at the same alpha would read far too heavy.

Zero-offset shadows (0 0 Npx) are the actual halo tell, so those also gain a
small y-offset to become real elevation rather than a glow ring.

Only touches box-shadow declarations. Backgrounds, borders and text using the
same gold are left alone.

Usage:
  python _tools/neutralize_gold_glow.py --dry-run
  python _tools/neutralize_gold_glow.py
"""
import argparse
import pathlib
import re
import sys

GOLD = r"rgba\(184,\s*146,\s*62,\s*(\.\d+|\d?\.?\d+)\)"
# Matches a full box-shadow value containing the gold colour.
# y and blur may be written as a bare `0` rather than `0px`, and the zero-offset
# form (`0 0 8px`) is precisely the halo worth catching, so both must be optional-px.
SHADOW = re.compile(
    r"(box-shadow:\s*)(0)(\s+)(-?[\d.]+(?:px)?)(\s+)([\d.]+(?:px)?)(\s+)" + GOLD,
    re.IGNORECASE,
)
ALPHA_SCALE = 0.55
NEUTRAL = "85,60,35"


def convert(match: re.Match) -> str:
    prop, x, s1, y, s2, blur, s3, alpha = match.groups()
    a = float(alpha if not alpha.startswith(".") else "0" + alpha)
    new_a = round(a * ALPHA_SCALE, 2)
    # A zero y-offset is a halo, not elevation. Give it a real drop.
    if y.rstrip("px") in ("0", "0.0", "-0", ""):
        y = "2px"
    return f"{prop}{x}{s1}{y}{s2}{blur}{s3}rgba({NEUTRAL},{new_a})"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()

    root = pathlib.Path(args.root)
    skip = {"node_modules", ".git", "_drive_corrupt_git_bak_20260604"}

    files_changed = 0
    total = 0
    samples = []

    for path in sorted(root.rglob("*.html")):
        if any(part in skip for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "184,146,62" not in text:
            continue
        new_text, n = SHADOW.subn(convert, text)
        if n:
            total += n
            files_changed += 1
            if len(samples) < 3:
                before = SHADOW.search(text)
                if before:
                    samples.append((path.name, before.group(0), convert(before)))
            if not args.dry_run:
                path.write_text(new_text, encoding="utf-8")

    print(f"{'WOULD CHANGE' if args.dry_run else 'CHANGED'}: "
          f"{total} shadow(s) across {files_changed} file(s)")
    for name, b, a in samples:
        print(f"\n  {name}\n    - {b.strip()}\n    + {a.strip()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
