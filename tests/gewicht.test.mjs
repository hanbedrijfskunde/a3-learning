import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { GRENS, GRENS_BRON, externeBronnen, gewichten } from '../tools/gewicht-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('PF-4: elke pagina laadt ≤ 300 kB gecomprimeerd en ≤ 500 kB ongecomprimeerd (ADR B99) (zonder video), 100 % van de pagina\'s', () => {
  const lijst = gewichten(root);
  assert.ok(lijst.length >= 10, 'te weinig pagina\'s gemeten');
  assert.equal(GRENS, 300_000);
  assert.equal(GRENS_BRON, 500_000);
  for (const g of lijst) {
    assert.ok(g.gzip <= GRENS, `${g.pagina}: ${g.gzip} bytes gzip > ${GRENS}`);
    assert.ok(g.bytes <= GRENS_BRON, `${g.pagina}: ${g.bytes} bytes > ${GRENS_BRON}`);
  }
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
  assert.ok(klein.gzip < GRENS && klein.bytes < GRENS_BRON);
  assert.equal(klein.bestanden, 5, 'html, css, twee modules en het databestand horen erbij');
  // niet te comprimeren inhoud: de gzip-grootte is dan ongeveer de bronomvang
  const onsamendrukbaar = gewichten(proefsite(randomBytes(GRENS + 20_000).toString('latin1')))[0];
  assert.ok(onsamendrukbaar.gzip > GRENS, `gzip ${onsamendrukbaar.gzip}`);
});

test('PF-4 (sabotage): herhalende inhoud comprimeert klein, maar de grens op de bronomvang houdt haar tegen', () => {
  const herhaald = gewichten(proefsite(`"${'x'.repeat(GRENS_BRON)}"`))[0];
  assert.ok(herhaald.gzip < GRENS, 'gzip ziet er goed uit');
  assert.ok(herhaald.bytes > GRENS_BRON, 'de bronomvang is te groot');
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

test('PF-4: leerblok.js laadt de Wissel, de weergavegroepen en de controlefabrieken alleen dynamisch en met de voorwaarde die de gewichtscontrole leest', () => {
  const bron = readFileSync(resolve(root, 'js/leerblok.js'), 'utf8');
  assert.doesNotMatch(bron, /^import .* from '\.\/(wissel|wissel-paneel|lb2-ui|lb4-ui)\.js'/m);
  assert.doesNotMatch(bron, /from '\.\/checks\/(index|lb\d)\.js'/);
  assert.match(bron, /\/\/ gewicht-alleen: wissel\n.*await Promise\.all\(\[import\('\.\/wissel\.js'\), import\('\.\/wissel-paneel\.js'\)\]\)/);
  assert.match(bron, /\/\/ gewicht-alleen: weergave\n.*await import\('\.\/lb2-ui\.js'\)/);
  assert.match(bron, /const heeftWissel = Boolean\(blok\.wissel\) \|\| blok\.taken\.some\(\(t\) => t\.toepassing\.component === 'feedbacklog'\)/);
  assert.match(bron, /await laadControles\(\[blok\.leerblok, blok\.wissel\?\.leerblok\]\)/);
});

function proefsiteMetControles(paginaTekst, blokken = {}) {
  const d = mkdtempSync(resolve(tmpdir(), 'gewicht-'));
  for (const m of ['css', 'js', 'js/checks', 'data']) mkdirSync(resolve(d, m));
  writeFileSync(resolve(d, 'css/site.css'), 'body{}');
  writeFileSync(resolve(d, 'js/a.js'), "import './checks/register.js';\n// gewicht-alleen: lb4ui\nconst ui = heeft ? await import('./ui.js') : {};");
  writeFileSync(resolve(d, 'js/ui.js'), '// ' + 'u'.repeat(40_000));
  writeFileSync(resolve(d, 'js/checks/register.js'), 'export const laad = (n) => import(`./lb${n}.js`);');
  for (const n of [1, 2, 3, 4]) writeFileSync(resolve(d, `js/checks/lb${n}.js`), '// ' + 'x'.repeat(30_000));
  for (const [n, b] of Object.entries(blokken)) writeFileSync(resolve(d, `data/leerblok-${n}.json`), JSON.stringify(b));
  writeFileSync(resolve(d, 'pagina.html'), paginaTekst);
  return d;
}
const pagina = (nr) => `<html><body${nr ? ` data-leerblok="${nr}"` : ''}><link rel="stylesheet" href="css/site.css"><script type="module" src="js/a.js"></script></body></html>`;

test('PF-4: een dynamische import met een sjabloon telt alleen de controlemodules van het eigen leerblok, van de Wissel en wat die nodig hebben', () => {
  const blokken = { 2: { taken: [] }, 3: { taken: [], wissel: { leerblok: 4 } }, 4: { taken: [] } };
  const eigen = gewichten(proefsiteMetControles(pagina(4), blokken))[0];
  assert.ok(eigen.bytes > 30_000 && eigen.bytes < 60_000, `alleen lb4: ${eigen.bytes}`);
  const metLb1 = gewichten(proefsiteMetControles(pagina(2), blokken))[0];
  assert.ok(metLb1.bytes > 60_000 && metLb1.bytes < 90_000, `leerblok 2 gebruikt lb1 en lb2: ${metLb1.bytes}`);
  const metWissel = gewichten(proefsiteMetControles(pagina(3), blokken))[0];
  assert.ok(metWissel.bytes > 90_000 && metWissel.bytes < 120_000, `leerblok 3 met wissel 4: lb1, lb3 en lb4: ${metWissel.bytes}`);
  const zonderLeerblok = gewichten(proefsiteMetControles(pagina(null), blokken))[0];
  assert.ok(zonderLeerblok.bytes > 120_000, `zonder leerblok telt alles (bovengrens): ${zonderLeerblok.bytes}`);
});

test('PF-4: de voorwaarde lb4ui telt de verbanden-kaart en het STARR-sjabloon alleen voor een leerblok met zo\'n taak', () => {
  const zonder = gewichten(proefsiteMetControles(pagina(4), { 4: { taken: [{ toepassing: {} }] } }))[0];
  const met = gewichten(proefsiteMetControles(pagina(4), { 4: { taken: [{ toepassing: { component: 'verbanden' } }] } }))[0];
  const starr = gewichten(proefsiteMetControles(pagina(4), { 4: { taken: [{ toepassing: { component: 'starr' } }] } }))[0];
  assert.ok(met.bytes - zonder.bytes >= 40_000);
  assert.ok(starr.bytes - zonder.bytes >= 40_000);
});

test('PF-4: het register laadt controlemodules niet statisch, en de gewichtscontrole meldt ook de gzip-grootte', () => {
  assert.doesNotMatch(readFileSync(resolve(root, 'js/checks/register.js'), 'utf8'), /^import\b[^\n]*'\.\/lb\d\.js'/m);
  assert.match(readFileSync(resolve(root, 'js/checks/register.js'), 'utf8'), /import\(`\.\/lb\$\{n\}\.js`\)/);
  const g = gewichten(root).find((x) => x.pagina === 'leerblok-1.html');
  assert.ok(g.gzip > 0 && g.gzip < g.bytes / 2, 'gzip is kleiner dan de helft van de bronbytes');
});

test('PF-4: een dynamische import met „gewicht-alleen: naklik” telt nooit mee in de eerste lading (spel, kopieer naar A3; ADR B81)', () => {
  const d = mkdtempSync(resolve(tmpdir(), 'gewicht-'));
  mkdirSync(resolve(d, 'js'));
  writeFileSync(resolve(d, 'index.html'), '<!doctype html><script type="module" src="js/a.js"></script>');
  writeFileSync(resolve(d, 'js/zwaar.js'), `export const x = "${'y'.repeat(60_000)}";`);
  writeFileSync(resolve(d, 'js/a.js'), "knop.onclick = async () => {\n  // gewicht-alleen: naklik\n  await import('./zwaar.js');\n};");
  assert.ok(gewichten(d)[0].bytes < 10_000, 'na een klik geladen: telt niet mee');
  writeFileSync(resolve(d, 'js/a.js'), "knop.onclick = async () => {\n  await import('./zwaar.js');\n};");
  assert.ok(gewichten(d)[0].bytes > 50_000, 'zonder de aanduiding telt de import wel mee');
});
