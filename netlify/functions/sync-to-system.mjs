// BBC sync-to-system: bulk dashboard-state → NocoDB writes.
// Triggered when RJ says "sync to system" or clicks a sync button in the /os UI.
//
// Endpoint: POST /.netlify/functions/sync-to-system
// Body shape (Phase 2 contract):
// {
//   "writes": [
//     { "table": "dashboard_notes",      "op": "upsert", "key": "calendar/2026-06-09", "fields": { "note": "Tre 1 ready" } },
//     { "table": "dashboard_checkboxes", "op": "upsert", "key": "task/segment-4-mon",  "fields": { "checked": true } },
//     { "table": "dashboard_notes",      "op": "delete", "key": "calendar/2026-05-29" }
//   ]
// }
//
// Returns:
// {
//   "ok": true,
//   "writes": [
//     { "key": "...", "op": "upsert", "status": 200, "id": "rec123" },
//     ...
//   ],
//   "failed": 0
// }
//
// SAFETY:
//  - Each write is independent: one failure doesn't abort the batch.
//  - All writes proxy through the same NOCODB_TOKEN env var (server-side only).
//  - Tables must be in the WRITEABLE_TABLES list in nocodb-write.mjs.

const NOCODB_HOST = "https://app.nocodb.com";

// Mirror the WRITEABLE_TABLES whitelist from nocodb-write.mjs.
// Keep these two files in sync until Phase 3 deduplicates them into a shared module.
const WRITEABLE_TABLES = {
  // dashboard_notes:      "TODO_table_id_after_creating_in_nocodb",
  // dashboard_checkboxes: "TODO_table_id_after_creating_in_nocodb",
  // dashboard_statuses:   "TODO_table_id_after_creating_in_nocodb",
};

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  if (req.method.toUpperCase() !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ error: "NOCODB_TOKEN not set in Netlify env." }, 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!body || !Array.isArray(body.writes)) {
    return json({ error: "Body must be { writes: [ ... ] }." }, 400);
  }

  const results = [];
  let failed = 0;

  for (const w of body.writes) {
    if (!w || typeof w !== "object") {
      results.push({ key: null, status: 400, error: "Invalid write entry." });
      failed++;
      continue;
    }
    const { table, op, key, fields } = w;
    const tableId = WRITEABLE_TABLES[table];
    if (!tableId) {
      results.push({ key, op, status: 400, error: `Table '${table}' not whitelisted.` });
      failed++;
      continue;
    }
    if (typeof tableId === "string" && tableId.startsWith("TODO_")) {
      results.push({ key, op, status: 501, error: `Table '${table}' placeholder — not yet wired.` });
      failed++;
      continue;
    }
    if (!key) {
      results.push({ key, op, status: 400, error: "Missing key." });
      failed++;
      continue;
    }
    if ((op === "upsert" || op === "create" || op === "update") && (!fields || typeof fields !== "object")) {
      results.push({ key, op, status: 400, error: "Missing fields." });
      failed++;
      continue;
    }

    try {
      let result;
      if (op === "upsert") {
        // Look up existing record by item_key
        const findUrl = `${NOCODB_HOST}/api/v2/tables/${tableId}/records?where=(item_key,eq,${encodeURIComponent(key)})&limit=1`;
        const findR = await fetch(findUrl, { headers: { "xc-token": token, "accept": "application/json" } });
        const findData = await findR.json();
        const existing = findData?.list?.[0];
        if (existing) {
          // PATCH existing record
          const patchUrl = `${NOCODB_HOST}/api/v2/tables/${tableId}/records`;
          const patchR = await fetch(patchUrl, {
            method: "PATCH",
            headers: { "xc-token": token, "content-type": "application/json" },
            body: JSON.stringify([{ Id: existing.Id, ...fields, updated_at: new Date().toISOString() }]),
          });
          result = { key, op: "update", status: patchR.status, id: existing.Id };
        } else {
          // POST new record
          const postUrl = `${NOCODB_HOST}/api/v2/tables/${tableId}/records`;
          const postR = await fetch(postUrl, {
            method: "POST",
            headers: { "xc-token": token, "content-type": "application/json" },
            body: JSON.stringify({ item_key: key, ...fields, updated_at: new Date().toISOString() }),
          });
          const postData = await postR.json();
          result = { key, op: "create", status: postR.status, id: postData?.Id };
        }
      } else if (op === "delete") {
        const findUrl = `${NOCODB_HOST}/api/v2/tables/${tableId}/records?where=(item_key,eq,${encodeURIComponent(key)})&limit=1`;
        const findR = await fetch(findUrl, { headers: { "xc-token": token, "accept": "application/json" } });
        const findData = await findR.json();
        const existing = findData?.list?.[0];
        if (existing) {
          const delUrl = `${NOCODB_HOST}/api/v2/tables/${tableId}/records`;
          const delR = await fetch(delUrl, {
            method: "DELETE",
            headers: { "xc-token": token, "content-type": "application/json" },
            body: JSON.stringify([{ Id: existing.Id }]),
          });
          result = { key, op: "delete", status: delR.status, id: existing.Id };
        } else {
          result = { key, op: "delete", status: 404, error: "No matching record." };
        }
      } else {
        result = { key, op, status: 400, error: `Unknown op '${op}'. Use upsert | delete.` };
      }
      if (result.status >= 400) failed++;
      results.push(result);
    } catch (e) {
      results.push({ key, op, status: 502, error: String(e).slice(0, 200) });
      failed++;
    }
  }

  return json({ ok: failed === 0, total: body.writes.length, failed, writes: results });
};
