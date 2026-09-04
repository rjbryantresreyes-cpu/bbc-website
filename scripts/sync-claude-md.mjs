/* BBC Command Center — CLAUDE.md -> dashboard sync (FREE, no API)
 * Parses the real BBC Drive root CLAUDE.md (team roster + client tables) and:
 *   1. writes data/team.json (new, standalone — team.html fetches it directly)
 *   2. updates data/clients.json IN PLACE: only `status` + `claudeMdNote` per matched
 *      entry, never touching services/whatsapp/handler/id/folder/category. Unmatched
 *      CLAUDE.md clients get added as a new minimal entry. Unmatched existing entries
 *      (prospects, "of" clients, older past clients not in the CLAUDE.md tables) are
 *      left completely alone, just logged.
 *
 * This is a ONE-WAY read of CLAUDE.md -> dashboard data files. It does NOT touch git —
 * that's deliberate for this build (see the session that added this file). Wiring it
 * into the 30-min sync-dashboard.mjs schedule is a separate, later step.
 *
 * Run: node sync-claude-md.mjs
 */
import fs from 'fs';
import path from 'path';

const DRIVE = 'G:/Shared drives/BBC Drive';
const CLAUDE_MD = path.join(DRIVE, 'CLAUDE.md');
const WEBREPO = 'C:/BBC/bbc-website';
const TEAM_JSON = path.join(WEBREPO, 'data/team.json');
// os/*.json files (data.json, home-metrics.json, routine-snapshot.json, social-calendar.json)
// are the site's established convention for static data a page fetches directly at runtime —
// data/ itself isn't necessarily served. team.html fetches /os/team.json, so that's the file
// that actually needs to exist for the page to work; data/team.json stays the documented,
// git-diffable canonical output this script writes first.
const TEAM_JSON_SERVED = path.join(WEBREPO, 'os/team.json');
const CLIENTS_JSON = path.join(WEBREPO, 'data/clients.json');

const log = (...a) => console.log('[sync-claude-md]', ...a);
const nowIso = () => new Date().toISOString();

/* ---------------------------------------------------------------------- */
/* 0. read CLAUDE.md                                                      */
/* ---------------------------------------------------------------------- */
if (!fs.existsSync(CLAUDE_MD)) {
  console.error('[sync-claude-md] FATAL: root CLAUDE.md not found at ' + CLAUDE_MD);
  process.exit(1);
}
const raw = fs.readFileSync(CLAUDE_MD, 'utf8');
const lines = raw.split(/\r?\n/);

/* ---------------------------------------------------------------------- */
/* 1. TEAM section -> [{name, title, notes}]                              */
/*    Convention: "- Name (Full Name) — Title. optional notes"            */
/*    Departed members are wrapped whole in parens, e.g.                  */
/*    "- (Al Carmelle Managase — departed BBC 2026-06-12)" — excluded.    */
/*    FRAGILE: relies on " — " (em dash) as the name/title separator and  */
/*    the first ". " (period+space) in the remainder as title/notes       */
/*    boundary. A bullet written without an em dash, or a title that      */
/*    itself contains ". ", will parse wrong. The section boundary is     */
/*    "## TEAM" up to the next "## " heading — reordering sections in     */
/*    CLAUDE.md doesn't break this, renaming "## TEAM" itself would.      */
/* ---------------------------------------------------------------------- */
function splitTitleNotes(rightPart) {
  // Find the first ". "/".  " that's a real sentence boundary, not a single-letter
  // abbreviation like "S." in "S. Riviere" (which broke the Daryl/Dexter rows —
  // "took over S. Riviere" is not "title ends at S, notes start at Riviere").
  const ABBREV = new Set(['incl', 'etc', 'vs', 'no', 'st', 'dept', 'approx', 'est', 'mr', 'mrs', 'dr', 'jr', 'sr', 'vol']);
  const re = /\.\s+/g;
  let m, idx = -1, matchLen = 0;
  while ((m = re.exec(rightPart))) {
    const before = rightPart.slice(0, m.index);
    const word = (before.match(/(\w+)$/) || [, ''])[1];
    if (word.length <= 1 || ABBREV.has(word.toLowerCase())) continue; // abbreviation, keep scanning
    idx = m.index; matchLen = m[0].length; break;
  }
  if (idx === -1) {
    let title = rightPart.trim();
    if (title.endsWith('.')) title = title.slice(0, -1).trim();
    return { title, notes: '' };
  }
  return { title: rightPart.slice(0, idx).trim(), notes: rightPart.slice(idx + matchLen).trim() };
}

function parseTeamLine(bulletLine) {
  const line = bulletLine.replace(/^-\s+/, '').trim();
  if (/^\(.*\)\.?$/.test(line)) {
    return { skipped: true, raw: line.replace(/^\(|\)\.?$/g, '') };
  }
  const dashIdx = line.indexOf(' — ');
  if (dashIdx === -1) return { name: line, title: '', notes: '' };
  const name = line.slice(0, dashIdx).trim();
  const rightPart = line.slice(dashIdx + 3).trim();
  const { title, notes } = splitTitleNotes(rightPart);
  return { name, title, notes };
}

const teamStart = lines.findIndex(l => /^## TEAM/.test(l.trim()));
const team = [];
const teamSkipped = [];
if (teamStart === -1) {
  log('WARNING: "## TEAM" section not found — team.json will be empty.');
} else {
  for (let i = teamStart + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^## /.test(l)) break;
    if (/^-\s+/.test(l.trim())) {
      const parsed = parseTeamLine(l.trim());
      if (parsed.skipped) teamSkipped.push(parsed.raw);
      else team.push(parsed);
    }
  }
}
log(`team: parsed ${team.length}, skipped ${teamSkipped.length} (departed)`, teamSkipped.length ? '-> ' + teamSkipped.join('; ') : '');

/* ---------------------------------------------------------------------- */
/* 2. ACTIVE CLIENTS + PAST CLIENTS tables -> [{name, folder, notes, status}] */
/*    FRAGILE: columns are read POSITIONALLY (1=Client, 2=Folder,          */
/*    3=Notes/Special Rules) — a reordered or extra column silently         */
/*    misaligns everything without erroring. A literal "|" inside a cell   */
/*    (none today) would also misalign a row. The table is found by        */
/*    scanning forward from the section heading to the first line          */
/*    starting with "|", skipping one "---" separator row, then reading    */
/*    rows until a non-"|" (blank) line ends the table.                    */
/* ---------------------------------------------------------------------- */
function extractTableRows(headingRegex) {
  const startIdx = lines.findIndex(l => headingRegex.test(l.trim()));
  if (startIdx === -1) return null;
  let i = startIdx + 1;
  while (i < lines.length && !lines[i].trim().startsWith('|')) {
    if (/^## /.test(lines[i].trim())) return [];
    i++;
  }
  if (i >= lines.length) return [];
  i++; // header row
  if (i < lines.length && /^\|?\s*-{2,}/.test(lines[i].trim())) i++; // separator row
  const rows = [];
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    rows.push(lines[i].trim());
    i++;
  }
  return rows;
}

const mdStrip = s => (s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();
const cleanFolder = s => mdStrip(s).replace(/[\\/]+$/, '').trim();

function parseClientTable(headingRegex, tableStatus) {
  const rows = extractTableRows(headingRegex);
  if (rows === null) { log(`WARNING: heading matching ${headingRegex} not found.`); return []; }
  return rows.map(row => {
    const inner = row.replace(/^\|/, '').replace(/\|$/, '');
    const cells = inner.split('|').map(c => c.trim());
    const name = mdStrip(cells[0]);
    const folder = cleanFolder(cells[1] || '');
    const notes = mdStrip(cells[2] || '');
    const status = /ON HOLD/i.test(notes) ? 'hold' : tableStatus;
    return { name, folder, notes, status };
  }).filter(c => c.name && !/^Client$/i.test(c.name));
}

const activeClients = parseClientTable(/^## ACTIVE CLIENTS/, 'active');
const pastClients = parseClientTable(/^## PAST CLIENTS/, 'past');
const claudeClients = [...activeClients, ...pastClients];
log(`clients: ${activeClients.length} active-table rows, ${pastClients.length} past-table rows parsed from CLAUDE.md`);

/* ---------------------------------------------------------------------- */
/* 3. write data/team.json                                                */
/* ---------------------------------------------------------------------- */
const teamOut = {
  _note: 'Generated by scripts/sync-claude-md.mjs from CLAUDE.md ## TEAM section. Edit CLAUDE.md, not this file — re-run the script to refresh.',
  generated_at: nowIso(),
  team,
  skipped: teamSkipped.map(raw => ({ raw, reason: 'departed' })),
};
fs.mkdirSync(path.dirname(TEAM_JSON), { recursive: true });
const teamJsonStr = JSON.stringify(teamOut, null, 2);
fs.writeFileSync(TEAM_JSON, teamJsonStr);
log('wrote ' + TEAM_JSON);
fs.writeFileSync(TEAM_JSON_SERVED, teamJsonStr);
log('mirrored -> ' + TEAM_JSON_SERVED + ' (this is what team.html actually fetches)');

/* ---------------------------------------------------------------------- */
/* 4. update data/clients.json (status + claudeMdNote only)               */
/* ---------------------------------------------------------------------- */
if (!fs.existsSync(CLIENTS_JSON)) {
  console.error('[sync-claude-md] FATAL: ' + CLIENTS_JSON + ' not found.');
  process.exit(1);
}
const clientsData = JSON.parse(fs.readFileSync(CLIENTS_JSON, 'utf8'));
const CATS = ['active', 'of', 'prospect', 'past'];

const normalize = s => (s || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^\w\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// flat index of every existing entry, tagged with its category array + index
const existingFlat = [];
CATS.forEach(cat => (clientsData[cat] || []).forEach((entry, idx) => existingFlat.push({ cat, idx, entry })));

function findMatch(claudeClient) {
  const cName = normalize(claudeClient.name);
  const cFolder = (claudeClient.folder || '').toLowerCase();
  // 1. exact normalized name match
  let hit = existingFlat.find(x => normalize(x.entry.name) === cName);
  if (hit) return hit;
  // 2. folder match
  if (cFolder) {
    hit = existingFlat.find(x => (x.entry.folder || '').toLowerCase() === cFolder);
    if (hit) return hit;
  }
  // 3. substring containment either direction (tolerates combined entries like
  //    "First Class Finishes & Hi-Up Roofing" matching both "First Class Finishes"
  //    and "Hi-Up Roofing" CLAUDE.md rows)
  hit = existingFlat.find(x => {
    const eName = normalize(x.entry.name);
    return eName.includes(cName) || cName.includes(eName);
  });
  return hit || null;
}

const kebab = s => (s || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// group CLAUDE.md rows by the existing entry they resolve to, so a combined
// dashboard entry (matched by >1 CLAUDE.md row) gets one merged update, not
// two overwrites of each other.
const matchedGroups = new Map(); // existingFlat item -> [claudeClient,...]
const unmatchedClaude = [];

claudeClients.forEach(cc => {
  const m = findMatch(cc);
  if (!m) { unmatchedClaude.push(cc); return; }
  if (!matchedGroups.has(m)) matchedGroups.set(m, []);
  matchedGroups.get(m).push(cc);
});

let updatedCount = 0;
const updateLog = [];
matchedGroups.forEach((rows, m) => {
  const statuses = [...new Set(rows.map(r => r.status))];
  let finalStatus = statuses[0];
  if (statuses.length > 1) {
    const precedence = ['hold', 'past', 'active'];
    finalStatus = precedence.find(s => statuses.includes(s)) || statuses[0];
    log(`WARNING: conflicting statuses [${statuses.join(', ')}] for "${m.entry.name}" (rows: ${rows.map(r => r.name).join(', ')}) — using "${finalStatus}".`);
  }
  const claudeMdNote = rows.length === 1
    ? rows[0].notes
    : rows.map(r => `${r.name}: ${r.notes}`).join(' | ');

  const before = { status: m.entry.status, claudeMdNote: m.entry.claudeMdNote };
  m.entry.status = finalStatus;
  m.entry.claudeMdNote = claudeMdNote;
  updatedCount++;
  updateLog.push({ name: m.entry.name, matchedFrom: rows.map(r => r.name), before, after: { status: finalStatus, claudeMdNote } });
});

// unmatched CLAUDE.md clients -> add minimal new entries
const addedEntries = [];
unmatchedClaude.forEach(cc => {
  const newEntry = {
    id: kebab(cc.name),
    name: cc.name,
    status: cc.status,
    category: cc.status,
    claudeMdNote: cc.notes,
    folder: cc.folder || undefined,
  };
  Object.keys(newEntry).forEach(k => newEntry[k] === undefined && delete newEntry[k]);
  const targetArray = cc.status === 'past' ? 'past' : 'active';
  clientsData[targetArray] = clientsData[targetArray] || [];
  clientsData[targetArray].push(newEntry);
  addedEntries.push(newEntry);
});

// existing entries with no CLAUDE.md counterpart at all -> log only, never touch
const matchedEntrySet = new Set([...matchedGroups.keys()].map(m => m.entry));
const unmatchedExisting = existingFlat.filter(x => !matchedEntrySet.has(x.entry)).map(x => `${x.entry.name} [${x.cat}]`);

fs.writeFileSync(CLIENTS_JSON, JSON.stringify(clientsData, null, 2));
log('wrote ' + CLIENTS_JSON);
log(`clients.json: ${updatedCount} existing entries updated, ${addedEntries.length} new entries added, ${unmatchedExisting.length} existing entries left untouched (no CLAUDE.md match)`);

log('--- updated entries ---');
updateLog.forEach(u => log(`  "${u.name}" (from: ${u.matchedFrom.join(', ')}): status ${u.before.status || '(none)'} -> ${u.after.status}` +
  (u.before.claudeMdNote ? ' | claudeMdNote replaced' : ' | claudeMdNote added')));

if (addedEntries.length) {
  log('--- new entries added ---');
  addedEntries.forEach(e => log(`  + ${e.name} (id: ${e.id}, status: ${e.status})`));
}

log('--- existing clients.json entries with no CLAUDE.md match (untouched) ---');
unmatchedExisting.forEach(n => log('  - ' + n));

log('done.');
