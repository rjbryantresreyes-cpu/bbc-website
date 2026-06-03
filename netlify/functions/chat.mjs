// BBC Command Center brain (/os chat). Cuh + the AI family reply live.
// The LLM key lives ONLY in the Netlify env var GROQ_API_KEY (never in the browser/repo).
// Endpoint: POST /.netlify/functions/chat
// Body: { messages:[{role:'user'|'assistant', content:string}], agents:[string], task:{title,desc,gprompt,cat,project,client} }
//
// WAVE 1 (now): Groq language brain with BBC identity + per-agent personas (free tier, OpenAI-compatible endpoint).
// WAVE 2 (next): Drive lookup via Groq's Google Workspace connectors OR Google Drive API — slots into TOOLS below.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile"; // fast, free tier, good enough for routing + Q&A

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

function systemPrompt(agents, task) {
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
    "",
    "What you can do right now (Wave 1): answer questions, think through BBC work, draft and plan, route what RJ wants into clear next steps.",
    "What is coming next (Wave 2, not yet live): looking things up directly in the BBC Google Drive (which folder a thing is in, opening folders) and pushing commands to the main system. If RJ asks you to find a specific file/folder or run a command, say plainly that Drive lookup is the next wave and isn't wired yet, then give your best guess from what you know.",
    "",
    "Writing rules for anything RJ might post externally: no em-dashes, no mid-sentence dashes, no filler words (seamlessly, leverage, robust, streamline). Warm, human, plain English. Internally (just talking to RJ) be natural and direct.",
    "Never invent BBC facts, names, or content you don't actually know. If unsure, say so and ask.",
    t
  ].join("\n");
}

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = process.env.GROQ_API_KEY;
  if (!key) return json({ error: "GROQ_API_KEY not set in Netlify env.", reply: "My brain isn't connected yet — RJ needs to add the free Groq key in Netlify (Site configuration → Environment variables → GROQ_API_KEY)." }, 200);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const messages = [
    { role: "system", content: systemPrompt(body.agents, body.task) },
    ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 6000) }))
  ];

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.6, max_tokens: 900 })
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
