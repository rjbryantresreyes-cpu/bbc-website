// BBC Command Center — editable Trello-style CARDS store (synced across all devices).
// Same pattern as calendar.mjs: Netlify Blobs (built-in server key-value), no external token, no table setup.
// Every device reads/writes the same store, so a card added on one device shows on all.
//
// GET  /.netlify/functions/cards                                  -> { list:[{id,board,column,title,notes,order}] }
// GET  /.netlify/functions/cards?board=main                       -> only that board's cards
// POST /.netlify/functions/cards {board,column,title,notes}       -> create one card
// POST /.netlify/functions/cards {id,board?,column?,title?,notes?} -> update one card
// POST /.netlify/functions/cards {delete:true,id}                 -> delete one card
// POST /.netlify/functions/cards {reorder:[{id,column,order}]}    -> batch reorder (drag/drop)

import { getStore } from "@netlify/blobs";

const STORE = "bbc-cards";
const KEY = "cards";

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let store;
  try { store = getStore(STORE); }
  catch (e) { return json({ error: "blob store unavailable", detail: String(e.message || e).slice(0, 200) }, 500); }

  // strong consistency so a freshly-added/edited card shows immediately on the next read (any device)
  const read = async () => {
    try { return (await store.get(KEY, { type: "json", consistency: "strong" })) || []; }
    catch { return []; }
  };

  const clean = (b) => ({
    board:  b.board  != null ? String(b.board).slice(0, 40)    : "main",
    column: b.column != null ? String(b.column).slice(0, 40)   : "todo",
    title:  b.title  != null ? String(b.title).slice(0, 300)   : "",
    notes:  b.notes  != null ? String(b.notes).slice(0, 4000)  : "",
  });

  try {
    if (req.method === "GET") {
      let list = await read();
      const url = new URL(req.url);
      const board = url.searchParams.get("board");
      if (board) list = list.filter(c => (c.board || "main") === board);
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return json({ list });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
      let list = await read();

      // batch reorder (drag/drop): [{id,column,order}]
      if (Array.isArray(body.reorder)) {
        const map = new Map(body.reorder.map(r => [String(r.id), r]));
        list = list.map(c => {
          const r = map.get(String(c.id));
          if (!r) return c;
          return { ...c, column: r.column != null ? String(r.column).slice(0, 40) : c.column, order: Number(r.order) || 0 };
        });
        await store.setJSON(KEY, list);
        return json({ ok: true, list });
      }

      // delete
      if (body.delete && (body.id ?? body.Id) != null) {
        const id = String(body.id ?? body.Id);
        list = list.filter(c => String(c.id) !== id);
        await store.setJSON(KEY, list);
        return json({ ok: true, list });
      }

      // update existing
      if ((body.id ?? body.Id) != null) {
        const id = String(body.id ?? body.Id);
        const patch = {};
        ["board", "column", "title", "notes"].forEach(k => { if (body[k] != null) patch[k] = clean(body)[k]; });
        if (body.order != null) patch.order = Number(body.order) || 0;
        let found = false;
        list = list.map(c => { if (String(c.id) === id) { found = true; return { ...c, ...patch, id: c.id }; } return c; });
        if (!found) return json({ error: "card not found" }, 404);
        await store.setJSON(KEY, list);
        return json({ ok: true, list });
      }

      // create new
      const c = clean(body);
      if (!c.title) return json({ error: "title required" }, 400);
      const sameCol = list.filter(x => (x.board || "main") === c.board && (x.column || "todo") === c.column);
      const order = sameCol.length ? Math.max(...sameCol.map(x => x.order ?? 0)) + 1 : 0;
      const id = "k" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const card = { id, ...c, order };
      list.push(card);
      await store.setJSON(KEY, list);
      return json({ ok: true, card, list });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: "cards function failed", detail: String(e.message || e).slice(0, 240) }, 502);
  }
};
