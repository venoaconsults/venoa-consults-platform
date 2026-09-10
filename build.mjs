import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const EXPECTED_SHA256 = '7560d9da1973ee5a8b8aab1845189215819408cc7d562294b3a4abc0904f426c';

async function main() {
  const parts = [];
  for (let i = 1; i <= 5; i++) parts.push((await readFile(`v4/chunk${i}.txt`, 'utf8')).trim());
  const base64 = parts.join('');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('V4 bundle contains invalid Base64 characters.');

  const source = gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== EXPECTED_SHA256) throw new Error(`V4 integrity mismatch: ${hash}`);
  if (!source.startsWith('<!doctype html>') || !source.includes('Venoa Consults') || !source.includes('vcs-v4-motion-engine')) throw new Error('V4 HTML integrity markers failed.');

  let html = source.replace('<title>Venoa Consults — Interactive Preview V4</title>', '<title>Venoa Consults — Influence. Distribution. Growth.</title>');
  const creatorSourcing = '<article class="service-card reveal tilt-card"><span>04</span><h3>Creator Sourcing</h3><p>Targeted sourcing by niche, audience size, location, language and platform to build campaign-specific rosters.</p><button class="inline-link" data-action="service-detail" data-service="Creator Sourcing">Explore service →</button></article>';
  const extraServices = `${creatorSourcing}\n          <article class="service-card reveal tilt-card"><span>05</span><h3>Content Amplification</h3><p>Extend creator-led content through selected distribution channels to increase qualified reach, relevance and campaign visibility.</p><button class="inline-link" data-action="service-detail" data-service="Content Amplification">Explore service →</button></article>\n          <article class="service-card reveal tilt-card"><span>06</span><h3>Social Media Distribution</h3><p>Structured social distribution across relevant digital pages and channels to strengthen campaign discovery and conversation.</p><button class="inline-link" data-action="service-detail" data-service="Social Media Distribution">Explore service →</button></article>`;
  if (!html.includes(creatorSourcing)) throw new Error('Service injection anchor missing.');
  html = html.replace(creatorSourcing, extraServices);
  html = html.replace("'Creator Sourcing':'Campaign-specific creator discovery using the VCS advanced roster.'", "'Creator Sourcing':'Campaign-specific creator discovery using the VCS advanced roster.', 'Content Amplification':'Extend creator-led content through selected distribution channels to increase qualified reach and visibility.', 'Social Media Distribution':'Structured distribution across relevant digital pages and social channels.'");

  await mkdir('dist/.well-known', { recursive: true });
  await writeFile('dist/index.html', html, 'utf8');
  await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n', 'utf8');
  await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n', 'utf8');
  await writeFile('dist/.well-known/security.txt', 'Contact: mailto:info@venoaconsults.com\nCanonical: https://www.venoaconsults.com/.well-known/security.txt\n', 'utf8');
  await writeFile('dist/404.html', '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Venoa Consults — Page not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#061B27;color:#F4EEE5;font-family:system-ui}.x{text-align:center;padding:32px}a{color:#F4EEE5}</style><div class="x"><h1>404</h1><p>This page does not exist.</p><a href="/">Return to Venoa Consults</a></div>', 'utf8');
  console.log(`VCS V4 source integrity verified: ${hash}`);
  console.log(`Built production HTML: ${html.length} characters`);
}

main().catch((err) => { console.error(err); process.exit(1); });
