import {
  auth, db, collection, getDocs, query, where, onAuthStateChanged,
  isSuperAdminUser, listCollection
} from "./firebase-core.js";

const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const compact=n=>Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(Number(n||0));
const fmt=n=>new Intl.NumberFormat("en-IN").format(Number(n||0));
const stages=["Brief","Match","Execute","Distribute","Learn"];
let publicCache={brands:[],reels:[],pages:[],campaigns:[]};
let reelObserver=null;
let pageObserver=null;
let campObserver=null;
let countObserver=null;
let adminRefreshTimer=null;

function initial(name=""){
  const parts=String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0,2).map(x=>x[0]||"").join("").toUpperCase() || "VCS";
}
function normalizeURL(raw=""){
  let v=String(raw||"").trim();
  if(!v)return "";
  if(!/^https?:\/\//i.test(v))v="https://"+v.replace(/^\/+/,'');
  try{return new URL(v).href}catch{return ""}
}
function instagramEmbed(raw=""){
  const url=normalizeURL(raw);
  if(!url)return "";
  try{
    const u=new URL(url);
    if(!/(^|\.)instagram\.com$/i.test(u.hostname))return "";
    const m=u.pathname.match(/^\/(reel|p|tv)\/([^/?#]+)/i);
    return m?`https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/embed/`:"";
  }catch{return ""}
}
function statusLabel(v=""){
  return String(v||"").replaceAll("_"," ").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
}
function campaignStageIndex(c={}){
  const explicit=String(c.stage||c.currentStage||"").trim().toLowerCase();
  const idx=stages.findIndex(s=>s.toLowerCase()===explicit);
  if(idx>=0)return idx;
  switch(String(c.status||"").toUpperCase()){
    case "DRAFT": return 0;
    case "CASTING_OPEN": return 1;
    case "LIVE": return 2;
    case "CLOSED": return 3;
    case "COMPLETED": return 4;
    default: return 0;
  }
}
function campaignIsActive(c={}){
  return ["DRAFT","CASTING_OPEN","LIVE","CLOSED"].includes(String(c.status||"").toUpperCase());
}
async function publicQuery(name){
  const snap=await getDocs(query(collection(db,name),where("public","==",true)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function loadPublicFeatureData(){
  const jobs=[
    ["brands","brands"],
    ["reels","reels"],
    ["digitalPages","pages"],
    ["campaigns","campaigns"]
  ];
  await Promise.all(jobs.map(async([collectionName,key])=>{
    try{publicCache[key]=await publicQuery(collectionName)}
    catch(err){console.warn(`[VCS features] ${collectionName} unavailable`,err);publicCache[key]=[]}
  }));
  renderBrands();
  renderReels();
  renderPages();
  renderCampaigns();
}

function linkedCampaignsForBrand(brand){
  const brandName=String(brand.name||"").trim().toLowerCase();
  return publicCache.campaigns.filter(c=>{
    const candidate=String(c.brand||c.brandLabel||"").trim().toLowerCase();
    return brandName && candidate===brandName;
  });
}
function renderBrands(){
  const marquee=$("#vf-brand-marquee");
  const grid=$("#vf-brand-grid");
  if(!marquee||!grid)return;
  const brands=[...publicCache.brands].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  if(!brands.length){
    marquee.innerHTML="";
    grid.innerHTML='<div class="vf-empty">No public brands published yet.</div>';
    return;
  }
  const chips=brands.map(b=>`<div class="vf-chip"><span class="vf-pulse"></span><b>${esc(b.name||"Brand")}</b>${b.relationship?` · ${esc(b.relationship)}`:""}</div>`).join("");
  marquee.innerHTML=chips+chips;
  grid.innerHTML=brands.map((b,i)=>{
    const linked=linkedCampaignsForBrand(b);
    const logo=b.logoUrl||b.logo||"";
    const logoHTML=logo?`<img src="${esc(logo)}" alt="${esc(b.name||"Brand")} logo">`:esc(initial(b.name));
    const rows=linked.length?linked.map(c=>{
      const live=["LIVE","CASTING_OPEN"].includes(String(c.status||"").toUpperCase());
      const right=c.reach?`Reach ${esc(c.reach)}`:statusLabel(c.status||"Active");
      return `<div class="vf-campaign-row"><span><b>${esc(c.name||"Campaign")}</b> — ${esc(stages[campaignStageIndex(c)])}</span><span class="vf-status-pill ${live?"vf-status-live":"vf-status-plan"}">${esc(right)}</span></div>`;
    }).join(""):'<div class="vf-campaign-row"><span>No public campaign currently linked to this brand.</span></div>';
    return `<article class="vf-brand-card" data-vf-brand="${i}" tabindex="0" role="button" aria-expanded="false">
      <div class="vf-brand-top">
        <div class="vf-brand-id"><div class="vf-logo-mark">${logoHTML}</div><div class="vf-brand-names"><b>${esc(b.name||"Brand")}</b><span>${esc(b.relationship||"VCS relationship")} · ${linked.length} campaign${linked.length===1?"":"s"}</span></div></div>
        <div class="vf-chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
      </div>
      <div class="vf-accordion"><div class="vf-accordion-inner"><div class="vf-accordion-content">${rows}</div></div></div>
    </article>`;
  }).join("");
  const toggle=card=>{
    const open=card.classList.toggle("open");
    card.setAttribute("aria-expanded",String(open));
  };
  $$(".vf-brand-card",grid).forEach(card=>{
    card.addEventListener("click",()=>toggle(card));
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle(card)}});
  });
}

function reelMedia(r){
  const type=String(r.sourceType||"INSTAGRAM").toUpperCase();
  if(type==="INSTAGRAM"){
    const embed=instagramEmbed(r.url||r.instagramUrl||"");
    if(embed)return `<iframe src="${esc(embed)}" title="${esc(r.title||"Instagram Reel")}" loading="lazy" allowfullscreen></iframe>`;
  }
  const video=normalizeURL(r.videoUrl||r.url||"");
  if(video)return `<video src="${esc(video)}" playsinline controls preload="metadata" ${r.autoplay?"muted loop":""}></video>`;
  return "";
}
function renderReels(){
  const stack=$("#vf-reel-stack"),progress=$("#vf-reel-progress");
  if(!stack||!progress)return;
  if(reelObserver){reelObserver.disconnect();reelObserver=null}
  const reels=[...publicCache.reels].sort((a,b)=>(Number(Boolean(b.featured))-Number(Boolean(a.featured)))||(Number(a.order||999)-Number(b.order||999)));
  if(!reels.length){
    progress.innerHTML="";
    stack.innerHTML='<div class="vf-empty" style="margin:auto 16px">No public reels published yet.</div>';
    return;
  }
  stack.innerHTML=reels.map((r,i)=>{
    const source=normalizeURL(r.url||r.videoUrl||"");
    const media=reelMedia(r);
    const brand=r.brand||r.brandLabel||"VCS Campaign";
    return `<article class="vf-reel-item" data-vf-reel="${i}">
      <div class="vf-reel-media-bg">${media||""}</div>
      ${source?`<a class="vf-reel-source" href="${esc(source)}" target="_blank" rel="noopener">Open source ↗</a>`:""}
      <div class="vf-reel-side"><button class="vf-like-btn" type="button" aria-label="Like this reel"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 21s-7-4.4-9.6-8.6C.6 8.8 2 5 5.6 5c2 0 3.4 1.2 4.4 2.6C11 6.2 12.4 5 14.4 5 18 5 19.4 8.8 21.6 12.4 19 16.6 12 21 12 21z"/></svg><span>Like</span></button></div>
      <div class="vf-reel-body"><b>${esc(brand)}</b><p>${esc(r.caption||r.title||"Campaign reel")}</p></div>
    </article>`;
  }).join("");
  progress.innerHTML=reels.map((_,i)=>`<i data-vf-progress="${i}"><b></b></i>`).join("");
  $$(".vf-like-btn",stack).forEach(btn=>btn.addEventListener("click",()=>btn.classList.toggle("liked")));
  const activate=i=>{
    $$("i",progress).forEach((bar,idx)=>{
      bar.classList.toggle("active",idx===i);
      bar.classList.toggle("done",idx<i);
      if(idx>i)bar.classList.remove("done");
    });
    $$(".vf-reel-item video",stack).forEach((v,idx)=>{
      try{if(idx===i){v.muted=true;v.play().catch(()=>{})}else v.pause()}catch{}
    });
  };
  if("IntersectionObserver" in window){
    reelObserver=new IntersectionObserver(entries=>{
      entries.forEach(en=>{if(en.isIntersecting)activate(Number(en.target.dataset.vfReel||0))});
    },{root:stack,threshold:.6});
    $$(".vf-reel-item",stack).forEach(el=>reelObserver.observe(el));
  }
  activate(0);
}

function renderPages(){
  const grid=$("#vf-pages-grid");
  if(!grid)return;
  if(pageObserver){pageObserver.disconnect();pageObserver=null}
  const pages=[...publicCache.pages].sort((a,b)=>Number(b.followers||0)-Number(a.followers||0));
  if(!pages.length){grid.innerHTML='<div class="vf-empty">No public digital pages published yet.</div>';return}
  const maxFollowers=Math.max(...pages.map(p=>Number(p.followers||0)),1);
  grid.innerHTML=pages.map(p=>{
    const followers=Number(p.followers||0);
    const fill=Math.max(8,Math.min(100,Number(p.utilisation||p.utilization||Math.round((followers/maxFollowers)*100))));
    return `<article class="vf-page-card" style="--vf-fill:${fill}%">
      <span class="vf-page-scale">${esc(p.category||"Digital distribution")}</span>
      <h3>${esc(p.name||"Digital Page")}</h3>
      <p>${p.handle?`@${esc(String(p.handle).replace(/^@/,""))} · `:""}${compact(followers)} followers</p>
      <div class="vf-page-bar"><b></b></div>
      <div class="vf-page-foot"><span>${esc(p.relation||"VCS network")}</span><span>${fill}% scale index</span></div>
    </article>`;
  }).join("");
  $$(".vf-page-card",grid).forEach(card=>card.addEventListener("mousemove",e=>{
    const r=card.getBoundingClientRect();
    card.style.setProperty("--vf-mx",(e.clientX-r.left)+"px");
    card.style.setProperty("--vf-my",(e.clientY-r.top)+"px");
  }));
  const cards=$$(".vf-page-card",grid);
  if("IntersectionObserver" in window){
    pageObserver=new IntersectionObserver(entries=>entries.forEach(en=>{
      if(en.isIntersecting){
        const idx=cards.indexOf(en.target);
        setTimeout(()=>en.target.classList.add("visible"),(idx%3)*90);
        pageObserver.unobserve(en.target);
      }
    }),{threshold:.2});
    cards.forEach(el=>pageObserver.observe(el));
  }else cards.forEach(el=>el.classList.add("visible"));
}

function renderCampaigns(){
  const list=$("#vf-campaign-list");
  if(!list)return;
  if(campObserver){campObserver.disconnect();campObserver=null}
  const campaigns=publicCache.campaigns.filter(c=>campaignIsActive(c)).sort((a,b)=>campaignStageIndex(b)-campaignStageIndex(a));
  if(!campaigns.length){list.innerHTML='<div class="vf-empty">No active public campaigns right now.</div>';return}
  list.innerHTML=campaigns.map(c=>{
    const current=campaignStageIndex(c);
    const fillw=(current/(stages.length-1))*100;
    const matched=Number(c.matchedCount||c.creatorsMatched||c.matchCount||0);
    const meta=[c.brandLabel||c.brand,c.city,c.niche].filter(Boolean).join(" · ");
    return `<article class="vf-camp-card" style="--vf-fillw:${fillw}%">
      <div class="vf-camp-top">
        <div><h3>${esc(c.name||"Campaign")}</h3><span>${esc(meta||statusLabel(c.status||"Campaign"))}</span></div>
        <div class="vf-camp-count"><b data-vf-count="${matched}">${fmt(matched)}</b><small>creators matched</small></div>
      </div>
      <div class="vf-tracker">${stages.map((s,i)=>`<div class="vf-stage ${i<current?"done":i===current?"current":""}">${i<stages.length-1?'<div class="vf-connector"><b></b></div>':""}<div class="vf-node"></div><span>${s}</span></div>`).join("")}</div>
    </article>`;
  }).join("");
  const cards=$$(".vf-camp-card",list);
  if("IntersectionObserver" in window){
    campObserver=new IntersectionObserver(entries=>entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add("visible");campObserver.unobserve(en.target)}}),{threshold:.3});
    cards.forEach(el=>campObserver.observe(el));
  }else cards.forEach(el=>el.classList.add("visible"));
}

function animateCount(el){
  if(el.dataset.vfDone)return;
  el.dataset.vfDone="1";
  const target=Number(el.dataset.vfCount||0);
  if(!target){el.textContent="0";return}
  let cur=0;
  const step=Math.max(target/40,1);
  const tick=()=>{
    cur=Math.min(cur+step,target);
    el.textContent=fmt(Math.round(cur));
    if(cur<target)requestAnimationFrame(tick);
  };
  tick();
}
function initAdminCardMotion(root){
  $$(".vf-inf-card",root).forEach(card=>{
    card.addEventListener("mousemove",e=>{
      const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`perspective(600px) rotateY(${x*10}deg) rotateX(${-y*10}deg) translateY(-2px)`;
    });
    card.addEventListener("mouseleave",()=>card.style.transform="none");
  });
  const counters=$$("[data-vf-count]",root);
  if("IntersectionObserver" in window){
    if(countObserver)countObserver.disconnect();
    countObserver=new IntersectionObserver(entries=>entries.forEach(en=>{if(en.isIntersecting){animateCount(en.target);countObserver.unobserve(en.target)}}),{threshold:.5});
    counters.forEach(el=>countObserver.observe(el));
  }else counters.forEach(animateCount);
}
async function injectAdminCreatorIntelligence(){
  const root=$("#admin-root");
  if(!root||!isSuperAdminUser(auth.currentUser))return;
  const heading=[...root.querySelectorAll(".eyebrow")].find(el=>el.textContent.trim()==="Creator Roster");
  if(!heading)return;
  const existing=$("#vf-admin-influencers",root);
  if(existing)return;
  let creators=[];
  try{creators=await listCollection("creators")}catch(err){console.warn("[VCS features] Admin creators unavailable",err);return}
  if(!heading.isConnected)return;
  const toolbar=heading.closest(".admin-toolbar")||heading.parentElement;
  if(!toolbar)return;
  const block=document.createElement("section");
  block.id="vf-admin-influencers";
  block.className="vf-admin-influencers";
  block.innerHTML=`<div class="vf-admin-head"><div><p class="eyebrow">Creator Intelligence</p><h3>Private creator detail cards</h3></div><p>Visible only inside Super Admin. Public homepage roster remains disabled.</p></div>
    <div class="vf-inf-scroller">${creators.length?creators.map(c=>{
      const photo=c.profileImageUrl||"";
      const followers=Number(c.verifiedFollowers||c.reportedFollowers||0);
      return `<article class="vf-inf-card">
        <div class="vf-inf-avatar">${photo?`<img src="${esc(photo)}" alt="">`:`<span>${esc(initial(c.displayName||c.fullName))}</span>`}</div>
        <h3>${esc(c.displayName||c.fullName||"Creator")}</h3>
        <div class="vf-inf-meta">${esc(c.city||"Location not set")}${c.instagramUsername?` · @${esc(String(c.instagramUsername).replace(/^@/,""))}`:""}</div>
        <div class="vf-inf-tag">${esc(c.primaryNiche||"Creator")}</div>
        <div class="vf-inf-stats"><div><b data-vf-count="${followers}">0</b><span>Verified followers</span></div><div><b>${esc(c.public?"Public":"Private")}</b><span>Roster visibility</span></div></div>
      </article>`;
    }).join(""):'<div class="vf-empty">No approved creator records yet.</div>'}</div>`;
  toolbar.insertAdjacentElement("afterend",block);
  initAdminCardMotion(block);
}
function scheduleAdminInjection(){
  clearTimeout(adminRefreshTimer);
  adminRefreshTimer=setTimeout(()=>injectAdminCreatorIntelligence().catch(console.warn),80);
}

const adminRoot=$("#admin-root");
if(adminRoot && "MutationObserver" in window){
  new MutationObserver(scheduleAdminInjection).observe(adminRoot,{childList:true,subtree:true});
}
onAuthStateChanged(auth,user=>{
  if(isSuperAdminUser(user))scheduleAdminInjection();
});
window.addEventListener("hashchange",()=>{
  if(location.hash==="#home"||location.hash===""||location.hash==="#brands"||location.hash==="#reels"||location.hash==="#pages"||location.hash==="#campaigns"){
    loadPublicFeatureData().catch(console.warn);
  }
});
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)loadPublicFeatureData().catch(console.warn);
});

loadPublicFeatureData().catch(err=>console.warn("[VCS features] initial load unavailable",err));
