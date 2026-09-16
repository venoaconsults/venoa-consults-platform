import {
  auth, db, storage, googleProvider, SUPER_ADMIN_USERNAME, SUPER_ADMIN_EMAIL,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, reload, signInWithPopup, signInWithRedirect,
  getRedirectResult, reauthenticateWithCredential, EmailAuthProvider, reauthenticateWithPopup,
  deleteUser, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs,
  serverTimestamp, query, where, ref, uploadBytes, getDownloadURL, deleteObject,
  isSuperAdminUser, ensureCreatorProfile, audit, listCollection
} from "./firebase-core.js";

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => new Intl.NumberFormat("en-IN").format(Number(n||0));
const compact = n => Intl.NumberFormat("en", {notation:"compact", maximumFractionDigits:1}).format(Number(n||0));
const status = (formId, text="", type="") => {
  const el = document.querySelector(`[data-status-for="${formId}"]`);
  if (!el) return;
  el.textContent = text;
  el.className = `form-status ${type}`.trim();
};

const state = {
  user: null,
  adminTab: "overview",
  creatorProfile: null,
  creatorApplication: null,
  publicData: { brands:[], reels:[], pages:[], campaigns:[] }
};

function setBackendStatus(text, ok=false) {
  const el=$("#firebase-status");
  if (!el) return;
  el.textContent=text;
  if (ok) el.style.color="#86dfbd";
}

function openModal(html) {
  $("#modal-body").innerHTML = html;
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#modal").hidden = true;
  $("#modal-body").innerHTML = "";
  document.body.style.overflow = "";
}

function showPortal(name) {
  $$(".portal").forEach(p => p.classList.remove("active"));
  if (name === "creator") {
    $("#creator-portal").classList.add("active");
    location.hash = "creator-portal";
    renderCreator();
  } else if (name === "admin") {
    $("#admin-portal").classList.add("active");
    location.hash = "admin-portal";
    renderAdmin();
  } else {
    history.replaceState(null, "", location.pathname + location.search + "#home");
    window.scrollTo({top:0, behavior:"smooth"});
  }
}

function normalizeInstagramEmbed(url="") {
  try {
    let raw=url.trim();
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) raw="https://"+raw.replace(/^\/+/,"");
    const u=new URL(raw);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return "";
    const m=u.pathname.match(/^\/(reel|p|tv)\/([^/?#]+)/i);
    return m ? `https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/embed/` : "";
  } catch { return ""; }
}

async function safePublicLoad() {
  const loaders = [
    ["brands", "brands"],
    ["reels", "reels"],
    ["digitalPages", "pages"],
    ["campaigns", "campaigns"]
  ];
  await Promise.all(loaders.map(async ([collectionName,key]) => {
    try {
      const snap = await getDocs(query(collection(db, collectionName), where("public","==",true)));
      state.publicData[key] = snap.docs.map(d=>({id:d.id,...d.data()}));
    } catch (err) {
      console.warn(`Public ${collectionName} load unavailable`, err);
      state.publicData[key] = [];
    }
  }));
  renderPublicData();
}

function renderPublicData() {
  const brands=state.publicData.brands;
  $("#public-brands").innerHTML = brands.length ? brands.map(b=>`
    <article class="card">
      ${b.logoUrl?`<img src="${esc(b.logoUrl)}" alt="${esc(b.name||"Brand")} logo" style="max-width:160px;max-height:64px">`:""}
      <h3>${esc(b.name||"Brand")}</h3>
      <p>${esc(b.relationship||"Campaign partner")}</p>
      ${b.website?`<a class="small" target="_blank" rel="noopener" href="${esc(b.website)}">Visit ↗</a>`:""}
    </article>`).join("") : `<div class="empty">No public brands published yet.</div>`;

  const pages=state.publicData.pages;
  $("#public-pages").innerHTML = pages.length ? pages.map(p=>`
    <article class="card">
      <h3>${esc(p.name||"Digital Page")}</h3>
      <p>${p.handle?`@${esc(p.handle)} · `:""}${compact(p.followers||0)} followers</p>
      <p>${esc(p.category||"Social distribution")} · ${esc(p.relation||"VCS network")}</p>
    </article>`).join("") : `<div class="empty">No public digital pages published yet.</div>`;

  const campaigns=state.publicData.campaigns.filter(c=>["CASTING_OPEN","LIVE"].includes(c.status||""));
  $("#public-campaigns").innerHTML = campaigns.length ? campaigns.map(c=>`
    <article class="card">
      <span>${esc(c.brandLabel||c.brand||"VCS Campaign")}</span>
      <h3>${esc(c.name||"Creator Opportunity")}</h3>
      <p>${esc(c.description||c.brief||"Creator campaign opportunity.")}</p>
      <div class="inline"><span class="tag">${esc(c.niche||"All niches")}</span><span class="tag">${esc(c.city||"All India")}</span></div>
      <a class="mini primary-mini" href="#creator-portal" data-route="creator">Creator access</a>
    </article>`).join("") : `<div class="empty">No active public campaigns right now.</div>`;

  const reels=state.publicData.reels.sort((a,b)=>(Number(Boolean(b.featured))-Number(Boolean(a.featured))) || (Number(a.order||999)-Number(b.order||999)));
  $("#public-reels").innerHTML = reels.length ? reels.map(r=>{
    const type=r.sourceType||"INSTAGRAM";
    let media="";
    if(type==="INSTAGRAM"){
      const embed=normalizeInstagramEmbed(r.url||"");
      media=embed?`<iframe title="${esc(r.title||"Instagram Reel")}" loading="lazy" src="${esc(embed)}" allowfullscreen></iframe>`:`<div class="empty">Instagram media unavailable.</div>`;
    }else if(r.videoUrl){
      media=`<video src="${esc(r.videoUrl)}" controls playsinline ${r.autoplay?"muted autoplay loop":""}></video>`;
    }
    return `<article class="reel-card"><div class="reel-media">${media||'<div class="empty">Media unavailable.</div>'}</div><div class="reel-copy"><h3>${esc(r.title||"Campaign Reel")}</h3><p>${esc(r.brand||"VCS Campaign")}${r.caption?` · ${esc(r.caption)}`:""}</p></div></article>`;
  }).join("") : `<div class="empty">No public reels published yet.</div>`;
}

async function createLead(payload) {
  return addDoc(collection(db,"leads"), {
    ...payload,
    status:"NEW",
    source:"WEBSITE",
    createdAt:serverTimestamp()
  });
}

async function handleContactSubmit(form) {
  status("contact-form","Submitting…");
  const fd=new FormData(form);
  await createLead({
    name:fd.get("name")||"",
    company:fd.get("company")||"",
    email:fd.get("email")||"",
    phone:fd.get("phone")||"",
    service:fd.get("service")||"",
    requirement:fd.get("requirement")||"",
    consent:Boolean(fd.get("consent"))
  });
  form.reset();
  status("contact-form","Thank you. Your enquiry has been submitted.","success");
}

function creatorSignedOutHTML() {
  return `
  <div class="auth-grid">
    <div class="auth-card">
      <p class="eyebrow">New creator</p>
      <h3>Create your VCS creator account</h3>
      <p class="muted"><strong>Email verification is mandatory.</strong> Your application unlocks only after verification. Google sign-in is also supported.</p>
      <form id="creator-register-form" class="stack">
        <label>Email<input type="email" name="email" required autocomplete="email"></label>
        <label>Password<input type="password" name="password" minlength="8" required autocomplete="new-password"></label>
        <label>Confirm password<input type="password" name="confirm" minlength="8" required autocomplete="new-password"></label>
        <button class="btn primary-mini" type="submit">Create creator account</button>
        <p class="form-status" data-status-for="creator-register-form"></p>
      </form>
      <div class="divider"></div>
      <button class="btn ghost" type="button" data-action="creator-google">Continue with Google</button>
    </div>
    <div class="auth-card">
      <p class="eyebrow">Existing creator</p>
      <h3>Creator login</h3>
      <form id="creator-login-form" class="stack">
        <label>Email<input type="email" name="email" required autocomplete="email"></label>
        <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn primary-mini" type="submit">Login</button>
        <button class="mini" type="button" data-action="creator-forgot-password">Forgot password</button>
        <p class="form-status" data-status-for="creator-login-form"></p>
      </form>
      <div class="divider"></div>
      <p class="muted">Super Admin accounts cannot be created through Creator registration.</p>
    </div>
  </div>`;
}

function creatorUnverifiedHTML(user) {
  return `<div class="panel">
    <p class="eyebrow">Email verification required</p>
    <h3>Verify ${esc(user.email||"your email")}</h3>
    <p class="muted">Open the Firebase verification email, complete verification, then return here and refresh your verification status.</p>
    <div class="actions">
      <button class="btn ghost" data-action="resend-verification">Resend verification email</button>
      <button class="btn ghost" data-action="refresh-verification">I verified my email</button>
      <button class="btn ghost" data-action="creator-logout">Log out</button>
    </div>
    <p class="form-status" data-status-for="creator-verification"></p>
  </div>`;
}

function creatorApplicationHTML(profile={}) {
  return `<div class="panel">
    <p class="eyebrow">Creator application</p>
    <h3>Complete your VCS profile</h3>
    <p class="muted">Private contact, date of birth, guardian details and commercials are never public. Public visibility is a separate Admin decision and requires your consent.</p>
    <form id="creator-application-form" class="two-col">
      <label>Full legal name<input name="fullName" required value="${esc(profile.fullName||"")}"></label>
      <label>Public display name<input name="displayName" required value="${esc(profile.displayName||"")}"></label>
      <label>WhatsApp / mobile<input name="phone" required value="${esc(profile.phone||"")}"></label>
      <label>Date of birth<input name="dateOfBirth" type="date" required value="${esc(profile.dateOfBirth||"")}"></label>
      <label>Gender<select name="gender" required><option value="">Select</option>${["Female","Male","Non-binary","Prefer not to say"].map(x=>`<option ${profile.gender===x?"selected":""}>${x}</option>`).join("")}</select></label>
      <label>Instagram username<input name="instagramUsername" required value="${esc(profile.instagramUsername||"")}"></label>
      <label>Instagram URL<input name="instagramUrl" type="url" required value="${esc(profile.instagramUrl||"")}"></label>
      <label>Reported followers<input name="reportedFollowers" type="number" min="0" required value="${esc(profile.reportedFollowers||"")}"></label>
      <label>Primary niche<input name="primaryNiche" required value="${esc(profile.primaryNiche||"")}"></label>
      <label>Secondary niches<input name="secondaryNiches" value="${esc(profile.secondaryNiches||"")}"></label>
      <label>City<input name="city" required value="${esc(profile.city||"Mumbai")}"></label>
      <label>State<input name="state" required value="${esc(profile.state||"Maharashtra")}"></label>
      <label>Languages<input name="languages" required value="${esc(profile.languages||"")}"></label>
      <label>Availability<select name="availability" required>${["Available","Limited availability","Unavailable"].map(x=>`<option ${profile.availability===x?"selected":""}>${x}</option>`).join("")}</select></label>
      <label style="grid-column:1/-1">Short public bio<textarea name="bio" maxlength="600" rows="4">${esc(profile.bio||"")}</textarea></label>
      <label>Reel commercial (₹)<input name="reelRate" type="number" min="0" value="${esc(profile.reelRate||"")}"></label>
      <label>Story commercial (₹)<input name="storyRate" type="number" min="0" value="${esc(profile.storyRate||"")}"></label>
      <label>Static post commercial (₹)<input name="postRate" type="number" min="0" value="${esc(profile.postRate||"")}"></label>
      <label>Package / notes<input name="packageNotes" value="${esc(profile.packageNotes||"")}"></label>
      <label style="grid-column:1/-1">Roster profile photo<input name="profileImage" type="file" accept="image/jpeg,image/png,image/webp" ${profile.profileImageUrl?"":"required"}><span class="small muted">Max 5 MB. Stored in Firebase Storage.</span></label>
      <label class="check" style="grid-column:1/-1"><input name="publicConsent" type="checkbox" required ${profile.publicConsent?"checked":""}> I consent to VCS publishing approved public-profile fields if VCS chooses to publish my profile.</label>
      <label class="check" style="grid-column:1/-1"><input name="termsAccepted" type="checkbox" required> I confirm the information is accurate and agree to the VCS creator terms.</label>
      <button class="btn primary-mini" type="submit">Submit creator application</button>
      <p class="form-status" data-status-for="creator-application-form"></p>
    </form>
  </div>`;
}

function creatorDashboardHTML(profile, application) {
  const p=profile||{}, a=application||{};
  return `<div class="stack">
    <div class="panel">
      <div class="profile-head">
        <div class="avatar" style="${p.profileImageUrl?`background-image:url('${esc(p.profileImageUrl)}')`:""}">${p.profileImageUrl?"":esc((p.displayName||"VCS").slice(0,2).toUpperCase())}</div>
        <div><p class="eyebrow">${esc(a.applicationId||"VCS Creator")}</p><h3>${esc(p.displayName||a.displayName||"Creator")}</h3><div class="inline"><span class="tag ok">Email verified</span><span class="tag ${a.status==="APPROVED"?"ok":"warn"}">${esc(a.status||"PENDING")}</span><span class="tag">${p.public?"Public":"Private"}</span></div></div>
      </div>
      <div class="divider"></div>
      <div class="actions">
        <button class="btn ghost" data-action="creator-change-photo">Change profile photo</button>
        <button class="btn ghost" data-action="creator-logout">Log out</button>
      </div>
    </div>
    <div class="panel">
      <p class="eyebrow">Application status</p>
      <h3>${esc(a.status||"PENDING REVIEW")}</h3>
      <p class="muted">Account verification does not mean VCS approval. Public visibility is controlled separately by Admin and requires your consent.</p>
    </div>
    <div class="danger-zone">
      <h3>Delete creator account</h3>
      <p class="muted">This permanently deletes your VCS authentication account, creator application and private creator profile. This action requires recent authentication.</p>
      <button class="mini danger" data-action="creator-delete-account">Delete my account</button>
    </div>
  </div>`;
}

async function loadCreatorDocs(user) {
  if (!user || isSuperAdminUser(user)) return;
  const [profileSnap, appSnap] = await Promise.all([
    getDoc(doc(db,"creatorProfiles",user.uid)),
    getDoc(doc(db,"creatorApplications",user.uid))
  ]);
  state.creatorProfile = profileSnap.exists()?{id:profileSnap.id,...profileSnap.data()}:null;
  state.creatorApplication = appSnap.exists()?{id:appSnap.id,...appSnap.data()}:null;
}

async function renderCreator() {
  const root=$("#creator-root");
  const user=state.user;
  if (!user) { root.innerHTML=creatorSignedOutHTML(); return; }
  if (isSuperAdminUser(user)) {
    root.innerHTML=`<div class="panel"><h3>This account is reserved for Super Admin.</h3><p class="muted">Use the Admin portal.</p><a class="btn ghost" href="#admin-portal" data-route="admin">Open Admin</a></div>`;
    return;
  }
  if (!user.emailVerified) { root.innerHTML=creatorUnverifiedHTML(user); return; }
  try { await ensureCreatorProfile(user, user.providerData.some(p=>p.providerId==="google.com")?"google":"email"); await loadCreatorDocs(user); }
  catch(err){ console.error(err); root.innerHTML=`<div class="panel"><h3>Creator data unavailable</h3><p class="muted">${esc(err.message||"Check Firebase rules.")}</p></div>`; return; }
  if (!state.creatorApplication) root.innerHTML=creatorApplicationHTML(state.creatorProfile||{});
  else root.innerHTML=creatorDashboardHTML(state.creatorProfile,state.creatorApplication);
}

async function uploadCreatorPhoto(user,file) {
  if (!file) return state.creatorProfile?.profileImageUrl||"";
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Use JPEG, PNG or WebP.");
  if (file.size > 5*1024*1024) throw new Error("Profile image must be under 5 MB.");
  const path=`creator-profiles/${user.uid}/profile-${Date.now()}`;
  const storageRef=ref(storage,path);
  await uploadBytes(storageRef,file,{contentType:file.type});
  return getDownloadURL(storageRef);
}

async function submitCreatorApplication(form) {
  const user=auth.currentUser;
  if (!user || !user.emailVerified || isSuperAdminUser(user)) throw new Error("Verified creator authentication required.");
  const fd=new FormData(form);
  status("creator-application-form","Uploading and saving…");
  const profileImageUrl=await uploadCreatorPhoto(user,fd.get("profileImage"));
  const applicationId=`VCS-APP-${user.uid.slice(0,6).toUpperCase()}`;
  const data={
    applicationId,
    uid:user.uid,
    email:user.email,
    fullName:String(fd.get("fullName")||""),
    displayName:String(fd.get("displayName")||""),
    phone:String(fd.get("phone")||""),
    dateOfBirth:String(fd.get("dateOfBirth")||""),
    gender:String(fd.get("gender")||""),
    instagramUsername:String(fd.get("instagramUsername")||"").replace(/^@/,""),
    instagramUrl:String(fd.get("instagramUrl")||""),
    reportedFollowers:Number(fd.get("reportedFollowers")||0),
    primaryNiche:String(fd.get("primaryNiche")||""),
    secondaryNiches:String(fd.get("secondaryNiches")||""),
    city:String(fd.get("city")||""),
    state:String(fd.get("state")||""),
    languages:String(fd.get("languages")||""),
    availability:String(fd.get("availability")||"Available"),
    bio:String(fd.get("bio")||""),
    reelRate:Number(fd.get("reelRate")||0),
    storyRate:Number(fd.get("storyRate")||0),
    postRate:Number(fd.get("postRate")||0),
    packageNotes:String(fd.get("packageNotes")||""),
    profileImageUrl,
    publicConsent:Boolean(fd.get("publicConsent")),
    termsAccepted:Boolean(fd.get("termsAccepted")),
    status:"PENDING",
    submittedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };
  await setDoc(doc(db,"creatorApplications",user.uid),data);
  await setDoc(doc(db,"creatorProfiles",user.uid),{
    ...data,
    applicationStatus:"PENDING",
    accountStatus:"ACTIVE",
    public:false,
    emailVerified:true,
    updatedAt:serverTimestamp()
  },{merge:true});
  state.creatorApplication=data;
  state.creatorProfile={...(state.creatorProfile||{}),...data,public:false};
  status("creator-application-form","Application submitted.","success");
  await renderCreator();
}

async function deleteCreatorAccountFlow() {
  const user=auth.currentUser;
  if(!user || isSuperAdminUser(user)) return;
  if(!confirm("Delete your VCS creator account permanently?")) return;
  const providerIds=user.providerData.map(p=>p.providerId);
  if(providerIds.includes("password")){
    const password=prompt("Enter your current password to confirm deletion:");
    if(!password) return;
    await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
  } else if(providerIds.includes("google.com")){
    await reauthenticateWithPopup(user,googleProvider);
  }
  await Promise.allSettled([
    deleteDoc(doc(db,"creatorApplications",user.uid)),
    deleteDoc(doc(db,"creatorProfiles",user.uid)),
    deleteDoc(doc(db,"creators",user.uid))
  ]);
  await deleteUser(user);
  state.user=null; state.creatorProfile=null; state.creatorApplication=null;
  renderCreator();
}

function adminLoginHTML() {
  return `<div class="auth-card" style="max-width:520px;margin:auto">
    <p class="eyebrow">Super Admin only</p>
    <h3>VCS Admin Login</h3>
    <p class="muted">There is no public Admin registration. The Super Admin account must already exist in Firebase Authentication. Username is fixed.</p>
    <form id="admin-login-form" class="stack">
      <label>Username<input name="username" value="${SUPER_ADMIN_USERNAME}" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn primary-mini" type="submit">Login as Super Admin</button>
      <button class="mini" type="button" data-action="admin-forgot-password">Forgot password</button>
      <p class="form-status" data-status-for="admin-login-form"></p>
    </form>
  </div>`;
}

const adminTabs=[
  ["overview","Overview"],["applications","Creator Applications"],["creators","Creators"],["brands","Brands"],
  ["reels","Reels"],["pages","Digital Pages"],["campaigns","Campaigns"],["leads","Leads"],
  ["portfolio","Portfolio"],["audit","Audit Log"]
];

async function adminOverviewHTML() {
  const names=["creatorApplications","creators","brands","reels","digitalPages","campaigns","leads"];
  const counts={};
  await Promise.all(names.map(async n=>{ try{ counts[n]=(await getDocs(collection(db,n))).size; }catch{counts[n]=0;} }));
  return `<div class="stack">
    <div class="stats-grid">
      <div class="stat"><strong>${counts.creatorApplications}</strong><span>Creator applications</span></div>
      <div class="stat"><strong>${counts.creators}</strong><span>Approved creators</span></div>
      <div class="stat"><strong>${counts.brands}</strong><span>Brands</span></div>
      <div class="stat"><strong>${counts.campaigns}</strong><span>Campaigns</span></div>
    </div>
    <div class="panel"><p class="eyebrow">Security</p><h3>Super Admin is pre-authorized only</h3><p class="muted">The website exposes no Admin signup or Admin-account creation flow. Firebase Authentication holds the password. Firestore rules authorize the verified Super Admin email only.</p></div>
  </div>`;
}

function simpleTable(rows, columns, actionsFn=()=>"", emptyText="No records yet.") {
  if(!rows.length) return `<div class="empty">${esc(emptyText)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key]??"")}</td>`).join("")}<td><div class="row-actions">${actionsFn(r)}</div></td></tr>`).join("")}</tbody></table></div>`;
}

async function adminApplicationsHTML() {
  const rows=await listCollection("creatorApplications");
  rows.sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0));
  return `<div class="admin-toolbar"><div><p class="eyebrow">Creator Applications</p><h3>Review and approve creators</h3></div></div>`+
    simpleTable(rows,[
      {label:"Creator",render:r=>`<strong>${esc(r.displayName||r.fullName||"Creator")}</strong><br><span class="small">${esc(r.email||"")}</span>`},
      {label:"Instagram",render:r=>`@${esc(r.instagramUsername||"")}<br><span class="small">${fmt(r.reportedFollowers||0)} followers</span>`},
      {label:"Location",render:r=>`${esc(r.city||"")} ${esc(r.state||"")}`},
      {label:"Status",render:r=>`<span class="tag ${r.status==="APPROVED"?"ok":"warn"}">${esc(r.status||"PENDING")}</span>`}
    ],r=>`<button class="mini primary-mini" data-action="admin-approve-creator" data-id="${esc(r.id)}">Approve</button><button class="mini" data-action="admin-reject-creator" data-id="${esc(r.id)}">Reject</button><button class="mini" data-action="admin-edit-creator-application" data-id="${esc(r.id)}">Edit</button>`,"No creator applications yet.");
}

async function adminCreatorsHTML() {
  const rows=await listCollection("creators");
  return `<div class="admin-toolbar"><div><p class="eyebrow">Creator Roster</p><h3>Private creator management</h3></div></div>`+
    simpleTable(rows,[
      {label:"Creator",render:r=>`<strong>${esc(r.displayName||"Creator")}</strong><br><span class="small">@${esc(r.instagramUsername||"")}</span>`},
      {label:"Followers",render:r=>fmt(r.verifiedFollowers||r.reportedFollowers||0)},
      {label:"Status",render:r=>`<span class="tag ${r.status==="APPROVED"?"ok":"warn"}">${esc(r.status||"")}</span>`},
      {label:"Public",render:r=>r.public?"YES":"NO"}
    ],r=>`<button class="mini" data-action="admin-edit-creator" data-id="${esc(r.id)}">Edit</button><button class="mini" data-action="admin-toggle-creator-public" data-id="${esc(r.id)}">${r.public?"Remove public profile":"Publish profile"}</button><button class="mini danger" data-action="admin-delete-creator" data-id="${esc(r.id)}">Delete</button>`,"No approved creators yet.");
}

function genericAdminFormHTML(type,item={}) {
  const id=item.id||"";
  if(type==="brand") return `<p class="eyebrow">${id?"Edit":"Add"} Brand</p><h3 id="modal-title">Brand</h3><form id="admin-brand-form" class="stack">
    <input type="hidden" name="id" value="${esc(id)}"><label>Brand name<input name="name" required value="${esc(item.name||"")}"></label>
    <label>Relationship<input name="relationship" value="${esc(item.relationship||"Campaign")}"></label>
    <label>Website / Instagram URL<input name="website" value="${esc(item.website||"")}"></label>
    <label>Logo URL<input name="logoUrl" value="${esc(item.logoUrl||"")}"></label>
    <label class="check"><input type="checkbox" name="public" ${item.public?"checked":""}> Show on public website</label>
    <button class="btn primary-mini">Save brand</button><p class="form-status" data-status-for="admin-brand-form"></p></form>`;
  if(type==="reel") return `<p class="eyebrow">${id?"Edit":"Add"} Reel / Video</p><h3 id="modal-title">Homepage Reel</h3><form id="admin-reel-form" class="stack">
    <input type="hidden" name="id" value="${esc(id)}"><label>Title<input name="title" required value="${esc(item.title||"")}"></label>
    <label>Brand / campaign<input name="brand" value="${esc(item.brand||"")}"></label>
    <label>Source<select name="sourceType"><option value="INSTAGRAM" ${item.sourceType==="INSTAGRAM"?"selected":""}>Instagram Reel</option><option value="VIDEO_URL" ${item.sourceType==="VIDEO_URL"?"selected":""}>Direct Video URL</option></select></label>
    <label>Reel / Video URL<input name="url" required value="${esc(item.url||item.videoUrl||"")}"></label>
    <label>Caption<textarea name="caption">${esc(item.caption||"")}</textarea></label>
    <label>Display order<input name="order" type="number" min="1" value="${esc(item.order||1)}"></label>
    <label class="check"><input type="checkbox" name="featured" ${item.featured?"checked":""}> Featured</label>
    <label class="check"><input type="checkbox" name="public" ${item.public?"checked":""}> Show on homepage</label>
    <button class="btn primary-mini">Save reel</button><p class="form-status" data-status-for="admin-reel-form"></p></form>`;
  if(type==="page") return `<p class="eyebrow">${id?"Edit":"Add"} Digital Page</p><h3 id="modal-title">Digital Page</h3><form id="admin-page-form" class="stack">
    <input type="hidden" name="id" value="${esc(id)}"><label>Name<input name="name" required value="${esc(item.name||"")}"></label>
    <label>Handle<input name="handle" value="${esc(item.handle||"")}"></label>
    <label>Followers<input name="followers" type="number" min="0" value="${esc(item.followers||0)}"></label>
    <label>Category<input name="category" value="${esc(item.category||"")}"></label>
    <label>Relation<input name="relation" value="${esc(item.relation||"VCS network")}"></label>
    <label class="check"><input type="checkbox" name="public" ${item.public?"checked":""}> Show publicly</label>
    <button class="btn primary-mini">Save page</button><p class="form-status" data-status-for="admin-page-form"></p></form>`;
  if(type==="campaign") return `<p class="eyebrow">${id?"Edit":"Create"} Campaign</p><h3 id="modal-title">Campaign</h3><form id="admin-campaign-form" class="stack">
    <input type="hidden" name="id" value="${esc(id)}"><label>Campaign name<input name="name" required value="${esc(item.name||"")}"></label>
    <label>Brand / display label<input name="brandLabel" value="${esc(item.brandLabel||item.brand||"")}"></label>
    <label>Brief<textarea name="brief" required>${esc(item.brief||"")}</textarea></label>
    <label>Platform<input name="platform" value="${esc(item.platform||"Instagram")}"></label>
    <label>Niche<input name="niche" value="${esc(item.niche||"All")}"></label>
    <label>City<input name="city" value="${esc(item.city||"All India")}"></label>
    <label>Minimum followers<input name="minFollowers" type="number" min="0" value="${esc(item.minFollowers||0)}"></label>
    <label>Maximum followers<input name="maxFollowers" type="number" min="0" value="${esc(item.maxFollowers||100000000)}"></label>
    <label>Deliverables<input name="deliverables" value="${esc(item.deliverables||"")}"></label>
    <label>Deadline<input name="deadline" type="date" value="${esc(item.deadline||"")}"></label>
    <label>Google Form URL<input name="googleFormUrl" value="${esc(item.googleFormUrl||"")}"></label>
    <label>Status<select name="status">${["DRAFT","CASTING_OPEN","LIVE","CLOSED","COMPLETED"].map(x=>`<option ${item.status===x?"selected":""}>${x}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" name="public" ${item.public?"checked":""}> Public opportunity</label>
    <button class="btn primary-mini">Save campaign</button><p class="form-status" data-status-for="admin-campaign-form"></p></form>`;
  return "";
}

async function genericCollectionHTML(type) {
  const map={brand:["brands","Brands","Brand"],reel:["reels","Reels","Reel / Video"],page:["digitalPages","Digital Pages","Digital Page"],campaign:["campaigns","Campaigns","Campaign"]};
  const [collectionName,title,singular]=map[type];
  const rows=await listCollection(collectionName);
  const actionName=type==="page"?"page":type;
  return `<div class="admin-toolbar"><div><p class="eyebrow">${esc(title)}</p><h3>${esc(title)} management</h3></div><button class="mini primary-mini" data-action="admin-open-${actionName}">+ Add ${esc(singular)}</button></div>`+
    simpleTable(rows,[
      {label:"Name",render:r=>`<strong>${esc(r.name||r.title||singular)}</strong>`},
      {label:"Status",render:r=>type==="campaign"?esc(r.status||"DRAFT"):(r.public?"PUBLIC":"HIDDEN")},
      {label:"Updated",render:r=>esc(r.updatedAt?.toDate?r.updatedAt.toDate().toLocaleString():"—")}
    ],r=>`<button class="mini" data-action="admin-edit-${actionName}" data-id="${esc(r.id)}">Edit</button><button class="mini danger" data-action="admin-delete-${actionName}" data-id="${esc(r.id)}">Delete</button>`,`No ${title.toLowerCase()} yet.`);
}

async function adminLeadsHTML() {
  const rows=await listCollection("leads");
  return `<div class="admin-toolbar"><div><p class="eyebrow">Client Leads</p><h3>Website enquiries</h3></div></div>`+
    simpleTable(rows,[
      {label:"Contact",render:r=>`<strong>${esc(r.name||"")}</strong><br>${esc(r.email||"")}<br>${esc(r.phone||"")}`},
      {label:"Company",key:"company"},{label:"Service",key:"service"},{label:"Status",key:"status"}
    ],r=>`<button class="mini" data-action="admin-mark-lead" data-id="${esc(r.id)}">Mark contacted</button><button class="mini danger" data-action="admin-delete-lead" data-id="${esc(r.id)}">Delete</button>`,"No website enquiries yet.");
}

async function adminPortfolioHTML() {
  let data={};
  try{const s=await getDoc(doc(db,"settings","portfolio")); if(s.exists())data=s.data();}catch{}
  return `<div class="panel"><p class="eyebrow">Portfolio</p><h3>Portfolio lead-gated download</h3>
    <form id="admin-portfolio-form" class="stack">
      <label>Portfolio PDF<input type="file" name="portfolioFile" accept="application/pdf"></label>
      <label>Version<input name="version" value="${esc(data.version||"")}"></label>
      <label class="check"><input type="checkbox" name="published" ${data.published?"checked":""}> Published</label>
      ${data.url?`<a target="_blank" rel="noopener" href="${esc(data.url)}">Current portfolio ↗</a>`:""}
      <button class="btn primary-mini">Upload / Update portfolio</button>
      <p class="form-status" data-status-for="admin-portfolio-form"></p>
    </form></div>`;
}

async function adminAuditHTML() {
  const rows=await listCollection("auditLogs");
  rows.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  return `<div class="admin-toolbar"><div><p class="eyebrow">Audit Log</p><h3>Admin activity</h3></div></div>`+
    simpleTable(rows.slice(0,100),[
      {label:"Action",key:"action"},{label:"Actor",key:"actorEmail"},{label:"Time",render:r=>r.createdAt?.toDate?r.createdAt.toDate().toLocaleString():"—"}
    ],()=>"", "No audit events yet.");
}

async function adminTabHTML() {
  switch(state.adminTab){
    case "overview": return adminOverviewHTML();
    case "applications": return adminApplicationsHTML();
    case "creators": return adminCreatorsHTML();
    case "brands": return genericCollectionHTML("brand");
    case "reels": return genericCollectionHTML("reel");
    case "pages": return genericCollectionHTML("page");
    case "campaigns": return genericCollectionHTML("campaign");
    case "leads": return adminLeadsHTML();
    case "portfolio": return adminPortfolioHTML();
    case "audit": return adminAuditHTML();
    default:return adminOverviewHTML();
  }
}

async function renderAdmin() {
  const root=$("#admin-root");
  const user=state.user;
  if(!user || !isSuperAdminUser(user)){ root.innerHTML=adminLoginHTML(); return; }
  root.innerHTML=`<div class="dashboard-grid"><aside class="dashboard-nav">${adminTabs.map(([key,label])=>`<button data-action="admin-tab" data-tab="${key}" class="${state.adminTab===key?"active":""}">${label}</button>`).join("")}<button data-action="admin-logout">Log out</button></aside><div class="dashboard-content"><div class="panel">Loading ${esc(state.adminTab)}…</div></div></div>`;
  try{$(".dashboard-content",root).innerHTML=await adminTabHTML();}
  catch(err){console.error(err);$(".dashboard-content",root).innerHTML=`<div class="notice error">Admin data unavailable: ${esc(err.message||"Check Firebase rules.")}</div>`;}
}

async function signInAdmin(form) {
  const fd=new FormData(form);
  const username=String(fd.get("username")||"").trim();
  const password=String(fd.get("password")||"");
  if(username!==SUPER_ADMIN_USERNAME) throw new Error("Invalid Super Admin username.");
  const cred=await signInWithEmailAndPassword(auth,SUPER_ADMIN_EMAIL,password);
  await reload(cred.user);
  if(!isSuperAdminUser(cred.user)){ await signOut(auth); throw new Error("This Firebase account is not authorized as VCS Super Admin."); }
  state.user=cred.user;
  await renderAdmin();
}

function creatorEditModalHTML(item={}) {
  return `<p class="eyebrow">Edit Creator</p><h3 id="modal-title">${esc(item.displayName||item.fullName||"Creator")}</h3>
  <form id="admin-creator-edit-form" class="two-col">
    <input type="hidden" name="uid" value="${esc(item.id||item.uid||"")}">
    <label>Full legal name<input name="fullName" value="${esc(item.fullName||"")}"></label>
    <label>Display name<input name="displayName" value="${esc(item.displayName||"")}"></label>
    <label>Email<input name="email" value="${esc(item.email||"")}"></label>
    <label>Phone<input name="phone" value="${esc(item.phone||"")}"></label>
    <label>Instagram username<input name="instagramUsername" value="${esc(item.instagramUsername||"")}"></label>
    <label>Instagram URL<input name="instagramUrl" value="${esc(item.instagramUrl||"")}"></label>
    <label>Verified followers<input name="verifiedFollowers" type="number" min="0" value="${esc(item.verifiedFollowers||item.reportedFollowers||0)}"></label>
    <label>Primary niche<input name="primaryNiche" value="${esc(item.primaryNiche||"")}"></label>
    <label>Secondary niches<input name="secondaryNiches" value="${esc(item.secondaryNiches||"")}"></label>
    <label>City<input name="city" value="${esc(item.city||"")}"></label>
    <label>State<input name="state" value="${esc(item.state||"")}"></label>
    <label>Languages<input name="languages" value="${esc(item.languages||"")}"></label>
    <label>Availability<input name="availability" value="${esc(item.availability||"")}"></label>
    <label>Status<select name="status">${["PENDING","APPROVED","REJECTED","SUSPENDED"].map(x=>`<option ${item.status===x?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Reel commercial (₹)<input name="reelRate" type="number" min="0" value="${esc(item.reelRate||0)}"></label>
    <label>Story commercial (₹)<input name="storyRate" type="number" min="0" value="${esc(item.storyRate||0)}"></label>
    <label>Static post commercial (₹)<input name="postRate" type="number" min="0" value="${esc(item.postRate||0)}"></label>
    <label style="grid-column:1/-1">Public bio<textarea name="bio">${esc(item.bio||"")}</textarea></label>
    <label class="check" style="grid-column:1/-1"><input name="publicConsent" type="checkbox" ${item.publicConsent?"checked":""}> Public profile consent on file</label>
    <label class="check" style="grid-column:1/-1"><input name="public" type="checkbox" ${item.public?"checked":""}> Publish profile</label>
    <button class="btn primary-mini" type="submit">Save creator</button>
    <p class="form-status" data-status-for="admin-creator-edit-form"></p>
  </form>`;
}

async function openCreatorEdit(uid, fromApplication=false) {
  const source=fromApplication?"creatorApplications":"creators";
  const snap=await getDoc(doc(db,source,uid));
  if(!snap.exists()) throw new Error("Creator record not found.");
  openModal(creatorEditModalHTML({id:snap.id,...snap.data()}));
}

async function saveCreatorAdmin(form) {
  const fd=new FormData(form),uid=String(fd.get("uid")||"");
  if(!uid) throw new Error("Creator UID missing.");
  const existingSnap=await getDoc(doc(db,"creators",uid));
  const applicationSnap=await getDoc(doc(db,"creatorApplications",uid));
  const base=existingSnap.exists()?existingSnap.data():(applicationSnap.exists()?applicationSnap.data():{});
  const publicConsent=Boolean(fd.get("publicConsent"));
  const publicFlag=Boolean(fd.get("public"));
  if(publicFlag&&!publicConsent) throw new Error("A creator cannot be published without public-profile consent.");
  const data={
    ...base,
    fullName:String(fd.get("fullName")||""),
    displayName:String(fd.get("displayName")||""),
    email:String(fd.get("email")||""),
    phone:String(fd.get("phone")||""),
    instagramUsername:String(fd.get("instagramUsername")||"").replace(/^@/,""),
    instagramUrl:String(fd.get("instagramUrl")||""),
    verifiedFollowers:Number(fd.get("verifiedFollowers")||0),
    primaryNiche:String(fd.get("primaryNiche")||""),
    secondaryNiches:String(fd.get("secondaryNiches")||""),
    city:String(fd.get("city")||""),
    state:String(fd.get("state")||""),
    languages:String(fd.get("languages")||""),
    availability:String(fd.get("availability")||""),
    status:String(fd.get("status")||"PENDING"),
    reelRate:Number(fd.get("reelRate")||0),
    storyRate:Number(fd.get("storyRate")||0),
    postRate:Number(fd.get("postRate")||0),
    bio:String(fd.get("bio")||""),
    publicConsent,
    public:publicFlag,
    updatedAt:serverTimestamp()
  };
  if(data.status==="APPROVED"){
    data.creatorId=base.creatorId||`VCS-CR-${uid.slice(0,6).toUpperCase()}`;
    await setDoc(doc(db,"creators",uid),data,{merge:true});
  } else if(existingSnap.exists()) {
    await updateDoc(doc(db,"creators",uid),data);
  }
  if(applicationSnap.exists()){
    const appData={...data,creatorId:data.creatorId||base.creatorId||null};
    delete appData.public;
    await updateDoc(doc(db,"creatorApplications",uid),appData);
  }
  const profileSnap=await getDoc(doc(db,"creatorProfiles",uid));
  if(profileSnap.exists()){
    await updateDoc(doc(db,"creatorProfiles",uid),{
      displayName:data.displayName,
      phone:data.phone,
      instagramUsername:data.instagramUsername,
      instagramUrl:data.instagramUrl,
      verifiedFollowers:data.verifiedFollowers,
      primaryNiche:data.primaryNiche,
      secondaryNiches:data.secondaryNiches,
      city:data.city,
      state:data.state,
      languages:data.languages,
      availability:data.availability,
      reelRate:data.reelRate,
      storyRate:data.storyRate,
      postRate:data.postRate,
      bio:data.bio,
      publicConsent:data.publicConsent,
      applicationStatus:data.status,
      public:data.public,
      updatedAt:serverTimestamp()
    });
  }
  await audit("CREATOR_UPDATED",{uid,status:data.status,public:data.public});
  closeModal();
  await renderAdmin();
}

async function approveCreator(uid) {
  const appSnap=await getDoc(doc(db,"creatorApplications",uid));
  if(!appSnap.exists()) throw new Error("Application not found.");
  const a=appSnap.data();
  const creatorId=`VCS-CR-${uid.slice(0,6).toUpperCase()}`;
  const creator={
    ...a, creatorId, status:"APPROVED", public:false,
    publicConsent:Boolean(a.publicConsent),
    verifiedFollowers:Number(a.verifiedFollowers||a.reportedFollowers||0),
    approvedAt:serverTimestamp(), updatedAt:serverTimestamp()
  };
  await setDoc(doc(db,"creators",uid),creator);
  await updateDoc(doc(db,"creatorApplications",uid),{status:"APPROVED",creatorId,reviewedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await updateDoc(doc(db,"creatorProfiles",uid),{applicationStatus:"APPROVED",creatorId,updatedAt:serverTimestamp()});
  await audit("CREATOR_APPROVED",{uid,creatorId});
}

async function rejectCreator(uid) {
  await updateDoc(doc(db,"creatorApplications",uid),{status:"REJECTED",reviewedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await updateDoc(doc(db,"creatorProfiles",uid),{applicationStatus:"REJECTED",updatedAt:serverTimestamp()});
  await audit("CREATOR_REJECTED",{uid});
}

async function toggleCreatorPublic(uid) {
  const s=await getDoc(doc(db,"creators",uid));
  if(!s.exists()) throw new Error("Creator not found.");
  const c=s.data();
  if(!c.public && !c.publicConsent) throw new Error("Creator has not provided public-profile consent.");
  await updateDoc(doc(db,"creators",uid),{public:!c.public,updatedAt:serverTimestamp()});
  await audit(c.public?"CREATOR_UNPUBLISHED":"CREATOR_PUBLISHED",{uid});
}

async function deleteCreatorAdmin(uid) {
  if(!confirm("Permanently delete this creator profile/application data? Authentication user deletion requires Firebase Admin SDK or the creator's own account.")) return;
  await Promise.allSettled([
    deleteDoc(doc(db,"creators",uid)),
    deleteDoc(doc(db,"creatorApplications",uid)),
    deleteDoc(doc(db,"creatorProfiles",uid))
  ]);
  await audit("CREATOR_DATA_DELETED",{uid});
}

async function saveGenericAdmin(type,form) {
  const fd=new FormData(form);
  const id=String(fd.get("id")||"");
  const map={brand:"brands",reel:"reels",page:"digitalPages",campaign:"campaigns"};
  const collectionName=map[type];
  let data={updatedAt:serverTimestamp()};
  if(type==="brand"){
    let website=String(fd.get("website")||"").trim(); if(website&&!/^https?:\/\//i.test(website))website="https://"+website;
    data={...data,name:String(fd.get("name")||""),relationship:String(fd.get("relationship")||""),website,logoUrl:String(fd.get("logoUrl")||""),public:Boolean(fd.get("public"))};
  }
  if(type==="reel"){
    const sourceType=String(fd.get("sourceType")||"INSTAGRAM"),url=String(fd.get("url")||"").trim();
    if(sourceType==="INSTAGRAM"&&!normalizeInstagramEmbed(url))throw new Error("Use a valid Instagram Reel/Post URL.");
    data={...data,title:String(fd.get("title")||""),brand:String(fd.get("brand")||""),sourceType,url,videoUrl:sourceType==="VIDEO_URL"?url:"",caption:String(fd.get("caption")||""),order:Number(fd.get("order")||1),featured:Boolean(fd.get("featured")),public:Boolean(fd.get("public"))};
  }
  if(type==="page")data={...data,name:String(fd.get("name")||""),handle:String(fd.get("handle")||"").replace(/^@/,""),followers:Number(fd.get("followers")||0),category:String(fd.get("category")||""),relation:String(fd.get("relation")||""),public:Boolean(fd.get("public"))};
  if(type==="campaign")data={...data,name:String(fd.get("name")||""),brandLabel:String(fd.get("brandLabel")||""),brief:String(fd.get("brief")||""),platform:String(fd.get("platform")||""),niche:String(fd.get("niche")||""),city:String(fd.get("city")||""),minFollowers:Number(fd.get("minFollowers")||0),maxFollowers:Number(fd.get("maxFollowers")||100000000),deliverables:String(fd.get("deliverables")||""),deadline:String(fd.get("deadline")||""),googleFormUrl:String(fd.get("googleFormUrl")||""),status:String(fd.get("status")||"DRAFT"),public:Boolean(fd.get("public"))};
  if(id) await updateDoc(doc(db,collectionName,id),data);
  else await addDoc(collection(db,collectionName),{...data,createdAt:serverTimestamp()});
  await audit(`${type.toUpperCase()}_${id?"UPDATED":"CREATED"}`,{id:id||"new"});
  closeModal(); await renderAdmin(); await safePublicLoad();
}

async function openGenericEdit(type,id="") {
  const map={brand:"brands",reel:"reels",page:"digitalPages",campaign:"campaigns"};
  let item={};
  if(id){const s=await getDoc(doc(db,map[type],id));if(s.exists())item={id:s.id,...s.data()};}
  openModal(genericAdminFormHTML(type,item));
}

async function deleteGeneric(type,id) {
  if(!confirm("Delete this record?"))return;
  const map={brand:"brands",reel:"reels",page:"digitalPages",campaign:"campaigns",lead:"leads"};
  await deleteDoc(doc(db,map[type],id));
  await audit(`${type.toUpperCase()}_DELETED`,{id});
  await renderAdmin(); if(type!=="lead")await safePublicLoad();
}

async function savePortfolio(form){
  const fd=new FormData(form),file=fd.get("portfolioFile");
  status("admin-portfolio-form","Saving…");
  let current={};try{const s=await getDoc(doc(db,"settings","portfolio"));if(s.exists())current=s.data();}catch{}
  let url=current.url||"";
  if(file&&file.size){
    if(file.type!=="application/pdf")throw new Error("Portfolio must be a PDF.");
    if(file.size>15*1024*1024)throw new Error("Portfolio PDF must be under 15 MB.");
    const r=ref(storage,"portfolio/current.pdf");
    await uploadBytes(r,file,{contentType:"application/pdf"});
    url=await getDownloadURL(r);
  }
  await setDoc(doc(db,"settings","portfolio"),{url,version:String(fd.get("version")||""),published:Boolean(fd.get("published")),updatedAt:serverTimestamp()},{merge:true});
  await audit("PORTFOLIO_UPDATED",{published:Boolean(fd.get("published"))});
  status("admin-portfolio-form","Portfolio updated.","success");await renderAdmin();
}

async function changeCreatorPhoto() {
  const user=auth.currentUser;if(!user||isSuperAdminUser(user))return;
  openModal(`<p class="eyebrow">Creator Profile</p><h3 id="modal-title">Change profile photo</h3><form id="creator-photo-form" class="stack"><label>New photo<input type="file" name="profileImage" accept="image/jpeg,image/png,image/webp" required></label><button class="btn primary-mini">Upload photo</button><p class="form-status" data-status-for="creator-photo-form"></p></form>`);
}

async function submitCreatorPhoto(form) {
  const user=auth.currentUser,fd=new FormData(form);
  status("creator-photo-form","Uploading…");
  const url=await uploadCreatorPhoto(user,fd.get("profileImage"));
  await updateDoc(doc(db,"creatorProfiles",user.uid),{profileImageUrl:url,updatedAt:serverTimestamp()});
  const appRef=doc(db,"creatorApplications",user.uid); if((await getDoc(appRef)).exists())await updateDoc(appRef,{profileImageUrl:url,updatedAt:serverTimestamp()});
  const creatorRef=doc(db,"creators",user.uid); if((await getDoc(creatorRef)).exists())await updateDoc(creatorRef,{profileImageUrl:url,updatedAt:serverTimestamp()});
  closeModal();await loadCreatorDocs(user);await renderCreator();
}

function campaignEnquiryModal() {
  openModal(`<p class="eyebrow">Start a Campaign</p><h3 id="modal-title">Campaign enquiry</h3><form id="campaign-enquiry-form" class="stack">
    <label>Full name<input name="name" required></label><label>Company / Brand<input name="company" required></label>
    <label>Work email<input name="email" type="email" required></label><label>Phone / WhatsApp<input name="phone" required></label>
    <label>Requirement<textarea name="requirement" rows="4" required></textarea></label>
    <label>Approx. budget<input name="budget"></label><label class="check"><input name="consent" type="checkbox" required> I consent to VCS contacting me.</label>
    <button class="btn primary-mini">Submit</button><p class="form-status" data-status-for="campaign-enquiry-form"></p></form>`);
}

async function handleCampaignEnquiry(form) {
  const fd=new FormData(form);
  status("campaign-enquiry-form","Submitting…");
  await createLead({name:String(fd.get("name")||""),company:String(fd.get("company")||""),email:String(fd.get("email")||""),phone:String(fd.get("phone")||""),service:"Campaign Enquiry",requirement:String(fd.get("requirement")||""),budget:String(fd.get("budget")||""),consent:Boolean(fd.get("consent"))});
  status("campaign-enquiry-form","Submitted. VCS will contact you.","success");
  setTimeout(closeModal,800);
}

document.addEventListener("click", async e => {
  const route=e.target.closest("[data-route]");
  if(route){e.preventDefault();showPortal(route.dataset.route);return;}
  const a=e.target.closest("[data-action]");if(!a)return;
  const action=a.dataset.action;
  try{
    if(action==="close-modal"){closeModal();return;}
    if(action==="campaign-enquiry"){campaignEnquiryModal();return;}
    if(action==="creator-google"){
      try{await signInWithPopup(auth,googleProvider);}
      catch(err){if(["auth/popup-blocked","auth/cancelled-popup-request"].includes(err.code))await signInWithRedirect(auth,googleProvider);else throw err;}
      return;
    }
    if(action==="creator-forgot-password"){
      const email=prompt("Enter your creator email:");if(email)await sendPasswordResetEmail(auth,email);alert("If the account exists, Firebase has sent a reset email.");return;
    }
    if(action==="resend-verification"){await sendEmailVerification(auth.currentUser);status("creator-verification","Verification email sent.","success");return;}
    if(action==="refresh-verification"){await reload(auth.currentUser);state.user=auth.currentUser;await renderCreator();return;}
    if(action==="creator-logout"){await signOut(auth);return;}
    if(action==="creator-change-photo"){await changeCreatorPhoto();return;}
    if(action==="creator-delete-account"){await deleteCreatorAccountFlow();return;}
    if(action==="admin-forgot-password"){await sendPasswordResetEmail(auth,SUPER_ADMIN_EMAIL);alert("Password reset email sent to the Super Admin email account.");return;}
    if(action==="admin-logout"){await signOut(auth);state.adminTab="overview";return;}
    if(action==="admin-tab"){state.adminTab=a.dataset.tab;await renderAdmin();return;}
    if(action==="admin-approve-creator"){await approveCreator(a.dataset.id);await renderAdmin();return;}
    if(action==="admin-reject-creator"){await rejectCreator(a.dataset.id);await renderAdmin();return;}
    if(action==="admin-toggle-creator-public"){await toggleCreatorPublic(a.dataset.id);await renderAdmin();return;}
    if(action==="admin-delete-creator"){await deleteCreatorAdmin(a.dataset.id);await renderAdmin();return;}
    if(action==="admin-edit-creator"){await openCreatorEdit(a.dataset.id,false);return;}
    if(action==="admin-edit-creator-application"){await openCreatorEdit(a.dataset.id,true);return;}
    if(action==="admin-open-brand"){await openGenericEdit("brand");return;}
    if(action==="admin-open-reel"){await openGenericEdit("reel");return;}
    if(action==="admin-open-page"){await openGenericEdit("page");return;}
    if(action==="admin-open-campaign"){await openGenericEdit("campaign");return;}
    if(action.startsWith("admin-edit-")){
      const type=action.replace("admin-edit-",""); if(["brand","reel","page","campaign"].includes(type))await openGenericEdit(type,a.dataset.id);return;
    }
    if(action.startsWith("admin-delete-")){
      const type=action.replace("admin-delete-",""); if(["brand","reel","page","campaign","lead"].includes(type))await deleteGeneric(type,a.dataset.id);return;
    }
    if(action==="admin-mark-lead"){await updateDoc(doc(db,"leads",a.dataset.id),{status:"CONTACTED",updatedAt:serverTimestamp()});await audit("LEAD_CONTACTED",{id:a.dataset.id});await renderAdmin();return;}
  }catch(err){console.error(err);alert(err.message||"Action failed.");}
});

document.addEventListener("submit", async e=>{
  const form=e.target;if(!(form instanceof HTMLFormElement))return;
  const id=form.getAttribute("id");
  if(!id)return;
  try{
    if(id==="contact-form"){e.preventDefault();await handleContactSubmit(form);}
    if(id==="campaign-enquiry-form"){e.preventDefault();await handleCampaignEnquiry(form);}
    if(id==="creator-register-form"){
      e.preventDefault();const fd=new FormData(form),email=String(fd.get("email")||"").trim().toLowerCase(),pw=String(fd.get("password")||""),cf=String(fd.get("confirm")||"");
      status(id,"Creating account…");
      if(email===SUPER_ADMIN_EMAIL.toLowerCase())throw new Error("This email is reserved for Super Admin.");
      if(pw!==cf)throw new Error("Passwords do not match.");
      const cred=await createUserWithEmailAndPassword(auth,email,pw);await ensureCreatorProfile(cred.user,"email");await sendEmailVerification(cred.user);
      status(id,"Account created. Verification email sent.","success");
    }
    if(id==="creator-login-form"){
      e.preventDefault();const fd=new FormData(form),email=String(fd.get("email")||"").trim().toLowerCase(),pw=String(fd.get("password")||"");
      status(id,"Signing in…");if(email===SUPER_ADMIN_EMAIL.toLowerCase())throw new Error("Use the Admin portal for this account.");
      await signInWithEmailAndPassword(auth,email,pw);
    }
    if(id==="creator-application-form"){e.preventDefault();await submitCreatorApplication(form);}
    if(id==="creator-photo-form"){e.preventDefault();await submitCreatorPhoto(form);}
    if(id==="admin-login-form"){e.preventDefault();status(id,"Authenticating…");await signInAdmin(form);}
    if(id==="admin-brand-form"){e.preventDefault();await saveGenericAdmin("brand",form);}
    if(id==="admin-reel-form"){e.preventDefault();await saveGenericAdmin("reel",form);}
    if(id==="admin-page-form"){e.preventDefault();await saveGenericAdmin("page",form);}
    if(id==="admin-campaign-form"){e.preventDefault();await saveGenericAdmin("campaign",form);}
    if(id==="admin-portfolio-form"){e.preventDefault();await savePortfolio(form);}
    if(id==="admin-creator-edit-form"){e.preventDefault();await saveCreatorAdmin(form);}
  }catch(err){
    console.error(err);
    status(id,err.message||"Request failed.","error");
  }
});

$("#menu-toggle")?.addEventListener("click",()=>{
  const nav=$("#site-nav");nav.classList.toggle("open");
  $("#menu-toggle").setAttribute("aria-expanded",nav.classList.contains("open")?"true":"false");
});
$$(".site-nav a").forEach(a=>a.addEventListener("click",()=>$("#site-nav")?.classList.remove("open")));

onAuthStateChanged(auth, async user=>{
  state.user=user;
  setBackendStatus("Firebase connected",true);
  if(user && !isSuperAdminUser(user) && user.emailVerified){
    try{await ensureCreatorProfile(user,user.providerData.some(p=>p.providerId==="google.com")?"google":"email");}catch(err){console.warn(err);}
  }
  if(location.hash==="#creator-portal")await renderCreator();
  if(location.hash==="#admin-portal")await renderAdmin();
});

try{
  const redirect=await getRedirectResult(auth);
  if(redirect?.user && !isSuperAdminUser(redirect.user))await ensureCreatorProfile(redirect.user,"google");
}catch(err){console.warn("Google redirect result unavailable",err);}

window.addEventListener("hashchange",()=>{
  if(location.hash==="#creator-portal"){ $$("#admin-portal").forEach(x=>x.classList.remove("active")); $("#creator-portal").classList.add("active"); renderCreator(); }
  else if(location.hash==="#admin-portal"){ $$("#creator-portal").forEach(x=>x.classList.remove("active")); $("#admin-portal").classList.add("active"); renderAdmin(); }
  else $$(".portal").forEach(p=>p.classList.remove("active"));
});

safePublicLoad().then(()=>setBackendStatus("Firebase connected",true)).catch(err=>{console.warn(err);setBackendStatus("Public site ready · backend access pending");});
if(location.hash==="#creator-portal"){ $("#creator-portal").classList.add("active"); renderCreator(); }
if(location.hash==="#admin-portal"){ $("#admin-portal").classList.add("active"); renderAdmin(); }
window.__VCS_APP_READY=true;
