// Secure NocoDB proxy for the BBC Command Center (/os).
// The API token lives ONLY in the Netlify env var NOCODB_TOKEN (never in the browser/repo).
// Endpoint: /.netlify/functions/nocodb?table=contacts&limit=200
//
// Base: BBC CRM (p0zn4yka8zr49iu) on app.nocodb.com (NocoDB Cloud, API v2).

const NOCODB_HOST = "https://app.nocodb.com";

// Whitelisted tables (id from the NocoDB URL). Add more as the dashboard needs them.
const TABLES = {
  contacts: "mjjs3wgl3705s9v", // Contacts table (Pipeline view: vw7khib7cust09ee)
};

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
    });

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ error: "NOCODB_TOKEN not set in Netlify env." }, 500);

  const url = new URL(req.url);
  const tkey = (url.searchParams.get("table") || "contacts").toLowerCase();
  const tableId = TABLES[tkey];
  if (!tableId) return json({ error: `Unknown table '${tkey}'. Allowed: ${Object.keys(TABLES).join(", ")}` }, 400);

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1000);
  const api = `${NOCODB_HOST}/api/v2/tables/${tableId}/records?limit=${limit}`;

  try {
    const r = await fetch(api, { headers: { "xc-token": token, "accept": "application/json" } });
    const text = await r.text();
    // Pass NocoDB's response through (records + pageInfo), preserving status for debugging.
    return new Response(text, {
      status: r.status,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
    });
  } catch (e) {
    return json({ error: "NocoDB fetch failed", detail: String(e).slice(0, 200) }, 502);
  }
};
