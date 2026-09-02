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
