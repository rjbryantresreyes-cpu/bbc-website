// Auto-mark bounced leads in the CRM.
// Reads Gmail for mailer-daemon "Address not found" bounces, extracts the dead
// recipient address, matches it to a CRM contact, and sets Status=Bounced.
// Read-only on mail. Only writes the Status field. Never sends anything.
//
//   GET /.netlify/functions/bounce-sweep          -> sweep + mark Bounced
//   GET /.netlify/functions/bounce-sweep?dry=1     -> show what WOULD be marked, change nothing
//
// Env (already set): NOCODB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

const NOCODB_HOST = "https://app.nocodb.com";
const CONTACTS_TABLE = "mjjs3wgl3705s9v";
const SELF = ["rj@balaynibruno.co", "admin@balaynibruno.co"];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(d.error_description || d.error || "token refresh failed");
  return d.access_token;
}

const b64 = (s) => { try { return Buffer.from((s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return ""; } };

function extractBody(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) { if (p.mimeType === "text/plain" && p.body?.data) return b64(p.body.data); }
    for (const p of payload.parts) { const r = extractBody(p); if (r) return r; }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) return b64(payload.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

export default async (req) => {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const ntoken = process.env.NOCODB_TOKEN;
  if (!ntoken) return json({ ok: false, error: "NOCODB_TOKEN not set" }, 500);
  if (!process.env.GOOGLE_REFRESH_TOKEN) return json({ ok: false, error: "Gmail not connected" }, 500);

  // 1) Load CRM contacts -> map lead email -> { Id, Status }
  let contacts = [];
  try {
    const r = await fetch(`${NOCODB_HOST}/api/v2/tables/${CONTACTS_TABLE}/records?limit=1000`, { headers: { "xc-token": ntoken, accept: "application/json" } });
    contacts = (await r.json()).list || [];
  } catch (e) { return json({ ok: false, error: "NocoDB read failed", detail: String(e).slice(0, 200) }, 502); }
  const byEmail = {};
  for (const c of contacts) { const e = ((c.Email || "") + "").toLowerCase().trim(); if (e) byEmail[e] = c; }

  // 2) Search Gmail for bounce notifications
  let token;
  try { token = await getAccessToken(); } catch (e) { return json({ ok: false, error: "Gmail auth failed", detail: String(e).slice(0, 200) }, 500); }
  const H = { Authorization: `Bearer ${token}` };
  const q = 'from:mailer-daemon OR from:postmaster subject:(undeliverable OR "Delivery Status" OR "not found" OR failure OR returned)';
  let threads = [];
  try {
    const list = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=50`, { headers: H })).json();
    threads = list.threads || [];
  } catch (e) { return json({ ok: false, error: "Gmail search failed", detail: String(e).slice(0, 200) }, 502); }

  // 3) For each bounce, pull the body, find the dead address(es) that match a lead
  const toMark = {}; // Id -> {email, name}
  for (const th of threads) {
    let body = "";
    try {
      const t = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${th.id}?format=full`, { headers: H })).json();
      body = (t.messages || []).map((m) => extractBody(m.payload) || m.snippet || "").join(" \n ");
    } catch { continue; }
    const found = (body.match(EMAIL_RE) || []).map((e) => e.toLowerCase());
    for (const e of found) {
      if (SELF.includes(e)) continue;
      if (e.includes("mailer-daemon") || e.includes("googlemail.com") || e.includes("google.com")) continue;
      const c = byEmail[e];
      if (!c || c.Id == null) continue;
      if (((c.Status || "") + "").trim() === "Bounced") continue; // already marked
      toMark[c.Id] = { email: e, name: c["First Name"] || c.Organization || e };
    }
  }

  const marks = Object.entries(toMark).map(([Id, v]) => ({ Id: Number(Id), ...v }));
  if (dry) return json({ ok: true, dry: true, bounceThreadsScanned: threads.length, wouldMark: marks });

  // 4) Patch matched leads to Bounced (NocoDB v2 bulk update)
  let updated = 0;
  if (marks.length) {
    try {
      const r = await fetch(`${NOCODB_HOST}/api/v2/tables/${CONTACTS_TABLE}/records`, {
        method: "PATCH",
        headers: { "xc-token": ntoken, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(marks.map((m) => ({ Id: m.Id, Status: "Bounced" }))),
      });
      if (r.ok) updated = marks.length;
      else return json({ ok: false, error: "NocoDB update failed", status: r.status, detail: (await r.text()).slice(0, 200), marks }, 502);
    } catch (e) { return json({ ok: false, error: "NocoDB update error", detail: String(e).slice(0, 200) }, 502); }
  }

  return json({ ok: true, bounceThreadsScanned: threads.length, marked: updated, leads: marks.map((m) => `${m.name} (${m.email})`) });
};
