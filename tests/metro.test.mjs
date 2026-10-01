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
import { metroIndeling, HOOGTE, Y_LIJN, RIJ } from '../js/metro-indeling.js';
import { paginaBestanden, gewichten, GRENS, GRENS_BRON } from '../tools/gewicht-check.mjs';
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

/** Alle adressen van een leerblok: overzicht, afsluiten, elke taak met elke stap, en elders. */
const adressen = (b) => [{ soort: 'overzicht' }, { soort: 'afsluiten' }, { soort: 'elders', taak: b.taken[0].id, stap: 1 },
  ...b.taken.flatMap((t) => [1, 2, 3, 4].map((stap) => ({ soort: 'taak', taak: t.id, stap })))];
const keuzes = nepStore({ 'media:route:1': 'video', 'media:route:2': 'spel', 'oefening:3.2': { invoer: { route: 'B · AI-tool' } } });

test('SX-18: op 328, 600 en 1024 px elke halte binnen de kaart, tikvlakken ≥ 24 × 24 px en zonder overlap', () => {
  for (const n of [1, 2, 3, 4]) {
    const b = blok(n);
    for (const store of [nepStore(), keuzes]) {
      for (const adres of adressen(b)) {
        for (const breedte of [328, 600, 1024]) {
          const ind = metroIndeling(metroModel({ blok: b, store, adres }), breedte);
          const wie = `leerblok ${n} ${JSON.stringify(adres)} ${breedte}px`;
          assert.ok(HOOGTE >= 44, 'de kaart is minstens 44 px hoog');
          for (const h of ind.haltes) {
            assert.ok(h.x - h.r >= 0 && h.x + h.r <= breedte, `${wie}: ${h.id} binnen de breedte`);
            assert.ok(h.tik.b >= 24 && h.tik.h >= 24, `${wie}: tikvlak van ${h.id} is ${h.tik.b.toFixed(1)} × ${h.tik.h.toFixed(1)}`);
            assert.ok(h.tik.x >= 0 && h.tik.x + h.tik.b <= breedte + 1e-6 && h.tik.y >= 0 && h.tik.y + h.tik.h <= HOOGTE + 1e-6, `${wie}: tikvlak ${h.id} binnen de kaart`);
          }
          for (let i = 0; i < ind.haltes.length; i += 1) {
            for (let j = i + 1; j < ind.haltes.length; j += 1) {
              const a = ind.haltes[i].tik; const c = ind.haltes[j].tik;
              const ox = Math.min(a.x + a.b, c.x + c.b) - Math.max(a.x, c.x);
              const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
              assert.ok(ox <= 0.01 || oy <= 0.01, `${wie}: ${ind.haltes[i].id} en ${ind.haltes[j].id} overlappen`);
            }
          }
          assert.equal(ind.labels.filter((l) => l.soort === 'hier').length, 1, `${wie}: één label „hier”`);
        }
      }
    }
  }
});

test('SX-18: het smalste geval, leerblok 3 met 5.1 open, heeft 12 kolommen; onder 28 px alleen labels van „hier” en de overstappunten', () => {
  const m = metroModel({ blok: blok(3), store: nepStore(), adres: { soort: 'taak', taak: '5.1', stap: 2 } });
  assert.equal(m.kolommen.length, 12);
  const smal = metroIndeling(m, 328);
  assert.equal(smal.smal, true);
  assert.ok(smal.labels.every((l) => l.soort === 'overstap' || l.soort === 'hier'));
  assert.deepEqual(smal.labels.filter((l) => l.soort === 'overstap').map((l) => [l.tekst, l.anker, l.x]), [['Vorige keer', 'start', 0], ['Afsluiten', 'end', 328]]);
  const breed = metroIndeling(m, 1024);
  assert.equal(breed.smal, false);
  assert.ok(breed.labels.some((l) => l.soort === 'kolom' && l.tekst === '6.1'));
  assert.ok(breed.labels.some((l) => l.soort === 'tak' && l.tekst === 'V'));
});

test('SX-19: takken liggen op ±18 px; dezelfde splitsing loopt parallel door; stompjes in de kleur van de vorige en volgende lijn', () => {
  const m = metroModel({ blok: blok(2), store: nepStore(), adres: { soort: 'taak', taak: '3.2', stap: 4 } });
  const ind = metroIndeling(m, 1024);
  const takA = ind.haltes.filter((h) => h.id.endsWith('-A'));
  assert.deepEqual(takA.map((h) => h.y), [Y_LIJN - RIJ, Y_LIJN - RIJ], 'tak A van oefenen en toepassen');
  const [o, t] = takA;
  assert.ok(ind.sporen.some((s) => s.x1 === o.x && s.x2 === t.x && s.y1 === o.y && s.y2 === t.y), 'tak A loopt recht door van O naar T');
  assert.deepEqual(ind.sporen.filter((s) => s.lijn !== 2).map((s) => s.lijn), [1, 3]);
  const lb1 = metroIndeling(metroModel({ blok: blok(1), store: nepStore(), adres: { soort: 'overzicht' } }), 600);
  assert.deepEqual(lb1.sporen.filter((s) => s.lijn !== 1).map((s) => s.lijn), [2], 'leerblok 1: alleen een stompje naar lijn 2');
  const v = metroIndeling(metroModel({ blok: blok(2), store: nepStore(), adres: { soort: 'overzicht' } }), 600);
  assert.ok(v.sporen.some((s) => s.gestippeld), 'de verdieping is gestippeld zolang ze niet gedaan is');
});

const STUDENT = ['index.html', 'leerblok-1.html', 'leerblok-2.html', 'leerblok-3.html', 'leerblok-4.html', 'dossier.html', 'bronnen.html'];

test('SX-18: de kaart staat op de zeven studentpagina\'s en niet op docentmodus, verificatie en controlelab', () => {
  for (const p of STUDENT) assert.match(lees(p), /<script type="module" src="js\/metro\.js"><\/script>/, p);
  for (const p of ['docent.html', 'verificatie.html', 'controlelab.html']) assert.doesNotMatch(lees(p), /metro\.js/, p);
});

test('SX-18: de tekening heeft een lijst van links met aria-current, geen schaduw, beweging alleen zonder reduced motion', () => {
  const js = lees('js/metro.js');
  assert.match(js, /role: 'list'/);
  assert.match(js, /role: 'listitem'/);
  assert.match(js, /'aria-current': h\.stand === 'hier' \? 'step' : null/);
  assert.match(js, /'aria-hidden': 'true'/, 'sporen en labels zijn decoratief; de naam staat op de link');
  assert.match(js, /addEventListener\('a3-voortgang'/);
  const css = lees('css/site.css');
  const metro = css.slice(css.indexOf('/* ---- metrokaart'));
  assert.ok(metro.length > 0 && metro.includes('.metro-spoor'), 'blok .metro in site.css');
  assert.doesNotMatch(metro, /box-shadow|filter:\s*drop-shadow/, 'SX-7: geen schaduw');
  assert.match(metro, /transition:fill 200ms/, 'SX-9: vullen in 200 ms');
  assert.match(metro, /font-size:13px/, 'SX-10: labels 13 px');
});

test('PF-4: leerblokpagina\'s tellen alleen hun eigen leerblokbestand; start, dossier en bronnen tellen de vier', () => {
  const namen = (p) => paginaBestanden(root, p).map((f) => f.replace(`${root}/`, '')).filter((f) => /^data\/leerblok-\d\.json$/.test(f)).sort();
  // leerblok 3 leest ook leerblok 2 voor „Vorige keer” (${vorig}, TP-11); de kaart voegt leerblok 1 en 4 niet toe
  assert.deepEqual(namen('leerblok-3.html'), ['data/leerblok-2.json', 'data/leerblok-3.json']);
  for (const p of ['index.html', 'dossier.html', 'bronnen.html']) assert.deepEqual(namen(p), [1, 2, 3, 4].map((n) => `data/leerblok-${n}.json`), p);
  assert.ok(paginaBestanden(root, 'index.html').some((f) => f.endsWith('js/metro-indeling.js')));
  for (const g of gewichten(root)) assert.ok(g.gzip <= GRENS && g.bytes <= GRENS_BRON, `${g.pagina}: ${g.bytes} bytes, ${g.gzip} gzip`);
});

test('SX-4: de taakkop heeft geen segmentbalk meer; voortgang en routekeuze laten de kaart opnieuw tekenen', () => {
  const lb = lees('js/leerblok.js');
  assert.doesNotMatch(lb, /class: 'segmenten'/);
  assert.doesNotMatch(lb, /segmentLabel/, 'het tekstalternatief staat op de kaart (metro-model.js)');
  assert.match(lb, /dispatchEvent\(new CustomEvent\('a3-voortgang'/);
  assert.match(lees('js/media.js'), /dispatchEvent\(new CustomEvent\('a3-voortgang'/);
  assert.match(lees('js/metro-model.js'), /segmentLabel\(taakNr, ids\.length/);
});

test('SX-18: de kaart lijnt uit met de inhoud: dezelfde maximale breedte en zijmarge als header en main, ook op mobiel', () => {
  const css = lees('css/site.css');
  const metro = css.slice(css.indexOf('/* ---- metrokaart'));
  assert.match(css, /header,main,footer \{ max-width:60rem; margin:0 auto; padding:1rem; \}/);
  assert.match(metro, /\.metro \{ max-width:60rem; margin:\.25rem auto \.75rem; padding:0 1rem; \}/);
  assert.match(metro, /@media \(max-width:40rem\) \{ \.metro \{ padding:0 \.75rem; \} \}/);
});
