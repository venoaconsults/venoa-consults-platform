(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  function activate(name){
    $$(".portal").forEach(p=>p.classList.remove("active"));
    if(name==="creator"){ $("#creator-portal")?.classList.add("active"); if(location.hash!=="#creator-portal") history.pushState(null,"","#creator-portal"); }
    else if(name==="admin"){ $("#admin-portal")?.classList.add("active"); if(location.hash!=="#admin-portal") history.pushState(null,"","#admin-portal"); }
  }
  document.addEventListener("click",e=>{
    const route=e.target.closest?.("[data-route]");
    if(route){
      const name=route.dataset.route;
      if(name==="creator"||name==="admin"){e.preventDefault();activate(name);}
      else if(name==="website"){$$(".portal").forEach(p=>p.classList.remove("active"));}
    }
    const menu=e.target.closest?.("#menu-toggle");
    if(menu){const nav=$("#site-nav");nav?.classList.toggle("open");menu.setAttribute("aria-expanded",nav?.classList.contains("open")?"true":"false");}
    const enquiry=e.target.closest?.('[data-action="campaign-enquiry"]');
    if(enquiry&&!window.__VCS_APP_READY){e.preventDefault();document.querySelector("#contact")?.scrollIntoView({behavior:"smooth"});}
  },true);
  function syncHash(){
    if(location.hash==="#creator-portal") activate("creator");
    if(location.hash==="#admin-portal") activate("admin");
  }
  addEventListener("hashchange",syncHash);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncHash,{once:true});else syncHash();
  window.__VCS_SHELL_READY=true;
})();
