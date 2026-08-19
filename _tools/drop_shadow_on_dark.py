"""
Remove drop shadows from gold buttons that sit on dark sections.

A drop shadow needs a lighter surface behind it to read as elevation. On the
site's dark navy (#1C2E47) the shadow is invisible at best, and any colour in
it reads as a glow rather than depth. So on dark sections the shadow should
simply not be there.

This does NOT touch .btn-gold globally: on light sections the shadow does real
work and stays. It only adds a scoped override for the dark contexts
(.cta-section and .section--dark).

Inserted immediately after the last .btn-gold rule in each file's stylesheet,
so it wins on specificity and source order without reordering anything.

Usage:
  python _tools/drop_shadow_on_dark.py --dry-run
  python _tools/drop_shadow_on_dark.py
"""
import argparse
import pathlib
import re
import sys

MARKER = "/* shadows do not read on dark; keep them for light sections only */"
OVERRIDE = (
    MARKER
    + "\n    .cta-section .btn-gold,.section--dark .btn-gold{box-shadow:none}"
    + "\n    .cta-section .btn-gold:hover,.section--dark .btn-gold:hover{box-shadow:none}"
)

# The last .btn-gold declaration block in the file, so the override lands after it.
BTN_GOLD_RULE = re.compile(r"(\.btn-gold[^{}]*\{[^}]*\}\s*\n)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()

    root = pathlib.Path(args.root)
    skip = {"node_modules", ".git", "_drive_corrupt_git_bak_20260604"}

    changed = 0
    skipped_no_dark = 0
    already = 0

    for path in sorted(root.rglob("*.html")):
        if any(part in skip for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")

        if "btn-gold" not in text:
            continue
        if MARKER in text:
            already += 1
            continue
        # Only pages that actually place a gold button on a dark section.
        if "cta-section" not in text and "section--dark" not in text:
            skipped_no_dark += 1
            continue

        matches = list(BTN_GOLD_RULE.finditer(text))
        if not matches:
            continue

        last = matches[-1]
        new_text = text[: last.end()] + "    " + OVERRIDE + "\n" + text[last.end():]

        if not args.dry_run:
            path.write_text(new_text, encoding="utf-8")
        changed += 1

    verb = "WOULD ADD" if args.dry_run else "ADDED"
    print(f"{verb} the dark-section override to {changed} file(s)")
    print(f"  already had it : {already}")
    print(f"  no dark section: {skipped_no_dark}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
