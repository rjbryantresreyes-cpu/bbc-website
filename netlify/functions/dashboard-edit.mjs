// Dashboard write-back + notification orchestrator (Phase 1 + 4).
// Single endpoint clients/VAs/RJ hit when ANYTHING editable on /os/ changes.
//
// POST /.netlify/functions/dashboard-edit
//   body: { dashboard_owner, editor, entity_type, entity_key, field, new_value, dashboard_url }
//
// Storage:  Netlify Blobs store "bbc-dashboard-edits"
// Notify:   Email via send-email.mjs (Phase 1) + WhatsApp via Twilio (Phase 4)
//
// Twilio env (Phase 4) — all required to send WhatsApp; missing -> silent skip:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   e.g. "whatsapp:+14155238886"  (Twilio sandbox sender)
//   TWILIO_WHATSAPP_TO     e.g. "whatsapp:+639356630324" (RJ)

import { getStore } from "@netlify/blobs";

const STORE = "bbc-dashboard-edits";

// Routing — who gets notified per dashboard_owner.
const NOTIFY_ROUTING = {
  bbc:  { to: "rj@balaynibruno.co", cc: null },
  ww:   { to: "rj@balaynibruno.co", cc: null /* add VA when wired */ },
  hvs:  { to: "rj@balaynibruno.co", cc: null /* Beau later */ },
  sr:   { to: "rj@balaynibruno.co", cc: null /* Sonya later */ },
  ajb:  { to: "rj@balaynibruno.co", cc: null /* Vi later */ },
  tpic: { to: "rj@balaynibruno.co", cc: null /* Ryan later */ },
};

/* Twilio WhatsApp send. Returns { ok, sid?, error? }.
   Silently returns { ok: false, error: 'not_configured' } when env vars are missing
   so the dashboard-edit flow never breaks just because WA isn't wired yet. */
async function sendWhatsApp(text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.TWILIO_WHATSAPP_TO;
  if (!sid || !token || !from || !to) return { ok: false, error: "not_configured" };
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ From: from, To: to, Body: String(text).slice(0, 1500) });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `twilio ${r.status}: ${data?.message || JSON.stringify(data).slice(0, 200)}` };
    return { ok: true, sid: data?.sid || null };
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 200) };
  }
}

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad JSON" }, 400); }

  const { dashboard_owner, editor, entity_type, entity_key, field, new_value, dashboard_url } = body || {};
  if (!dashboard_owner || !editor || !entity_type || !entity_key || !field) {
    return json({ ok: false, error: "Missing one of: dashboard_owner, editor, entity_type, entity_key, field" }, 400);
  }

  const createdAt = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `${dashboard_owner}/${createdAt}_${rand}`;
  const record = {
    key,
    created_at: createdAt,
    dashboard_owner,
    editor,
    entity_type,
    entity_key,
    field,
    new_value: String(new_value ?? "").slice(0, 4000),
    dashboard_url: dashboard_url || null,
    notified_email: false,
    notified_session: false,
    notified_whatsapp: false,
  };

  // 1) Write to Blobs. Strong consistency = next read sees it.
  let blobsOk = false, blobsError = null;
  try {
    const store = getStore({ name: STORE, consistency: "strong" });
    await store.set(key, JSON.stringify(record), { metadata: { dashboard_owner, editor, created_at: createdAt } });
    blobsOk = true;
  } catch (e) { blobsError = String(e.message || e).slice(0, 200); }

  // 2) Notify the right recipients. Always RJ. Fire-and-forget but await once.
  const route = NOTIFY_ROUTING[dashboard_owner] || NOTIFY_ROUTING.bbc;
  const subject = `[BBC Dashboard] ${editor} edited ${entity_type} on ${dashboard_owner.toUpperCase()}`;
  const emailBody =
`A change was made on the BBC dashboard:

  Dashboard: ${dashboard_owner.toUpperCase()}
  Editor:    ${editor}
  What:      ${entity_type} · ${field}
  Where:     ${entity_key}
  New value: ${String(new_value ?? "").slice(0, 800)}

Open the dashboard: ${dashboard_url || "https://balaynibruno.co/os/"}

— BBC Dashboard auto-notify`;

  // Short WhatsApp body — emojis + the essential delta. 1500-char cap upstream.
  const waBody =
`🔔 BBC Dashboard
${editor} on ${dashboard_owner.toUpperCase()}
${entity_type} · ${field}
"${String(new_value ?? "").slice(0, 250)}"
${dashboard_url || "https://balaynibruno.co/os/"}`;

  // Run email + WhatsApp in parallel — total wall clock = slower of the two, not sum.
  const [emailRes, waRes] = await Promise.all([
    (async () => {
      try {
        const r = await fetch(new URL("/.netlify/functions/send-email", req.url), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from: "rj@balaynibruno.co", to: route.to, subject, body: emailBody }),
        });
        const data = await r.json().catch(() => ({}));
        return { ok: !!data?.ok, error: data?.ok ? null : (data?.error || `send-email ${r.status}`) };
      } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 200) }; }
    })(),
    sendWhatsApp(waBody),
  ]);
  const emailOk = emailRes.ok, emailError = emailRes.error;
  const waOk = waRes.ok, waError = waRes.error;

  // Mark notified flags on success (best-effort; do not block response).
  if (blobsOk && (emailOk || waOk)) {
    try {
      const store = getStore({ name: STORE, consistency: "strong" });
      const updated = { ...record, notified_email: emailOk, notified_whatsapp: waOk };
      await store.set(key, JSON.stringify(updated), { metadata: { dashboard_owner, editor, created_at: createdAt, notified_email: String(emailOk), notified_whatsapp: String(waOk) } });
    } catch {}
  }

  return json({
    ok: blobsOk || emailOk || waOk,
    key: blobsOk ? key : null,
    blobs_error: blobsError,
    email_sent: emailOk,
    email_error: emailError,
    whatsapp_sent: waOk,
    whatsapp_error: waError,
  });
};
