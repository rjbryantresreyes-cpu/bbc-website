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
import webpush from "web-push";

// Web Push (closed-app notifications). Needs VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in Netlify env.
let _vapidReady = false;
function vapidInit() {
  if (_vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  try { webpush.setVapidDetails("mailto:admin@balaynibruno.co", pub, priv); _vapidReady = true; return true; }
  catch { return false; }
}

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
  if (meta && (meta.display_name || meta.name || meta.full_name)) return String(meta.display_name || meta.name || meta.full_name);
  if (KNOWN[em]) return KNOWN[em];
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
  const meta = user.user_metadata || {};
  if (meta.display_name) return String(meta.display_name);
  if (meta.full_name) return String(meta.full_name);
  if (meta.name) return String(meta.name);
  if (KNOWN[em]) return KNOWN[em];
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

  // Public: avatar images (internal team profile photos) — served without auth so <img src> works directly.
  {
    const u0 = new URL(req.url);
    if (req.method === "GET" && u0.searchParams.get("action") === "avatar") {
      const id = u0.searchParams.get("id");
      if (id) {
        try {
          const fs0 = getStore(FSTORE), js0 = getStore(JSTORE);
          const buf = await fs0.get("avatar:" + id, { type: "arrayBuffer" });
          if (buf) {
            const meta = (await js0.get("avatarmeta:" + id, { type: "json" })) || { type: "image/jpeg" };
            return new Response(buf, { status: 200, headers: { "content-type": meta.type || "image/jpeg", "cache-control": "public, max-age=300", ...CORS } });
          }
        } catch {}
      }
      return json({ error: "no avatar" }, 404);
    }
  }

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
      // Ensure the shared "BBC Team" group exists and includes everyone on the team (hub + all VAs).
      // Runs on every bootstrap, so new accounts (e.g. Krizza) auto-join the moment they first open the app.
      try {
        const all = await adminUsers();
        const teamIds = (all && all.length)
          ? [...new Set(all.filter(u => !CONTACT_EXCLUDE.has(u.email)).map(u => u.id))]
          : null;
        if (teamIds && teamIds.length) {
          if (!teamIds.includes(meId)) teamIds.push(meId);
          const convs0 = await readJ("convs", []);
          let team = convs0.find(c => c.type === "group" && (c.name || "") === "BBC Team");
          let changed = false;
          if (!team) {
            team = { id: "cteam" + Date.now().toString(36), type: "group", name: "BBC Team", members: teamIds, createdBy: meId, lastTs: Date.now(), lastText: "" };
            convs0.push(team); changed = true;
          } else {
            const set = new Set(team.members);
            for (const id of teamIds) if (!set.has(id)) { set.add(id); changed = true; }
            if (changed) team.members = [...set];
          }
          if (changed) await js.setJSON("convs", convs0);
        }
      } catch { /* never block bootstrap on group ensure */ }
      const convs = await readJ("convs", []);
      const mine = convs.filter(c => c.members.includes(meId)).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      // FLAT TEAM DIRECTORY: every user sees every teammate (RJ shows as "BBC Bruno"); clients excluded.
      const avaSet = new Set(roster.filter(p => p.avatar).map(p => p.id));
      // a teammate's chosen name (set via setProfile) lives in the Blobs roster; prefer it.
      const nameOf = (id, fallback) => { const p = roster.find(x => x.id === id); return (p && p.name) || fallback; };
      let rosterOut;
      const all = await adminUsers(); // full team from Supabase (even those who haven't opened the app yet)
      if (all && all.length) {
        rosterOut = all.filter(u => u.id !== meId && !CONTACT_EXCLUDE.has(u.email))
          .map(u => ({ id: u.id, name: isHub(u.email) ? "BBC Bruno" : nameOf(u.id, u.name), avatar: avaSet.has(u.id) }));
      } else {
        rosterOut = roster.filter(p => p.id !== meId && !CONTACT_EXCLUDE.has((p.email || "").toLowerCase()))
          .map(p => ({ id: p.id, name: p.hub ? "BBC Bruno" : p.name, avatar: avaSet.has(p.id) }));
      }
      return json({ me: { id: meId, name: meName, email: meEmail, hub: meHub, avatar: avaSet.has(meId) }, roster: rosterOut, conversations: mine });
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

      // Flat team: anyone can DM or group with anyone on the team.
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

      // Idempotency: ignore a repeat of the same client-generated id (double-tap / PWA retry / flaky network).
      const clientId = body.clientId ? String(body.clientId).slice(0, 40) : null;
      let msgs = await readJ("msgs:" + convId, []);
      if (clientId) { const dup = msgs.find(m => m.clientId === clientId); if (dup) return json({ message: dup }); }

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
      const msg = { id, conv: convId, user: meId, name: meName, text, file, device, ts, clientId };
      msgs.push(msg);
      if (msgs.length > MAX_MSGS) msgs = msgs.slice(-MAX_MSGS);
      await js.setJSON("msgs:" + convId, msgs);

      conv.lastTs = ts;
      conv.lastText = file && !text ? "📎 " + file.name : text.slice(0, 80);
      await js.setJSON("convs", convs);

      // best-effort push to the other members (closed-app notifications)
      if (vapidInit()) {
        const title = conv.type === "group" ? (conv.name || "BBC Team") : meName;
        const bodyTxt = file && !text ? "📎 " + file.name : text.slice(0, 120);
        await Promise.all(conv.members.filter(id => id !== meId).map(async (id) => {
          const sub = await readJ("sub:" + id, null);
          if (!sub) return;
          try { await webpush.sendNotification(sub, JSON.stringify({ title, body: bodyTxt, url: "/chat/" })); }
          catch (e) { if (e && e.statusCode === 410) { try { await js.delete("sub:" + id); } catch {} } }
        }));
      }
      return json({ message: msg });
    }

    // ---------- POST react (add/remove an emoji reaction on a message) ----------
    if (act === "react") {
      const convId = String(body.conv || ""), msgId = String(body.msgId || ""), emoji = String(body.emoji || "").slice(0, 12);
      if (!convId || !msgId || !emoji) return json({ error: "conv, msgId, emoji required" }, 400);
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === convId);
      if (!conv || !conv.members.includes(meId)) return json({ error: "forbidden" }, 403);
      const msgs = await readJ("msgs:" + convId, []);
      const m = msgs.find(x => x.id === msgId);
      if (!m) return json({ error: "no message" }, 404);
      m.reactions = m.reactions || {};
      const had = (m.reactions[emoji] || []).includes(meId);
      // one reaction per person (WhatsApp-style): clear my other reactions on this message first
      for (const k of Object.keys(m.reactions)) {
        const idx = m.reactions[k].indexOf(meId);
        if (idx >= 0) m.reactions[k].splice(idx, 1);
        if (!m.reactions[k].length) delete m.reactions[k];
      }
      if (!had) { (m.reactions[emoji] = m.reactions[emoji] || []).push(meId); } // toggle off if same
      await js.setJSON("msgs:" + convId, msgs);
      return json({ ok: true, reactions: m.reactions });
    }

    // ---------- POST editMsg (edit your own message) ----------
    if (act === "editMsg") {
      const convId = String(body.conv || ""), msgId = String(body.msgId || ""), text = String(body.text || "").slice(0, 8000);
      if (!convId || !msgId) return json({ error: "conv, msgId required" }, 400);
      if (!text.trim()) return json({ error: "empty" }, 400);
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === convId);
      if (!conv || !conv.members.includes(meId)) return json({ error: "forbidden" }, 403);
      const msgs = await readJ("msgs:" + convId, []);
      const m = msgs.find(x => x.id === msgId);
      if (!m) return json({ error: "no message" }, 404);
      if (m.user !== meId) return json({ error: "you can only edit your own messages" }, 403);
      m.text = text; m.edited = true;
      if (msgs.length && msgs[msgs.length - 1].id === msgId) { conv.lastText = text.slice(0, 80); await js.setJSON("convs", convs); }
      await js.setJSON("msgs:" + convId, msgs);
      return json({ ok: true });
    }

    // ---------- POST deleteMsg (delete your own message; hub can delete any) ----------
    if (act === "deleteMsg") {
      const convId = String(body.conv || ""), msgId = String(body.msgId || "");
      if (!convId || !msgId) return json({ error: "conv, msgId required" }, 400);
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === convId);
      if (!conv || !conv.members.includes(meId)) return json({ error: "forbidden" }, 403);
      let msgs = await readJ("msgs:" + convId, []);
      const m = msgs.find(x => x.id === msgId);
      if (!m) return json({ ok: true });
      if (m.user !== meId && !meHub) return json({ error: "you can only delete your own messages" }, 403);
      msgs = msgs.filter(x => x.id !== msgId);
      await js.setJSON("msgs:" + convId, msgs);
      const last = msgs[msgs.length - 1];
      conv.lastText = last ? (last.file && !last.text ? "📎 " + last.file.name : (last.text || "").slice(0, 80)) : "";
      if (last) conv.lastTs = last.ts;
      await js.setJSON("convs", convs);
      return json({ ok: true });
    }

    // ---------- POST saveSub (store this user's push subscription) ----------
    if (act === "saveSub") {
      if (!body.subscription) return json({ error: "subscription required" }, 400);
      await js.setJSON("sub:" + meId, body.subscription);
      return json({ ok: true });
    }

    // ---------- POST setProfile (change display name + avatar) ----------
    if (act === "setProfile") {
      let roster = await readJ("roster", []);
      let i = roster.findIndex(p => p.id === meId);
      if (i === -1) { roster.push({ id: meId, name: meName, email: meEmail, hub: meHub, seen: Date.now() }); i = roster.length - 1; }
      if (body.name) roster[i].name = String(body.name).slice(0, 60);
      if (body.avatarB64) {
        const bytes = Buffer.from(String(body.avatarB64), "base64");
        if (bytes.length > 2 * 1024 * 1024) return json({ error: "avatar too big (max 2 MB)" }, 400);
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        await fs.set("avatar:" + meId, ab);
        await js.setJSON("avatarmeta:" + meId, { type: String(body.avatarType || "image/jpeg").slice(0, 40) });
        roster[i].avatar = true;
      }
      await js.setJSON("roster", roster);
      return json({ ok: true, name: roster[i].name, avatar: !!roster[i].avatar });
    }

    // ---------- POST addMember (add a contact to a group) ----------
    if (act === "addMember") {
      const convId = String(body.conv || "");
      const addId = String(body.userId || "");
      if (!convId || !addId) return json({ error: "conv and userId required" }, 400);
      const convs = await readJ("convs", []);
      const conv = convs.find(c => c.id === convId);
      if (!conv || conv.type !== "group") return json({ error: "no group" }, 404);
      if (!conv.members.includes(meId)) return json({ error: "forbidden" }, 403);
      if (!conv.members.includes(addId)) {
        conv.members.push(addId);
        await js.setJSON("convs", convs);
      }
      return json({ conversation: conv });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: "msg function failed", detail: String(e.message || e).slice(0, 200) }, 502);
  }
};
