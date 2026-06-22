# Weekly Workflow Showcase — Homepage "This Week" Section

A homepage section that rotates every week to feature BBC's best workflows, a client review, and a living stat. Lives on `index.html` in the section `#weekly-showcase` (between Real Relationships and Founder).

## How it works (plain English)

One file is the control panel: **`featured.json`**. You edit that file, run one command, and the homepage section rebuilds itself into clean static HTML. No hand-editing the page. Static HTML = full SEO value (Google reads the workflow links every week).

```
featured.json   →   node build-featured.mjs   →   index.html section rebuilt
(what to show)      (the one command)              (between FEATURED markers)
```

## To update for the week

1. Open `_featured/featured.json`.
2. Change the fields:
   - `week_label` — e.g. "Week of June 29, 2026"
   - `headline` + `intro` — the section title and one-line intro
   - `workflows` — exactly 3 items. Each: `icon`, `category`, `title`, `benefit`, `url` (the page filename, e.g. `can-ai-keep-my-website-updated.html`)
   - `review` — one client review: `quote`, `name`, `title`, `url` (use only REAL reviews — see review pool below)
   - `stat` — `number` + `label`
3. From `BBC WEBSITE HTML\`, run:
   ```
   node _featured/build-featured.mjs
   ```
4. Verify on mobile / tablet / desktop (375 / 768 / 1280) before any deploy.
5. Deploy (when Netlify credit is on): commit + push `index.html` and `_featured/`.

## Curation rule (which workflows lead)

Score each candidate on: kills a real business-owner pain · works for ANY industry · has visible proof · understandable in 5 seconds. **Phase 1:** rotate best-first through the existing ~89 insight pages. **Phase 2** (once the strongest are featured): each week's NEW workflow leads.

Keep captions to the Universal Caption rule — plain English, no jargon (no "AI agent", "workflow", "automation" as a noun).

## Verified review pool (real, on-site quotes only)

- **Ryan Tanel** — Top Producer Investment Capital — https://share.google/FESMGRclQ5h9yK7jY
- **Sonya Riviere** — S. Riviere Hair Collection — https://share.google/FESMGRclQ5h9yK7jY
- **Marla Santiago** — Wooden Woodworks — https://share.google/FESMGRclQ5h9yK7jY
- **Essence Bembry** — grief coach, 4-yr client (in CONTENT_QUEUE\2026-06-24_review_essence_bembry)

Do not invent quotes. Pull only from verified reviews.

## Files

- `featured.json` — the weekly control file (the only thing you edit)
- `build-featured.mjs` — the builder (don't edit unless changing the layout)
- The section shell + CSS live in `index.html` under `#weekly-showcase`. The builder only rewrites the content between `<!-- FEATURED:START -->` and `<!-- FEATURED:END -->`.

## Wiring into the Saturday weekly routine (optional, recommended)

Add a step to the weekly update: after the week's new pages are chosen, update `featured.json` and run `node _featured/build-featured.mjs`, then deploy. The section then refreshes on the same heartbeat as the weekly deploy.
