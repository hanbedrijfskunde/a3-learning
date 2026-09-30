import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maakStore, geheugenOpslag } from '../js/store.js';
import { maakSessie, COMPLEET_MELDING, leesRecords, volgendeStapOk } from '../js/sessie.js';
import { bewaarProfiel } from '../js/profiel.js';
import { valideer } from '../js/schema.js';
import '../js/checks/index.js'; // registreert alle controlefabrieken (PF-4: pagina's laden ze per leerblok)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blok = JSON.parse(readFileSync(resolve(root, 'data/leerblok-1.json'), 'utf8'));

const EV01 = { gebruiker: 'de planners van de afdeling', pain: 'sneller de roosters te maken', waarde: 'medewerkers minder stress hebben', kapitalen: ['menselijk'] };
const EV02 = {
  frame1: 'functioneel', zoekvraag1: 'Welke factoren spelen bij roosteren?',
  frame2: 'intern of extern', zoekvraag2: 'In hoeverre werkt het rooster intern?',
  frame3: 'theoretisch of empirisch', zoekvraag3: 'Wat zegt de literatuur over roosteren?',
  model: '7S', verantwoording: 'Het model past bij het vraagstuk.', mis: 'Je mist de kant van de klant.',
};

function nieuw(opslag = geheugenOpslag()) {
  let t = Date.parse('2026-09-30T12:00:00Z');
  const nu = () => new Date(t += 1000);
  const store = maakStore(opslag);
  return { opslag, store, sessie: maakSessie({ store, blok, elearning: '0.1.0', nu }) };
}
const alleRecordTekst = (store) => JSON.stringify(store.ids().map((id) => store.versions(id)));

test('BW-2/BW-5: beoordeel geeft per niet-ok controle één zin en de status uit de statusregel', () => {
  const { sessie } = nieuw();
  const b = sessie.beoordeel('2.1', { gebruiker: 'planners' });
  assert.equal(b.status, 'nog niet');
  assert.ok(b.ontbreekt.length >= 3);
  for (const o of b.ontbreekt) assert.ok(o.melding.endsWith('.') && o.melding.length > 8, o.melding);
  assert.equal(b.ontbreekt.length, b.uitkomsten.filter((u) => u.resultaat !== 'ok').length);
});

test('BW-6: bij Compleet staat de melding „Aanwezig en consistent…", anders niet', () => {
  const { sessie } = nieuw();
  const b = sessie.beoordeel('2.1', EV01);
  assert.equal(b.status, 'compleet');
  assert.equal(b.compleetMelding, 'Aanwezig en consistent. Of het goed is, bespreek je met je coach.');
  assert.equal(COMPLEET_MELDING, b.compleetMelding);
  assert.equal(sessie.beoordeel('2.1', { ...EV01, kapitalen: ['financieel'] }).compleetMelding, null);
});

test('BW-7: bij „Nog niet" staat de lijst met ontbrekende punten en een link naar het modelantwoord; anders niet', () => {
  const { sessie } = nieuw();
  const nog = sessie.beoordeel('2.1', {});
  assert.equal(nog.status, 'nog niet');
  assert.equal(nog.modelLink, '#oefening-2.1');
  assert.ok(nog.ontbreekt.length > 0);
  assert.equal(sessie.beoordeel('2.1', EV01).modelLink, null);
});

test('BW-1: een beoordeling duurt ver onder 1 s (100 aanroepen achter elkaar)', () => {
  const { sessie } = nieuw();
  const start = performance.now();
  for (let i = 0; i < 100; i += 1) sessie.beoordeel('2.2', { ...EV02, zoekvraag1: `vraag ${i}?` });
  assert.ok((performance.now() - start) / 100 < 50, 'gemiddeld meer dan 50 ms per beoordeling');
});

test('RC-5/RC-1: bewaar slaat een geldig record op en alleen bij een wijziging een nieuwe versie', () => {
  const { sessie, store } = nieuw();
  assert.equal(sessie.bewaar('2.1', {}).opgeslagen, false); // niets ingevuld: geen record
  assert.equal(store.get('EV-01'), undefined);
  const a = sessie.bewaar('2.1', EV01);
  assert.equal(a.opgeslagen, true);
  assert.equal(a.record.versie, 1);
  assert.equal(sessie.bewaar('2.1', EV01).opgeslagen, false); // ongewijzigd
  for (let i = 2; i <= 5; i += 1) sessie.bewaar('2.1', { ...EV01, gebruiker: `de planners van afdeling ${i}` });
  assert.deepEqual(store.versions('EV-01').map((v) => v.versie), [1, 2, 3, 4, 5]);
  assert.equal(valideer(store.get('EV-01'), { id: 'EV-01', taak: '2.1', leerblok: 1, luk: [1], bc: ['BC1'] }).geldig, true);
});

test('RC-2: luk en bc in het record komen uit de data, niet uit de invoer; extra sleutels in de invoer vallen weg', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.1', { ...EV01, luk: [5], bc: ['BC9'], alias: 'Kim', teamnummer: '7' });
  const r = store.get('EV-01');
  assert.deepEqual(r.luk, [1]);
  assert.deepEqual(r.bc, ['BC1']);
  assert.equal('alias' in r.inhoud, false);
  assert.equal('teamnummer' in r.inhoud, false);
  assert.equal('luk' in r.inhoud, false);
});

test('RC-3: het profiel (alias, teamnummer) staat apart en komt in geen enkel record', () => {
  const { sessie, store } = nieuw();
  bewaarProfiel(store, { alias: 'Kim', teamnummer: '7', vraagstuk: 'Onze retouren duren te lang', waaromZin: 'Klanten wachten te lang' });
  sessie.bewaar('2.1', EV01);
  sessie.bewaar('2.2', EV02);
  const tekst = alleRecordTekst(store);
  assert.ok(!tekst.includes('Kim'));
  assert.ok(!/teamnummer/i.test(tekst));
});

test('ST-3: na de keuze „nog geen scherp vraagstuk" is elk record voorlopig; zonder die keuze niet', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.1', EV01);
  assert.equal(store.get('EV-01').voorlopig, false);
  bewaarProfiel(store, { alias: 'Kim', teamnummer: '7', voorlopig: true });
  sessie.bewaar('2.1', { ...EV01, gebruiker: 'de planners van een andere afdeling' });
  sessie.bewaar('2.2', EV02);
  assert.equal(store.get('EV-01').voorlopig, true);
  assert.equal(store.get('EV-02').voorlopig, true);
});

test('DS-1: 0 verloren velden na herladen (nieuwe sessie op dezelfde opslag)', () => {
  const { sessie, opslag } = nieuw();
  sessie.bewaar('2.1', EV01);
  sessie.bewaar('2.2', EV02);
  sessie.bewaar('1.1', { aanleiding: 'De retouren duren te lang bij ons.' });
  sessie.zetOefening('2.1', { gebruiker: 'oefenwoord' });
  const na = nieuw(opslag).sessie;
  assert.deepEqual(na.leesToepassing('2.1'), EV01);
  assert.deepEqual(na.leesToepassing('2.2'), EV02);
  assert.deepEqual(na.leesToepassing('1.1'), { aanleiding: 'De retouren duren te lang bij ons.' });
  assert.equal(na.oefening('2.1').invoer.gebruiker, 'oefenwoord');
});

// ------------------------------------------------------------ oefenen en toepassen (TK-3…TK-7)

test('TK-6: het modelantwoord is verborgen zolang er niets is ingevuld en zichtbaar zodra er iets staat', () => {
  const { sessie } = nieuw();
  for (const id of ['1.1', '2.1', '2.2']) {
    assert.equal(sessie.oefening(id).modelZichtbaar, false, id);
    assert.equal(sessie.oefening(id).modelantwoord, null, id);
  }
  const veld = sessie.oefening('2.1').velden[0].id;
  assert.equal(sessie.zetOefening('2.1', { [veld]: '   ' }).modelZichtbaar, false); // spaties tellen niet
  assert.equal(sessie.zetOefening('2.1', { [veld]: 'klanten' }).modelZichtbaar, true);
  assert.ok(sessie.oefening('2.1').modelantwoord.velden.gebruiker);
});

test('TK-4: de oefencasus levert nooit een bewijsrecord op en oefeninvoer komt in geen enkel record terecht', () => {
  const { sessie, store } = nieuw();
  sessie.zetOefening('2.1', { gebruiker: 'OEFENMARKER-gebruiker', pain: 'OEFENMARKER-pain', waarde: 'OEFENMARKER-waarde', kapitalen: ['natuurlijk'] });
  sessie.zetOefening('2.2', { zoekvraag1: 'OEFENMARKER-zoekvraag?', model: '7S' });
  assert.deepEqual(store.ids(), []);
  sessie.bewaar('2.1', EV01);
  sessie.bewaar('2.2', EV02);
  assert.deepEqual(store.ids(), ['EV-01', 'EV-02']);
  assert.ok(!alleRecordTekst(store).includes('OEFENMARKER'));
});

test('TK-4: alleen de toepassing en de ingevulde controles zijn het bewijs', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.1', EV01);
  const r = store.get('EV-01');
  assert.deepEqual(Object.keys(r.inhoud).sort(), Object.keys(EV01).sort());
  assert.ok(r.controles.length > 0);
  assert.ok(r.controles.every((c) => Object.keys(c).sort().join() === 'id,resultaat'));
});

test('TK-5: „ik ken dit al" verandert 0 statussen en 0 records, en is terug te draaien', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.1', EV01);
  const voor = JSON.stringify(store.versions('EV-01'));
  const statusVoor = sessie.beoordeel('2.1', sessie.leesToepassing('2.1')).status;
  assert.equal(sessie.zetOverslaan('2.1', true).overgeslagen, true);
  assert.equal(JSON.stringify(store.versions('EV-01')), voor);
  assert.equal(sessie.beoordeel('2.1', sessie.leesToepassing('2.1')).status, statusVoor);
  assert.equal(sessie.zetOverslaan('2.1', false).overgeslagen, false);
});

test('TK-7: de oefening is minstens 10 keer achter elkaar te herhalen zonder blokkade', () => {
  const { sessie } = nieuw();
  for (let i = 1; i <= 12; i += 1) {
    sessie.zetOefening('2.1', { gebruiker: `poging ${i}` });
    assert.equal(sessie.oefening('2.1').modelZichtbaar, true);
    const na = sessie.herhaalOefening('2.1');
    assert.deepEqual(na.invoer, {});
    assert.equal(na.modelZichtbaar, false);
    assert.equal(na.pogingen, i);
  }
});

// ------------------------------------------------------------ klaar, volgende stap, verdieping

test('TK-8/TK-9: klaar werkt zodra de klaar-als is gehaald, bij 10 % en bij 150 % van de richttijd, en blokkeert niemand', () => {
  for (const minuten of [1, 5, 15, 40]) { // richttijd 10 min: 10 %, 50 %, 150 %, 400 %
    const start = Date.parse('2026-09-30T12:00:00Z');
    let nu = new Date(start);
    const store = maakStore(geheugenOpslag());
    const sessie = maakSessie({ store, blok, elearning: '0.1.0', nu: () => nu });
    sessie.bewaar('2.1', EV01);
    nu = new Date(start + minuten * 60000);
    assert.equal(sessie.markeerKlaar('2.1'), true, `na ${minuten} min`);
    assert.equal(sessie.isKlaar('2.1'), true);
  }
});

test('TK-8: klaar is er pas als de klaar-als is gehaald (niet bij Nog niet)', () => {
  const { sessie } = nieuw();
  assert.equal(sessie.markeerKlaar('2.1'), false);
  assert.equal(sessie.isKlaar('2.1'), false);
  sessie.bewaar('2.1', { ...EV01, kapitalen: ['financieel'] }); // Bijna
  assert.equal(sessie.markeerKlaar('2.1'), true);
});

test('TK-10: de volgende stap wordt bij het bewijsonderdeel opgeslagen (in het record, in inhoud)', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.1', { ...EV01, volgendeStap: 'Ik ga zoekvragen schrijven' });
  assert.equal(store.get('EV-01').inhoud.volgendeStap, 'Ik ga zoekvragen schrijven');
  assert.equal(volgendeStapOk('Ik ga zoekvragen schrijven'), true);
  assert.equal(volgendeStapOk('Zoeken'), false);
  assert.equal(volgendeStapOk('Ik ga'), false);
});

test('TK-14: de verdieping verandert geen enkele status of record en staat los van de richttijd', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.2', EV02);
  const voor = JSON.stringify(store.versions('EV-02'));
  const status = sessie.beoordeel('2.2', sessie.leesToepassing('2.2')).status;
  sessie.zetVerdieping({ tekst: 'Een vierde zoekvraag?', gedaan: true });
  assert.deepEqual(sessie.leesVerdieping(), { tekst: 'Een vierde zoekvraag?', gedaan: true });
  assert.equal(JSON.stringify(store.versions('EV-02')), voor);
  assert.deepEqual(store.ids(), ['EV-02']);
  assert.equal(sessie.beoordeel('2.2', sessie.leesToepassing('2.2')).status, status);
  assert.ok(!alleRecordTekst(store).includes('vierde zoekvraag'));
});

test('TK-15/TK-16/TK-17: afsluiten toont status, volgende stap en bewaarmelding; doorgaan wordt nooit geblokkeerd', () => {
  const { sessie } = nieuw();
  const leeg = sessie.afsluitModel({ href: 'leerblok-2.html', titel: 'Leerblok 2' });
  assert.equal(leeg.afgerond, false);
  assert.equal(leeg.doorgaanBlokkeert, false);
  assert.equal(leeg.volgende.href, 'leerblok-2.html');
  assert.ok(leeg.bewaarmelding.startsWith('Bewaar je dossier'));
  assert.deepEqual(leeg.onderdelen.map((o) => o.statusTekst), ['Nog niet', 'Nog niet']);
  sessie.bewaar('2.1', EV01);
  sessie.bewaar('2.2', EV02);
  sessie.bewaarVolgendeStap('Ik begin aan leerblok 2');
  const vol = sessie.afsluitModel(null);
  assert.equal(vol.afgerond, true);
  assert.equal(vol.volgendeStap, 'Ik begin aan leerblok 2');
  assert.deepEqual(vol.onderdelen.map((o) => o.statusTekst), ['Compleet', 'Compleet']);
});

test('leesRecords: id → nieuwste record of undefined', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('2.1', EV01);
  const r = leesRecords(store, ['EV-01', 'EV-02']);
  assert.equal(r['EV-01'].versie, 1);
  assert.equal(r['EV-02'], undefined);
});

test('taak zonder bewijsonderdeel (1.1): de toepassing komt niet in een record en de controles werken toch', () => {
  const { sessie, store } = nieuw();
  assert.equal(sessie.beoordeel('1.1', {}).heeftBewijs, false);
  sessie.bewaar('1.1', { aanleiding: 'De retouren duren te lang bij ons.' });
  assert.deepEqual(store.ids(), []);
  assert.equal(sessie.beoordeel('1.1', sessie.leesToepassing('1.1')).klaarMogelijk, true);
  assert.equal(sessie.markeerKlaar('1.1'), true);
});

test('sessie: een onbekende taak geeft een duidelijke fout', () => {
  assert.throws(() => nieuw().sessie.beoordeel('9.9', {}), /Onbekende taak 9\.9/);
});
