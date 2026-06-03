// Read-only Gmail preview for the BBC Command Center (/os) Inbox tab.
// Uses an OAuth refresh token (gmail.readonly) stored ONLY in Netlify env vars:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// GET /.netlify/functions/gmail-read            -> recent inbox threads (list)
// GET /.netlify/functions/gmail-read?threadId=X -> one thread with message bodies
// Read-only: cannot send, delete, or modify mail.

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

// Walk a Gmail payload tree and pull the best text body (prefer text/plain).
function extractBody(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) { if (p.mimeType === "text/plain" && p.body?.data) return b64(p.body.data); }
    for (const p of payload.parts) { const r = extractBody(p); if (r) return r; }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) return b64(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

export default async (req) => {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (!process.env.GOOGLE_REFRESH_TOKEN) return json({ error: "Gmail not connected yet (Netlify env vars missing)." }, 500);

  try {
    const token = await getAccessToken();
    const H = { Authorization: `Bearer ${token}` };
    const url = new URL(req.url);
    const threadId = url.searchParams.get("threadId");

    // Single thread -> full bodies
    if (threadId) {
      const t = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, { headers: H })).json();
      const messages = (t.messages || []).map((m) => {
        const hdr = (n) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === n)?.value || "";
        return { from: hdr("from"), to: hdr("to"), date: hdr("date"), subject: hdr("subject"), body: extractBody(m.payload) || m.snippet || "" };
      });
      return json({ threadId, messages });
    }

    // List recent threads (metadata only)
    const q = url.searchParams.get("q") || "in:inbox";
    const max = Math.min(parseInt(url.searchParams.get("max") || "15", 10) || 15, 25);
    const list = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=${max}`, { headers: H })).json();
    const threads = list.threads || [];
    const out = [];
    const SELF = ["rj@balaynibruno.co", "admin@balaynibruno.co"];
    const emailIn = (s) => { const m = (s || "").match(/<([^>]+)>/); return (m ? m[1] : (s || "")).toLowerCase().trim(); };
    for (const th of threads) {
      const t = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${th.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: H })).json();
      const msgs = t.messages || [];
      const last = msgs[msgs.length - 1] || {};
      const hdr = (m, n) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === n)?.value || "";
      // All non-self participant emails across the whole thread (so a thread where YOU replied last still maps to the lead)
      const parties = new Set();
      msgs.forEach((m) => { [hdr(m, "from"), ...hdr(m, "to").split(",")].forEach((a) => { const e = emailIn(a); if (e && !SELF.includes(e)) parties.add(e); }); });
      out.push({ id: th.id, from: hdr(last, "from"), subject: hdr(last, "subject"), date: hdr(last, "date"), snippet: last.snippet || t.snippet || "", count: msgs.length, unread: (last.labelIds || []).includes("UNREAD"), parties: [...parties] });
    }
    return json({ threads: out });
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 200) }, 500);
  }
};
