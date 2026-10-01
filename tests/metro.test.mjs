// Metrokaart van het leerblok (SX-4, SX-18, SX-19; ADR B110; DESIGN §6 Metrokaart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleerFormaat, SPOOR_STAPPEN } from '../tools/content-check.mjs';
import { normaliseerBlok } from '../js/blok.js';
import { leesAdres } from '../js/taakweergave.js';
import { metroModel, laatsteLeerblok, gekozenTak, MEDIA_TAKKEN } from '../js/metro-model.js';
import { controleerContrast, tokensUit, contrast, LIJNEN, MINIMUM_GRAFISCH } from '../tools/contrast-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const ruw = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));
/** Zoals content-check het bestand leest: reeksen velden uitgeschreven. */
const blok = (n) => normaliseerBlok(ruw(n));

test('SX-19: taak 3.2 splitst in route A en B (oefenen en toepassen), taak 4.2 in artikel 1 en 2 (oefenen)', () => {
  const lb2 = ruw(2);
  const t32 = lb2.taken.find((t) => t.id === '3.2');
  assert.deepEqual(t32.spoor, { stappen: ['oefenen', 'toepassen'], veld: 'route',
    takken: [{ waarde: 'A · databank', kort: 'A' }, { waarde: 'B · AI-tool', kort: 'B' }] });
  const t42 = lb2.taken.find((t) => t.id === '4.2');
  assert.deepEqual(t42.spoor, { stappen: ['oefenen'], veld: 'artikel',
    takken: [{ waarde: 'Artikel 1 · Visser & El Amrani', kort: 'Art. 1' }, { waarde: 'Artikel 2 · Bakker & De Vries', kort: 'Art. 2' }] });
  assert.deepEqual(SPOOR_STAPPEN, ['waarom', 'stof', 'oefenen', 'toepassen']);
  for (const n of [1, 2, 3, 4]) assert.deepEqual(controleerFormaat(blok(n), `leerblok-${n}.json`).fouten, [], `leerblok ${n}`);
});

test('SX-19: content-check keurt een spoor met een onbekende stap, een onbekend veld of een tak buiten de opties af', () => {
  const zet = (spoor) => { const b = blok(2); b.taken.find((t) => t.id === '3.2').spoor = spoor; return controleerFormaat(b, 'leerblok-2.json').fouten; };
  const goed = ruw(2).taken.find((t) => t.id === '3.2').spoor;
  assert.match(zet({ ...goed, stappen: ['oefenen', 'pauze'] }).join('\n'), /taak 3\.2: spoor\.stappen/);
  assert.match(zet({ ...goed, veld: 'bestaatniet' }).join('\n'), /taak 3\.2: spoor\.veld bestaatniet bestaat niet/);
  assert.match(zet({ ...goed, takken: [goed.takken[0], { waarde: 'C · bibliotheek', kort: 'C' }] }).join('\n'), /staat niet in de opties van route/);
  assert.match(zet({ ...goed, takken: [goed.takken[0]] }).join('\n'), /spoor heeft 2 of 3 takken/);
  assert.match(zet({ ...goed, takken: [goed.takken[0], { waarde: 'B · AI-tool', kort: 'B-route-lang' }] }).join('\n'), /kort label van hoogstens 6 tekens/);
});

test('SX-18: vier lijnkleuren als token, elk minstens 3:1 tegen wit (WCAG 1.4.11), en in de contrastcontrole', () => {
  const tokens = tokensUit(lees('css/site.css'));
  assert.deepEqual(LIJNEN, ['--lijn-1', '--lijn-2', '--lijn-3', '--lijn-4']);
  assert.equal(MINIMUM_GRAFISCH, 3);
  assert.deepEqual(LIJNEN.map((t) => tokens[t]?.toUpperCase()), ['#E50056', '#0063B2', '#00804A', '#C2410C']);
  for (const t of LIJNEN) assert.ok(contrast(tokens[t], tokens['--wit']) >= 3, t);
  const { paren, fouten } = controleerContrast(root);
  assert.equal(paren.filter((p) => p.minimum === 3).length, 4, 'vier lijnparen met hun eigen minimum');
  assert.deepEqual(fouten, []);
});

/** Opslag zonder browser: meta-sleutels en records (nieuwste per id). */
const nepStore = (meta = {}, records = {}) => ({ getMeta: (k) => meta[k], get: (id) => records[id] });
const alleHaltes = (m) => m.kolommen.flatMap((k) => k.haltes).filter((h) => !h.doorgang);
const hier = (m) => { const h = alleHaltes(m).filter((x) => x.stand === 'hier'); assert.equal(h.length, 1, 'precies één „hier”'); return h[0]; };
const kolom = (m, taak, soort) => m.kolommen.find((k) => k.taak === taak && (!soort || k.soort === soort));

test('SX-18: overzicht van leerblok 2: begin, vijf taken, de verdieping na 4.1 en het eind; „hier” op „Vorige keer”', () => {
  const m = metroModel({ blok: blok(2), store: nepStore(), adres: { soort: 'overzicht' } });
  assert.deepEqual(m.kolommen.map((k) => k.soort === 'taak' ? k.taak : k.soort),
    ['begin', '3.1', '3.2', '4.1', 'verdieping', '4.2', '4.3', 'eind']);
  assert.equal(hier(m).id, 'begin');
  assert.equal(m.kolommen[0].label, 'Vorige keer');
  assert.equal(m.kolommen[0].overstap, 1);
  assert.equal(m.kolommen.at(-1).overstap, 3);
  assert.equal(m.kolommen[0].haltes[0].href, 'leerblok-2.html#overzicht');
  assert.equal(m.kolommen.at(-1).haltes[0].href, 'leerblok-2.html#afsluiten');
  assert.equal(m.tekst, 'Leerblok 2 · Zoeken, beoordelen en gebruiken');
  for (const h of alleHaltes(m)) {
    assert.ok(h.naam && h.href, `${h.id} heeft naam en link`);
    assert.doesNotMatch(h.naam, /EV-\d/, 'SX-3: geen interne codes');
  }
});

test('SX-18: leerblok 1 begint bij „Start” zonder stompje; leerblok 4 eindigt bij „Dossier” zonder stompje', () => {
  const m1 = metroModel({ blok: blok(1), store: nepStore(), adres: { soort: 'overzicht' } });
  assert.equal(m1.kolommen[0].label, 'Start');
  assert.equal(m1.kolommen[0].overstap, null);
  assert.equal(m1.kolommen[0].haltes[0].href, 'index.html');
  const m4 = metroModel({ blok: blok(4), store: nepStore(), adres: { soort: 'afsluiten' } });
  assert.equal(m4.kolommen.at(-1).label, 'Dossier');
  assert.equal(m4.kolommen.at(-1).overstap, null);
  assert.equal(m4.kolommen.at(-1).haltes[0].href, 'dossier.html');
  assert.equal(hier(m4).id, 'eind');
  assert.deepEqual(m4.kolommen.slice(-2).map((k) => k.soort), ['verdieping', 'eind'], 'verdieping na 6.3, de laatste taak');
});

test('SX-4, SX-18: de huidige taak klapt open in vier stap-haltes; „hier” op de stap van het adres', () => {
  const m = metroModel({ blok: blok(2), store: nepStore(), adres: { soort: 'taak', taak: '3.1', stap: 2 } });
  const stappen = m.kolommen.filter((k) => k.soort === 'stap');
  assert.deepEqual(stappen.map((k) => k.label), ['W', 'S', 'O', 'T']);
  assert.ok(stappen.every((k) => k.taak === '3.1'));
  assert.equal(hier(m).id, '3.1-stof');
  assert.equal(stappen[2].haltes[0].href, 'leerblok-2.html#taak-3.1/oefenen');
  assert.equal(m.label, 'Taak 1 van 5, stap 1 van 4');
  assert.equal(m.tekst, 'Leerblok 2 · taak 1 van 5 · stap 2 van 4');
  const zonderStap = metroModel({ blok: blok(2), store: nepStore(), adres: { soort: 'taak', taak: '3.1', stap: null } });
  assert.equal(hier(zonderStap).id, '3.1-waarom', 'zonder stap in het adres: de stap waar de student is');
});

test('SX-19: route A/B in 3.2; zonder keuze beide vol; een keuze in de oefening maakt de andere tak gestippeld; de toepassing gaat voor', () => {
  const b = blok(2);
  let m = metroModel({ blok: b, store: nepStore(), adres: { soort: 'taak', taak: '3.2', stap: 3 } });
  const o = m.kolommen.find((k) => k.taak === '3.2' && k.label === 'O');
  assert.deepEqual(o.haltes.map((h) => [h.label, h.rij, h.gestippeld]), [['A', -1, false], ['B', 1, false]]);
  assert.equal(hier(m).id, '3.2-oefenen-A', 'zonder keuze de ring op de eerste tak');
  assert.equal(o.spoor, m.kolommen.find((k) => k.taak === '3.2' && k.label === 'T').spoor, 'oefenen en toepassen op dezelfde takken');
  m = metroModel({ blok: b, store: nepStore({ 'oefening:3.2': { invoer: { route: 'B · AI-tool' } } }), adres: { soort: 'overzicht' } });
  assert.deepEqual(kolom(m, '3.2').haltes.map((h) => [h.label, h.gestippeld]), [['A', true], ['B', false]]);
  const beide = nepStore({ 'oefening:3.2': { invoer: { route: 'B · AI-tool' } } }, { 'EV-03': { inhoud: { route: 'A · databank' } } });
  assert.equal(gekozenTak(b.taken.find((t) => t.id === '3.2').spoor, { route: 'A · databank' }, { route: 'B · AI-tool' }), 'A · databank');
  m = metroModel({ blok: b, store: beide, adres: { soort: 'overzicht' } });
  assert.deepEqual(kolom(m, '3.2').haltes.map((h) => h.gestippeld), [false, true]);
});

test('SX-19: 4.2 met artikel 2 in de oefening; tekst/video/spel alleen bij de opengeklapte mediataak', () => {
  const b = blok(2);
  let m = metroModel({ blok: b, store: nepStore({ 'oefening:4.2': { invoer: { artikel: 'Artikel 2 · Bakker & De Vries' } } }), adres: { soort: 'overzicht' } });
  assert.deepEqual(kolom(m, '4.2').haltes.map((h) => [h.label, h.gestippeld]), [['Art. 1', true], ['Art. 2', false]]);
  assert.equal(kolom(m, '4.1').haltes.length, 1, 'ingeklapt is de mediataak een gewone halte');
  m = metroModel({ blok: b, store: nepStore({ 'media:route:2': 'video' }), adres: { soort: 'taak', taak: '4.1', stap: 2 } });
  const stof = m.kolommen.find((k) => k.taak === '4.1' && k.label === 'S');
  assert.deepEqual(stof.haltes.map((h) => [h.label, h.rij, h.gestippeld]), [['T', -1, true], ['V', 0, false], ['S', 1, true]]);
  assert.equal(hier(m).id, '4.1-stof-V');
  m = metroModel({ blok: b, store: nepStore({ 'media:route:2': 'podcast' }), adres: { soort: 'taak', taak: '4.1', stap: 2 } });
  assert.equal(hier(m).id, '4.1-stof-T', 'een onbekende route telt als tekst (MD-2)');
  assert.deepEqual(MEDIA_TAKKEN.map((t) => t.waarde), ['tekst', 'video', 'spel']);
  assert.match(lees('js/media.js'), /`media:route:\$\{leerblok\}`/, 'dezelfde opslagsleutel als media.js');
});

test('SX-18: standen: klaar maakt een taak af en het begin geweest; verdieping gedaan is vol; alle bewijs telt maakt het eind af', () => {
  const b = blok(2);
  const meta = { 'klaar:3.1': { op: '2026-10-01T09:00:00Z' }, 'verdieping:2': { gedaan: true } };
  let m = metroModel({ blok: b, store: nepStore(meta), adres: { soort: 'taak', taak: '3.2', stap: 1 } });
  assert.equal(kolom(m, '3.1').haltes[0].stand, 'af');
  assert.equal(m.kolommen[0].haltes[0].stand, 'af');
  const v = m.kolommen.find((k) => k.soort === 'verdieping');
  assert.deepEqual(v.haltes.map((h) => h.doorgang ? 'doorgang' : [h.stand, h.gestippeld]), ['doorgang', ['af', false]]);
  assert.equal(v.haltes[1].href, 'leerblok-2.html#taak-4.1/toepassen');
  assert.equal(m.kolommen.at(-1).haltes[0].stand, 'open');
  const records = Object.fromEntries(['EV-03', 'EV-04', 'EV-12', 'EV-05'].map((id) => [id, { status: 'compleet' }]));
  m = metroModel({ blok: b, store: nepStore(meta, records), adres: { soort: 'taak', taak: '3.2', stap: 1 } });
  assert.equal(m.kolommen.at(-1).haltes[0].stand, 'af');
});

test('SX-18: buiten het leerblok de jongste positie, ingeklapt; zonder positie leerblok 1 met „hier” op het begin', () => {
  assert.deepEqual(laatsteLeerblok(nepStore()), { leerblok: 1, taak: null, stap: null });
  const store = nepStore({
    'positie:2': { taak: '3.2', stap: 3, bijgewerkt: '2026-10-01T10:00:00.000Z' },
    'positie:3': { taak: '6.1', stap: 2, bijgewerkt: '2026-10-01T11:00:00.000Z' },
    'positie:4': null,
  });
  const laatste = laatsteLeerblok(store);
  assert.deepEqual(laatste, { leerblok: 3, taak: '6.1', stap: 2 });
  let m = metroModel({ blok: blok(3), store, adres: { soort: 'elders', ...laatste } });
  assert.equal(m.kolommen.filter((k) => k.soort === 'stap').length, 0, 'buiten het leerblok klapt niets open');
  assert.equal(hier(m).id, '6.1');
  assert.equal(m.tekst, 'Leerblok 3 · laatst bij taak 6.1');
  m = metroModel({ blok: blok(3), store, adres: { soort: 'elders', taak: '4.2', stap: 1 } });
  assert.equal(hier(m).id, 'begin', 'een positie bij een taak die niet bestaat: „hier” op het begin');
});

test('SX-18: lege opslag en onbekende ankers: alles open, „hier” op het begin', () => {
  const b = blok(3);
  const adres = leesAdres('#wissel', b.taken.map((t) => t.id));
  const m = metroModel({ blok: b, store: nepStore(), adres });
  assert.equal(hier(m).id, 'begin');
  assert.ok(alleHaltes(m).every((h) => h.stand !== 'af'));
});
