// BBC Command Center — WORKFLOWS shared state (synced across ALL devices + the whole system).
// Same proven pattern as cards.mjs / calendar.mjs: Netlify Blobs (built-in server key-value),
// no external token, no table setup. Every device + every BBC script reads/writes the same store,
// so a box checked on ANY surface (RJ taps it on the dashboard, OR a render script finishes a reel
// and auto-checks it) shows the same everywhere. This is the two-way sync engine.
//
// STATE SHAPE (single blob):
// {
//   "artifacts": { "w01:email": true, "w03:page": false, ... },   // per workflow + deliverable
//   "links":     { "w01:page": "https://..." },                    // optional per artifact link
//   "extra":     [ { id, cat, title, owners:[], role, angle, audience, artifacts:{} } ], // runtime-added workflows
//   "updated":   "2026-07-04T..."
// }
//
// ENDPOINTS:
// GET  /.netlify/functions/workflows
//        -> { ok:true, artifacts:{...}, links:{...}, extra:[...], updated:"..." }
// POST /.netlify/functions/workflows {op:"setArtifact", id, artifact, value:true|false}
//        -> flip ONE deliverable checkbox (used by RJ tapping a cell AND by system scripts).
// POST /.netlify/functions/workflows {op:"setLink", id, artifact, url}
//        -> set/clear the asset link for one deliverable (url:"" clears it).
// POST /.netlify/functions/workflows {op:"addWorkflow", workflow:{...}}
//        -> register a BRAND-NEW workflow at runtime so it auto-appears on every dashboard,
//           no HTML edit needed. Merges by id (re-adding updates the existing extra entry).
// POST /.netlify/functions/workflows {op:"removeWorkflow", id}
//        -> drop a runtime-added workflow (does not affect seed workflows in the app data).
// POST /.netlify/functions/workflows {op:"bulk", artifacts:{...}, links:{...}}
//        -> merge many at once (used by the sync script / Emmy's master-list import).
//
// SAFETY: strong-consistency reads so a change shows immediately on the next read (any device).

import { getStore } from "@netlify/blobs";

const STORE = "bbc-workflows";
const KEY = "state";

const s = (v, n) => (v == null ? "" : String(v).slice(0, n));

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let store;
  try { store = getStore(STORE); }
  catch (e) { return json({ ok: false, error: "blob store unavailable", detail: s(e.message || e, 200) }, 500); }

  const read = async () => {
    let st;
    try { st = await store.get(KEY, { type: "json", consistency: "strong" }); }
    catch { st = null; }
    if (!st || typeof st !== "object") st = {};
    st.artifacts = st.artifacts && typeof st.artifacts === "object" ? st.artifacts : {};
    st.links = st.links && typeof st.links === "object" ? st.links : {};
    st.extra = Array.isArray(st.extra) ? st.extra : [];
    st.priority = st.priority && typeof st.priority === "object" ? st.priority : {}; // { workflowId: "high"|"med"|"low" }
    return st;
  };

  // Sanitize a runtime-added workflow to the exact seed shape.
  const cleanWorkflow = (w) => {
    if (!w || typeof w !== "object" || !w.id) return null;
    const arts = {};
    if (w.artifacts && typeof w.artifacts === "object") {
      for (const k of Object.keys(w.artifacts)) arts[s(k, 24)] = !!w.artifacts[k];
    }
    return {
      id: s(w.id, 40),
      cat: s(w.cat || "Uncategorized", 60),
      title: s(w.title || w.id, 200),
      owners: Array.isArray(w.owners) ? w.owners.slice(0, 8).map((o) => s(o, 24)) : [],
      role: s(w.role || "", 300),
      angle: s(w.angle || "", 400),
      audience: s(w.audience || "", 200),
      artifacts: arts,
      _runtime: true,
    };
  };

  try {
    if (req.method === "GET") {
      const st = await read();
      return json({ ok: true, ...st });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
      const op = s(body.op, 30);
      const st = await read();

      if (op === "setArtifact") {
        if (!body.id || !body.artifact) return json({ ok: false, error: "id + artifact required" }, 400);
        const k = s(body.id, 40) + ":" + s(body.artifact, 24);
        st.artifacts[k] = !!body.value;
        st.updated = new Date().toISOString();
        await store.setJSON(KEY, st);
        return json({ ok: true, key: k, value: st.artifacts[k], updated: st.updated });
      }

      if (op === "setPriority") {
        if (!body.id) return json({ ok: false, error: "id required" }, 400);
        const lvl = ["high", "med", "low"].includes(body.level) ? body.level : "med";
        st.priority[s(body.id, 40)] = lvl;
        st.updated = new Date().toISOString();
        await store.setJSON(KEY, st);
        return json({ ok: true, id: s(body.id, 40), level: lvl, updated: st.updated });
      }

      if (op === "setLink") {
        if (!body.id || !body.artifact) return json({ ok: false, error: "id + artifact required" }, 400);
        const k = s(body.id, 40) + ":" + s(body.artifact, 24);
        const url = s(body.url, 1000).trim();
        if (url) st.links[k] = url; else delete st.links[k];
        st.updated = new Date().toISOString();
        await store.setJSON(KEY, st);
        return json({ ok: true, key: k, url, updated: st.updated });
      }

      if (op === "addWorkflow") {
        const wf = cleanWorkflow(body.workflow);
        if (!wf) return json({ ok: false, error: "workflow requires at least an id" }, 400);
        st.extra = st.extra.filter((x) => x.id !== wf.id);
        st.extra.push(wf);
        st.updated = new Date().toISOString();
        await store.setJSON(KEY, st);
        return json({ ok: true, workflow: wf, count: st.extra.length, updated: st.updated });
      }

      if (op === "removeWorkflow") {
        const id = s(body.id, 40);
        if (!id) return json({ ok: false, error: "id required" }, 400);
        const before = st.extra.length;
        st.extra = st.extra.filter((x) => x.id !== id);
        st.updated = new Date().toISOString();
        await store.setJSON(KEY, st);
        return json({ ok: true, removed: before - st.extra.length, updated: st.updated });
      }

      if (op === "bulk") {
        if (body.artifacts && typeof body.artifacts === "object") {
          for (const k of Object.keys(body.artifacts)) st.artifacts[s(k, 80)] = !!body.artifacts[k];
        }
        if (body.links && typeof body.links === "object") {
          for (const k of Object.keys(body.links)) {
            const v = s(body.links[k], 1000).trim();
            if (v) st.links[s(k, 80)] = v; else delete st.links[s(k, 80)];
          }
        }
        if (Array.isArray(body.extra)) {
          for (const raw of body.extra) {
            const wf = cleanWorkflow(raw);
            if (wf) { st.extra = st.extra.filter((x) => x.id !== wf.id); st.extra.push(wf); }
          }
        }
        if (body.priority && typeof body.priority === "object") {
          for (const k of Object.keys(body.priority)) {
            const v = body.priority[k];
            if (["high", "med", "low"].includes(v)) st.priority[s(k, 40)] = v;
          }
        }
        st.updated = new Date().toISOString();
        await store.setJSON(KEY, st);
        return json({ ok: true, artifacts: Object.keys(st.artifacts).length, extra: st.extra.length, updated: st.updated });
      }

      return json({ ok: false, error: "unknown op. use setArtifact | setLink | addWorkflow | removeWorkflow | bulk" }, 400);
    }

    return json({ ok: false, error: "method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "workflows function failed", detail: s(e.message || e, 240) }, 502);
  }
};
