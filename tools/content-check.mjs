// Contentcontrole (skelet): valideert data/leerblok-*.json en bronnen; nu nog leeg (QA-3, BW-12, BR-5).
import { readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = resolve(root, 'data');
const fouten = [];

const bestanden = existsSync(data) ? readdirSync(data).filter((n) => /^leerblok-\d\.json$/.test(n)) : [];
// Elke fase die data toevoegt breidt hier de controles uit.

if (fouten.length) {
  console.error('content-check faalt:\n' + fouten.join('\n'));
  process.exit(1);
}
console.log(`content-check: ok (${bestanden.length} leerblokbestanden)`);
