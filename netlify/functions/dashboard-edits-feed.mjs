// Read endpoint for the dashboard edits Blobs store.
// GET /.netlify/functions/dashboard-edits-feed?since=<iso>&owner=<key>&limit=<n>
// Returns: { ok: true, edits: [...], count: N }

import { getStore } from "@netlify/blobs";

const STORE = "bbc-dashboard-edits";

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  if (req.method !== "GET") return json({ ok: false, error: "GET only" }, 405);

  const url = new URL(req.url);
  const sinceIso = url.searchParams.get("since"); // optional ISO timestamp
  const ownerFilter = (url.searchParams.get("owner") || "").toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);

  let edits = [];
  try {
    const store = getStore({ name: STORE, consistency: "strong" });
    // List keys, optionally prefixed by owner
    const prefix = ownerFilter ? `${ownerFilter}/` : undefined;
    const { blobs } = await store.list({ prefix });
    // Each key is `${owner}/${iso}_${rand}` — pre-filter by since on the key (sort key prefix is iso after slash)
    const filtered = (blobs || []).filter(b => {
      if (!sinceIso) return true;
      const after = b.key.split("/")[1] || "";
      return after >= sinceIso;
    });
    // Fetch latest first, capped at limit
    filtered.sort((a, b) => (b.key > a.key ? 1 : -1));
    const top = filtered.slice(0, limit);
    edits = await Promise.all(top.map(async b => {
      try {
        const v = await store.get(b.key, { type: "json" });
        return v;
      } catch { return null; }
    }));
    edits = edits.filter(Boolean);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e).slice(0, 200) }, 500);
  }

  return json({ ok: true, count: edits.length, edits });
};
