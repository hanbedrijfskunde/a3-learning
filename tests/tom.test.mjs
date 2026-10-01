// Het TOM-bord van taak 8.1 (LB-11, SX-15, ADR B98): de regels in tom.js, de celteksten in data/tom.json, de oefening met
// signalen en het laden pas in beeld (PF-4). Het gedrag in de browser (tikken, toetsenbord, 360 px) is met Playwright gecontroleerd.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CELLEN, cel, boven, buren, perLaag, kijktips, vergelijk, tomTekst } from '../js/tom.js';
import { controleerTom, controleerFormaat, TOM_LABELS } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const tom = () => JSON.parse(lees('data/tom.json'));
const blok3 = () => JSON.parse(lees('data/leerblok-3.json'));
const taak81 = () => blok3().taken.find((t) => t.id === '8.1');

test('LB-11: twaalf cellen in leesvolgorde, elk met code, label en veld; code en label wijzen naar dezelfde cel', () => {
  assert.equal(CELLEN.length, 12);
  assert.deepEqual(CELLEN.map((c) => c.code).join(' '), 'S1 S2 S3 S4 T1 T2 T3 T4 O1 O2 O3 O4');
  assert.deepEqual(CELLEN.map((c) => c.label), TOM_LABELS);
  assert.equal(cel('T2'), cel('Tactisch · Mens'));
  assert.equal(cel('tactisch · mens'), cel('T2'), 'hoofdletters maken niet uit');
  assert.equal(cel('Zachman · Wie'), null);
});

test('ADR B98: de twee kijkrichtingen: omhoog de cel erboven (niets in de bovenste laag), opzij de drie buren in dezelfde laag', () => {
  assert.equal(boven(cel('O1')), cel('T1'));
  assert.equal(boven(cel('T4')), cel('S4'));
  assert.equal(boven(cel('S3')), null);
  assert.deepEqual(buren(cel('T2')).map((c) => c.code), ['T1', 'T3', 'T4']);
});

test('ADR B98: telling per laag en tekstweergave tellen alleen gevulde cellen; geen score of index (X-13)', () => {
  const w = { tomT1: 'Geen norm', tomT3: ' ', tomO4: 'Per zending gelogd', tomS4: '' };
  assert.deepEqual(perLaag(w), { Strategisch: 0, Tactisch: 1, Operationeel: 1 });
  assert.deepEqual(tomTekst(w), ['Tactisch · Methode: Geen norm', 'Operationeel · Informatie & Rapportage: Per zending gelogd']);
  assert.doesNotMatch(lees('js/tom.js') + lees('js/tombord.js'), /HCI|VTI|gewicht|weight|Math\.sqrt/, 'geen gewogen score of spreidingsindex');
});

test('ADR B98: kijktips wijzen op omhoog, opzij, de vierde kolom en het niveau; hoogstens twee tegelijk', () => {
  assert.match(kijktips({})[0], /Begin bij de cel waar je het vraagstuk ziet/);
  assert.match(kijktips({ tomO1: 'a', tomO2: 'b' }).join(' '), /Kijk omhoog/);
  assert.match(kijktips({ tomT1: 'a', tomO1: 'b' }).join(' '), /vierde kolom is nog leeg/);
  assert.match(kijktips({ tomT1: 'a', tomO1: 'b', tomS1: 'c' }).join(' '), /Kijk opzij/);
  assert.match(kijktips({ tomO4: 'a' }, 'strategisch')[0], /Je kiest strategisch, maar op die laag staat nog niets/);
  assert.deepEqual(kijktips({ tomT1: 'a', tomT2: 'b', tomO4: 'c' }, 'tactisch'), []);
  assert.ok(kijktips({ tomO1: 'a', tomO1b: 'x', tomO2: 'b' }, 'strategisch').length <= 2);
});

test('ADR B98: een plaatsing naast het model: zelfde cel, goede laag, goede kolom, anders of open', () => {
  assert.equal(vergelijk('Tactisch · Mens', 'Tactisch · Mens'), 'goed');
  assert.equal(vergelijk('Tactisch · Methode', 'Tactisch · Mens'), 'laag');
  assert.equal(vergelijk('Operationeel · Mens', 'Tactisch · Mens'), 'kolom');
  assert.equal(vergelijk('Strategisch · Machine', 'Tactisch · Mens'), 'anders');
  assert.equal(vergelijk('', 'Tactisch · Mens'), 'open');
});

test('QA-1: data/tom.json heeft per cel een naam, een vraag en minstens twee dingen om naar te kijken; de controle vangt een lege cel', () => {
  const d = tom();
  assert.deepEqual(controleerTom(d).fouten, []);
  assert.deepEqual(Object.keys(d.cellen), CELLEN.map((c) => c.code));
  delete d.cellen.T2.vraag;
  d.cellen.X9 = { naam: 'x', vraag: 'y', kijk: ['a', 'b'] };
  const f = controleerTom(d).fouten.join('\n');
  assert.match(f, /cel T2 mist een naam of een vraag/);
  assert.match(f, /cel X9 bestaat niet/);
});

test('ADR B98: de oefening zet zeven signalen van webshop X op het bord; het model plaatst er drie op de werkvloer en de oorzaken hoger, en kiest tactisch', () => {
  const t = taak81();
  const signalen = t.oefening.weergave.groepen.find((g) => g.tombord)?.tombord.signalen;
  assert.equal(signalen.length, 7);
  const m = t.modelantwoord.velden;
  for (const id of signalen) assert.ok(TOM_LABELS.includes(m[id]), `${id}: ${m[id]}`);
  const per = (laag) => signalen.filter((id) => m[id].startsWith(laag)).length;
  assert.deepEqual([per('Strategisch'), per('Tactisch'), per('Operationeel')], [1, 3, 3]);
  assert.equal(m.niveau, 'tactisch');
  assert.match(t.modelantwoord.tekst, /omhoog/, 'het model leest het bord van onder naar boven');
  // de signalen staan niet op volgorde van laag: de student moet zelf sorteren
  assert.notDeepEqual(signalen.map((id) => m[id]), [...signalen.map((id) => m[id])].sort());
});

test('ADR B98 (sabotage): een signaal dat niet in de oefening staat of een modelcel die niet bestaat, is een fout', () => {
  const b = blok3();
  const t = b.taken.find((x) => x.id === '8.1');
  t.oefening.weergave.groepen[0].tombord.signalen.push('sig9');
  t.modelantwoord.velden.sig1 = 'Tactisch · Geld';
  const f = controleerFormaat(b, 'leerblok-3.json').fouten.join('\n');
  assert.match(f, /noemt signaal sig9, maar dat veld staat niet in de oefening/);
  assert.match(f, /zet sig1 in „Tactisch · Geld”; dat is geen cel/);
});

test('PF-4 (ADR B98): het TOM-bord laadt pas in beeld; de eerste lading van leerblok 3 telt tombord.js, tom.js, tombord.css en tom.json niet', async () => {
  const later = lees('js/tom-later.js');
  assert.match(later, /\/\/ gewicht-alleen: inbeeld\n\s+belofte \?\?= import\('\.\/tombord\.js'\)/);
  assert.match(later, /new IntersectionObserver/);
  assert.match(lees('tools/gewicht-check.mjs'), /naam === 'inbeeld'\) return false/);
  const { paginaBestanden } = await import('../tools/gewicht-check.mjs');
  const namen = paginaBestanden(root, 'leerblok-3.html').map((f) => f.slice(root.length + 1));
  for (const n of ['js/tombord.js', 'js/tom.js', 'css/tombord.css', 'data/tom.json']) assert.ok(!namen.includes(n), n);
  assert.ok(namen.includes('js/tom-later.js'));
  assert.doesNotMatch(lees('css/site.css'), /\.tom-|\.tm-raster/, 'de opmaak van het bord staat niet in site.css');
});
