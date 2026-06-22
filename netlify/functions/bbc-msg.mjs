// BBC Messenger — our own WhatsApp, on our own system.
// Per-VA login (Supabase Auth, reused from /os), 1:1 DMs + group chats + file sharing.
// All conversations, members, messages, and files are stored in Netlify Blobs (BBC's account).
//
// Auth: every request must send  Authorization: Bearer <supabase access_token>.
//   The function verifies it with Supabase and trusts the resulting user id/email server-side.
//   Anyone who can log in (BBC allowlist) is auto-added to the roster so others can message them.
//
// Actions (querystring ?action= for GET, body.action for POST):
//   GET  bootstrap                      -> { me, roster, conversations }
//   GET  messages&conv=<id>&since=<ts>  -> { messages }  (members only)
//   GET  file&id=<id>                   -> raw file bytes (members only, via the message's conv)
//   POST createConv {type,name,members} -> { conversation }   (dm dedupes)
//   POST send {conv,text,file}          -> { message }         file = {name,type,dataB64}
//   POST markRead {conv}                -> { ok }

import { getStore } from "@netlify/blobs";

const SUPABASE_URL = "https://ctoeuikxoqlhnebgsygp.supabase.co";
const SUPABASE_KEY = "sb_publishable_WnJ57fk-ymDuT2xtVZRcHg_khZCWgJL"; // publishable, safe here

// HUB-AND-SPOKE: RJ is the single hub, shown to everyone as "BBC Bruno".
// VAs only ever see + message BBC Bruno; BBC Bruno sees + messages every VA.
const HUB_EMAILS = new Set(["rjbryantresreyes@gmail.com", "rj@balaynibruno.co"]);
const isHub = (email) => HUB_EMAILS.has((email || "").toLowerCase());

const JSTORE = "bbc-msg";        // json: roster, convs index, per-conv message arrays
const FSTORE = "bbc-msg-files";  // binary: uploaded files
const MAX_FILE = 8 * 1024 * 1024; // 8 MB per file
const MAX_MSGS = 1000;           // keep last N messages per conversation

// Nice display names for known BBC logins; otherwise we use the account's name or email.
const KNOWN = {
  "rjbryantresreyes@gmail.com": "RJ", "rj@balaynibruno.co": "RJ",
  "krizza.bbc@gmail.com": "Krizza", "krizza@balaynibruno.co": "Krizza", "krizzamaymanagase@gmail.com": "Krizza",
  "daryl.bbc@gmail.com": "Daryl", "daryl@balaynibruno.co": "Daryl",
  "vi@balaynibruno.co": "Vi", "vicarmelle@balaynibruno.co": "Vi",
  "ryan@balaynibruno.co": "Ryan", "kenz.bbc11@gmail.com": "Kenz",
  "diego@balaynibruno.co": "Diego", "dexter@balaynibruno.co": "Dexter", "john@balaynibruno.co": "John",
};

// Clients + non-person accounts that must NOT appear in BBC Bruno's team contact list.
const CONTACT_EXCLUDE = new Set(["sonyariviere@gmail.com", "woodenwoodwork@gmail.com", "admin@balaynibruno.co"]);

// Pull the real team from Supabase (so BBC Bruno sees every VA even before they open the app).
// Needs SUPABASE_SERVICE_ROLE_KEY (Netlify env). Cached 60s on the warm instance.
let _userCache = { ts: 0, users: null };
function niceName(email, meta) {
  const em = (email || "").toLowerCase();
  if (KNOWN[em]) return KNOWN[em];
  if (meta && (meta.name || meta.full_name)) return String(meta.name || meta.full_name);
  const l = em.split("@")[0].replace(/[._-]+/g, " ");
  return l ? l.replace(/\b\w/g, m => m.toUpperCase()) : "Teammate";
}
async function adminUsers() {
  const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SK) return null;
  if (_userCache.users && Date.now() - _userCache.ts < 60000) return _userCache.users;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/admin/users?per_page=200", { headers: { apikey: SK, Authorization: "Bearer " + SK } });
    if (!r.ok) return _userCache.users;
    const d = await r.json();
    const users = (d.users || []).map(u => ({ id: String(u.id), email: (u.email || "").toLowerCase(), name: niceName(u.email, u.user_metadata) }));
    _userCache = { ts: Date.now(), users };
    return users;
  } catch { return _userCache.users; }
}

function displayName(user) {
  const em = (user.email || "").toLowerCase();
  if (isHub(em)) return "BBC Bruno";
  if (KNOWN[em]) return KNOWN[em];
  const meta = user.user_metadata || {};
  if (meta.full_name) return String(meta.full_name);
  if (meta.name) return String(meta.name);
  if (em) { const l = em.split("@")[0].replace(/[._-]+/g, " "); return l.charAt(0).toUpperCase() + l.slice(1); }
  return "Someone";
}

async function verify(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: SUPABASE_KEY },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  const json = (o, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const user = await verify(req);
  if (!user) return json({ error: "unauthorized", reply: "Please sign in." }, 401);

  const meId = String(user.id);
  const meName = displayName(user);
  const meEmail = (user.email || "").toLowerCase();
  const meHub = isHub(meEmail);

  let js, fs;
  try { js = getStore(JSTORE); fs = getStore(FSTORE); }
  catch (e) { return json({ error: "store unavailable", detail: String(e.message || e).slice(0, 160) }, 500); }

  const readJ = async (key, dflt) => {
    try { return (await js.get(key, { type: "json", consistency: "strong" })) ?? dflt; }
    catch { return dflt; }
  };

  // keep the roster current so anyone who logs in is reachable by the others
  const upsertRoster = async () => {
    const roster = await readJ("roster", []);
    const i = roster.findIndex(p => p.id === meId);
    const entry = { id: meId, name: meName, email: meEmail, hub: meHub, seen: Date.now() };
    if (i === -1) roster.push(entry); else roster[i] = { ...roster[i], ...entry };
    await js.setJSON("roster", roster);
    if (meHub) await js.setJSON("hub", { id: meId, name: "BBC Bruno" }); // remember who BBC Bruno is
    return roster;
  };

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "POST" ? null : "bootstrap");

  try {
    // ---------- GET file ----------
    if (req.method === "GET" && action === "file") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id required" }, 400);
      const meta = await readJ("filemeta:" + id, null);
      if (!meta) return json({ error: "not found" }, 404);
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === meta.conv);
      if (!conv || !conv.members.includes(meId)) return json({ error: "forbidden" }, 403);
      let buf;
      try { buf = await fs.get("file:" + id, { type: "arrayBuffer" }); } catch { buf = null; }
      if (!buf) return json({ error: "gone" }, 404);
      return new Response(buf, { status: 200, headers: {
        "content-type": meta.type || "application/octet-stream",
        "content-disposition": "inline; filename=\"" + (meta.name || "file").replace(/"/g, "") + "\"",
        "cache-control": "private, max-age=86400", ...CORS,
      }});
    }

    // ---------- GET bootstrap ----------
    if (req.method === "GET" && action === "bootstrap") {
      const roster = await upsertRoster();
      const hub = await readJ("hub", null);
      const convs = await readJ("convs", []);
      const mine = convs.filter(c => c.members.includes(meId)).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      // hub (BBC Bruno) sees every VA; a VA only ever sees BBC Bruno.
      let rosterOut;
      if (meHub) {
        const all = await adminUsers(); // full team from Supabase (even those who haven't opened the app yet)
        if (all && all.length) rosterOut = all.filter(u => !isHub(u.email) && !CONTACT_EXCLUDE.has(u.email)).map(u => ({ id: u.id, name: u.name }));
        else rosterOut = roster.filter(p => !p.hub && p.id !== meId).map(p => ({ id: p.id, name: p.name })); // fallback: only those who've logged in
      } else rosterOut = hub ? [{ id: hub.id, name: "BBC Bruno" }] : [];
      return json({ me: { id: meId, name: meName, email: meEmail, hub: meHub }, roster: rosterOut, conversations: mine });
    }

    // ---------- GET messages ----------
    if (req.method === "GET" && action === "messages") {
      const convId = url.searchParams.get("conv");
      const since = Number(url.searchParams.get("since") || 0);
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === convId);
      if (!conv) return json({ error: "no conv" }, 404);
      if (!conv.members.includes(meId)) return json({ error: "forbidden" }, 403);
      let msgs = await readJ("msgs:" + convId, []);
      if (since) msgs = msgs.filter(m => (m.ts || 0) > since);
      return json({ messages: msgs });
    }

    if (req.method !== "POST") return json({ error: "method" }, 405);

    let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const act = body.action;

    // ---------- POST createConv ----------
    if (act === "createConv") {
      await upsertRoster();

      // Self chat — one thread per device (Plus / Tuff / Free) to message your own devices.
      if (body.type === "self") {
        const device = body.device ? String(body.device).slice(0, 20) : "Notes";
        const convs = await readJ("convs", []);
        const ex = convs.find(c => c.type === "self" && c.members.length === 1 && c.members[0] === meId && (c.device || c.name) === device);
        if (ex) return json({ conversation: ex });
        const sid = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
        const self = { id: sid, type: "self", name: device, device, members: [meId], createdBy: meId, lastTs: Date.now(), lastText: "" };
        convs.push(self);
        await js.setJSON("convs", convs);
        return json({ conversation: self });
      }

      let type = body.type === "group" ? "group" : "dm";
      let members = Array.isArray(body.members) ? body.members.map(String) : [];
      if (!members.includes(meId)) members.push(meId);
      members = [...new Set(members)];

      // Hub-and-spoke: a VA can only ever start a DM with BBC Bruno (no groups, no VA-to-VA).
      if (!meHub) {
        const hub = await readJ("hub", null);
        if (!hub) return json({ error: "BBC Bruno is not set up yet. Ask RJ to sign in once." }, 400);
        type = "dm";
        members = [meId, hub.id];
      }

      if (type === "dm" && members.length !== 2) return json({ error: "a DM needs exactly one other person" }, 400);
      if (type === "group" && members.length < 2) return json({ error: "pick at least one person" }, 400);

      const convs = await readJ("convs", []);
      if (type === "dm") {
        const ms = [...members].sort().join(",");
        const ex = convs.find(c => c.type === "dm" && [...c.members].sort().join(",") === ms);
        if (ex) return json({ conversation: ex });
      }
      const id = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const conv = { id, type, name: type === "group" ? String(body.name || "Group").slice(0, 80) : "", members, createdBy: meId, lastTs: Date.now(), lastText: "" };
      convs.push(conv);
      await js.setJSON("convs", convs);
      return json({ conversation: conv });
    }

    // ---------- POST send ----------
    if (act === "send") {
      const convId = String(body.conv || "");
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === convId);
      if (!conv) return json({ error: "no conv" }, 404);
      if (!conv.members.includes(meId)) return json({ error: "forbidden" }, 403);

      const text = body.text != null ? String(body.text).slice(0, 8000) : "";
      let file = null;
      if (body.file && body.file.dataB64) {
        const b64 = String(body.file.dataB64);
        const bytes = Buffer.from(b64, "base64");
        if (bytes.length > MAX_FILE) return json({ error: "file too big (max 8 MB)" }, 400);
        const fid = "f" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); // clean ArrayBuffer for Blobs
        await fs.set("file:" + fid, ab);
        const fmeta = { id: fid, conv: convId, name: String(body.file.name || "file").slice(0, 200), type: String(body.file.type || "application/octet-stream").slice(0, 100), size: bytes.length };
        await js.setJSON("filemeta:" + fid, fmeta);
        file = { id: fid, name: fmeta.name, type: fmeta.type, size: fmeta.size };
      }
      if (!text.trim() && !file) return json({ error: "empty" }, 400);

      const ts = Date.now();
      const id = "m" + ts.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const device = body.device ? String(body.device).slice(0, 20) : null; // for the BBC Bruno self-chat: which device this note is for
      const msg = { id, conv: convId, user: meId, name: meName, text, file, device, ts };
      let msgs = await readJ("msgs:" + convId, []);
      msgs.push(msg);
      if (msgs.length > MAX_MSGS) msgs = msgs.slice(-MAX_MSGS);
      await js.setJSON("msgs:" + convId, msgs);

      conv.lastTs = ts;
      conv.lastText = file && !text ? "📎 " + file.name : text.slice(0, 80);
      await js.setJSON("convs", convs);
      return json({ message: msg });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: "msg function failed", detail: String(e.message || e).slice(0, 200) }, 502);
  }
};
