# BBC Homepage Redesign — V1

**Status:** Built and verified, awaiting RJ approval before rollout to other pages
**Built:** 2026-05-28
**Live site untouched:** still serves `BBC WEBSITE HTML/index.html` from master

## How to preview

```powershell
# From any Claude Code session in BBC Drive:
# preview tool will pick this up automatically
preview_start name: bbc-redesign
# Opens http://localhost:8766/
```

Or manually: `python -m http.server 8766 --directory "G:\Shared drives\BBC Drive\BBC WEBSITE HTML\_REDESIGN"` then visit http://localhost:8766/

## What changed (design)

Same content. New feel.

- **Hero**: glass-card studio panel with subtle float animation, pill-shaped eyebrow with pulsing dot, gradient text on emphasis, scroll indicator
- **Stats bar**: numbers count up on scroll into view (1.6s ease)
- **Section cards** (areas, partners): top gradient bar fills on hover, icon scales + rotates 4deg, lift by 5px with refined shadow
- **Compare cards**: gold→blue accent bar on BBC card, gradient marker pills (gold for yes, neutral for no)
- **Journey timeline**: gold→blue progress line that fills as you scroll past, step numbers glow gold on hover
- **Team cards**: avatars get ring glow on hover, smooth scale-up
- **Reviews + work + insights**: subtle slide on hover, refined gradient backgrounds
- **Founder values**: card-style with warm hover glow
- **Final CTA**: gradient ellipse background, refined typography
- **Header**: glass blur (24px saturated), gold underline on nav hover/active
- **Scroll progress**: thin gold bar at top tracks page progress
- **Magnetic-lite buttons**: subtle cursor-follow on desktop (fine pointer only)

## What stayed (content fidelity)

- All copy verbatim from original index.html
- All 11 sections in same order
- All icons (emojis) unchanged
- All 8 team members + avatar gradients per CLAUDE.md
- 3 reviews (Sarah C., James M., Angie L.)
- 3 work previews (Coastal Coaching, Verde Health, Summit Real Estate)
- 3 insight titles
- 7 partner cards
- Bruno's video iframe (Google Drive embed)
- All CTAs and links (Calendly, contact, etc.)
- Footer structure
- JSON-LD structured data
- favicon + bbc-logo
- Color palette (deep blue, cream, gold)
- Fonts (Playfair Display, Lora, DM Sans)

## Motion stack

- **GSAP 3.12.5** + ScrollTrigger (FREE since April 2025) — primary scroll choreography
- **Lenis 1.0.42** (optional, gracefully degrades if CDN fails)
- **Intersection Observer** fallback if GSAP fails to load
- **prefers-reduced-motion** fully respected — animations disabled, content visible immediately

## Responsiveness verified

| Viewport | Status | Notes |
|---|---|---|
| 375 × 812 (mobile) | ✅ Pass | Hero panel hidden, hamburger 44×44, single column grids, no horizontal overflow |
| 768 × 1024 (tablet) | ✅ Pass | 2-col grids, hamburger visible, journey horizontal |
| 900 × 800 (intermediate) | ✅ Pass | Nav-to-hamburger handoff works (fixed during build) |
| 1280 × 800 (desktop) | ✅ Pass | All grids fill, studio panel visible, nav links visible |

**Bug found + fixed during testing:** Between 769-1024px width, both nav AND hamburger were hidden (no navigation). Fixed by moving hamburger breakpoint from `≤768` to `≤1024`.

## Files in this folder

- `index.html` — the redesigned homepage (self-contained, inline CSS + JS)
- `bbc-styles.css` — copy of original shared CSS (not currently linked, redesign has its own inline)
- `favicon.svg`, `bbc-logo.png` — brand assets
- `404.html`, `robots.txt` — copied from original

## Next steps (for next session)

1. RJ reviews http://localhost:8766/ — visual approval
2. If approved: roll out the same design system to other pages (about, our-team, how-it-works, how-we-help, our-work, insights, contact, all 8 VA profile pages, questionnaire-sonya)
3. Push to live: move `_REDESIGN/index.html` to root, commit, push to master, Netlify auto-deploys
4. Optional: extract the new design tokens into `bbc-styles.css` v6.0 to share across pages

## Known cosmetic notes

- Lenis smooth scroll didn't load from current CDN (npm package URL needs verification). Page works fine without it. Will try `@studio-freight/lenis` or alternate URL next session if RJ wants the smooth-scroll polish.
- Preview screenshot tool times out on the perpetual CSS animations — DOM verification via accessibility snapshot was used instead. Real-browser preview at localhost:8766/ is the authoritative visual check.

## Related

- Motion stack research: `BBC Operating System/11_KNOWLEDGE_AND_INTELLIGENCE/LEARNINGS/2026-05-28_interactive_design_motion_stack_deep_dive.md`
- Original live page: `BBC WEBSITE HTML/index.html` (unchanged)
- Website tech reference: `BBC WEBSITE HTML/CLAUDE.md`
