// Secure Gmail sender for the BBC Command Center (/os) email panel.
// Gmail App Passwords live ONLY in Netlify env vars (never in the browser/repo):
//   GMAIL_ADMIN_PASS  -> App Password for admin@balaynibruno.co
//   GMAIL_RJ_PASS     -> App Password for rj@balaynibruno.co
// POST { from, to, subject, body } -> sends via Gmail SMTP. Lands in the sender's Sent folder.

import nodemailer from "nodemailer";

// Sender addresses are not secret; only their App Passwords are (in env).
// NOTE: RJ is using rj@ for now. The Netlify env var GMAIL_ADMIN_PASS currently holds
// rj@'s App Password. When admin@ is added later, give it its own App Password var.
const ACCOUNTS = {
  "rj@balaynibruno.co":    { user: "rj@balaynibruno.co",    pass: process.env.GMAIL_ADMIN_PASS },
  "admin@balaynibruno.co": { user: "admin@balaynibruno.co", pass: process.env.GMAIL_ADMIN_REAL_PASS },
};

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  let data;
  try { data = await req.json(); } catch { return json({ ok: false, error: "Bad JSON" }, 400); }
  const { from, to, subject, body } = data || {};
  if (!to || !subject || !body) return json({ ok: false, error: "Missing to, subject, or body" }, 400);

  const acct = ACCOUNTS[from] || ACCOUNTS["rj@balaynibruno.co"];
  if (!acct.pass) return json({ ok: false, error: `Sender ${from} not connected yet (App Password missing in Netlify).` }, 400);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: acct.user, pass: acct.pass },
    });
    const info = await transporter.sendMail({
      from: acct.user,
      to,
      subject,
      text: body,
      html: String(body).replace(/\n/g, "<br>"),
    });
    return json({ ok: true, id: info.messageId });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e).slice(0, 200) }, 500);
  }
};
