/* BBC Command Center — shared helpers.
   Every page reads the same daily-routine snapshot, so loading and formatting
   live here once rather than being copy-pasted per page. */

const ENDPOINT = "/.netlify/functions/routine-snapshot";
const FALLBACK = "/os/routine-snapshot.json";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

/* Stable per-client colour so a client looks the same on every page. */
const AV = ["#C4643C","#5F8A66","#8A6BA8","#C98A1E","#4A7C9B","#B0554F","#6E8B4A","#A8792F"];
const avatarColor = id =>
  AV[[...String(id)].reduce((a,c) => a + c.charCodeAt(0), 0) % AV.length];

const SERVICE_LABEL = {
  website:"Website", email:"Email", leads:"Leads",
  social:"Social", store:"Store", crm:"CRM"
};

function fmtAge(iso){
  if (!iso) return { text:"never run", hours: Infinity };
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  return {
    hours: h,
    text: h < 1 ? "updated just now"
        : h < 24 ? `updated ${Math.round(h)}h ago`
        : `${Math.round(h/24)}d old`
  };
}

/* Header freshness pill. A snapshot older than about a day is called out rather
   than shown quietly, because a stale dashboard and a healthy one look identical. */
function stampFreshness(d){
  const pill = document.getElementById("freshness");
  const text = document.getElementById("fresh-text");
  const foot = document.getElementById("foot-time");
  const age = fmtAge(d && d.generated_at);
  if (text) text.textContent = age.text;
  if (pill) pill.className = "pill" + (age.hours > 26 ? " stale" : "");
  if (foot && d && d.generated_at) {
    foot.textContent = `Snapshot ${d.shift_date} · ${new Date(d.generated_at).toLocaleString()}`;
  }
}

/* Live Blobs store first, committed file second. The fallback exists so the page
   still shows real numbers before ROUTINE_TOKEN is configured on the site. */
async function loadSnapshot(onData, onEmpty){
  let data = null;
  try {
    const r = await fetch(ENDPOINT, { cache:"no-store" });
    if (r.ok) { const j = await r.json(); if (!j.empty) data = j; }
  } catch {}
  if (!data) {
    try {
      const r = await fetch(FALLBACK, { cache:"no-store" });
      if (r.ok) data = await r.json();
    } catch {}
  }
  if (!data) { if (onEmpty) onEmpty(); return null; }
  onData(data);
  return data;
}

/* ---------- shared page chrome ----------
   Nav is rendered rather than pasted into seven files, so adding a page means
   editing one array instead of hunting through every document. */
const OS_PAGES = [
  ["Home",      "/os/home.html"],
  ["Clients",   "/os/clients.html"],
  ["CRM",       "/os/crm.html"],
  ["Websites",  "/os/websites.html"],
  ["Workflows", "/os/workflows.html"],
  ["Social",    "/os/social.html"],
  ["Reminders", "/os/reminders.html"],
  ["Team",      "/os/team.html"],
  ["Old dashboard", "/os/legacy.html"],
];

function osChrome(current){
  const nav = OS_PAGES.map(([label, href]) =>
    `<a href="${href}"${label === current ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  document.body.insertAdjacentHTML("afterbegin", `
    <header class="top"><div class="top-in">
      <a class="brand" href="/os/home.html" style="text-decoration:none;color:inherit">
        <div class="mark">🏠</div>
        <div><h1>BBC Command Center</h1><p>Balay ni Bruno &amp; Co.</p></div>
      </a>
      <nav class="os-nav">${nav}</nav>
      <span class="pill" id="freshness"><span class="dot"></span><span id="fresh-text">loading…</span></span>
      <button class="btn" id="refresh" type="button">Refresh</button>
    </div></header>`);
  const btn = document.getElementById("refresh");
  if (btn) btn.addEventListener("click", () => location.reload());
}

/* ---------- small charts ----------
   Inline SVG and CSS only. No chart library: the page must stay fast on a phone
   and must not depend on a CDN that could be blocked. */

const TONE = { ok:"var(--sage)", warn:"var(--amber)", bad:"var(--clay)", neutral:"var(--terracotta)" };

function toneFor(pct, invert){
  // invert = higher is worse (dead addresses, failure rates)
  if (invert) return pct >= 40 ? TONE.bad : pct >= 15 ? TONE.warn : TONE.ok;
  return pct >= 66 ? TONE.ok : pct >= 33 ? TONE.warn : TONE.bad;
}

function bar(pct, color, title){
  const w = Math.max(0, Math.min(100, pct || 0));
  return `<div class="bar"${title?` title="${esc(title)}"`:""}>
    <span style="width:${w}%;background:${color||TONE.neutral}"></span></div>`;
}

function donut(ok, total, label){
  const pct = total ? ok/total : 0, R = 32, C = 2*Math.PI*R;
  const col = total && ok === total ? TONE.ok : ok/Math.max(total,1) >= .6 ? TONE.warn : TONE.bad;
  return `<svg class="ring" viewBox="0 0 78 78" aria-label="${ok} of ${total} ${esc(label||"")}">
    <circle class="track" cx="39" cy="39" r="${R}"/>
    <circle class="val" cx="39" cy="39" r="${R}" style="stroke:${col}"
      stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}" transform="rotate(-90 39 39)"/>
    <text class="ring-num" x="39" y="45" text-anchor="middle">${ok}/${total}</text></svg>`;
}

/* Column chart from {label: count}. Bars carry their own value so the reader never
   has to estimate a height against an axis. */
function columns(map, opts){
  const entries = Object.entries(map || {});
  if (!entries.length) return `<p class="empty-note">Nothing to chart.</p>`;
  const max = Math.max(...entries.map(([,v]) => v)) || 1;
  return `<div class="cols">${entries.map(([k,v]) => `
    <div class="col" title="${esc(k)}: ${v}">
      <span class="cval">${v}</span>
      <span class="cbar" style="height:${Math.max(4, Math.round(100*v/max))}%;
        background:${(opts&&opts.color)||TONE.neutral}"></span>
      <span class="clab">${esc((opts&&opts.short)?String(k).slice(opts.short):k)}</span>
    </div>`).join("")}</div>`;
}

function statTile(label, value, note, tone){
  return `<div class="tile${tone?" "+tone:""}">
    <div class="k">${esc(label)}</div>
    <div class="v">${esc(String(value))}</div>
    <div class="n">${esc(note||"")}</div></div>`;
}
