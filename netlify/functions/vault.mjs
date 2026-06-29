// BBC personal password vault — ZERO-KNOWLEDGE storage for RJ.
// This function ONLY ever stores/returns an already-encrypted blob {salt,iv,ct}.
// The master password and the plaintext passwords NEVER reach the server:
// encryption + decryption happen entirely in RJ's browser (WebCrypto AES-GCM,
// key derived from his master password via PBKDF2). The server cannot read the vault.
//
// Auth: requires a valid /os Supabase login token AND the email must be RJ's.
//   GET  -> { blob: {v,salt,iv,ct,updated} | null }
//   POST { blob:{salt,iv,ct} } -> save (rejects anything that isn't an encrypted envelope)
//   POST { delete:true }       -> wipe the vault
//
// Storage: Netlify Blobs store "bbc-vault", key per-owner-email. Not in the repo, not public.

import { getStore } from "@netlify/blobs";

const SUPABASE_URL = "https://ctoeuikxoqlhnebgsygp.supabase.co";
const SUPABASE_KEY = "sb_publishable_WnJ57fk-ymDuT2xtVZRcHg_khZCWgJL"; // publishable (safe here)
const STORE = "bbc-vault";
// Only these accounts may ever touch the vault. Even other BBC team cannot read it.
const OWNERS = ["rj@balaynibruno.co", "rjbryantresreyes@gmail.com"];

async function ownerEmail(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: SUPABASE_KEY },
    });
    if (!r.ok) return null;
    const u = await r.json();
    const email = u && u.email ? String(u.email).toLowerCase() : null;
    return email && OWNERS.includes(email) ? email : null;
  } catch { return null; }
}

export default async (req) => {
  const json = (o, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const email = await ownerEmail(token);
  if (!email) return json({ error: "unauthorized" }, 401);

  let store;
  try { store = getStore({ name: STORE, consistency: "strong" }); }
  catch (e) { return json({ error: "store unavailable" }, 500); }
  const key = "vault:" + email.replace(/[^a-z0-9]/gi, "_");

  if (req.method === "GET") {
    let blob = null;
    try { blob = await store.get(key, { type: "json" }); } catch { blob = null; }
    return json({ blob: blob || null });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

    if (body.delete) { try { await store.delete(key); } catch {} return json({ ok: true }); }

    const b = body.blob;
    // Accept ONLY an encrypted envelope. If it isn't {salt,iv,ct} strings, refuse —
    // this guarantees plaintext can never be saved here, even by mistake.
    if (!b || typeof b !== "object" || typeof b.salt !== "string" || typeof b.iv !== "string" || typeof b.ct !== "string") {
      return json({ error: "expected encrypted blob {salt,iv,ct}" }, 400);
    }
    if (JSON.stringify(b).length > 800000) return json({ error: "vault too large" }, 413);
    try {
      await store.set(key, JSON.stringify({ v: 1, salt: b.salt, iv: b.iv, ct: b.ct, updated: Date.now() }));
    } catch (e) { return json({ error: String(e.message || e).slice(0, 160) }, 500); }
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
};
