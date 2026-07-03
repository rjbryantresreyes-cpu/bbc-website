// BBC workflow-check — let ANY BBC script auto-tick a deliverable on the /os Workflows dashboard.
// This is the "system side" of the two-way sync: when a generator finishes an asset for a workflow,
// it calls this and the box lights up on every device. RJ tapping the same box does the reverse.
//
// USAGE (from any device, after the /os deploy is live):
//   node workflow-check.mjs <workflowId> <deliverable> [true|false]
//   node workflow-check.mjs w03 video true          # mark Workflow 03's reel as shipped
//   node workflow-check.mjs w03 email true          # mark its email newsletter as done
//   node workflow-check.mjs w03 page false          # un-check the page
//
//   Register a BRAND-NEW workflow so it auto-appears on the dashboard (no HTML edit):
//   node workflow-check.mjs --add '{"id":"w42","cat":"Content","title":"Workflow 42 — ...","owners":["Mai"],"role":"...","angle":"...","audience":"..."}'
//
// deliverable = one of: graphic | video | page | email | social | zip
// Endpoint override: set BBC_OS_URL env (defaults to the live site).

const BASE = process.env.BBC_OS_URL || "https://balaynibruno.co";
const EP = BASE.replace(/\/$/, "") + "/.netlify/functions/workflows";
const VALID = ["graphic", "video", "page", "email", "social", "zip"];

async function post(body) {
  const r = await fetch(EP, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(d)}`);
  return d;
}

const args = process.argv.slice(2);

try {
  if (args[0] === "--add") {
    const wf = JSON.parse(args[1] || "{}");
    if (!wf.id) throw new Error('--add needs JSON with at least an "id".');
    const d = await post({ op: "addWorkflow", workflow: wf });
    console.log(`OK — registered workflow ${wf.id} (${d.count} runtime workflows total).`);
  } else {
    const [id, deliverable, val] = args;
    if (!id || !deliverable) {
      console.error("Usage: node workflow-check.mjs <workflowId> <deliverable> [true|false]");
      console.error("       deliverable = " + VALID.join(" | "));
      process.exit(1);
    }
    if (!VALID.includes(deliverable)) throw new Error(`deliverable must be one of: ${VALID.join(", ")}`);
    const value = val === undefined ? true : /^(true|1|yes|done|shipped)$/i.test(val);
    const d = await post({ op: "setArtifact", id, artifact: deliverable, value });
    console.log(`OK — ${id} · ${deliverable} = ${value ? "shipped ✓" : "cleared ○"} (saved to every device).`);
  }
} catch (e) {
  console.error("FAILED:", e.message);
  console.error("(The endpoint is live only after the /os Netlify deploy. Set BBC_OS_URL to test another host.)");
  process.exit(1);
}
