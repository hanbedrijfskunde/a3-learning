import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGINAS = ['index', 'leerblok-1', 'leerblok-2', 'leerblok-3', 'leerblok-4', 'dossier', 'verificatie', 'docent'];

for (const p of PAGINAS) {
  test(`SI-1: ${p}.html bestaat, is bereikbaar vanaf index en toont licentievoet`, () => {
    const html = readFileSync(resolve(root, `${p}.html`), 'utf8');
    assert.match(html, /<html lang="nl">/);
    assert.match(html, /CC BY-SA 4\.0/); // LI-5
    assert.match(html, /href="LICENSE"/);
    if (p !== 'index') {
      const index = readFileSync(resolve(root, 'index.html'), 'utf8');
      assert.ok(index.includes(`href="${p}.html"`), `index linkt niet naar ${p}`);
    }
  });
}

test('LI-4: LICENSE bevat CC BY-SA 4.0', () => {
  assert.match(readFileSync(resolve(root, 'LICENSE'), 'utf8'), /^Attribution-ShareAlike 4\.0 International/);
});
