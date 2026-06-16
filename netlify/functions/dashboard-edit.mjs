// Dashboard write-back + notification orchestrator.
// Single endpoint clients/VAs/RJ hit when ANYTHING editable on /os/ changes.
//
// Flow:
//   1. Validate body
//   2. Write a row to NocoDB `dashboard_edits` (audit log + source of truth)
//   3. Fire-and-forget notification email to the relevant person(s)
//   4. Return { ok: true, id } so the dashboard can mark the local UI as synced
//
// POST /.netlify/functions/dashboard-edit
//   body: {
//     dashboard_owner: "bbc" | "ww" | "hvs" | "sr" | "ajb" | "tpic" | ...,
//     editor:          "rj" | "krizza" | "beau" | "sonya" | "daryl" | "vi" | ...,
//     entity_type:     "date_note" | "date_link" | "task" | "box" | ...,
//     entity_key:      "2026-06-17" | "task:t_abc123" | "box:ww-monthly-revenue",
//     field:           "note" | "graphic_link" | "title" | ...,
//     new_value:       string,
//     dashboard_url:   string  (the page the edit happened on, for the email)
//   }
//
// SAFETY:
//   - Never auto-sends external emails. Only sends to RJ (and the owner VA when applicable).
//   - Falls back gracefully if NocoDB or Gmail is down — never blocks the dashboard UX.
//   - NocoDB token + Gmail App Password live ONLY in Netlify env, never in browser.

const NOCODB_HOST = "https://app.nocodb.com";
const NOCODB_EDITS_TABLE = process.env.NOCODB_EDITS_TABLE_ID || ""; // set after RJ creates the table in NocoDB

// Routing — who gets notified per dashboard_owner.
// Always copies RJ. The owner VA gets the second notify (cc role).
// Email addresses are not secret; they're already public on balaynibruno.co.
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

  // 1) Write audit row to NocoDB. Non-blocking — if it fails, we still try to notify.
  let nocodbId = null, nocodbError = null;
  if (NOCODB_EDITS_TABLE && process.env.NOCODB_TOKEN) {
    try {
      const r = await fetch(`${NOCODB_HOST}/api/v2/tables/${NOCODB_EDITS_TABLE}/records`, {
        method: "POST",
        headers: {
          "xc-token": process.env.NOCODB_TOKEN,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          dashboard_owner,
          editor,
          entity_type,
          entity_key,
          field,
          new_value: String(new_value ?? "").slice(0, 4000),
          notified_email: false,
          notified_session: false,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) nocodbId = data?.Id || data?.id || null;
      else nocodbError = `nocodb ${r.status}: ${JSON.stringify(data).slice(0, 200)}`;
    } catch (e) { nocodbError = String(e.message || e).slice(0, 200); }
  } else {
    nocodbError = "NOCODB_EDITS_TABLE_ID or NOCODB_TOKEN not configured";
  }

  // 2) Notify the right recipients. Always emails RJ. Always.
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

  return json({
    ok: !!nocodbId || emailOk,
    nocodb_id: nocodbId,
    nocodb_error: nocodbError,
    email_sent: emailOk,
    email_error: emailError,
  });
};
