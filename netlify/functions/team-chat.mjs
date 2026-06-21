// BBC Team Chat — human-to-human group chat for the BBC crew, saved on BBC's own system.
// Same engine as cards.mjs: Netlify Blobs (built-in server key-value), no external token, no DB setup.
// Every device behind the /os login reads/writes the same store, so a message sent on one device
// shows on all. The AI family (Cuh, Kriz, etc.) can also read + post here via this same endpoint.
//
// GET  /.netlify/functions/team-chat                         -> { list:[...last 200 msgs across channels] }
// GET  /.netlify/functions/team-chat?channel=team            -> only that channel
// GET  /.netlify/functions/team-chat?channel=team&since=<ts> -> only msgs newer than ts (cheap polling)
// POST /.netlify/functions/team-chat {channel,user,name,text} -> append one message
// POST /.netlify/functions/team-chat {delete:true,id}        -> delete one message (sender or RJ)
//
// A message = { id, channel, user, name, text, ts }.
//   user = stable login key (bbc_os_editor, e.g. "rj","daryl","krizza", or an AI name like "Cuh")
//   name = display name shown in the bubble
//   ts   = epoch ms (server-stamped)

import { getStore } from "@netlify/blobs";

const STORE = "bbc-team-chat";
const KEY = "messages";
const CAP = 500; // keep the most recent N messages so the blob stays small + fast

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

  // strong consistency so a freshly-sent message shows immediately on the next poll (any device)
  const read = async () => {
    try { return (await store.get(KEY, { type: "json", consistency: "strong" })) || []; }
    catch { return []; }
  };

  const clean = (b) => ({
    channel: b.channel != null ? String(b.channel).slice(0, 40)  : "team",
    user:    b.user    != null ? String(b.user).slice(0, 40)     : "unknown",
    name:    b.name    != null ? String(b.name).slice(0, 60)     : "Someone",
    text:    b.text    != null ? String(b.text).slice(0, 4000)   : "",
  });

  try {
    if (req.method === "GET") {
      let list = await read();
      const url = new URL(req.url);
      const channel = url.searchParams.get("channel");
      const since = Number(url.searchParams.get("since") || 0);
      if (channel) list = list.filter(m => (m.channel || "team") === channel);
      if (since) list = list.filter(m => (m.ts || 0) > since);
      list.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (list.length > 200) list = list.slice(-200);
      return json({ list });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
      let list = await read();

      // delete one message
      if (body.delete && (body.id ?? body.Id) != null) {
        const id = String(body.id ?? body.Id);
        list = list.filter(m => String(m.id) !== id);
        await store.setJSON(KEY, list);
        return json({ ok: true });
      }

      // append a new message
      const c = clean(body);
      if (!c.text.trim()) return json({ error: "text required" }, 400);
      const ts = Date.now();
      const id = "m" + ts.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const msg = { id, ...c, ts };
      list.push(msg);
      if (list.length > CAP) list = list.slice(-CAP); // trim old messages
      await store.setJSON(KEY, list);
      return json({ ok: true, msg });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: "team-chat function failed", detail: String(e.message || e).slice(0, 240) }, 502);
  }
};
