import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const SOURCE = 'https://venoa-consults-v4-preview-egjuelcl7-veona-consults-projects.vercel.app/';
const EXPECTED_SHA256 = '7560d9da1973ee5a8b8aab1845189215819408cc7d562294b3a4abc0904f426c';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('hex');
}

async function main() {
  const response = await fetch(SOURCE, {
    redirect: 'follow',
    headers: { 'user-agent': 'VCS-Vercel-Build/4.0' }
  });
  if (!response.ok) throw new Error(`Unable to fetch V4 source deployment: HTTP ${response.status}`);

  const loader = await response.text();
  const match = loader.match(/const\s+b\s*=\s*'([^']+)'/s);
  if (!match) throw new Error('V4 source payload not found in immutable deployment. Build intentionally stopped.');

  const cleanBase64 = match[1].replace(/[^A-Za-z0-9+/=]/g, '');
  const compressed = Buffer.from(cleanBase64, 'base64');
  let html = gunzipSync(compressed).toString('utf8');

  if (!html.startsWith('<!doctype html>') || !html.includes('Venoa Consults') || !html.includes('vcs-v4-motion-engine')) {
    throw new Error('Decoded V4 source failed integrity markers. Build intentionally stopped.');
  }

  const hash = await sha256(html);
  if (hash !== EXPECTED_SHA256) {
    throw new Error(`V4 source integrity mismatch. Expected ${EXPECTED_SHA256}, got ${hash}`);
  }

  // Production-safe presentation cleanup. This does not alter the V4 application logic.
  html = html
    .replaceAll('Venoa Consults — Interactive Preview V4', 'Venoa Consults — Influence. Distribution. Growth.')
    .replaceAll('Interactive Preview V4', 'Venoa Consults Platform')
    .replaceAll('VCS Preview Mode', 'VCS Platform')
    .replaceAll('Preview backend', 'Platform demo data layer')
    .replaceAll('PREVIEW_SENT', 'QUEUED');

  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', html, 'utf8');
  await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n', 'utf8');
  await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n', 'utf8');
  await writeFile('dist/.well-known/security.txt', 'Contact: mailto:info@venoaconsults.com\nCanonical: https://www.venoaconsults.com/.well-known/security.txt\n', 'utf8');

  console.log(`VCS V4 built successfully: ${html.length} characters`);
  console.log(`Source integrity verified: ${hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
