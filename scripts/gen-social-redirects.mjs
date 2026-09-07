#!/usr/bin/env node
/**
 * Keep /social-media/<article-slug>/ resolving to the wf-numbered folder that holds
 * the media, by regenerating a marked block in netlify.toml.
 *
 * WHY THIS EXISTS
 * Posts are scheduled in Metricool against the ARTICLE slug
 *   https://balaynibruno.co/social-media/whatsapp-for-business-client-messages/reel.mp4
 * but the media is published under its workflow folder
 *   social-media/wf110-whatsapp-for-business-client-messages/
 * Nothing reconciles the two, so the URL 404s and the post fails to publish. On
 * 2026-09-04 that silently killed 43 scheduled posts across Facebook, Instagram,
 * TikTok and YouTube while the calendar still looked full. Six were patched by hand;
 * two more broke three days later, because hand-patching does not scale.
 *
 * An alias is written ONLY when all three are true, so nothing is ever invented:
 *   1. the folder is named wf<number>-<slug>
 *   2. a real article page <slug>.html exists in the repo
 *   3. there is no real social-media/<slug>/ folder already
 *
 * Run after adding workflow content, then commit netlify.toml:
 *   node scripts/gen-social-redirects.mjs
 */
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOCIAL = join(ROOT, "social-media");
const TOML = join(ROOT, "netlify.toml");
const START = "# >>> generated: social-media article-slug aliases (gen-social-redirects.mjs)";
const END = "# <<< end generated social-media aliases";

const pairs = [];
for (const name of readdirSync(SOCIAL).sort()) {
  if (!statSync(join(SOCIAL, name)).isDirectory()) continue;
  const m = /^wf\d+-(.+)$/.exec(name);
  if (!m) continue;
  const slug = m[1];
  if (slug === name) continue;
  if (existsSync(join(SOCIAL, slug))) continue;      // real folder wins, never shadow it
  if (!existsSync(join(ROOT, `${slug}.html`))) continue; // no article, nobody links it
  pairs.push([slug, name]);
}

const block = [
  START,
  "# Do not hand-edit. Regenerate with: node scripts/gen-social-redirects.mjs",
  ...pairs.flatMap(([slug, folder]) => [
    "[[redirects]]",
    `  from = "/social-media/${slug}/*"`,
    `  to = "/social-media/${folder}/:splat"`,
    "  status = 200",
    "",
  ]),
  END,
].join("\n");

let toml = readFileSync(TOML, "utf8");
const i = toml.indexOf(START);
const j = toml.indexOf(END);
toml = i !== -1 && j !== -1
  ? toml.slice(0, i) + block + toml.slice(j + END.length)
  : toml.trimEnd() + "\n\n" + block + "\n";
writeFileSync(TOML, toml, "utf8");
console.log(`wrote ${pairs.length} social-media aliases into netlify.toml`);
