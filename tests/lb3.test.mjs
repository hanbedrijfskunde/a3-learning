// Leerblok 3 (fase 10): controles van EV-06, EV-07 en EV-08, het raster, het register, de samenhang met leerblok 1,
// de TOM³-indeling, de eigen samenvatting (LI-3) en docentmodus deel 2 (DM-18).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stakeholdersAantal, internEnExtern, stakeholderVelden, gebruikerInLijst, beweringenGelabeld, feitMetHerkomst, aannameMetZoekvraag,
  minGevuld, hardstBinnenGeraakt, noemtStakeholder, alleAangevinkt, gebruikerStaatInLijst, noemtEenVan, woordStammen,
} from '../js/checks/lb3.js';
import { stakeholdersUit, bouwRaster, rasterTekst, KWADRANTEN, reeks, stakeholderRijen } from '../js/raster.js';
import { expandeerVelden, normaliseerBlok } from '../js/blok.js';
import { maakStore, geheugenOpslag } from '../js/store.js';
import { maakSessie } from '../js/sessie.js';
import { wisselContext } from '../js/wissel.js';
import { bouwControles } from '../js/checks/index.js';
import { controleerMap, controleerDocent, controleerLeerblok, controleerFormaat } from '../tools/content-check.mjs';
import { gedeeldeReeksen, zoekOvername, teksten } from '../tools/overlap-check.mjs';
import { maakKlok } from '../js/docent/klok.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const blok1 = json('data/leerblok-1.json');
const blok3 = normaliseerBlok(json('data/leerblok-3.json'));
const taak = (id) => blok3.taken.find((t) => t.id === id);
const kopie = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- testgegevens

const S = 's'; // stakeholders: s1naam, s1soort, s1raakt, s1invloed, s1belang
const LIJST = [
  ['Terugkerende klanten', 'extern', 'merken de late bezorging', 'laag', 'hoog'],
  ['Klantenservice', 'intern', 'krijgt de klachten', 'laag', 'hoog'],
  ['Directie', 'intern', 'wil een betere waardering', 'hoog', 'hoog'],
  ['Bezorgdienst', 'extern', 'levert de pakketten', 'hoog', 'laag'],
  ['Marketing', 'intern', 'ziet de reviews', 'laag', 'laag'],
];
const zetStakeholders = (lijst) => Object.fromEntries(lijst.flatMap(([naam, soort, raakt, invloed, belang], i) => [
  [`${S}${i + 1}naam`, naam], [`${S}${i + 1}soort`, soort], [`${S}${i + 1}raakt`, raakt], [`${S}${i + 1}invloed`, invloed], [`${S}${i + 1}belang`, belang]]));
const EV06 = { vraagstuk: 'De waardering van terugkerende klanten van webshop X daalt.', ...zetStakeholders(LIJST), merktEerst: 'De klantenservice.', belangHuidig: 'De bezorgdienst.' };

const EV01 = { gebruiker: 'terugkerende klanten van webshop X', pain: 'snel te weten waar hun pakket is', waarde: 'de klantrelatie herstelt', kapitalen: ['sociaal en relationeel'] };
const EV02 = { zoekvraag1: 'Welke factoren bepalen de klanttevredenheid bij webshops?', zoekvraag2: 'Hoe beleven klanten de bezorging?', zoekvraag3: 'Wat zegt de literatuur over bezorgtijd?' };

const TOM = { tomS1: 'Geen norm voor de doorlooptijd', tomT1: 'Afspraken met de bezorgdienst', tomT3: 'Geen overzicht van zendingen', tomO4: 'Bezorgtijden per zending', niveau: 'tactisch', niveauWaarom: 'De afspraken tussen afdeling en bezorgdienst zijn het probleem.' };
const REGISTER = {
  b1tekst: 'Klanten wachten te lang op hun pakket', b1label: 'aanname', b1onderdeel: 'pain', b1zoek: 'zoekvraag 2',
  b2tekst: 'De bezorgtijd staat in de klachtenlijst', b2label: 'feit', b2onderdeel: 'gain', b2bron: 'Klachtenlijst klantenservice',
  b3tekst: 'Kernpartners bepalen de levertijd', b3label: 'aanname', b3onderdeel: 'bouwsteen', b3zoek: 'zoekvraag 3',
};
const EV07 = { ...TOM, ...REGISTER };
const CONCL = {
  conclStakeholders: 'De klantenservice merkt het probleem het eerst en de directie kan het oplossen.',
  conclKlant: 'Voor de terugkerende klanten ontbreekt de fit bij de bezorging.',
  conclOrganisatie: 'In de organisatie speelt het bij de bezorgdienst en de rapportage aan de directie.',
  conclusie: 'Het vraagstuk zit bij de bezorging.',
};
const EV08 = {
  ...CONCL, vraag: 'Wat is de beste oplossing voor terugkerende klanten om sneller te weten waar hun pakket is, zodat de klantrelatie herstelt?',
  vraagSoort: 'aanname', vpcCheck: ['Pain of gain in mijn onderzoeksvraag klopt met mijn VPC', 'Waarde in mijn onderzoeksvraag klopt met mijn VPC'],
  foto1: ['Foto gemaakt'], foto2: ['Foto gemaakt'], foto3: ['Foto gemaakt'], foto4: ['Foto gemaakt'],
};

function nieuw({ eerder = true } = {}) {
  let t = Date.parse('2026-09-30T12:00:00Z');
  const nu = () => new Date((t += 1000));
  const store = maakStore(geheugenOpslag());
  const s1 = maakSessie({ store, blok: blok1, elearning: '0.1.0', nu });
  if (eerder) { s1.bewaar('2.1', EV01); s1.bewaar('2.2', { ...EV02, frame1: 'functioneel', frame2: 'intern of extern', frame3: 'theoretisch of empirisch', model: '7S', verantwoording: 'Past bij het vraagstuk.', mis: 'De klant.' }); }
  const sessie = maakSessie({ store, blok: blok3, elearning: '0.1.0', nu, context: () => wisselContext(store) });
  return { store, sessie };
}

// ---------------------------------------------------------------- het contract van het blok

test('TK-2/QA-3: leerblok 3 heeft de 6 taken van het LRD en elke taak heeft waarom, klaar als, LUK-koppeling, controle en modelantwoord', () => {
  assert.deepEqual(blok3.taken.map((t) => t.id), ['5.1', '6.1', '7.1', '8.1', '9.1', '9.2']);
  for (const t of blok3.taken) {
    assert.ok(t.waarom.tekst && t.klaarAls.tekst && t.modelantwoord && t.controles.length > 0 && t.luk.length > 0 && t.bc.length > 0, t.id);
  }
  assert.deepEqual(controleerLeerblok(blok3, 'leerblok-3.json'), []);
  assert.deepEqual(controleerFormaat(blok3, 'leerblok-3.json').fouten, []);
  assert.deepEqual(blok3.bewijsonderdelen.map((b) => [b.id, b.taak]), [['EV-06', '5.1'], ['EV-07', '8.1'], ['EV-08', '9.2']]);
});

test('10.1: „Waarom” en „Klaar als” die de auteur nog moet goedkeuren hebben bron concept-auteur; wat in het werkboek staat blijft werkboek', () => {
  const bron = (t, veld) => taak(t)[veld].bron;
  assert.equal(bron('5.1', 'waarom'), 'werkboek');
  assert.equal(bron('5.1', 'klaarAls'), 'werkboek');
  assert.equal(bron('8.1', 'waarom'), 'werkboek');
  for (const [t, veld] of [['6.1', 'waarom'], ['6.1', 'klaarAls'], ['7.1', 'waarom'], ['7.1', 'klaarAls'], ['8.1', 'klaarAls'], ['9.1', 'waarom'], ['9.1', 'klaarAls'], ['9.2', 'waarom'], ['9.2', 'klaarAls']]) {
    assert.equal(bron(t, veld), 'concept-auteur', `${t} ${veld}`);
  }
});

test('BW-10: de drie samenhangcontroles van leerblok 3 staan in de data (soort B): EV-01 → EV-06, EV-07 → EV-02, EV-08 → EV-06', () => {
  const b = (t) => taak(t).controles.filter((c) => c.soort === 'B').map((c) => c.type);
  assert.ok(b('5.1').includes('gebruikerInLijst'));
  assert.ok(b('8.1').includes('aannameMetZoekvraag'));
  assert.ok(b('9.2').filter((t) => t === 'noemtStakeholder').length >= 1);
});

// ---------------------------------------------------------------- QA-2: 3 goede en 3 zwakke voorbeelden per controle

const R6 = { voor: S, aantal: 7 };
const CTX_EV01 = { eigen: { 'EV-01': { inhoud: EV01 }, 'EV-02': { inhoud: EV02 } } };
const CTX_EV06 = { records: { 'EV-06': { inhoud: EV06 } } };
const CONTROLES = {
  stakeholdersAantal: {
    controle: stakeholdersAantal({ id: 'n', ...R6, min: 5 }), soort: 'A',
    goed: [[EV06, 'ok'], [zetStakeholders([...LIJST, ['Leverancier', 'extern', 'levert', 'laag', 'laag']]), 'ok'], [{ ...zetStakeholders(LIJST), s6naam: '  ' }, 'ok']],
    zwak: [[{}, 'mist', 'minstens 5 stakeholders'], [zetStakeholders(LIJST.slice(0, 1)), 'let op', 'Je hebt 1 stakeholder'], [zetStakeholders(LIJST.slice(0, 4)), 'let op', 'Je hebt 4 stakeholders']],
  },
  internEnExtern: {
    controle: internEnExtern({ id: 'i', ...R6 }), soort: 'A',
    goed: [[EV06, 'ok'], [zetStakeholders(LIJST.slice(0, 2)), 'ok'], [zetStakeholders([LIJST[2], LIJST[3]]), 'ok']],
    zwak: [[{}, 'mist', 'minstens één intern'], [zetStakeholders([LIJST[1], LIJST[2]]), 'let op', 'geen extern'], [zetStakeholders([LIJST[0], LIJST[3]]), 'let op', 'geen intern']],
  },
  stakeholderVelden: {
    controle: stakeholderVelden({ id: 'v', ...R6 }), soort: 'A',
    goed: [[EV06, 'ok'], [zetStakeholders(LIJST.slice(0, 1)), 'ok'], [zetStakeholders(LIJST.slice(2)), 'ok']],
    zwak: [[{}, 'mist', 'Noteer stakeholders'], [{ ...EV06, s2invloed: '' }, 'let op', 'Klantenservice: invloed'], [{ ...EV06, s3belang: '', s3raakt: '' }, 'let op', 'Directie: belang en de relatie met het vraagstuk']],
  },
  gebruikerInLijst: {
    controle: gebruikerInLijst({ id: 'g', ...R6 }), soort: 'B', context: CTX_EV01,
    goed: [[EV06, 'ok'], [zetStakeholders([['Klanten', 'extern', 'x', 'laag', 'hoog']]), 'ok'], [zetStakeholders([['Klant', 'extern', 'x', 'laag', 'hoog']]), 'ok']],
    zwak: [[zetStakeholders(LIJST.slice(1)), 'mist', 'staat niet in je stakeholderlijst'], [{}, 'mist', 'staat niet in je stakeholderlijst'], [zetStakeholders([['Controller', 'intern', 'x', 'hoog', 'hoog']]), 'mist', 'terugkerende klanten van webshop X']],
  },
  beweringenGelabeld: {
    controle: beweringenGelabeld({ id: 'b', voor: 'b', aantal: 5, min: 3 }), soort: 'A',
    goed: [[REGISTER, 'ok'], [{ ...REGISTER, b4tekst: 'Vierde', b4label: 'feit', b4onderdeel: 'gain', b4bron: 'x' }, 'ok'], [{ b1tekst: 'a', b1label: 'feit', b1onderdeel: 'pain', b2tekst: 'b', b2label: 'aanname', b2onderdeel: 'gain', b3tekst: 'c', b3label: 'feit', b3onderdeel: 'pain' }, 'ok']],
    zwak: [[{}, 'mist', 'minstens 3 kernbeweringen'], [{ b1tekst: 'a', b1label: 'feit', b1onderdeel: 'pain' }, 'let op', 'minstens 3'], [{ ...REGISTER, b2label: '' }, 'let op', 'bewering 2: feit of aanname']],
  },
  feitMetHerkomst: {
    controle: feitMetHerkomst({ id: 'f', voor: 'b', aantal: 5 }), soort: 'A',
    goed: [[REGISTER, 'ok'], [{}, 'ok'], [{ b1tekst: 'a', b1label: 'aanname' }, 'ok']],
    zwak: [[{ b1tekst: 'a', b1label: 'feit' }, 'let op', 'bewering 1'], [{ ...REGISTER, b2bron: '  ' }, 'let op', 'bewering 2'], [{ b1tekst: 'a', b1label: 'feit', b1bron: 'x', b2tekst: 'b', b2label: 'feit' }, 'let op', 'bewering 2']],
  },
  aannameMetZoekvraag: {
    controle: aannameMetZoekvraag({ id: 'a', voor: 'b', aantal: 5 }), soort: 'B', context: CTX_EV01,
    goed: [[REGISTER, 'ok'], [{}, 'ok'], [{ b1tekst: 'a', b1label: 'feit', b1bron: 'x' }, 'ok']],
    zwak: [[{ b1tekst: 'a', b1label: 'aanname' }, 'let op', 'kies een zoekvraag'], [{ ...REGISTER, b3zoek: '' }, 'let op', 'bewering 3'], [{ b1tekst: 'a', b1label: 'aanname', b1zoek: 'zoekvraag 3', b2tekst: 'b', b2label: 'aanname' }, 'let op', 'bewering 2']],
  },
  minGevuld: {
    controle: minGevuld({ id: 'm', velden: ['a', 'b', 'c', 'd'], min: 3, label: 'de cellen' }), soort: 'C',
    goed: [[{ a: 'x', b: 'y', c: 'z' }, 'ok'], [{ a: 'x', b: 'y', c: 'z', d: 'w' }, 'ok'], [{ b: 'x', c: 'y', d: 'z' }, 'ok']],
    zwak: [[{}, 'mist', 'minstens 3 velden'], [{ a: 'x' }, 'let op', '1 van de 3'], [{ a: 'x', b: '  ', c: 'z' }, 'let op', '2 van de 3']],
  },
  hardstBinnenGeraakt: {
    controle: hardstBinnenGeraakt({ id: 'h', veld: 'hardst', geraaktVeld: 'geraakt' }), soort: 'B',
    goed: [[{ hardst: 'Kanalen', geraakt: ['Kanalen', 'Kernpartners'] }, 'ok'], [{ hardst: 'Kanalen' }, 'ok'], [{}, 'ok']],
    zwak: [[{ hardst: 'Kanalen', geraakt: ['Kernpartners'] }, 'let op', 'niet aangevinkt'], [{ hardst: 'Kosten', geraakt: ['Kanalen'] }, 'let op', 'Kosten'], [{ hardst: 'Kernactiviteiten', geraakt: ['Kanalen', 'Klantrelaties'] }, 'let op', 'Kernactiviteiten']],
  },
  noemtStakeholder: {
    controle: noemtStakeholder({ id: 'c', velden: ['a', 'b'], ...R6, label: 'je antwoorden' }), soort: 'B', context: CTX_EV06,
    goed: [[{ a: 'De klantenservice merkt het eerst.', b: 'De directie beslist.' }, 'ok'], [{ a: 'Klanten haken af bij de bezorging.' }, 'ok'], [{}, 'ok']],
    zwak: [[{ a: 'Het vraagstuk zit in de organisatie.' }, 'let op', 'minstens één stakeholder'], [{ a: 'De directie beslist.', b: 'Alles is duidelijk.' }, 'let op', 'dit antwoord'], [{ a: 'Iets over processen.', b: 'Iets over systemen.' }, 'let op', 'deze antwoorden']],
  },
  alleAangevinkt: {
    controle: alleAangevinkt({ id: 'p', velden: ['f1', 'f2'], label: 'de foto’s', leegIs: 'let op' }), soort: 'A',
    goed: [[{ f1: ['Foto gemaakt'], f2: ['Foto gemaakt'] }, 'ok'], [{ f1: ['x'], f2: ['y', 'z'] }, 'ok'], [{ f1: 'ja', f2: 'ja' }, 'ok']],
    zwak: [[{}, 'let op', '0 van 2'], [{ f1: ['Foto gemaakt'] }, 'let op', '1 van 2'], [{ f1: [], f2: ['x'] }, 'let op', '1 van 2']],
  },
};

for (const [naam, c] of Object.entries(CONTROLES)) {
  test(`QA-2: ${naam} heeft 3 goede en 3 zwakke voorbeelden met een melding die zegt wat ontbreekt`, () => {
    assert.equal(c.goed.length, 3);
    assert.equal(c.zwak.length, 3);
    for (const [invoer, verwacht] of c.goed) {
      const r = c.controle(invoer, c.context);
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.equal(r.soort, c.soort);
    }
    for (const [invoer, verwacht, deel] of c.zwak) {
      const r = c.controle(invoer, c.context);
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.ok(r.melding.includes(deel), `melding "${r.melding}" noemt niet "${deel}"`);
    }
  });
}

test('QA-2: alleAangevinkt met `veld` eist alle opties; niets is `mist`, een deel is `let op`', () => {
  const c = bouwControles([{ id: 'v', soort: 'A', type: 'alleAangevinkt', veld: 'vpcCheck', label: 'de vergelijking' }], taak('9.2').toepassing.velden)[0];
  assert.equal(c({}).resultaat, 'mist');
  assert.equal(c({ vpcCheck: [taak('9.2').toepassing.velden.find((v) => v.id === 'vpcCheck').opties[0]] }).resultaat, 'let op');
  assert.equal(c({ vpcCheck: EV08.vpcCheck }).resultaat, 'ok');
});

test('BW-8: de controles van leerblok 3 geven bij vreemde invoer geen fout maar een resultaat', () => {
  for (const t of blok3.taken) {
    for (const c of bouwControles(t.controles, t.toepassing.velden)) {
      for (const invoer of [undefined, null, {}, { x: 1 }, Object.fromEntries(t.toepassing.velden.map((v) => [v.id, 42]))]) {
        for (const context of [undefined, {}, { eigen: {}, records: {} }, { eigen: { 'EV-01': null }, records: { 'EV-06': { inhoud: null } } }]) {
          assert.doesNotThrow(() => c(invoer, context), `${t.id} ${invoer === undefined ? 'undefined' : JSON.stringify(invoer)?.slice(0, 20)}`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------- woorden vergelijken

test('BW-10: de gebruiker uit EV-01 wordt herkend bij enkelvoud, meervoud en een deel van de naam; een andere partij niet', () => {
  const lijst = (...namen) => namen.map((naam) => ({ naam }));
  assert.equal(woordStammen('Klanten')[0], woordStammen('klant')[0]);
  assert.ok(gebruikerStaatInLijst('terugkerende klanten van webshop X', lijst('Klant')));
  assert.ok(gebruikerStaatInLijst('de planners van de afdeling', lijst('Planners')));
  assert.ok(gebruikerStaatInLijst('de controller en de afdelingshoofden van organisatie Y', lijst('Afdelingshoofden')));
  assert.ok(!gebruikerStaatInLijst('terugkerende klanten van webshop X', lijst('Directie', 'Bezorgdienst', 'Marketing')));
  assert.ok(!gebruikerStaatInLijst('', lijst('Klanten')));
  assert.ok(noemtEenVan('De klantenservice merkt het eerst.', lijst('Klantenservice', 'Directie')));
  assert.ok(!noemtEenVan('Het zit in de organisatie.', lijst('Klantenservice', 'Directie')));
  // een naam van 4 woorden telt pas als er minstens 2 terugkomen
  assert.ok(!noemtEenVan('De afdeling merkt het.', lijst('Afdeling Klantcontact Noord West')));
  assert.ok(noemtEenVan('De afdeling klantcontact merkt het.', lijst('Afdeling Klantcontact Noord West')));
});

// ---------------------------------------------------------------- LB-9: het raster

test('LB-9: 7 stakeholders op een raster met 4 kwadranten; elke stakeholder staat in precies één vak', () => {
  const lijst = [...LIJST, ['Leverancier', 'extern', 'levert onderdelen', 'hoog', 'hoog'], ['Toezichthouder', 'extern', 'let op de regels', 'hoog', 'laag']];
  const r = bouwRaster(stakeholdersUit(zetStakeholders(lijst), stakeholderRijen(R6)));
  assert.equal(r.kwadranten.length, 4);
  assert.deepEqual(r.kwadranten.map((k) => k.id).sort(), KWADRANTEN.map((k) => k.id).sort());
  assert.equal(r.getekend, 7);
  assert.equal(r.kwadranten.reduce((n, k) => n + k.leden.length, 0), 7);
  const vak = (id) => r.kwadranten.find((k) => k.id === id).leden.map((s) => s.naam);
  assert.deepEqual(vak('nauw'), ['Directie', 'Leverancier']);
  assert.deepEqual(vak('tevreden'), ['Bezorgdienst', 'Toezichthouder']);
  assert.deepEqual(vak('informeren'), ['Terugkerende klanten', 'Klantenservice']);
  assert.deepEqual(vak('volgen'), ['Marketing']);
});

test('LB-9: het raster heeft een tekstweergave met één zin per stakeholder; wie nog niet is geplaatst staat er ook in', () => {
  const inhoud = { ...zetStakeholders(LIJST.slice(0, 2)), s3naam: 'Directie', s3invloed: 'hoog', s3soort: 'intern' };
  const r = bouwRaster(stakeholdersUit(inhoud, stakeholderRijen(R6)));
  assert.equal(r.getekend, 2);
  assert.equal(r.ongeplaatst.length, 1);
  const tekst = rasterTekst(r);
  assert.equal(tekst.length, 3);
  assert.ok(tekst.some((t) => t === 'Klantenservice (intern): invloed laag, belang hoog. Vak: Op de hoogte houden.'));
  assert.ok(tekst.some((t) => t === 'Directie (intern): kies nog belang.'));
  assert.deepEqual(rasterTekst(bouwRaster([])), []);
});

test('LB-9: een rij zonder naam bestaat niet; reeks schrijft de veld-id\'s van een reeks uit', () => {
  assert.equal(stakeholdersUit({ s1invloed: 'hoog' }, stakeholderRijen(R6)).length, 0);
  assert.deepEqual(reeks('s', 2, ['a', 'b']), [['s1a', 's1b'], ['s2a', 's2b']]);
  assert.equal(stakeholderRijen({ voor: 's', aantal: 7 }).length, 7);
});

test('LB-9: 5.1 heeft 7 rijen stakeholders met intern of extern, invloed en belang (hoog of laag) en een groep raster', () => {
  const velden = taak('5.1').toepassing.velden;
  for (const suffix of ['naam', 'soort', 'raakt', 'invloed', 'belang']) assert.equal(velden.filter((v) => v.id.endsWith(suffix) && /^s\d/.test(v.id)).length, 7, suffix);
  assert.deepEqual(velden.find((v) => v.id === 's1soort').opties, ['intern', 'extern']);
  assert.deepEqual(velden.find((v) => v.id === 's1invloed').opties, ['hoog', 'laag']);
  assert.deepEqual(velden.find((v) => v.id === 's1belang').opties, ['hoog', 'laag']);
  assert.ok(taak('5.1').toepassing.weergave.groepen.some((g) => g.raster?.voor === 's' && g.raster.aantal === 7));
});

// ---------------------------------------------------------------- LB-10 t/m LB-13: de vier producten, het TOM-model, het register, de conclusies

test('LB-10: elk van de 4 producten heeft een checklist en een vinkje „foto gemaakt”', () => {
  const velden = taak('9.2').toepassing.velden;
  for (let p = 1; p <= 4; p += 1) {
    const check = velden.find((v) => v.id === `check${p}`);
    const foto = velden.find((v) => v.id === `foto${p}`);
    assert.equal(check.type, 'meer'); assert.ok(check.opties.length >= 3, `checklist ${p}`);
    assert.deepEqual(foto.opties, ['Foto gemaakt']);
  }
  assert.deepEqual(['Stakeholdermap', 'Value Proposition Canvas', 'Business Model Canvas', 'TOM-model V1'].map((n) => velden.some((v) => v.label.includes(n))), [true, true, true, true]);
});

test('LB-11: het TOM-model V1 volgt TOM³: 3 lagen × 4 kolommen = 12 cellen, en er is geen keuze uit andere TOM-modellen', () => {
  const velden = taak('8.1').toepassing.velden;
  const cellen = velden.filter((v) => /^tom[STO][1-4]$/.test(v.id));
  assert.equal(cellen.length, 12);
  for (const laag of ['Strategisch', 'Tactisch', 'Operationeel']) for (const kolom of ['Methode', 'Mens', 'Machine', 'Informatie & Rapportage']) {
    assert.ok(cellen.some((c) => c.label === `${laag} · ${kolom}`), `${laag} · ${kolom}`);
  }
  const tabel = taak('8.1').toepassing.weergave.groepen.find((g) => g.tabel?.kolommen.includes('Methode')).tabel;
  assert.deepEqual(tabel.kolommen, ['Laag', 'Methode', 'Mens', 'Machine', 'Informatie & Rapportage']);
  assert.equal(tabel.rijen.length, 3);
  assert.ok(!velden.some((v) => (v.type === 'keuze' || v.type === 'lijst') && v.opties.some((o) => /zachman|togaf|target operating|tom-model|tom model/i.test(o))), 'geen keuze uit andere modellen');
});

test('LB-12: het register heeft minstens 3 beweringen met 3 velden (label, zoekvraag, onderdeel) en een herkomst bij een feit', () => {
  const velden = taak('8.1').toepassing.velden;
  const rijen = reeks('b', 5, ['tekst', 'label', 'onderdeel', 'bron', 'zoek']);
  assert.ok(rijen.length >= 3);
  for (const rij of rijen) for (const id of rij) assert.ok(velden.some((v) => v.id === id), id);
  assert.deepEqual(velden.find((v) => v.id === 'b1label').opties, ['feit', 'aanname']);
  assert.deepEqual(velden.find((v) => v.id === 'b1zoek').opties, ['zoekvraag 1', 'zoekvraag 2', 'zoekvraag 3']);
  for (const onderdeel of ['klanttaak', 'pain', 'gain', 'product of dienst', 'pain reliever', 'gain creator', 'bouwsteen']) assert.ok(velden.find((v) => v.id === 'b1onderdeel').opties.includes(onderdeel), onderdeel);
});

test('LB-13: 3 conclusies en 1 herziene onderzoeksvraag, elk met een controle tegen de stakeholderlijst', () => {
  const velden = taak('9.2').toepassing.velden.map((v) => v.id);
  for (const id of ['conclStakeholders', 'conclKlant', 'conclOrganisatie', 'vraag', 'vraagSoort']) assert.ok(velden.includes(id), id);
  const b = taak('9.2').controles.filter((c) => c.type === 'noemtStakeholder');
  assert.deepEqual(b.flatMap((c) => c.velden).sort(), ['conclKlant', 'conclOrganisatie', 'conclStakeholders', 'vraag']);
  assert.ok(taak('9.2').toepassing.weergave.groepen.some((g) => g.afgeleidVan === '9.1' && g.velden.length === 4));
});

// ---------------------------------------------------------------- de statussen van EV-06, EV-07 en EV-08 (sessie met records van leerblok 1)

test('EV-06: een volledige stakeholdertabel met de gebruiker uit EV-01 is Compleet; leeg is Nog niet', () => {
  const { sessie } = nieuw();
  assert.equal(sessie.beoordeel('5.1', EV06).status, 'compleet');
  assert.equal(sessie.beoordeel('5.1', {}).status, 'nog niet');
  const vier = sessie.beoordeel('5.1', { ...EV06, s5naam: '' });
  assert.equal(vier.status, 'bijna');
  assert.ok(vier.ontbreekt.some((o) => /minstens 5/.test(o.melding)));
});

test('BW-10 sabotage EV-06: haal de gebruiker uit EV-01 uit de stakeholderlijst; de samenhangcontrole faalt', () => {
  const { sessie } = nieuw();
  const zonder = sessie.beoordeel('5.1', { ...EV06, s1naam: 'Marketingbureau', s1soort: 'extern' });
  const c = zonder.uitkomsten.find((u) => u.id === 'gebruiker-in-lijst');
  assert.equal(c.soort, 'B');
  assert.equal(c.resultaat, 'mist');
  assert.match(c.melding, /terugkerende klanten van webshop X/);
  assert.equal(zonder.status, 'nog niet', 'een samenhangcontrole op mist geeft Nog niet');
  // herstel: de gebruiker staat er weer in
  assert.equal(sessie.beoordeel('5.1', EV06).uitkomsten.find((u) => u.id === 'gebruiker-in-lijst').resultaat, 'ok');
});

test('BW-10: zonder EV-01 kan de samenhang niet worden nagegaan (Bijna, met een zin die dat zegt); een gewijzigde EV-01 telt direct mee', () => {
  const leeg = nieuw({ eerder: false });
  const c = leeg.sessie.beoordeel('5.1', EV06).uitkomsten.find((u) => u.id === 'gebruiker-in-lijst');
  assert.equal(c.resultaat, 'let op');
  assert.match(c.melding, /nog leeg/);
  assert.equal(leeg.sessie.beoordeel('5.1', EV06).status, 'bijna');
  const { store, sessie } = nieuw();
  maakSessie({ store, blok: blok1, elearning: '0.1.0' }).bewaar('2.1', { ...EV01, gebruiker: 'de controllers van de afdeling' });
  assert.equal(sessie.beoordeel('5.1', EV06).uitkomsten.find((u) => u.id === 'gebruiker-in-lijst').resultaat, 'mist');
});

test('EV-07: het register met feit, herkomst, aanname en zoekvraag uit EV-02 is Compleet; een aanname zonder zoekvraag is Bijna', () => {
  const { sessie } = nieuw();
  const goed = sessie.beoordeel('8.1', EV07);
  assert.equal(goed.status, 'compleet');
  assert.deepEqual(goed.ontbreekt, []);
  const zonder = sessie.beoordeel('8.1', { ...EV07, b1zoek: '' });
  assert.equal(zonder.status, 'bijna');
  assert.ok(zonder.ontbreekt.some((o) => o.id === 'aanname-met-zoekvraag' && o.soort === 'B'));
  assert.equal(sessie.beoordeel('8.1', { ...EV07, b2bron: '' }).status, 'bijna');
  assert.equal(sessie.beoordeel('8.1', { ...EV07, b3label: '' }).status, 'bijna');
  assert.equal(sessie.beoordeel('8.1', {}).status, 'nog niet');
});

test('BW-10: een aanname wijst naar een zoekvraag die in EV-02 nog leeg is, of EV-02 ontbreekt: Bijna met een zin die dat zegt', () => {
  const zonderEv02 = nieuw({ eerder: false }).sessie.beoordeel('8.1', EV07);
  const c = zonderEv02.uitkomsten.find((u) => u.id === 'aanname-met-zoekvraag');
  assert.equal(c.resultaat, 'let op');
  assert.match(c.melding, /ontbreken nog/);
  const { store, sessie } = nieuw();
  maakSessie({ store, blok: blok1, elearning: '0.1.0' }).bewaar('2.2', { ...EV02, zoekvraag3: '', frame1: 'functioneel', frame2: 'intern of extern', frame3: 'theoretisch of empirisch', model: '7S', verantwoording: 'Past.', mis: 'De klant.' });
  const d = sessie.beoordeel('8.1', EV07).uitkomsten.find((u) => u.id === 'aanname-met-zoekvraag');
  assert.equal(d.resultaat, 'let op');
  assert.match(d.melding, /bewering 3: zoekvraag 3/);
});

test('EV-08: de conclusies noemen stakeholders uit EV-06, de vergelijking met het VPC en de 4 foto’s zijn gezet: Compleet', () => {
  const { store, sessie } = nieuw();
  sessie.bewaar('5.1', EV06);
  const goed = sessie.beoordeel('9.2', EV08);
  assert.equal(goed.status, 'compleet');
  const minder = sessie.beoordeel('9.2', { ...EV08, foto4: [] });
  assert.equal(minder.status, 'bijna', 'een foto die nog moet komen laat Bijna staan');
  assert.match(minder.ontbreekt.find((o) => o.id === 'foto-vinkjes').melding, /3 van 4/);
  assert.equal(sessie.beoordeel('9.2', { ...EV08, vpcCheck: [] }).status, 'nog niet');
  assert.equal(sessie.beoordeel('9.2', { ...EV08, vraagSoort: '' }).status, 'nog niet');
  assert.equal(store.get('EV-06').id, 'EV-06');
});

test('BW-10 sabotage EV-08 → EV-06: een conclusie zonder stakeholder uit de lijst, of zonder EV-06, geeft de samenhangcontrole op let op', () => {
  const { sessie } = nieuw();
  sessie.bewaar('5.1', EV06);
  const zonder = sessie.beoordeel('9.2', { ...EV08, conclKlant: 'De fit ontbreekt bij de bezorging van de pakketten.' });
  const c = zonder.uitkomsten.find((u) => u.id === 'conclusies-noemen-stakeholder');
  assert.equal(c.soort, 'B');
  assert.equal(c.resultaat, 'let op');
  assert.match(c.melding, /dit antwoord/);
  const geenLijst = nieuw().sessie.beoordeel('9.2', EV08).uitkomsten.find((u) => u.id === 'conclusies-noemen-stakeholder');
  assert.equal(geenLijst.resultaat, 'let op');
  assert.match(geenLijst.melding, /nog leeg/);
});

test('TK-4/RC-3: de records van leerblok 3 bewaren alleen velden van de toepassing en geen alias; EV-07 en EV-08 hebben de velden van hun taak', () => {
  const { store, sessie } = nieuw();
  sessie.bewaar('5.1', { ...EV06, alias: 'Piet', onzin: 'x' });
  sessie.bewaar('8.1', EV07);
  sessie.bewaar('9.2', EV08);
  const r6 = store.get('EV-06');
  assert.ok(!('alias' in r6.inhoud) && !('onzin' in r6.inhoud));
  assert.equal(r6.taak, '5.1'); assert.equal(r6.leerblok, 3); assert.deepEqual(r6.luk, [1]);
  assert.equal(store.get('EV-07').taak, '8.1');
  assert.equal(store.get('EV-08').taak, '9.2');
  assert.equal(store.get('EV-08').inhoud.conclKlant, EV08.conclKlant, 'de conclusies van 9.1 zitten in het record van EV-08');
  for (const id of ['EV-06', 'EV-07', 'EV-08']) assert.equal(store.get(id).status, 'compleet', id);
});

test('BW-1: een beoordeling van 8.1 met 50 velden duurt ver onder 1 s (100 aanroepen)', () => {
  const { sessie } = nieuw();
  const start = performance.now();
  for (let i = 0; i < 100; i += 1) sessie.beoordeel('8.1', { ...EV07, b1tekst: `bewering ${i}` });
  assert.ok(performance.now() - start < 1000);
});

// ---------------------------------------------------------------- het formaat: reeksen velden

test('QA-1: een reeks velden wordt rij voor rij uitgeschreven met het rijnummer in het label; gewone velden blijven staan', () => {
  const v = expandeerVelden([{ id: 'x', label: 'X', type: 'tekst' }, { reeks: { voor: 'r', aantal: 2, velden: [{ suffix: 'a', label: 'A {n}', type: 'tekst' }, { suffix: 'b', label: 'B {n}', type: 'lijst', opties: ['1', '2'] }] } }]);
  assert.deepEqual(v.map((f) => f.id), ['x', 'r1a', 'r1b', 'r2a', 'r2b']);
  assert.equal(v[3].label, 'A 2');
  assert.deepEqual(v[4].opties, ['1', '2']);
  assert.deepEqual(expandeerVelden(undefined), []);
});

test('QA-1: leerblok 3 op schijf gebruikt reeksen; na uitschrijven zijn er 38 velden bij 5.1 en 39 bij 8.1 en heeft elk veld een label en type', () => {
  const ruw = json('data/leerblok-3.json');
  assert.ok(ruw.taken[0].toepassing.velden.some((v) => v.reeks));
  assert.equal(taak('5.1').toepassing.velden.length, 3 + 35 - 0);
  assert.equal(taak('8.1').toepassing.velden.length, 12 + 2 + 25);
  for (const t of blok3.taken) for (const v of t.toepassing.velden) assert.ok(v.id && v.label && v.type, `${t.id} ${v.id}`);
});

// ---------------------------------------------------------------- LI-3 en BR-3: de eigen samenvatting van TOM³

test('LI-3: gedeeldeReeksen vindt een reeks van 8 woorden die gelijk is (hoofdletters en leestekens tellen niet), en geen van 7', () => {
  const bron = 'De pijler Methode omvat de logische inrichting van alle werkzaamheden, de procesarchitectuur en meer.';
  assert.deepEqual(gedeeldeReeksen('Let op: de logische inrichting van alle werkzaamheden, de procesarchitectuur!', bron), ['de logische inrichting van alle werkzaamheden de procesarchitectuur']);
  assert.deepEqual(gedeeldeReeksen('de logische inrichting van alle werkzaamheden de', bron), []);
  assert.deepEqual(gedeeldeReeksen('iets heel anders in een geheel andere volgorde van woorden zonder overlap', bron), []);
});

test('LI-3 sabotage: een zin uit een bron in een contentbestand wordt gevonden; opmerkingen van de bouwer en bronnenlijsten tellen niet', () => {
  const zin = 'Het TOM³-model biedt een pragmatisch antwoord op deze complexiteitsvalkuil door de organisatie rigoureus te ontleden';
  const map = kopieerData();
  const blok = json('data/leerblok-3.json');
  blok.taken[3].stof.alineas.push(zin);
  schrijf(map, 'leerblok-3.json', blok);
  const r = zoekOvername(map, zin);
  assert.ok(r.length > 0 && r.every((g) => g.bestand === 'leerblok-3.json'));
  blok.taken[3].stof.alineas.pop();
  blok.taken[3].stof.opmerking = zin; // een opmerking van de bouwer is geen tekst voor studenten
  schrijf(map, 'leerblok-3.json', blok);
  assert.deepEqual(zoekOvername(map, zin), []);
  assert.ok(teksten({ a: 'x', opmerking: 'y', b: ['z'] }).join() === 'x,z');
});

const LITS = resolve(root, '../c-cluster-1/lits');
const bronnenLits = ['TOM³ Model Buildplan en Scoreformulier.md', 'tom_model_interactive_dashboard_scoreformulier.html'].map((n) => resolve(LITS, n));
test('LI-3: 0 zinnen van 8 woorden of meer in de contentbestanden zijn gelijk aan het TOM³-buildplan of het dashboard (lits/)', {
  skip: bronnenLits.every(existsSync) ? false : `lits/ niet gevonden op ${LITS} (staat niet in deze repository)`,
}, () => {
  for (const pad of bronnenLits) assert.deepEqual(zoekOvername(resolve(root, 'data'), readFileSync(pad, 'utf8')), [], pad);
});

test('LB-11/BR-3: de TOM³-uitleg noemt de bron als (Westmoreland BV, z.d.); die staat als ongepubliceerd document met de organisatie op de bronnenpagina', () => {
  const stof = taak('8.1').stof.alineas.join(' ');
  assert.match(stof, /\(Westmoreland BV, z\.d\.\)/);
  const b3 = json('data/bronnen-3.json');
  const w = b3.bronnen.find((b) => b.citatie === 'Westmoreland BV, z.d.');
  assert.equal(w.type, 'ongepubliceerd');
  assert.equal(w.organisatie, 'Westmoreland BV');
  assert.match(w.apa, /\[Ongepubliceerd document\]/);
  assert.ok(!w.link);
  assert.ok(json('data/bronnen.json').bestanden.includes('bronnen-3.json'), 'bronnen-3.json staat in het manifest');
  assert.equal(b3.bronnen.length, 5); // met het BMC-sjabloon van Strategyzer (ADR B92)
});

test('10.9: content-check op de echte data is groen met bronnen-3 en meldt geen enkele bron in bronnen-3 als wees', () => {
  const r = controleerMap(resolve(root, 'data'));
  assert.deepEqual(r.fouten, []);
  assert.equal(r.bronbestanden, 4); // sinds fase 11 met bronnen-4
  assert.ok(!r.waarschuwingen.some((w) => /osterwalder|strategyzer|westmoreland/i.test(w) && /wachten nog/.test(w)));
});

// ---------------------------------------------------------------- DM-18: docentmodus deel 2

const deel1 = json('data/docent-deel1.json');
const deel2 = json('data/docent-deel2.json');
const blokken = { 1: blok1, 2: json('data/leerblok-2.json'), 3: blok3, 4: json('data/leerblok-4.json') };
const MIN = 60000;

test('DM-18: deel 2 heeft 8 onderdelen en 3 pauzes van samen 145 minuten; met deel 1 zijn dat 19 onderdelen en 3 pauzes', () => {
  const pauzes = deel2.onderdelen.filter((o) => o.soort === 'pauze');
  assert.equal(deel2.onderdelen.length - pauzes.length, 8);
  assert.equal(pauzes.length, 3);
  assert.equal(deel2.duurMinuten, 145);
  assert.equal(deel2.onderdelen.reduce((s, o) => s + o.minuten, 0), 145);
  const alle = [...deel1.onderdelen, ...deel2.onderdelen];
  assert.equal(alle.filter((o) => o.soort !== 'pauze').length, 19);
  assert.equal(alle.filter((o) => o.soort === 'pauze').length, 3);
});

test('DM-18: de klokstanden van deel 2 komen overeen met het draaiboek (0:05 stakeholders, 0:25 pauze, 0:30 VPC, 0:55 gallery walk, 1:05 BMC, 1:30 pauze, 1:35 TOM, 1:55 pauze, 2:00 conclusies, 2:20 afsluiting)', () => {
  let t = 0;
  const start = deel2.onderdelen.map((o) => { const s = t; t += o.minuten; return [o.titel.split(/[:,]/)[0], o.soort === 'pauze' ? 'pauze' : o.taak, s]; });
  assert.deepEqual(start.map(([, , s]) => s), [0, 5, 25, 30, 55, 65, 90, 95, 115, 120, 140]);
  assert.deepEqual(start.map(([, taakId]) => taakId), [null, '5.1', 'pauze', '6.1', '6.2', '7.1', 'pauze', '8.1', 'pauze', '9.1', null]);
});

test('DM-18/DM-2: elk onderdeel met taak verwijst naar een taak die bestaat (5.1, 6.1, 7.1, 8.1 en 9.1 in leerblok 3, de gallery walk 6.2 in leerblok 4) en herhaalt geen klaar-als of modelantwoord', () => {
  const r = controleerDocent(deel2, Object.values(blokken).map((b) => b), 'docent-deel2.json');
  assert.deepEqual(r.fouten, []);
  const taken = deel2.onderdelen.filter((o) => o.taak).map((o) => `${o.leerblok}:${o.taak}`);
  assert.deepEqual(taken, ['3:5.1', '3:6.1', '4:6.2', '3:7.1', '3:8.1', '3:9.1']);
});

test('DM-18 sabotage: deel 2 met 7 onderdelen, met 2 pauzes of met een verkeerde som van minuten laat content-check falen', () => {
  const zonder = kopie(deel2);
  zonder.onderdelen = zonder.onderdelen.filter((o) => o.id !== 'd2-11');
  zonder.duurMinuten = 140;
  assert.ok(controleerDocent(zonder, Object.values(blokken), 'docent-deel2.json').fouten.some((f) => /8 onderdelen/.test(f)));
  const eenPauze = kopie(deel2);
  eenPauze.onderdelen = eenPauze.onderdelen.filter((o) => o.id !== 'd2-09');
  eenPauze.duurMinuten = 140;
  assert.ok(controleerDocent(eenPauze, Object.values(blokken), 'docent-deel2.json').fouten.some((f) => /3 pauzes/.test(f)));
  const som = kopie(deel2);
  som.onderdelen[1].minuten = 21;
  assert.ok(controleerDocent(som, Object.values(blokken), 'docent-deel2.json').fouten.some((f) => /tellen op/.test(f)));
  const map = kopieerData();
  schrijf(map, 'docent-deel2.json', zonder);
  assert.ok(controleerMap(map).fouten.some((f) => /19 onderdelen/.test(f)));
});

test('DM-4/DM-6: de klok van deel 2 loopt, telt af per onderdeel, kent de pauzes en de gallery walk van 2 × 4 minuten en 2 minuten lezen', () => {
  let t = 1_700_000_000_000;
  const klok = maakKlok({ onderdelen: deel2.onderdelen, duurMinuten: deel2.duurMinuten, nu: () => t });
  klok.start();
  t += 2 * MIN;
  assert.equal(klok.toestand().actiefId, 'd2-01');
  assert.equal(klok.toestand().actief.resterend, 3 * MIN);
  klok.volgende(); klok.volgende();
  assert.equal(klok.toestand().actiefId, 'd2-03', 'na de stakeholders komt de pauze');
  assert.equal(klok.toestand().actief.resterend, 5 * MIN);
  klok.volgende(); klok.volgende();
  assert.equal(klok.toestand().actiefId, 'd2-05');
  assert.deepEqual(deel2.onderdelen.find((o) => o.id === 'd2-05').ronde, { rondes: 2, minutenPerRonde: 4, lezenMinuten: 2 });
  assert.equal(deel2.onderdelen.find((o) => o.id === 'd2-05').minuten, 2 * 4 + 2);
});

test('DM-17: deel 2 bevat geen beoordelingsinformatie en de docentpagina meldt beide delen aan', () => {
  assert.deepEqual(controleerDocent(deel2, Object.values(blokken), 'docent-deel2.json').fouten.filter((f) => /beoordelingsinformatie/.test(f)), []);
  assert.match(readFileSync(resolve(root, 'js/docent/pagina.js'), 'utf8'), /DELEN = \{ 1: 'data\/docent-deel1\.json', 2: 'data\/docent-deel2\.json' \}/);
  assert.doesNotMatch(readFileSync(resolve(root, 'data/docent-deel2.json'), 'utf8'), /alias|teamnummer|vraagstuk van de student/i);
});

// ---------------------------------------------------------------- TP: terugblik bij leerblok 3

test('TP-10/TP-11: leerblok 3 heeft een aanbevolen week en dag en laadt het scherm „Vorige keer” via leerblok.js', () => {
  const lb = json('data/leerblokken.json').leerblokken.find((b) => b.nummer === 3);
  assert.equal(lb.aanbevolen.week, 'Week 5');
  assert.match(lb.aanbevolen.dag, /deel 2/);
  assert.match(readFileSync(resolve(root, 'leerblok-3.html'), 'utf8'), /data-leerblok="3"[\s\S]*js\/leerblok\.js/);
  assert.ok(!existsSync(resolve(root, 'js/leerblok-stub.js')));
});

// ---------------------------------------------------------------- hulpfuncties voor kopieën van de data

import { mkdtempSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function kopieerData() {
  const map = mkdtempSync(join(tmpdir(), 'a3-lb3-'));
  cpSync(resolve(root, 'data'), map, { recursive: true });
  return map;
}
function schrijf(map, naam, inhoud) { writeFileSync(resolve(map, naam), JSON.stringify(inhoud)); }

test('LB-9: lb2-ui tekent het raster opnieuw bij elke wijziging van een veld (in de browser gecontroleerd met Playwright)', () => {
  const bron = readFileSync(resolve(root, 'js/lb2-ui.js'), 'utf8');
  assert.match(bron, /verversers\.forEach\(\(f\) => f\(\)\);\n    bijWijziging\(\);/);
  assert.match(bron, /rasterEl\(stakeholderRijen\(g\.raster\)/);
});
