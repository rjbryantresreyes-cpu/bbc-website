// BBC Weekly Workflow Showcase — homepage section builder
// Reads _featured/featured.json and injects the rendered HTML between the
// <!-- FEATURED:START --> and <!-- FEATURED:END --> markers in index.html.
//
// Run from anywhere:  node _featured/build-featured.mjs
//
// It updates BOTH the Drive editing copy and the live deploy repo copy
// (if the repo copy is present and already has the markers).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, 'featured.json');

// Targets to update. The first is the Drive editing copy (one level up).
// The second is the live deploy repo. Either is skipped if missing or
// if it does not contain the FEATURED markers.
const targets = [
  join(__dirname, '..', 'index.html'),
  'C:\\BBC\\bbc-website\\index.html',
];

const START = '<!-- FEATURED:START (auto-generated weekly by _featured/build-featured.mjs from _featured/featured.json — do not hand-edit between these markers) -->';
const END = '<!-- FEATURED:END -->';

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(d) {
  const cards = (d.workflows || [])
    .map(
      (w) => `        <a class="ws-card stagger-item" href="${esc(w.url)}">
          <div class="ws-card__icon">${w.icon || '⚙️'}</div>
          <div class="ws-card__cat">${esc(w.category)}</div>
          <h3 class="ws-card__title">${esc(w.title)}</h3>
          <p class="ws-card__benefit">${esc(w.benefit)}</p>
          <span class="ws-card__link">See how it works &rarr;</span>
        </a>`
    )
    .join('\n');

  const r = d.review || {};
  const s = d.stat || {};

  return `      <div class="ws-head reveal-soft">
        <span class="eyebrow eyebrow--gold">This Week at Balay ni Bruno &amp; Co.</span>
        <h2>${esc(d.headline)}</h2>
        <div class="divider-bar"></div>
        <p>${esc(d.intro)}</p>
      </div>
      <div class="ws-grid stagger-group">
${cards}
      </div>
      <div class="ws-foot">
        <div class="ws-review reveal-soft">
          <div class="review-stars">★★★★★</div>
          <p class="ws-review__quote">"${esc(r.quote)}"</p>
          <div class="ws-review__author">&mdash; ${esc(r.name)}, ${esc(r.title)}</div>
          <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="ws-review__link">See it on Google &#8599;</a>
        </div>
        <div class="ws-stat reveal-soft">
          <div class="ws-stat__num">${esc(s.number)}</div>
          <div class="ws-stat__label">${esc(s.label)}</div>
          <a href="insights.html" class="btn btn-gold btn-sm">Browse the library &rarr;</a>
        </div>
      </div>`;
}

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const inner = render(data);
const block = `${START}\n${inner}\n      ${END}`;

let updated = 0;
for (const file of targets) {
  if (!existsSync(file)) {
    console.log(`skip (not found): ${file}`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    console.log(`skip (no FEATURED markers): ${file}`);
    continue;
  }
  const before = html.slice(0, startIdx);
  const after = html.slice(endIdx + END.length);
  writeFileSync(file, before + block + after, 'utf8');
  console.log(`updated: ${file}`);
  updated++;
}

console.log(`\nWeekly showcase rebuilt — ${data.week_label} — ${updated} file(s) updated.`);
