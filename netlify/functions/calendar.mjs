// BBC Command Center — editable calendar store (synced across all devices via NocoDB).
// The dashboard day-sheet writes entries here; every device reads the same store.
// Token lives ONLY in Netlify env NOCODB_TOKEN. Auto-creates the table on first use.
//
// GET  /.netlify/functions/calendar                      -> { list:[{id,date,title,type,link,notes}] }
// POST /.netlify/functions/calendar  {date,title,type,link,notes,id?}  -> create (or update if id) one entry
// POST /.netlify/functions/calendar  {delete:true,id}    -> delete one entry

const HOST = "https://app.nocodb.com";
const BASE = "p0zn4yka8zr49iu";            // BBC CRM base
const TABLE_TITLE = "BBC_Calendar";
const COLUMNS = [
  { title: "Title", uidt: "SingleLineText" },
  { title: "Date",  uidt: "SingleLineText" },   // ISO yyyy-mm-dd (string keeps it simple + timezone-safe)
  { title: "Type",  uidt: "SingleLineText" },   // Graphic | Video | Reel | Carousel | Note | Other
  { title: "Link",  uidt: "SingleLineText" },   // Google Drive folder/file URL
  { title: "Notes", uidt: "LongText" },
];

let TABLE_ID = null; // cached per warm instance

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ error: "NOCODB_TOKEN not set in Netlify env." }, 500);
  const H = { "xc-token": token, "content-type": "application/json", "accept": "application/json" };

  // resolve (or create) the calendar table
  async function tableId() {
    if (TABLE_ID) return TABLE_ID;
    // look for an existing table by title
    const lr = await fetch(`${HOST}/api/v2/meta/bases/${BASE}/tables`, { headers: H });
    if (lr.ok) {
      const d = await lr.json();
      const found = (d.list || []).find(t => t.title === TABLE_TITLE);
      if (found) { TABLE_ID = found.id; return TABLE_ID; }
    }
    // create it
    const cr = await fetch(`${HOST}/api/v2/meta/bases/${BASE}/tables`, {
      method: "POST", headers: H,
      body: JSON.stringify({ title: TABLE_TITLE, columns: COLUMNS }),
    });
    const cd = await cr.json();
    if (!cr.ok) throw new Error("table create failed: " + (cd && cd.msg || cr.status));
    TABLE_ID = cd.id;
    return TABLE_ID;
  }

  try {
    const tid = await tableId();
    const recApi = `${HOST}/api/v2/tables/${tid}/records`;

    if (req.method === "GET") {
      const r = await fetch(`${recApi}?limit=1000`, { headers: H });
      const d = await r.json();
      if (!r.ok) return json({ error: "read failed", detail: d }, 502);
      const list = (d.list || []).map(x => ({
        id: x.Id ?? x.id, date: x.Date || "", title: x.Title || "", type: x.Type || "", link: x.Link || "", notes: x.Notes || "",
      }));
      return json({ list });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

      if (body.delete && (body.id ?? body.Id) != null) {
        const r = await fetch(recApi, { method: "DELETE", headers: H, body: JSON.stringify([{ Id: body.id ?? body.Id }]) });
        const d = await r.json().catch(() => ({}));
        return json({ ok: r.ok, result: d }, r.ok ? 200 : 502);
      }

      const rec = {};
      if (body.title != null) rec.Title = String(body.title).slice(0, 200);
      if (body.date  != null) rec.Date  = String(body.date).slice(0, 20);
      if (body.type  != null) rec.Type  = String(body.type).slice(0, 40);
      if (body.link  != null) rec.Link  = String(body.link).slice(0, 600);
      if (body.notes != null) rec.Notes = String(body.notes).slice(0, 4000);
      if (!rec.Date && !(body.id ?? body.Id)) return json({ error: "date required" }, 400);

      let r;
      if ((body.id ?? body.Id) != null) {
        rec.Id = body.id ?? body.Id;
        r = await fetch(recApi, { method: "PATCH", headers: H, body: JSON.stringify([rec]) });
      } else {
        r = await fetch(recApi, { method: "POST", headers: H, body: JSON.stringify([rec]) });
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: "save failed", detail: d }, 502);
      return json({ ok: true, result: d });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: "calendar function failed", detail: String(e.message || e).slice(0, 240) }, 502);
  }
};
