import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const EXPECTED_SHA256 = 'a918b7ab9fb2c520d9058c8a9e592acf5297d80356122939c296b2fda84f5535';

async function main() {
  const base64 = (await readFile('production-final/source.b64', 'utf8')).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Final production bundle contains invalid Base64 characters.');
  const html = gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
  const hash = createHash('sha256').update(html).digest('hex');
  if (hash !== EXPECTED_SHA256) throw new Error(`Final production source integrity mismatch: ${hash}`);

  const required = [
    '<title>Venoa Consults — Influence. Distribution. Growth.</title>',
    'id="about"','id="services"','id="reels"','id="pages"','id="campaigns"','id="contact"',
    'id="creator-view"','id="admin-view"','save-brand-direct','save-reel-direct',
    "const formId=f.getAttribute('id')||''",'Email Verification Required','vcs-live-resilience'
  ];
  for (const marker of required) if (!html.includes(marker)) throw new Error(`Final production marker missing: ${marker}`);
  if (html.includes('id="creators"')) throw new Error('Public creator roster section must remain removed from homepage.');
  if (/\batob\s*\(|DecompressionStream/.test(html)) throw new Error('Unsafe browser-side decompression code detected.');

  const faviconBase64 = (await readFile('assets/favicon.b64', 'utf8')).trim();
  await mkdir('dist/.well-known', { recursive: true });
  await writeFile('dist/index.html', html, 'utf8');
  await writeFile('dist/favicon.png', Buffer.from(faviconBase64, 'base64'));
  await writeFile('dist/apple-touch-icon.png', Buffer.from(faviconBase64, 'base64'));
  await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n', 'utf8');
  await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n', 'utf8');
  await writeFile('dist/.well-known/security.txt', 'Contact: mailto:info@venoaconsults.com\nCanonical: https://www.venoaconsults.com/.well-known/security.txt\n', 'utf8');
  await writeFile('dist/404.html', '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Venoa Consults — Page not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#061B27;color:#F4EEE5;font-family:system-ui}.x{text-align:center;padding:32px}a{color:#F4EEE5}</style><div class="x"><h1>404</h1><p>This page does not exist.</p><a href="/">Return to Venoa Consults</a></div>', 'utf8');

  console.log(`VCS final production build verified: ${hash} (${html.length} chars)`);
}

main().catch(err => { console.error(err); process.exit(1); });
