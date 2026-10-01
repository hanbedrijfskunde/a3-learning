import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bouwTaakModel, bouwIndexModel, bouwAfsluitModel, oefenModel, modelZichtbaar, verhaalOpen, STAPPEN, BEWAARMELDING } from '../js/weergave.js';
import { isAfgerond, onderdeelTelt } from '../js/afgerond.js';
import { normaliseerProfiel, beoordeelProfiel, zichtbareMeldingen, PROFIEL_VELDEN } from '../js/profiel.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const blok = lees('data/leerblok-1.json');
const overzicht = lees('data/leerblokken.json');
const rec = (status, voorlopig = false) => ({ status, voorlopig });

test('TK-2: elke taak toont werkboeknummer, waarom, richttijd en „klaar als" (3 taken, 4 elementen)', () => {
  assert.equal(blok.taken.length, 3);
  for (const t of blok.taken) {
    const stap1 = bouwTaakModel(t, blok).stappen[0];
    assert.match(stap1.nummer, /^\d+\.\d+$/);
    assert.ok(stap1.waarom.tekst.length > 20, t.id);
    assert.ok(stap1.richttijd.tekst.length > 0, t.id);
    assert.ok(stap1.klaarAls.tekst.length > 20, t.id);
  }
  assert.deepEqual(blok.taken.map((t) => t.id), ['1.1', '2.1', '2.2']);
});

test('TK-18: elke taak heeft dezelfde vier stappen in dezelfde volgorde; de verdieping is geen stap (ADR B76)', () => {
  assert.deepEqual(STAPPEN, ['Waarom', 'Stof', 'Oefenen', 'Toepassen']);
  for (const t of blok.taken) {
    const m = bouwTaakModel(t, blok);
    assert.deepEqual(m.stappen.map((s) => s.nr), [1, 2, 3, 4], t.id);
    assert.ok('verdieping' in m, t.id);
    assert.ok(m.stappen[3].volgendeStapVraag, 'klaar en volgende stap sluiten Toepassen af');
    assert.deepEqual(m.stappen.map((s) => s.naam), STAPPEN, t.id);
  }
});

test('TK-3: elke taak heeft een oefenversie en een toepassing als twee gescheiden onderdelen', () => {
  for (const t of blok.taken) {
    const m = bouwTaakModel(t, blok);
    assert.ok(m.stappen[2].oefening.velden.length > 0, `oefening ${t.id}`);
    assert.ok(m.stappen[3].velden.length > 0, `toepassing ${t.id}`);
  }
});

test('TK-6: het taakmodel bevat het modelantwoord niet; het oefenmodel pas na een eigen poging', () => {
  for (const t of blok.taken) {
    assert.ok(!JSON.stringify(bouwTaakModel(t, blok)).includes(JSON.stringify(t.modelantwoord.velden)), t.id);
    assert.equal(oefenModel(t, { invoer: {} }).modelantwoord, null);
    const eerste = oefenModel(t, {}).velden[0].id;
    assert.deepEqual(oefenModel(t, { invoer: { [eerste]: 'x' } }).modelantwoord, t.modelantwoord);
  }
  const velden = [{ id: 'a' }, { id: 'b' }];
  assert.equal(modelZichtbaar(velden, {}), false);
  assert.equal(modelZichtbaar(velden, { a: '', b: [] }), false);
  assert.equal(modelZichtbaar(velden, { b: ['x'] }), true);
  assert.equal(modelZichtbaar(velden, { a: 'x' }, true), false); // overgeslagen
});

test('TK-13: de verdieping van leerblok 1 hangt aan „klaar" van de laatste taak en alleen daar', () => {
  const metVerdieping = blok.taken.filter((t) => bouwTaakModel(t, blok).verdieping);
  assert.deepEqual(metVerdieping.map((t) => t.id), ['2.2']);
  assert.match(bouwTaakModel(blok.taken[2], blok).verdieping.tekst, /vierde zoekvraag/);
});

// ------------------------------------------------------------ afgerond-regel (TK-16), 4 testprofielen

test('TK-16: vier testprofielen geven het verwachte resultaat', () => {
  const ids = ['EV-01', 'EV-02'];
  // 1. alles Compleet
  assert.equal(isAfgerond(ids, { 'EV-01': rec('compleet'), 'EV-02': rec('compleet') }).afgerond, true);
  // 2. Compleet en Bijna
  assert.equal(isAfgerond(ids, { 'EV-01': rec('compleet'), 'EV-02': rec('bijna') }).afgerond, true);
  // 3. één onderdeel „Nog niet" (of zonder record)
  assert.equal(isAfgerond(ids, { 'EV-01': rec('compleet'), 'EV-02': rec('nog niet') }).afgerond, false);
  assert.equal(isAfgerond(ids, { 'EV-01': rec('compleet') }).afgerond, false);
  // 4. „Nog niet" maar voorlopig telt mee
  assert.equal(isAfgerond(ids, { 'EV-01': rec('compleet'), 'EV-02': rec('nog niet', true) }).afgerond, true);
  // een voorlopig onderdeel zonder record telt niet: er is niets gedaan
  assert.equal(isAfgerond(ids, { 'EV-01': rec('compleet', true) }).afgerond, false);
});

test('TK-16: onderdeelTelt en een leerblok zonder onderdelen', () => {
  assert.equal(onderdeelTelt(undefined), false);
  assert.equal(onderdeelTelt(rec('bijna')), true);
  assert.equal(onderdeelTelt(rec('nog niet')), false);
  assert.equal(isAfgerond([], {}).afgerond, false);
  assert.equal(isAfgerond(['EV-01'], {}).onderdelen[0].status, 'nog niet');
});

test('TK-15: het afsluitscherm heeft status, volgende stap en bewaarmelding, ook zonder dat het leerblok is afgerond', () => {
  const m = bouwAfsluitModel(blok, {}, { href: 'leerblok-2.html', titel: 'Leerblok 2' });
  assert.deepEqual(m.onderdelen.map((o) => o.id), ['EV-01', 'EV-02']);
  assert.ok(m.onderdelen.every((o) => o.statusTekst === 'Te doen'));
  assert.ok(m.volgendeStapVraag.length > 0);
  assert.equal(m.bewaarmelding, BEWAARMELDING);
  assert.equal(m.afgerond, false);
  assert.match(m.afgerondTekst, /doorgaan/); // TK-17
  assert.equal(m.doorgaanBlokkeert, false);
});

// ------------------------------------------------------------ startpagina (LB-1, TK-1, ST-1, ST-2)

test('LB-1/TK-1: de startpagina toont vier leerblokken met hun richttijd en het afgeronde bewijs, allemaal direct te openen', () => {
  const m = bouwIndexModel(overzicht, {});
  assert.equal(m.length, 4);
  assert.deepEqual(m.map((b) => b.nummer), [1, 2, 3, 4]);
  assert.deepEqual(m.map((b) => b.titel), ['De A3 en je vraag', 'Zoeken, beoordelen en gebruiken', 'Het vraagstuk plaatsen', 'Verbinden en reflecteren']);
  assert.deepEqual(m.map((b) => Number.parseInt(b.richttijdTekst, 10)), [30, 45, 105, 45]); // B118: de som van de taken
  assert.ok(m.slice(1).every((b) => b.richttijdTekst.includes('hoogstens 15 min terugblik')));
  assert.ok(m.every((b) => /^leerblok-\d\.html$/.test(b.href) && b.afgerondBewijs.length > 0)); // geen voorwaarden
  assert.deepEqual(m[0].onderdelen.map((o) => o.id), ['EV-01', 'EV-02']);
  assert.deepEqual(m[3].onderdelen.map((o) => o.id), ['EV-11', 'EV-09', 'EV-10']);
});

test('LB-1: afgerond bewijs verschijnt op de startpagina bij het juiste leerblok', () => {
  const m = bouwIndexModel(overzicht, { 'EV-01': rec('compleet'), 'EV-02': rec('bijna') });
  assert.deepEqual(m.map((b) => b.afgerond), [true, false, false, false]);
  assert.equal(m[0].afgerondTekst, 'Afgerond');
  assert.equal(m[1].afgerondTekst, 'Te doen');
});

test('BW-4: het weergavemodel bevat geen score, percentage of punt', () => {
  const tekst = JSON.stringify(bouwIndexModel(overzicht, { 'EV-01': rec('compleet') })) + JSON.stringify(bouwAfsluitModel(blok, {}));
  assert.ok(!/score|punten|percentage|badge|ranglijst|%/i.test(tekst));
});

test('ST-1: de startinvoer vraagt precies alias, teamnummer, vraagstuk en waarom-zin, plus de keuze „nog geen scherp vraagstuk"', () => {
  assert.deepEqual(overzicht.start.velden.map((v) => v.id), ['alias', 'teamnummer', 'vraagstuk', 'waaromZin']);
  assert.deepEqual(overzicht.start.velden.map((v) => v.id), [...PROFIEL_VELDEN]);
  assert.ok(overzicht.start.voorlopigLabel.length > 0);
  // Onbekende sleutels (bv. e-mail) komen niet in het profiel.
  const p = normaliseerProfiel({ alias: ' Kim ', email: 'kim@example.org', voorlopig: true });
  assert.deepEqual(Object.keys(p).sort(), ['alias', 'teamnummer', 'voorlopig', 'vraagstuk', 'waaromZin']);
  assert.equal(p.alias, 'Kim');
  assert.equal(p.voorlopig, true);
});

test('ST-2: de privacytekst heeft ten hoogste 100 woorden en waarschuwt voor opdrachtgevers en vertrouwelijke gegevens', () => {
  const t = overzicht.start.privacytekst;
  const woorden = t.trim().split(/\s+/).length;
  assert.ok(woorden >= 20 && woorden <= 100, `${woorden} woorden`);
  assert.match(t, /opdrachtgevers/);
  assert.match(t, /vertrouwelijke/);
});

test('ST-1: het profiel geeft hints en blokkeert niets; „nog geen scherp vraagstuk" maakt vraagstuk en waarom-zin optioneel', () => {
  assert.equal(beoordeelProfiel({}).compleet, false);
  assert.deepEqual(Object.keys(beoordeelProfiel({}).hints).sort(), ['alias', 'teamnummer', 'vraagstuk', 'waaromZin']);
  assert.equal(beoordeelProfiel({ alias: 'Kim', teamnummer: '7', voorlopig: true }).compleet, true);
  const vol = { alias: 'Kim', teamnummer: '7', vraagstuk: 'Onze retouren duren te lang', waaromZin: 'Klanten wachten te lang' };
  assert.equal(beoordeelProfiel(vol).compleet, true);
  assert.ok(beoordeelProfiel({ ...vol, vraagstuk: 'Dit is zin een. Dit is zin twee.' }).hints.vraagstuk);
});

test('SX-2: bij het laden staat er geen melding; na het verlaten van een veld hoogstens één melding voor dat veld', () => {
  const hints = beoordeelProfiel({}).hints;
  assert.ok(Object.keys(hints).length >= 4, 'een leeg profiel heeft wel hints');
  assert.deepEqual(zichtbareMeldingen(hints, new Set()), {});
  const na = zichtbareMeldingen(hints, new Set(['alias']));
  assert.deepEqual(Object.keys(na), ['alias']);
  assert.equal(typeof na.alias, 'string');
  const bron = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../js/index-pagina.js'), 'utf8');
  assert.match(bron, /zichtbareMeldingen\(/, 'de startpagina toont meldingen via zichtbareMeldingen');
  assert.match(bron, /onblur: \(\) => \{ aangeraakt\.add\(v\.id\)/, 'een veld telt pas als aangeraakt na blur');
  assert.doesNotMatch(bron, /class: 'hints'/, 'geen lijst met alle meldingen tegelijk');
});

test('ST-8/ST-9, B119: het verhaal staat open tot de eerste taak; een ingevuld profiel telt niet mee', () => {
  assert.equal(verhaalOpen({}), true);
  assert.equal(verhaalOpen({ 'EV-01': undefined, 'EV-02': null }), true, 'ids zonder record tellen niet');
  assert.equal(verhaalOpen(undefined), true, 'zonder opslag: open');
  assert.equal(verhaalOpen({ 'EV-01': rec('bijna') }), false, 'werk in een leerblok');
  assert.equal(verhaalOpen({ 'EV-11': rec('compleet') }), false, 'werk in een later leerblok');
});

test('ST-8: weergave.js laadt profiel.js niet mee (bronnen en terugblik gebruiken weergave.js via metro-model.js)', () => {
  const bron = readFileSync(resolve(root, 'js/weergave.js'), 'utf8');
  assert.doesNotMatch(bron, /from '\.\/profiel\.js'/);
});

test('ST-8/ST-9, B119: de startpagina beslist één keer, bij het laden, zet het verhaal bovenaan en werkt zonder verhaal in de data', () => {
  const bron = readFileSync(resolve(root, 'js/index-pagina.js'), 'utf8');
  assert.equal((bron.match(/verhaalOpen\(/g) ?? []).length, 1, 'één beslissing');
  assert.ok(bron.indexOf('verhaalOpen(') < bron.indexOf('const bijwerken'), 'vóór er iets bewaard kan worden');
  assert.match(bron, /verhaalOpen\(leesRecords\(store, alleIds\)\)/, 'alleen werk telt, het profiel niet (B119)');
  assert.match(bron, /if \(verhaal && nogNietBegonnen\)/, 'zonder start.verhaal geen verhaal en geen fout');
  assert.match(bron, /h\('details', \{ class: 'verhaal verhaal-details' \}/, 'na de eerste taak een balk op dezelfde plek (B119)');
  assert.match(bron, /main\.append\(\.\.\.\[h1, verhaalEl, verder, a3, start1, blokken, gegevens\]\.filter\(Boolean\)\)/, 'het verhaal staat altijd bovenaan (B119)');
  const css = readFileSync(resolve(root, 'css/site.css'), 'utf8');
  assert.match(css, /\.verhaal \{[^}]*background:var\(--zwart\);[^}]*color:var\(--wit\);/, 'een zwart vlak met witte tekst (B119)');
  assert.match(bron, /invoer\.alias\.focus\(\)/, 'de knop zet de focus in het aliasveld');
  assert.match(bron, /h\('a', \{ class: 'knop', href: 'docs\/studentintroductie\.html' \}, verhaal\.introductie\.knop\)/, 'een knop naar de introductie (verzoek auteur)');
  assert.doesNotMatch(bron, /Nieuw hier\?/, 'de oude introductieregel is weg');
  assert.match(bron, /\.filter\(Boolean\)\)/, 'main.append krijgt geen null');
});

test('LB-1: titel en kop van elke leerblokpagina noemen de titel uit leerblokken.json (ADR B102: leerblok 2 kreeg een nieuwe naam)', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const lijst = JSON.parse(readFileSync(resolve(root, 'data/leerblokken.json'), 'utf8')).leerblokken;
  for (const lb of lijst) {
    const html = readFileSync(resolve(root, lb.pagina), 'utf8');
    assert.ok(html.includes(`<title>Leerblok ${lb.nummer} · ${lb.titel} ·`), `${lb.pagina}: title`);
    assert.ok(html.includes(`<h1>Leerblok ${lb.nummer} · ${lb.titel}</h1>`), `${lb.pagina}: h1`);
  }
});
