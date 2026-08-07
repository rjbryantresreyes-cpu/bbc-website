<!-- deploy-trigger 2026-06-13: force build to publish CRM follow-up first-name fix (os/index.html). -->
<!-- deploy-trigger 2026-06-13b: dynamic full-field contact merge + live refetch on cache miss. -->
<!-- deploy-trigger 2026-06-13c: shared contact loader fixes concurrency race (paste+template) -> Hi there. -->
<!-- deploy-trigger 2026-06-13d: force-refetch on lookup miss + don't clobber good cache + SW v17 (stop the few-minute revert). -->
<!-- deploy-trigger 2026-06-14: Needs Follow-Up section; follow-up click fills name from the exact record (deterministic, no race); SW v18. -->
<!-- deploy-trigger 2026-07-04: Workflows page — clickable deliverable checkboxes + shared two-way sync store (os/index.html + new function). -->
<!-- deploy-trigger 2026-07-21: New 5-star Google review from Rebekah Severi (Freccia). -->
<!-- deploy-trigger 2026-07-22: New client onboarded — BILT 2 Travel added across the site. -->
<!-- deploy-trigger 2026-08-08: Flights ni Bruno & Co. — new /flights page (daily flight-deal database, static, reads flights/data.json). -->

# 🟡 STAGED 2026-08-08 — Flights ni Bruno & Co. (`/flights`)

**Deploy at BBC eodr.** A daily-updated cheapest-fares database (local PH + international), family-facing, at `balaynibruno.co/flights`. Static site; data comes from `flights/data.json`, which the PC's daily job (`C:\BBC\flights-ni-bruno\daily_update.py`, scheduled 8AM) regenerates via `export_db.py`. No backend needed on Netlify — the app just reads the JSON.

**New files:** `flights/index.html`, `flights/data.json`.
**After deploy:** verify `balaynibruno.co/flights` returns 200 and loads the deals grid. Data refreshes each day the PC runs the daily job; it goes live on the next deploy.

# ✅ SHIPPED 2026-07-22 — New client: BILT 2 Travel (Dwight Campbell) (commit ce6be1f)

**Deployed and verified live 2026-07-28 (BBC EODR):** `balaynibruno.co/bilt-2-travel` returns 200,
`/os` and `/insights` return 200, `origin/master == HEAD`. Marker corrected at the 2026-07-28 EODR —
this block sat marked 🟡 STAGED for six days after it had already shipped.

<details><summary>original staging note</summary>

**Deploy at BBC eodr (the one daily deploy).** New client onboarding — BILT 2 Travel added to every client surface. NOTE: welcome carousel + story are already SCHEDULED on Metricool for Jul 25 (CT) and reference `social-media/welcome-bilt2travel/` media, which goes live with this deploy (Metricool fetches at publish, saveExternalMediaFiles:false). This deploy MUST ship before Jul 25 or the scheduled post has no media.

**New files (3 + media):**
- `bilt-2-travel.html` — new dedicated client/case page (cloned from freccia-construction.html, purple logo card).
- `assets/clients/bilt-logo.png`, `assets/clients/bilt-avatar.png` — client logo assets.
- `social-media/welcome-bilt2travel/` — slide_01..05.png + story.png + reel.mp4 (welcome carousel/story/reel media Metricool serves; reel has music bed + burned subtitles).

**Changed files (7):**
- `data/clients.json` — BILT moved from `prospect` → `active` (handler John, AI BILL); stale prospect entry removed.
- `os/index.html` + `os-preview/index.html` — BILT block promoted to `category:active` (both Command Center copies in sync; core-file guard will fire → `BBC_ALLOW_CORE=1` after confirming forward-moving).
- `our-work.html` — BILT `.work-card` added to Current Clients grid (first card).
- `index.html` — BILT `.work-preview-card` added to homepage Recent Work strip (first card).
- `john.html` — BILT named under John's "Content For" (John = BILT's VA).
- `sitemap.xml` — `bilt-2-travel.html` URL added.

Mirror changed files to `BBC WEBSITE HTML\` with the push. Verify 375/768/1280 on bilt-2-travel.html + our-work.html.

</details>


# ✅ SHIPPED 2026-07-21 — New review: Rebekah Severi / Freccia Construction (5★) (commit 13b9dfe)

**Deployed and verified live 2026-07-28 (BBC EODR):** review is live sitewide; `origin/master == HEAD`.
Marker corrected at the 2026-07-28 EODR — this block sat marked 🟡 STAGED after it had already shipped.

<details><summary>original staging note</summary>

**Deploy at BBC eodr (the one daily deploy).** New verbatim Google review added sitewide.
**Files changed (2):**
- `freccia-construction.html` — added "What Bekah Said" review section (full verbatim quote, 5 stars, links to Google).
- `index.html` — homepage reviews grid now leads with Rebekah/Freccia; curated to the 3 active-client reviews (Freccia, S. Riviere, Wooden Woodworks). Ryan Tanel (past) still on his own page + the "Read all reviews on Google" button.
Ledger updated: `C:\BBC\routines\reviews\known_reviews.json` (rebekah-severi-freccia, processed).
Mirror both changed files to `BBC WEBSITE HTML\` before/with the push. Verify 375/768/1280.

</details>


# 🟠 NEEDS RJ'S CALL — `how-we-build-walkable-3d.html` (orphan, uncommitted since 2026-07-25)

Found at the 2026-07-28 EODR. A finished insight page sitting **untracked** in the repo:
- Title: "How We Build Walkable 3D From a Phone" — six workflows in one video.
- Canonical claims `https://balaynibruno.co/how-we-build-walkable-3d`, which currently **404s**.
- **Not connected to anything:** no `insights.html` card, no `sitemap.xml` entry, no inbound link.
- It is a **different page** from the live `how-we-build-walkable-3d-tours.html` ("Can You See Your
  New Building Before It Is Built?", 200 OK, in sitemap, carded on /insights). Same subject, different angle.

**Not shipped at this EODR on purpose.** Per EVERYTHING-CONNECTED, an unlinked page should not go live,
and publishing a second near-topic page risks splitting SEO against the live `-tours` page.
**RJ's call:** (a) connect it — add the /insights card + sitemap entry, differentiate it from `-tours`,
then ship; or (b) discard it as a superseded draft. Either way it should not stay untracked.


# ✅ SHIPPED 2026-07-21 — Wooden Woodworks dead-domain fix (commit 79f8b8e)

**Deployed and verified live:** `balaynibruno.co/data/clients.json` now serves `woodenwoodworks.com`;
/os, /os-preview, and / all return 200; the WW site itself returns 200. `origin/master == HEAD`.
Push required `BBC_ALLOW_CORE=1` (the core-file guard fired on os/index.html + os-preview/index.html);
overridden only after confirming the changes were forward-moving, not an old copy.
Batch also carried pending dashboard-sync output (learnings refresh, updated date 07-17 -> 07-20,
removed .playwright-mcp entry) — internal /os data only.

<details><summary>original staging note</summary>

**What:** WW's site was recorded as `woodenwoodworksllc.com`, which does **not resolve at all** (NXDOMAIN, confirmed by DNS lookup). The live site is **`woodenwoodworks.com`** (Netlify, GA4 `G-SKDFK7S3YM`).

**Files changed (3):**
- `data/clients.json` line 21
- `os/index.html` line 797
- `os-preview/index.html` line 797  ← both Command Center copies kept in sync per the rule

**Drive mirror also corrected (3 files)** per the mirror rule — `BBC WEBSITE HTML\data\clients.json`, `os\index.html`, `os-preview\index.html`. The mirror had drifted from the repo (different line ordering in clients.json), so these were surgical single-value edits, not overwrites.

**Verified:** `clients.json` parses; zero occurrences of the dead domain remain in the repo or the mirror; new value present in all six files.

⚠️ **Flagged, not touched — needs RJ's call:** `BBC WEBSITE HTML\os\index 5.03.47 PM.html` is a stray timestamped backup copy sitting inside the website mirror (still carries the old domain). It looks like accidental cruft from a manual save. Recommend deleting it, but it is a deletion so it is RJ's call, not an auto-fix.

</details>
**Risk:** none to layout or behaviour, a data-value correction only. No responsive re-check needed (no visual change).
**Found by:** the 2026-07-21 website-analytics audit (`C:\BBC\routines\client-care\site_analytics.py`), which live-probes every site BBC manages.

---

# ✅ SHIPPED & LIVE — reconciled 2026-07-11 (end-of-week deploy)

**The whole batch below is DEPLOYED. `origin/master` == `HEAD`, working tree clean, Netlify built it, live pages verified 200** (homepage, /os, sitemap with the 5 added slugs, our-team John+Dexter, the newly-wired insight pages). The Netlify credit freeze is clear again. Everything under the old "STAGED / PENDING PUSH" headings has shipped — treat the git sweep as truth, not the stage labels below (kept for history).

**Genuinely-open follow-ups (config/verify, NOT deploys — RJ's call, do NOT block the week):**
- **Netlify env vars** (RJ sets in Site settings, secrets never in repo): `BREVO_API_KEY` (CRM page auth), `ANTHROPIC_API_KEY` (Messy live answers).
- **Password vault** — verify unlock round-trip on live: /os → 🔒 → set master password → add one entry → reload → confirms decrypt.
- **Cavalry Live-Builds card** — re-add its card on live-builds.html once RJ approves showing it publicly (screenshot already saved).
- **/os "Live Builds" tile** (optional; nav path already works) + confirm `live-builds.html` in sitemap.
- **Team page** — Diego/Dexter/Hazel/Joshua: confirm real hires → add to CLAUDE.md roster (or pull). John+Dexter cards already live.
- **WhatsApp two-way client sync** — activates when `/bbc-sync` runs in a session with the WhatsApp MCP loaded (email half already live).

---

## (history — all SHIPPED) 🩺 SITE DIAGNOSTIC SWEEP — STAGED 2026-07-11 (deploy together)
Deep-dive audit of core pages. Auto-fixed the clear factual/stale items:
- **Copyright year:** `© 2025` → `© 2026` sitewide (**46 html files** had the stale year — how-it-works, our-work, tools + 43 others).
- **Our Work founding cards → white:** MNJ, Crown, Orbital converted from navy emoji tiles to clean wordmark-on-white (matches the rest).
- **Al (departed 2026-06-12) removed from current-client credits** on our-work.html: S. Riviere `Al · Store + Content` → **Daryl** (he took it over); dropped Al's badge on Home Vision, AJ Battle, Blackbelt (kept the remaining real credits, did NOT invent a replacement).
- **Clean:** no broken internal links or missing images on the 12 core pages.
- ⚠️ **NEEDS RJ (didn't auto-edit — would require inventing facts):**
  1. **our-team.html roster is stale** — still shows **Al** (departed) and links `al.html`; shows **"Diego"** (diego.html — I can't verify who this is); and is **missing John** (joined 2026-06-30, no john.html profile). Needs your call + John's bio/photo before I edit the team page.
  2. **"Live Builds" is not in the global nav/footer** — only on our-work.html + live-builds.html. Reachable via Our Work, but if you want it in the main nav across all ~100 pages, say so (big mechanical batch).

## 🧾 OUR WORK clients refresh + Live Builds hero fix — STAGED 2026-07-11 (deploy together)
- **live-builds.html hero fix:** the "Live Builds You Can" line was invisible (global `h1{color:deep-blue}` won on the navy hero). Added `color:#fff` to `.pf-hero__title`. Now readable.
- **our-work.html — Current vs Past rebuilt + logos on white** (RJ asked to update who's current/old + logos on white bg):
  - **CURRENT (11):** Freccia, Wooden Woodworks, Cavalry Realty, First Class Finishes, Home Vision Studio, Hi-Up Roofing, S. Riviere Hair, DuDilagent AI, All Ryze, AJ Battle Foundation, Blackbelt Commerce (+ Coming Soon placeholder).
  - **PAST (new section, 3):** Top Producer Investment Capital, 4Ocean (ended 2026-07-07), Entropy Management.
  - **Founding Clients** section left unchanged (MNJ, Crown, Orbital — intentional emoji/gold design).
  - **Classification basis:** each card's own copy (present tense = current, past tense/ended = past) + client CLAUDE.md. **RJ REVIEW before deploy** — bump anyone if I misjudged (esp. Blackbelt/DuDilagent/Cavalry, which weren't in the maintained active-retainer list but read as active).
  - **De-duped:** 4Ocean (was 2×) and DuDilagent (was 2×) → 1 each. **Dropped SugarBabyCreative** entirely (brand-safety hold — adult-adjacent; RJ can override).
  - **All Current+Past logo cells now white background.** Real logos: Freccia, WW, Cavalry, TPIC, First Class Finishes, Home Vision, Hi-Up, AJ Battle. Clean text wordmarks on white (no logo file, couldn't cleanly source): S. Riviere, DuDilagent, All Ryze, Blackbelt, Entropy, 4Ocean.
  - **Not added:** JR Signing Services (past per CLAUDE.md but no card/logo — didn't invent one).
- Mirrored to `BBC WEBSITE HTML\`. Verified: Current(12)/Past(3)/Founding(3) render, names correct, 0 dupes, 6/6 sections balanced.

## 🖼️ LIVE BUILDS PORTFOLIO HUB — new page — STAGED 2026-07-10
- **What RJ asked:** "check if there's any other git repo we can make as a portfolio like dashboard." Answer: built a **Live Builds** hub that collects our portfolio-worthy standalone builds as clickable cards with real screenshots, each opening the actual live site.
- **NEW `live-builds.html`** (built from the about.html scaffold, so nav/footer/tokens/JS match the site 1:1). Sections: hero, **Websites & Stores** grid (6 real live builds), **Dashboards & Tools** (3 private "demo on request" cards, no public link), CTA.
  - 6 cards, each = real screenshot (`assets/portfolio/pf-*.jpeg`, captured via Playwright at 1280x800) + "Open live site ↗" overlay + "Explore the build →" link opening the actual URL:
    - 3R Design → https://3r-design-preview.netlify.app
    - Wooden Woodworks → https://ww-portfolio-preview.netlify.app
    - S. Riviere Hair → https://sriviere-hair-preview.netlify.app
    - Home Vision Studio → https://bbc-hvs-redesign-preview.netlify.app
    - Cavalry Realty Group → https://gleeful-halva-5fdfd3.netlify.app
    - The BBC Playbook → https://bbc-playbook-preview.netlify.app
  - Private (no public link, "Demo on request"): BBC Command Center (/os), Client Store Dashboard, 3D Property Walkthrough — these run real client data so they stay private.
  - **Why screenshots not live iframes:** Cavalry sends `X-Frame-Options: deny` (can't embed) and HVS/Playbook use scroll-fade animations that render blank in a static iframe. Static screenshots are consistent + reliable; the live link still opens the real site.
- **Connected (everything-connected rule):** added a **"See Live Builds" banner** near the top of `our-work.html` (Our Work is in the global nav) + a **"Live Builds"** link in the footer Company column on both pages + a Live Builds entry in live-builds.html's own mobile nav. Click-path works from the normal entry point.
- **Consent (RJ 2026-07-10):** approved HVS, WW, S. Riviere to show publicly. 3R (already a live client site) + BBC Playbook (ours) included too. **Cavalry held out** — card removed, screenshot kept at `assets/portfolio/pf-cavalry.jpeg`, re-add when RJ clears it. Page now has **5 cards**. `noindex` **removed** — index-ready on deploy.
- **Verified locally (headless, 1280 + 375):** 0 JS errors; 6 images load (0 broken); no horizontal overflow at either width; fade-in reveals fire on real scroll; CTA tap target 56px. Screenshots: `.playwright-mcp/lb-final-desktop2.jpeg` + `lb-final-mobile.jpeg`.
- ⚠️ **Follow-ups (do in the deploy batch):**
  1. **Cavalry** — re-add its card once RJ approves showing it.
  2. **/os tile** — add a "Live Builds" quick link on the /os Command Center (optional; nav path already works).
  3. Add `live-builds.html` to `sitemap.xml` + consider a main-nav entry.

## 🔄 WORKFLOWS DASHBOARD — clickable deliverable checkboxes + two-way sync — STAGED 2026-07-04
- **What RJ asked:** on /os → Workflows, every workflow shows checkboxes for each deliverable (page, email marketing, reel, carousel, social). RJ can tap to check/uncheck in real time; state syncs to EVERY device AND to the whole system (two-way: when a BBC script finishes an asset it auto-checks the same box). New workflows auto-appear.
- **NEW `netlify/functions/workflows.mjs`** — shared state store on **Netlify Blobs** (same zero-config engine as cards.mjs/team-chat.mjs; no token/DB). Single source of truth. Ops: `setArtifact` (flip one checkbox), `setLink`, `addWorkflow` (register a brand-new workflow at runtime — auto-appears on every dashboard, no HTML edit), `removeWorkflow`, `bulk` (mass import, e.g. Emmy's master list). GET returns `{artifacts,links,extra,updated}`. Syntax verified (node --check OK).
- **os/index.html + SOURCE `COMMAND_CENTER/app/index.html`** (both edited, in sync):
  - Added **`email`** as a 6th deliverable type (icon ✉) so email-marketing is trackable per workflow. Changed `social` icon to ◉ (was ✉). artifactOrder = graphic ▦ · video ▶ · page ▤ · email ✉ · social ◉ · zip ⬇.
  - The deliverable matrix cells are now **clickable toggles** (`wfArtToggle`) — optimistic UI + POST to the store + localStorage fallback + audit entry via existing `notifyEdit` feed. Same toggle on the detail sheet's per-deliverable rows (○/✔).
  - On load: `wfLoadState()` fetches the shared store and merges overrides onto `D.workflows` (+ merges runtime-added `extra` workflows), then re-renders. Falls back to localStorage offline / pre-deploy so it never breaks.
  - Per-artifact **links** now also read/write the shared store (were localStorage-only).
  - Subtitle + sheet help text updated to say cells are tappable and sync everywhere.
- **NEW `_tools/workflow-check.mjs`** — CLI any BBC script/VA/Claude runs to auto-tick a box or register a new workflow: `node workflow-check.mjs w03 email true` / `node workflow-check.mjs --add '{...}'`. This is the "system side" of the two-way sync (wire content generators to call it as they finish assets).
- **Verified locally (headless):** Workflows view renders 17 workflows × 6 deliverable columns = 102 tappable cells; clicking `w01/graphic` flips off→on + re-renders; email column present; 0 JS errors (the only console errors are the expected 404/501 because the Netlify function isn't running on the plain local server — works on the live host). All 5 inline script blocks pass `node --check`.
- ⚠️ **After deploy:** the shared sync + cross-device only work once the `workflows` function is live (Netlify freeze). Until then each device uses its own localStorage copy. Emmy is compiling the master workflow list on another session → import it via `bulk`/`--add` (or add to the seed `D.workflows`) once ready. To wire full auto-check, have each content generator (Vidz reel, Raphy carousel, Emmy email, insights page) call `workflow-check.mjs` on completion.

### Added 2026-07-04 (part 2) — Workflow impact ordering + Home page + desktop icon
- **Workflow page — impact ordering (editable):** each workflow now has an **impact tier** badge (★ high · ● medium · ○ low). Categories AND workflows sort **highest-impact first**. Default tier comes from a transparent heuristic (business-usable + BBC-marketing signals in the workflow's own title/angle/audience — nothing invented); **tap the badge to change it**, saved to the shared store (`setPriority` op added to `workflows.mjs`) so the ranking syncs everywhere. New CSS `.wfimp`.
- **Home page:**
  - Dashboard now **always opens on Home** (boot forces `go('home')` + clears any bookmarked hash; in-session nav unaffected).
  - **Client updates section is now first on Home** — a box per active client; tap a box → that client's important emails, pulled **live from rj@balaynibruno.co** via the existing `gmail-read.mjs` function, categorized per client (query = client domain + name). Tap an email → full thread. Graceful message if the inbox connection isn't live. New fns `clientMail` / `clientMailThread` / `clientMailQuery`. (Some clients email from a personal address — add it to the query map as RJ supplies it.)
- **Desktop icon — `C:\BBC\bbc-dashboard\`** (Plus; run `create-shortcut.ps1` on each other device):
  - `BBC Dashboard.lnk` on the desktop → `open-dashboard.vbs` (hidden) → `open-dashboard.ps1`: **refreshes dashboard data** (`sync-dashboard.mjs --no-push`, picks up new videos/graphics the team+system finished), warms the live endpoints, runs an optional `bbc-system-sync.ps1` hook if present, then **opens the dashboard**. `-Local` switch previews the local build pre-deploy. Icon `bbc.ico` generated from the BBC logo.
- **Verified locally (headless):** Home renders the client-updates section + 17 client boxes + forces `#home`; Workflows renders 17 editable impact chips sorted highest-first; tapping a chip persists the new tier (`bbc_wf_prio` + shared store); client-box tap opens the email sheet with graceful offline fallback; 0 JS errors; all inline blocks pass `node --check`; `workflows.mjs` passes `node --check`.
- ⚠️ **Follow-on (next session, per RJ):** the deeper **two-way system sync** — a `bbc-system-sync.ps1` (headless Claude run) that reads **WhatsApp (WhatsApp MCP) + client email**, writes client tasks/updates into the store, and flips workflow boxes when it sees an asset was finished / a task resolved. The icon already calls this hook if present. Email is already live server-side; WhatsApp needs the local hook.

### Added 2026-07-04 (part 3) — CRM: Email Workflows tab (lead status by email step + list counts)
- **New CRM tab "Email Workflows"** (now the default tab when you open CRM), in `os/index.html` + SOURCE `COMMAND_CENTER/app/index.html`:
  - **Lead lists — how many on each:** live count per Brevo list (Ecommerce/Shopify, Builder, Remodeler, Design, Active, Old, Possible) via the existing `brevo.mjs?action=lists`.
  - **Email marketing workflows:** both drip sequences — **Builder Welcome (4-email)** + **Weekly Workflow Series (6-email)** — each with a **funnel** (how many leads reached / sit at each email) and a **per-lead row showing which email they're on as filled checkboxes** (✓✓○○ = on email 2 of 4), exactly like the Workflow page. Searchable by email.
  - New render fn `crmEmailwf`; tab wired into `crmTab` + default `__crm.tab='emailwf'`.
- **NEW `netlify/functions/campaign-status.mjs`** — Netlify Blobs store (`bbc-campaign-status`) holding the computed drip summary. GET for the dashboard; POST `{op:"set",data}` from the engine. Passes `node --check`.
- **NEW `C:\BBC\bbc-email-campaign\push-campaign-status.mjs`** — reads the campaign send logs (`bbc_campaign_log.csv` + `bbc_workflow_log.csv`) + both configs, computes each lead's furthest email step + step distribution, and **pushes it to the store**. Wired into **`run_daily.ps1`** (pushes after each daily send) AND the **desktop icon** (`open-dashboard.ps1`) so it's fresh on open. Also writes a local `campaign_status_snapshot.json`.
- **Verified locally (headless, stubbed with the REAL computed snapshot):** Email Workflows tab is the default CRM tab; lead-list boxes render (Shopify 512, Builder 340, …); Builder Welcome funnel shows **182 → 61 → 0 → 0** reached; **182 lead rows**, each lead's step as filled checkboxes (`jeff@groupthreebuilders.com` = ✓✓○○ = email 2/4 = 50%). 0 JS errors; all inline blocks + both new functions pass `node --check`. Real numbers computed from the live log: 182 leads, 121 on email 1, 61 on email 2.
- ⚠️ **After deploy:** the tab is live once `campaign-status.mjs` deploys AND the engine has pushed once (`run_daily.ps1` does it nightly; or run `node push-campaign-status.mjs` manually). Lead-list counts are live immediately (Brevo). Weekly Workflow Series shows 0 until that sequence starts sending.

### Added 2026-07-04 (part 4) — Two-way CLIENT SYNC (WhatsApp + email → dashboard)
- **What RJ asked:** client tasks/requests from WhatsApp + email land on the dashboard automatically; resolving one (in chat, email, or by checking it off on the dashboard) updates everywhere.
- **NEW `netlify/functions/client-tasks.mjs`** — Netlify Blobs store (`bbc-client-tasks`). Deterministic task ids (hash of client+text) so re-syncing never duplicates; **never re-opens a task a human already closed**. Ops: upsert / bulk / resolve / reopen / dismiss / delete. GET (optionally `?client=slug`). Passes `node --check`.
- **os/index.html + SOURCE `COMMAND_CENTER/app/index.html`** (both edited):
  - **Home** now has a **"Client tasks needing attention"** panel (open tasks across all clients, each with a done checkbox + dismiss) and **per-client badges** (🔴 N open) on each client box.
  - **Client box drill-down** (`clientMail`) shows **"Requests & tasks"** (from WhatsApp + email, each with ○/✔ done + dismiss) above the emails.
  - Checking a task done → optimistic UI (removes it + drops the badge) + POST resolve → persists everywhere. Two-way. `renderClientTasks` renders from local state to avoid a POST/GET race.
  - Robustness: client boxes now fall back to a name-derived slug when a client record has no `slug` (fixes slug-less clients like JR Signing); `clientMail` matches by slug OR derived slug.
- **NEW `_tools/client-task.mjs`** — CLI to add/resolve/bulk client tasks (the sync + any script use it).
- **Sync routine:** **`~/.claude/commands/bbc-sync.md`** (`/bbc-sync`) — Claude reads recent email (Gmail MCP) + WhatsApp (its MCP, when loaded) per active client, extracts open tasks + resolutions, pushes via `client-task.mjs bulk`, marks resolved ones done. Reliable path = run in a Claude session. **`C:\BBC\bbc-dashboard\bbc-system-sync.ps1`** = the desktop-icon hook that attempts the same headlessly (best-effort; `open-dashboard.ps1` already calls it).
- **Seed from a REAL sync run (this session, email half):** `_tools/client_tasks_seed.json` — 9 real open tasks extracted from rj@balaynibruno.co (6 Freccia, 3 JR Signing). Push after deploy: POST the file to `/.netlify/functions/client-tasks` (op:bulk) or `node client-task.mjs bulk`.
- **Verified locally (headless, stubbed with the real seed):** Home shows the 9-task panel; Freccia box badge "🔴 6 open", JR "🔴 3 open"; tapping a client shows their tasks + emails; clicking done removes it (9→8) and drops the badge (6→5) + POSTs resolve. 0 JS errors; all inline blocks + `client-tasks.mjs` pass `node --check`.
- ⚠️ **Constraint:** WhatsApp needs its MCP loaded (restart) — the email half is proven live now; WhatsApp activates when `/bbc-sync` runs in a session with the WhatsApp MCP. Live seeding + ongoing sync happen after the `client-tasks` deploy.

## 🔐 BRUNO PASSWORD VAULT — STAGED 2026-06-29 (do not push alone; goes in the next batch)
- **What:** RJ's personal encrypted password vault behind the 🔒 Bruno Page lock in /os. Zero-knowledge: passwords are encrypted/decrypted IN-BROWSER (WebCrypto PBKDF2 250k → AES-GCM 256) with RJ's MASTER password, which is never sent or stored. Server only ever holds the encrypted blob.
- **Files:** NEW `netlify/functions/vault.mjs` (Netlify Blobs store `bbc-vault`, key per-owner; gated: valid /os Supabase token AND email ∈ {rj@balaynibruno.co, rjbryantresreyes@gmail.com} — RJ-only, even other BBC team can't read; refuses any non-encrypted payload). Frontend vault module + CSS + go() hook added to BOTH `os/index.html` (repo) AND the SOURCE `COMMAND_CENTER/app/index.html` (so the dashboard-sync mirror keeps it). Syntax verified (0 errors) + scoping verified on both copies.
- **Behavior:** Unlock card on the Bruno Page → master password → first time creates the vault, after that decrypts it. Add/edit/delete entries (label, username, password [masked, show/copy], url, notes), each save re-encrypts the whole blob. "Lock" clears it from memory; leaving the page clears it.
- **RJ enters his own passwords** in the browser — I never see them (zero-knowledge). Nothing was imported from any Drive file (respects the no-secrets-on-Drive rule).
- ⚠️ **Verification:** code/syntax/scoping verified; the unlock + crypto + sync round-trip needs the live Netlify function + Supabase login, so it can only be confirmed on the deploy (preview tooling + login/function aren't available locally this session). After deploy: log into balaynibruno.co/os → 🔒 → set a master password → add one entry → reload → confirm it decrypts.
- Marketing-sheets-as-slides idea: DEFERRED (RJ chose vault-only this round).

# ⏳ PENDING PUSH — hold until Netlify credit is back

> **STATUS 2026-06-26:** The "BUILT + STAGED" items below (Tools section, Brevo CRM, our-work, story pages) are already committed + LIVE — verified via `git ls-files` (tracked) and a clean `origin/master..HEAD` (nothing unpushed). This manifest is STALE. Deploys are flowing again (messenger v3 + Messy shipped 2026-06-26, commit e25c19a). Next time, trust the git sweep over this file. ⏳ Genuinely-open follow-ups now: set Netlify env `BREVO_API_KEY` (CRM page) + `ANTHROPIC_API_KEY` (Messy live answers); mirror Tools pages to `BBC WEBSITE HTML\` for Drive visibility.

**Created:** 2026-06-11
**Why holding:** Netlify production deploys are frozen (Pro plan credits exhausted 2026-06-10, ~199 deploys in 9 days). Do NOT push until credit/auto-recharge is restored. See [[project_netlify_deploy_cost_fix]] + LEARNINGS/2026-06-10_netlify_deploy_cost_and_tooling.md.

**When credit is back:** RJ says "Netlify credit is back" / "push everything" → build the queued pages below, then commit + push from `C:\BBC\bbc-website` (off-Drive repo). Mirror changed files to `BBC WEBSITE HTML\` for visibility. Verify mobile 375/768/1280 before push (MOBILE-FIRST rule).

---

## ✅ BUILT + STAGED (all done locally, just commit + push when credit's back)
- **NEW "Tools" section (2026-06-23)** — new top-nav header **Tools** → `tools.html` (collection page) + 38 per-tool pages `tool-<slug>.html`. Data-driven: single source of truth `tools/tools-data.json`, generator `_tools/build-tools.mjs` (harvests head/header/footer from our-work.html so it never drifts; re-run `node _tools/build-tools.mjs` after any data edit). Collection = hero + sticky category pills + 8 categories (Your AI Team, Websites, Social, Video/Audio, Design, Online Stores, CRM/Email, Automation), each with intro + cards + "See all N tools" expand. Each tool page = What it is / How we use it / How it helps your business / How it helps you + PDF download + CTA. Verified mobile 375 + desktop 1280. ✅ NOW COMPLETE: (1) master PDF built → `tools/downloads/bbc-tools-and-capabilities.pdf` (18pp, branded; regen: `node _tools/build-tools.mjs` then `python _tools/render-pdf.py`) — went with ONE master PDF instead of 38 thin per-tool PDFs (all download buttons point to it); (2) "Tools" nav injected into all 35 full-nav pages (desktop + mobile + footer) via `_tools/inject-tools-nav.mjs` — the ~108 insight/SEO article pages keep their minimal "Back to Insights" nav by design; (3) sitemap.xml updated (+39 entries). ⏳ ONLY LEFT at push: mirror the changed files to `BBC WEBSITE HTML\` for Drive visibility.
- **/os CRM page → Brevo (NEW, 2026-06-22)** — replaced the NocoDB CRM with a Brevo-powered CRM: list tabs + live counts (Active/Old/Possible/Ecommerce/Builder/Remodeler/Design), searchable contact list, inline editable **Status** dropdown (New/Contacted/Interested/Proposal/Won/Lost), and add-contact. New function `netlify/functions/brevo.mjs` (key server-side). Edited BOTH /os copies (repo `os/index.html` + Drive `COMMAND_CENTER/app/index.html`). JS validated. ⚠️ **At deploy: set Netlify env var `BREVO_API_KEY`** (Site settings → Environment variables) or the CRM page can't authenticate. Send-email panel kept; old NocoDB A/B tracker retired.
- **our-work.html** — S. Riviere client card updated (editorial online store + Olivia AI). PLUS: AJ Battle card fixed (Visa→Vi, EA role, recent info). PLUS: NEW **MNJ Insurance founding-client card** (gold "Founding Client" treatment, links to the story page).
- **how-balay-ni-bruno-started.html** — NEW founder origin-story page ("How Did Balay ni Bruno & Co. Start?"), centered on MNJ Insurance / Julie Jennings as the gateway client + the paycheck-vs-relationship story. Article+FAQPage schema, step-flow + takeaways, CTA. Category "Our Story".
- **our-work.html (Crown Limited Supply card REFRAMED)** — was framed as Kenz ops support; now reframed to RJ's real founding story (his first Shopify + Klaviyo + Amazon, built/ran end-to-end), gold "Foundational Client" treatment, team badge Bruno, links to the new growth-story page. ⚠️ NOTE: removed the "Kenz · Operations & Content" badge per RJ's account — if Kenz also worked CLS, RJ to confirm and we add Kenz back.
- **can-a-va-learn-new-skills-as-you-grow.html** — NEW growth-story page ("Can a Virtual Assistant Learn New Skills As My Business Grows?"), anchored in the Crown Limited Supply story (anime brand → first Shopify → first email → first Amazon), owner kept unnamed (privacy). Article+FAQPage schema, step-flow + stat cards + tip box. Category "Our Story".
- **our-work.html (NEW Blackbelt Commerce card)** — Shopify Plus agency we do content/podcast(Beyond The Cart)/YouTube/email/SEO-blogs/case-studies for + referral partner. Team badges: Bruno · Content/Video/Podcast, Al · Social Media, Jade · Graphics & SEO Blogs. Naming CLEARED by RJ (they know we're an agency).
- **should-an-agency-outsource-its-own-content.html** — NEW case-study page ("Should My Agency Outsource Its Own Content and Email?"), now NAMES Blackbelt Commerce + the "Beyond The Cart" podcast (RJ cleared naming). Article+FAQPage schema, step-flow + takeaways. Category "Case Study".
- **our-work.html (NEW Orbital SEO card)** — SEO agency, foundational client (gold treatment). Team: Bruno · Social & Content, Kenz · Content & Graphics (owner Alex is the client, not a BBC badge). First brand Twitter + first AI image gen. Links to the AI-images story page.
- **can-ai-create-the-images-for-my-social-media.html** — NEW story page ("Can AI Create the Images for My Brand's Social Media?"), anchored in Orbital SEO (first AI image gen + first brand Twitter). Article+FAQPage schema, step-flow + stat cards + tip box. Category "Our Story".
- **our-work.html (2 NEW cards: Entropy Management + SugarBabyCreative)** — creator/model-management work, framed SFW per locked decision ("Creator & Model Management" / "digital audience engagement", NO OnlyFans/platform wording). Entropy = Bruno · Operations Manager (systems/SOPs/team). SugarBaby = Bruno · Ops/Content/Engagement (current paying engagement). All Ryze card already existed (unchanged, already SFW).
- **our-work.html (NEW DuDilagent AI card)** — full lead generation for an AI M&A due-diligence company (client Humphry Narty, referred by Bab). Team: Kenz + Daryl · Lead Generation. Links to the lead-gen page.
- **can-someone-handle-lead-generation-for-me.html** — NEW case-study page ("Can Someone Handle Lead Generation for My Business?"), anchored in DuDilagent. Article+FAQPage schema, step-flow + takeaways. Category "Case Study".

### LOCATION SEO LANDING PAGES (geo-targeted, name local clients)
6 geo-SEO landing pages, all with Service schema (areaServed) + FAQPage + geo keywords + named local clients + an "Areas We Serve" cross-link block connecting all 6:
- **business-support-texas.html** — Wooden Woodworks, Home Vision Studio, Real Cavalry, Hi-Up, First Class, TPIC (Austin/San Antonio/Salado/Cedar Park).
- **business-support-georgia.html** — AJ Battle Foundation, S. Riviere Hair (Atlanta).
- **business-support-california.html** — MNJ Insurance (Laguna Niguel; founding-client angle).
- **business-support-new-york.html** — Blackbelt Commerce (NYC).
- **business-support-new-jersey.html** — Crown Limited Supply.
- **business-support-florida.html** — 4Ocean (Boca Raton; creative systems + ops, hopeful tone).
- TODO before/after push: add an "Areas We Serve" nav link on the main site (footer/menu) so these pages are discoverable + internally linked.
- **manage-my-shopify-store-for-me.html** — NEW page. "Can someone make all the changes to my Shopify store for me?" (full Shopify edit capability; flooring rename example, anonymized). Article+FAQPage schema, visual kit.
- **website-that-shows-products-without-a-cart.html** — NEW page. "How do I show my products online without a shopping cart?" (catalog, no checkout, general). Schema + visual kit.
- **redesign-online-store-without-taking-it-offline.html** — NEW page. "Can I redesign my online store without taking it offline?" (draft theme → preview → one-switch go-live; tonight's S. Riviere work, anonymized as "a hair brand"). Schema + visual kit.
- **insights.html** — 3 new cards added at top of grid; count bumped 78 → 81.

All 3 pages: real facts only, client anonymized, plain English, no em-dashes, CTA = "Book a Strategy Call," cross-linked to siblings.

⚠️ Note: card images reference `images/insights/<slug>.svg` (not yet created — cards degrade gracefully to a solid navy bg until SVGs are added). Optional polish: generate the 3 cover SVGs before/after push.

## After push (do once live)
- Delete the 3 `.page-intent.md` files from INSIGHTS_PAGE_ENGINE/PAGE_QUEUE, flip their PAGE_BACKLOG rows to done.
- Mirror changed files to `BBC WEBSITE HTML\`.

## 📌 Notes
- 60 workflow/insight pages already live on the site (no action needed).
- Tonight's other workflows are captured in LEARNINGS + the 2-Shopify-accounts registry; the 3 intents above are the publish-worthy ones.
- Deploy discipline: when we DO push, it's one batch (our-work + the 3 new pages + insights.html), not repeated deploys, to conserve credit.

## Push sequence (when greenlit)
```
cd C:\BBC\bbc-website
# (build the 3 pages first)
git add -A
git commit -m "Add 3 Shopify/e-commerce insight pages + update S. Riviere work card"
git push            # Netlify auto-deploys
```

## ⏳ ADDED 2026-06-11 — S. Riviere live dashboard + owner app (NEW)
- **clients/sr/** — S. Riviere account dashboard hub (BBC internal): My SR Dashboard hub + Store (live Shopify read-only data baked in), Website, Content & SEO, Client & Tasks, plus Social/Email/Performance stubs. Static, self-contained. /os Clients → SR routes here.
- **clients/sr/app/** — Sonya's installable **owner PWA** (manifest + service worker + gold SR icons, standalone, offline shell). Home = her store at a glance; includes **Manage Products** (add/edit product → request queue). start_url/scope relative so it installs at /clients/sr/app/.
- **/os routing** — command center SOURCE edited (`BBC Operating System/03_AI_OPERATING_SYSTEM/COMMAND_CENTER/app/index.html`): clicking "S. Riviere Hair Collection" in /os Clients now routes to `/clients/sr/` (mirrors Cavalry). Ships when the dashboard sync next runs + deploys.
- ⚠️ GATING DECISION before go-live: BBC-internal pages under /clients/sr/ (client.html "waiting on Sonya", store-bbc ops notes, the IATSE/NDA line) would sit at a public URL. Recommend Netlify password-protection on /clients/sr/ (keep /clients/sr/app/ open for Sonya), or move BBC pages behind an obscured path. Decide before push.
- ⚠️ Data is a baked snapshot (pulled 2026-06-11). Refresh: re-run `_SYSTEM/TOOLS/shopify/sr_dashboard_data.py` then `sr_dashboard_build.py`, re-stage to clients/sr/. Do NOT auto-deploy on refresh (DEPLOY COST DISCIPLINE).
- ⚠️ Manage Products backend not wired — form works (downloads request + on-page queue); to auto-deliver from Sonya's phone wire Netlify Forms / Apps Script / NocoDB (see 06_DASHBOARD/_REQUESTS/README.md).
- Source build: `_SYSTEM/TOOLS/shopify/sr_dashboard_build.py` (+ sr_dashboard_data.py).

## ⏳ ADDED 2026-06-18 — Dhes client dashboard + request page (NEW)
- **clients/dhes/index.html** — Dhes's main dashboard (BBC + RJ view): KPIs (pending/in-progress/delivered/total), a task+video table seeded with the real current jobs (Macquarie Locksmiths trial reel = in progress; Solar Galaxy = queued), dark-mode toggle, and a "Send a request" CTA. Edit the `TASKS` array as work comes in / gets delivered (status: pending|progress|delivered). noindex.
- **clients/dhes/request.html** — the link to SHARE WITH DHES. Switchable 3-type request page: **Reel / Video**, **Graphic / Carousel**, **Other task**. Each is its own Netlify form with file upload + link fields. Form names: `dhes-reel-brief`, `dhes-graphic-brief`, `dhes-other-task`. Videos = paste link; images/files = upload. Submits → thanks.html. noindex.
- **clients/dhes/thanks.html** — confirmation page after submit.
- **/os SOURCE edited** (`BBC Operating System/03_AI_OPERATING_SYSTEM/COMMAND_CENTER/app/index.html`): added **Dhes** to the clients array (folder DHES, gold color) + routing special-case so clicking Dhes in /os Clients → `/clients/dhes/`. Ships when the dashboard sync next runs + deploys.
- **Drive folder** `02_ACTIVE_CLIENTS/DHES/DHES_PROJECT_CONTEXT.md` created (client context + how to update his task list).
- Removed superseded root `dhes-brief.html` + `dhes-brief-thanks.html` (replaced by the clients/dhes/ version).
- ⚠️ AFTER PUSH: in Netlify dashboard → Forms, enable an **email notification to rj@balaynibruno.co** for the 3 `dhes-*` forms (one-time). Netlify only detects the forms after the first successful deploy.
- Verified: mobile/desktop render clean (headless screenshots; right-edge clip is a capture artifact, confirmed against live contact.html). Mirrored to `BBC WEBSITE HTML\clients\dhes\`.

## ✅ LIVE 2026-06-22 — BBC Team Chat + Resources Apps section (DEPLOYED)
- **netlify/functions/team-chat.mjs** — LIVE. Human-to-human group chat store on Netlify Blobs (same engine as cards.mjs, no token/DB). GET (list, ?channel + ?since), POST (send / delete). Caps 500 msgs. AI family can read+post via the same endpoint. Data in BBC's own Netlify = "saved on our system." Verified live: POST+GET round-trip works.
- **os/index.html** — `views.team` chat UI + More-view entry + `go('team')` hook + TeamChat poll script (already shipped earlier by the dashboard-sync auto-commit; SOURCE `COMMAND_CENTER/app/index.html` carries it so syncs keep it).
- **resources.html** — NEW "Apps & Dashboards" section: BBC Team Chat (→ os/#team), Command Center, client dashboards (WW/SR/Cavalry). Mirrored to `BBC WEBSITE HTML\`.
- Deployed 2026-06-22 (commit 838b52b). The successful build confirmed **Netlify credit is back** as of this date.
- ⏳ v2 ideas (later): per-client channels, @AI to ping Cuh into the thread, mirror messages to Drive for permanent archive, unread badge on the nav, push notifications.

## ⏳ ADDED 2026-06-16 — Design-templates insight page (NEW)
- **update-brand-templates-without-a-designer.html** — NEW /insights page. "Can You Update Your Brand's Design Templates Without a Designer?" Anonymized capability page (we execute a brand's design templates in-house, swap copy + image, keep it exactly on-brand). Born from the Pine Crest Fabrics assessment workflow — NO client named, fully generic. Article + FAQPage schema, before/after + horizontal step-flow + cost-table (typical market ranges, labeled) + tool-stack + tip box + key takeaways. Category "Marketing". Plain English, no em-dashes, CTA = Book a Strategy Call. ✅ Verified mobile 375 clean, no h-overflow, no console errors.
- **insights.html** — 1 new "Marketing" card added at top of grid; count bumped 88 → 89.
- After push: delete `INSIGHTS_PAGE_ENGINE/PAGE_QUEUE/update-brand-templates-without-a-designer.page-intent.md`. Source learning: `LEARNINGS/2026-06-16_illustrator_com_automation.md`.

## ✅ DEPLOYED 2026-06-25 (commit 9766ce0) — Updated VA headshots across team pages
- Source: Krizza's "Headshots" Google Drive folder (10 photos), copied to Drive `BBC VA Headshot\`. Converted to JPG (q90, square 1254px / portrait 1086x1448) into `images/team\`. Backup of the 5 prior photos in `images/team\_backup_2026-06-25\`.
- **Photos swapped/added for 7 current members:** Bruno (`rj-bryan.jpg`), Ryan (`ryan-bernaldez.jpg`), Kenz (`kenz-villaflores.jpg`), Daryl (`daryl-agadia.jpg`), Diego (`diego-tres-reyes.jpg`) — same filenames, auto-update everywhere. **Vi (`vi.jpg`) + Krizza (`krizza.jpg`) were letter-avatars → converted to real `<img>`** in: `our-team.html`, `index.html` (home team grid), `vi.html`, `krizza.html`. Verified mobile 375 (avatars render, clean crop, no overflow).
- **SHIPPED 2026-07-11 (commit a52cdd1, LIVE):** `cuamag.jpg` = **John** (Content Creator & Marketing Support) — card + `john.html` live. **Dexter** (Senior Graphic Designer & Video Editor) — card + `dexter.html` live with 3 non-client Selected Work images (`images/dexter/`). **Al removed** (departed 2026-06-12; card gone, al.html was untracked, sitemap already clean).
- **STILL pending role from RJ (Content Integrity — no card until roles given):** `joshua.jpg`, `hazel.jpg` in `images/team\`. Hazel = Future Head of Medical VA Team (onboarding) per roster; Joshua = unknown. No confirmed name/role/bio = no card.
- **Al** still has a card (`our-team.html` letter-avatar "A") but departed BBC 2026-06-12 and has no new headshot. DECISION NEEDED: remove the card or keep.
- Mirrored all team images to `BBC WEBSITE HTML\images\team\`. NOT committed/pushed — goes out with the next batch on RJ's go.

## ✅ DEPLOYED 2026-06-25 (commit 9766ce0) — Messenger (chat/) team avatars fix
## (still needs RJ to tap "Import team photos from website" once in the chat to populate avatars)
- **Problem:** in the chat (`chat/index.html`, backend `netlify/functions/bbc-msg.mjs`), only Krizza showed a photo; everyone else was a letter. Avatars are stored server-side per Supabase user; only RJ + Krizza had set theirs, and the old "Import team photos" button (a) only mapped Daryl/Diego/Kenz/Ryan by email, (b) missed Vi, (c) used hardcoded emails.
- **Fix:** `bbc-msg.mjs` `setAvatarFor` now accepts `{ id }` (preferred) as well as `{ email }` (back-compat). `chat/index.html` import now iterates the loaded `ROSTER`, matches each member by FIRST NAME against `TEAM_PHOTO_BY_NAME` (Bruno, Vi, Krizza, Ryan, Kenz, Daryl, Diego → `/images/team/*.jpg`), and sets the avatar by id. No emails needed; picks up new teammates by name; re-runnable to refresh.
- **To make photos appear (needs deploy):** the fix + the new `images/team/*.jpg` must be live, then a HUB user (RJ) opens chat → settings → **Import team photos from website** once. (Can't be verified in the static preview — needs Supabase auth + the live function.)
- Two files changed: `chat/index.html`, `netlify/functions/bbc-msg.mjs`. Not pushed.

<!-- deploy-trigger 2026-06-30: publish Bruno vault seed button (os/index.html only — force build past the os/-skip rule). -->

## 📅 ADDED 2026-07-04 (part 5) — Home page: "Upcoming interviews & calls" card — STAGED
- **What RJ asked:** his upcoming interviews should show on the /os dashboard (alongside calendar + reminders), and go out with the next deploy batch.
- **os/index.html + SOURCE `COMMAND_CENTER/app/index.html`** (both edited, in sync): new **"Upcoming interviews & calls"** section on the **Home** view, right under the client-tasks panel. Renders from a small inline `IV` array (easy to edit — add/remove a line per interview). Each card shows who · when (PH time) · a status pill (green "confirmed" / gold "to book") · a note · a "Join Google Meet" link when present. Uses existing `panel`/`panelgrid`/`ptitle`/`pill` classes, matches the dashboard style, mobile-safe (word-break on the link).
- **Seeded with 2 real items:** Edward (Dogument / PettiChat) — Wed Jul 8, 5:00 PM PH, Meet https://meet.google.com/zvw-abmw-swe (confirmed); Jena (Pine Crest Fabrics VA role) — week of Jul 6, time not set (to book).
- **Follow-on (optional):** make it live-driven from Google Calendar (pull events tagged interview) instead of the inline array, so it updates itself. Inline array is the reliable v1.
- Pattern matches the existing Home-view IIFE blocks (`${(()=>{...})()}`); `esc()` in scope. Static-preview render not screenshot-verified (Home sits behind the team login gate) — low risk, isolated additive block.

<!-- deploy-trigger 2026-07-04e: Home page "Upcoming interviews & calls" card (os/index.html + SOURCE). -->

<!-- deploy-trigger 2026-07-07: Site Map & Health view in /os Websites (page graph + SEO health). -->

## 📄 ADDED 2026-07-10 — D5 nightly insight-page routine — STAGED
- **NEW `can-ai-keep-me-organized-and-remind-me.html`** — "Can AI Keep My Business Organized and Remind Me of Things?" STAGED 2026-07-10 by D5 insight-page routine. Grounded in Kriz's real capability set (`BBC_AI_FAMILY/KRIZ/` — daily tracker, reminders engine, bills/important-dates trackers, idea inbox, cross-AI pending) + the global per-device reminder engine rule (stays silent unless something is due; corrections stick). Category Operations. Article + FAQPage schema, step-flow + roadmap + tip-box visuals, CTA, related-reads, footer. No em-dashes, no invented facts.
- **insights.html** — 1 new Operations card added at top of `.article-grid`; count bumped 104 → 105.
- **sitemap.xml** — new `<url>` entry added for the slug.
- Mirrored to `BBC WEBSITE HTML\can-ai-keep-me-organized-and-remind-me.html`.
- Duplicate-guard: grepped `insights.html` + globbed root slugs for "remind"/"organized"/"reminder" — no existing page covers this exact question. Clear to build.
- Row 1 of `C:\BBC\routines\insight-pages\topics_backlog.md` flipped to ✅ with this slug.

## 📄 ADDED 2026-07-10 (run 2) — D5 nightly insight-page routine — STAGED
- **NEW `can-ai-write-captions-that-sound-like-my-brand.html`** — "Can AI Write My Captions So They Sound Like MY Brand, Not Generic?" STAGED 2026-07-10 by D5 insight-page routine. Grounded in Sonny's Master Caption Workflow (`BBC_AI_FAMILY/SONNY/SONNY_KNOWLEDGE_BASE/SONNY_CAPTION_WORKFLOW.md` — brand voice non-negotiables, quality checklist, cross-machine drift pitfall) + the global Client Brand Purity Rule (brand-voice firewall concept, no DNA bleed between brands). Distinct angle from the two existing caption pages (jargon-free plain English; trending tie-ins) — this one is specifically brand-voice consistency. Category Marketing. Article + FAQPage schema, step-flow + before/after + tip-box visuals, CTA, related-reads, footer. No em-dashes, no invented facts.
- **insights.html** — 1 new Marketing card added at top of `.article-grid`; count bumped 105 → 106.
- **sitemap.xml** — new `<url>` entry added for the slug.
- Mirrored to `BBC WEBSITE HTML\can-ai-write-captions-that-sound-like-my-brand.html`.
- Duplicate-guard: grepped `insights.html` + globbed root slugs for caption/content-related terms; read both adjacent caption pages in full to confirm they cover jargon-translation and trending tie-ins, not brand-voice consistency. Row 3 of the backlog (`how-to-turn-my-work-into-content-that-markets-me`) was found to duplicate the already-live `how-we-document-every-process-as-content.html` (same PROCESS-AS-CONTENT rule, same core question) — marked `~ COVERED`, skipped, not built.
- Row 2 of `C:\BBC\routines\insight-pages\topics_backlog.md` flipped to ✅ with this slug; Row 3 flipped to `~ COVERED`.

## 📄 ADDED 2026-07-11 — Reviews routine: Sonya + Essence client pages + wiring — STAGED
Reviews routine: Sonya + Essence client pages + wiring. Staged, awaiting Netlify batch deploy.
- **NEW `s-riviere-hair-collection.html`** — ACTIVE client story for S. Riviere Hair Collection (Sonya Riviere, luxury hair extension + wig brand, DTC on Shopify). Cloned from `top-producer-investment-capital.html` (identical head styles, header, footer, scripts). Sections: hero, who-they-are, what-we-do (Shopify store, product system/pages, social content, email marketing, SEO), verbatim Google review, CTA. Gold monogram circles ("SR") instead of logo/photo images (no broken img refs). No founding year/city/website/socials (unverified). No em-dashes.
- **NEW `essence-bembry.html`** — PAST client story (founder of several businesses, 4+ year partnership). Lean testimonial-led page: hero, "The Work" (websites, spreadsheets, social media, staying organized — strictly from her review), verbatim Google review, CTA. Gold monogram ("EB"). No invented business names/industry/city/website/socials. No em-dashes.
- **our-work.html** — S. Riviere work card "View Details" link repointed from `contact.html` → `s-riviere-hair-collection.html`. (No Essence card created — she has no brand/logo, a fabricated card would break Content Integrity.)
- **insights.html** — 2 new Case Study cards added after the Top Producer card (S. Riviere + Essence Bembry), solid `#2a3f5e` card backgrounds (no missing SVG refs).
- **sitemap.xml** — 2 new `<url>` entries added (both `.html`, priority 0.7).
- **index.html** — NOT changed. Home reviews grid (Ryan Tanel, Sonya, Marla) already links to the Google URL; left at 3 cards (a 4th would leave a lone card on row 2).
- Both new pages + all edits mirrored to `BBC WEBSITE HTML\`. Review link on both pages/cards = https://share.google/FESMGRclQ5h9yK7jY. Not pushed/deployed.

# 🟡 STAGED 2026-07-21 (reviews routine) — Freccia connected to insights hub
- `insights.html` — added the Freccia Construction case-study card (was missing from the hub; other 4 review pages already there). EVERYTHING-CONNECTED fix.
- `social-media/review-freccia-construction/` — hosted reel + 5 slides + story + caption for the scheduled Metricool posts (reel 08-09, story 08-10, carousel 08-11). Ships with this deploy so Metricool can fetch by URL.
