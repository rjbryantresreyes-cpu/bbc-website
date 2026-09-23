// Auto-triggered by Netlify on EVERY verified form submission (filename = event name).
// Emails the BBC team when a watched form is submitted, so submissions reach an inbox
// instead of only sitting in the Netlify Forms dashboard.
// Uses Gmail SMTP via the same App Password as send-email.mjs (GMAIL_ADMIN_PASS = rj@).
import nodemailer from "nodemailer";

// Which forms send an email alert.
const NOTIFY_FORMS = [
  "bbc-onboarding",
  "britni-deep-dive",
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

// ---- Krizza & Bryan wedding RSVP (personal, not a BBC client form) ----
// Every submission is forwarded to a Make webhook that appends one row to their private Google Sheet.
// Netlify keeps its own copy of each submission, so nothing is lost if the forward fails. If it does
// fail, RJ gets an email with the full answers so the RSVP can be added by hand (guards fail loud).
const KB_FORM = "krizza-bryan-rsvp";
const kbClean = (v, max, keepNewlines) => {
  let s = String(v == null ? "" : v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  s = keepNewlines ? s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return s.trim().slice(0, max);
};
const kbPhTime = (iso) => {
  const d = new Date(iso || Date.now());
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(isNaN(d) ? new Date() : d);
};
async function kbForward(payload) {
  const d = payload.data || {};
  const att = kbClean(d.attending, 10);
  const partyN = parseInt(d.party, 10);
  const row = {
    received: kbPhTime(payload.created_at),
    name: kbClean(d.name, 100),
    attending: /^y/i.test(att) ? "Yes" : /^n/i.test(att) ? "No" : att,
    party: partyN >= 1 && partyN <= 10 ? partyN : "",
    others: kbClean(d.others, 300),
    dietary: kbClean(d.dietary, 300),
    contact: kbClean(d.contact, 100),
    message: kbClean(d.message, 1000, true),
  };
  const hook = process.env.KB_RSVP_HOOK;
  let failure = "";
  if (!hook) {
    failure = "KB_RSVP_HOOK is not set on this site";
  } else {
    for (let i = 0; i < 2 && failure !== null; i++) {
      try {
        const r = await fetch(hook, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row), signal: AbortSignal.timeout(4000),
        });
        if (r.ok) { failure = null; break; }
        failure = `Make answered HTTP ${r.status}`;
      } catch (e) {
        failure = (e && e.message) || String(e);
      }
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  if (failure === null) return { statusCode: 200, body: "forwarded" };

  console.error("[submission-created] KB RSVP forward FAILED:", failure, JSON.stringify(row));
  const pass = process.env.GMAIL_ADMIN_PASS;
  if (pass) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 465, secure: true, auth: { user: FROM, pass },
      });
      await transporter.sendMail({
        from: FROM, to: TO,
        subject: `Wedding RSVP did not reach the sheet: ${row.name || "(no name)"}`,
        text:
          `A wedding RSVP was received but could not be added to the Google Sheet (${failure}).\n` +
          `Netlify still has it in Forms > ${KB_FORM}. Please add this row by hand:\n\n` +
          `(KB_ variables this function can see: ${Object.keys(process.env).filter((k) => k.startsWith("KB_")).join(", ") || "none"})\n\n` +
          Object.entries(row).map(([k, v]) => `${k}: ${v}`).join("\n"),
      });
    } catch (e) {
      console.error("[submission-created] KB RSVP alert email failed:", (e && e.message) || e);
    }
  }
  return { statusCode: 200, body: "forward failed, alerted" };
}

export const handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body || "{}");
    if (payload && payload.form_name === KB_FORM) return await kbForward(payload);
    if (!payload || !NOTIFY_FORMS.includes(payload.form_name)) {
      return { statusCode: 200, body: "ignored" };
    }

    const d = payload.data || {};
    let subject, body, replyTo;

    if (payload.form_name === "britni-deep-dive") {
      const ordered = payload.ordered_human_fields || [];
      const answered = ordered.filter((f) => {
        const v = f.value == null ? "" : String(f.value).trim();
        return v && v !== "[]";
      });
      subject = `Britni's deep dive is in (Cota Skincare + AI Scale Zone)`;
      body =
        `Britni submitted the Cota Skincare + AI Scale Zone deep-dive questionnaire.\n\n` +
        `Answered ${answered.length} of ${ordered.length} questions.\n\n` +
        `${fieldLines(payload)}\n\n` +
        `View the full submission in Netlify: ${DASHBOARD}`;
    } else if (payload.form_name === "bbc-onboarding") {
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
