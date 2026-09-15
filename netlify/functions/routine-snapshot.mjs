// BBC Command Center - DAILY ROUTINE SNAPSHOT store.
//
// Why this exists: the dashboard went stale because nothing wrote to it. The routine
// produced findings into a terminal and they died there. This is the pipe.
//
// Deliberately Netlify Blobs, NOT a committed JSON file. netlify.toml skips the build
// for commits titled "Dashboard sync: refresh /os data from system", so a routine that
// published by committing would silently swallow whatever else was staged. Blobs means
// the routine never touches git at all.
//
// GET  /.netlify/functions/routine-snapshot           -> latest snapshot
// GET  /.netlify/functions/routine-snapshot?date=YYYY-MM-DD -> that day's snapshot
// GET  /.netlify/functions/routine-snapshot?history=14 -> last N daily summaries (for trend charts)
// POST /.netlify/functions/routine-snapshot           -> write today's snapshot (needs token)
//
// POST auth: header  x-routine-token: <ROUTINE_TOKEN env var>
// If ROUTINE_TOKEN is not set on the site, writes are REFUSED rather than left open.
//
// GET auth (added 2026-09-15): header  x-routine-read-key: <ROUTINE_READ_KEY env var>
// The write token is also accepted, so the routine itself can still read.
// If ROUTINE_READ_KEY is not set on the site, reads are REFUSED rather than left open.
//
// WHY READS ARE GATED: until 2026-09-15 every GET was open to the whole internet, including
// ?date=YYYY-MM-DD for any past day. The snapshots carry client complaints close to verbatim,
// retainer figures, email-authentication weaknesses, a revoked API token and the names of the
// founder's private chats. They were written on the assumption /os was private. It was not.
// A separate read key means a VA can view the dashboard without being able to overwrite it.

import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

// Compare secrets without leaking length or content through timing.
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

const STORE = "bbc-routine";
const LATEST = "latest";
const INDEX = "index";           // [{date, generated_at, counts}] newest first
const MAX_HISTORY = 90;

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-routine-token, x-routine-read-key",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let store;
  try { store = getStore(STORE); }
  catch (e) { return json({ error: "blob store unavailable", detail: String(e.message || e).slice(0, 200) }, 500); }

  const readJson = async (key, fallback) => {
    try { return (await store.get(key, { type: "json", consistency: "strong" })) ?? fallback; }
    catch { return fallback; }
  };

  // ---------- READ ----------
  if (req.method === "GET") {
    const readKey = process.env.ROUTINE_READ_KEY;
    if (!readKey) {
      // Fail CLOSED. An unset key must never mean "open to everyone", which is exactly how
      // this endpoint ended up public in the first place.
      return json({
        error: "ROUTINE_READ_KEY is not configured on this site, so reads are refused.",
        fix: "Netlify > Site configuration > Environment variables > add ROUTINE_READ_KEY, then redeploy.",
      }, 503);
    }
    const givenRead = req.headers.get("x-routine-read-key") || "";
    const givenWrite = req.headers.get("x-routine-token") || "";
    const writeTok = process.env.ROUTINE_TOKEN || "";
    const authorised = (givenRead && safeEq(givenRead, readKey)) ||
                       (writeTok && givenWrite && safeEq(givenWrite, writeTok));
    if (!authorised) return json({ error: "dashboard is private: missing or wrong read key" }, 401);

    const url = new URL(req.url);
    const history = url.searchParams.get("history");
    const date = url.searchParams.get("date");

    if (history) {
      const n = Math.min(Math.max(parseInt(history, 10) || 14, 1), MAX_HISTORY);
      const idx = await readJson(INDEX, []);
      return json({ history: idx.slice(0, n) });
    }
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
      const snap = await readJson(`day/${date}`, null);
      return snap ? json(snap) : json({ error: "no snapshot for that date" }, 404);
    }
    const latest = await readJson(LATEST, null);
    if (!latest) {
      return json({
        empty: true,
        message: "No routine snapshot yet. Run the daily routine to populate the dashboard.",
      });
    }
    return json(latest);
  }

  // ---------- WRITE ----------
  if (req.method === "POST") {
    const expected = process.env.ROUTINE_TOKEN;
    if (!expected) {
      return json({
        error: "ROUTINE_TOKEN is not configured on this site, so writes are refused.",
        fix: "Netlify > Site configuration > Environment variables > add ROUTINE_TOKEN, then redeploy.",
      }, 503);
    }
    const given = req.headers.get("x-routine-token") || "";
    if (!safeEq(given, expected)) {
      return json({ error: "bad or missing x-routine-token" }, 401);
    }

    let body;
    try { body = await req.json(); }
    catch { return json({ error: "body must be JSON" }, 400); }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "body must be a JSON object" }, 400);
    }

    const now = new Date().toISOString();
    const date =
      typeof body.shift_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.shift_date)
        ? body.shift_date
        : now.slice(0, 10);

    const snapshot = { ...body, shift_date: date, generated_at: body.generated_at || now, stored_at: now };

    const raw = JSON.stringify(snapshot);
    if (raw.length > 2_000_000) return json({ error: "snapshot too large (>2MB)" }, 413);

    try {
      await store.setJSON(LATEST, snapshot);
      await store.setJSON(`day/${date}`, snapshot);

      const clients = Array.isArray(snapshot.clients) ? snapshot.clients : [];
      const attention = Array.isArray(snapshot.attention) ? snapshot.attention : [];
      const entry = {
        date,
        generated_at: snapshot.generated_at,
        counts: {
          clients: clients.length,
          attention: attention.length,
          blocking: attention.filter((a) => a && a.severity === "blocking").length,
          sites_ok: clients.filter((c) => c?.services?.website?.state === "ok").length,
          unverified: Array.isArray(snapshot.unverified) ? snapshot.unverified.length : 0,
        },
      };
      const idx = await readJson(INDEX, []);
      const next = [entry, ...idx.filter((e) => e && e.date !== date)].slice(0, MAX_HISTORY);
      await store.setJSON(INDEX, next);

      return json({ ok: true, date, stored_at: now, bytes: raw.length, history_len: next.length });
    } catch (e) {
      return json({ error: "write failed", detail: String(e.message || e).slice(0, 300) }, 500);
    }
  }

  return json({ error: "method not allowed" }, 405);
};
