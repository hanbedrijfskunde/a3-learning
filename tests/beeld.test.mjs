// Het A3-vel als figuur in taak 1.1 en de hint bij elke oefenvraag (SX-13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleerFormaat } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const blok = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));

test('Figuur A3-vel: taak 1.1 toont de acht vakken als één vel met plan, do, check, act; eigen weergave met bron (LI-1, BR-4)', () => {
  const t = blok(1).taken.find((x) => x.id === '1.1');
  assert.equal(t.stof.figuur, 'a3-vel');
  assert.match(t.stof.alineas[0], /\(Schwagerman & Ulmer, 2013\)/);
  const dom = lees('js/dom.js');
  for (const [nr, naam] of [[1, 'Aanleiding / achtergrond'], [2, 'Huidige situatie'], [3, 'Doelen'], [4, 'Analyse'], [5, 'Toekomstige situatie'], [6, 'Implementatie'], [7, 'Borging en evaluatie'], [8, 'Next steps']]) {
    assert.ok(dom.includes(`[${nr}, '${naam}'`), `vak ${nr}`);
  }
  for (const f of ['Plan', 'Do', 'Check', 'Act']) assert.ok(dom.includes(`fase: '${f}'`), f);
  assert.match(dom, /h\('figure', \{ class: 'a3-vel' \}/);
  assert.match(dom, /h\('figcaption'/);
  assert.doesNotMatch(lees('js/leerblok.js') + dom, /<img|\.png|\.jpe?g/, 'geen afbeelding van derden');
});

test('SX-13: elke oefenvraag van de vier leerblokken heeft een hint; de hint staat achter een knop (details), niet op mouse-over', () => {
  let n = 0;
  for (const nr of [1, 2, 3, 4]) {
    for (const t of blok(nr).taken) {
      for (const v of t.oefening?.velden ?? t.toepassing.velden) { assert.ok(v.hint?.length > 10, `${t.id} ${v.id}`); n += 1; }
    }
  }
  assert.equal(n, 54);
  const dom = lees('js/dom.js');
  assert.match(dom, /h\('details', \{ class: 'hint' \}, h\('summary', \{\}, 'Hint'\)/);
  assert.doesNotMatch(dom, /onmouse|onpointerenter|interestfor/);
});

test('SX-13 (sabotage): een oefenvraag zonder hint of met een hint die het modelantwoord verklapt, is een fout', () => {
  const b = blok(1);
  const t = b.taken.find((x) => x.id === '1.1');
  delete t.oefening.velden[0].hint;
  t.oefening.velden[1].hint = `Het antwoord: ${t.modelantwoord.velden.pastNiet}`;
  const f = controleerFormaat(b, 'leerblok-1.json').fouten.join('\n');
  assert.match(f, /oefenvraag drieC heeft geen hint/);
  assert.match(f, /de hint bij pastNiet verklapt het modelantwoord/);
});
