// Secure NocoDB WRITE proxy for the BBC Command Center (/os).
// Mirrors the read proxy in nocodb.mjs. Supports POST (create), PATCH (update by id), DELETE (remove by id).
// Token lives ONLY in Netlify env (NOCODB_TOKEN) — never exposed to the browser.
//
// Endpoints:
//   POST   /.netlify/functions/nocodb-write?table=<key>          body: { fields: {...} }            -> creates record
//   PATCH  /.netlify/functions/nocodb-write?table=<key>&id=<id>  body: { fields: {...} }            -> updates fields on record
//   DELETE /.netlify/functions/nocodb-write?table=<key>&id=<id>                                     -> removes record
//
// Base: BBC CRM (p0zn4yka8zr49iu) on app.nocodb.com (NocoDB Cloud, API v2).
//
// SAFETY:
//  - Tables must be in WRITEABLE_TABLES to be writeable. Other tables (e.g., contacts) are READ-ONLY by default
//    to prevent the dashboard from accidentally damaging the CRM.
//  - All writes are audit-logged via the response (caller can verify the round-trip).
//  - 422 on any field shape error from NocoDB is passed through unchanged.

const NOCODB_HOST = "https://app.nocodb.com";

// WRITEABLE table whitelist. Add a key here ONLY when RJ has created the table in NocoDB
// AND decided the dashboard should be allowed to mutate it.
//
// Conventions for dashboard-managed tables (Phase 3 prep):
//   dashboard_notes      - { item_key (string PK), note (long text), updated_at }
//   dashboard_checkboxes - { item_key (string PK), checked (boolean), updated_at }
//   dashboard_statuses   - { item_key (string PK), status (single-select), updated_at }
//
// Until RJ creates these in NocoDB, the keys below are placeholders. The function will return
// a clear error if you call with a placeholder key.
const WRITEABLE_TABLES = {
  // Live BBC CRM Contacts table. The /os CRM page updates lead Status here.
  // Guarded to PATCH-only below so the public endpoint can update existing leads
  // but cannot create or delete contacts. (Enabled 2026-06-05 for the CRM status dropdown.)
  contacts: "mjjs3wgl3705s9v",
  // Real tables — fill these in once they exist in NocoDB and you want them dashboard-editable.
  // dashboard_notes:      "TODO_table_id_after_creating_in_nocodb",
  // dashboard_checkboxes: "TODO_table_id_after_creating_in_nocodb",
  // dashboard_statuses:   "TODO_table_id_after_creating_in_nocodb",
};

// Tables that may ONLY be updated (PATCH), never created (POST) or removed (DELETE)
// via this public proxy. Limits blast radius on the live CRM.
const PATCH_ONLY_TABLES = ["contacts"];

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ error: "NOCODB_TOKEN not set in Netlify env." }, 500);

  const method = req.method.toUpperCase();
  if (!["POST", "PATCH", "DELETE"].includes(method)) {
    return json({ error: `Method ${method} not allowed. Use POST | PATCH | DELETE.` }, 405);
  }

  const url = new URL(req.url);
  const tkey = (url.searchParams.get("table") || "").toLowerCase();
  if (!tkey) return json({ error: "Missing required query param: table" }, 400);

  const tableId = WRITEABLE_TABLES[tkey];
  if (!tableId) {
    return json(
      {
        error: `Table '${tkey}' is not in the writeable whitelist.`,
        hint: "Add the table id to WRITEABLE_TABLES in nocodb-write.mjs after creating the table in NocoDB.",
        allowed: Object.keys(WRITEABLE_TABLES),
      },
      400
    );
  }
  if (typeof tableId === "string" && tableId.startsWith("TODO_")) {
    return json(
      {
        error: `Table '${tkey}' has a placeholder id in WRITEABLE_TABLES. Replace the TODO_* string with the real NocoDB table id.`,
      },
      501
    );
  }

  if (PATCH_ONLY_TABLES.includes(tkey) && method !== "PATCH") {
    return json(
      {
        error: `Table '${tkey}' allows PATCH (update) only via this proxy, not ${method}.`,
        hint: "Create/delete on this table must be done in NocoDB directly.",
      },
      405
    );
  }

  const recordId = url.searchParams.get("id");
  if ((method === "PATCH" || method === "DELETE") && !recordId) {
    return json({ error: `Method ${method} requires an 'id' query param.` }, 400);
  }

  // Parse body for POST / PATCH
  let body = null;
  if (method === "POST" || method === "PATCH") {
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    if (!body || typeof body !== "object" || !body.fields || typeof body.fields !== "object") {
      return json({ error: "Body must be { fields: {...} }." }, 400);
    }
  }

  // Build the upstream NocoDB request
  let api = `${NOCODB_HOST}/api/v2/tables/${tableId}/records`;
  let upstreamOpts = { headers: { "xc-token": token, "accept": "application/json" } };

  if (method === "POST") {
    upstreamOpts.method = "POST";
    upstreamOpts.headers["content-type"] = "application/json";
    upstreamOpts.body = JSON.stringify(body.fields);
  } else if (method === "PATCH") {
    upstreamOpts.method = "PATCH";
    upstreamOpts.headers["content-type"] = "application/json";
    // NocoDB v2 expects an array of records with `Id` field for PATCH
    upstreamOpts.body = JSON.stringify([{ Id: recordId, ...body.fields }]);
  } else if (method === "DELETE") {
    upstreamOpts.method = "DELETE";
    upstreamOpts.headers["content-type"] = "application/json";
    upstreamOpts.body = JSON.stringify([{ Id: recordId }]);
  }

  try {
    const r = await fetch(api, upstreamOpts);
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return json({ error: "NocoDB write failed", detail: String(e).slice(0, 200) }, 502);
  }
};
