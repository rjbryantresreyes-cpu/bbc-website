// BBC meetings — upcoming meetings & interviews for the /os dashboard Home.
// Fed from Google Calendar by the sync routine (Calendar MCP -> this store); the dashboard reads it.
// Netlify Blobs (same engine as client-tasks.mjs). RJ prepping a meeting in MEET pairs with this.
//
// Meeting shape: { id, title, startISO, endISO, whenText, withWho, link, type:"meeting"|"interview",
//                  notes, status:"upcoming"|"done" }
//   id: pass the Google Calendar event id (so re-syncing updates in place, never duplicates).
//
// GET  /.netlify/functions/meetings                 -> { ok, meetings:[...] (upcoming first), updated }
// POST {op:"bulk", meetings:[ ... ]}                 (sync writes the upcoming set; replaces upcoming ones)
// POST {op:"upsert", meeting:{...}}
// POST {op:"done", id}  /  {op:"delete", id}

import { getStore } from "@netlify/blobs";

const STORE = "bbc-meetings";
const KEY = "meetings";
const s = (v, n) => (v == null ? "" : String(v).slice(0, n));

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

  const clean = (m) => {
    if (!m || typeof m !== "object") return null;
    const title = s(m.title, 200).trim();
    if (!title) return null;
    return {
      id: s(m.id, 80) || ("m" + Math.abs([...title + s(m.startISO, 40)].reduce((h, c) => ((h << 5) + h + c.charCodeAt(0)) & 0xffffffff, 5381)) .toString(36)),
      title,
      startISO: s(m.startISO, 40),
      endISO: s(m.endISO, 40),
      whenText: s(m.whenText, 100),
      withWho: s(m.withWho, 160),
      link: s(m.link, 400),
      type: m.type === "interview" ? "interview" : "meeting",
      notes: s(m.notes, 600),
      status: m.status === "done" ? "done" : "upcoming",
    };
  };

  try {
    if (req.method === "GET") {
      let list = await read();
      list.sort((a, b) => String(a.startISO || "").localeCompare(String(b.startISO || "")));
      return json({ ok: true, meetings: list, updated: new Date().toISOString() });
    }
    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
      const op = s(body.op, 20);
      let list = await read();

      if (op === "bulk") {
        if (!Array.isArray(body.meetings)) return json({ ok: false, error: "meetings[] required" }, 400);
        // Replace the upcoming set the sync manages, but keep any manually-added ones the sync didn't send.
        const incoming = body.meetings.map(clean).filter(Boolean);
        const incomingIds = new Set(incoming.map((m) => m.id));
        // drop old upcoming meetings that are in the past OR superseded; keep done + future manual ones
        const now = new Date().toISOString();
        list = list.filter((m) => !incomingIds.has(m.id) && (m.status === "done" || (m.startISO && m.startISO > now)));
        list.push(...incoming);
        await store.setJSON(KEY, list);
        return json({ ok: true, count: list.length });
      }
      if (op === "upsert") {
        const m = clean(body.meeting); if (!m) return json({ ok: false, error: "meeting requires a title" }, 400);
        list = list.filter((x) => x.id !== m.id); list.push(m);
        await store.setJSON(KEY, list); return json({ ok: true, id: m.id, count: list.length });
      }
      if (op === "done" || op === "delete") {
        const id = s(body.id, 80); if (!id) return json({ ok: false, error: "id required" }, 400);
        if (op === "delete") list = list.filter((m) => m.id !== id);
        else { const i = list.findIndex((m) => m.id === id); if (i >= 0) list[i] = { ...list[i], status: "done" }; }
        await store.setJSON(KEY, list); return json({ ok: true, id, op });
      }
      return json({ ok: false, error: "unknown op. use bulk | upsert | done | delete" }, 400);
    }
    return json({ ok: false, error: "method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "meetings failed", detail: s(e.message || e, 240) }, 502);
  }
};
