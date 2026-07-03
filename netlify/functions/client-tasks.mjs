// BBC client-tasks — the two-way client sync store for the /os dashboard.
// Tasks/requests clients raise on WhatsApp or email land here (written by the sync routine),
// show on the Home dashboard per client, and can be checked off from the dashboard. When the sync
// sees a task resolved in chat/email it marks it done here too. One source of truth, every device.
// Netlify Blobs (same engine as workflows.mjs / campaign-status.mjs).
//
// Task shape: { id, client, clientSlug, source:"email"|"whatsapp"|"manual", text, status:"open"|"done"|"dismissed", ts, ref }
//   id is deterministic (hash of clientSlug + normalized text) so re-syncing the same request never duplicates.
//
// GET  /.netlify/functions/client-tasks                 -> { ok, tasks:[...], updated }
// GET  /.netlify/functions/client-tasks?client=freccia  -> only that client's tasks
// POST {op:"upsert", task:{client, clientSlug, source, text, status?, ts?, ref?}}   (id auto if absent)
// POST {op:"bulk", tasks:[ ... ]}                        (sync writes many; dedupes; won't reopen resolved)
// POST {op:"resolve", id}  /  {op:"reopen", id}  /  {op:"dismiss", id}  /  {op:"delete", id}

import { getStore } from "@netlify/blobs";

const STORE = "bbc-client-tasks";
const KEY = "tasks";
const s = (v, n) => (v == null ? "" : String(v).slice(0, n));

// deterministic id so the same request from the same client dedupes across syncs
function hashId(clientSlug, text) {
  const str = (clientSlug || "") + "|" + (text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
  return "t" + (h >>> 0).toString(36);
}

export default async (req) => {
  const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization" };
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let store;
  try { store = getStore(STORE); }
  catch (e) { return json({ ok: false, error: "blob store unavailable", detail: s(e.message || e, 200) }, 500); }

  const read = async () => {
    let list;
    try { list = await store.get(KEY, { type: "json", consistency: "strong" }); } catch { list = null; }
    return Array.isArray(list) ? list : [];
  };

  const cleanTask = (t) => {
    if (!t || typeof t !== "object") return null;
    const clientSlug = s(t.clientSlug || t.client || "", 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const text = s(t.text || "", 500).trim();
    if (!clientSlug || !text) return null;
    const status = ["open", "done", "dismissed"].includes(t.status) ? t.status : "open";
    return {
      id: s(t.id, 40) || hashId(clientSlug, text),
      client: s(t.client || clientSlug, 80),
      clientSlug,
      source: ["email", "whatsapp", "manual"].includes(t.source) ? t.source : "manual",
      text,
      status,
      ts: s(t.ts, 40) || new Date().toISOString(),
      ref: s(t.ref, 300),
    };
  };

  // Upsert one task into the list. Never REOPEN a task a human already resolved/dismissed
  // just because the sync saw the original request again.
  const upsertInto = (list, incoming) => {
    const t = cleanTask(incoming);
    if (!t) return list;
    const i = list.findIndex((x) => x.id === t.id);
    if (i < 0) return (list.push(t), list);
    const prev = list[i];
    // if a human already closed it, keep it closed unless the caller explicitly re-opens
    const status = (prev.status === "done" || prev.status === "dismissed") && t.status === "open" ? prev.status : t.status;
    list[i] = { ...prev, ...t, status, ts: prev.ts };
    return list;
  };

  try {
    if (req.method === "GET") {
      let list = await read();
      const url = new URL(req.url);
      const c = (url.searchParams.get("client") || "").toLowerCase();
      if (c) list = list.filter((t) => t.clientSlug === c);
      list.sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || String(b.ts).localeCompare(String(a.ts)));
      return json({ ok: true, tasks: list, updated: new Date().toISOString() });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
      const op = s(body.op, 20);
      let list = await read();

      if (op === "upsert") { list = upsertInto(list, body.task); await store.setJSON(KEY, list); return json({ ok: true, count: list.length }); }
      if (op === "bulk") {
        if (!Array.isArray(body.tasks)) return json({ ok: false, error: "tasks[] required" }, 400);
        for (const t of body.tasks) list = upsertInto(list, t);
        await store.setJSON(KEY, list);
        return json({ ok: true, count: list.length });
      }
      if (["resolve", "reopen", "dismiss", "delete"].includes(op)) {
        const id = s(body.id, 40);
        if (!id) return json({ ok: false, error: "id required" }, 400);
        if (op === "delete") { list = list.filter((t) => t.id !== id); }
        else {
          const map = { resolve: "done", reopen: "open", dismiss: "dismissed" };
          const i = list.findIndex((t) => t.id === id);
          if (i < 0) return json({ ok: false, error: "task not found" }, 404);
          list[i] = { ...list[i], status: map[op] };
        }
        await store.setJSON(KEY, list);
        return json({ ok: true, id, op });
      }
      return json({ ok: false, error: "unknown op. use upsert | bulk | resolve | reopen | dismiss | delete" }, 400);
    }

    return json({ ok: false, error: "method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "client-tasks failed", detail: s(e.message || e, 240) }, 502);
  }
};
