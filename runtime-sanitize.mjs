import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');

if (!html.includes('<html') || !html.includes('</body>')) throw new Error('Invalid VCS HTML output.');

// Production stability: remove the optional motion engine. Core content, routing,
// forms and Admin/Creator functionality are handled by the main application script.
html = html.replace(/<script\s+id=["']vcs-v4-motion-engine["'][^>]*>[\s\S]*?<\/script>/i, '');

const css = `<style id="vcs-runtime-sanitize">
.reveal,.hero-copy,.social-stage{opacity:1!important;visibility:visible!important;filter:none!important;transform:none!important}
.v4-cursor-glow,.v4-cursor-dot{display:none!important;pointer-events:none!important}
</style>`;
if (!html.includes('id="vcs-runtime-sanitize"')) html = html.replace('</head>', `${css}\n</head>`);

await writeFile(path, html, 'utf8');
console.log(`VCS production runtime sanitized (${html.length} chars).`);
