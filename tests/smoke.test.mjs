import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
      // Docentmodus en verificatie staan in de voettekst (SX-1); de leerblokken in de lijst die index-pagina.js tekent
      // uit data/leerblokken.json. Beide in 1 klik vanaf de startpagina.
      const index = readFileSync(resolve(root, 'index.html'), 'utf8');
      const lijst = JSON.parse(readFileSync(resolve(root, 'data/leerblokken.json'), 'utf8')).leerblokken.map((b) => b.pagina);
      assert.ok(index.includes(`href="${p}.html"`) || (lijst.includes(`${p}.html`) && index.includes('js/index-pagina.js')), `index linkt niet naar ${p}`);
    }
  });
}

test('LI-4: LICENSE bevat CC BY-SA 4.0', () => {
  assert.match(readFileSync(resolve(root, 'LICENSE'), 'utf8'), /^Attribution-ShareAlike 4\.0 International/);
});

test('TK-6: geen native append met een optionele aanroep (anders staat „undefined" of „null" als tekst op de pagina)', async () => {
  const { readdirSync } = await import('node:fs');
  const bestanden = readdirSync(resolve(root, 'js'), { recursive: true }).filter((f) => f.endsWith('.js'));
  const fout = [];
  for (const f of bestanden) {
    readFileSync(resolve(root, 'js', f), 'utf8').split('\n').forEach((regel, i) => {
      if (/\.append\(/.test(regel) && /\?\.\(/.test(regel)) fout.push(`js/${f}:${i + 1}`);
    });
  }
  assert.deepEqual(fout, [], 'native append zet undefined en null om in tekst; filter ze eerst weg of gebruik h()');
});

test('SX-1: het hoofdmenu heeft 4 items (Start, Leerblokken, Dossier, Bronnen); docentmodus en verificatie staan in de voettekst', () => {
  for (const p of readdirSync(root).filter((n) => n.endsWith('.html'))) {
    const html = readFileSync(resolve(root, p), 'utf8');
    const nav = /<nav aria-label="Hoofdmenu">([\s\S]*?)<\/nav>/.exec(html)[1];
    assert.deepEqual([...nav.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]), ['Start', 'Leerblokken', 'Dossier', 'Bronnen'], p);
    const voet = /<footer>([\s\S]*?)<\/footer>/.exec(html)[1];
    assert.ok(voet.includes('href="docent.html"') && voet.includes('href="verificatie.html"'), `${p}: voettekst mist de docentlinks`);
  }
});
