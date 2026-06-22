// BBC Messenger admin — create VA login accounts from inside the app.
// HUB-ONLY: only BBC Bruno (RJ) can call this. It creates a Supabase auth user.
// Requires Netlify env var SUPABASE_SERVICE_ROLE_KEY (admin key, server-side only, never in repo).
//
// POST { action:"createUser", email, password, name }  -> creates the account (email pre-confirmed)
// POST { action:"listUsers" }                          -> lists existing accounts (email + name)

const SUPABASE_URL = "https://ctoeuikxoqlhnebgsygp.supabase.co";
const SUPABASE_KEY = "sb_publishable_WnJ57fk-ymDuT2xtVZRcHg_khZCWgJL"; // publishable (for verifying the caller)
const HUB_EMAILS = new Set(["rjbryantresreyes@gmail.com", "rj@balaynibruno.co"]);

async function verify(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: SUPABASE_KEY },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

async function findUserId(email, adminHeaders) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/admin/users?per_page=200", { headers: adminHeaders });
  const d = await r.json();
  const u = (d.users || []).find((x) => (x.email || "").toLowerCase() === email);
  return u ? u.id : null;
}

export default async (req) => {
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  const json = (o, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const user = await verify(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!HUB_EMAILS.has((user.email || "").toLowerCase())) return json({ error: "Only BBC Bruno can add team members." }, 403);

  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE) return json({ error: "Admin key not set. Add SUPABASE_SERVICE_ROLE_KEY in Netlify env vars." }, 400);

  let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const adminHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };

  try {
    if (body.action === "listUsers") {
      const r = await fetch(SUPABASE_URL + "/auth/v1/admin/users?per_page=200", { headers: adminHeaders });
      const d = await r.json();
      if (!r.ok) return json({ error: (d && d.msg) || "list failed" }, 502);
      const users = (d.users || []).map(u => ({ email: u.email, name: (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || "" }));
      return json({ users });
    }

    if (body.action === "createUser") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      if (!email || !password) return json({ error: "email and password required" }, 400);
      if (password.length < 6) return json({ error: "password must be at least 6 characters" }, 400);

      const r = await fetch(SUPABASE_URL + "/auth/v1/admin/users", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msg = (d && (d.msg || d.message || d.error_description)) || "";
        // user already exists -> reset their password instead of failing (idempotent)
        if (r.status === 422 || /already|exist|registered/i.test(msg)) {
          const id = await findUserId(email, adminHeaders);
          if (id) {
            const ur = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + id, {
              method: "PUT", headers: adminHeaders,
              body: JSON.stringify({ password, user_metadata: { name } }),
            });
            const ud = await ur.json();
            if (ur.ok) return json({ ok: true, updated: true, user: { email, name } });
            return json({ error: (ud && (ud.msg || ud.message)) || "reset failed" }, 502);
          }
        }
        return json({ error: msg || "create failed" }, 502);
      }
      return json({ ok: true, user: { email, name } });
    }

    if (body.action === "resetPassword") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || password.length < 6) return json({ error: "email and password (min 6) required" }, 400);
      const id = await findUserId(email, adminHeaders);
      if (!id) return json({ error: "user not found" }, 404);
      const ur = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + id, {
        method: "PUT", headers: adminHeaders, body: JSON.stringify({ password }),
      });
      const ud = await ur.json();
      if (ur.ok) return json({ ok: true, reset: true, email });
      return json({ error: (ud && (ud.msg || ud.message)) || "reset failed" }, 502);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: "admin function failed", detail: String(e.message || e).slice(0, 200) }, 502);
  }
};
