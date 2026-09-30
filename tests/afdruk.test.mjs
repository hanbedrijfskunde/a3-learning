// Afdruk (fase 14): het werkboek van een deel komt uit dezelfde contentbestanden als de site (DM-12) en de printstijl
// houdt tekst binnen A4 (AC-18, AC-25). Het gedrag in de browser (afdrukvoorbeeld als pdf) staat in de testpoort van het bouwplan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { werkboekModel, leerblokkenVan } from '../js/docent/werkboek.js';
import { klaarAlsVan, taakUit } from '../js/docent/kaarten.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const blokken = Object.fromEntries([1, 2, 3, 4].map((n) => [n, json(`data/leerblok-${n}.json`)]));
const tekstVan = (x) => (typeof x === 'string' ? x : x?.tekst ?? '');
const DELEN = [json('data/docent-deel1.json'), json('data/docent-deel2.json')];

test('DM-12: het werkboek van deel 1 en deel 2 heeft 100 % van de taaknummers en „klaar als”-regels van de leerblokpagina’s van dat deel', () => {
  for (const deel of DELEN) {
    const m = werkboekModel(deel, blokken);
    const verwacht = leerblokkenVan(deel).flatMap((n) => blokken[n].taken);
    assert.ok(verwacht.length > 0, `deel ${deel.deel}: er zijn taken`);
    assert.deepEqual(m.taken.map((t) => t.nummer), verwacht.map((t) => t.id), `deel ${deel.deel}: dezelfde nummers in dezelfde volgorde`);
    for (const t of m.taken) {
      assert.equal(t.klaarAls, tekstVan(taakUit(blokken, t.leerblok, t.nummer).klaarAls), `taak ${t.nummer}: klaar als gelijk aan de site`);
      assert.notEqual(t.klaarAls, '', `taak ${t.nummer}: klaar als is niet leeg`);
    }
  }
});

test('DM-12: de „klaar als” van het werkboek is dezelfde tekst als die van de stapkaart (één bron: de contentbestanden)', () => {
  for (const deel of DELEN) {
    const m = werkboekModel(deel, blokken);
    for (const o of deel.onderdelen.filter((x) => x.taak)) {
      const t = m.taken.find((w) => w.nummer === o.taak && w.leerblok === o.leerblok);
      assert.ok(t, `onderdeel ${o.id}: taak ${o.taak} staat in het werkboek`);
      assert.equal(t.klaarAls, klaarAlsVan(o, blokken));
    }
  }
});

test('DM-12: het werkboek van deel 1 heeft de taken 1.1 tot en met 4.2 en dat van deel 2 de taken van leerblok 3 en 4', () => {
  assert.deepEqual(werkboekModel(DELEN[0], blokken).taken.map((t) => t.nummer), ['1.1', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2']);
  const d2 = werkboekModel(DELEN[1], blokken).taken.map((t) => t.nummer);
  for (const nr of ['5.1', '6.1', '7.1', '8.1', '9.1', '9.2']) assert.ok(d2.includes(nr), `deel 2 heeft taak ${nr}`);
});

test('DM-12: de afdruk komt alleen uit de contentbestanden (geen eigen teksten in werkboek.js)', () => {
  const bron = lees('js/docent/werkboek.js').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(bron, /['"`][A-Za-zÀ-ÿ ,.]{40,}['"`]/, 'geen lange vaste tekst in de code');
  assert.match(lees('js/docent/pagina.js'), /werkboekModel\(deel\(\), blokken\)/);
});

test('AC-18, AC-25: css/print.css zet A4 met marge, breekt lange woorden af en houdt taken en onderdelen bij elkaar', () => {
  const css = lees('css/print.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /@page\s*\{\s*size:\s*A4;\s*margin:\s*15mm/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.wb-taak/);
  assert.match(css, /\.db-onderdeel/);
  assert.match(css, /table-layout:\s*fixed/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'alleen tokens, geen kleurcode (QA-6)');
});
