import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRENS, externeBronnen, gewichten } from '../tools/gewicht-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('PF-4: elke pagina laadt ≤ 300 kB (zonder video), 100 % van de pagina\'s', () => {
  const lijst = gewichten(root);
  assert.ok(lijst.length >= 10, 'te weinig pagina\'s gemeten');
  for (const g of lijst) assert.ok(g.bytes <= GRENS, `${g.pagina}: ${g.bytes} bytes > ${GRENS}`);
  assert.ok(lijst.every((g) => g.bestanden >= 3), 'een pagina lijkt zonder css en scripts gemeten');
});

test('PF-4: 0 afbeeldingen, scripts, stylesheets of lettertypen van een ander domein', () => {
  assert.deepEqual(externeBronnen(root), []);
});

function proefsite(extra) {
  const d = mkdtempSync(resolve(tmpdir(), 'gewicht-'));
  mkdirSync(resolve(d, 'css')); mkdirSync(resolve(d, 'js')); mkdirSync(resolve(d, 'data'));
  writeFileSync(resolve(d, 'css/site.css'), 'body{}');
  writeFileSync(resolve(d, 'js/a.js'), "import './b.js'; fetch('../data/x.json');");
  writeFileSync(resolve(d, 'js/b.js'), '// klein');
  writeFileSync(resolve(d, 'data/x.json'), extra ?? '{}');
  writeFileSync(resolve(d, 'index.html'), '<html><link rel="stylesheet" href="css/site.css"><script type="module" src="js/a.js"></script></html>');
  return d;
}

test('PF-4 (sabotage): een pagina met een groot databestand faalt de gewichtsgrens', () => {
  const klein = gewichten(proefsite())[0];
  assert.ok(klein.bytes < GRENS);
  assert.equal(klein.bestanden, 5, 'html, css, twee modules en het databestand horen erbij');
  const groot = gewichten(proefsite(`"${'x'.repeat(GRENS)}"`))[0];
  assert.ok(groot.bytes > GRENS);
});

test('PF-4 (sabotage): een extern lettertype of een afbeelding van derden wordt gevonden', () => {
  const d = proefsite();
  writeFileSync(resolve(d, 'css/site.css'), "@import url('https://fonts.googleapis.com/css2?family=X'); a{background:url(https://cdn.example/x.png)}");
  writeFileSync(resolve(d, 'index.html'), '<html><img src="https://derde.example/a.png"><script src="https://cdn.example/x.js"></script></html>');
  assert.ok(externeBronnen(d).length >= 3);
});
