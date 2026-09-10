import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

async function main() {
  const source = await readFile('index.html', 'utf8');
  if (!source.startsWith('<!doctype html>') || !source.includes('Venoa Consults') || !source.includes('vcs-v4-motion-engine')) {
    throw new Error('VCS V4 production HTML integrity markers failed.');
  }
  if (source.includes('VCS deployment connection test') || source.includes('DecompressionStream') || source.includes('atob(')) {
    throw new Error('Unsafe/test deployment marker detected in production HTML.');
  }

  await mkdir('dist/.well-known', { recursive: true });
  await copyFile('index.html', 'dist/index.html');
  await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://www.venoaconsults.com/sitemap.xml\n', 'utf8');
  await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.venoaconsults.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n', 'utf8');
  await writeFile('dist/.well-known/security.txt', 'Contact: mailto:info@venoaconsults.com\nCanonical: https://www.venoaconsults.com/.well-known/security.txt\n', 'utf8');
  await writeFile('dist/404.html', '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Venoa Consults — Page not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#061B27;color:#F4EEE5;font-family:system-ui}.x{text-align:center;padding:32px}a{color:#F4EEE5}</style><div class="x"><h1>404</h1><p>This page does not exist.</p><a href="/">Return to Venoa Consults</a></div>', 'utf8');

  const hash = createHash('sha256').update(source).digest('hex');
  console.log(`VCS V4 static production build complete: ${hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
