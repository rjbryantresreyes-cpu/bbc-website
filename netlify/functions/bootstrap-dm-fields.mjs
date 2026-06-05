// One-time bootstrap: add 5 Checkbox fields to the BBC CRM Contacts table.
// Adds: DM IG, DM FB, DM LinkedIn, DM TikTok, DM X (powers the /os CRM social outreach toggles).
//
// USAGE: hit this URL once with a browser:
//   https://balaynibruno.co/.netlify/functions/bootstrap-dm-fields
//
// v2 (2026-06-05): skip the meta-read step (original token lacks tableGet),
// just blindly POST each column create. NocoDB returns "duplicate" if the
// column already exists, which we treat as success.

const NOCODB_HOST = "https://app.nocodb.com";
const CONTACTS_TABLE_ID = "mjjs3wgl3705s9v";

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
  const results = [];

  // Try several endpoint shapes since NocoDB has both v1 (legacy meta) and v2 endpoints,
  // and some tokens only accept specific paths. We try v2 first, fall back to v1.
  const endpoints = [
    (tid) => `${NOCODB_HOST}/api/v2/meta/tables/${tid}/columns`,
    (tid) => `${NOCODB_HOST}/api/v1/db/meta/tables/${tid}/columns`,
  ];

  for (const f of FIELDS) {
    const body = JSON.stringify({
      title: f.title,
      column_name: f.title,
      uidt: f.uidt,
    });
    let success = false;
    let lastErr = null;

    for (const buildUrl of endpoints) {
      try {
        const r = await fetch(buildUrl(CONTACTS_TABLE_ID), {
          method: "POST",
          headers: h,
          body,
        });
        const text = await r.text();
        if (r.ok) {
          results.push({ field: f.title, status: "created", endpoint: buildUrl(CONTACTS_TABLE_ID).includes("/v2/") ? "v2" : "v1" });
          success = true;
          break;
        }
        // duplicate column → treat as already-exists / success
        if (text.toLowerCase().includes("duplicate") || text.toLowerCase().includes("already exists") || text.toLowerCase().includes("duplicate column")) {
          results.push({ field: f.title, status: "already-exists" });
          success = true;
          break;
        }
        lastErr = { code: r.status, detail: text.slice(0, 240), endpoint: buildUrl(CONTACTS_TABLE_ID).includes("/v2/") ? "v2" : "v1" };
      } catch (e) {
        lastErr = { code: 0, detail: String(e).slice(0, 240) };
      }
    }

    if (!success) {
      results.push({ field: f.title, status: "failed", ...(lastErr || {}) });
    }
  }

  const created  = results.filter(r => r.status === "created").length;
  const existed  = results.filter(r => r.status === "already-exists").length;
  const failed   = results.filter(r => r.status === "failed").length;

  return json({
    ok: failed === 0,
    table: "contacts",
    table_id: CONTACTS_TABLE_ID,
    summary: { created, existed, failed, total: FIELDS.length },
    results,
    next: failed === 0
      ? "Hard-refresh /os (Ctrl+F5) and try the social pills."
      : "Token does not have column-create permission. Manual NocoDB UI step required.",
  });
};
