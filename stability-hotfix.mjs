import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');

const must = (needle, label) => {
  if (!html.includes(needle)) throw new Error(`Stability hotfix anchor missing: ${label}`);
};

html = html.replace('<div class="hero-copy reveal">', '<div class="hero-copy">');
html = html.replace('<div class="social-stage reveal"', '<div class="social-stage"');

const oldLoad = `  function load() { try { return { ...seed(), ...JSON.parse(localStorage.getItem(NS) || '{}') }; } catch { return seed(); } }`;
const newLoad = `  function load() {
    const base=seed();
    try {
      const raw=JSON.parse(localStorage.getItem(NS) || '{}') || {};
      const merged={...base,...raw};
      for(const key of ['creatorAccounts','applications','creators','brands','pages','reels','campaigns','campaignResponses','leads','portfolioLeads','notifications','audit']){
        if(!Array.isArray(merged[key])) merged[key]=[];
      }
      merged.portfolio={...base.portfolio,...(raw.portfolio||{})};
      merged.counters={...base.counters,...(raw.counters||{})};
      merged.admin={...base.admin,...(raw.admin||{})};
      return merged;
    } catch(err) {
      console.warn('VCS local data was reset after a compatibility error.',err);
      return base;
    }
  }`;
must(oldLoad, 'load function');
html = html.replace(oldLoad, newLoad);

const oldRenderStart = `  function renderPublic() {
    const kpis=[['Brands published',publicBrands().length],['Featured reels',publicReels().length],['Digital pages',activePages().length],['Active campaigns',activeCampaigns().length]];
    $('#public-kpis').innerHTML=kpis.map(([label,value])=>\`<div class="kpi"><strong>\${fmt(value)}</strong><span>\${esc(label)}</span></div>\`).join('');`;
const newRenderStart = `  function renderPublic() {
    const kpis=[['Brands published',publicBrands().length],['Featured reels',publicReels().length],['Digital pages',activePages().length],['Active campaigns',activeCampaigns().length]];
    const kpiRoot=$('#public-kpis'); if(kpiRoot) kpiRoot.innerHTML=kpis.map(([label,value])=>\`<div class="kpi"><strong>\${fmt(value)}</strong><span>\${esc(label)}</span></div>\`).join('');`;
must(oldRenderStart, 'renderPublic start');
html = html.replace(oldRenderStart, newRenderStart);
html = html.replace("    $('#brand-grid').innerHTML=brands.length?", "    if($('#brand-grid')) $('#brand-grid').innerHTML=brands.length?");
html = html.replace("    $('#reel-grid').innerHTML=reels.length?", "    if($('#reel-grid')) $('#reel-grid').innerHTML=reels.length?");
html = html.replace("    $('#page-grid').innerHTML=pages.length?", "    if($('#page-grid')) $('#page-grid').innerHTML=pages.length?");
html = html.replace("    $('#campaign-grid').innerHTML=campaigns.length?", "    if($('#campaign-grid')) $('#campaign-grid').innerHTML=campaigns.length?");

const oldInit = `  renderPublic(); observeReveal(); initTilt();`;
const newInit = `  try { renderPublic(); } catch(err) { console.error('VCS public render recovered from an error:',err); }
  document.querySelectorAll('.hero-copy,.social-stage').forEach(el=>{el.style.opacity='1';el.style.transform='none';el.style.filter='none';});
  observeReveal(); initTilt();`;
must(oldInit, 'initial render');
html = html.replace(oldInit, newInit);

const failSafe = `\n<script id="vcs-visibility-failsafe">\n(()=>{\n  const show=()=>{\n    document.querySelectorAll('.hero-copy,.social-stage').forEach(el=>{el.style.opacity='1';el.style.transform='none';el.style.filter='none';});\n    document.querySelectorAll('.reveal').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight*1.2&&r.bottom>-80)el.classList.add('visible');});\n  };\n  show(); addEventListener('load',show,{once:true}); setTimeout(show,120); setTimeout(show,900); addEventListener('error',show);\n})();\n</script>\n`;
if(!html.includes('id="vcs-visibility-failsafe"')) html = html.replace('</body>', failSafe + '</body>');

html = html.replace('Create your creator account.</h2><p class="help">Preview accounts are stored only in this browser. Production uses Firebase Authentication + email verification.</p>', 'Create your creator account.</h2><p class="help"><strong>Email verification is required before the creator application unlocks.</strong> Production authentication uses Firebase email verification or Google sign-in.</p>');

if(html.includes('<div class="hero-copy reveal">') || html.includes('<div class="social-stage reveal"')) throw new Error('Hero visibility dependency still present.');
if(!html.includes('VCS public render recovered from an error') || !html.includes('vcs-visibility-failsafe')) throw new Error('Visibility fail-safe verification failed.');

await writeFile(path, html, 'utf8');
console.log('VCS stability + above-the-fold visibility hotfix applied and verified.');
