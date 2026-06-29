/* Freccia dashboard auth gate — Supabase login.
   Reuses the BBC Supabase project (same as /os). The /os gate is BBC-only and blocks
   client logins; THIS gate allows Freccia's people + BBC. Include on every Freccia page:
     <script src="freccia-auth.js"></script>
   It injects a full-screen branded login overlay, loads supabase-js, and only reveals
   the page to an allowed, authenticated user. */
(function () {
  var SUPABASE_URL = 'https://ctoeuikxoqlhnebgsygp.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_WnJ57fk-ymDuT2xtVZRcHg_khZCWgJL'; // publishable (public) key

  // Who may open the Freccia dashboard: Freccia's own people + their BBC VA + BBC team.
  function allowed(email) {
    var e = (email || '').toLowerCase().trim();
    if (/@balaynibruno\.co$/.test(e)) return true;          // any BBC address
    if (/@frecciagroup\.com$/.test(e)) return true;          // any Freccia address
    return [
      'rjbryantresreyes@gmail.com',
      'rebekahseveri@gmail.com',     // Rebekah's alt
      'ryan17.bbc@gmail.com',        // Ryan (Freccia VA)
      'daryl.ausan00@gmail.com',     // Daryl
      'krizza.bbc@gmail.com', 'krizzamaymanagase@gmail.com', 'daryl.bbc@gmail.com'
    ].indexOf(e) >= 0;
  }

  var sb = null;
  function loadSupabase() {
    return new Promise(function (resolve) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }
  function client() {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return sb;
  }

  // ---- overlay UI (opaque, covers the page until authed) ----
  function injectOverlay() {
    var o = document.createElement('div');
    o.id = 'frec-auth';
    o.innerHTML =
      '<div class="fa-card">' +
        '<img src="freccia-logo.png" alt="Freccia Construction" class="fa-logo" onerror="this.style.display=\'none\'">' +
        '<div class="fa-kicker">Marketing Dashboard</div>' +
        '<h1 class="fa-h">Sign in</h1>' +
        '<form id="fa-form">' +
          '<input id="fa-email" class="fa-in" type="email" placeholder="Email" autocomplete="username" required>' +
          '<input id="fa-pass" class="fa-in" type="password" placeholder="Password" autocomplete="current-password" required>' +
          '<button id="fa-btn" class="fa-btn" type="submit">Sign In</button>' +
          '<div id="fa-err" class="fa-err"></div>' +
        '</form>' +
        '<div class="fa-foot">Built and run by Balay ni Bruno &amp; Co.</div>' +
      '</div>';
    var css = document.createElement('style');
    css.textContent =
      '#frec-auth{position:fixed;inset:0;z-index:9999;background:#17130C;display:grid;place-items:center;padding:20px;font-family:Arial,Helvetica,sans-serif}' +
      '#frec-auth .fa-card{width:100%;max-width:380px;background:#F6F3ED;border:1px solid #E4DCCC;border-top:4px solid #A8884A;border-radius:14px;padding:30px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
      '#frec-auth .fa-logo{height:48px;margin-bottom:14px}' +
      '#frec-auth .fa-kicker{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#A8884A;font-weight:bold}' +
      '#frec-auth .fa-h{font-family:Georgia,serif;font-size:26px;color:#17130C;margin:6px 0 18px;font-weight:600}' +
      '#frec-auth .fa-in{width:100%;padding:12px 13px;margin-bottom:11px;border:1px solid #E4DCCC;border-radius:9px;background:#fff;color:#17130C;font-size:15px;font-family:inherit}' +
      '#frec-auth .fa-in:focus{outline:none;border-color:#A8884A}' +
      '#frec-auth .fa-btn{width:100%;padding:13px;border:none;border-radius:999px;background:#A8884A;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit}' +
      '#frec-auth .fa-btn:disabled{opacity:.6;cursor:not-allowed}' +
      '#frec-auth .fa-err{color:#b4452f;font-size:13px;min-height:18px;margin-top:10px}' +
      '#frec-auth .fa-foot{margin-top:18px;font-size:11px;color:#6f675a}';
    document.head.appendChild(css);
    document.body.appendChild(o);
    return o;
  }

  function reveal(overlay) { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }

  async function start() {
    var overlay = injectOverlay();
    await loadSupabase();
    var c = client();
    var errEl = document.getElementById('fa-err');
    if (!c) { if (errEl) errEl.textContent = 'Login service unavailable. Refresh the page.'; return; }

    // already signed in?
    try {
      var r = await c.auth.getSession();
      if (r && r.data && r.data.session) {
        var em = r.data.session.user && r.data.session.user.email;
        if (allowed(em)) { try { localStorage.setItem('frec_user', em); } catch (e) {} reveal(overlay); return; }
        await c.auth.signOut();
      }
    } catch (e) {}

    var form = document.getElementById('fa-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = document.getElementById('fa-btn');
      var email = (document.getElementById('fa-email').value || '').trim();
      var pass = document.getElementById('fa-pass').value || '';
      if (errEl) errEl.textContent = '';
      btn.disabled = true; btn.textContent = 'Signing in...';
      try {
        var res = await c.auth.signInWithPassword({ email: email, password: pass });
        if (res.error) { if (errEl) errEl.textContent = res.error.message || 'Wrong email or password.'; }
        else {
          var em2 = (res.data && res.data.user && res.data.user.email) || email;
          if (!allowed(em2)) { await c.auth.signOut(); if (errEl) errEl.textContent = 'This login is not authorized for the Freccia dashboard.'; }
          else { try { localStorage.setItem('frec_user', em2); } catch (e2) {} reveal(overlay); }
        }
      } catch (ex) { if (errEl) errEl.textContent = 'Something went wrong. Try again.'; }
      finally { btn.disabled = false; btn.textContent = 'Sign In'; }
    });
  }

  // expose logout for a sign-out button
  window.frecLogout = async function () {
    var c = client(); if (c) { try { await c.auth.signOut(); } catch (e) {} }
    try { localStorage.removeItem('frec_user'); } catch (e) {}
    location.reload();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
