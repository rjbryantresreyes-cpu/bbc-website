<!-- deploy-trigger 2026-06-13: force build to publish CRM follow-up first-name fix (os/index.html). -->
<!-- deploy-trigger 2026-06-13b: dynamic full-field contact merge + live refetch on cache miss. -->
<!-- deploy-trigger 2026-06-13c: shared contact loader fixes concurrency race (paste+template) -> Hi there. -->
<!-- deploy-trigger 2026-06-13d: force-refetch on lookup miss + don't clobber good cache + SW v17 (stop the few-minute revert). -->
<!-- deploy-trigger 2026-06-14: Needs Follow-Up section; follow-up click fills name from the exact record (deterministic, no race); SW v18. -->
# ⏳ PENDING PUSH — hold until Netlify credit is back
**Created:** 2026-06-11
**Why holding:** Netlify production deploys are frozen (Pro plan credits exhausted 2026-06-10, ~199 deploys in 9 days). Do NOT push until credit/auto-recharge is restored. See [[project_netlify_deploy_cost_fix]] + LEARNINGS/2026-06-10_netlify_deploy_cost_and_tooling.md.

**When credit is back:** RJ says "Netlify credit is back" / "push everything" → build the queued pages below, then commit + push from `C:\BBC\bbc-website` (off-Drive repo). Mirror changed files to `BBC WEBSITE HTML\` for visibility. Verify mobile 375/768/1280 before push (MOBILE-FIRST rule).

---

## ✅ BUILT + STAGED (all done locally, just commit + push when credit's back)
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
