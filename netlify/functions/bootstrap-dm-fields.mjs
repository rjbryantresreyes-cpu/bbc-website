// One-time bootstrap: add 5 Checkbox fields to the BBC CRM Contacts table.
// Adds: DM IG, DM FB, DM LinkedIn, DM TikTok, DM X (powers the /os CRM social outreach toggles).
//
// USAGE: hit this URL once with a browser:
//   https://balaynibruno.co/.netlify/functions/bootstrap-dm-fields
// Idempotent — checks if each field exists before creating. Safe to hit again.
//
// SAFETY:
//  - Uses the same NOCODB_TOKEN env var (server-side only) as the read/write proxies
//  - Hardcoded to the BBC CRM Contacts table id — cannot touch anything else
//  - Only adds Checkbox columns; never drops, renames, or modifies existing fields
//  - Returns JSON with per-field status (created / already-exists / failed)

const NOCODB_HOST = "https://app.nocodb.com";
const CONTACTS_TABLE_ID = "mjjs3wgl3705s9v";

// Field set to ensure exists. Title = display name in NocoDB (with spaces).
// uidt = "Checkbox" = NocoDB's native boolean checkbox type.
const FIELDS = [
  { title: "DM IG",        uidt: "Checkbox" },
  { title: "DM FB",        uidt: "Checkbox" },
  { title: "DM LinkedIn",  uidt: "Checkbox" },
  { title: "DM TikTok",    uidt: "Checkbox" },
  { title: "DM X",         uidt: "Checkbox" },
];

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ error: "NOCODB_TOKEN not set in Netlify env." }, 500);

  const h = { "xc-token": token, "accept": "application/json", "content-type": "application/json" };

  // Step 1: list existing columns on Contacts table so we can skip what's already there.
  let existing = new Set();
  try {
    const r = await fetch(`${NOCODB_HOST}/api/v2/meta/tables/${CONTACTS_TABLE_ID}`, { headers: h });
    if (!r.ok) {
      const txt = await r.text();
      return json({ error: "Could not read Contacts table meta.", detail: txt.slice(0, 300), status: r.status }, 502);
    }
    const meta = await r.json();
    const cols = meta?.columns || [];
    cols.forEach(c => existing.add((c.title || c.column_name || "").trim()));
  } catch (e) {
    return json({ error: "Meta fetch failed.", detail: String(e).slice(0, 200) }, 502);
  }

  // Step 2: for each field we want, create it if absent.
  const results = [];
  for (const f of FIELDS) {
    if (existing.has(f.title)) {
      results.push({ field: f.title, status: "already-exists" });
      continue;
    }
    try {
      const r = await fetch(`${NOCODB_HOST}/api/v2/meta/tables/${CONTACTS_TABLE_ID}/columns`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          title: f.title,
          column_name: f.title,
          uidt: f.uidt,
        }),
      });
      const text = await r.text();
      if (r.ok) {
        results.push({ field: f.title, status: "created", code: r.status });
      } else {
        results.push({ field: f.title, status: "failed", code: r.status, detail: text.slice(0, 200) });
      }
    } catch (e) {
      results.push({ field: f.title, status: "error", detail: String(e).slice(0, 200) });
    }
  }

  const created  = results.filter(r => r.status === "created").length;
  const existed  = results.filter(r => r.status === "already-exists").length;
  const failed   = results.filter(r => r.status === "failed" || r.status === "error").length;

  return json({
    ok: failed === 0,
    table: "contacts",
    table_id: CONTACTS_TABLE_ID,
    summary: { created, existed, failed, total: FIELDS.length },
    results,
    next: failed === 0
      ? "Hard-refresh /os (Ctrl+F5) and try the social pills."
      : "Some fields failed. Check 'detail' below and add manually in NocoDB UI if needed.",
  });
};
