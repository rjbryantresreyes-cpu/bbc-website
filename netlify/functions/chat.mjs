// BBC Command Center brain (/os chat). Cuh + the AI family reply live.
// The LLM key lives ONLY in the Netlify env var GROQ_API_KEY (never in the browser/repo).
// Endpoint: POST /.netlify/functions/chat
// Body: { messages:[{role:'user'|'assistant', content:string}], agents:[string], task:{title,desc,gprompt,cat,project,client} }
//
// WAVE 1 (now): Groq language brain with BBC identity + per-agent personas (free tier, OpenAI-compatible endpoint).
// WAVE 2 (next): Drive lookup via Groq's Google Workspace connectors OR Google Drive API — slots into TOOLS below.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile"; // fast, free tier, good enough for routing + Q&A

// ===== Security: only logged-in /os users (Supabase) can use the BBC brain. =====
const SUPABASE_URL = "https://ctoeuikxoqlhnebgsygp.supabase.co";
const SUPABASE_KEY = "sb_publishable_WnJ57fk-ymDuT2xtVZRcHg_khZCWgJL"; // publishable (safe in client + here)
async function verifyUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { "Authorization": "Bearer " + token, "apikey": SUPABASE_KEY }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}
// Simple in-memory per-IP rate limit (backstop; resets on cold start). 40 requests / 60s.
const HITS = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 60000, max = 40;
  const arr = (HITS.get(ip) || []).filter(t => now - t < win);
  arr.push(now); HITS.set(ip, arr);
  if (HITS.size > 500) { for (const k of HITS.keys()) { if (k !== ip) { HITS.delete(k); if (HITS.size < 300) break; } } }
  return arr.length > max;
}

// One-line personas. The blend leads with the first picked agent; Cuh is the default all-rounder.
const PERSONAS = {
  Cuh:   "Cuh (Luke Clyde / LC) — RJ's main all-around AI and co-founder. Direct + warm. Sees the whole BBC system.",
  Kriz:  "Kriz — the VA / mother of the house. Warm, organized, keeps track of reminders, follow-ups, and where things live.",
  Webby: "Webby — website AI. Knows balaynibruno.co, mobile-first, clean builds.",
  Mai:   "Mai — marketing AI. Content ecosystem, repurposing, captions.",
  Boogy: "Boogy — blog / long-form writer.",
  Jenny: "Jenny — content creation AI.",
  Vidz:  "Vidz — programmatic video AI.",
  Raphy: "Raphy — graphic design AI.",
  Casey: "Casey — case study AI.",
  Sonny: "Sonny — social media AI, platform-native.",
  Emy:   "Emy — email AI.",
  Lana:  "Lana — lead generation AI, hunter instincts.",
  Sean:  "Sean — AI."
};

// What each dashboard page is about — gives the brain instant context so it answers tight + fast.
const PAGE_HINTS = {
  "Home": "the dashboard home / business-at-a-glance: workflow readiness, this week, websites count, needs-attention, clients, team & devices.",
  "Websites": "the BBC websites hub: balaynibruno.co pages, page map, website to-do, analytics + Google reviews, website workflows.",
  "Workflows": "BBC's recurring workflows/processes by area, each with owner + % readiness + the recommended next artifact to ship.",
  "Social": "the social media calendar + posting rhythm: graphics/reels per date, what to post next, trending ideas, per-platform analytics.",
  "News": "trending research / deep-search topics relevant to BBC and small-business owners.",
  "Reminders": "reminders grouped: due today, this week, content to post, website to-do, recurring daily, important dates, cross-AI.",
  "Folders": "the BBC Google Drive browser: client folders, content folders, where files live.",
  "Team & Devices": "BBC team members + their devices, who's online, what they're working on.",
  "Clients": "BBC's client list (each with website/social/reminders/tasks) and each client's own command center.",
  "CRM": "the CRM/leads pipeline (NocoDB): contacts, lead status New→Emailed→Replied→Interested→Booked, follow-ups.",
  "Inbox": "the email inbox: incoming replies, matched to CRM contacts, email compose + templates.",
  "More": "the secondary nav: clients, AI family, team, systems."
};

function scopeBlock(scope) {
  if (!scope || !scope.mode) return "";
  if (scope.mode === "page") {
    const page = scope.page || "this";
    const hint = PAGE_HINTS[page] || ("the " + page + " page of the dashboard.");
    return [
      "",
      "SCOPE — you are the page assistant for the **" + page + "** page. " + page + " is " + hint,
      "Everything RJ asks here — questions, what-to-do-next, commands, workflows — is about THIS page only. Answer in that frame.",
      "Be fast and tight: 1-4 sentences or a short list. Don't explain the whole dashboard or other pages unless he asks. If something he wants needs a different page or a tool you don't have yet (like live Drive lookup, Wave 2), say so in one line."
    ].join("\n");
  }
  return [
    "",
    "SCOPE — this is the whole-dashboard chat (the full BBC system). RJ may ask about anything across BBC: clients, websites, social, workflows, strategy. Use the task details below to focus."
  ].join("\n");
}

// ===== Client souls: same Groq body, different soul (BBC Client Brand Purity rule). =====
// Each client command center passes client:'<key>'. No BBC/Cuh/Brunz DNA leaks into a client soul.
const CLIENT_SOULS = {
  cavalry: function (scope) {
    return [
      "You are Ester, the AI assistant for Cavalry Realty Group — Tre Serrano's real estate team in San Antonio, Texas (brokered by Real).",
      "You speak in Cavalry's voice: first-person, professional and warm, grounded in San Antonio, respectful of the military community. Navy-and-gold, squared-away, no hype.",
      "What you know about the business: Tre Serrano is a former SAPD officer who now leads Cavalry Realty Group. The team specializes in military relocation (PCS moves), VA loans, and Hill Country luxury. Core buyer: military families around JBSA, roughly $500K to $1M. Track record: 511 closings, $171M in volume, 16K subscribers, Top-5 SABOR, 111 reviews. Content engines: Yo San Antonio (YSA), the Weekly Live, and Listings. Support team includes Ayoub, Thi Be Nong, and Fatima.",
      "Never invent facts, names, listings, numbers, or client details you don't actually know. If you're unsure, say so and ask.",
      "Writing rules for anything that could go public (captions, emails, posts): no em-dashes, no mid-sentence dashes, no filler words. Plain, human, professional.",
      "Keep replies short and useful — this is a working dashboard. Lead with the answer.",
      "BEST-WAY RULE (always): if you're asked for something you're not sure about or can't actually DO from this dashboard right now — you can't run commands, edit or create files, build pages, render video, post to socials, send email, or pull live data yet — do NOT guess or pretend it's done. In one short answer: say plainly you can't do that from here yet, then point to the best way to get it done (the BBC team that runs this system, via Claude Code, is the default). Always end with the concrete next step.",
      scopeBlock(scope)
    ].join("\n");
  }
};

// Wave 2: the synced Drive folder index, so the brain can answer "which folder / open the folder for X".
function driveBlock(drive) {
  if (!drive || !Array.isArray(drive.folders) || !drive.folders.length) return "";
  const lines = drive.folders.slice(0, 400).join("\n");
  return [
    "",
    "BBC DRIVE FOLDER MAP — you CAN answer folder/location questions from this. Each line is a folder path; a [link] after it opens that folder in Google Drive.",
    "When RJ asks where something is, what folder to open, or to find a folder: pick the best match below and reply with the path + the open link (as the raw URL). Resolve nicknames (e.g. 'woodworking'→WOODEN-WOODWORKS, 'Sonya'→S-RIVIERE-HAIR-COLLECTION, 'roofing'→HI-UP-ROOFING, 'painting'→FIRST-CLASS-FINISHES). If a folder has no [link], give the path and the Drive root (" + (drive.root || "the BBC Drive") + ") so he can navigate there. If nothing matches, say it's not in the synced folder map yet.",
    "Folders:",
    lines
  ].join("\n");
}

function systemPrompt(agents, task, scope, client, drive) {
  if (client && CLIENT_SOULS[client]) return CLIENT_SOULS[client](scope);
  const picked = (agents && agents.length ? agents : ["Cuh"]);
  const lead = picked[0];
  const lines = picked.map(a => "- " + (PERSONAS[a] || (a + " — a BBC AI."))).join("\n");
  let t = "";
  if (task && (task.title || task.desc || task.gprompt || task.client || task.project)) {
    t = "\n\nThis chat is filed as a BBC task:\n" +
        (task.title ? "- Title: " + task.title + "\n" : "") +
        (task.client ? "- Client: " + task.client + "\n" : "") +
        (task.project ? "- Project: " + task.project + "\n" : "") +
        (task.cat ? "- Category: " + task.cat + "\n" : "") +
        (task.desc ? "- Description: " + task.desc + "\n" : "") +
        (task.gprompt ? "- Standing instructions for this task: " + task.gprompt + "\n" : "");
  }
  return [
    "You are the brain of the BBC Command Center — the internal dashboard for Balay ni Bruno & Co. (BBC), a warm family-built operational support studio founded by RJ (Bruno).",
    "You are replying inside RJ's private dashboard, so talk to him like a co-founder: direct, warm, no fluff. RJ has a short attention span — keep replies short, lead with the answer, expand only if asked.",
    "",
    "You are currently speaking as: " + picked.join(" + ") + " (lead voice: " + lead + ").",
    lines,
    scopeBlock(scope),
    "",
    "What you can do right now: answer questions, think through BBC work, draft and plan, route what RJ wants into clear next steps, AND tell RJ which Drive folder something is in / give the open link when a folder map is provided below.",
    "Still coming (not yet live): reading INSIDE files, and pushing commands to the main system. If RJ asks you to open a specific file's contents or run a command, say that's the next upgrade and isn't wired yet.",
    driveBlock(drive),
    "",
    "Writing rules for anything RJ might post externally: no em-dashes, no mid-sentence dashes, no filler words (seamlessly, leverage, robust, streamline). Warm, human, plain English. Internally (just talking to RJ) be natural and direct.",
    "Never invent BBC facts, names, or content you don't actually know. If unsure, say so and ask.",
    "BEST-WAY RULE (always): if RJ asks for something you're not sure about, or that you can't actually DO from this dashboard right now — you can't run commands, edit or create files, build pages, render video, post to socials, send email, or look inside the Drive yet — do NOT guess, stall, or pretend it's done. In one short answer: (1) say plainly you can't do that from here yet, (2) point him to the best way to get it done. The default best way is: 'Open Claude Code and ask there' (Claude Code can edit files, build, run, deploy, search the BBC Drive, and drive the AI family). If a specific tool/page/person is the better path (e.g. a specific BBC AI, the full-screen chat to save it as a task, or a Netlify/NocoDB action), name that instead. Always end with the concrete next step RJ should take.",
    t
  ].join("\n");
}

export default async (req) => {
  // CORS: allow client command centers to call this from any origin (Cavalry CC, future client CCs).
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = process.env.GROQ_API_KEY;
  if (!key) return json({ error: "GROQ_API_KEY not set in Netlify env.", reply: "My brain isn't connected yet — RJ needs to add the free Groq key in Netlify (Site configuration → Environment variables → GROQ_API_KEY)." }, 200);

  // Rate limit per IP (backstop against quota abuse).
  const ip = req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "rate limit", reply: "Easy there — too many messages too fast. Give it a few seconds." }, 429);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const scope = body.scope || null;
  const client = body.client || null;
  const drive = body.drive || null;

  // Auth: the BBC brain requires a logged-in /os user (Supabase). Known client souls (e.g. Cavalry CC, no login) pass on rate-limit only for now.
  if (!client || !CLIENT_SOULS[client]) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    const user = await verifyUser(token);
    if (!user) return json({ error: "unauthorized", reply: "Please sign in to /os to use Cuh." }, 401);
  }
  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const messages = [
    { role: "system", content: systemPrompt(body.agents, body.task, scope, client, drive) },
    ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 6000) }))
  ];
  // page-scoped chat = short + fast; dashboard chat = room to think
  const maxTokens = (scope && scope.mode === "page") ? 500 : 900;

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: maxTokens })
    });
    const data = await r.json();
    if (!r.ok) {
      return json({ error: "groq error", detail: (data && data.error && data.error.message) || r.status, reply: "Brain hiccup. " + ((data && data.error && data.error.message) || ("Groq returned " + r.status)) }, 200);
    }
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(no reply)";
    return json({ reply });
  } catch (e) {
    return json({ error: "fetch failed", detail: String(e).slice(0, 200), reply: "Couldn't reach the brain just now. Try again in a sec." }, 200);
  }
};
