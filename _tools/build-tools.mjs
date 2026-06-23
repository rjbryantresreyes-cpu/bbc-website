/* BBC Tools section generator
 * Reads tools/tools-data.json and writes:
 *   - tools.html              (the collection / landing page)
 *   - tool-<slug>.html        (one page per tool)
 * Shared head/header/footer are harvested from our-work.html at build time
 * so this section can never drift from the rest of the site.
 *
 * Run:  node _tools/build-tools.mjs
 */
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'tools', 'tools-data.json'), 'utf8'));
const SKELETON = readFileSync(join(ROOT, 'our-work.html'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---- harvest shared fragments from the skeleton page ---- */
function slice(html, startRe, endTag) {
  const m = html.match(startRe);
  if (!m) throw new Error('skeleton fragment not found: ' + startRe);
  const start = m.index;
  const end = html.indexOf(endTag, start) + endTag.length;
  return html.slice(start, end);
}
const HEAD = slice(SKELETON, /<head>/, '</head>');
let HEADER = slice(SKELETON, /<header class="site-header"/, '</header>');
const FOOTER_AND_SCRIPTS = SKELETON.slice(SKELETON.indexOf('<footer class="site-footer"'), SKELETON.indexOf('</body>'));

/* inject the Tools nav item after "Our Work" in both desktop + mobile nav (idempotent) */
if (!HEADER.includes('tools.html')) {
  HEADER = HEADER
    .replace('<li><a href="our-work.html">Our Work</a></li>',
             '<li><a href="our-work.html">Our Work</a></li>\n        <li><a href="tools.html">Tools</a></li>')
    .replace('<a href="our-work.html">Our Work</a>\n',
             '<a href="our-work.html">Our Work</a>\n    <a href="tools.html">Tools</a>\n');
}

/* ---- tools-section specific CSS (appended into <head>) ---- */
const TOOLS_CSS = `
  <style>
    /* ===== BBC Tools section ===== */
    .tools-hero{background:var(--bg-dark);color:var(--text-warm);padding:clamp(5rem,11vw,8rem) 0 clamp(3rem,7vw,5rem);}
    .tools-hero .eyebrow{color:var(--gold-pale);}
    .tools-hero h1{font-family:var(--font-display);font-weight:600;font-size:clamp(2.4rem,6vw,4rem);line-height:1.05;margin:.6rem 0 1rem;color:#fff;}
    .tools-hero h1 em{color:var(--gold-warm);font-style:italic;}
    .tools-hero p{font-family:var(--font-body);font-size:clamp(1.05rem,2.2vw,1.3rem);line-height:1.6;color:rgba(245,241,234,.82);max-width:64ch;}
    .tools-hero__actions{display:flex;flex-wrap:wrap;gap:.9rem;margin-top:2rem;}
    .tools-hero .btn-outline{border:1px solid rgba(255,255,255,.55);color:#fff;background:transparent;}
    .tools-hero .btn-outline:hover{background:rgba(255,255,255,.12);border-color:#fff;color:#fff;}

    .cat-nav{position:sticky;top:64px;z-index:30;background:rgba(245,241,234,.92);backdrop-filter:blur(10px);border-bottom:var(--border-warm);}
    .cat-nav__inner{display:flex;gap:.5rem;overflow-x:auto;padding:.85rem 0;scrollbar-width:none;}
    .cat-nav__inner::-webkit-scrollbar{display:none;}
    .cat-pill{flex:0 0 auto;font-family:var(--font-ui);font-size:.86rem;font-weight:500;color:var(--text-body);background:var(--bg-card);border:var(--border-warm);border-radius:999px;padding:.55rem 1.1rem;cursor:pointer;white-space:nowrap;transition:all var(--dur-fast) var(--ease-out-soft);text-decoration:none;}
    .cat-pill:hover{border-color:var(--gold);color:var(--deep-blue);}
    .cat-pill.active{background:var(--deep-blue);color:#fff;border-color:var(--deep-blue);}

    .cat-block{padding:clamp(3rem,6vw,4.5rem) 0;border-bottom:var(--border-warm);scroll-margin-top:130px;}
    .cat-block:nth-child(even){background:var(--bg-section);}
    .cat-block__head{max-width:66ch;margin-bottom:2.2rem;}
    .cat-block__head h2{font-family:var(--font-display);font-weight:600;font-size:clamp(1.7rem,3.6vw,2.5rem);color:var(--text-ink);margin:.5rem 0 .4rem;}
    .cat-block__head .lead{font-family:var(--font-body);font-size:1.08rem;line-height:1.6;color:var(--text-body);}

    .tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;}
    @media(max-width:960px){.tool-grid{grid-template-columns:repeat(2,1fr);}}
    @media(max-width:600px){.tool-grid{grid-template-columns:1fr;}}
    .tool-grid .tool-card.is-hidden{display:none;}

    .tool-card{display:flex;flex-direction:column;background:var(--bg-card);border:var(--border-card);border-radius:var(--radius);padding:1.5rem 1.4rem;box-shadow:var(--shadow-xs);transition:transform var(--dur-base) var(--ease-out-soft),box-shadow var(--dur-base) var(--ease-out-soft),border-color var(--dur-base);text-decoration:none;}
    .tool-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md);border-color:rgba(184,146,62,.4);}
    .tool-card__icon{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,var(--deep-blue),var(--mid-blue));color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:600;font-size:1.25rem;margin-bottom:1rem;}
    .tool-card h3{font-family:var(--font-display);font-weight:600;font-size:1.2rem;color:var(--text-ink);margin:0 0 .35rem;}
    .tool-card__credit{font-family:var(--font-ui);font-size:.74rem;font-weight:500;letter-spacing:.04em;text-transform:uppercase;color:var(--gold);margin-bottom:.6rem;}
    .tool-card p{font-family:var(--font-body);font-size:.96rem;line-height:1.55;color:var(--text-body);flex:1;margin:0 0 1rem;}
    .tool-card__link{font-family:var(--font-ui);font-size:.88rem;font-weight:600;color:var(--deep-blue);display:inline-flex;align-items:center;gap:.35rem;transition:gap var(--dur-fast);}
    .tool-card:hover .tool-card__link{gap:.6rem;}

    .cat-more{margin-top:1.6rem;}
    .cat-more__btn{font-family:var(--font-ui);font-size:.9rem;font-weight:600;color:var(--deep-blue);background:none;border:1px solid var(--deep-blue);border-radius:999px;padding:.55rem 1.3rem;cursor:pointer;transition:all var(--dur-fast);}
    .cat-more__btn:hover{background:var(--deep-blue);color:#fff;}

    /* ---- single tool page ---- */
    .tp-hero{background:var(--bg-dark);color:var(--text-warm);padding:clamp(5rem,10vw,7rem) 0 clamp(2.5rem,6vw,4rem);}
    .tp-hero .back-link{color:rgba(245,241,234,.7);}
    .tp-hero__icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,var(--gold),var(--gold-warm));color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:600;font-size:1.7rem;margin:1.2rem 0 1.1rem;}
    .tp-hero h1{font-family:var(--font-display);font-weight:600;font-size:clamp(2.1rem,5vw,3.2rem);color:#fff;margin:0 0 .5rem;}
    .tp-hero__credit{font-family:var(--font-ui);font-size:.82rem;font-weight:500;letter-spacing:.05em;text-transform:uppercase;color:var(--gold-pale);}
    .tp-section{padding:clamp(2.2rem,5vw,3.4rem) 0;border-bottom:var(--border-warm);}
    .tp-section:nth-of-type(even){background:var(--bg-section);}
    .tp-section .eyebrow{color:var(--gold);}
    .tp-section h2{font-family:var(--font-display);font-weight:600;font-size:clamp(1.4rem,3vw,2rem);color:var(--text-ink);margin:.4rem 0 .8rem;}
    .tp-section p{font-family:var(--font-body);font-size:1.1rem;line-height:1.65;color:var(--text-body);max-width:66ch;}
    .tp-download{display:flex;flex-wrap:wrap;align-items:center;gap:1rem;background:var(--bg-card);border:var(--border-card);border-radius:var(--radius);padding:1.5rem 1.6rem;box-shadow:var(--shadow-sm);}
    .tp-download p{margin:0;font-size:1rem;}
    .tp-related{padding:clamp(2.5rem,5vw,4rem) 0;background:var(--bg-section);}
  </style>
`;

/* ---- page builder ---- */
function buildHead({ title, desc, canonical }) {
  return HEAD
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} | Balay ni Bruno &amp; Co.</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}, Balay ni Bruno &amp; Co." />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}" />`)
    .replace('</head>', TOOLS_CSS + '</head>');
}
function page({ head, main }) {
  return `<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n${HEADER}\n${main}\n${FOOTER_AND_SCRIPTS}\n</body>\n</html>\n`;
}

const allTools = DATA.categories.flatMap(c => c.tools.map(t => ({ ...t, cat: c })));
const initials = (n) => n.replace(/^The /, '').split(' ').filter(Boolean).slice(0, 1).map(w => w[0]).join('').toUpperCase();

/* ===== collection page ===== */
function buildCollection() {
  const pills = DATA.categories
    .map(c => `<a class="cat-pill" href="#${c.key}">${esc(c.title)}</a>`).join('');

  const blocks = DATA.categories.map(c => {
    const cards = c.tools.map((t, i) => {
      const hidden = i >= 4 ? ' is-hidden' : '';
      return `        <a class="tool-card${hidden}" href="tool-${t.slug}.html" data-cat="${c.key}">
          <span class="tool-card__icon">${esc(initials(t.name))}</span>
          <h3>${esc(t.name)}</h3>
          <span class="tool-card__credit">${esc(t.realTool)}</span>
          <p>${esc(t.what)}</p>
          <span class="tool-card__link">See how we use it &rarr;</span>
        </a>`;
    }).join('\n');
    const more = c.tools.length > 4
      ? `\n      <div class="cat-more"><button class="cat-more__btn" data-cat="${c.key}">See all ${c.tools.length} tools &darr;</button></div>`
      : '';
    return `    <section class="cat-block" id="${c.key}">
      <div class="container">
        <div class="cat-block__head">
          <span class="eyebrow eyebrow--gold">${esc(c.tagline)}</span>
          <h2>${esc(c.title)}</h2>
          <p class="lead">${esc(c.intro)}</p>
        </div>
        <div class="tool-grid" data-cat="${c.key}">
${cards}
        </div>${more}
      </div>
    </section>`;
  }).join('\n');

  const main = `  <section class="tools-hero">
    <div class="container">
      <span class="eyebrow eyebrow--gold">Tools We Use</span>
      <h1>The real toolbox behind <em>your partnership</em></h1>
      <p>${esc(DATA.meta.intro)}</p>
      <div class="tools-hero__actions">
        <a href="${DATA.meta.masterPdf}" class="btn btn-gold">Download the full guide (PDF)</a>
        <a href="https://calendly.com/rj-balaynibruno/bbc-strategy-call" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Book a Call</a>
      </div>
    </div>
  </section>

  <nav class="cat-nav"><div class="container"><div class="cat-nav__inner">${pills}</div></div></nav>

${blocks}

  <section class="section section--dark" style="text-align:center;">
    <div class="container">
      <span class="eyebrow eyebrow--gold">One Partnership, Every Tool</span>
      <h2 style="font-family:var(--font-display);color:#fff;font-size:clamp(1.8rem,4vw,2.8rem);margin:.5rem 0 1rem;">You don't buy the tools. You get the people who run them.</h2>
      <p style="color:rgba(245,241,234,.82);max-width:60ch;margin:0 auto 2rem;font-family:var(--font-body);font-size:1.1rem;">Every tool on this page is part of your Balay ni Bruno &amp; Co. partnership. We run them so you don't have to learn any of it.</p>
      <a href="https://calendly.com/rj-balaynibruno/bbc-strategy-call" target="_blank" rel="noopener noreferrer" class="btn btn-gold">Start a Conversation</a>
    </div>
  </section>

  <script>
    document.querySelectorAll('.cat-more__btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const grid=document.querySelector('.tool-grid[data-cat="'+btn.dataset.cat+'"]');
        grid.querySelectorAll('.tool-card.is-hidden').forEach(c=>c.classList.remove('is-hidden'));
        btn.parentElement.remove();
      });
    });
    const pillEls=[...document.querySelectorAll('.cat-pill')];
    const blockEls=[...document.querySelectorAll('.cat-block')];
    const obs=new IntersectionObserver((entries)=>{
      entries.forEach(e=>{if(e.isIntersecting){const id=e.target.id;pillEls.forEach(p=>p.classList.toggle('active',p.getAttribute('href')==='#'+id));}});
    },{rootMargin:'-130px 0px -60% 0px'});
    blockEls.forEach(b=>obs.observe(b));
  </script>`;

  const head = buildHead({
    title: 'Tools We Use',
    desc: DATA.meta.tagline + ' Every tool behind a Balay ni Bruno & Co. partnership, grouped by what it does for your business.',
    canonical: 'https://balaynibruno.co/tools.html'
  });
  writeFileSync(join(ROOT, 'tools.html'), page({ head, main }));
  return 1;
}

/* ===== single tool pages ===== */
function buildToolPage(t) {
  const related = allTools.filter(x => x.cat.key === t.cat.key && x.slug !== t.slug).slice(0, 3);
  const relatedHtml = related.length ? `
  <section class="tp-related">
    <div class="container">
      <span class="eyebrow eyebrow--gold">More in ${esc(t.cat.title)}</span>
      <div class="tool-grid" style="margin-top:1.4rem;">
        ${related.map(r => `<a class="tool-card" href="tool-${r.slug}.html"><span class="tool-card__icon">${esc(initials(r.name))}</span><h3>${esc(r.name)}</h3><span class="tool-card__credit">${esc(r.realTool)}</span><p>${esc(r.what)}</p><span class="tool-card__link">See how we use it &rarr;</span></a>`).join('\n        ')}
      </div>
    </div>
  </section>` : '';

  const main = `  <section class="tp-hero">
    <div class="container">
      <a href="tools.html" class="back-link">&larr; Back to Tools</a>
      <div class="tp-hero__icon">${esc(initials(t.name))}</div>
      <h1>${esc(t.name)}</h1>
      <span class="tp-hero__credit">${esc(t.realTool)} &middot; ${esc(t.cat.title)}</span>
    </div>
  </section>

  <section class="tp-section">
    <div class="container">
      <span class="eyebrow eyebrow--gold">What it is</span>
      <h2>${esc(t.name)}, in plain words</h2>
      <p>${esc(t.what)}</p>
    </div>
  </section>

  <section class="tp-section">
    <div class="container">
      <span class="eyebrow eyebrow--gold">How we use it</span>
      <h2>How Balay ni Bruno &amp; Co. puts it to work</h2>
      <p>${esc(t.howWeUse)}</p>
    </div>
  </section>

  <section class="tp-section">
    <div class="container">
      <span class="eyebrow eyebrow--gold">How it helps your business</span>
      <h2>What it does for the business</h2>
      <p>${esc(t.businessValue)}</p>
    </div>
  </section>

  <section class="tp-section">
    <div class="container">
      <span class="eyebrow eyebrow--gold">How it helps you</span>
      <h2>What it means for you as the owner</h2>
      <p>${esc(t.ownerValue)}</p>
    </div>
  </section>

  <section class="tp-section">
    <div class="container">
      <div class="tp-download">
        <div>
          <p style="font-family:var(--font-display);font-weight:600;color:var(--text-ink);font-size:1.15rem;">Want this written down?</p>
          <p style="color:var(--text-body);">Download the full Balay ni Bruno &amp; Co. tools guide, including this one and how it fits your business.</p>
        </div>
        <a href="${DATA.meta.masterPdf}" class="btn btn-gold">Download the guide (PDF)</a>
      </div>
    </div>
  </section>

  <section class="section section--dark" style="text-align:center;">
    <div class="container">
      <h2 style="font-family:var(--font-display);color:#fff;font-size:clamp(1.6rem,3.5vw,2.4rem);margin-bottom:1rem;">You don't run the tool. We do.</h2>
      <p style="color:rgba(245,241,234,.82);max-width:56ch;margin:0 auto 1.8rem;font-family:var(--font-body);font-size:1.1rem;">This is one piece of your Balay ni Bruno &amp; Co. partnership. Let's talk about what it could do for you.</p>
      <a href="https://calendly.com/rj-balaynibruno/bbc-strategy-call" target="_blank" rel="noopener noreferrer" class="btn btn-gold">Book a Call</a>
    </div>
  </section>
${relatedHtml}`;

  const head = buildHead({
    title: t.name,
    desc: `${t.what} How Balay ni Bruno & Co. uses ${t.realTool} for your business.`,
    canonical: `https://balaynibruno.co/tool-${t.slug}.html`
  });
  writeFileSync(join(ROOT, `tool-${t.slug}.html`), page({ head, main }));
}

/* ===== master PDF source document (print-optimized, branded) ===== */
function buildMasterDoc() {
  mkdirSync(join(ROOT, 'tools', 'downloads'), { recursive: true });
  const toc = DATA.categories.map((c, i) =>
    `<li><span>${i + 1}. ${esc(c.title)}</span><span class="toc-dots"></span><span>${c.tools.length} tools</span></li>`).join('');

  const sections = DATA.categories.map((c, i) => {
    const tools = c.tools.map(t => `
      <div class="doc-tool">
        <h3>${esc(t.name)} <span class="doc-tool__credit">${esc(t.realTool)}</span></h3>
        <div class="doc-row"><span class="doc-label">What it is</span><p>${esc(t.what)}</p></div>
        <div class="doc-row"><span class="doc-label">How we use it</span><p>${esc(t.howWeUse)}</p></div>
        <div class="doc-row"><span class="doc-label">For your business</span><p>${esc(t.businessValue)}</p></div>
        <div class="doc-row"><span class="doc-label">For you, the owner</span><p>${esc(t.ownerValue)}</p></div>
      </div>`).join('');
    return `
    <section class="doc-cat">
      <div class="doc-cat__head">
        <span class="doc-cat__num">${String(i + 1).padStart(2, '0')}</span>
        <div>
          <h2>${esc(c.title)}</h2>
          <p class="doc-cat__tag">${esc(c.tagline)}</p>
        </div>
      </div>
      <p class="doc-cat__intro">${esc(c.intro)}</p>
      ${tools}
    </section>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<title>Balay ni Bruno &amp; Co. — Tools &amp; Capabilities</title>
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Lora:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root{--navy:#1F3557;--ink:#2A3040;--body:#4E5666;--gold:#B8923E;--cream:#F5F1EA;--line:rgba(85,60,35,.16);}
  *{box-sizing:border-box;}
  @page{size:Letter;margin:18mm 16mm;}
  body{font-family:'Lora',Georgia,serif;color:var(--body);margin:0;font-size:11pt;line-height:1.5;}
  h1,h2,h3{font-family:'Playfair Display',Georgia,serif;color:var(--ink);margin:0;}
  .eyebrow{font-family:'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:8.5pt;font-weight:600;color:var(--gold);}
  /* cover */
  .cover{height:calc(100vh - 36mm);display:flex;flex-direction:column;justify-content:center;page-break-after:always;}
  .cover img{height:54px;width:auto;margin-bottom:28px;}
  .cover h1{font-size:34pt;line-height:1.05;color:var(--navy);margin:6px 0 14px;}
  .cover h1 em{color:var(--gold);font-style:italic;}
  .cover .sub{font-size:13pt;max-width:50ch;color:var(--body);}
  .cover .meta{margin-top:auto;font-family:'DM Sans',sans-serif;font-size:9pt;color:var(--body);border-top:1px solid var(--line);padding-top:12px;}
  /* toc */
  .toc{page-break-after:always;}
  .toc h2{font-size:20pt;color:var(--navy);margin-bottom:18px;}
  .toc ul{list-style:none;padding:0;margin:0;}
  .toc li{display:flex;align-items:baseline;gap:8px;font-family:'DM Sans',sans-serif;font-size:11pt;padding:8px 0;border-bottom:1px solid var(--line);}
  .toc-dots{flex:1;border-bottom:1px dotted var(--line);transform:translateY(-3px);}
  /* category */
  .doc-cat{page-break-before:always;}
  .doc-cat__head{display:flex;align-items:center;gap:14px;border-bottom:2px solid var(--gold);padding-bottom:10px;margin-bottom:12px;}
  .doc-cat__num{font-family:'Playfair Display',serif;font-size:28pt;color:var(--gold);line-height:1;}
  .doc-cat h2{font-size:19pt;color:var(--navy);}
  .doc-cat__tag{font-family:'DM Sans',sans-serif;font-size:9.5pt;color:var(--body);margin:2px 0 0;}
  .doc-cat__intro{font-size:11pt;margin:0 0 16px;max-width:64ch;}
  .doc-tool{page-break-inside:avoid;border:1px solid var(--line);border-radius:10px;padding:13px 15px;margin-bottom:11px;background:#FDFAF6;}
  .doc-tool h3{font-size:13pt;color:var(--ink);margin-bottom:8px;}
  .doc-tool__credit{font-family:'DM Sans',sans-serif;font-size:8pt;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--gold);}
  .doc-row{display:flex;gap:10px;margin:5px 0;}
  .doc-label{flex:0 0 96px;font-family:'DM Sans',sans-serif;font-size:8.5pt;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--navy);padding-top:2px;}
  .doc-row p{margin:0;font-size:10.5pt;}
  .closing{page-break-before:always;text-align:center;padding-top:30mm;}
  .closing h2{font-size:22pt;color:var(--navy);margin-bottom:12px;}
  .closing p{font-size:12pt;max-width:52ch;margin:0 auto 8px;}
  .closing .cta{font-family:'DM Sans',sans-serif;font-weight:600;color:var(--gold);font-size:12pt;margin-top:16px;}
</style></head>
<body>
  <div class="cover">
    <img src="/bbc-logo.png" alt="Balay ni Bruno & Co." />
    <span class="eyebrow">Tools &amp; Capabilities</span>
    <h1>The real toolbox behind <em>your partnership</em></h1>
    <p class="sub">${esc(DATA.meta.intro)}</p>
    <div class="meta">Balay ni Bruno &amp; Co. &nbsp;&middot;&nbsp; balaynibruno.co &nbsp;&middot;&nbsp; admin@balaynibruno.co &nbsp;&middot;&nbsp; Updated ${esc(DATA.meta.updated)}</div>
  </div>
  <div class="toc">
    <h2>What's inside</h2>
    <ul>${toc}</ul>
  </div>
  ${sections}
  <div class="closing">
    <span class="eyebrow">One Partnership, Every Tool</span>
    <h2>You don't buy the tools. You get the people who run them.</h2>
    <p>Every tool in this guide is part of your Balay ni Bruno &amp; Co. partnership. We run them so you don't have to learn any of it.</p>
    <p class="cta">Let's talk &middot; balaynibruno.co &middot; admin@balaynibruno.co</p>
  </div>
</body></html>`;
  writeFileSync(join(ROOT, 'tools', 'downloads', 'bbc-tools-and-capabilities.print.html'), html);
}

/* ---- clean old generated tool pages, then build ---- */
readdirSync(ROOT).filter(f => f.startsWith('tool-') && f.endsWith('.html')).forEach(f => unlinkSync(join(ROOT, f)));
buildCollection();
allTools.forEach(buildToolPage);
buildMasterDoc();
console.log(`Built tools.html + ${allTools.length} tool pages across ${DATA.categories.length} categories + master PDF source.`);
