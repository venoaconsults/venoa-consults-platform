import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const EXPECTED_SHA256 = '7560d9da1973ee5a8b8aab1845189215819408cc7d562294b3a4abc0904f426c';

async function main() {
  const parts = [];
  for (let i = 1; i <= 5; i++) parts.push((await readFile(`v4/chunk${i}.txt`, 'utf8')).trim());
  const base64 = parts.join('');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('V4 source bundle contains invalid Base64 characters.');

  const source = gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== EXPECTED_SHA256) throw new Error(`V4 source integrity mismatch: ${hash}`);
  if (!source.startsWith('<!doctype html>') || !source.includes('Venoa Consults') || !source.includes('vcs-v4-motion-engine')) {
    throw new Error('V4 source integrity markers failed.');
  }

  let html = source;
  html = html.replace('<title>Venoa Consults — Interactive Preview V4</title>', '<title>Venoa Consults — Influence. Distribution. Growth.</title>');
  html = html.replace(/\n\s*<div class="preview-strip">[\s\S]*?<\/div>\s*<\/div>\s*\n\s*<header class="site-header"/, '\n\n  <header class="site-header"');
  html = html.replace('aria-label="Preview areas"', 'aria-label="Platform areas"');
  html = html.replace('Nothing is fabricated in this preview.', 'Only brands added by VCS are displayed here.');
  html = html.replace('register an account, verify it in preview mode, complete the roster application', 'register an account, verify it, complete the roster application');
  html = html.replace('For preview testing, a built-in mock form can be used instead.', 'Campaign application links are controlled by VCS Admin.');
  html = html.replace('The enquiry is saved to the Admin lead database and creates a simulated email notification in this preview.', 'The campaign enquiry is captured through the VCS platform for follow-up by the team.');
  html = html.replace('Interactive preview · local browser backend', 'VCS Platform · Creator & campaign operations');

  const creatorSourcing = '<article class="service-card reveal tilt-card"><span>04</span><h3>Creator Sourcing</h3><p>Targeted sourcing by niche, audience size, location, language and platform to build campaign-specific rosters.</p><button class="inline-link" data-action="service-detail" data-service="Creator Sourcing">Explore service →</button></article>';
  const extraServices = `${creatorSourcing}\n          <article class="service-card reveal tilt-card"><span>05</span><h3>Content Amplification</h3><p>Extend creator-led content through selected distribution channels to increase qualified reach, relevance and campaign visibility.</p><button class="inline-link" data-action="service-detail" data-service="Content Amplification">Explore service →</button></article>\n          <article class="service-card reveal tilt-card"><span>06</span><h3>Social Media Distribution</h3><p>Structured social distribution across relevant digital pages and channels to strengthen campaign discovery and conversation.</p><button class="inline-link" data-action="service-detail" data-service="Social Media Distribution">Explore service →</button></article>`;
  if (!html.includes(creatorSourcing)) throw new Error('Creator Sourcing service anchor missing.');
  if (!html.includes('Content Amplification</h3>')) html = html.replace(creatorSourcing, extraServices);

  html = html.replace('<h3>Campaign Execution</h3>', '<h3>Campaign Strategy &amp; Execution</h3>');
  html = html.replace('data-service="Campaign Execution"', 'data-service="Campaign Strategy & Execution"');

  const serviceMapAnchor = "'Creator Sourcing':'Campaign-specific creator discovery using the VCS advanced roster.'";
  if (html.includes(serviceMapAnchor) && !html.includes("'Content Amplification':'Extend creator-led content")) {
    html = html.replace(serviceMapAnchor, "'Creator Sourcing':'Campaign-specific creator discovery using the VCS advanced roster.', 'Content Amplification':'Extend creator-led content through selected distribution channels to increase qualified reach and visibility.', 'Social Media Distribution':'Structured distribution across relevant digital pages and social channels.'");
  }
  html = html.replace("'Campaign Execution':'", "'Campaign Strategy & Execution':'");

  const required = [
    'Influence.', 'Distribution.', 'Growth.', 'Instagram verification', 'Advanced roster filters', 'Private commercials',
    'Portfolio Lead Gate', 'Campaign Matching', 'Campaign Applications', 'Digital Page', 'Audit Log', 'Email',
    'Creator Notifications', 'Campaign Brief Builder', 'Mobile', 'Content Amplification', 'Social Media Distribution'
  ];
  for (const marker of required) if (!html.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Required V4 feature marker missing: ${marker}`);
  if (html.includes('VCS deployment connection test') || html.includes('DecompressionStream') || html.includes('atob(')) {
    throw new Error('Test/browser-decompression deployment code detected in production output.');
  }

  await mkdir('dist/.well-known', { recursive: true });
  await writeFile('dist/index.html', html, 'utf8');
  await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n', 'utf8');
  await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n', 'utf8');
  await writeFile('dist/.well-known/security.txt', 'Contact: mailto:info@venoaconsults.com\nCanonical: https://www.venoaconsults.com/.well-known/security.txt\n', 'utf8');
  await writeFile('dist/404.html', '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Venoa Consults — Page not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#061B27;color:#F4EEE5;font-family:system-ui}.x{text-align:center;padding:32px}a{color:#F4EEE5}</style><div class="x"><h1>404</h1><p>This page does not exist.</p><a href="/">Return to Venoa Consults</a></div>', 'utf8');

  const outputHash = createHash('sha256').update(html).digest('hex');
  console.log(`VCS V4 source verified: ${hash}`);
  console.log(`VCS V4 production output: ${outputHash} (${html.length} chars)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
