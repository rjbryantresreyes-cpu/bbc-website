// BBC client-task — add or resolve a client task/request on the /os dashboard from the terminal.
// The "system side" of the two-way client sync. Used by the sync routine and by any BBC script.
//
//   node client-task.mjs add <clientSlug> "<text>" [--source email|whatsapp|manual] [--ref "<link>"]
//   node client-task.mjs done <taskId>            # mark resolved (or: resolve)
//   node client-task.mjs dismiss <taskId>
//   node client-task.mjs bulk '<json-array-of-tasks>'   # sync writes many at once
//   node client-task.mjs list [clientSlug]
//
// Endpoint override: BBC_OS_URL (defaults to the live site).

const BASE = (process.env.BBC_OS_URL || "https://balaynibruno.co").replace(/\/$/, "");
const EP = BASE + "/.netlify/functions/client-tasks";

async function call(method, body, qs) {
  const url = EP + (qs || "");
  const r = await fetch(url, method === "GET" ? {} : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(`HTTP ${r.status}: ${JSON.stringify(d)}`);
  return d;
}

const args = process.argv.slice(2);
const cmd = args[0];
function flag(name, def) { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; }

try {
  if (cmd === "add") {
    const clientSlug = args[1], text = args[2];
    if (!clientSlug || !text) throw new Error('Usage: add <clientSlug> "<text>" [--source ...] [--ref ...]');
    const d = await call("POST", { op: "upsert", task: { clientSlug, client: clientSlug, text, source: flag("source", "manual"), ref: flag("ref", "") } });
    console.log(`OK — added for ${clientSlug} (${d.count} tasks total).`);
  } else if (cmd === "done" || cmd === "resolve") {
    if (!args[1]) throw new Error("Usage: done <taskId>");
    await call("POST", { op: "resolve", id: args[1] }); console.log(`OK — ${args[1]} marked done.`);
  } else if (cmd === "dismiss") {
    if (!args[1]) throw new Error("Usage: dismiss <taskId>");
    await call("POST", { op: "dismiss", id: args[1] }); console.log(`OK — ${args[1]} dismissed.`);
  } else if (cmd === "bulk") {
    const tasks = JSON.parse(args[1] || "[]");
    const d = await call("POST", { op: "bulk", tasks });
    console.log(`OK — synced ${tasks.length} task(s) (${d.count} total).`);
  } else if (cmd === "list") {
    const d = await call("GET", null, args[1] ? "?client=" + encodeURIComponent(args[1]) : "");
    (d.tasks || []).forEach((t) => console.log(`[${t.status}] ${t.clientSlug} · ${t.source} · ${t.id} — ${t.text}`));
    console.log(`(${(d.tasks || []).length} tasks)`);
  } else {
    console.error("Commands: add | done | dismiss | bulk | list");
    process.exit(1);
  }
} catch (e) {
  console.error("FAILED:", e.message);
  console.error("(Endpoint is live only after the client-tasks deploy. Set BBC_OS_URL to test another host.)");
  process.exit(1);
}
