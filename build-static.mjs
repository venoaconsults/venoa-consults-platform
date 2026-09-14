import { rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { createHash } from 'node:crypto';

const SRC='site';
const OUT='dist';
await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
await cp(SRC,OUT,{recursive:true});

const html=await readFile(`${OUT}/index.html`,'utf8');
const js=await readFile(`${OUT}/app.js`,'utf8');
const css=await readFile(`${OUT}/styles.css`,'utf8');
new Script(js,{filename:'app.js'});
const required=[
  'id="about"','id="services"','id="reels"','id="pages"','id="campaigns"','id="contact"',
  'id="creator-view"','id="admin-view"','data-action="open-campaign-enquiry"','data-route="creator"','data-route="admin"'
];
for(const marker of required) if(!html.includes(marker)) throw new Error(`Missing required website marker: ${marker}`);
const jsRequired=['creator-register','creator-application','admin-login','open-brand-form','open-reel-form','open-page-form','portfolio-upload','Client Shortlists','googleWebhookUrl'];
for(const marker of jsRequired) if(!js.includes(marker)) throw new Error(`Missing required app marker: ${marker}`);
if(/\batob\s*\(|DecompressionStream/.test(html+js)) throw new Error('Unsafe browser decompression code detected.');
if(!css.includes('.view.active{display:block}')) throw new Error('View visibility CSS missing.');

const faviconB64=(await readFile('assets/favicon.b64','utf8')).trim();
const favicon=Buffer.from(faviconB64,'base64');
if(!favicon.length) throw new Error('Favicon decode failed.');
await writeFile(`${OUT}/favicon.png`,favicon);
await writeFile(`${OUT}/robots.txt`,'User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n');
await writeFile(`${OUT}/sitemap.xml`,'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc></url></urlset>\n');
await writeFile(`${OUT}/404.html`,html.replace('<title>Venoa Consults — Influence. Distribution. Growth.</title>','<title>Page not found — Venoa Consults</title>'));
const hash=createHash('sha256').update(html+js+css).digest('hex');
console.log(`VCS clean build verified. bundle_sha256=${hash}`);
console.log(`HTML ${html.length} chars | JS ${js.length} chars | CSS ${css.length} chars | favicon ${favicon.length} bytes`);
