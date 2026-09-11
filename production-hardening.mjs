import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const htmlPath = 'dist/index.html';
let html = await readFile(htmlPath, 'utf8');

const scripts = [];
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRe.exec(html))) scripts.push({ full: match[0], attrs: match[1] || '', body: match[2] || '' });

const mainTag = scripts.find(s => s.body.includes("const NS = 'vcs_preview_v3'") && s.body.includes("document.addEventListener('submit'"));
const motionTag = scripts.find(s => /id=["']vcs-v4-motion-engine["']/i.test(s.attrs));
const failsafeTag = scripts.find(s => /id=["']vcs-visibility-failsafe["']/i.test(s.attrs));
if (!mainTag) throw new Error('Production hardening: main VCS app script not found.');
if (!motionTag) throw new Error('Production hardening: motion script not found.');

let app = mainTag.body.trim();
if (!app.includes('window.__VCS_MAIN_READY')) {
  const end = app.lastIndexOf('})();');
  if (end < 0) throw new Error('Production hardening: main IIFE terminator not found.');
  app = app.slice(0, end) + "  window.__VCS_MAIN_READY = true;\n" + app.slice(end);
}

let motion = motionTag.body.trim();
if (!motion.includes('VCS IntersectionObserver compatibility')) {
  motion = motion.replace(/\(\(\) => \{/, `(() => {\n  // VCS IntersectionObserver compatibility: motion must never break the application.\n  if (!('IntersectionObserver' in window)) {\n    window.IntersectionObserver = function(cb){\n      this.observe = function(el){ try { cb([{isIntersecting:true,target:el}]); } catch(_) {} };\n      this.unobserve = function(){};\n      this.disconnect = function(){};\n    };\n  }`);
}

const failsafe = (failsafeTag?.body || `
(function(){
  function show(){
    var els=document.querySelectorAll('.reveal,.hero-copy,.social-stage');
    for(var i=0;i<els.length;i++){els[i].classList.add('visible');els[i].style.opacity='1';els[i].style.transform='none';els[i].style.filter='none';}
  }
  show(); if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show); window.addEventListener('load',show);
})();`).trim();

const compat = `
(function(){
  'use strict';
  function q(s){return document.querySelector(s);} 
  function qa(s){return document.querySelectorAll(s);} 
  function parentWith(el,attr){while(el&&el!==document){if(el.getAttribute&&el.getAttribute(attr)!==null)return el;el=el.parentNode;}return null;}
  function showAll(){var els=qa('.reveal,.hero-copy,.social-stage');for(var i=0;i<els.length;i++){els[i].classList.add('visible');els[i].style.opacity='1';els[i].style.transform='none';els[i].style.filter='none';}}
  function setView(name){var views=qa('.view');for(var i=0;i<views.length;i++)views[i].classList.remove('active');var v=q('#'+name+'-view');if(v)v.classList.add('active');var ms=qa('.mode-btn');for(var j=0;j<ms.length;j++)ms[j].classList.toggle('active',ms[j].getAttribute('data-route')===name);window.scrollTo(0,0);}
  function fallback(){
    if(window.__VCS_MAIN_READY)return;
    document.documentElement.classList.add('vcs-fallback-mode');
    console.warn('VCS main application did not finish booting. Compatibility navigation enabled.');
    document.addEventListener('click',function(e){
      var scroll=parentWith(e.target,'data-scroll');
      if(scroll){var id=scroll.getAttribute('data-scroll');var target=document.getElementById(id);if(target){e.preventDefault();setView('website');setTimeout(function(){target.scrollIntoView({behavior:'smooth',block:'start'});},20);}return;}
      var route=parentWith(e.target,'data-route');
      if(route){e.preventDefault();setView(route.getAttribute('data-route')||'website');return;}
      var action=parentWith(e.target,'data-action');
      if(action&&action.getAttribute('data-action')==='toggle-mobile-menu'){var m=q('#mobile-menu');if(m)m.classList.toggle('open');}
    },false);
  }
  showAll();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){showAll();setTimeout(fallback,120);});else setTimeout(fallback,120);
  window.addEventListener('load',showAll);
  window.addEventListener('error',showAll);
})();`;

for (const [name, code] of [['app.js',app],['motion.js',motion],['failsafe.js',failsafe],['compat.js',compat]]) {
  new Script(code, { filename:name });
  await writeFile(`dist/${name}`, code + '\n', 'utf8');
}

html = html.replace(mainTag.full, '<script src="/app.js" defer></script>');
html = html.replace(motionTag.full, '<script src="/motion.js" defer></script>');
if (failsafeTag) html = html.replace(failsafeTag.full, '<script src="/failsafe.js" defer></script>');
else html = html.replace('</body>', '<script src="/failsafe.js" defer></script>\n</body>');
html = html.replace('</body>', '<script src="/compat.js" defer></script>\n</body>');

const resilienceCss = `<style id="vcs-production-resilience">
/* Content is visible by default. Motion is progressive enhancement, never a dependency. */
.reveal,.hero-copy,.social-stage{opacity:1!important;transform:none!important;filter:none!important}
.desktop-nav .vcs-nav-link,.mobile-menu .vcs-nav-link{border:0;background:none;color:inherit;padding:8px 0;font-size:13px;text-decoration:none;cursor:pointer}
.desktop-nav .vcs-nav-link:hover{color:var(--indigo)}
.vcs-fallback-mode .view.active{display:block!important}
</style>`;
if (!html.includes('id="vcs-production-resilience"')) html = html.replace('</head>', resilienceCss + '\n</head>');

html = html.replace(/<button data-scroll="([^"]+)">([^<]+)<\/button>/g, '<a class="vcs-nav-link" href="#$1" data-scroll="$1">$2</a>');

const requiredHtml = ['id="about"','id="services"','id="reels"','id="pages"','id="campaigns"','id="contact"','id="creator-view"','id="admin-view"','/app.js','/motion.js','/compat.js'];
for (const marker of requiredHtml) if (!html.includes(marker)) throw new Error(`Production hardening missing HTML marker: ${marker}`);
const requiredJs = ['open-lead-modal','creator-register-form','admin-login-form','open-brand-form','open-reel-form','open-page-form','portfolio-lead-form','creator-application-form'];
for (const marker of requiredJs) if (!app.includes(marker)) throw new Error(`Production hardening missing app action/form marker: ${marker}`);
if (/\batob\s*\(|DecompressionStream/.test(html + app)) throw new Error('Unsafe browser-side decompression code detected.');

await writeFile(htmlPath, html, 'utf8');
console.log(`VCS production hardening complete: external JS + fail-open content + native nav (${html.length} HTML chars, ${app.length} app JS chars).`);
