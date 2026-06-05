// ONE-TIME admin helper: create the two CRM campaign-tracking fields in NocoDB
// (Email Version single-select A/B, Campaign Step single-select). Uses the server-side
// NOCODB_TOKEN. Delete this function after running it once.
//   GET /.netlify/functions/setup-crm-fields?key=bbcsetup

const NOCODB_HOST = "https://app.nocodb.com";
const CONTACTS_TABLE = "mjjs3wgl3705s9v";

const COLUMNS = [
  { title: "Email Version", uidt: "SingleSelect", options: ["A", "B"] },
  { title: "Campaign Step", uidt: "SingleSelect", options: ["Intro sent", "HVS sent", "WW sent", "HiUp-FCF sent", "Offer sent", "Done"] },
];

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  const url = new URL(req.url);
  if (url.searchParams.get("key") !== "bbcsetup") return json({ ok: false, error: "forbidden" }, 403);

  const token = process.env.NOCODB_TOKEN;
  if (!token) return json({ ok: false, error: "NOCODB_TOKEN not set" }, 500);

  const api = `${NOCODB_HOST}/api/v2/meta/tables/${CONTACTS_TABLE}/columns`;
  const results = [];

  for (const col of COLUMNS) {
    const body = {
      title: col.title,
      column_name: col.title,
      uidt: col.uidt,
      dtxp: col.options.map((o) => `'${o}'`).join(","),
      colOptions: { options: col.options.map((o) => ({ title: o })) },
    };
    try {
      const r = await fetch(api, {
        method: "POST",
        headers: { "xc-token": token, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      results.push({ column: col.title, status: r.status, response: text.slice(0, 400) });
    } catch (e) {
      results.push({ column: col.title, error: String(e).slice(0, 200) });
    }
  }

  return json({ ok: true, results });
};
