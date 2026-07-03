// BBC campaign-status — email-marketing workflow status for the /os CRM page.
// Holds a computed summary of the drip campaigns (which email each lead is on, step distribution)
// so the dashboard can show it live on any device. Netlify Blobs (same engine as workflows.mjs).
//
// The LOCAL campaign engine computes the summary from its send logs and PUSHES it here after each
// daily run (see _tools/push-campaign-status.mjs). The dashboard READS it. One source of truth.
//
// GET  /.netlify/functions/campaign-status            -> { ok, updated, totalLeads, campaigns:[...] }
// POST /.netlify/functions/campaign-status {op:"set", data:{...}}   -> overwrite the whole summary
//        (data = { totalLeads, campaigns:[{key,name,gapDays,steps,stepReached,stepAt,leads}] })

import { getStore } from "@netlify/blobs";

const STORE = "bbc-campaign-status";
const KEY = "status";

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  const json = (o, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let store;
  try { store = getStore(STORE); }
  catch (e) { return json({ ok: false, error: "blob store unavailable", detail: String(e.message || e).slice(0, 200) }, 500); }

  try {
    if (req.method === "GET") {
      let st = null;
      try { st = await store.get(KEY, { type: "json", consistency: "strong" }); } catch { st = null; }
      if (!st) return json({ ok: true, empty: true, updated: null, totalLeads: 0, campaigns: [] });
      return json({ ok: true, ...st });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
      if (body.op !== "set" || !body.data || typeof body.data !== "object") {
        return json({ ok: false, error: 'use {op:"set", data:{...}}' }, 400);
      }
      const d = body.data;
      const clean = {
        updated: new Date().toISOString(),
        totalLeads: Number(d.totalLeads) || 0,
        campaigns: Array.isArray(d.campaigns) ? d.campaigns.slice(0, 20).map((c) => ({
          key: String(c.key || "").slice(0, 40),
          name: String(c.name || "").slice(0, 120),
          gapDays: Number(c.gapDays) || 0,
          steps: Array.isArray(c.steps) ? c.steps.slice(0, 20).map((s) => ({ step: Number(s.step) || 0, subject: String(s.subject || "").slice(0, 200) })) : [],
          stepReached: c.stepReached && typeof c.stepReached === "object" ? c.stepReached : {},
          stepAt: c.stepAt && typeof c.stepAt === "object" ? c.stepAt : {},
          leads: Array.isArray(c.leads) ? c.leads.slice(0, 2000).map((l) => ({ email: String(l.email || "").slice(0, 160), step: Number(l.step) || 0, org: String(l.org || "").slice(0, 120) })) : [],
        })) : [],
      };
      await store.setJSON(KEY, clean);
      return json({ ok: true, updated: clean.updated, campaigns: clean.campaigns.length });
    }

    return json({ ok: false, error: "method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "campaign-status failed", detail: String(e.message || e).slice(0, 240) }, 502);
  }
};
