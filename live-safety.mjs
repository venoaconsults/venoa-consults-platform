import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');
if (!html.includes('<html') || !html.includes('</body>')) throw new Error('VCS live safety: invalid HTML output.');

// Keep the entire website visible even if animation APIs or observers fail in Safari.
const css = `<style id="vcs-live-safety">
.reveal,.hero-copy,.social-stage{opacity:1!important;visibility:visible!important;filter:none!important;transform:none!important}
.v4-cursor-glow,.v4-cursor-dot{pointer-events:none!important}
.vcs-nav-link{border:0;background:none;color:inherit;padding:8px 0;font-size:13px;text-decoration:none;cursor:pointer;font-family:inherit}
.desktop-nav .vcs-nav-link:hover{color:var(--indigo)}
.mobile-menu .vcs-nav-link{display:block}
</style>`;
if (!html.includes('id="vcs-live-safety"')) html = html.replace('</head>', `${css}\n</head>`);

// Native anchors are a browser-level fallback for public header navigation.
html = html.replace(/<button data-scroll="([^"]+)">([^<]+)<\/button>/g,
  '<a class="vcs-nav-link" href="#$1" data-scroll="$1">$2</a>');

// Never hard-code an Admin password in a public site. Only normalize the preview username label.
html = html.replaceAll('Venoaconsults', 'admin');

// Safari reliability: a form input named "id" shadows form.id. Dispatch using the HTML id attribute instead.
const submitOld = "document.addEventListener('submit', async e=>{\n    const f=e.target; e.preventDefault(); const fd=new FormData(f);";
if (html.includes(submitOld)) {
  html = html.replace(submitOld,
    "document.addEventListener('submit', async e=>{\n    const f=e.target; e.preventDefault(); const formId=f.getAttribute('id')||''; const fd=new FormData(f);");
  const start = html.indexOf("document.addEventListener('submit', async e=>{");
  const end = html.indexOf("  });", start);
  if (start >= 0 && end > start) {
    let block = html.slice(start, end + 5).replaceAll("if(f.id==='", "if(formId==='");
    html = html.slice(0, start) + block + html.slice(end + 5);
  }
}

// Direct save buttons avoid browser form-submit edge cases for the two most-used Admin editors.
html = html.replace('<button class="btn btn-dark" type="submit">Save brand</button>', '<button class="btn btn-dark" type="button" data-action="save-brand-direct">Save brand</button>');
html = html.replace('<button class="btn btn-dark" type="submit">Save reel / video</button>', '<button class="btn btn-dark" type="button" data-action="save-reel-direct">Save reel / video</button>');
const brandAnchor = "    if(action==='open-brand-form') return openBrandForm();";
if (html.includes(brandAnchor) && !html.includes("action==='save-brand-direct'")) {
  html = html.replace(brandAnchor, `    if(action==='save-brand-direct'){ const f=$('#brand-form'); if(!f||!f.reportValidity())return; saveBrand(new FormData(f)).catch(err=>{console.error(err);toast(err.message||'Unable to save brand.');}); return; }\n${brandAnchor}`);
}
const reelAnchor = "    if(action==='open-reel-form') return openReelForm();";
if (html.includes(reelAnchor) && !html.includes("action==='save-reel-direct'")) {
  html = html.replace(reelAnchor, `    if(action==='save-reel-direct'){ const f=$('#reel-form'); if(!f||!f.reportValidity())return; saveReel(new FormData(f)).catch(err=>{console.error(err);toast(err.message||'Unable to save reel / video.');}); return; }\n${reelAnchor}`);
}

// Independent navigation fallback: Website / Creator / Admin and section links still work if the main application handler aborts.
const fallback = `<script id="vcs-navigation-fallback">
(function(){
  function list(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
  function view(name){
    list('.view').forEach(function(v){v.classList.remove('active');});
    var target=document.getElementById(name+'-view'); if(target)target.classList.add('active');
    list('.mode-btn').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-route')===name);});
    list('.reveal,.hero-copy,.social-stage').forEach(function(el){el.classList.add('visible');});
  }
  document.addEventListener('click',function(e){
    var scroll=e.target.closest&&e.target.closest('[data-scroll]');
    if(scroll){var id=scroll.getAttribute('data-scroll'),section=document.getElementById(id);if(section){e.preventDefault();view('website');setTimeout(function(){section.scrollIntoView({behavior:'smooth',block:'start'});},20);}return;}
    var route=e.target.closest&&e.target.closest('[data-route]');
    if(route){var name=route.getAttribute('data-route');if(name&&document.getElementById(name+'-view')){view(name);}}
  },true);
  list('.reveal,.hero-copy,.social-stage').forEach(function(el){el.classList.add('visible');});
})();
</script>`;
if (!html.includes('id="vcs-navigation-fallback"')) html = html.replace('</body>', `${fallback}\n</body>`);

// Production must never ship the old browser-side compressed bootstrap.
if (/\batob\s*\(|DecompressionStream/.test(html)) throw new Error('VCS live safety: unsafe browser decompression detected.');

await writeFile(path, html, 'utf8');
console.log(`VCS live safety applied (${html.length} chars).`);
