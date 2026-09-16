import { rm, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const SRC="site-v7";
const OUT="dist";
await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
await mkdir(`${OUT}/admin`,{recursive:true});
await mkdir(`${OUT}/creator`,{recursive:true});

for (const file of ["index.html","styles.css","shell.js","app.js","firebase-core.js"]) {
  await copyFile(`${SRC}/${file}`,`${OUT}/${file}`);
}

execFileSync(process.execPath,["--check",`${SRC}/shell.js`],{stdio:"inherit"});
execFileSync(process.execPath,["--check",`${SRC}/app.js`],{stdio:"inherit"});
execFileSync(process.execPath,["--check",`${SRC}/firebase-core.js`],{stdio:"inherit"});

const [html,css,shell,app,firebase]=await Promise.all([
  readFile(`${SRC}/index.html`,"utf8"),
  readFile(`${SRC}/styles.css`,"utf8"),
  readFile(`${SRC}/shell.js`,"utf8"),
  readFile(`${SRC}/app.js`,"utf8"),
  readFile(`${SRC}/firebase-core.js`,"utf8")
]);

const requiredHtml=[
  'id="home"','id="about"','id="services"','id="reels"','id="brands"','id="pages"',
  'id="campaigns"','id="contact"','id="creator-portal"','id="admin-portal"',
  'id="creator-root"','id="admin-root"','id="contact-form"'
];
for(const marker of requiredHtml) if(!html.includes(marker)) throw new Error(`Missing V7 HTML marker: ${marker}`);

const requiredApp=[
  "creator-register-form","creator-login-form","creator-application-form","admin-login-form",
  "admin-brand-form","admin-reel-form","admin-page-form","admin-campaign-form",
  "Email verification is mandatory","admin-approve-creator","admin-toggle-creator-public",
  "creator-delete-account","campaign-enquiry-form"
];
for(const marker of requiredApp) if(!app.includes(marker)) throw new Error(`Missing V7 app marker: ${marker}`);

const requiredFirebase=[
  'projectId: "venoa-constuls"','SUPER_ADMIN_USERNAME = "admin"',
  "signInWithEmailAndPassword","sendEmailVerification","GoogleAuthProvider","getFirestore","getStorage"
];
for(const marker of requiredFirebase) if(!firebase.includes(marker)) throw new Error(`Missing Firebase marker: ${marker}`);

if(/Admin@8097/.test(html+app+firebase)) throw new Error("Admin password must never be embedded in frontend source.");
if(/\batob\s*\(|DecompressionStream/.test(html+app+firebase)) throw new Error("Unsafe browser decompression code detected.");

const faviconB64=(await readFile("assets/favicon.b64","utf8")).trim();
await writeFile(`${OUT}/favicon.png`,Buffer.from(faviconB64,"base64"));

const redirect=(target,title)=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta http-equiv="refresh" content="0;url=/${target}"><script>location.replace('/${target}')</script></head><body><a href="/${target}">Continue</a></body></html>`;
await writeFile(`${OUT}/admin/index.html`,redirect("#admin-portal","VCS Super Admin"));
await writeFile(`${OUT}/creator/index.html`,redirect("#creator-portal","VCS Creator Portal"));
await writeFile(`${OUT}/robots.txt`,"User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n");
await writeFile(`${OUT}/sitemap.xml`,'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc></url></urlset>\n');
await writeFile(`${OUT}/404.html`,html.replace("<title>Venoa Consults — Influence. Distribution. Growth.</title>","<title>Page not found — Venoa Consults</title>"));

const hash=createHash("sha256").update(html+css+shell+app+firebase).digest("hex");
console.log(`VCS V7 core build verified: ${hash}`);
console.log(`HTML=${html.length} CSS=${css.length} SHELL=${shell.length} APP=${app.length} FIREBASE=${firebase.length}`);
