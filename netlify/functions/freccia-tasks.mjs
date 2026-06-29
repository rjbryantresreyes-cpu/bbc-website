// Freccia tasks board — persistent shared state via Netlify Blobs.
// GET  /.netlify/functions/freccia-tasks            -> { ok, board }
// POST /.netlify/functions/freccia-tasks  body:{board, editor} -> { ok }
//
// Board shape: { columns: { todo:[], doing:[], done:[] }, updated_at, updated_by }
// Each task: { id, text, meta }
// Mirrors the dashboard-edit audit trail by best-effort notifying on save.

import { getStore } from "@netlify/blobs";

const STORE = "freccia-tasks";
const KEY = "board";

const SEED = {
  columns: {
    todo: [
      { id: "t1", text: "Connect GHL to Make (leads + pipeline)", meta: "Setup · RJ" },
      { id: "t2", text: "Connect CallRail (pull call leads in real time)", meta: "Setup · RJ" },
      { id: "t3", text: "Build spam-filter rules for form fills", meta: "Leads · spam ~50%" },
    ],
    doing: [
      { id: "t4", text: "Log in to all Freccia software (week 2)", meta: "Access" },
      { id: "t5", text: "5 reels/week from their footage + captions", meta: "Social · scope" },
    ],
    done: [
      { id: "t6", text: "Copy 'All Things Marketing' into our Drive", meta: "Done 2026-06-29" },
      { id: "t7", text: "Marketing deep dive", meta: "Done 2026-06-29" },
    ],
  },
  updated_at: null,
  updated_by: "seed",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  let store;
  try { store = getStore({ name: STORE, consistency: "strong" }); }
  catch (e) { return json({ ok: false, error: "blobs unavailable: " + (e.message || e) }, 500); }

  if (req.method === "GET") {
    try {
      const raw = await store.get(KEY);
      const board = raw ? JSON.parse(raw) : SEED;
      return json({ ok: true, board });
    } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: "Bad JSON" }, 400); }
    const board = body?.board;
    if (!board || !board.columns) return json({ ok: false, error: "Missing board.columns" }, 400);
    board.updated_at = new Date().toISOString();
    board.updated_by = (body?.editor || "unknown").slice(0, 80);
    try {
      await store.set(KEY, JSON.stringify(board));
    } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }

    // Best-effort audit/notify via the shared dashboard-edit endpoint. Never blocks the save.
    try {
      await fetch(new URL("/.netlify/functions/dashboard-edit", req.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dashboard_owner: "freccia",
          editor: board.updated_by,
          entity_type: "tasks_board",
          entity_key: "freccia/tasks",
          field: "board",
          new_value: `todo ${board.columns.todo?.length||0} · doing ${board.columns.doing?.length||0} · done ${board.columns.done?.length||0}`,
          dashboard_url: "https://balaynibruno.co/os/clients/freccia/tasks.html",
        }),
      });
    } catch {}

    return json({ ok: true, updated_at: board.updated_at });
  }

  return json({ ok: false, error: "GET or POST only" }, 405);
};
