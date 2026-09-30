// Fase 17: voortgang zichtbaar (SX-3, SX-4, SX-5, SX-7, SX-9, SX-12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { a3Stand, klaarAlsLijst, stapStand, segmentLabel, STAP_NAMEN, A3_DELEN } from '../js/voortgang.js';
import { controleerFormaat } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const blok = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));

test('SX-12: A3-vak 1 heeft vier delen, één per leerblok; een deel is gevuld als het leerblok is afgerond; geen percentage', () => {
  assert.deepEqual(A3_DELEN.map((d) => d.leerblok), [1, 2, 3, 4]);
  const leeg = a3Stand({});
  assert.equal(leeg.aantal, 0);
  assert.equal(leeg.tekst, '0 van de 4 delen van je A3-vak 1 staan.');
  const twee = a3Stand({ 1: true, 3: true }, 3);
  assert.deepEqual(twee.delen.map((d) => d.gevuld), [true, false, true, false]);
  assert.deepEqual(twee.delen.map((d) => d.nieuw), [false, false, true, false]);
  assert.equal(a3Stand({ 1: true, 2: true, 3: true, 4: true }).tekst, 'Je A3-vak 1 staat.');
  for (const s of [leeg, twee]) assert.doesNotMatch(s.tekst, /%|procent/, 'BW-4: geen percentage');
});

test('SX-5: de checklist vinkt een criterium af als al zijn controles ok zijn; soort C telt ook bij „let op”; zonder controles vinkt de student zelf', () => {
  const taak = { klaarAls: { tekst: 'a en b en c', criteria: [
    { tekst: 'a', controles: ['x', 'y'] }, { tekst: 'b', controles: ['z'] }, { tekst: 'c', controles: [] }] } };
  const u = (id, soort, resultaat) => ({ id, soort, resultaat });
  let l = klaarAlsLijst(taak, [u('x', 'A', 'ok'), u('y', 'A', 'mist'), u('z', 'C', 'let op')]);
  assert.deepEqual(l.map((c) => [c.afgevinkt, c.zelf]), [[false, false], [true, false], [false, true]]);
  l = klaarAlsLijst(taak, [u('x', 'A', 'ok'), u('y', 'B', 'ok'), u('z', 'A', 'let op')], [2]);
  assert.deepEqual(l.map((c) => c.afgevinkt), [true, false, true]);
  assert.deepEqual(klaarAlsLijst(taak, []).map((c) => c.afgevinkt), [false, false, false], 'zonder uitkomsten niets afgevinkt');
});

test('SX-5: elke taak van de vier leerblokken heeft criteria die letterlijk in de „klaar als” staan (TK-2)', () => {
  let n = 0;
  for (const nr of [1, 2, 3, 4]) {
    for (const t of blok(nr).taken) {
      assert.ok(t.klaarAls.criteria.length >= 1, t.id);
      for (const c of t.klaarAls.criteria) assert.ok(t.klaarAls.tekst.includes(c.tekst), `${t.id}: ${c.tekst}`);
      n += 1;
    }
  }
  assert.equal(n, 16);
});

test('SX-5 (sabotage): een criterium dat niet in de regel staat of naar een onbekende controle wijst, is een fout', () => {
  const b = blok(1);
  b.taken[1].klaarAls.criteria[0].tekst = 'iets anders';
  b.taken[1].klaarAls.criteria[1].controles = ['bestaat-niet'];
  const fouten = controleerFormaat(b, 'leerblok-1.json').fouten.join('\n');
  assert.match(fouten, /staat niet letterlijk/);
  assert.match(fouten, /onbekende controle bestaat-niet/);
});

test('SX-4: de segmentbalk heeft vier stappen (TK-18) en een tekstalternatief; eerdere stappen tellen mee als een latere klaar is', () => {
  assert.deepEqual(STAP_NAMEN, ['Waarom', 'Stof', 'Oefenen', 'Toepassen']);
  const begin = stapStand({});
  assert.deepEqual(begin.stappen.map((s) => s.stand), ['actief', 'open', 'open', 'open']);
  assert.equal(segmentLabel(2, 3, begin), 'Taak 2 van 3, stap 1 van 4');
  const geoefend = stapStand({ geoefend: true, oefeningAf: true });
  assert.deepEqual(geoefend.stappen.map((s) => s.stand), ['voltooid', 'voltooid', 'voltooid', 'actief']);
  const klaar = stapStand({ klaar: true });
  assert.ok(klaar.klaar);
  assert.equal(segmentLabel(1, 3, klaar), 'Taak 1 van 3, klaar');
  assert.match(lees('js/leerblok.js'), /segmenten\.setAttribute\('aria-label', segmentLabel\(/);
});

test('SX-3: de studentweergave noemt geen interne codes: samenvattingen zonder EV-nummer, geen code in de tegels of lijsten', () => {
  for (const nr of [1, 2, 3, 4]) assert.doesNotMatch(blok(nr).eindigtMet, /EV-\d/, `leerblok ${nr}`);
  for (const b of JSON.parse(lees('data/leerblokken.json')).leerblokken) assert.doesNotMatch(b.afgerondBewijs, /EV-\d/);
  const index = lees('js/index-pagina.js');
  const leerblok = lees('js/leerblok.js');
  const dossier = lees('js/dossier-pagina.js');
  for (const [naam, bron] of [['index', index], ['leerblok', leerblok]]) assert.doesNotMatch(bron.replace(/^\s*(\/\/|\*).*$/gm, ''), /\$\{o\.id\}|(?<![.\w])[Bb]ewijsonderde(el|len)\b/, naam);
  assert.doesNotMatch(dossier, /dos-tegel-id|\$\{zwakste\.id\}/, 'Mijn stand toont titels, geen codes');
});

// De regels van site.css als [selector, declaraties].
const regels = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

test('SX-7: een harde schaduw staat alleen op iets wat je kunt aantikken; informatieve kaarten hebben geen schaduw', () => {
  const css = lees('css/site.css');
  const tikbaar = /knop|kaart-tik|summary|vb-weg|md-knop|:root/;
  const fout = regels(css).filter(([sel, d]) => /box-shadow\s*:(?![^;]*\binset\b)(?!\s*none)/.test(d) && !tikbaar.test(sel)).map(([sel]) => sel);
  assert.deepEqual(fout, []);
  assert.doesNotMatch(regels(css).find(([sel]) => sel === '.kaart')[1], /box-shadow/);
});

test('SX-9: transities duren 150–250 ms en vervallen bij prefers-reduced-motion', () => {
  const css = lees('css/site.css');
  const duren = [...css.matchAll(/transition:[^;]*?(\d+)ms/g)].map((m) => Number(m[1]));
  assert.ok(duren.length >= 2);
  for (const d of duren) assert.ok(d >= 150 && d <= 250, `${d} ms`);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ transition:none !important;/);
});
