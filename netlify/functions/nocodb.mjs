// Secure NocoDB proxy for the BBC Command Center (/os).
// The API token lives ONLY in the Netlify env var NOCODB_TOKEN (never in the browser/repo).
// GET  /.netlify/functions/nocodb?table=contacts&limit=200   -> read records
// POST /.netlify/functions/nocodb?table=contacts  body {id, Status}  -> update ONE field (whitelisted)
//
// Base: BBC CRM (p0zn4yka8zr49iu) on app.nocodb.com (NocoDB Cloud, API v2).

const NOCODB_HOST = "https://app.nocodb.com";

// Whitelisted tables (id from the NocoDB URL). Add more as the dashboard needs them.
const TABLES = {
  contacts: "mjjs3wgl3705s9v", // Contacts table (Pipeline view: vw7khib7cust09ee)
};

// Fields the browser is allowed to write (everything else is rejected — safety).
const WRITABLE = new Set(["Status"]);

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ error: "NOCODB_TOKEN not set in Netlify env." }, 500);

  const url = new URL(req.url);
  const tkey = (url.searchParams.get("table") || "contacts").toLowerCase();
  const tableId = TABLES[tkey];
  if (!tableId) return json({ error: `Unknown table '${tkey}'. Allowed: ${Object.keys(TABLES).join(", ")}` }, 400);

  const recordsApi = `${NOCODB_HOST}/api/v2/tables/${tableId}/records`;

  /* ---- WRITE: update one whitelisted field on one record ---- */
  if (req.method === "POST" || req.method === "PATCH") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad JSON body" }, 400); }
    const id = body && (body.id ?? body.Id);
    if (id === undefined || id === null || id === "") return json({ error: "Missing record id" }, 400);

    // build a clean patch from whitelisted keys only
    const patch = { Id: id };
    let touched = 0;
    for (const k of Object.keys(body)) {
      if (WRITABLE.has(k)) { patch[k] = body[k]; touched++; }
    }
    if (!touched) return json({ error: `No writable field. Allowed: ${[...WRITABLE].join(", ")}` }, 400);

    try {
      const r = await fetch(recordsApi, {
        method: "PATCH",
        headers: { "xc-token": token, "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify([patch]), // NocoDB v2 bulk-update expects an array
      });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    } catch (e) {
      return json({ error: "NocoDB update failed", detail: String(e).slice(0, 200) }, 502);
    }
  }

  /* ---- READ (auto-paginates so ONE call returns ALL records) ---- */
  // NocoDB v2 caps each page at 100 records server-side regardless of `limit`. Prior versions
  // returned only the first 100, so any lead past #100 (e.g. in a 330-row table) was invisible
  // to the dashboard's contact lookup. We now loop pages of 100 (via offset) until we have
  // `limit` rows or hit the last page, and return the combined list. Explicit `offset=` callers
  // still get a single page (back-compat for paginated bulk readers). Fixed 2026-06-13.
  const PAGE = 100;
  const want = Math.min(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 5000);
  const hasOffset = url.searchParams.has("offset");
  const startOffset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  try {
    if (hasOffset) {
      // single-page passthrough for explicit paginated callers
      const r = await fetch(`${recordsApi}?limit=${Math.min(want, PAGE)}&offset=${startOffset}`, { headers: { "xc-token": token, "accept": "application/json" } });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { "content-type": "application/json", "cache-control": "public, max-age=10" } });
    }
    let all = [];
    for (let off = 0; all.length < want; off += PAGE) {
      const r = await fetch(`${recordsApi}?limit=${PAGE}&offset=${off}`, { headers: { "xc-token": token, "accept": "application/json" } });
      if (!r.ok) {
        const text = await r.text();
        return new Response(text, { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      }
      const data = await r.json();
      const list = Array.isArray(data.list) ? data.list : [];
      all = all.concat(list);
      const lastPage = list.length < PAGE || (data.pageInfo && data.pageInfo.isLastPage);
      if (lastPage) break;
      if (off > 5000) break; // hard safety stop
    }
    if (all.length > want) all = all.slice(0, want);
    return json({ list: all, pageInfo: { totalRows: all.length, isLastPage: true } });
  } catch (e) {
    return json({ error: "NocoDB fetch failed", detail: String(e).slice(0, 200) }, 502);
  }
};
