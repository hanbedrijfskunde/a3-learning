import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maakStore, geheugenOpslag, kiesOpslag } from '../js/store.js';
import { maakSessie } from '../js/sessie.js';
import { bewaarProfiel, leesProfiel } from '../js/profiel.js';
import { bouwAfsluitModel } from '../js/weergave.js';
import {
  canoniek, sha256Hex, berekenControlesom, maakDossier, bestandsnaam, schemaAccepteerbaar, controleerDossier,
  importeerDossier, telWijzigingen, herinnering, sluitHerinneringAf, registreerExport,
  slechtsteStatus, bouwMijnStand, bouwDekking, bouwLeeruitkomsten, bouwAfdruk, bouwVerificatie, veldLabels,
} from '../js/dossier.js';
import { controleerLuk, controleerMap } from '../tools/content-check.mjs';
import '../js/checks/index.js'; // registreert alle controlefabrieken (PF-4: pagina's laden ze per leerblok)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (pad) => JSON.parse(readFileSync(resolve(root, pad), 'utf8'));
const blok1 = lees('data/leerblok-1.json');
const luk = lees('data/luk.json');
const FIX = resolve(root, 'tests/fixtures/dossiers');
const fixtureTekst = (naam) => readFileSync(resolve(FIX, `${naam}.json`), 'utf8');
const NAMEN = ['anna-compleet', 'bram-gedeeltelijk', 'chris-voorlopig', 'eva-leeg', 'dana-gewijzigd'];

const EV01 = { gebruiker: 'de planners van de afdeling', pain: 'sneller de roosters te maken', waarde: 'medewerkers minder stress hebben', kapitalen: ['menselijk'] };
const EV02 = {
  frame1: 'functioneel', zoekvraag1: 'Welke factoren spelen bij roosteren?',
  frame2: 'intern of extern', zoekvraag2: 'In hoeverre werkt het rooster intern?',
  frame3: 'theoretisch of empirisch', zoekvraag3: 'Wat zegt de literatuur over roosteren?',
  model: '7S', verantwoording: 'Het model past bij het vraagstuk.', mis: 'Je mist de kant van de klant.',
};
const NU = () => new Date('2026-10-05T12:00:00Z');

/** Een opslag met echt gemaakte records (via de sessie) en een profiel. */
function gevuld() {
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  let t = Date.parse('2026-10-01T10:00:00Z');
  const sessie = maakSessie({ store, blok: blok1, elearning: '0.1.0', nu: () => new Date(t += 60000) });
  bewaarProfiel(store, { alias: 'Kim', teamnummer: '7', vraagstuk: 'Onze roosters zijn te laat klaar', waaromZin: 'Medewerkers hebben last van late roosters.' });
  sessie.bewaar('2.1', EV01);
  sessie.bewaar('2.1', { ...EV01, pain: 'sneller en eerlijker de roosters te maken' });
  sessie.bewaar('2.2', EV02);
  return { opslag, store, sessie };
}

// ---------------------------------------------------------------------------------------------- DS-6

test('DS-6: SHA-256 geeft de bekende uitkomst voor "abc" en 64 hexadecimale tekens', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.match(await sha256Hex('é✓ – ander teken'), /^[0-9a-f]{64}$/);
});

test('DS-6: de canonieke vorm hangt niet af van de volgorde van sleutels', () => {
  assert.equal(canoniek({ b: 1, a: { d: [1, 2], c: 'x' } }), canoniek({ a: { c: 'x', d: [1, 2] }, b: 1 }));
  assert.notEqual(canoniek({ a: [1, 2] }), canoniek({ a: [2, 1] }));
});

test('DS-6: de export bevat 1 controlesom van 64 hexadecimale tekens die over de inhoud gaat', async () => {
  const d = await maakDossier(gevuld().store, { elearning: '0.1.0', nu: NU });
  assert.match(d.controlesom.waarde, /^[0-9a-f]{64}$/);
  assert.equal(d.controlesom.algoritme, 'SHA-256');
  assert.equal(d.controlesom.waarde, await berekenControlesom(d));
});

// ---------------------------------------------------------------------------------------------- DS-5

test('DS-5: de export bevat 5 onderdelen: records (nieuwste versie), aantal eerdere versies, alias, teamnummer en e-learningversie', async () => {
  const { store } = gevuld();
  const d = await maakDossier(store, { elearning: '0.1.0', nu: NU });
  assert.equal(d.alias, 'Kim');
  assert.equal(d.teamnummer, '7');
  assert.equal(d.elearning, '0.1.0');
  assert.deepEqual(d.records.map((r) => r.record.id), ['EV-01', 'EV-02']);
  assert.deepEqual(d.records.map((r) => r.record), [store.get('EV-01'), store.get('EV-02')]); // nieuwste versie
  assert.equal(d.records[0].record.versie, 2);
  assert.deepEqual(d.records.map((r) => r.eerdereVersies), [1, 0]);
  assert.equal(d.records[0].record.inhoud.pain, 'sneller en eerlijker de roosters te maken');
});

test('DS-5: alleen bewijs in de export; oefeninvoer, klaar-markeringen en verdieping niet (TK-4)', async () => {
  const { store, sessie } = gevuld();
  sessie.zetOefening('2.1', { gebruiker: 'GEHEIME-OEFENING' });
  sessie.zetVerdieping({ tekst: 'GEHEIME-VERDIEPING' });
  const tekst = JSON.stringify(await maakDossier(store, { elearning: '0.1.0', nu: NU }));
  assert.ok(!tekst.includes('GEHEIME'));
});

test('DS-5: de bestandsnaam is bewijsdossier-<alias>-<datum>.json, ook bij een lastige alias', async () => {
  const d = await maakDossier(gevuld().store, { elearning: '0.1.0', nu: NU });
  assert.equal(bestandsnaam(d), 'bewijsdossier-kim-2026-10-05.json');
  assert.equal(bestandsnaam({ alias: 'Zoë / de Vries!', geexporteerd: '2026-10-05T12:00:00Z' }), 'bewijsdossier-zoe-de-vries-2026-10-05.json');
  assert.equal(bestandsnaam({ alias: 'Jörg', geexporteerd: '2026-10-05T12:00:00Z' }), 'bewijsdossier-jorg-2026-10-05.json');
  assert.equal(bestandsnaam({ alias: '', geexporteerd: '2026-10-05T12:00:00Z' }), 'bewijsdossier-student-2026-10-05.json');
});

test('DS-5: een leeg profiel exporteert zonder fout (0 records)', async () => {
  const d = await maakDossier(maakStore(geheugenOpslag()), { elearning: '0.1.0', nu: NU });
  assert.deepEqual(d.records, []);
  assert.equal((await controleerDossier(d)).status, 'ongewijzigd');
});

// ---------------------------------------------------------------------------------------------- DS-8

test('DS-8: een ongewijzigd bestand geeft geen melding (0 van 4 fixtures), ook als de witruimte anders is', async () => {
  for (const naam of NAMEN.filter((n) => n !== 'dana-gewijzigd')) {
    const u = await controleerDossier(fixtureTekst(naam));
    assert.equal(u.status, 'ongewijzigd', `${naam}: ${u.reden}`);
    assert.deepEqual(u.recordFouten, [], naam);
  }
  const d = JSON.parse(fixtureTekst('anna-compleet'));
  assert.equal((await controleerDossier(JSON.stringify(d))).status, 'ongewijzigd'); // compact
  assert.equal((await controleerDossier(JSON.stringify(d, null, '\t'))).status, 'ongewijzigd');
});

test('DS-8: 1 gewijzigd teken in de fixture geeft 1 melding „gewijzigd na export"; test met 2 bestanden', async () => {
  const goed = await controleerDossier(fixtureTekst('anna-compleet'));
  const slecht = await controleerDossier(fixtureTekst('dana-gewijzigd'));
  assert.equal(goed.status, 'ongewijzigd');
  assert.equal(slecht.status, 'gewijzigd');
  assert.match(slecht.reden, /gewijzigd na export/);
});

test('DS-8: elk gewijzigd teken op elke plek in het bestand valt op (alias, inhoud, status, versie, tijd, controlesom)', async () => {
  const { store } = gevuld();
  const basis = await maakDossier(store, { elearning: '0.1.0', nu: NU });
  const wijzigingen = [
    (d) => { d.alias = 'Kin'; },
    (d) => { d.teamnummer = '8'; },
    (d) => { d.elearning = '0.1.1'; },
    (d) => { d.geexporteerd = '2026-10-05T12:00:01.000Z'; },
    (d) => { d.records[0].record.inhoud.pain += '.'; },
    (d) => { d.records[1].record.inhoud.model = '7s'; },
    (d) => { d.records[0].record.status = 'bijna'; },
    (d) => { d.records[0].record.versie += 1; },
    (d) => { d.records[0].eerdereVersies += 1; },
    (d) => { d.records[0].record.controles[0].resultaat = 'let op'; },
    (d) => { d.controlesom.waarde = d.controlesom.waarde.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')); },
    (d) => { d.extra = 'x'; },
    (d) => { delete d.controlesom; },
  ];
  for (const [i, wijzig] of wijzigingen.entries()) {
    const d = JSON.parse(JSON.stringify(basis));
    wijzig(d);
    assert.equal((await controleerDossier(d)).status, 'gewijzigd', `wijziging ${i + 1} viel niet op`);
  }
});

test('DS-8: een gewijzigd teken diep in een lange tekst valt ook op (geen afronding van de controlesom)', async () => {
  const { store, sessie } = gevuld();
  sessie.bewaar('2.1', { ...EV01, waarde: `${'lange tekst '.repeat(200)}einde` });
  const d = JSON.parse(JSON.stringify(await maakDossier(store, { elearning: '0.1.0', nu: NU })));
  assert.equal((await controleerDossier(d)).status, 'ongewijzigd');
  d.records[0].record.inhoud.waarde = d.records[0].record.inhoud.waarde.replace('einde', 'eindf');
  assert.equal((await controleerDossier(d)).status, 'gewijzigd');
});

test('DS-8: wat geen dossier is, wordt afgekeurd met een reden en niet als „gewijzigd" gemeld', async () => {
  for (const [invoer, rx] of [['{niet json', /geen geldig JSON/i], ['{"a":1}', /geen bewijsdossier/i], ['[]', /geen bewijsdossier/i], ['null', /geen bewijsdossier/i]]) {
    const u = await controleerDossier(invoer);
    assert.equal(u.status, 'ongeldig', invoer);
    assert.match(u.reden, rx);
  }
});

// ---------------------------------------------------------------------------------------------- DS-4

test('DS-4: elke eerdere 1.x-schemaversie wordt geaccepteerd, een nieuwere of andere hoofdversie niet', () => {
  for (const v of ['1.0', '1.1', '1.2']) assert.equal(schemaAccepteerbaar(v, '1.2').ok, true, v);
  for (const v of ['1.3', '2.0', '0.9', 'x', undefined]) assert.equal(schemaAccepteerbaar(v, '1.2').ok, false, String(v));
  assert.match(schemaAccepteerbaar('1.3', '1.2').reden, /nieuwer/);
  assert.equal(schemaAccepteerbaar('1.0').ok, true);
});

test('DS-4: een dossier met een andere hoofdversie geeft een duidelijke fout, geen crash', async () => {
  const d = JSON.parse(fixtureTekst('anna-compleet'));
  d.schema = '2.0';
  const u = await controleerDossier(d);
  assert.equal(u.status, 'ongeldig');
  assert.match(u.reden, /schema 2\.0/);
});

test('DS-3/DS-4: ongeldige records worden gemeld met het id en niet ingelezen; een dubbel id ook', async () => {
  const d = JSON.parse(fixtureTekst('bram-gedeeltelijk'));
  delete d.records[0].record.inhoud;
  d.records[1].record.status = 'perfect';
  d.records.push(JSON.parse(JSON.stringify(d.records[2])));
  d.controlesom.waarde = await berekenControlesom(d); // de som klopt, de records niet
  const u = await controleerDossier(d);
  assert.equal(u.status, 'ongewijzigd');
  assert.equal(u.recordFouten.length, 3);
  assert.ok(u.recordFouten.some((f) => f.startsWith('EV-01') && f.includes('inhoud')));
  assert.ok(u.recordFouten.some((f) => f.startsWith('EV-02') && f.includes('status')));
  assert.ok(u.recordFouten.some((f) => f.includes('twee keer')));
});

// ---------------------------------------------------------------------------------------------- DS-3

test('DS-3: export → import in een schoon profiel geeft 0 verschillen (records, versienummers, alias, teamnummer)', async () => {
  const bron = gevuld();
  const dossier = await maakDossier(bron.store, { elearning: '0.1.0', nu: NU });
  const tekst = JSON.stringify(dossier); // zoals het bestand op schijf
  const u = await controleerDossier(tekst);
  assert.equal(u.status, 'ongewijzigd');

  const opslag = geheugenOpslag();
  const schoon = maakStore(opslag);
  const r = importeerDossier({ store: schoon, opslag }, u.dossier);
  assert.deepEqual(r.overgenomen, ['EV-01', 'EV-02']);
  assert.deepEqual(schoon.ids(), bron.store.ids());
  for (const id of bron.store.ids()) assert.deepEqual(schoon.get(id), bron.store.get(id), `verschil bij ${id}`);
  assert.equal(schoon.get('EV-01').versie, 2);
  assert.equal(leesProfiel(schoon).alias, 'Kim');
  assert.equal(leesProfiel(schoon).teamnummer, '7');
  assert.equal(leesProfiel(schoon).vraagstuk, 'Onze roosters zijn te laat klaar');

  // een tweede export uit het schone profiel is identiek, ook de controlesom
  const opnieuw = await maakDossier(schoon, { elearning: '0.1.0', nu: NU });
  assert.deepEqual(opnieuw, dossier);
});

test('DS-3: na een import werkt de opslag gewoon door: een volgende wijziging krijgt het volgende versienummer', async () => {
  const bron = gevuld();
  const dossier = await maakDossier(bron.store, { elearning: '0.1.0', nu: NU });
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  importeerDossier({ store, opslag }, dossier);
  const sessie = maakSessie({ store, blok: blok1, elearning: '0.1.0', nu: () => new Date('2026-10-09T09:00:00Z') });
  const { record } = sessie.bewaar('2.1', { ...EV01, gebruiker: 'de roosterplanners van de afdeling' });
  assert.equal(record.versie, 3);
  assert.equal(store.versions('EV-01').at(-1).versie, 3);
  assert.equal(store.get('EV-02').versie, 1);
});

test('DS-3: bij een bestaand record wint het nieuwste; gelijke en nieuwere eigen records blijven staan; het profiel wordt niet overschreven', async () => {
  const bron = gevuld();
  const dossier = await maakDossier(bron.store, { elearning: '0.1.0', nu: NU });

  // huidig profiel: EV-01 ouder (moet worden vervangen), EV-02 identiek, alias al ingevuld
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  bewaarProfiel(store, { alias: 'Sam', teamnummer: '', vraagstuk: '', waaromZin: '' });
  const oud = maakSessie({ store, blok: blok1, elearning: '0.1.0', nu: () => new Date('2026-09-01T10:00:00Z') });
  oud.bewaar('2.1', EV01);
  oud.bewaar('2.1', { ...EV01, gebruiker: 'de planners van gisteren' });
  oud.bewaar('2.1', { ...EV01, gebruiker: 'de planners van eergisteren' });
  store.save(dossier.records[1].record); // save telt door: versie 1, gelijk aan die in het dossier
  const r = importeerDossier({ store, opslag }, dossier);
  assert.deepEqual(r.overgenomen, ['EV-01']);
  assert.deepEqual(r.gelijk, ['EV-02']);
  assert.equal(store.get('EV-01').versie, 4); // 3 eigen versies, dossier had versie 2: doorgeteld, niet teruggezet
  assert.equal(store.get('EV-01').inhoud.pain, 'sneller en eerlijker de roosters te maken');
  assert.equal(store.versions('EV-01').length, 4);
  assert.equal(leesProfiel(store).alias, 'Sam'); // niet overschreven
  assert.equal(leesProfiel(store).teamnummer, '7'); // leeg: aangevuld

  // een eigen record dat nieuwer is blijft behouden
  const nieuwer = maakStore(geheugenOpslag());
  const s2 = maakSessie({ store: nieuwer, blok: blok1, elearning: '0.1.0', nu: () => new Date('2027-01-01T10:00:00Z') });
  s2.bewaar('2.1', { ...EV01, gebruiker: 'de planners van volgend jaar' });
  const o2 = geheugenOpslag();
  const st2 = maakStore(o2);
  maakSessie({ store: st2, blok: blok1, elearning: '0.1.0', nu: () => new Date('2027-01-01T10:00:00Z') }).bewaar('2.1', { ...EV01, gebruiker: 'de planners van volgend jaar' });
  const r2 = importeerDossier({ store: st2, opslag: o2 }, dossier);
  assert.deepEqual(r2.behouden, ['EV-01']);
  assert.equal(st2.get('EV-01').inhoud.gebruiker, 'de planners van volgend jaar');
});

test('DS-3: alle vier ongewijzigde fixtures zijn te importeren, elk met 0 fouten', async () => {
  for (const naam of NAMEN.filter((n) => n !== 'dana-gewijzigd')) {
    const u = await controleerDossier(fixtureTekst(naam));
    const opslag = geheugenOpslag();
    const store = maakStore(opslag);
    importeerDossier({ store, opslag }, u.dossier);
    assert.deepEqual(store.ids(), u.dossier.records.map((r) => r.record.id).sort(), naam);
    for (const { record } of u.dossier.records) assert.deepEqual(store.get(record.id), record, `${naam} ${record.id}`);
  }
});

// ---------------------------------------------------------------------------------------------- DS-9, DS-11, DS-7, BW-13

const fixtureResultaten = async () => Promise.all(NAMEN.map(async (n) => ({ bestand: `${n}.json`, uitkomst: await controleerDossier(fixtureTekst(n)) })));

test('DS-9: 5 dossiers tegelijk: per student 12 bewijsonderdelen en 3 leeruitkomsten', async () => {
  const m = bouwVerificatie(await fixtureResultaten(), luk);
  assert.equal(m.studenten.length, 5);
  assert.equal(m.afgekeurd.length, 0);
  for (const s of m.studenten) {
    assert.equal(s.cellen.length, 12, s.alias);
    assert.equal(s.leeruitkomsten.length, 3, s.alias);
    assert.deepEqual(s.leeruitkomsten.map((l) => l.luk), [1, 2, 5]);
  }
  assert.deepEqual(m.bewijsonderdelen, luk.bewijsonderdelen.map((b) => b.id));
});

test('DS-9: de studenten met de meeste ontbrekende onderdelen staan bovenaan en de ontbrekende id\'s worden genoemd', async () => {
  const m = bouwVerificatie(await fixtureResultaten(), luk);
  const aantallen = m.studenten.map((s) => s.ontbreekt.length);
  assert.deepEqual(aantallen, [...aantallen].sort((a, b) => b - a));
  assert.deepEqual(m.studenten.map((s) => s.alias), ['Chris', 'Eva', 'Bram', 'Anna', 'Dana']);
  const bram = m.studenten.find((s) => s.alias === 'Bram');
  assert.deepEqual(bram.ontbreekt, ['EV-04', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10', 'EV-11', 'EV-12']); // EV-03 is „bijna": telt niet als ontbrekend
  const chris = m.studenten.find((s) => s.alias === 'Chris');
  assert.equal(chris.cellen[0].voorlopig, true);
  assert.equal(chris.ontbreekt.length, 12);
});

test('DS-8/DS-9: het gewijzigde dossier is in de tabel gemarkeerd en de andere niet', async () => {
  const m = bouwVerificatie(await fixtureResultaten(), luk);
  assert.deepEqual(m.studenten.filter((s) => s.gewijzigd).map((s) => s.alias), ['Dana']);
});

test('DS-9: een bestand dat geen dossier is komt in `afgekeurd`, niet in de tabel', async () => {
  const res = [...await fixtureResultaten(), { bestand: 'kladje.json', uitkomst: await controleerDossier('{"x":1}') }];
  const m = bouwVerificatie(res, luk);
  assert.equal(m.studenten.length, 5);
  assert.equal(m.afgekeurd.length, 1);
  assert.equal(m.afgekeurd[0].bestand, 'kladje.json');
});

test('DS-9: de leeruitkomst neemt het slechtste van de bijbehorende onderdelen; zonder record is „nog niet"', async () => {
  const m = bouwVerificatie(await fixtureResultaten(), luk);
  const anna = m.studenten.find((s) => s.alias === 'Anna');
  assert.ok(anna.leeruitkomsten.every((l) => l.status === 'compleet'));
  const bram = m.studenten.find((s) => s.alias === 'Bram');
  assert.equal(bram.leeruitkomsten.find((l) => l.luk === 1).status, 'nog niet');
  assert.equal(bram.leeruitkomsten.find((l) => l.luk === 1).aantalCompleet, 2);
  assert.equal(bram.leeruitkomsten.find((l) => l.luk === 5).totaal, 2);
});

test('DS-9: slechtsteStatus volgt de statusregel: nog niet gaat voor bijna, bijna voor compleet, niets is nog niet (BW-5)', () => {
  assert.equal(slechtsteStatus(['compleet', 'compleet']), 'compleet');
  assert.equal(slechtsteStatus(['compleet', 'bijna']), 'bijna');
  assert.equal(slechtsteStatus(['bijna', 'nog niet', 'compleet']), 'nog niet');
  assert.equal(slechtsteStatus([]), 'nog niet');
});

test('DS-11: Mijn stand heeft 12 statussen en 0 inhoudsvelden', () => {
  const { store } = gevuld();
  const records = Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, store.get(b.id)]));
  const stand = bouwMijnStand(luk, records);
  assert.equal(stand.length, 12);
  assert.deepEqual(stand.filter((c) => c.heeftRecord).map((c) => [c.id, c.status]), [['EV-01', 'compleet'], ['EV-02', 'compleet']].map(([id]) => [id, stand.find((c) => c.id === id).status]));
  assert.deepEqual(Object.keys(stand[0]).sort(), ['heeftRecord', 'id', 'ontbreekt', 'status', 'statusTekst', 'titel', 'voorlopig']);
  const tekst = JSON.stringify(stand);
  for (const geheim of ['planners', 'roosteren', 'frame', 'inhoud']) assert.ok(!tekst.includes(geheim), geheim);
  assert.equal(stand.find((c) => c.id === 'EV-05').statusTekst, 'Te doen');
});

test('BW-13: de dekkingstabel heeft 13 rijen (5 gedekt, 6 deels, 2 buiten scope); EV-01 en EV-02 tonen de status uit het dossier', () => {
  const { store } = gevuld();
  const records = Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, store.get(b.id)]));
  const rijen = bouwDekking(luk, records);
  assert.equal(rijen.length, 13);
  const tel = (d) => rijen.filter((r) => r.dekking === d).length;
  assert.deepEqual([tel('gedekt'), tel('deels'), tel('buiten scope')], [5, 6, 2]);
  const formuleert = rijen.find((r) => r.label === 'LUK 1 · Formuleert een onderzoeksvraag');
  assert.equal(formuleert.bewijs[0].id, 'EV-01');
  assert.equal(formuleert.bewijs[0].status, store.get('EV-01').status);
  const analyseert = rijen.find((r) => r.label === 'LUK 1 · Analyseert het probleem methodisch');
  assert.deepEqual(analyseert.bewijs.map((c) => [c.id, c.heeftRecord]), [['EV-02', true], ['EV-03', false]]);
  assert.equal(analyseert.bewijs[1].statusTekst, 'Te doen');
  assert.deepEqual(rijen.filter((r) => r.dekking === 'buiten scope').map((r) => r.bewijs.length), [0, 0]);
});

test('DS-7: 3 afdrukbare pagina\'s (LUK 1, 2 en 5), elk met status, inhoud en de controlesom onderaan', async () => {
  const { store } = gevuld();
  const d = await maakDossier(store, { elearning: '0.1.0', nu: NU });
  const paginas = bouwAfdruk(d, luk, veldLabels([blok1]));
  assert.deepEqual(paginas.map((p) => p.luk), [1, 2, 5]);
  assert.deepEqual(paginas.map((p) => p.onderdelen.length), [10, 1, 2]);
  for (const p of paginas) assert.equal(p.controlesom, d.controlesom.waarde);
  const ev01 = paginas[0].onderdelen.find((o) => o.id === 'EV-01');
  assert.equal(ev01.statusTekst, 'Compleet');
  assert.equal(ev01.versie, 2);
  assert.deepEqual(ev01.velden.find((v) => v.label === 'Gebruiker'), { label: 'Gebruiker', waarde: 'de planners van de afdeling' });
  assert.equal(ev01.velden.find((v) => v.label === 'Welke kapitalen?').waarde, 'menselijk');
  assert.deepEqual(paginas[0].onderdelen.find((o) => o.id === 'EV-03').velden, []); // nog geen inhoud
  assert.equal(paginas[1].onderdelen[0].id, 'EV-11'); // EV-11 draagt ook bij aan LUK 2
});

// ---------------------------------------------------------------------------------------------- DS-2

test('DS-2: 1 melding per 10 wijzigingen (niet eerder, niet dubbel), tot de student ze wegklikt of exporteert', () => {
  const { store, sessie } = gevuld(); // 3 versies
  assert.equal(telWijzigingen(store), 3);
  const meldingen = [];
  for (let i = 4; i <= 25; i += 1) {
    sessie.bewaar('2.1', { ...EV01, gebruiker: `de planners van afdeling ${i}` });
    const r = herinnering(store);
    // 2.1 is EV-01; EV-02 telt 1 versie mee
    if (r.tonen) { meldingen.push(r.wijzigingen); sluitHerinneringAf(store); }
    assert.equal(herinnering(store).tonen, false);
  }
  const totaal = telWijzigingen(store);
  assert.equal(totaal, 25);
  assert.deepEqual(meldingen, [10, 20]);
});

test('DS-2: de melding blijft staan tot ze wordt afgehandeld, en een export telt als afhandeling', () => {
  const { store, sessie } = gevuld();
  for (let i = 0; i < 7; i += 1) sessie.bewaar('2.1', { ...EV01, gebruiker: `de planners van afdeling ${i}` });
  assert.equal(telWijzigingen(store), 10);
  assert.equal(herinnering(store).tonen, true);
  assert.equal(herinnering(store).tonen, true); // opnieuw kijken wijzigt niets
  registreerExport(store, NU());
  assert.equal(herinnering(store).tonen, false);
  assert.equal(herinnering(store).sindsExport, 0);
  assert.equal(herinnering(store).ooitGeexporteerd, true);
  for (let i = 0; i < 9; i += 1) sessie.bewaar('2.1', { ...EV01, gebruiker: `de roosterplanners nummer ${i}` });
  assert.equal(herinnering(store).tonen, false); // 19
  sessie.bewaar('2.1', { ...EV01, gebruiker: 'de allerlaatste planners' });
  assert.equal(herinnering(store).tonen, true); // 20
  assert.equal(herinnering(store).sindsExport, 10);
});

test('DS-2: onveranderd bewaren telt niet als wijziging (RC-5)', () => {
  const { store, sessie } = gevuld();
  const voor = telWijzigingen(store);
  sessie.bewaar('2.1', store.get('EV-01').inhoud);
  assert.equal(telWijzigingen(store), voor);
});

test('DS-2: na elk leerblok staat de bewaarmelding op het afsluitscherm (4 van 4) en verwijst naar het dossier', () => {
  const overzicht = lees('data/leerblokken.json');
  assert.equal(overzicht.leerblokken.length, 4);
  for (const lb of overzicht.leerblokken) {
    const model = bouwAfsluitModel({ leerblok: lb.nummer, bewijsonderdelen: lb.bewijsonderdelen.map((id) => ({ id })) }, {});
    assert.match(model.bewaarmelding, /Bewaar je dossier/);
  }
  const html = readFileSync(resolve(root, 'js/leerblok.js'), 'utf8');
  assert.match(html, /href: 'dossier\.html'/);
  assert.ok(html.split('toonBewaarHerinnering(herinneringGebied').length - 1 >= 2, 'de melding moet bij het laden en na elke opslag worden getoond');
});

// ---------------------------------------------------------------------------------------------- DS-12

test('DS-12: geblokkeerde opslag wordt herkend en de export werkt dan toch, ruim binnen 1 s', async () => {
  const geblokkeerd = { get localStorage() { throw new Error('SecurityError'); } };
  const { opslag, geblokkeerd: g } = kiesOpslag(geblokkeerd);
  assert.equal(g, true);
  const store = maakStore(opslag);
  const sessie = maakSessie({ store, blok: blok1, elearning: '0.1.0' });
  sessie.bewaar('2.1', EV01);
  const t0 = performance.now();
  const d = await maakDossier(store, { elearning: '0.1.0' });
  assert.ok(performance.now() - t0 < 1000);
  assert.equal(d.records.length, 1);
  assert.equal((await controleerDossier(d)).status, 'ongewijzigd');
});

test('DS-12: leerblok- en dossierpagina tonen de melding met een exportknop bij geblokkeerde opslag', () => {
  const leerblok = readFileSync(resolve(root, 'js/leerblok.js'), 'utf8');
  const dossierPagina = readFileSync(resolve(root, 'js/dossier-pagina.js'), 'utf8');
  for (const bron of [leerblok, dossierPagina]) assert.match(bron, /geblokkeerd \? geblokkeerdMelding\(store, config\.versie\)/);
  assert.match(readFileSync(resolve(root, 'js/dossier-dom.js'), 'utf8'), /Je browser blokkeert opslag[\s\S]*exportKnop\(store, elearning\)/);
});

// ---------------------------------------------------------------------------------------------- DS-10, PR-2

test('DS-10/PR-2: geen enkel dossierbestand doet een verzoek buiten de eigen statische data (broninspectie)', () => {
  for (const naam of ['dossier.js', 'dossier-dom.js', 'dossier-pagina.js', 'verificatie-pagina.js']) {
    const bron = readFileSync(resolve(root, 'js', naam), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//.test(bron), `${naam} praat met het netwerk`);
    const alle = [...bron.matchAll(/fetch\(/g)].length;
    const statisch = [...bron.matchAll(/fetch\(new URL\([^,()]+, import\.meta\.url\)\)/g)].length; // alleen GET van een bestand van de site
    assert.equal(statisch, alle, `${naam}: een fetch die niet een statisch bestand van de site ophaalt`);
    assert.ok(!/\bmethod\s*:|\bbody\s*:/.test(bron), `${naam}: verzoek met methode of body`);
  }
  const ver = readFileSync(resolve(root, 'js/verificatie-pagina.js'), 'utf8');
  assert.equal([...ver.matchAll(/fetch\(/g)].length, 1); // alleen data/luk.json
  assert.match(ver, /data\/luk\.json/);
});

test('DS-10: dossier.html en verificatie.html verbieden in hun beveiligingsbeleid alles behalve de eigen site', () => {
  for (const p of ['dossier.html', 'verificatie.html']) {
    const html = readFileSync(resolve(root, p), 'utf8');
    const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
    assert.match(csp, /connect-src 'self'/, p);
    assert.match(csp, /default-src 'none'/, p);
    assert.ok(!/https?:/.test(csp), p);
  }
});

// ---------------------------------------------------------------------------------------------- fixtures en luk.json

test('3.10: er zijn 5 testdossiers, 1 met gewijzigde inhoud', () => {
  const bestanden = readdirSync(FIX).filter((n) => n.endsWith('.json')).sort();
  assert.equal(bestanden.length, 5);
  assert.deepEqual(bestanden, NAMEN.map((n) => `${n}.json`).sort());
});

test('3.1: luk.json heeft 12 bewijsonderdelen en 13 onderdelen en slaagt voor de contentcontrole met leerblok 1', () => {
  assert.equal(luk.bewijsonderdelen.length, 12);
  assert.equal(luk.onderdelen.length, 13);
  assert.deepEqual(controleerLuk(luk, 'luk.json', [blok1]), []);
  assert.deepEqual(controleerMap(resolve(root, 'data')).fouten, []);
});

test('3.1: de contentcontrole vangt een luk.json met een onbekend bewijsonderdeel, een ontbrekende rij en een verkeerde LUK-koppeling', () => {
  const kopie = () => JSON.parse(JSON.stringify(luk));
  let l = kopie(); l.onderdelen[0].bewijs = ['EV-99'];
  assert.ok(controleerLuk(l, 'luk.json').some((f) => f.includes('EV-99')));
  l = kopie(); l.onderdelen.pop();
  assert.ok(controleerLuk(l, 'luk.json').some((f) => f.includes('13 onderdelen')));
  l = kopie(); l.onderdelen[3].dekking = 'gedekt';
  assert.ok(controleerLuk(l, 'luk.json').some((f) => f.includes('mist bewijs')));
  l = kopie(); l.onderdelen[1].dekking = 'bijna';
  assert.ok(controleerLuk(l, 'luk.json').some((f) => f.includes('dekking')));
  l = kopie(); l.onderdelen[1].label = 'LUK 1 · Iets anders';
  assert.ok(controleerLuk(l, 'luk.json', [blok1]).some((f) => f.includes('Formuleert een onderzoeksvraag')));
  l = kopie(); l.onderdelen.forEach((r) => { r.bewijs = r.bewijs.filter((id) => id !== 'EV-05'); });
  assert.ok(controleerLuk(l, 'luk.json').some((f) => f.includes('EV-05') && f.includes('geen enkel onderdeel')));
  const b = JSON.parse(JSON.stringify(blok1)); b.taken[1].luk = [2];
  assert.ok(controleerLuk(luk, 'luk.json', [b]).some((f) => f.includes('claimt LUK 2')));
});

test('BW-13/DS-9: bouwLeeruitkomsten geeft LUK 1, 2 en 5 met 10, 1 en 2 onderdelen', () => {
  const l = bouwLeeruitkomsten(luk, {});
  assert.deepEqual(l.map((x) => [x.luk, x.ids.length]), [[1, 10], [2, 1], [5, 2]]);
  assert.ok(l.every((x) => x.status === 'nog niet' && x.ontbreekt.length === x.ids.length));
});
