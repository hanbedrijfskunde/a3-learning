// Fase 7: terugblik en werken met tussenpozen (TP-1…TP-11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geheugenOpslag, maakStore } from '../js/store.js';
import { maakRecord } from '../js/schema.js';
import { maakDossier, controleerDossier, importeerDossier } from '../js/dossier.js';
import { bouwIndexModel } from '../js/weergave.js';
import {
  pauzeInDagen, bandbreedte, eisenVoor, pauzeTekst, telPunten, dossierControle, maakTerugblik,
  leesTerugblikLog, importeerTerugblikLog, UUR_MS, DAG_MS, GRENZEN,
} from '../js/terugblik.js';
import { controleerTerugblik, controleerOverzicht } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const terugblik = lees('data/terugblik.json');
const overzicht = lees('data/leerblokken.json');
const luk = lees('data/luk.json');
const titels = Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, b.titel]));

const NU = Date.parse('2026-10-20T12:00:00+02:00');
const EV = { 'EV-01': ['2.1', 1], 'EV-02': ['2.2', 1], 'EV-03': ['3.1', 2], 'EV-04': ['4.1', 2], 'EV-12': ['4.2', 2], 'EV-05': ['4.3', 2] };

/** Een record van een leerblok, laatst bijgewerkt `geleden` ms vóór NU. */
function record(id, geleden, inhoud = { antwoord: `Mijn ${id}` }) {
  const [taak, leerblok] = EV[id];
  return maakRecord({
    taakdef: { id, taak, leerblok, luk: [1], bc: ['BC1'] }, inhoud,
    controles: [{ id: 'velden-gevuld', resultaat: 'ok' }], status: 'compleet', versie: 1,
    bijgewerkt: new Date(NU - geleden).toISOString(), elearning: '0.1.0',
  });
}
/** Een student met werk uit leerblok 1, `geleden` ms geleden bijgewerkt. */
function student(geleden, ids = ['EV-01', 'EV-02']) {
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  for (const id of ids) store.save(record(id, geleden, { gebruiker: 'de planners', pain: 'sneller roosteren' }));
  return { store, opslag };
}
const nu = () => new Date(NU);
const maak = (store, leerblok = 2, extra = {}) => maakTerugblik({ store, terugblik, overzicht, leerblok, nu, titels, ...extra });
const PUNTEN = 'gebruiker\nprobleem of pain/gain\nwaardecreatie in zes kapitalen';
const ANTWOORDEN = ['gebruiker, probleem, waarde', 'zodat je meerdere invalshoeken hebt'];
const ZINNEN = ['Ik onderzoek nu eerst mijn eerste zoekvraag.', 'De zoektermen daarvoor haal ik uit mijn vraag.'];
const doeAlles = (t, m) => {
  t.zetOphalen({ punten: PUNTEN, antwoorden: ANTWOORDEN });
  return t.zetTransfer({ item: terugblik.kaarten[0].items[1], zinnen: ZINNEN });
};

// ------------------------------------------------------------ 7.1 en TP-1: de data

test('7.1/TP-1: terugblik.json heeft 3 kaarten met elk 2 kennisvragen, een transfervraag en items', () => {
  assert.deepEqual(terugblik.kaarten.map((k) => k.leerblok), [2, 3, 4]);
  for (const k of terugblik.kaarten) {
    assert.equal(k.kennisvragen.length, 2, `leerblok ${k.leerblok}`);
    assert.ok(k.items.length >= 4 && k.transfervraag && k.samenvatting.tekst);
  }
  assert.deepEqual(controleerTerugblik(terugblik).fouten, []);
});

test('TP-1: elke bandbreedte duurt hoogstens 15 min en het leerblok samen hoogstens 60 min', () => {
  for (const [band, b] of Object.entries(terugblik.bandbreedtes)) {
    assert.ok(b.minuten > 0 && b.minuten <= 15, band);
    assert.ok(45 + b.minuten <= 60, band);
  }
  assert.equal(terugblik.bandbreedtes.middel.minuten, 5); // TP-7: ongeveer 5 min
  for (const n of [2, 3, 4]) assert.equal(overzicht.leerblokken.find((b) => b.nummer === n).terugblik, 15);
});

test('content-check: een kaart met 1 kennisvraag, een terugblik van 20 min en een ontbrekende transfervraag geven elk een fout', () => {
  const stuk = structuredClone(terugblik);
  stuk.kaarten[0].kennisvragen.pop();
  stuk.bandbreedtes.lang.minuten = 20;
  delete stuk.kaarten[1].transfervraag;
  const { fouten } = controleerTerugblik(stuk);
  assert.equal(fouten.length, 3, fouten.join('\n'));
  assert.match(fouten.join('\n'), /precies 2 kennisvragen/);
  assert.match(fouten.join('\n'), /15 min/);
  assert.match(fouten.join('\n'), /transfervraag/);
});

// ------------------------------------------------------------ TP-6: de pauze uit de tijdstempels

test('TP-6: de pauze is het verschil tussen de tijdstempels, met 0 dagen afwijking, voor 4 profielen', () => {
  for (const [naam, geleden] of [['1 uur', UUR_MS], ['1 dag', DAG_MS], ['5 dagen', 5 * DAG_MS], ['14 dagen', 14 * DAG_MS]]) {
    const { store } = student(geleden);
    const records = store.ids().map((id) => store.get(id));
    assert.equal(pauzeInDagen(records, { leerblok: 2, nu: nu() }), geleden / DAG_MS, naam);
  }
});

test('TP-6: het laatste werk aan het vorige leerblok telt, ook uit een dossierexport; zonder werk is er geen pauze', async () => {
  const store = maakStore(geheugenOpslag());
  store.save(record('EV-01', 9 * DAG_MS));
  store.save(record('EV-02', 3 * DAG_MS));
  store.save(record('EV-03', 1 * DAG_MS)); // leerblok 2 telt niet mee bij het begin van leerblok 2
  assert.equal(pauzeInDagen(store.ids().map((i) => store.get(i)), { leerblok: 2, nu: nu() }), 3);
  const dossier = await maakDossier(store, { elearning: '0.1.0', nu });
  assert.equal(pauzeInDagen(dossier, { leerblok: 2, nu: nu() }), 3);
  assert.equal(pauzeInDagen([], { leerblok: 2, nu: nu() }), null);
  // leerblok 4 zonder werk uit 3: het laatste werk uit een eerder leerblok telt
  assert.equal(pauzeInDagen(store.ids().map((i) => store.get(i)), { leerblok: 4, nu: nu() }), 1);
});

test('TP-6: een tijdstempel in de toekomst geeft 0 dagen, geen negatieve pauze', () => {
  const { store } = student(-3 * DAG_MS);
  assert.equal(pauzeInDagen(store.ids().map((i) => store.get(i)), { leerblok: 2, nu: nu() }), 0);
});

// ------------------------------------------------------------ TP-7: de bandbreedtes

test('TP-7: 4 profielen (1 uur, 1 dag, 5 dagen, 14 dagen) geven kort, middel, volledig en lang', () => {
  const uit = [UUR_MS, DAG_MS, 5 * DAG_MS, 14 * DAG_MS].map((geleden) => {
    const { store } = student(geleden);
    return maak(store).model().band;
  });
  assert.deepEqual(uit, ['kort', 'middel', 'volledig', 'lang']);
});

test('TP-7: de grenzen 2 uur, 2 dagen en 14 dagen horen bij de hogere band, een milliseconde eronder bij de lagere', () => {
  const dagen = (ms) => ms / DAG_MS;
  assert.equal(bandbreedte(dagen(2 * UUR_MS - 1)), 'kort');
  assert.equal(bandbreedte(dagen(2 * UUR_MS)), 'middel');
  assert.equal(bandbreedte(dagen(2 * DAG_MS - 1)), 'middel');
  assert.equal(bandbreedte(dagen(2 * DAG_MS)), 'volledig');
  assert.equal(bandbreedte(dagen(14 * DAG_MS - 1)), 'volledig');
  assert.equal(bandbreedte(dagen(14 * DAG_MS)), 'lang');
  assert.equal(bandbreedte(0), 'kort');
  assert.equal(bandbreedte(400), 'lang');
  assert.equal(bandbreedte(null), 'volledig'); // onbekende pauze
  assert.deepEqual(GRENZEN, { kortTotMs: 2 * UUR_MS, middelTotMs: 2 * DAG_MS, volledigTotMs: 14 * DAG_MS });
});

test('TP-7: elke band vraagt wat de blueprint zegt: kort alleen transfer, middel 1 kennisvraag, volledig 3 punten en 2 kennisvragen, lang ook een samenvatting', () => {
  assert.deepEqual(eisenVoor('kort'), { punten: 0, kennisvragen: 0, kaart: false, samenvatting: false });
  assert.deepEqual(eisenVoor('middel'), { punten: 0, kennisvragen: 1, kaart: false, samenvatting: false });
  assert.deepEqual(eisenVoor('volledig'), { punten: 3, kennisvragen: 2, kaart: true, samenvatting: false });
  assert.deepEqual(eisenVoor('lang'), { punten: 3, kennisvragen: 2, kaart: true, samenvatting: true });
  assert.throws(() => eisenVoor('half'), /Onbekende bandbreedte/);
});

test('TP-7: het scherm toont per profiel de verwachte terugblik (kort: alleen transfer; middel: 1 kennisvraag; lang: samenvatting)', () => {
  const kort = maak(student(UUR_MS).store).model();
  assert.equal(kort.ophalen.kennisvragen.length, 0);
  assert.equal(kort.transfer.zichtbaar, true);
  assert.equal(kort.kaart, null);
  const middel = maak(student(DAG_MS).store).model();
  assert.equal(middel.ophalen.kennisvragen.length, 1);
  assert.equal(middel.transfer.zichtbaar, false); // eerst de kennisvraag
  const volledig = maak(student(5 * DAG_MS).store).model();
  assert.equal(volledig.ophalen.kennisvragen.length, 2);
  assert.equal(volledig.minuten, 15);
  const lang = maak(student(14 * DAG_MS).store);
  lang.zetOphalen({ punten: PUNTEN, antwoorden: ANTWOORDEN });
  assert.match(lang.model().kaart.samenvatting, /leerblok 1/);
  const volledigKlaar = maak(student(5 * DAG_MS).store);
  volledigKlaar.zetOphalen({ punten: PUNTEN, antwoorden: ANTWOORDEN });
  assert.equal(volledigKlaar.model().kaart.samenvatting, null);
});

test('TP-7: de pauze in woorden', () => {
  assert.match(pauzeTekst(0.01), /Minder dan een uur/);
  assert.match(pauzeTekst(1 / 24), /^1 uur geleden/);
  assert.match(pauzeTekst(1), /^1 dag geleden/);
  assert.match(pauzeTekst(5), /^5 dagen geleden/);
  assert.match(pauzeTekst(null), /nog geen werk/);
});

// ------------------------------------------------------------ TP-2 en TP-3: eerst ophalen, dan de kaart

test('TP-2: de kaart is 0 keer zichtbaar vóór 3 punten en 2 kennisvragen; daarna wel', () => {
  const t = maak(student(5 * DAG_MS).store);
  assert.equal(t.model().kaartZichtbaar, false);
  assert.equal(t.model().kaart, null);
  assert.equal(t.zetOphalen({ punten: 'één\ntwee', antwoorden: ANTWOORDEN }).kaartZichtbaar, false); // 2 punten
  assert.equal(t.zetOphalen({ punten: PUNTEN, antwoorden: [ANTWOORDEN[0]] }).kaartZichtbaar, false); // 1 kennisvraag
  assert.equal(t.zetOphalen({ punten: PUNTEN, antwoorden: [ANTWOORDEN[0], '  '] }).kaartZichtbaar, false); // leeg antwoord
  assert.equal(t.zetOphalen({ punten: 'a\n\n\nb\n.', antwoorden: ANTWOORDEN }).kaartZichtbaar, false); // lege regels en losse tekens tellen niet
  const klaar = t.zetOphalen({ punten: PUNTEN, antwoorden: ANTWOORDEN });
  assert.equal(klaar.kaartZichtbaar, true);
  assert.deepEqual(klaar.kaart.items, terugblik.kaarten[0].items);
});

test('TP-2: „ik weet het nog” maakt de kaart zichtbaar zonder ophalen (AC-38)', () => {
  const t = maak(student(5 * DAG_MS).store);
  assert.equal(t.model().kaartZichtbaar, false);
  assert.equal(t.weetHetNog().kaartZichtbaar, true);
});

test('TP-2: een korte of middellange pauze kent geen kaart; de items staan pas bij de transfervraag', () => {
  const t = maak(student(DAG_MS).store);
  const m = t.zetOphalen({ antwoorden: ['antwoord'] });
  assert.equal(m.kaartZichtbaar, false);
  assert.equal(m.transfer.zichtbaar, true);
  assert.deepEqual(m.transfer.items, terugblik.kaarten[0].items);
});

test('TP-2: telPunten telt regels met minstens twee letters of cijfers', () => {
  assert.equal(telPunten('a\nbb\n\n  \ncc dd\r\n-'), 2);
  assert.equal(telPunten(undefined), 0);
});

test('TP-3: de kaart heeft de items van 3 leerblokken en minstens 1 eigen bewijsstuk met zijn ingevulde velden', () => {
  for (const n of [2, 3, 4]) {
    const vorig = n - 1;
    const ids = overzicht.leerblokken.find((b) => b.nummer === vorig).bewijsonderdelen;
    const opslag = geheugenOpslag();
    const store = maakStore(opslag);
    store.save(record('EV-01', 5 * DAG_MS, { gebruiker: 'de planners', pain: 'sneller roosteren', kapitalen: ['menselijk', 'sociaal'] }));
    const t = maak(store, n);
    const m = t.weetHetNog();
    assert.deepEqual(m.kaart.items, terugblik.kaarten.find((k) => k.leerblok === n).items, `leerblok ${n}`);
    assert.deepEqual(m.kaart.eigenBewijs.map((b) => b.id), ids);
  }
  const store = maakStore(geheugenOpslag());
  store.save(record('EV-01', 5 * DAG_MS, { gebruiker: 'de planners', kapitalen: ['menselijk', 'sociaal'], leeg: '' }));
  const ev = maak(store, 2, { labels: { 'EV-01': { gebruiker: 'Gebruiker' } } }).weetHetNog().kaart.eigenBewijs;
  assert.deepEqual(ev[0].velden, [{ veld: 'gebruiker', label: 'Gebruiker', waarde: 'de planners' }, { veld: 'kapitalen', label: 'kapitalen', waarde: 'menselijk; sociaal' }]);
  assert.equal(ev[0].titel, titels['EV-01']);
  assert.equal(ev[1].heeftRecord, false); // EV-02 is er nog niet
});

// ------------------------------------------------------------ TP-4 en TP-5: transfer en overslaan

test('TP-4: de transfervraag wil 1 gekozen item en 2 zinnen van minstens 3 woorden; pas dan is de terugblik gedaan', () => {
  const t = maak(student(5 * DAG_MS).store);
  const item = terugblik.kaarten[0].items[0];
  t.zetOphalen({ punten: PUNTEN, antwoorden: ANTWOORDEN });
  assert.equal(t.model().transfer.vraag, terugblik.kaarten[0].transfervraag);
  assert.equal(t.zetTransfer({ item, zinnen: [ZINNEN[0]] }).status, 'open'); // 1 zin
  assert.equal(t.zetTransfer({ item, zinnen: [ZINNEN[0], 'te kort'] }).status, 'open'); // 2 woorden
  assert.equal(t.zetTransfer({ item: '', zinnen: ZINNEN }).status, 'open'); // geen item
  assert.equal(t.zetTransfer({ item: 'iets anders', zinnen: ZINNEN }).status, 'open'); // geen item uit de kaart
  const klaar = t.zetTransfer({ item, zinnen: ZINNEN });
  assert.equal(klaar.status, 'gedaan');
  assert.equal(klaar.transfer.geldig, true);
});

test('TP-4: de transfervraag is niet beschikbaar zolang het ophalen niet klaar is (volledige terugblik)', () => {
  const t = maak(student(5 * DAG_MS).store);
  assert.equal(t.model().transfer.zichtbaar, false);
  assert.deepEqual(t.model().transfer.items, []);
  // zonder ophalen kan de terugblik ook niet gedaan worden, hoe volledig de zinnen ook zijn
  assert.equal(t.zetTransfer({ item: terugblik.kaarten[0].items[0], zinnen: ZINNEN }).status, 'open');
});

test('TP-5: „ik weet het nog” is 1 klik en levert 0 bewijsrecords; ook de hele terugblik levert er 0', () => {
  const { store } = student(5 * DAG_MS);
  const voor = JSON.stringify(store.ids().map((id) => store.versions(id)));
  const t = maak(store);
  assert.equal(t.weetHetNog().status, 'overgeslagen');
  assert.equal(t.model().transfer.zichtbaar, false);
  const t3 = maak(store, 3);
  doeAlles(t3, terugblik.kaarten[1]);
  assert.deepEqual(store.ids(), ['EV-01', 'EV-02']);
  assert.equal(JSON.stringify(store.ids().map((id) => store.versions(id))), voor);
});

test('TP-5: na „toch de terugblik doen” begint de terugblik opnieuw, zonder log', () => {
  const { store } = student(5 * DAG_MS);
  const t = maak(store);
  t.weetHetNog();
  assert.equal(leesTerugblikLog(store).length, 1);
  const m = t.opnieuw();
  assert.equal(m.status, 'open');
  assert.equal(m.kaartZichtbaar, false);
  assert.deepEqual(leesTerugblikLog(store), []);
});

test('TP-2/TP-4: de invoer blijft staan na het herladen van de pagina', () => {
  const { store } = student(5 * DAG_MS);
  maak(store).zetOphalen({ punten: PUNTEN, antwoorden: ANTWOORDEN });
  const m = maak(store).model(); // een nieuwe instantie op dezelfde opslag
  assert.equal(m.ophalen.punten, 3);
  assert.equal(m.kaartZichtbaar, true);
});

// ------------------------------------------------------------ TP-8: het log

test('TP-8: het log heeft per leerblok 2 velden, de pauze in dagen en „gedaan” of „overgeslagen”', () => {
  const { store } = student(5 * DAG_MS);
  const t2 = maak(store, 2);
  doeAlles(t2);
  const t3 = maak(store, 3);
  t3.weetHetNog();
  assert.deepEqual(leesTerugblikLog(store), [
    { leerblok: 2, pauzeDagen: 5, status: 'gedaan' },
    { leerblok: 3, pauzeDagen: 5, status: 'overgeslagen' },
  ]);
  for (const e of leesTerugblikLog(store)) assert.deepEqual(Object.keys(e).sort(), ['leerblok', 'pauzeDagen', 'status']);
});

test('TP-8: het log bewaart de pauze in dagen met decimalen, zonder afronding (0 dagen afwijking)', () => {
  const { store } = student(5.25 * DAG_MS);
  doeAlles(maak(store));
  assert.equal(leesTerugblikLog(store)[0].pauzeDagen, 5.25);
});

test('TP-8: de pauze in het log is die van het moment waarop de terugblik klaar was, niet die van later', () => {
  const { store } = student(5 * DAG_MS);
  const later = { ms: NU };
  const t = maakTerugblik({ store, terugblik, overzicht, leerblok: 2, nu: () => new Date(later.ms), titels });
  doeAlles(t);
  later.ms += 3 * DAG_MS;
  assert.equal(leesTerugblikLog(store)[0].pauzeDagen, 5);
  assert.equal(t.model().pauzeDagen, 5); // ook het scherm toont de pauze van toen
});

test('TP-8: wordt de invoer weer onvolledig, dan is de terugblik niet meer „gedaan” en staat er geen log', () => {
  const { store } = student(5 * DAG_MS);
  const t = maak(store);
  doeAlles(t);
  assert.equal(leesTerugblikLog(store).length, 1);
  assert.equal(t.zetTransfer({ item: terugblik.kaarten[0].items[0], zinnen: [ZINNEN[0], ''] }).status, 'open');
  assert.deepEqual(leesTerugblikLog(store), []);
});

test('TP-8: het log gaat mee in de export van het dossier en terug bij de import, zonder bestaand log te overschrijven', async () => {
  const bron = student(5 * DAG_MS);
  doeAlles(maak(bron.store, 2));
  maak(bron.store, 3).weetHetNog();
  const dossier = await maakDossier(bron.store, { elearning: '0.1.0', nu });
  assert.equal(dossier.terugblik.length, 2);
  const u = await controleerDossier(JSON.stringify(dossier));
  assert.equal(u.status, 'ongewijzigd');

  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  importeerTerugblikLog(store, [{ leerblok: 2, pauzeDagen: 0.5, status: 'overgeslagen' }]);
  const r = importeerDossier({ store, opslag }, u.dossier);
  assert.deepEqual(r.terugblik, [3]);
  assert.deepEqual(leesTerugblikLog(store), [
    { leerblok: 2, pauzeDagen: 0.5, status: 'overgeslagen' },
    { leerblok: 3, pauzeDagen: 5, status: 'overgeslagen' },
  ]);
});

test('TP-8: een ongeldig log in een importbestand wordt genegeerd zonder fout', () => {
  const store = maakStore(geheugenOpslag());
  const slecht = [null, 'x', { leerblok: 1, pauzeDagen: 1, status: 'gedaan' }, { leerblok: 2, pauzeDagen: -1, status: 'gedaan' },
    { leerblok: 2, pauzeDagen: 1, status: 'ongeveer' }, { leerblok: 5, pauzeDagen: 1, status: 'gedaan' }];
  assert.deepEqual(importeerTerugblikLog(store, slecht), []);
  assert.deepEqual(importeerTerugblikLog(store, 'geen lijst'), []);
  assert.deepEqual(leesTerugblikLog(store), []);
});

// ------------------------------------------------------------ TP-9: de dossiercontrole

test('TP-9: na het leegmaken van de opslag 1 importaanbod en 1 lijst met ontbrekende onderdelen, en 0 verloren gegevens na import', async () => {
  const bron = student(5 * DAG_MS, ['EV-01', 'EV-02', 'EV-03']);
  const dossier = await maakDossier(bron.store, { elearning: '0.1.0', nu });
  const tekst = JSON.stringify(dossier);

  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  const leeg = dossierControle({ store, overzicht, leerblok: 3, titels });
  assert.equal(leeg.aanwezig, false);
  assert.equal(leeg.importAanbod, true);
  assert.deepEqual(leeg.ontbrekend.map((o) => o.id), ['EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-12', 'EV-05']);
  assert.equal(leeg.ontbrekend[0].titel, titels['EV-01']);

  const u = await controleerDossier(tekst);
  importeerDossier({ store, opslag }, u.dossier);
  const na = dossierControle({ store, overzicht, leerblok: 3, titels });
  assert.equal(na.aanwezig, true);
  assert.deepEqual(na.ontbrekend.map((o) => o.id), ['EV-04', 'EV-12', 'EV-05']); // die zaten niet in het dossier
  assert.equal(na.importAanbod, true);
  for (const id of bron.store.ids()) assert.deepEqual(store.get(id), bron.store.get(id), `${id} onveranderd`);
  assert.equal(store.ids().length, bron.store.ids().length);
  // en de pauze is na de import dezelfde: de tijdstempels zijn meegekomen
  assert.equal(maak(store).model().pauzeDagen, 5);
});

test('TP-9: is alles van eerdere leerblokken er, dan is er geen importaanbod', () => {
  const { store } = student(DAG_MS);
  const c = dossierControle({ store, overzicht, leerblok: 2, titels });
  assert.equal(c.importAanbod, false);
  assert.deepEqual(c.ontbrekend, []);
  assert.equal(c.verwacht, 2);
  // bij leerblok 1 is er niets eerders om te missen
  assert.deepEqual(dossierControle({ store: maakStore(geheugenOpslag()), overzicht, leerblok: 1 }).ontbrekend, []);
});

// ------------------------------------------------------------ TP-10: aanbevolen week en dag

test('TP-10: 4 leerblokken hebben een aanbevolen week en dag als tekst, en de index toont ze zonder iets te blokkeren', () => {
  assert.deepEqual(controleerOverzicht(overzicht), []);
  for (const b of overzicht.leerblokken) {
    assert.ok(typeof b.aanbevolen.week === 'string' && b.aanbevolen.week.length > 0, `leerblok ${b.nummer}`);
    assert.ok(typeof b.aanbevolen.dag === 'string' && b.aanbevolen.dag.length > 0, `leerblok ${b.nummer}`);
  }
  const model = bouwIndexModel(overzicht, {});
  assert.equal(model.filter((m) => m.aanbevolen.startsWith('Week ')).length, 4);
  // een leerblok is ook met een verkeerde week te doen: de afronding hangt er niet van af
  assert.equal(model.every((m) => m.afgerond === false), true);
});

test('TP-10: een leerblok zonder aanbevolen week en dag geeft een fout in de contentcontrole', () => {
  const stuk = structuredClone(overzicht);
  delete stuk.leerblokken[2].aanbevolen;
  assert.match(controleerOverzicht(stuk).join('\n'), /leerblok 3 mist aanbevolen/);
});

// ------------------------------------------------------------ TP-11: de pagina's

test('TP-11: leerblok 2, 3 en 4 laden het scherm „Vorige keer”; leerblok 1 niet', () => {
  const leerblokJs = readFileSync(resolve(root, 'js/leerblok.js'), 'utf8');
  assert.match(leerblokJs, /blok\.leerblok >= 2 \? await vorigeKeerSectie/);
  assert.match(readFileSync(resolve(root, 'leerblok-3.html'), 'utf8'), /js\/leerblok\.js/);
  assert.match(readFileSync(resolve(root, 'leerblok-4.html'), 'utf8'), /js\/leerblok\.js/);
  const pagina = readFileSync(resolve(root, 'js/terugblik-pagina.js'), 'utf8');
  const volgorde = ['dossiercontrole', 'terugblik', 'transfer'].map((o) => pagina.indexOf(`'data-onderdeel': '${o}'`));
  assert.ok(volgorde.every((i) => i > 0) && volgorde[0] < volgorde[1] && volgorde[1] < volgorde[2], `volgorde ${volgorde}`);
  assert.match(pagina, /tekenDossier\(\);\s+teken\(\);/);
  assert.match(pagina, /dossierGebied, terugblikGebied, transferGebied\)/);
});

test('B118: de terugblik noemt de richttijd van het eigen leerblok, geen vaste 45 min', () => {
  const bron = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../js/terugblik-pagina.js'), 'utf8');
  assert.doesNotMatch(bron, /bovenop de 45 min/);
  assert.match(bron, /bovenop de \$\{richttijd\} min van het leerblok/);
});
