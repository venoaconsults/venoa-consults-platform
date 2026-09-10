import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');

const must = (needle, label) => {
  if (!html.includes(needle)) throw new Error(`Reels hotfix anchor missing: ${label}`);
};

must("creatorAccounts: [], applications: [], creators: [], brands: [], pages: [], campaigns: [],", 'seed collections');
html = html.replace(
  "creatorAccounts: [], applications: [], creators: [], brands: [], pages: [], campaigns: [],",
  "creatorAccounts: [], applications: [], creators: [], brands: [], pages: [], reels: [], campaigns: [],"
);
html = html.replace(
  "counters: { application:0, creator:0, campaign:0, page:0, brand:0, lead:0, portfolioLead:0, notification:0, response:0 }",
  "counters: { application:0, creator:0, campaign:0, page:0, brand:0, reel:0, lead:0, portfolioLead:0, notification:0, response:0 }"
);

html = html.replaceAll('<button data-scroll="creators">Creators</button>', '<button data-scroll="reels">Reels</button>');
html = html.replace('Live creator roster', 'Campaign reels');
html = html.replace('The public site works as both a company showcase and a live window into the VCS creator ecosystem.', 'The public site works as a company showcase with live campaign work, digital distribution and creator opportunities.');

html = html.replace(/\n\s*<section class="section-pad dark-section" id="creators">[\s\S]*?<\/section>\s*\n/, '\n');

const reelsSection = `
    <section class="section-pad dark-section" id="reels">
      <div class="shell">
        <div class="split-head reveal"><div><div class="eyebrow">VCS Reels Showcase</div><h2>Campaign work.<br>Played from the source.</h2></div><div><p>Reels and campaign videos are controlled from Admin. Instagram Reel links are embedded from Instagram so the public showcase reflects the original Reel; direct video files or video URLs can be used when needed.</p></div></div>
        <div id="reel-grid" class="showcase-reel-grid"></div>
      </div>
    </section>
`;
must('<section class="section-pad creator-intelligence" id="creator-intelligence">', 'creator intelligence section');
html = html.replace('    <section class="section-pad creator-intelligence" id="creator-intelligence">', reelsSection + '\n    <section class="section-pad creator-intelligence" id="creator-intelligence">');

const reelsCss = `
.showcase-reel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:44px}.showcase-reel-card{min-width:0;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.18)}.showcase-reel-media{background:#030b10;aspect-ratio:9/16;position:relative;overflow:hidden}.showcase-reel-media iframe,.showcase-reel-media video{width:100%;height:100%;border:0;display:block;background:#000}.showcase-reel-copy{padding:20px}.showcase-reel-copy h3{font-family:var(--serif);font-size:25px;margin:4px 0 8px}.showcase-reel-copy p{color:#b7c4ca;line-height:1.55;margin:0 0 14px}.showcase-reel-meta{display:flex;justify-content:space-between;gap:10px;align-items:center;color:#9eb0b9;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.showcase-reel-link{color:var(--ivory);text-decoration:none;border-bottom:1px solid rgba(255,255,255,.35)}.reel-source-note{font-size:11px;color:#6f838d;line-height:1.5}@media(max-width:900px){.showcase-reel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.showcase-reel-grid{grid-template-columns:1fr}.showcase-reel-card{max-width:430px;margin-inline:auto;width:100%}}
`;
html = html.replace('</style>', reelsCss + '</style>');

must('function publicBrands() { return db.brands.filter(b=>b.public); }', 'publicBrands helper');
html = html.replace(
  'function publicBrands() { return db.brands.filter(b=>b.public); }',
  `function publicBrands() { return db.brands.filter(b=>b.public); }
  function publicReels() { return (db.reels||[]).filter(r=>r.public).sort((a,b)=>(Number(Boolean(b.featured))-Number(Boolean(a.featured))) || ((Number(a.order)||999)-(Number(b.order)||999)) || String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))); }
  function instagramEmbedUrl(raw='') {
    let value=String(raw||'').trim(); if(!value)return ''; if(!/^https?:\/\//i.test(value))value='https://'+value.replace(/^\/+/, '');
    try{ const u=new URL(value); if(!/(^|\.)instagram\.com$/i.test(u.hostname))return ''; const m=u.pathname.match(/^\/(reel|p|tv)\/([^\/?#]+)/i); if(!m)return ''; return 'https://www.instagram.com/'+m[1].toLowerCase()+'/'+m[2]+'/embed/'; }catch{return '';}
  }
  function reelCard(r){
    const type=String(r.sourceType||'INSTAGRAM'); const src=type==='UPLOAD'?String(r.videoData||''):String(r.url||''); const embed=type==='INSTAGRAM'?instagramEmbedUrl(src):'';
    const media=type==='INSTAGRAM'&&embed?\`<iframe src="\${esc(embed)}" title="\${esc(r.title||'Instagram Reel')}" loading="lazy" allowtransparency="true" allowfullscreen></iframe>\`:(src?\`<video src="\${esc(src)}" controls playsinline preload="metadata" \${r.autoplay?'muted loop autoplay':''}></video>\`:'');
    const external=type!=='UPLOAD'&&src?\`<a class="showcase-reel-link" href="\${esc(src)}" target="_blank" rel="noopener">Open source ↗</a>\`:'';
    return \`<article class="showcase-reel-card reveal"><div class="showcase-reel-media">\${media||'<div class="empty-state" style="height:100%;border:0;border-radius:0;background:#061B27;color:#F4EEE5">Media unavailable</div>'}</div><div class="showcase-reel-copy"><div class="showcase-reel-meta"><span>\${esc(r.brand||'VCS Campaign')}</span><span>\${r.featured?'Featured':''}</span></div><h3>\${esc(r.title||'Campaign Reel')}</h3>\${r.caption?\`<p>\${esc(r.caption)}</p>\`:''}<div class="showcase-reel-meta"><span>\${esc(type==='INSTAGRAM'?'Instagram Reel':type==='UPLOAD'?'VCS video':'Video')}</span>\${external}</div></div></article>\`;
  }`
);

html = html.replace(
  "const kpis=[['Approved creators',liveCreators().length],['Public profiles',publicCreators().length],['Digital pages',activePages().length],['Active campaigns',activeCampaigns().length]];",
  "const kpis=[['Brands published',publicBrands().length],['Featured reels',publicReels().length],['Digital pages',activePages().length],['Active campaigns',activeCampaigns().length]];"
);

html = html.replace(
  /\n\s*const creators=publicCreators\(\);\n\s*\$\('#creator-grid'\)\.innerHTML=[^\n]+;/,
  "\n    const reels=publicReels();\n    $('#reel-grid').innerHTML=reels.length?reels.map(reelCard).join(''):empty('No reels published yet','Add an Instagram Reel link or campaign video from Admin → Reels, then switch Public on.');"
);

must("['brands','Brands'],['pages','Digital Pages']", 'admin tabs');
html = html.replace("['brands','Brands'],['pages','Digital Pages']", "['brands','Brands'],['reels','Reels'],['pages','Digital Pages']");
html = html.replace("if(tab==='brands') return brandsHTML();", "if(tab==='brands') return brandsHTML();\n    if(tab==='reels') return reelsHTML();");

html = html.replace('<div class="admin-kpi"><span>Public roster</span><strong>${publicCreators().length}</strong></div>', '<div class="admin-kpi"><span>Public reels</span><strong>${publicReels().length}</strong></div>');
html = html.replace(
  '<button class="mini-btn primary" data-action="admin-tab" data-tab="portfolio">Manage portfolio</button></div></div>`;',
  '<button class="mini-btn primary" data-action="admin-tab" data-tab="portfolio">Manage portfolio</button></div><div class="admin-mini-card"><div class="eyebrow">Reels Showcase</div><h3>${publicReels().length} public reel${publicReels().length===1?\'\':\'s\'}</h3><p>Embed Instagram Reels from their original URL or upload/direct-link campaign videos.</p><button class="mini-btn primary" data-action="admin-tab" data-tab="reels">Manage reels</button></div></div>`;'
);

const reelsAdminFn = `
  function reelsHTML() {
    const rows=(db.reels||[]);
    return \`<div class="admin-head"><div><div class="eyebrow">Homepage Reel Showcase</div><h1>Reels and campaign videos.</h1><p class="help">Instagram Reel URL is recommended: the homepage embeds the original Reel directly from Instagram. Direct video URLs and small preview uploads are also supported.</p></div><button class="btn btn-dark" data-action="open-reel-form">+ Add reel / video</button></div><div class="admin-card-grid">\${rows.length?rows.map(r=>{const src=r.sourceType==='UPLOAD'?(r.videoName||'Uploaded video'):(r.url||'No source');return \`<div class="admin-mini-card"><div class="eyebrow">\${esc(r.id)} · \${r.public?'PUBLIC':'HIDDEN'}</div><h3>\${esc(r.title||'Campaign Reel')}</h3><p>\${esc(r.brand||'VCS Campaign')} · \${esc(r.sourceType||'INSTAGRAM')}\${r.featured?' · Featured':''}</p><p class="reel-source-note">\${esc(src)}</p><div class="admin-actions"><button class="mini-btn" data-action="edit-reel" data-reel-id="\${esc(r.id)}">Edit</button><button class="mini-btn" data-action="toggle-reel-public" data-reel-id="\${esc(r.id)}">\${r.public?'Hide from homepage':'Show on homepage'}</button><button class="mini-btn danger" data-action="delete-reel" data-reel-id="\${esc(r.id)}">Delete</button></div></div>\`}).join(''):empty('No reels added','Add an Instagram Reel URL to reflect the Reel directly on the homepage, or use a direct video URL/upload.')}</div>\`;
  }
`;
must('function pagesHTML() { return', 'pagesHTML');
html = html.replace('  function pagesHTML() { return', reelsAdminFn + '\n  function pagesHTML() { return');

const reelForms = `
  function openReelForm(idv='') {
    const r=(db.reels||[]).find(x=>x.id===idv)||{};
    openModal(\`<div class="eyebrow">Reels Showcase</div><h2 class="modal-title">\${r.id?'Edit reel / video':'Add reel / video'}</h2><form id="reel-form" class="form-grid"><input type="hidden" name="id" value="\${esc(r.id||'')}"><div class="field"><label>Title</label><input name="title" value="\${esc(r.title||'')}" required placeholder="Campaign highlight"></div><div class="field"><label>Brand / campaign</label><input name="brand" value="\${esc(r.brand||'')}" placeholder="Brand or campaign name"></div><div class="field"><label>Source type</label><select name="sourceType"><option value="INSTAGRAM" \${(r.sourceType||'INSTAGRAM')==='INSTAGRAM'?'selected':''}>Instagram Reel URL — recommended</option><option value="VIDEO_URL" \${r.sourceType==='VIDEO_URL'?'selected':''}>Direct video URL</option><option value="UPLOAD" \${r.sourceType==='UPLOAD'?'selected':''}>Upload video</option></select></div><div class="field"><label>Display order</label><input name="order" type="number" min="1" value="\${esc(r.order||1)}"></div><div class="field full"><label>Instagram Reel / direct video URL</label><input name="url" type="text" inputmode="url" value="\${esc(r.url||'')}" placeholder="https://www.instagram.com/reel/..."><span class="help">For Instagram, paste the original Reel URL. VCS converts it to Instagram's embed URL automatically, so the homepage reflects the source Reel.</span></div><div class="field full"><label>Upload campaign video</label><input name="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime,video/*"><span class="help">Preview upload limit: 3 MB because this version uses browser storage. Production video uploads should use Firebase Storage. Existing media is preserved when editing unless you replace it.</span></div><div class="field full"><label>Caption</label><textarea name="caption" placeholder="Short campaign context">\${esc(r.caption||'')}</textarea></div><div class="field"><label class="check-label"><input name="public" type="checkbox" \${r.public!==false?'checked':''}> Show on homepage</label></div><div class="field"><label class="check-label"><input name="featured" type="checkbox" \${r.featured?'checked':''}> Feature first</label></div><div class="field full"><label class="check-label"><input name="autoplay" type="checkbox" \${r.autoplay?'checked':''}> Autoplay direct videos muted (Instagram controls its own player)</label></div><div class="field full"><button class="btn btn-dark" type="submit">Save reel / video</button></div></form>\`);
  }
  async function readVideoData(file,maxBytes=3*1024*1024){
    if(!file||!file.size)return ''; if(!String(file.type||'').startsWith('video/'))throw new Error('Choose a valid video file.'); if(file.size>maxBytes)throw new Error('Preview video uploads are limited to 3 MB. Use the Instagram Reel URL, a direct hosted video URL, or Firebase Storage for larger files.'); return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>reject(new Error('Unable to read the video file.'));fr.readAsDataURL(file);});
  }
  async function saveReel(fd){
    db.reels=db.reels||[];
    const existing=db.reels.find(x=>x.id===String(fd.get('id')||'')); const r=existing||{id:id('VCS-RL-','reel'),createdAt:now()}; const sourceType=String(fd.get('sourceType')||'INSTAGRAM'); let url=String(fd.get('url')||'').trim();
    if(url&&!/^https?:\/\//i.test(url))url='https://'+url.replace(/^\/+/, '');
    if(sourceType==='INSTAGRAM'){ if(!url)throw new Error('Paste the Instagram Reel URL.'); if(!instagramEmbedUrl(url))throw new Error('Use a valid Instagram Reel or post URL, for example https://www.instagram.com/reel/SHORTCODE/.'); r.videoData=''; r.videoName=''; }
    if(sourceType==='VIDEO_URL'){ if(!url)throw new Error('Paste a direct hosted video URL.'); try{new URL(url);}catch{throw new Error('Enter a valid direct video URL.');} r.videoData=''; r.videoName=''; }
    if(sourceType==='UPLOAD'){ const file=fd.get('videoFile'); const data=await readVideoData(file); if(data){r.videoData=data;r.videoName=file.name;r.url='';} else if(!r.videoData)throw new Error('Choose a video file, or switch Source type to Instagram Reel URL / Direct video URL.'); url=''; }
    Object.assign(r,{title:String(fd.get('title')||'').trim(),brand:String(fd.get('brand')||'').trim(),caption:String(fd.get('caption')||'').trim(),sourceType,url:sourceType==='UPLOAD'?'':url,order:Number(fd.get('order')||1),public:fd.get('public')==='on',featured:fd.get('featured')==='on',autoplay:fd.get('autoplay')==='on',updatedAt:now()});
    if(!r.title)throw new Error('Reel title is required.'); if(!existing)db.reels.unshift(r); audit(existing?'Reel updated':'Reel added',r.id+' · '+r.title);
    try{save();}catch(err){if(err&&(err.name==='QuotaExceededError'||/quota|storage/i.test(String(err.message||''))))throw new Error('Browser storage is full. Use an Instagram Reel URL/direct video URL or connect Firebase Storage for video uploads.');throw err;}
    state.adminTab='reels'; closeModal(); renderAdmin(); renderPublic(); toast(existing?'Reel updated.':'Reel added to VCS.');
  }
`;
must("function openPageForm(idv='')", 'openPageForm');
html = html.replace("  function openPageForm(idv='')", reelForms + "\n  function openPageForm(idv='')");

html = html.replace(
  "if(action==='delete-brand') return deleteRecord('brands',a.dataset.brandId,'Brand');",
  "if(action==='delete-brand') return deleteRecord('brands',a.dataset.brandId,'Brand');\n    if(action==='open-reel-form') return openReelForm();\n    if(action==='edit-reel') return openReelForm(a.dataset.reelId);\n    if(action==='toggle-reel-public'){ const r=(db.reels||[]).find(x=>x.id===a.dataset.reelId); if(r){r.public=!r.public;r.updatedAt=now();audit('Reel visibility changed',r.id+' → '+(r.public?'public':'hidden'));save();renderPublic();renderAdmin();toast(r.public?'Reel shown on homepage.':'Reel hidden from homepage.');} return; }\n    if(action==='delete-reel') return deleteRecord('reels',a.dataset.reelId,'Reel');"
);
html = html.replace(
  "if(f.id==='brand-form'){ await saveBrand(fd); return; }",
  "if(f.id==='brand-form'){ await saveBrand(fd); return; }\n      if(f.id==='reel-form'){ await saveReel(fd); return; }"
);

html = html.replace(
  '<details><summary>Can brand logos and digital pages be added later?</summary><p>Yes. Both are managed from the admin panel and appear on the public website automatically.</p></details>',
  '<details><summary>Can brand logos and digital pages be added later?</summary><p>Yes. Both are managed from the admin panel and appear on the public website automatically.</p></details><details><summary>How are Reels shown on the homepage?</summary><p>Admin can paste an Instagram Reel URL and VCS embeds the original Reel from Instagram. Admin can also use a direct hosted video URL or upload a small preview video.</p></details>'
);
html = html.replace('Firebase Storage for creator photos, brand/page images and the downloadable portfolio PDF.', 'Firebase Storage for creator photos, brand/page images, uploaded campaign videos and the downloadable portfolio PDF.');

const required = ['id="reels"','id="reel-grid"','Homepage Reel Showcase','open-reel-form','reel-form','saveReel(fd)','instagramEmbedUrl','delete-reel','toggle-reel-public'];
for(const marker of required) if(!html.includes(marker)) throw new Error(`Reels hotfix verification failed: ${marker}`);
if(html.includes('id="creators"') || html.includes('data-scroll="creators"')) throw new Error('Public creator roster was not fully removed from homepage navigation/markup.');

await writeFile(path, html, 'utf8');
console.log('VCS Reels showcase + homepage roster removal hotfix applied and verified.');
