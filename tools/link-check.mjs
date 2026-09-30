// Controleert dat alle interne links resolven en dat er geen absolute interne links zijn (SI-3).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fouten = [];

function htmlBestanden(dir) {
  return readdirSync(dir).flatMap((n) => {
    if (['.git', 'node_modules', 'tests'].includes(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? htmlBestanden(p) : p.endsWith('.html') ? [p] : [];
  });
}

const ATTR = /\b(?:href|src)\s*=\s*"([^"]*)"/gi;
for (const bestand of htmlBestanden(root)) {
  const html = readFileSync(bestand, 'utf8');
  for (const [, url] of html.matchAll(ATTR)) {
    const naam = bestand.slice(root.length + 1);
    if (url === '' || url.startsWith('#') || /^(mailto|tel|data|javascript):/i.test(url)) continue;
    if (/^https?:\/\/hanbedrijfskunde\.github\.io/i.test(url) || url.startsWith('/')) {
      fouten.push(`${naam}: absolute interne link ${url}`);
      continue;
    }
    if (/^https?:\/\//i.test(url) || url.startsWith('//')) continue; // extern; DOI/URL-controle: fase 6
    const pad = url.split('#')[0].split('?')[0];
    if (!existsSync(resolve(dirname(bestand), pad))) fouten.push(`${naam}: dode link ${url}`);
  }
}

if (fouten.length) {
  console.error('link-check faalt:\n' + fouten.join('\n'));
  process.exit(1);
}
console.log('link-check: ok');
