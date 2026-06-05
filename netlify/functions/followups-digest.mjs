// BBC outreach follow-up digest.
// Reads the CRM, finds leads whose Follow Up date has arrived, emails RJ the list
// with which sequence email is next. Sends from rj@balaynibruno.co (Gmail SMTP).
//
// Triggered daily by followups-cron.mjs (Netlify scheduled function), and callable
// on demand for testing:
//   GET /.netlify/functions/followups-digest            -> send digest IF any are due
//   GET /.netlify/functions/followups-digest?dry=1       -> compute + return JSON, DO NOT send
//   GET /.netlify/functions/followups-digest?force=1     -> send even if zero are due (test the pipe)
//
// Env (already set in Netlify): NOCODB_TOKEN, GMAIL_ADMIN_PASS (rj@'s Gmail App Password).

import nodemailer from "nodemailer";

const NOCODB_HOST = "https://app.nocodb.com";
const CONTACTS_TABLE = "mjjs3wgl3705s9v";
const TERMINAL = new Set(["Booked", "Bad Fit", "Not Interested", "Bounced", "Done"]);

// Sequence map: current Campaign Step + Version -> the next email to send.
const NEXT = {
  "Intro sent": "Home Vision Studio",
  "HVS sent": "Wooden Woodworks",
  "WW sent": "Hi-Up + First Class",
  "HiUp-FCF sent": "Offer",
};
function nextEmail(step, ver) {
  const v = (((ver || "A") + "").toUpperCase() === "B") ? "B" : "A";
  const num = { "Intro sent": 2, "HVS sent": 3, "WW sent": 4, "HiUp-FCF sent": 5 }[(step || "").trim()];
  const label = NEXT[(step || "").trim()];
  return label ? `${v}${num} ${label}` : "next email";
}

// Today's date in Manila (UTC+8), as YYYY-MM-DD.
function manilaToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ ok: false, error: "NOCODB_TOKEN not set" }, 500);

  // Read all contacts
  let list = [];
  try {
    const r = await fetch(`${NOCODB_HOST}/api/v2/tables/${CONTACTS_TABLE}/records?limit=1000`, {
      headers: { "xc-token": token, accept: "application/json" },
    });
    const data = await r.json();
    list = data.list || [];
  } catch (e) {
    return json({ ok: false, error: "NocoDB read failed", detail: String(e).slice(0, 200) }, 502);
  }

  const today = manilaToday();
  const due = list.filter((c) => {
    const f = c["Follow Up"];
    if (!f) return false;
    const fday = (f + "").slice(0, 10);
    if (fday > today) return false; // not due yet
    if (TERMINAL.has(((c["Campaign Step"] || "") + "").trim())) return false;
    if (TERMINAL.has(((c.Status || "") + "").trim())) return false;
    return true;
  });

  // Sort: most overdue first
  due.sort((a, b) => ((a["Follow Up"] || "") < (b["Follow Up"] || "") ? -1 : 1));

  const rows = due.map((c) => ({
    name: c["First Name"] || c.Email || "-",
    org: c.Organization || "",
    email: c.Email || "",
    due: (c["Follow Up"] || "").slice(0, 10),
    next: nextEmail(c["Campaign Step"], c["Email Version"]),
  }));

  if (dry) return json({ ok: true, today, dueCount: rows.length, due: rows });

  if (rows.length === 0 && !force) {
    return json({ ok: true, today, dueCount: 0, sent: false, note: "Nothing due today, no email sent." });
  }

  // Build the email
  const pass = process.env.GMAIL_ADMIN_PASS; // rj@'s app password
  if (!pass) return json({ ok: false, error: "GMAIL_ADMIN_PASS not set" }, 400);

  const listHtml = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><td style="padding:6px 12px 6px 0">${r.name}${r.org ? " · " + r.org : ""}</td>` +
            `<td style="padding:6px 12px 6px 0;color:#555">${r.email}</td>` +
            `<td style="padding:6px 0;font-weight:600">send ${r.next}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="padding:6px 0">No follow-ups due today. You are clear.</td></tr>`;

  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a">` +
    `<p>Good morning RJ,</p>` +
    `<p>You have <b>${rows.length}</b> outreach follow-up${rows.length === 1 ? "" : "s"} due today (${today}):</p>` +
    `<table style="border-collapse:collapse;margin:8px 0">${listHtml}</table>` +
    `<p style="margin-top:14px">Open the CRM to send them: <a href="https://balaynibruno.co/os/#crm">balaynibruno.co/os</a>. Each due lead has a one-click button to load the next email.</p>` +
    `<p style="color:#777;font-size:13px">Keep new intros + follow-ups under ~40/day while the sender warms up.</p>` +
    `<p style="color:#777;font-size:13px">Emy · Balay ni Bruno &amp; Co.</p></div>`;

  const text =
    `You have ${rows.length} follow-ups due today (${today}):\n\n` +
    rows.map((r) => `- ${r.name}${r.org ? " (" + r.org + ")" : ""} -> send ${r.next}`).join("\n") +
    `\n\nOpen the CRM: https://balaynibruno.co/os/#crm`;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "rj@balaynibruno.co", pass },
    });
    const info = await transporter.sendMail({
      from: "rj@balaynibruno.co",
      to: "rj@balaynibruno.co",
      subject: `Outreach: ${rows.length} follow-up${rows.length === 1 ? "" : "s"} due today`,
      text,
      html,
    });
    return json({ ok: true, today, dueCount: rows.length, sent: true, id: info.messageId });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e).slice(0, 200) }, 500);
  }
};
