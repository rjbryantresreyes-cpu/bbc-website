// Auto-triggered by Netlify on EVERY verified form submission (filename = event name).
// Emails the BBC team when a client completes the onboarding form, so submissions
// reach an inbox instead of only sitting in the Netlify Forms dashboard.
// Uses Gmail SMTP via the same App Password as send-email.mjs (GMAIL_ADMIN_PASS = rj@).
import nodemailer from "nodemailer";

const NOTIFY_FORMS = ["bbc-onboarding"]; // which forms send an email alert
const TO = "rj@balaynibruno.co";
const FROM = "rj@balaynibruno.co";
const DASHBOARD = "https://app.netlify.com/projects/flourishing-quokka-1541b1/forms";

export const handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body || "{}");
    if (!payload || !NOTIFY_FORMS.includes(payload.form_name)) {
      return { statusCode: 200, body: "ignored" };
    }

    const d = payload.data || {};
    const name = d.fullName || d.businessName || "New client";
    const email = d.emailAddress || "no email given";

    // Build a readable body from the human-readable, ordered fields; skip empties.
    const ordered = payload.ordered_human_fields || [];
    const answered = ordered.filter((f) => {
      const v = (f.value == null ? "" : String(f.value)).trim();
      return v && v !== "[]";
    });
    const lines = answered.map((f) => `${f.title}\n  ${f.value}`).join("\n\n");

    const body =
      `New client onboarding submission.\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Answered ${answered.length} of ${ordered.length} questions.\n\n` +
      `${lines}\n\n` +
      `View the full submission in Netlify: ${DASHBOARD}`;

    const pass = process.env.GMAIL_ADMIN_PASS;
    if (!pass) {
      // Submission is already saved by Netlify; just log that the email could not send.
      console.error("[submission-created] GMAIL_ADMIN_PASS missing; submission saved but no email sent.");
      return { statusCode: 200, body: "saved, no mail creds" };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: FROM, pass },
    });
    await transporter.sendMail({
      from: FROM,
      to: TO,
      replyTo: d.emailAddress || undefined,
      subject: `New onboarding: ${name}`,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    });

    return { statusCode: 200, body: "emailed" };
  } catch (e) {
    console.error("[submission-created] error:", e && (e.message || e));
    // Never fail the submission pipeline over a notification error.
    return { statusCode: 200, body: "error handled" };
  }
};
