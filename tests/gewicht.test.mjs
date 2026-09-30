import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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

test('PF-4: een dynamische import met „gewicht-alleen: wissel” telt alleen mee voor een leerblok met een wissel of feedbacklog; „vorig” telt alleen het vorige leerblok', () => {
  const d = mkdtempSync(resolve(tmpdir(), 'gewicht-'));
  mkdirSync(resolve(d, 'css')); mkdirSync(resolve(d, 'js')); mkdirSync(resolve(d, 'data'));
  writeFileSync(resolve(d, 'css/site.css'), 'body{}');
  writeFileSync(resolve(d, 'js/a.js'), "// gewicht-alleen: wissel\nconst { x } = heeft ? await import('./zwaar.js') : {};\nfetch(`../data/leerblok-${vorig}.json`); fetch(`../data/leerblok-${nummer}.json`);");
  writeFileSync(resolve(d, 'js/zwaar.js'), '// ' + 'x'.repeat(50_000));
  for (const n of [1, 2, 3]) writeFileSync(resolve(d, `data/leerblok-${n}.json`), JSON.stringify({ taken: [{ toepassing: {} }], n }));
  writeFileSync(resolve(d, 'leerblok-3.html'), '<html data-x><body data-leerblok="3"><link rel="stylesheet" href="css/site.css"><script type="module" src="js/a.js"></script></body></html>');
  const zonder = gewichten(d)[0];
  assert.ok(zonder.bytes < 50_000, 'zonder wissel telt zwaar.js niet');
  assert.equal(zonder.bestanden, 5, 'html, css, a.js, leerblok-3.json en alleen leerblok-2.json als vorig leerblok');
  writeFileSync(resolve(d, 'data/leerblok-3.json'), JSON.stringify({ wissel: { leerblok: 4 }, taken: [] }));
  assert.ok(gewichten(d)[0].bytes > 50_000, 'met een wissel telt zwaar.js wel mee');
  writeFileSync(resolve(d, 'data/leerblok-3.json'), JSON.stringify({ taken: [{ toepassing: { component: 'feedbacklog' } }] }));
  assert.ok(gewichten(d)[0].bytes > 50_000, 'met een feedbacklog telt zwaar.js ook mee');
});

test('PF-4: leerblok.js laadt wissel-paneel.js alleen dynamisch en met de voorwaarde die de gewichtscontrole leest', () => {
  const bron = readFileSync(resolve(root, 'js/leerblok.js'), 'utf8');
  assert.doesNotMatch(bron, /^import .* from '\.\/wissel-paneel\.js'/m);
  assert.match(bron, /\/\/ gewicht-alleen: wissel\n.*await import\('\.\/wissel-paneel\.js'\)/);
  assert.match(bron, /const heeftWissel = Boolean\(blok\.wissel\) \|\| blok\.taken\.some\(\(t\) => t\.toepassing\.component === 'feedbacklog'\)/);
});
