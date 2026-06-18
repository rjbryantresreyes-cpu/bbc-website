// Auto-triggered by Netlify on EVERY verified form submission (filename = event name).
// Emails the BBC team when a watched form is submitted, so submissions reach an inbox
// instead of only sitting in the Netlify Forms dashboard.
// Uses Gmail SMTP via the same App Password as send-email.mjs (GMAIL_ADMIN_PASS = rj@).
import nodemailer from "nodemailer";

// Which forms send an email alert.
const NOTIFY_FORMS = [
  "bbc-onboarding",
  "dhes-reel-brief",
  "dhes-graphic-brief",
  "dhes-other-task",
];
const TO = "rj@balaynibruno.co";
const FROM = "rj@balaynibruno.co";
const DASHBOARD = "https://app.netlify.com/projects/flourishing-quokka-1541b1/forms";

// Fields we never want printed in the email body.
const HIDE = new Set(["form-name", "bot-field", "ip", "request-type"]);

// Build readable "Label\n  value" lines from a submission, skipping empties + hidden.
function fieldLines(payload) {
  const ordered = payload.ordered_human_fields || [];
  if (ordered.length) {
    return ordered
      .filter((f) => {
        const v = f.value == null ? "" : String(f.value).trim();
        return v && v !== "[]" && !HIDE.has(f.name);
      })
      .map((f) => `${f.title}\n  ${f.value}`)
      .join("\n\n");
  }
  const d = payload.data || {};
  return Object.entries(d)
    .filter(([k, v]) => !HIDE.has(k) && String(v == null ? "" : v).trim())
    .map(([k, v]) => `${k}\n  ${v}`)
    .join("\n\n");
}

export const handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body || "{}");
    if (!payload || !NOTIFY_FORMS.includes(payload.form_name)) {
      return { statusCode: 200, body: "ignored" };
    }

    const d = payload.data || {};
    let subject, body, replyTo;

    if (payload.form_name === "bbc-onboarding") {
      const name = d.fullName || d.businessName || "New client";
      const email = d.emailAddress || "no email given";
      const ordered = payload.ordered_human_fields || [];
      const answered = ordered.filter((f) => {
        const v = f.value == null ? "" : String(f.value).trim();
        return v && v !== "[]";
      });
      replyTo = d.emailAddress || undefined;
      subject = `New onboarding: ${name}`;
      body =
        `New client onboarding submission.\n\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        `Answered ${answered.length} of ${ordered.length} questions.\n\n` +
        `${fieldLines(payload)}\n\n` +
        `View the full submission in Netlify: ${DASHBOARD}`;
    } else {
      // Dhes request forms (reel / graphic / other task).
      const type = d["request-type"] || "Request";
      const project = d["project-name"] || "(no title)";
      const fromName = d["from-name"] || "Dhes";
      replyTo = d["from-email"] || undefined;
      subject = `New ${type} from ${fromName}: ${project}`;
      body =
        `New request from ${fromName} (Dhes) via the request page.\n\n` +
        `Type: ${type}\n` +
        `Reply to: ${replyTo || "no email given"}\n\n` +
        `${fieldLines(payload)}\n\n` +
        `Any uploaded files are attached to the submission in Netlify: ${DASHBOARD}`;
    }

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
      replyTo,
      subject,
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
