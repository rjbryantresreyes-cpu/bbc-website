// BBC Command Center — editable calendar store (synced across all devices).
// Uses Netlify Blobs (built-in server-side key-value store) — no external token, no table setup.
// Every device reads/writes the same store, so an entry added on one device shows on all.
//
// GET  /.netlify/functions/calendar                      -> { list:[{id,date,title,type,link,notes}] }
// POST /.netlify/functions/calendar  {date,title,type,link,notes,id?}  -> create (or update if id) one entry
// POST /.netlify/functions/calendar  {delete:true,id}    -> delete one entry

import { getStore } from "@netlify/blobs";

const STORE = "bbc-calendar";
const KEY = "entries";

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

  const read = async () => {
    try { return (await store.get(KEY, { type: "json" })) || []; }
    catch { return []; }
  };

  try {
    if (req.method === "GET") {
      const list = await read();
      return json({ list });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
      let list = await read();

      // delete
      if (body.delete && (body.id ?? body.Id) != null) {
        const id = String(body.id ?? body.Id);
        list = list.filter(e => String(e.id) !== id);
        await store.setJSON(KEY, list);
        return json({ ok: true, list });
      }

      const clean = {
        date:  body.date  != null ? String(body.date).slice(0, 20)   : "",
        title: body.title != null ? String(body.title).slice(0, 200) : "",
        type:  body.type  != null ? String(body.type).slice(0, 40)   : "",
        link:  body.link  != null ? String(body.link).slice(0, 600)  : "",
        notes: body.notes != null ? String(body.notes).slice(0, 4000): "",
      };

      // update existing
      if ((body.id ?? body.Id) != null) {
        const id = String(body.id ?? body.Id);
        let found = false;
        list = list.map(e => { if (String(e.id) === id) { found = true; return { ...e, ...clean, id: e.id }; } return e; });
        if (!found) return json({ error: "entry not found" }, 404);
        await store.setJSON(KEY, list);
        return json({ ok: true, list });
      }

      // create new
      if (!clean.date) return json({ error: "date required" }, 400);
      const id = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const entry = { id, ...clean };
      list.push(entry);
      await store.setJSON(KEY, list);
      return json({ ok: true, entry, list });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: "calendar function failed", detail: String(e.message || e).slice(0, 240) }, 502);
  }
};
