import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');
const must = (needle,label) => { if(!html.includes(needle)) throw new Error(`Final live hotfix anchor missing: ${label}`); };

// Production title and fail-open visibility/navigation CSS.
html = html.replace('<title>Venoa Consults — Interactive Preview V4</title>', '<title>Venoa Consults — Influence. Distribution. Growth.</title>');
const css = `\n<style id="vcs-live-resilience">\n/* Production fail-open: content must never depend on motion JavaScript to be visible. */\n.reveal,.hero-copy,.social-stage{opacity:1!important;transform:none!important;filter:none!important;visibility:visible!important}\n.v4-cursor-glow,.v4-cursor-dot{pointer-events:none!important}\n.vcs-nav-link{border:0;background:none;color:inherit;padding:8px 0;font-size:13px;text-decoration:none;cursor:pointer;font-family:inherit}\n.desktop-nav .vcs-nav-link:hover{color:var(--indigo)}\n.mobile-menu .vcs-nav-link{display:block}\n</style>\n`;
if(!html.includes('id="vcs-live-resilience"')) html = html.replace('</head>', css + '</head>');

// Native anchors give header navigation a browser-level fallback even if application JS has a runtime issue.
html = html.replace(/<button data-scroll="([^"]+)">([^<]+)<\/button>/g, '<a class="vcs-nav-link" href="#$1" data-scroll="$1">$2</a>');

// Preview admin username. Password is intentionally NOT hard-coded in public source.
html = html.replaceAll('Venoaconsults', 'admin');

// Safari/form reliability: inputs named "id" shadow form.id, so never dispatch by f.id.
must("document.addEventListener('submit', async e=>{\n    const f=e.target; e.preventDefault(); const fd=new FormData(f);", 'submit dispatcher');
html = html.replace(
  "document.addEventListener('submit', async e=>{\n    const f=e.target; e.preventDefault(); const fd=new FormData(f);",
  "document.addEventListener('submit', async e=>{\n    const f=e.target; e.preventDefault(); const formId=f.getAttribute('id')||''; const fd=new FormData(f);"
);
// Replace dispatcher checks only inside the submit listener body.
const submitStart = html.indexOf("document.addEventListener('submit', async e=>{");
const submitEnd = html.indexOf("  });", submitStart);
if(submitStart < 0 || submitEnd < 0) throw new Error('Submit dispatcher bounds missing.');
let submitBlock = html.slice(submitStart, submitEnd + 5);
submitBlock = submitBlock.replaceAll("if(f.id==='", "if(formId==='");
html = html.slice(0, submitStart) + submitBlock + html.slice(submitEnd + 5);

// Direct save controls make Brand/Reel saving independent from browser form-submit quirks.
html = html.replace('<button class="btn btn-dark" type="submit">Save brand</button>', '<button class="btn btn-dark" type="button" data-action="save-brand-direct">Save brand</button>');
html = html.replace('<button class="btn btn-dark" type="submit">Save reel / video</button>', '<button class="btn btn-dark" type="button" data-action="save-reel-direct">Save reel / video</button>');

const brandAnchor = "    if(action==='open-brand-form') return openBrandForm();";
must(brandAnchor, 'brand action');
html = html.replace(brandAnchor,
`    if(action==='save-brand-direct'){ const f=$('#brand-form'); if(!f||!f.reportValidity())return; saveBrand(new FormData(f)).catch(err=>{console.error(err);toast(err.message||'Unable to save brand.');}); return; }\n${brandAnchor}`);
const reelAnchor = "    if(action==='open-reel-form') return openReelForm();";
must(reelAnchor, 'reel action');
html = html.replace(reelAnchor,
`    if(action==='save-reel-direct'){ const f=$('#reel-form'); if(!f||!f.reportValidity())return; saveReel(new FormData(f)).catch(err=>{console.error(err);toast(err.message||'Unable to save reel / video.');}); return; }\n${reelAnchor}`);

// Last-resort navigation fallback is deliberately independent of the main app listener.
const navFallback = `\n<script id="vcs-live-nav-fallback">\n(function(){\n  function all(q){return Array.prototype.slice.call(document.querySelectorAll(q));}\n  function setView(name){\n    all('.view').forEach(function(v){v.classList.remove('active');});\n    var view=document.getElementById(name+'-view'); if(view)view.classList.add('active');\n    all('.mode-btn').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-route')===name);});\n  }\n  document.addEventListener('click',function(e){\n    var scroll=e.target.closest&&e.target.closest('[data-scroll]');\n    if(scroll){var id=scroll.getAttribute('data-scroll'),el=document.getElementById(id);if(el){e.preventDefault();setView('website');setTimeout(function(){el.scrollIntoView({behavior:'smooth',block:'start'});},20);}return;}\n    var route=e.target.closest&&e.target.closest('[data-route]');\n    if(route){var name=route.getAttribute('data-route');if(name&&document.getElementById(name+'-view'))setView(name);}\n  },true);\n})();\n</script>\n`;
if(!html.includes('id="vcs-live-nav-fallback"')) html = html.replace('</body>', navFallback + '</body>');

// Final build-time assertions and JS syntax verification.
const required = ['id="about"','id="services"','id="reels"','id="pages"','id="campaigns"','id="contact"','id="creator-view"','id="admin-view"','save-brand-direct','save-reel-direct',"const formId=f.getAttribute('id')||''",'Email Verification Required','vcs-live-resilience','vcs-live-nav-fallback'];
for(const marker of required) if(!html.includes(marker)) throw new Error(`Final live marker missing: ${marker}`);
if(html.includes('id="creators"')) throw new Error('Public creator roster section must remain removed.');
if(/\batob\s*\(|DecompressionStream/.test(html)) throw new Error('Unsafe browser-side decompression detected.');
for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/application\/ld\+json/i.test(m[1])) continue;
  new Script(m[2], {filename:'vcs-inline-check.js'});
}
await writeFile(path, html, 'utf8');
console.log(`VCS final live hotfix applied and verified (${html.length} chars).`);
