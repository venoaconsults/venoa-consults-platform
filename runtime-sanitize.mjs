import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');

if (!html.includes('<html') || !html.includes('</body>')) {
  throw new Error('VCS runtime sanitize: invalid HTML output.');
}

// The advanced V4 motion engine is progressive enhancement only. It was causing
// browser stalls/blank sections in production, so production now ships without it.
html = html.replace(/<script\s+id=["']vcs-v4-motion-engine["'][^>]*>[\s\S]*?<\/script>/i, '');

const css = `<style id="vcs-runtime-sanitize">
html{scroll-behavior:smooth}
.reveal,.hero-copy,.social-stage{opacity:1!important;visibility:visible!important;filter:none!important;transform:none!important}
.v4-magnetic,.tilt-card{transform:none!important}
.v4-cursor-glow,.v4-cursor-dot{display:none!important;pointer-events:none!important}
</style>`;
if (!html.includes('id="vcs-runtime-sanitize"')) html = html.replace('</head>', `${css}\n</head>`);

// Make public section navigation usable at the browser level even if app JS fails later.
html = html.replace(/<button data-scroll="([^"]+)">([^<]+)<\/button>/g,
  '<a class="vcs-nav-link" href="#$1" data-scroll="$1">$2</a>');

const required = [
  'id="website-view"','id="creator-view"','id="admin-view"',
  'id="about"','id="services"','id="reels"','id="pages"','id="campaigns"','id="contact"',
  'creator-register-form','admin-setup-form','admin-login-form','open-brand-form','open-reel-form','open-page-form'
];
for (const marker of required) if (!html.includes(marker)) throw new Error(`VCS runtime sanitize missing marker: ${marker}`);
if (html.includes('id="vcs-v4-motion-engine"')) throw new Error('VCS runtime sanitize failed to remove motion engine.');
if (/\batob\s*\(|DecompressionStream/.test(html)) throw new Error('Unsafe browser decompression code detected.');

// Syntax-check every inline JavaScript block that will execute in the browser.
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, checked = 0;
while ((m = scriptRe.exec(html))) {
  const attrs = m[1] || '';
  const body = m[2] || '';
  if (/application\/ld\+json/i.test(attrs) || !body.trim()) continue;
  new Script(body, { filename: `vcs-inline-${checked + 1}.js` });
  checked++;
}

await writeFile(path, html, 'utf8');
console.log(`VCS runtime sanitize complete: ${html.length} chars, ${checked} inline scripts syntax-checked.`);
