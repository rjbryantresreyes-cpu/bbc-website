// BBC website change log — generates data/website-log.json from git history so the /os Websites page
// shows what has been shipped (history), the latest deploy, and how many insight pages are live.
// Run at deploy time (or anytime): node _tools/website-log.mjs
// Pairs with the live broken-page check the Websites view runs client-side.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  try { return execSync("git " + args, { cwd: ROOT, encoding: "utf8" }).trim(); }
  catch { return ""; }
}

// last 25 commits: hash | ISO date | subject
const raw = git('log --pretty=format:"%h\x1f%ad\x1f%s" --date=short -25');
const changes = raw.split("\n").filter(Boolean).map((line) => {
  const [hash, date, subject] = line.split("\x1f");
  // tag the kind of change for a coloured dot in the UI
  const s = (subject || "").toLowerCase();
  let kind = "update";
  if (/insight|page|blog/.test(s)) kind = "page";
  else if (/\/os|dashboard|command center/.test(s)) kind = "dashboard";
  else if (/fix|bug|revert|hotfix/.test(s)) kind = "fix";
  else if (/client|freccia|cavalry|ww|sonya/.test(s)) kind = "client";
  return { hash, date, subject, kind };
});

// count live insight pages (article cards in insights.html)
let insightsCount = 0;
try {
  const ih = fs.readFileSync(path.join(ROOT, "insights.html"), "utf8");
  insightsCount = (ih.match(/class="article-card"/g) || []).length;
} catch {}

const data = {
  updated: new Date().toISOString(),
  lastDeploy: changes[0] || null,
  insightsCount,
  changes,
  note: "History from git. The Websites page also runs a live broken-page check when you open it.",
};

fs.writeFileSync(path.join(ROOT, "data", "website-log.json"), JSON.stringify(data, null, 2));
console.log(`website-log.json written: ${changes.length} changes, ${insightsCount} insight pages, last deploy ${changes[0]?.hash || "?"}.`);
