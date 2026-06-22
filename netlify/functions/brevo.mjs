// Secure Brevo proxy for the BBC Command Center (/os) CRM page.
// The API key lives ONLY in the Netlify env var BREVO_API_KEY (never in the browser/repo).
//
// READ:
//   GET /.netlify/functions/brevo?action=lists                  -> BBC CRM lists + counts
//   GET /.netlify/functions/brevo?action=contacts&list=8&limit=50&offset=0
//   GET /.netlify/functions/brevo?action=stats                  -> account + recent campaign stats
// WRITE (whitelisted):
//   POST /.netlify/functions/brevo  {action:"add", email, firstName?, lastName?, company?, listId}
//   POST /.netlify/functions/brevo  {action:"move", email, addListId?, removeListId?}
//
// Safety: writes only touch contacts and only the BBC CRM lists below.

const API = "https://api.brevo.com/v3";
const FOLDER_ID = 3;                         // "BBC CRM" folder
const ALLOWED_LISTS = new Set([4, 5, 6, 7, 8, 9, 10]); // Ecommerce/Builder/Remodeler/Design/Active/Old/Possible

export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  const key = process.env.BREVO_API_KEY;
  if (!key) return json({ error: "BREVO_API_KEY not set in Netlify env." }, 500);

  const H = { "api-key": key, "accept": "application/json", "content-type": "application/json" };
  const bget = async (path) => {
    const r = await fetch(`${API}${path}`, { headers: H });
    const t = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : {};
  };

  const url = new URL(req.url);

  /* ---------- WRITE ---------- */
  if (req.method === "POST" || req.method === "PATCH") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad JSON body" }, 400); }
    const action = body.action;

    if (action === "add") {
      const email = (body.email || "").trim().toLowerCase();
      const listId = parseInt(body.listId, 10);
      if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
      if (!ALLOWED_LISTS.has(listId)) return json({ error: "listId not allowed" }, 400);
      const attributes = {};
      if (body.firstName) attributes.FIRSTNAME = body.firstName;
      if (body.lastName) attributes.LASTNAME = body.lastName;
      if (body.company) attributes.COMPANY = body.company;
      const r = await fetch(`${API}/contacts`, {
        method: "POST", headers: H,
        body: JSON.stringify({ email, attributes, listIds: [listId], updateEnabled: true }),
      });
      const t = await r.text();
      return new Response(t || JSON.stringify({ ok: true }), { status: r.ok ? 200 : r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }

    if (action === "status") {
      const email = (body.email || "").trim().toLowerCase();
      const status = (body.status || "").trim();
      if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
      if (!status) return json({ error: "status required" }, 400);
      const r = await fetch(`${API}/contacts/${encodeURIComponent(email)}`, {
        method: "PUT", headers: H,
        body: JSON.stringify({ attributes: { STATUS: status } }),
      });
      if (r.ok || r.status === 204) return json({ ok: true, email, status });
      return json({ error: "status update failed", detail: (await r.text()).slice(0, 150) }, r.status);
    }

    if (action === "move") {
      const email = (body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
      const add = body.addListId != null ? parseInt(body.addListId, 10) : null;
      const rem = body.removeListId != null ? parseInt(body.removeListId, 10) : null;
      if (add != null && !ALLOWED_LISTS.has(add)) return json({ error: "addListId not allowed" }, 400);
      if (rem != null && !ALLOWED_LISTS.has(rem)) return json({ error: "removeListId not allowed" }, 400);
      const out = {};
      if (add != null) {
        const r = await fetch(`${API}/contacts/lists/${add}/contacts/add`, { method: "POST", headers: H, body: JSON.stringify({ emails: [email] }) });
        out.added = r.ok; if (!r.ok) out.addErr = (await r.text()).slice(0, 150);
      }
      if (rem != null) {
        const r = await fetch(`${API}/contacts/lists/${rem}/contacts/remove`, { method: "POST", headers: H, body: JSON.stringify({ emails: [email] }) });
        out.removed = r.ok; if (!r.ok) out.remErr = (await r.text()).slice(0, 150);
      }
      return json(out);
    }

    if (action === "deal") {
      const name = (body.name || "").trim();
      if (!name) return json({ error: "deal name required" }, 400);
      const attributes = {};
      if (body.pipeline) attributes.pipeline = body.pipeline;
      if (body.stage) attributes.deal_stage = body.stage;
      if (body.amount != null && body.amount !== "") attributes.amount = Number(body.amount) || 0;
      const payload = { name, attributes };
      if (body.contactEmail) { try { const c = await bget(`/contacts/${encodeURIComponent(body.contactEmail.toLowerCase())}`); if (c.id) payload.linkedContactsIds = [c.id]; } catch {} }
      const r = await fetch(`${API}/crm/deals`, { method: "POST", headers: H, body: JSON.stringify(payload) });
      const t = await r.text();
      return new Response(t || '{"ok":true}', { status: r.ok ? 200 : r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }

    if (action === "deal-stage") {
      if (!body.id || !body.stage) return json({ error: "id and stage required" }, 400);
      const r = await fetch(`${API}/crm/deals/${body.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ attributes: { deal_stage: body.stage } }) });
      if (r.ok || r.status === 204) return json({ ok: true });
      return json({ error: "move failed", detail: (await r.text()).slice(0, 150) }, r.status);
    }

    if (action === "task") {
      const name = (body.name || "").trim();
      if (!name) return json({ error: "task name required" }, 400);
      let taskTypeId = body.taskTypeId;
      if (!taskTypeId) { try { const tt = await bget(`/crm/tasktypes`); taskTypeId = (Array.isArray(tt) ? tt[0] : (tt.items || [])[0])?.id; } catch {} }
      const payload = { name, date: body.date || new Date(Date.now() + 86400000).toISOString(), duration: 1800000 };
      if (taskTypeId) payload.taskTypeId = taskTypeId;
      if (body.contactEmail) { try { const c = await bget(`/contacts/${encodeURIComponent(body.contactEmail.toLowerCase())}`); if (c.id) payload.contactsIds = [c.id]; } catch {} }
      const r = await fetch(`${API}/crm/tasks`, { method: "POST", headers: H, body: JSON.stringify(payload) });
      const t = await r.text();
      return new Response(t || '{"ok":true}', { status: r.ok ? 200 : r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }

    if (action === "task-done") {
      if (!body.id) return json({ error: "id required" }, 400);
      const r = await fetch(`${API}/crm/tasks/${body.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ done: body.done !== false }) });
      if (r.ok || r.status === 204) return json({ ok: true });
      return json({ error: "task update failed", detail: (await r.text()).slice(0, 150) }, r.status);
    }

    if (action === "company") {
      const name = (body.name || "").trim();
      if (!name) return json({ error: "company name required" }, 400);
      const attributes = {};
      if (body.domain) attributes.domain = body.domain;
      const r = await fetch(`${API}/companies`, { method: "POST", headers: H, body: JSON.stringify({ name, attributes }) });
      const t = await r.text();
      return new Response(t || '{"ok":true}', { status: r.ok ? 200 : r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }

    return json({ error: "Unknown action." }, 400);
  }

  /* ---------- READ ---------- */
  const action = (url.searchParams.get("action") || "lists").toLowerCase();
  try {
    if (action === "lists") {
      const data = await bget(`/contacts/lists?limit=50&offset=0`);
      const lists = (data.lists || [])
        .filter((l) => l.folderId === FOLDER_ID)
        .map((l) => ({ id: l.id, name: l.name, count: l.totalSubscribers ?? l.uniqueSubscribers ?? 0 }))
        .sort((a, b) => a.id - b.id);
      return json({ lists });
    }
    if (action === "contacts") {
      const list = parseInt(url.searchParams.get("list") || "0", 10);
      if (!ALLOWED_LISTS.has(list)) return json({ error: "list not allowed" }, 400);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 500);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
      const data = await bget(`/contacts/lists/${list}/contacts?limit=${limit}&offset=${offset}&sort=desc`);
      const contacts = (data.contacts || []).map((c) => ({
        id: c.id, email: c.email,
        name: [c.attributes?.FIRSTNAME, c.attributes?.LASTNAME].filter(Boolean).join(" "),
        company: c.attributes?.COMPANY || "", status: c.attributes?.STATUS || "",
        platform: c.attributes?.PLATFORM || "", tier: c.attributes?.TIER || "",
      }));
      return json({ contacts, count: data.count ?? contacts.length });
    }
    if (action === "stats") {
      const acct = await bget(`/account`);
      let campaigns = [];
      try {
        const c = await bget(`/emailCampaigns?limit=10&status=sent`);
        campaigns = (c.campaigns || []).map((x) => ({
          id: x.id, name: x.name,
          sent: x.statistics?.globalStats?.sent || 0,
          opens: x.statistics?.globalStats?.uniqueViews || 0,
          clicks: x.statistics?.globalStats?.uniqueClicks || 0,
        }));
      } catch { /* free accounts with no campaigns */ }
      const plan = (acct.plan || [])[0] || {};
      return json({ account: { email: acct.email, company: acct.companyName, plan: plan.type, credits: plan.credits }, campaigns });
    }
    if (action === "pipelines") {
      let data; try { data = await bget(`/crm/pipeline/details`); } catch { data = []; }
      const arr = Array.isArray(data) ? data : (data && (data.pipeline || data.id) ? [data] : []);
      const pipelines = arr.map((p) => ({
        id: p.pipeline || p.id,
        name: p.pipeline_name || p.name || "Pipeline",
        stages: (p.stages || []).map((s) => ({ id: s.id, name: s.name })),
      }));
      return json({ pipelines });
    }
    if (action === "deals") {
      const data = await bget(`/crm/deals?limit=100&offset=0`);
      const deals = (data.items || []).map((d) => ({
        id: d.id,
        name: d.attributes?.deal_name || d.attributes?.name || "(deal)",
        stage: d.attributes?.deal_stage || "",
        amount: Number(d.attributes?.amount) || 0,
        pipeline: d.attributes?.pipeline || "",
        contacts: d.linkedContactsIds || [],
      }));
      return json({ deals });
    }
    if (action === "tasks") {
      const data = await bget(`/crm/tasks?limit=100`);
      const tasks = (data.items || []).map((t) => ({ id: t.id, name: t.name, date: t.date, done: !!t.done }));
      return json({ tasks });
    }
    if (action === "companies") {
      const data = await bget(`/companies?limit=100`);
      const companies = (data.items || []).map((c) => ({ id: c.id, name: c.attributes?.name || "(company)", domain: c.attributes?.domain || "" }));
      return json({ companies });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: "Brevo fetch failed", detail: String(e).slice(0, 200) }, 502);
  }
};
