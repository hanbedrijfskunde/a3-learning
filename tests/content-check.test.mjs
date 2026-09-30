import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleerLeerblok, controleerMap } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = (naam) => resolve(root, 'tests/fixtures', naam);
const draai = (map) => spawnSync(process.execPath, [resolve(root, 'tools/content-check.mjs'), ...(map ? [map] : [])], { encoding: 'utf8' });

test('QA-3: een volledige fixture geeft 0 fouten', () => {
  const { bestanden, fouten } = controleerMap(fixtures('content-goed'));
  assert.equal(bestanden, 1);
  assert.deepEqual(fouten, []);
});

test('QA-3: vier ontbrekende onderdelen (LUK, klaar als, controle, modelantwoord) geven vier fouten met het taaknummer', () => {
  const { fouten } = controleerMap(fixtures('content-vier-fouten'));
  assert.equal(fouten.length, 4, fouten.join('\n'));
});

test('QA-3: elke fout noemt de taak', () => {
  const { fouten } = controleerMap(fixtures('content-vier-fouten'));
  assert.ok(fouten.some((f) => f.includes('taak 2.1') && f.includes('LUK-koppeling')));
  assert.ok(fouten.some((f) => f.includes('taak 2.2') && f.includes('klaar als')));
  assert.ok(fouten.some((f) => f.includes('taak 3.1') && f.includes('controle')));
  assert.ok(fouten.some((f) => f.includes('taak 3.2') && f.includes('modelantwoord')));
});

test('QA-3: het commando faalt (exit 1) op de fixture met fouten en noemt de taken', () => {
  const r = draai(fixtures('content-vier-fouten'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /taak 2\.2 mist een „klaar als"/);
});

test('QA-3: het commando slaagt (exit 0) op de volledige fixture en op de lege data/', () => {
  assert.equal(draai(fixtures('content-goed')).status, 0);
  assert.equal(draai().status, 0);
});

test('BW-12: een bewijsonderdeel zonder LUK-onderdeel geeft een fout', () => {
  const inhoud = {
    taken: [{ id: '2.1', luk: [1], bc: ['BC1'], klaarAls: 'x', modelantwoord: 'y', controles: [{ id: 'a', soort: 'A' }] }],
    bewijsonderdelen: [{ id: 'EV-01', taak: '2.1', lukOnderdelen: [] }],
  };
  const fouten = controleerLeerblok(inhoud, 'leerblok-1.json');
  assert.equal(fouten.length, 1);
  assert.match(fouten[0], /EV-01 mist een LUK-onderdeel/);
});

test('BW-12: een bewijsonderdeel dat naar een onbekende taak verwijst geeft een fout', () => {
  const inhoud = {
    taken: [{ id: '2.1', luk: [1], bc: ['BC1'], klaarAls: 'x', modelantwoord: 'y', controles: [{ id: 'a', soort: 'A' }] }],
    bewijsonderdelen: [{ id: 'EV-01', taak: '9.9', lukOnderdelen: ['LUK 1'] }],
  };
  assert.match(controleerLeerblok(inhoud, 'b.json')[0], /onbekende taak 9\.9/);
});

test('QA-3: een bestand zonder taken of met kapotte JSON valt op', () => {
  assert.equal(controleerLeerblok({}, 'leerblok-2.json').length, 1);
});

// ------------------------------------------------------------ fase 2: formaat 1.0, bronnen en waarschuwingen

import { controleerFormaat, controleerOverzicht } from '../tools/content-check.mjs';

const echt = () => JSON.parse(readFileSync(resolve(root, 'data/leerblok-1.json'), 'utf8'));
const overzicht = () => JSON.parse(readFileSync(resolve(root, 'data/leerblokken.json'), 'utf8'));
const taakVan = (blok, id) => blok.taken.find((t) => t.id === id);

test('QA-1/QA-3: data/leerblok-1.json en data/leerblokken.json geven 0 fouten (formaat 1.0, 3 taken)', () => {
  const { fouten } = controleerMap(resolve(root, 'data'));
  assert.deepEqual(fouten, []);
  assert.equal(echt().taken.length, 3);
});

test('werkboekteksten geven geen waarschuwing; teksten van de bouwer wel, met taak en veld in de melding', () => {
  const goed = controleerMap(fixtures('content-goed'));
  assert.deepEqual(goed.waarschuwingen, []);
  const concept = controleerMap(fixtures('content-concept'));
  assert.equal(concept.fouten.length, 0);
  assert.equal(concept.waarschuwingen.length, 1);
  assert.match(concept.waarschuwingen[0], /taak 2\.1: klaarAls is een concept van de bouwer/);
  const echtBlok = controleerFormaat(echt(), 'leerblok-1.json');
  assert.ok(echtBlok.waarschuwingen.some((w) => /taak 1\.1: klaarAls is een concept/.test(w)));
  assert.ok(echtBlok.waarschuwingen.some((w) => /taak 2\.2: klaarAls is een concept/.test(w)));
  assert.ok(!echtBlok.waarschuwingen.some((w) => /taak 2\.1: klaarAls/.test(w))); // die staat in het werkboek
});

test('bron concept-auteur: het commando geeft een WAARSCHUWING en exit 0, geen fout', () => {
  const r = draai(fixtures('content-concept'));
  assert.equal(r.status, 0);
  assert.match(r.stderr, /WAARSCHUWING leerblok-1\.json: taak 2\.1: klaarAls/);
  assert.match(r.stdout, /1 waarschuwingen/);
});

test('formaat: een onbekende bron is een fout, geen waarschuwing', () => {
  const b = echt();
  taakVan(b, '2.1').waarom.bron = 'ergens';
  const { fouten } = controleerFormaat(b, 'leerblok-1.json');
  assert.equal(fouten.length, 1);
  assert.match(fouten[0], /taak 2\.1: waarom heeft bron "ergens"/);
});

test('formaat: ontbrekend waarom, verdieping of formaatnummer is een fout (TK-2, TK-13)', () => {
  const a = echt(); delete taakVan(a, '2.2').waarom;
  assert.match(controleerFormaat(a, 'leerblok-1.json').fouten.join('\n'), /taak 2\.2: mist een waarom/);
  const b = echt(); delete b.verdieping;
  assert.match(controleerFormaat(b, 'leerblok-1.json').fouten.join('\n'), /mist een verdieping/);
  const c = echt(); c.formaat = '0.9';
  assert.match(controleerFormaat(c, 'leerblok-1.json').fouten.join('\n'), /formaat moet "1\.0" zijn/);
});

test('formaat: een controle met onbekend type, onbekend veld of foute parameters wordt gemeld', () => {
  const a = echt(); taakVan(a, '2.1').controles[0].type = 'bestaatNiet';
  assert.match(controleerFormaat(a, 'leerblok-1.json').fouten.join('\n'), /onbekend type bestaatNiet/);
  const b = echt(); taakVan(b, '2.1').controles[0].veld = 'nietBestaand';
  assert.match(controleerFormaat(b, 'leerblok-1.json').fouten.join('\n'), /verwijst naar onbekend veld nietBestaand/);
  const c = echt(); taakVan(c, '2.1').controles[0].soort = 'C'; // minWoordenAanwezig is soort A
  assert.match(controleerFormaat(c, 'leerblok-1.json').fouten.join('\n'), /werkt niet/);
});

test('formaat: modelantwoord voor een onbekend veld, of een bewijsonderdeel dat niet bij de taak past, wordt gemeld', () => {
  const a = echt(); taakVan(a, '2.1').modelantwoord.velden.spook = 'x';
  assert.match(controleerFormaat(a, 'leerblok-1.json').fouten.join('\n'), /onbekend veld spook/);
  const b = echt(); taakVan(b, '2.1').bewijsonderdeel = 'EV-02';
  assert.match(controleerFormaat(b, 'leerblok-1.json').fouten.join('\n'), /bewijsonderdeel EV-02 staat niet bij deze taak/);
});

test('formaat: de vier fouten van QA-3 worden niet dubbel gemeld door de formaatcontrole', () => {
  const { fouten } = controleerMap(fixtures('content-vier-fouten'));
  assert.equal(fouten.length, 4);
});

test('LB-1/ST-1/ST-2: het overzicht heeft 4 leerblokken van 45 min, precies de vier startvelden en een privacytekst van ≤ 100 woorden', () => {
  assert.deepEqual(controleerOverzicht(overzicht()), []);
  const a = overzicht(); a.leerblokken.pop();
  assert.match(controleerOverzicht(a).join('\n'), /moet 4 leerblokken hebben/);
  const b = overzicht(); b.start.velden.push({ id: 'email', label: 'E-mail', type: 'tekst' });
  assert.match(controleerOverzicht(b).join('\n'), /precies alias, teamnummer/);
  const c = overzicht(); c.start.privacytekst = Array(101).fill('woord').join(' ');
  assert.match(controleerOverzicht(c).join('\n'), /1 tot en met 100 woorden/);
});

test('SX-11: een lang veld zonder zinstarter, of met een zinstarter uit het modelantwoord, is een fout', () => {
  const inhoud = JSON.parse(readFileSync(resolve(fixtures('content-goed'), 'leerblok-1.json'), 'utf8'));
  assert.deepEqual(controleerFormaat(inhoud, 'leerblok-1.json').fouten, []);
  const taak = inhoud.taken.find((t) => t.toepassing.velden.some((v) => v.type === 'lang'));
  const veld = taak.toepassing.velden.find((v) => v.type === 'lang');
  delete veld.zinstarter;
  assert.ok(controleerFormaat(inhoud, 'leerblok-1.json').fouten.some((f) => f.includes(`veld ${veld.id}`) && f.includes('SX-11')));
  const langste = [...JSON.stringify(taak.modelantwoord).matchAll(/"([^"]*)"/g)].map((m) => m[1]).sort((x, y) => y.length - x.length)[0];
  veld.zinstarter = `${langste.slice(0, 30)} …`;
  assert.ok(controleerFormaat(inhoud, 'leerblok-1.json').fouten.some((f) => f.includes('staat in het modelantwoord')), veld.zinstarter);
});
