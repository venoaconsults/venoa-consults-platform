import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');

if (!html.includes('</head>') || !html.includes('</body>')) {
  throw new Error('VCS emergency stability: invalid HTML output.');
}

const css = `<style id="vcs-final-stability">
/* VCS production fail-open: content and controls stay usable even if motion APIs fail. */
.reveal,.hero-copy,.social-stage{opacity:1!important;transform:none!important;filter:none!important;visibility:visible!important}
.v4-magnetic,.tilt-card{transform:none!important}
.v4-cursor-glow,.v4-cursor-dot{pointer-events:none!important}
.vcs-nav-link{border:0;background:none;color:inherit;padding:8px 0;font-size:13px;text-decoration:none;cursor:pointer;font-family:inherit}
.desktop-nav .vcs-nav-link:hover{color:var(--indigo)}
.mobile-menu .vcs-nav-link{display:block}
</style>`;

if (!html.includes('id="vcs-final-stability"')) {
  html = html.replace('</head>', `${css}\n</head>`);
}

// Public navigation gets a native anchor fallback while retaining the existing JS data-scroll behavior.
html = html.replace(/<button data-scroll="([^"]+)">([^<]+)<\/button>/g,
  '<a class="vcs-nav-link" href="#$1" data-scroll="$1">$2</a>');

const guard = `(function(){
  'use strict';
  function all(sel){return Array.prototype.slice.call(document.querySelectorAll(sel));}
  function showAll(){
    all('.reveal,.hero-copy,.social-stage').forEach(function(el){
      el.classList.add('visible');
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('transform','none','important');
      el.style.setProperty('filter','none','important');
      el.style.setProperty('visibility','visible','important');
    });
  }
  function setView(name){
    all('.view').forEach(function(v){v.classList.remove('active');});
    var v=document.getElementById(name+'-view'); if(v)v.classList.add('active');
    all('.mode-btn').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-route')===name);});
  }
  // Route snapshot overlays can briefly sit above controls. Disable them so controls remain immediately clickable.
  try{Object.defineProperty(document,'startViewTransition',{value:undefined,configurable:true});}catch(_){try{document.startViewTransition=undefined;}catch(__){}}
  document.addEventListener('click',function(e){
    var scroll=e.target.closest&&e.target.closest('[data-scroll]');
    if(scroll){
      var id=scroll.getAttribute('data-scroll'), target=document.getElementById(id);
      if(target){
        e.preventDefault(); setView('website');
        setTimeout(function(){target.scrollIntoView({behavior:'smooth',block:'start'});showAll();},30);
      }
      return;
    }
    var route=e.target.closest&&e.target.closest('[data-route]');
    if(route){setView(route.getAttribute('data-route')||'website');showAll();return;}
    var menu=e.target.closest&&e.target.closest('[data-action="toggle-mobile-menu"]');
    if(menu){var m=document.getElementById('mobile-menu');if(m)m.classList.toggle('open');}
  },true);
  showAll();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showAll,{once:true});
  window.addEventListener('load',showAll,{once:true});
  window.addEventListener('error',showAll);
  if('MutationObserver' in window)new MutationObserver(showAll).observe(document.body,{childList:true,subtree:true});
  setTimeout(showAll,50); setTimeout(showAll,400); setTimeout(showAll,1200);
})();`;

new Script(guard, { filename: 'vcs-final-runtime-guard.js' });
if (!html.includes('id="vcs-final-runtime-guard"')) {
  html = html.replace('</body>', `<script id="vcs-final-runtime-guard">\n${guard}\n</script>\n</body>`);
}

const required = [
  'id="about"','id="services"','id="reels"','id="pages"','id="campaigns"','id="contact"',
  'id="creator-view"','id="admin-view"','data-action="open-lead-modal"','creator-register-form',
  'admin-login-form','open-brand-form','open-reel-form'
];
for (const marker of required) if (!html.includes(marker)) throw new Error(`VCS emergency stability missing marker: ${marker}`);
if (/\batob\s*\(|DecompressionStream/.test(html)) throw new Error('Unsafe browser decompression code detected.');

await writeFile(path, html, 'utf8');
console.log(`VCS final stability guard applied: ${html.length} HTML chars.`);
