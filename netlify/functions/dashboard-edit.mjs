// Dashboard write-back + notification orchestrator (Phase 1, Blobs-backed).
// Single endpoint clients/VAs/RJ hit when ANYTHING editable on /os/ changes.
//
// POST /.netlify/functions/dashboard-edit
//   body: { dashboard_owner, editor, entity_type, entity_key, field, new_value, dashboard_url }
//
// Storage: Netlify Blobs store "bbc-dashboard-edits".
//   Key  = `${dashboard_owner}/${created_at_iso}_${rand}` (sortable by owner+time)
//   Value = JSON of the edit + server-stamped fields
//
// Notification: emails RJ via send-email.mjs. Future: cc-VA per owner.

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

  let emailOk = false, emailError = null;
  try {
    const r = await fetch(new URL("/.netlify/functions/send-email", req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "rj@balaynibruno.co",
        to: route.to,
        subject,
        body: emailBody,
      }),
    });
    const data = await r.json().catch(() => ({}));
    emailOk = !!data?.ok;
    if (!emailOk) emailError = data?.error || `send-email ${r.status}`;
  } catch (e) { emailError = String(e.message || e).slice(0, 200); }

  // Mark notified_email true on success (best-effort; do not block response).
  if (blobsOk && emailOk) {
    try {
      const store = getStore({ name: STORE, consistency: "strong" });
      await store.set(key, JSON.stringify({ ...record, notified_email: true }), { metadata: { dashboard_owner, editor, created_at: createdAt, notified_email: "true" } });
    } catch {}
  }

  return json({
    ok: blobsOk || emailOk,
    key: blobsOk ? key : null,
    blobs_error: blobsError,
    email_sent: emailOk,
    email_error: emailError,
  });
};
