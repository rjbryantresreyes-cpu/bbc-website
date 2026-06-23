/* Inject a "Tools" nav link into every page's desktop nav, mobile menu, and footer.
 * Idempotent (skips files already containing href="tools.html").
 * - Desktop: adds an <li> after the Our Work <li> (matches class variants).
 * - Mobile/footer: adds a sibling <a> after each bare Our Work anchor (copies class, drops "active").
 * Run: node _tools/inject-tools-nav.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const skip = (f) => f.startsWith('tool-') || f === 'tools.html' || f.startsWith('_');
const cleanAttrs = (a) => a.replace(/\bactive\b/g, '').replace(/class="\s*"/g, '').replace(/\s+/g, ' ').replace(/\s+>/, '>').trimEnd();

const files = readdirSync(ROOT).filter(f => f.endsWith('.html') && !skip(f));
let changed = 0, skipped = 0, untouched = 0;
const report = [];

for (const f of files) {
  const p = join(ROOT, f);
  let html = readFileSync(p, 'utf8');
  if (html.includes('href="tools.html"')) { skipped++; continue; }
  if (!/href="our-work\.html"/.test(html)) { untouched++; continue; }
  let dCount = 0, mCount = 0;

  // Pass A: desktop list items <li>...Our Work...</li>
  html = html.replace(/<li>\s*<a href="our-work\.html"( class="[^"]*")?>Our Work<\/a>\s*<\/li>/g, (m, attrs) => {
    dCount++;
    const a = cleanAttrs(attrs || '');
    return `${m}\n        <li><a href="tools.html"${a}>Tools</a></li>`;
  });

  // Pass B: bare anchors NOT immediately followed by </li> (mobile menu + footer)
  html = html.replace(/<a href="our-work\.html"([^>]*)>Our Work<\/a>(?!\s*<\/li>)/g, (m, attrs) => {
    mCount++;
    const a = cleanAttrs(attrs || '');
    return `${m}\n    <a href="tools.html"${a}>Tools</a>`;
  });

  if (dCount || mCount) {
    writeFileSync(p, html);
    changed++;
    report.push(`${f}: desktop+${dCount} bare+${mCount}`);
  } else {
    untouched++;
  }
}
console.log(report.join('\n'));
console.log(`\nChanged ${changed} files | already-had ${skipped} | no-nav/untouched ${untouched} | total ${files.length}`);
