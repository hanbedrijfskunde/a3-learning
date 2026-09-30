// Leerblok 4 (fase 11): de verbanden-kaart (EV-11, VB-1…VB-10), de STARR-reflectie (EV-10, LB-15), de samenhangcontroles (BW-10),
// „kopieer naar A3 vak 1” (LB-16, LB-17), de twee zinnen en het zwakste onderdeel (TK-11, TK-12), de verdiepingstaken
// (TK-13, TK-14), het voorlopig vraagstuk (ST-3…ST-5), het wisselblok met verbanden (WS-2, WS-7) en LI-2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/checks/index.js'; // registreert alle controlefabrieken (PF-4: pagina's laden ze per leerblok)
import * as core from '../js/checks/core.js';
import * as lb1 from '../js/checks/lb1.js';
import * as lb2 from '../js/checks/lb2.js';
import * as lb3 from '../js/checks/lb3.js';
import {
  starrDelen, volgendeStapReflectie, feedbackKoppeling, verbandenAanwezig, verbandenAantal, verbandTypen, verbandZinnen, kapitalenGemarkeerd,
  syntheseAlinea, syntheseKaarten, nietZienAntwoorden, userStoryVerbonden, kapitalenUitEv01Verbonden, spanningMetStakeholder,
  nietGelijkAanWissel, eigenNietGelijkAanWissel, FABRIEKEN as LB4,
} from '../js/checks/lb4.js';
import {
  KAPITALEN, TYPEN, SPANNING, MARKERINGEN, bouwKaarten, bouwOefenKaarten, maakVerband, openPlekken, markeringen, zetMarkering, chipTekst, syntheseModellen,
} from '../js/verbanden.js';
import { verbandRegel, verbandenUit } from '../js/verbandregel.js';
import { modulesVoor, MODULES_PER_LEERBLOK } from '../js/checks/register.js';
import { normaliseerBlok } from '../js/blok.js';
import { maakStore, geheugenOpslag } from '../js/store.js';
import { maakSessie } from '../js/sessie.js';
import { bewaarProfiel, leesProfiel } from '../js/profiel.js';
import { wisselContext } from '../js/context.js';
import { maakWisselblok, leesWisselblok, maakWissel, gelijkAanWissel } from '../js/wissel.js';
import { oefenModel } from '../js/weergave.js';
import { waardeTekst } from '../js/weergave.js';
import { maakA3Tekst } from '../js/a3tekst.js';
import { leesKopieLog, logKopie } from '../js/a3log.js';
import {
  maakDossier, controleerDossier, importeerDossier, bouwMijnStand, zwaksteOnderdeel, bouwTweeZinnen, bouwVersieVergelijking, bouwAfdruk, veldLabels, leesVerdiepingGedaan,
} from '../js/dossier.js';
import { controleerMap, controleerFormaat, controleerLeerblok } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const json = (p) => JSON.parse(lees(p));
const kopie = (x) => JSON.parse(JSON.stringify(x));
const blokken = [1, 2, 3, 4].map((n) => normaliseerBlok(json(`data/leerblok-${n}.json`)));
const [blok1, blok2, blok3, blok4] = blokken;
const luk = json('data/luk.json');
const taak = (id) => blok4.taken.find((t) => t.id === id);

// ---------------------------------------------------------------- testgegevens

const EV01 = { gebruiker: 'planners van de afdeling roosters', pain: 'ze wachten dagen op het definitieve rooster', waarde: 'sneller een rooster dat teams minder belast', kapitalen: ['menselijk', 'financieel'] };
const EV06 = {
  s1naam: 'Planners', s1soort: 'intern', s1raakt: 'werken met de roosters', s1invloed: 'hoog', s1belang: 'hoog',
  s2naam: 'Zorgmedewerkers', s2soort: 'intern', s2raakt: 'krijgen de roosters', s2invloed: 'laag', s2belang: 'hoog',
  s3naam: 'Teamleiders', s3soort: 'intern', s3raakt: 'keuren goed', s3invloed: 'hoog', s3belang: 'laag',
  s4naam: 'Inhuurbureau', s4soort: 'extern', s4raakt: 'levert invallers', s4invloed: 'laag', s4belang: 'laag',
  s5naam: 'Patiënten', s5soort: 'extern', s5raakt: 'merken de bezetting', s5invloed: 'laag', s5belang: 'hoog',
};
const EV07 = {
  b1tekst: 'Planners willen minder handwerk', b1label: 'feit', b1onderdeel: 'klanttaak', b1bron: 'interview',
  b2tekst: 'Late roosters leiden tot ziekmeldingen', b2label: 'aanname', b2onderdeel: 'pain', b2zoek: 'zoekvraag 1',
  b3tekst: 'Een tool die roosters voorstelt', b3label: 'feit', b3onderdeel: 'product of dienst', b3bron: 'leverancier',
  b4tekst: 'Conflicten automatisch signaleren', b4label: 'aanname', b4onderdeel: 'pain reliever', b4zoek: 'zoekvraag 2',
  b5tekst: 'Meer rust voor de teams', b5label: 'aanname', b5onderdeel: 'gain creator', b5zoek: 'zoekvraag 3',
  b6tekst: 'Bouwsteen kernpartners', b6onderdeel: 'bouwsteen',
};
const KAARTEN = bouwKaarten({ ev01: EV01, ev07: EV07 });
const maak = (van, naar, type, zin, stakeholder) => {
  const r = maakVerband({ van, naar, type, zin, stakeholder }, KAARTEN.kaarten, maak.lijst);
  assert.ok(r.ok, r.fout);
  maak.lijst.push(r.verband);
  return r.verband;
};
function zesVerbanden() {
  maak.lijst = [];
  maak('us:gebruiker', 'vpc:b1', 'hoort bij', 'De planner voert deze klanttaak elke week uit.');
  maak('us:pain', 'vpc:b2', 'hoort bij', 'De wachttijd is de pain van het klantprofiel.');
  maak('us:waarde', 'vpc:b4', 'leidt tot', 'Conflicten signaleren leidt tot een beter rooster.');
  maak('vpc:b4', 'kap:menselijk', 'leidt tot', 'Minder conflicten geven de teams meer rust.');
  maak('vpc:b5', 'kap:financieel', 'leidt tot', 'Rustiger teams verzuimen minder en dat scheelt geld.');
  maak('vpc:b3', 'kap:productie', SPANNING, 'Een tool vraagt investeringen in software en beheer.', 'Teamleiders');
  return maak.lijst.map((v) => ({ ...v }));
}
const V6 = zesVerbanden();
const MARK = KAPITALEN.map((k, i) => ({ kapitaal: k, waarde: MARKERINGEN[i % 3] }));
const SYNTHESE = { synthese: `De planner wil sneller roosters. ${chipTekst(KAARTEN.kaarten.get('us:gebruiker'))} ${chipTekst(KAARTEN.kaarten.get('kap:menselijk'))}`, syntheseKaarten: [{ id: 'us:gebruiker', tekst: chipTekst(KAARTEN.kaarten.get('us:gebruiker')) }, { id: 'kap:menselijk', tekst: chipTekst(KAARTEN.kaarten.get('kap:menselijk')) }] };
const NIETZIEN = { nietZien1: 'Het hoe en de prijs.', nietZien2: 'Negatieve uitkomsten en kapitalen.', nietZien3: 'De klanttaak van de planner.' };
const EV11 = { verbanden: V6, markering: MARK, ...SYNTHESE, ...NIETZIEN };
const STARR = { situatie: 'Oefenronde.', taak: 'Feedback geven.', actie: 'Ik beschreef en vroeg.', resultaat: 'Hij paste zijn vraag aan.', reflectie: 'Beschrijven werkt beter dan oordelen.', gedrag: blok4.taken[2].toepassing.velden.find((v) => v.id === 'gedrag').opties[4], volgende: 'Ik vraag eerst wat de ander mist' };
const CTX = { eigen: { 'EV-01': { inhoud: EV01 }, 'EV-06': { inhoud: EV06 } }, records: { 'EV-06': { inhoud: EV06 } } };

function nieuw({ profiel = { alias: 'Testa', teamnummer: '3', vraagstuk: 'Hoe verkorten we de wachttijd voor roosters?', waaromZin: 'Planners verliezen uren aan late roosters.', voorlopig: false }, voorEerder = true } = {}) {
  let t = Date.parse('2026-09-30T12:00:00Z');
  const nu = () => new Date((t += 1000));
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  bewaarProfiel(store, profiel);
  const sessie1 = maakSessie({ store, blok: blok1, elearning: '0.1.0', nu });
  const sessie3 = maakSessie({ store, blok: blok3, elearning: '0.1.0', nu, context: () => wisselContext(store) });
  if (voorEerder) {
    sessie1.bewaar('2.1', EV01);
    sessie3.bewaar('5.1', { vraagstuk: 'Roosterproces', ...EV06 });
    sessie3.bewaar('8.1', EV07);
  }
  const sessie = maakSessie({ store, blok: blok4, elearning: '0.1.0', nu, context: () => wisselContext(store) });
  return { store, opslag, sessie, nu };
}
const status = (sessie, id) => sessie.beoordeel(id, sessie.leesToepassing(id)).status;
const uitkomst = (b, id) => b.uitkomsten.find((u) => u.id === id);

// ---------------------------------------------------------------- 11.1 en 11.17: de inhoud van het blok

test('11.1/TK-2: leerblok 4 heeft de taken 9.4, 6.2 en 6.3, elk met waarom, klaar als, LUK-koppeling, controle en modelantwoord', () => {
  assert.deepEqual(blok4.taken.map((t) => t.id), ['9.4', '6.2', '6.3']);
  for (const t of blok4.taken) assert.ok(t.waarom.tekst && t.klaarAls.tekst && t.modelantwoord && t.controles.length > 0 && t.luk.length > 0 && t.bc.length > 0, t.id);
  assert.deepEqual(controleerLeerblok(blok4, 'leerblok-4.json'), []);
  assert.deepEqual(controleerFormaat(blok4, 'leerblok-4.json').fouten, []);
  assert.deepEqual(blok4.bewijsonderdelen.map((b) => [b.id, b.taak]), [['EV-11', '9.4'], ['EV-09', '6.2'], ['EV-10', '6.3']]);
});

test('11.1: „Waarom” en „Klaar als” die niet in het werkboek staan hebben bron concept-auteur (wacht op akkoord van de auteur); 6.2 blijft zoals het was', () => {
  for (const id of ['9.4', '6.3']) {
    assert.equal(taak(id).waarom.bron, 'concept-auteur', `${id} waarom`);
    assert.equal(taak(id).klaarAls.bron, 'concept-auteur', `${id} klaar als`);
  }
  assert.equal(taak('6.2').waarom.bron, 'werkboek');
  const c = controleerFormaat(blok4, 'leerblok-4.json');
  assert.ok(c.waarschuwingen.some((w) => /taak 9\.4: waarom/.test(w)), 'de bouwer meldt het concept in content-check');
});

test('11.17/BW-12/QA-3: alle 11 bewijsonderdelen komen in de leerblokken voor, elk met een taak met waarom en klaar als (11 van 11)', () => {
  const alle = blokken.flatMap((b) => b.bewijsonderdelen.map((e) => ({ ...e, taakDef: b.taken.find((t) => t.id === e.taak) })));
  assert.deepEqual(alle.map((e) => e.id).sort(), Array.from({ length: 11 }, (_, i) => `EV-${String(i + 1).padStart(2, '0')}`));
  for (const e of alle) assert.ok(e.taakDef?.waarom?.tekst && e.taakDef?.klaarAls?.tekst && e.lukOnderdelen.length > 0, e.id);
  const r = controleerMap(resolve(root, 'data'));
  assert.deepEqual(r.fouten, []);
  assert.equal(r.bronbestanden, 4);
});

test('11.16/LI-2: bronnen-4.json bevat het IIRC-kader, staat in het manifest en de content-check laat het niet als wees staan', () => {
  const b4 = json('data/bronnen-4.json');
  assert.deepEqual(b4.bronnen.map((b) => b.id), ['iirc-2021']);
  assert.ok(json('data/bronnen.json').bestanden.includes('bronnen-4.json'));
  const r = controleerMap(resolve(root, 'data'));
  assert.ok(!r.waarschuwingen.some((w) => /iirc/i.test(w) && /wachten nog/.test(w)));
  assert.ok(!json('data/bronnen-1.json').wachtOpCitatie.some((b) => b.id === 'iirc-2021'), 'de bron staat maar op één plek');
});

// ---------------------------------------------------------------- VB-1: drie kolommen en zes kapitalen

test('VB-1: de kaart heeft 3 kolommen (user story, VPC, zes kapitalen) met 3, alleen VPC-onderdelen en 6 kaarten', () => {
  assert.deepEqual(KAARTEN.kolommen.map((k) => k.id), ['us', 'vpc', 'kap']);
  assert.deepEqual(KAARTEN.kolommen.map((k) => k.kaarten.length), [3, 5, 6]);
  assert.deepEqual(KAPITALEN, ['financieel', 'productie', 'intellectueel', 'menselijk', 'sociaal en relationeel', 'natuurlijk']);
  assert.ok(!KAARTEN.kaarten.has('vpc:b6'), 'een bouwsteen is geen VPC-onderdeel');
  assert.deepEqual(KAARTEN.kolommen[2].kaarten.filter((k) => k.gekozen).map((k) => k.kop), ['financieel', 'menselijk']);
  assert.equal(KAARTEN.kaarten.get('us:gebruiker').tekst, EV01.gebruiker);
});

test('VB-1: zonder EV-01 en EV-07 zijn er nog wel 3 lege kaarten links en 6 kapitalen; het VPC is een lege kolom', () => {
  const leeg = bouwKaarten({});
  assert.deepEqual(leeg.kolommen.map((k) => k.kaarten.length), [3, 0, 6]);
});

// ---------------------------------------------------------------- VB-2: oefencasus, modelvoorbeeld pas na een eigen poging

test('VB-2: de oefencasus heeft 3 open vragen en een modelvoorbeeld met verbanden dat op de kaarten van de casus past', () => {
  const t = taak('9.4');
  assert.equal(t.oefening.velden.length, 3);
  assert.equal(t.oefening.component, 'verbanden');
  assert.equal(t.oefening.modelNa, 'lijn');
  assert.ok(t.modelantwoord.verbanden.length >= 5);
  const { kaarten } = bouwOefenKaarten(t.oefening.kaarten);
  assert.equal(kaarten.size, 3 + 5 + 6);
});

test('VB-2: 0 modelvoorbeelden zichtbaar vóór ≥ 1 getrokken lijn, ook niet als de drie vragen zijn beantwoord; daarna wel', () => {
  const t = taak('9.4');
  const antwoorden = { v1: 'Bij de klanttaak.', v2: 'Sociaal en financieel.', v3: 'Menselijk.' };
  assert.equal(oefenModel(t, { invoer: {} }).modelZichtbaar, false);
  const zonderLijn = oefenModel(t, { invoer: { ...antwoorden, verbanden: [] } });
  assert.equal(zonderLijn.modelZichtbaar, false);
  assert.equal(zonderLijn.modelantwoord, null);
  const { kaarten } = bouwOefenKaarten(t.oefening.kaarten);
  const lijn = maakVerband({ van: 'us:gebruiker', naar: 'vpc:b1', type: 'hoort bij', zin: 'Deze klant doet de klanttaak.' }, kaarten, []).verband;
  const met = oefenModel(t, { invoer: { verbanden: [lijn] } });
  assert.equal(met.modelZichtbaar, true);
  assert.equal(met.modelantwoord.verbanden.length, t.modelantwoord.verbanden.length);
  assert.equal(oefenModel(t, { invoer: { verbanden: [lijn] }, overgeslagen: true }).modelZichtbaar, false, 'wie de oefening overslaat, ziet het model niet');
});

test('VB-2: de andere taken tonen het modelantwoord nog steeds na één ingevuld veld (TK-6 blijft gelden)', () => {
  assert.equal(oefenModel(taak('6.3'), { invoer: { situatie: 'x' } }).modelZichtbaar, true);
  assert.equal(oefenModel(taak('6.3'), { invoer: {} }).modelZichtbaar, false);
});

// ---------------------------------------------------------------- VB-3: lijnen met type en zin

test('VB-3: een verband heeft één van 3 typen en een zin; twee kaarten in één kolom of tweemaal hetzelfde paar kan niet', () => {
  assert.deepEqual([...TYPEN], ['hoort bij', 'leidt tot', 'gaat ten koste van']);
  const k = KAARTEN.kaarten;
  assert.equal(maakVerband({ van: 'us:pain', naar: 'vpc:b2', type: 'hoort bij', zin: 'Dat is dezelfde pain.' }, k, []).ok, true);
  assert.equal(maakVerband({ van: 'us:pain', naar: 'vpc:b2', type: 'klopt met', zin: 'Dat is dezelfde pain.' }, k, []).ok, false, 'type buiten de drie');
  assert.equal(maakVerband({ van: 'us:pain', naar: 'vpc:b2', type: 'hoort bij', zin: 'Ja.' }, k, []).ok, false, 'te korte zin');
  assert.equal(maakVerband({ van: 'us:pain', naar: 'us:waarde', type: 'hoort bij', zin: 'Dat is dezelfde kolom.' }, k, []).ok, false, 'één kolom');
  assert.equal(maakVerband({ van: 'us:pain', naar: 'onbekend', type: 'hoort bij', zin: 'Dat bestaat niet.' }, k, []).ok, false);
  const eerste = maakVerband({ van: 'us:pain', naar: 'vpc:b2', type: 'hoort bij', zin: 'Dat is dezelfde pain.' }, k, []).verband;
  assert.equal(maakVerband({ van: 'vpc:b2', naar: 'us:pain', type: 'leidt tot', zin: 'Dat is een tweede verband.' }, k, [eerste]).ok, false, 'dezelfde twee kaarten, andere richting');
});

test('VB-3: `van` staat altijd in de kolom links van `naar`, ook als de student eerst de rechterkaart koos, en de teksten worden meegeslagen', () => {
  const v = maakVerband({ van: 'kap:menselijk', naar: 'vpc:b4', type: 'leidt tot', zin: 'Dat kapitaal komt hier vandaan.' }, KAARTEN.kaarten, []).verband;
  assert.equal(v.van, 'vpc:b4');
  assert.equal(v.naar, 'kap:menselijk');
  assert.equal(v.vpcOnderdeel, 'pain reliever');
  assert.match(v.vanTekst, /^pain reliever: Conflicten/);
});

test('VB-3: ≥ 6 lijnen in een testprofiel leveren EV-11 de status Compleet en 5 lijnen Bijna', () => {
  const { sessie } = nieuw();
  sessie.bewaar('9.4', EV11);
  assert.equal(sessie.leesToepassing('9.4').verbanden.length, 6);
  assert.equal(status(sessie, '9.4'), 'compleet');
  sessie.bewaar('9.4', { ...EV11, verbanden: V6.slice(0, 5) });
  const b = sessie.beoordeel('9.4', sessie.leesToepassing('9.4'));
  assert.equal(uitkomst(b, 'verbanden-aantal').resultaat, 'mist');
  assert.equal(b.status, 'bijna');
});

// ---------------------------------------------------------------- VB-4: open plekken als vraag

const ALLE_LABELS = () => [...KAARTEN.kaarten.values()].map((k) => k.label);
function controleerAlleenVragen(plekken, kaarten = KAARTEN) {
  for (const p of plekken) {
    assert.deepEqual(Object.keys(p).sort(), ['kaart', 'vraag'], 'geen antwoord, geen voorstel');
    assert.match(p.vraag, /\?$/, `een vraag: ${p.vraag}`);
    const eigen = kaarten.kaarten.get(p.kaart);
    for (const k of kaarten.kaarten.values()) {
      if (k.id === p.kaart) continue;
      assert.ok(!p.vraag.includes(k.label), `de vraag over ${eigen.label} noemt ook ${k.label}: dat is een antwoord`);
    }
  }
}

test('VB-4: in een leeg voorbeeld is 100 % van de open plekken een vraag en staat er 0 keer een verband als antwoord', () => {
  const plekken = openPlekken({ kaarten: KAARTEN.kaarten, verbanden: [] });
  assert.equal(plekken.length, 3 + 5 + 2, 'drie delen van de user story, vijf VPC-kaarten en de twee gekozen kapitalen');
  controleerAlleenVragen(plekken);
});

test('VB-4: in een half ingevuld voorbeeld blijven alleen de kaarten zonder lijn over, elk als vraag zonder het ontbrekende verband', () => {
  const half = V6.slice(0, 3);
  const plekken = openPlekken({ kaarten: KAARTEN.kaarten, verbanden: half });
  assert.ok(plekken.length > 0 && plekken.length < 10);
  controleerAlleenVragen(plekken);
  assert.ok(!plekken.some((p) => ['us:gebruiker', 'us:pain', 'us:waarde', 'vpc:b1', 'vpc:b2', 'vpc:b4'].includes(p.kaart)), 'verbonden kaarten zijn geen open plek');
  // een gekozen kapitaal zonder verband is een open plek; een niet gekozen kapitaal zonder verband niet
  assert.ok(plekken.some((p) => p.kaart === 'kap:financieel'));
  assert.ok(!plekken.some((p) => p.kaart === 'kap:natuurlijk'));
});

test('VB-4: als alles verbonden is, zijn er 0 open plekken; een leeg deel van de user story is geen open plek van deze kaart', () => {
  const alles = [...V6, ...[['us:gebruiker', 'vpc:b3'], ['vpc:b2', 'kap:menselijk']].map(([van, naar]) => ({ van, naar, id: `x${van}${naar}` }))];
  assert.deepEqual(openPlekken({ kaarten: KAARTEN.kaarten, verbanden: alles }), []);
  const zonderStory = bouwKaarten({ ev01: { gebruiker: '', pain: '', waarde: '' }, ev07: EV07 });
  assert.ok(!openPlekken({ kaarten: zonderStory.kaarten, verbanden: [] }).some((p) => p.kaart.startsWith('us:')));
});

// ---------------------------------------------------------------- VB-5: markering van de kapitalen

test('VB-5: 6 kapitalen en 3 markeringen; onbekende kapitalen of waarden vallen weg; wissen kan', () => {
  assert.deepEqual([...MARKERINGEN], ['input', 'uitkomst (+)', 'uitkomst (−)']);
  assert.equal(Object.keys(markeringen({ markering: MARK })).length, 6);
  assert.deepEqual(markeringen({ markering: [{ kapitaal: 'geld', waarde: 'input' }, { kapitaal: 'financieel', waarde: 'raar' }] }), {});
  const een = zetMarkering({ markering: [] }, 'natuurlijk', 'uitkomst (−)');
  assert.deepEqual(een, [{ kapitaal: 'natuurlijk', waarde: 'uitkomst (−)' }]);
  assert.deepEqual(zetMarkering({ markering: een }, 'natuurlijk', ''), []);
});

// ---------------------------------------------------------------- QA-2: 3 goede en 3 zwakke voorbeelden per nieuwe controle

const ZONDER_ZIN = V6.map((v, i) => (i < 2 ? { ...v, zin: '' } : v));
const TWEE_TYPEN = V6.map((v) => ({ ...v, type: 'hoort bij' }));
const ZONDER_SPANNING = V6.map((v) => ({ ...v, type: 'leidt tot', stakeholder: undefined }));
const CONTROLES = {
  starrDelen: { maak: () => starrDelen({ id: 'c' }), goed: [STARR, { ...STARR, actie: 'Ik deed veel.' }, { ...STARR, taak: 'Een andere taak.' }], zwak: [{}, { ...STARR, reflectie: '' }, { ...STARR, situatie: ' ', taak: '' }] },
  volgendeStapReflectie: { maak: () => volgendeStapReflectie({ id: 'c' }), goed: [STARR, { volgende: 'Ik vraag eerst wat hij mist' }, { volgende: 'Eerst luisteren, dan reageren' }], zwak: [{}, { volgende: '' }, { volgende: 'Beter' }] },
  feedbackKoppeling: { maak: () => feedbackKoppeling({ id: 'c' }), soort: 'B', ctx: { records: { 'EV-09': { inhoud: { regels: [{ id: 'r1' }, { id: 'r2' }] } } } }, goed: [{}, { feedbackregel: 'r1' }, { feedbackregel: 'r2' }], zwak: [{ feedbackregel: 'r9' }, { feedbackregel: 'r3' }, { feedbackregel: 'x' }] },
  verbandenAanwezig: { maak: () => verbandenAanwezig({ id: 'c' }), goed: [EV11, { verbanden: V6.slice(0, 1) }, { verbanden: V6.slice(0, 2) }], zwak: [{}, { verbanden: [] }, { verbanden: 'tekst' }] },
  verbandenAantal: { maak: () => verbandenAantal({ id: 'c' }), soort: 'C', goed: [EV11, { verbanden: [...V6, V6[0]] }, { verbanden: V6 }], zwak: [{}, { verbanden: V6.slice(0, 5) }, { verbanden: V6.slice(0, 1) }] },
  verbandTypen: { maak: () => verbandTypen({ id: 'c' }), soort: 'C', goed: [EV11, { verbanden: V6.slice(0, 4) }, { verbanden: [V6[0], V6[5]] }], zwak: [{}, { verbanden: TWEE_TYPEN }, { verbanden: [V6[0]] }] },
  verbandZinnen: { maak: () => verbandZinnen({ id: 'c' }), goed: [EV11, {}, { verbanden: V6.slice(2) }], zwak: [{ verbanden: ZONDER_ZIN }, { verbanden: [{ ...V6[0], zin: 'Ja' }] }, { verbanden: [{ ...V6[0], zin: undefined }] }] },
  kapitalenGemarkeerd: { maak: () => kapitalenGemarkeerd({ id: 'c' }), goed: [EV11, { markering: MARK }, { markering: MARK.map((m) => ({ ...m, waarde: 'input' })) }], zwak: [{}, { markering: MARK.slice(0, 5) }, { markering: [{ kapitaal: 'financieel', waarde: 'input' }] }] },
  syntheseAlinea: { maak: () => syntheseAlinea({ id: 'c' }), goed: [EV11, { synthese: 'Eén zin.' }, { synthese: 'Een. Twee. Drie. Vier. Vijf.' }], zwak: [{}, { synthese: '   ' }, { synthese: 'Een. Twee. Drie. Vier. Vijf. Zes.' }] },
  syntheseKaarten: { maak: () => syntheseKaarten({ id: 'c' }), soort: 'B', goed: [EV11, { ...SYNTHESE }, { synthese: '[a] [b]', syntheseKaarten: [{ id: 'us:pain', tekst: '[a]' }, { id: 'vpc:b1', tekst: '[b]' }] }], zwak: [{}, { synthese: '[a]', syntheseKaarten: [{ id: 'us:pain', tekst: '[a]' }] }, { synthese: 'zonder chips', syntheseKaarten: SYNTHESE.syntheseKaarten }] },
  nietZienAntwoorden: { maak: () => nietZienAntwoorden({ id: 'c' }), goed: [EV11, NIETZIEN, { nietZien1: 'a', nietZien2: 'b', nietZien3: 'c' }], zwak: [{}, { nietZien1: 'a' }, { ...NIETZIEN, nietZien3: ' ' }] },
  userStoryVerbonden: { maak: () => userStoryVerbonden({ id: 'c' }), soort: 'B', goed: [EV11, { verbanden: V6.slice(0, 3) }, { verbanden: [...V6.slice(0, 3), V6[5]] }], zwak: [{}, { verbanden: V6.slice(3) }, { verbanden: V6.slice(0, 2) }] },
  kapitalenUitEv01Verbonden: { maak: () => kapitalenUitEv01Verbonden({ id: 'c' }), soort: 'B', ctx: CTX, goed: [EV11, { verbanden: V6.slice(3, 5) }, { verbanden: [...V6, V6[0]] }], zwak: [{}, { verbanden: [V6[3]] }, { verbanden: V6.slice(0, 3) }] },
  spanningMetStakeholder: { maak: () => spanningMetStakeholder({ id: 'c' }), soort: 'B', ctx: CTX, goed: [EV11, { verbanden: [V6[5]] }, { verbanden: [{ ...V6[5], stakeholder: 'planners' }] }], zwak: [{}, { verbanden: ZONDER_SPANNING }, { verbanden: [{ ...V6[5], stakeholder: 'Verzonnen partij' }] }] },
};
for (const [naam, c] of Object.entries(CONTROLES)) {
  test(`QA-2: ${naam} heeft 3 goede en 3 zwakke voorbeelden met een melding die zegt wat ontbreekt`, () => {
    const controle = c.maak();
    const soort = c.soort ?? 'A';
    for (const invoer of c.goed) {
      const r = controle(invoer, c.ctx ?? {});
      assert.equal(r.resultaat, 'ok', JSON.stringify(invoer).slice(0, 80));
      assert.equal(r.soort, soort);
    }
    for (const invoer of c.zwak) {
      const r = controle(invoer, c.ctx ?? {});
      assert.notEqual(r.resultaat, 'ok', JSON.stringify(invoer).slice(0, 80));
      assert.ok(r.melding.length > 15, 'de melding zegt wat ontbreekt');
      assert.match(r.melding, /[a-z]/);
    }
  });
}

test('BW-8: de nieuwe controles geven bij vreemde invoer geen fout maar een resultaat (zoals de contentcontrole ze aanroept)', () => {
  for (const c of Object.values(CONTROLES)) {
    for (const vreemd of [{}, { verbanden: 'x y z w v', markering: 'x y z w v', synthese: 5 }, { verbanden: [null, 3, 'a'], syntheseKaarten: [null] }, undefined]) {
      assert.doesNotThrow(() => c.maak()(vreemd, {}));
    }
  }
});

// ---------------------------------------------------------------- BW-10: de vijf samenhangcontroles

test('BW-10: er zijn 5 samenhangcontroles (soort B): EV-01 → EV-06, EV-07 → EV-02, EV-08 → EV-06 (leerblok 3) en EV-11 → EV-01, EV-11 → EV-06 (leerblok 4)', () => {
  const b = (blok, id) => blok.taken.find((t) => t.id === id).controles.filter((c) => c.soort === 'B').map((c) => c.type);
  const gevonden = [
    b(blok3, '5.1').includes('gebruikerInLijst') && 'EV-01 → EV-06',
    b(blok3, '8.1').includes('aannameMetZoekvraag') && 'EV-07 → EV-02',
    b(blok3, '9.2').includes('noemtStakeholder') && 'EV-08 → EV-06',
    b(blok4, '9.4').includes('kapitalenUitEv01Verbonden') && 'EV-11 → EV-01',
    b(blok4, '9.4').includes('spanningMetStakeholder') && 'EV-11 → EV-06',
  ].filter(Boolean);
  assert.equal(gevonden.length, 5, gevonden.join(', '));
  const soorten = blok4.taken.find((t) => t.id === '9.4').controles.filter((c) => ['kapitalenUitEv01Verbonden', 'spanningMetStakeholder'].includes(c.type)).map((c) => c.soort);
  assert.deepEqual(soorten, ['B', 'B']);
});

test('BW-10: EV-11 → EV-06: haal de stakeholder van de spanning uit EV-06 en EV-11 valt terug van Compleet naar Bijna', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('9.4', EV11);
  assert.equal(status(sessie, '9.4'), 'compleet');
  const sessie3 = maakSessie({ store, blok: blok3, elearning: '0.1.0', context: () => wisselContext(store) });
  sessie3.bewaar('5.1', { vraagstuk: 'Roosterproces', ...EV06, s3naam: 'Een ander persoon' });
  const b = sessie.beoordeel('9.4', sessie.leesToepassing('9.4'));
  assert.equal(uitkomst(b, 'spanning-stakeholder').resultaat, 'let op');
  assert.match(uitkomst(b, 'spanning-stakeholder').melding, /stakeholderlijst/);
  assert.equal(b.status, 'bijna');
});

test('BW-10: EV-11 → EV-01: kies in EV-01 een kapitaal dat EV-11 niet verbindt en EV-11 valt terug naar Bijna', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('9.4', EV11);
  assert.equal(status(sessie, '9.4'), 'compleet');
  maakSessie({ store, blok: blok1, elearning: '0.1.0' }).bewaar('2.1', { ...EV01, kapitalen: ['menselijk', 'financieel', 'natuurlijk'] });
  const b = sessie.beoordeel('9.4', sessie.leesToepassing('9.4'));
  assert.equal(uitkomst(b, 'kapitalen-uit-ev01').resultaat, 'let op');
  assert.match(uitkomst(b, 'kapitalen-uit-ev01').melding, /natuurlijk/);
  assert.equal(b.status, 'bijna');
});

// ---------------------------------------------------------------- EV-11 en EV-10 als geheel

test('EV-11: een volledig ingevuld record krijgt Compleet met de melding „Aanwezig en consistent” en een leeg dossier geeft Nog niet', () => {
  const { sessie, store } = nieuw();
  const r = sessie.bewaar('9.4', EV11);
  assert.equal(r.record.status, 'compleet');
  assert.equal(r.record.taak, '9.4');
  assert.deepEqual(r.record.luk, [1]);
  assert.equal(sessie.beoordeel('9.4', EV11).compleetMelding.startsWith('Aanwezig en consistent'), true);
  assert.equal(store.get('EV-11').leerblok, 4);
  const leeg = nieuw({ voorEerder: false });
  assert.equal(status(leeg.sessie, '9.4'), 'nog niet');
  assert.equal(leeg.sessie.bewaar('9.4', {}).opgeslagen, false, 'een leeg profiel maakt geen record (AC-40)');
});

test('EV-11 en WS-7: is de lijst van verbanden letterlijk gelijk aan een ontvangen wisselblok, dan is er een melding en blijft de status Bijna', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('9.4', EV11);
  const tekst = maakWisselblok({ 'EV-11': store.get('EV-11') }).tekst;
  const wissel = maakWissel({ store, sessie });
  assert.equal(wissel.plakWisselblok(tekst, 'medestudent').ok, true);
  const b = sessie.beoordeel('9.4', sessie.leesToepassing('9.4'));
  const m = uitkomst(b, 'niet-tekst-wisselpartner');
  assert.equal(m.resultaat, 'let op');
  assert.match(m.melding, /tekst van je wisselpartner \(de verbanden\)/);
  assert.equal(b.status, 'bijna');
  const anders = { ...EV11, verbanden: [{ ...V6[0], zin: 'Een eigen andere zin waarom.' }, ...V6.slice(1)] };
  assert.equal(uitkomst(sessie.beoordeel('9.4', anders), 'niet-tekst-wisselpartner').resultaat, 'ok');
});

test('EV-09 en WS-7: de kopiecontrole van de Wissel vergelijkt ook de eigen verbanden (EV-11)', () => {
  const ontvangen = [{ blok: { vraag: '', zoekvragen: [], verbanden: V6.map(verbandRegel) } }];
  const c = eigenNietGelijkAanWissel({ id: 'c' });
  const r = c({}, { wissel: { ontvangen }, eigen: { 'EV-11': { inhoud: EV11 } } });
  assert.equal(r.resultaat, 'let op');
  assert.match(r.melding, /verbanden in EV-11/);
  assert.equal(c({}, { wissel: { ontvangen: [] }, eigen: { 'EV-11': { inhoud: EV11 } } }).resultaat, 'ok');
  assert.equal(nietGelijkAanWissel({ id: 'c', onderdeel: 'verbanden' })(EV11, { wissel: { ontvangen } }).resultaat, 'let op');
  assert.deepEqual(gelijkAanWissel(ontvangen, { verbanden: V6.map(verbandRegel).reverse() }), ['verbanden'], 'volgorde telt niet');
});

test('EV-10/LB-15: een STARR met 5 delen, 1 keuzelijst en een volgende stap is Compleet; zonder reflectie is het Nog niet; zonder volgende stap Nog niet', () => {
  const t = taak('6.3');
  assert.equal(t.toepassing.velden.filter((v) => ['situatie', 'taak', 'actie', 'resultaat', 'reflectie'].includes(v.id)).length, 5);
  assert.equal(t.toepassing.velden.filter((v) => v.type === 'lijst').length, 1);
  assert.equal(t.toepassing.component, 'starr');
  const { sessie } = nieuw();
  sessie.bewaar('6.3', STARR);
  assert.equal(status(sessie, '6.3'), 'compleet');
  assert.equal(sessie.beoordeel('6.3', { ...STARR, reflectie: '' }).status, 'bijna', 'één deel mist: let op');
  assert.equal(sessie.beoordeel('6.3', { ...STARR, gedrag: '' }).status, 'nog niet');
  assert.equal(sessie.beoordeel('6.3', { ...STARR, volgende: '' }).status, 'nog niet');
  assert.equal(sessie.beoordeel('6.3', { ...STARR, gedrag: 'Iets verzonnens' }).status, 'nog niet', 'alleen een keuze uit de lijst');
});

test('LB-15: de STARR is optioneel te koppelen aan een feedbackregel; een verdwenen regel geeft let op', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('6.2', { regels: [{ id: 'r1', richting: 'ontvangen', rol: 'coach', zie: 'a', mis: 'b', vraag: 'c', actie: 'doe iets nuttigs', status: 'open' }, { id: 'r2', richting: 'gegeven', rol: 'coach', zie: 'a' }] });
  assert.ok(store.get('EV-09'));
  const sessie6 = maakSessie({ store, blok: blok4, elearning: '0.1.0', context: () => wisselContext(store) });
  assert.equal(sessie6.beoordeel('6.3', { ...STARR, feedbackregel: 'r1' }).status, 'compleet');
  assert.equal(sessie6.beoordeel('6.3', { ...STARR, feedbackregel: 'r9' }).status, 'bijna');
});

// ---------------------------------------------------------------- WS-2 en VB-8: de lijst van verbanden in wisselblok en A3-blok

test('WS-2: het wisselblok bevat de lijst van alle verbanden uit EV-11, zonder alias, en is terug te lezen', () => {
  const record = { inhoud: { ...EV11, verbanden: V6.map((v, i) => (i === 0 ? { ...v, zin: 'Testa zegt dat de planner dit doet.' } : v)) } };
  const blok = maakWisselblok({ 'EV-01': { inhoud: EV01 }, 'EV-11': record }, { alias: 'Testa' });
  assert.equal(blok.verbanden.length, 6, '1 lijst met alle verbanden uit EV-11');
  assert.equal(blok.tekst.split('\n').filter((r) => /^Verband \d+:/.test(r)).length, 6);
  assert.ok(!/Testa/.test(blok.tekst), 'de alias is vervangen');
  const gelezen = leesWisselblok(blok.tekst);
  assert.equal(gelezen.geldig, true);
  assert.equal(gelezen.blok.verbanden.length, 6);
  assert.equal(gelezen.blok.verbanden[5], blok.verbanden[5]);
  assert.equal(blok.leeg, false);
});

test('WS-2: zonder EV-11 staat er geen lijst van verbanden in het wisselblok (leerblok 1) en een blok met alleen verbanden is geldig', () => {
  const zonder = maakWisselblok({ 'EV-01': { inhoud: EV01 } });
  assert.deepEqual(zonder.verbanden, []);
  assert.ok(!/Verband/.test(zonder.tekst));
  assert.equal(leesWisselblok(`A3-WISSELBLOK\nVerband 1: ${verbandRegel(V6[0])}`).geldig, true);
});

test('WS-2: maakWissel().mijnWisselblok neemt de verbanden mee uit de opslag', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('9.4', EV11);
  assert.equal(maakWissel({ store, sessie }).mijnWisselblok('Testa').verbanden.length, 6);
});

test('LB-16/VB-8: het A3-tekstblok heeft 4 onderdelen (vraag, zoekvragen, plaatsing, waarom) en met EV-11 5, met alle verbanden als lijst', () => {
  const records = { 'EV-01': { inhoud: EV01 }, 'EV-02': { inhoud: { frame1: 'functioneel', zoekvraag1: 'Wat is de wachttijd?', zoekvraag2: 'Hoe beleven teams dat?' } }, 'EV-08': { inhoud: { conclusie: 'Het zit bij de planning.', conclKlant: 'De teams missen de fit.' } } };
  const zonder = maakA3Tekst({ records, profiel: { waaromZin: 'Planners verliezen uren.' } });
  assert.deepEqual(zonder.delen.map((d) => d.sleutel), ['onderzoeksvraag', 'zoekvragen', 'plaatsing', 'waarom']);
  assert.match(zonder.tekst, /Waarom:\nPlanners verliezen uren\./);
  assert.match(zonder.tekst, /1\. Wat is de wachttijd\? \(functioneel\)/);
  const met = maakA3Tekst({ records: { ...records, 'EV-11': { inhoud: EV11 } }, profiel: { waaromZin: 'Planners verliezen uren.' } });
  assert.equal(met.delen.length, 5);
  const regels = met.tekst.split('\n').filter((r) => /^\d+\. .* — /.test(r));
  assert.equal(regels.length, 6, 'alle verbanden staan in het tekstblok');
  for (const v of V6) assert.ok(met.tekst.includes(verbandRegel(v)));
  assert.ok(!met.tekst.includes('Testa'));
});

test('LB-16: een onderdeel dat nog leeg is staat er wel in als „(nog niet ingevuld)”, zodat het blok altijd 4 kopjes heeft', () => {
  const leeg = maakA3Tekst({ records: {}, profiel: {} });
  assert.equal(leeg.delen.length, 4);
  assert.equal(leeg.tekst.match(/\(nog niet ingevuld\)/g).length, 4);
});

test('LB-17: elke kopieeractie logt 1 datum; de datums gaan mee in het dossier en komen bij een import terug', async () => {
  const { store } = nieuw();
  logKopie(store, new Date('2026-10-01T09:00:00Z'));
  logKopie(store, new Date('2026-10-02T09:30:00Z'));
  assert.deepEqual(leesKopieLog(store), ['2026-10-01T09:00:00.000Z', '2026-10-02T09:30:00.000Z']);
  const d = await maakDossier(store, { elearning: '0.1.0' });
  assert.deepEqual(d.a3Kopieerlog, leesKopieLog(store));
  const ander = nieuw({ voorEerder: false });
  const u = await controleerDossier(d);
  assert.equal(u.status, 'ongewijzigd');
  importeerDossier({ store: ander.store, opslag: ander.opslag }, u.dossier);
  assert.deepEqual(leesKopieLog(ander.store), leesKopieLog(store));
  importeerDossier({ store: ander.store, opslag: ander.opslag }, u.dossier);
  assert.equal(leesKopieLog(ander.store).length, 2, 'een tweede import dubbelt de datums niet');
});

// ---------------------------------------------------------------- TK-11: twee zinnen naast elkaar

test('TK-11: het afsluitscherm van leerblok 4 vraagt „wat ik hiermee aan mijn A3 heb” en de dossierpagina toont die zin naast de waarom-zin', async () => {
  assert.match(blok4.afsluiting.a3Zin.vraag, /A3/);
  assert.equal(controleerFormaat(blok4, 'leerblok-4.json').fouten.length, 0);
  const { sessie, store } = nieuw();
  sessie.bewaarVolgendeStap('Ik ga de synthese bespreken');
  sessie.bewaarA3Zin('  Ik vertel mijn A3 nu als één verhaal.  ');
  assert.equal(sessie.leesA3Zin(), 'Ik vertel mijn A3 nu als één verhaal.');
  assert.equal(sessie.leesVolgendeStap(), 'Ik ga de synthese bespreken', 'de ene zin overschrijft de andere niet');
  sessie.bewaarVolgendeStap('Een andere volgende stap nu');
  assert.equal(sessie.leesA3Zin(), 'Ik vertel mijn A3 nu als één verhaal.');
  assert.deepEqual(bouwTweeZinnen(store), { waarom: 'Planners verliezen uren aan late roosters.', nut: 'Ik vertel mijn A3 nu als één verhaal.' });
  const d = await maakDossier(store, { elearning: '0.1.0' });
  assert.equal(d.a3Zin, 'Ik vertel mijn A3 nu als één verhaal.');
  const ander = nieuw({ voorEerder: false });
  importeerDossier({ store: ander.store, opslag: ander.opslag }, d);
  assert.equal(bouwTweeZinnen(ander.store).nut, 'Ik vertel mijn A3 nu als één verhaal.');
  assert.deepEqual(bouwTweeZinnen(maakStore(geheugenOpslag())), { waarom: '', nut: '' });
});

// ---------------------------------------------------------------- TK-12: het zwakste onderdeel

const standVan = (records) => bouwMijnStand(luk, records);
const rec = (status, voorlopig = false) => ({ status, voorlopig });

test('TK-12: het zwakste onderdeel klopt met de statussen in 3 testprofielen', () => {
  // profiel 1: leeg dossier: alle onderdelen ontbreken, het eerste in de volgorde is het zwakste
  assert.equal(zwaksteOnderdeel(standVan({})).id, 'EV-01');
  // profiel 2: gedeeltelijk: EV-01 compleet, EV-02 bijna, EV-03 nog niet, de rest zonder record: een onderdeel zonder record gaat voor
  const half = { 'EV-01': rec('compleet'), 'EV-02': rec('bijna'), 'EV-03': rec('nog niet') };
  const z2 = zwaksteOnderdeel(standVan(half));
  assert.equal(z2.id, 'EV-04');
  assert.equal(z2.heeftRecord, false);
  // profiel 3: alles Compleet behalve één Bijna: dat onderdeel is het zwakste
  const bijna = Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, rec('compleet')]));
  bijna['EV-07'] = rec('bijna');
  const z3 = zwaksteOnderdeel(standVan(bijna));
  assert.deepEqual([z3.id, z3.status, z3.statusTekst, z3.heeftRecord], ['EV-07', 'bijna', 'Bijna', true]);
  // alles compleet: er is geen zwakste onderdeel
  assert.equal(zwaksteOnderdeel(standVan(Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, rec('compleet')])))), null);
  // een record met status nog niet gaat voor bijna, ook als het later in de volgorde staat
  assert.equal(zwaksteOnderdeel(standVan({ ...Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, rec('bijna')])), 'EV-09': rec('nog niet') })).id, 'EV-09');
});

// ---------------------------------------------------------------- TK-13 en TK-14: de verdiepingstaken

test('TK-13: elk van de vier leerblokken heeft 1 verdiepingstaak bij een bestaande taak; die van leerblok 4 komt uit LRD 8.3', () => {
  assert.equal(blokken.filter((b) => b.verdieping?.tekst).length, 4);
  for (const b of blokken) assert.ok(b.taken.some((t) => t.id === b.verdieping.na), `leerblok ${b.leerblok}: verdieping hoort bij een bestaande taak`);
  assert.equal(blok4.verdieping.na, '6.3');
  assert.equal(blok4.verdieping.bron, 'lrd');
  assert.match(blok4.verdieping.tekst, /welk kapitaal neemt af/i);
  assert.ok(!('richttijd' in blok4.verdieping) && !('minuten' in blok4.verdieping));
});

test('TK-14: 0 statuswijzigingen en 0 minuten in de richttijd van 45 min door een verdiepingstaak; in het dossier alleen „verdieping gedaan”', async () => {
  assert.equal(blok4.taken.reduce((som, t) => som + t.richttijd.minuten, 0), 45, 'de taken van leerblok 4 tellen op tot 45 min, zonder verdieping');
  const { sessie, store } = nieuw();
  sessie.bewaar('6.3', STARR);
  const voor = JSON.stringify(store.versions('EV-10'));
  const st = status(sessie, '6.3');
  sessie.zetVerdieping({ tekst: 'Geheime verdiepingstekst over kapitalen.', gedaan: true });
  assert.equal(JSON.stringify(store.versions('EV-10')), voor, '0 wijzigingen in de records');
  assert.equal(status(sessie, '6.3'), st);
  assert.deepEqual(leesVerdiepingGedaan(store), [4]);
  const d = await maakDossier(store, { elearning: '0.1.0' });
  assert.deepEqual(d.verdiepingGedaan, [4]);
  assert.ok(!JSON.stringify(d).includes('Geheime verdiepingstekst'), 'de tekst van de verdieping komt niet in het dossier');
  const ander = nieuw({ voorEerder: false });
  importeerDossier({ store: ander.store, opslag: ander.opslag }, d);
  assert.deepEqual(leesVerdiepingGedaan(ander.store), [4]);
});

// ---------------------------------------------------------------- ST-3, ST-4, ST-5: voorlopig vraagstuk

const VOORLOPIG = { alias: 'Vera', teamnummer: '5', vraagstuk: '', waaromZin: '', voorlopig: true };

test('ST-3: na de keuze „nog geen scherp vraagstuk” heeft 100 % van de records in leerblok 4 het label voorlopig', () => {
  const { sessie, store } = nieuw({ profiel: VOORLOPIG, voorEerder: false });
  sessie.bewaar('9.4', EV11);
  sessie.bewaar('6.3', STARR);
  sessie.bewaar('6.2', { regels: [{ id: 'r1', richting: 'gegeven', rol: 'coach', zie: 'a' }] });
  const ids = store.ids();
  assert.deepEqual(ids, ['EV-09', 'EV-10', 'EV-11']);
  assert.ok(ids.every((id) => store.get(id).voorlopig === true), '100 % voorlopig');
  const scherp = nieuw({ voorEerder: false });
  scherp.sessie.bewaar('6.3', STARR);
  assert.equal(scherp.store.get('EV-10').voorlopig, false);
});

test('ST-4: „opnieuw doen” is één handeling: een voorlopig onderdeel krijgt een leeg toepassingsveld, een scherp onderdeel kan het niet', () => {
  const { sessie, store } = nieuw({ profiel: VOORLOPIG, voorEerder: false });
  sessie.bewaar('6.3', STARR);
  assert.equal(sessie.kanOpnieuw('6.3'), true);
  sessie.markeerKlaar('6.3');
  assert.equal(sessie.isKlaar('6.3'), true);
  const r = sessie.opnieuwDoen('6.3');
  assert.equal(r.ok, true);
  assert.deepEqual(sessie.leesToepassing('6.3'), {}, '1 klik tot een leeg toepassingsveld');
  assert.equal(sessie.isKlaar('6.3'), false);
  assert.equal(store.get('EV-10').status, 'nog niet');
  assert.equal(sessie.opnieuwDoen('9.4').ok, false, 'zonder record valt er niets opnieuw te doen');
  const scherp = nieuw();
  scherp.sessie.bewaar('6.3', STARR);
  assert.equal(scherp.sessie.kanOpnieuw('6.3'), false);
  assert.equal(scherp.sessie.opnieuwDoen('6.3').ok, false);
  assert.equal(scherp.sessie.leesToepassing('6.3').situatie, STARR.situatie, 'niets veranderd');
});

test('ST-5: na „opnieuw doen” toont het dossier 2 versies naast elkaar: de voorlopige en de nieuwe; het label volgt het profiel', () => {
  const { sessie, store } = nieuw({ profiel: VOORLOPIG, voorEerder: false });
  sessie.bewaar('6.3', STARR);
  bewaarProfiel(store, { ...VOORLOPIG, vraagstuk: 'Hoe verkorten we de wachttijd voor roosters?', waaromZin: 'Planners verliezen uren.', voorlopig: false });
  assert.deepEqual(bouwVersieVergelijking(store), [], 'zonder opnieuw doen geen vergelijking');
  sessie.opnieuwDoen('6.3');
  sessie.bewaar('6.3', { ...STARR, reflectie: 'Een nieuwe, scherpere reflectie na de afbakening.' });
  const paren = bouwVersieVergelijking(store);
  assert.equal(paren.length, 1);
  assert.equal(paren[0].id, 'EV-10');
  assert.equal(paren[0].oud.voorlopig, true);
  assert.equal(paren[0].oud.inhoud.reflectie, STARR.reflectie);
  assert.equal(paren[0].nieuw.voorlopig, false);
  assert.equal(paren[0].nieuw.inhoud.reflectie, 'Een nieuwe, scherpere reflectie na de afbakening.');
  assert.ok(paren[0].nieuw.versie > paren[0].oud.versie);
  assert.equal(store.versions('EV-10').length >= 3, true, 'alle versies blijven bewaard (RC-6)');
  assert.equal(sessie.kanOpnieuw('6.3'), false, 'de nieuwste versie is niet meer voorlopig');
});

test('ST-3 en AC-21: het profiel „voorlopig vraagstuk” doorloopt leerblok 1 en 3 en het dossier toont het label; leerblok 4 doet dat ook', async () => {
  const { sessie, store } = nieuw({ profiel: VOORLOPIG, voorEerder: false });
  const sessie1 = maakSessie({ store, blok: blok1, elearning: '0.1.0' });
  sessie1.bewaar('2.1', EV01);
  sessie.bewaar('9.4', EV11);
  const d = await maakDossier(store, { elearning: '0.1.0' });
  assert.equal(d.voorlopig, true);
  assert.ok(d.records.every((r) => r.record.voorlopig === true));
  const stand = bouwMijnStand(luk, Object.fromEntries(d.records.map((r) => [r.record.id, r.record])));
  assert.ok(stand.filter((c) => c.heeftRecord).every((c) => c.voorlopig));
});

// ---------------------------------------------------------------- AC-40: leeg dossier

test('AC-40: een leeg dossier levert 0 records, 0 fouten en een tekstblok van 4 lege onderdelen; de pagina\'s hebben dan nog iets te tonen', async () => {
  const store = maakStore(geheugenOpslag());
  const d = await maakDossier(store, { elearning: '0.1.0' });
  assert.deepEqual(d.records, []);
  assert.deepEqual(d.verdiepingGedaan, []);
  assert.equal(d.a3Zin, '');
  assert.equal((await controleerDossier(d)).status, 'ongewijzigd');
  const stand = bouwMijnStand(luk, {});
  assert.equal(stand.length, 11);
  assert.equal(zwaksteOnderdeel(stand).id, 'EV-01');
  assert.equal(maakA3Tekst({ records: {}, profiel: leesProfiel(store) }).delen.length, 4);
  assert.deepEqual(bouwVersieVergelijking(store), []);
  assert.deepEqual(bouwTweeZinnen(store), { waarom: '', nut: '' });
  const sessie = maakSessie({ store, blok: blok4, elearning: '0.1.0', context: () => wisselContext(store) });
  assert.equal(status(sessie, '9.4'), 'nog niet');
  assert.equal(sessie.afsluitModel(null).afgerond, false);
});

test('DS-7: de afdruk toont verbanden, markering en chips als tekst en niet als [object Object]', () => {
  const { sessie, store } = nieuw();
  sessie.bewaar('9.4', EV11);
  const dossier = { alias: 'Testa', teamnummer: '3', geexporteerd: '2026-10-01', elearning: '0.1.0', controlesom: { waarde: 'abc' }, records: store.ids().map((id) => ({ record: store.get(id), eerdereVersies: 0 })) };
  const labels = veldLabels(blokken);
  const tekst = JSON.stringify(bouwAfdruk(dossier, luk, labels));
  assert.ok(!tekst.includes('[object Object]'));
  assert.ok(tekst.includes('hoort bij') && tekst.includes('uitkomst (+)'));
  assert.equal(waardeTekst(EV11.verbanden).split('; ').length, 6);
  assert.equal(waardeTekst(EV11.syntheseKaarten).split('; ')[0], EV11.syntheseKaarten[0].tekst);
});

// ---------------------------------------------------------------- VB-9: zelfstandige taak

test('VB-9: taak 9.4 is een zelfstandige taak van 20 min en er is 0 onderdeel in het werkcollegeprogramma (docent-deel1 en -deel2) dat naar taak 9.4 verwijst', () => {
  assert.equal(taak('9.4').richttijd.minuten, 20);
  assert.equal(taak('9.4').vorm, 'Alleen');
  for (const bestand of ['data/docent-deel1.json', 'data/docent-deel2.json']) {
    const onderdelen = json(bestand).onderdelen.filter((o) => o.soort !== 'pauze');
    assert.equal(onderdelen.filter((o) => o.taak === '9.4').length, 0, bestand);
  }
});

// ---------------------------------------------------------------- LI-2: eigen kolommen, geen ingebedde afbeeldingen

test('LI-2/VB-10: de kolommen en lijnen worden zelf getekend (HTML en inline SVG); 0 ingebedde afbeeldingen van Strategyzer of het IIRC', () => {
  const bestanden = ['js/lb4-ui.js', 'js/verbanden.js', 'js/leerblok.js', 'leerblok-4.html', 'css/site.css', 'data/leerblok-4.json', 'data/bronnen-4.json'];
  for (const b of bestanden) {
    const t = lees(b);
    assert.doesNotMatch(t, /<img\b|createElement\(\s*['"]img['"]|new Image\(|\bh\(\s*['"]img['"]/i, `${b}: geen afbeelding`);
    assert.doesNotMatch(t, /\.(png|jpe?g|gif|webp|svg)\b/i, `${b}: geen verwijzing naar een afbeeldingsbestand`);
    assert.doesNotMatch(t, /url\(\s*['"]?https?:/i, b);
  }
  const ui = lees('js/lb4-ui.js');
  assert.match(ui, /createElementNS\(NS, tag\)/, 'de lijnen zijn inline SVG');
  assert.match(ui, /'aria-hidden': 'true'/);
  // de bronnen staan alleen als link (op de bronnenpagina en in de kaart)
  assert.match(ui, /href: 'bronnen\.html#bron-iirc-2021'/);
  assert.match(ui, /href: 'bronnen\.html#bron-osterwalder-2014'/);
});

test('VB-10: de lijnen worden bij elke wijziging en bij een andere breedte opnieuw getekend, zonder handmatige actie', () => {
  const ui = lees('js/lb4-ui.js');
  assert.match(ui, /new ResizeObserver\(plan\)/);
  assert.match(ui, /function ververs\(\)[\s\S]*plan\(\);/);
  assert.match(ui, /for \(const v of verbanden\) \{[\s\S]*svgEl\('path'/);
});

// ---------------------------------------------------------------- TG-2 en TG-5: toetsenbord en tekstweergave

test('TG-2/TG-5: elke kaart is een knop met aria-pressed, de verbanden staan ook als lijst in tekst, de tekening is voor hulpsoftware verborgen en Escape sluit het formulier', () => {
  const ui = lees('js/lb4-ui.js');
  assert.match(ui, /h\('button', \{ type: 'button', class: 'vb-kaartje'/);
  assert.match(ui, /'aria-pressed': 'false'/);
  assert.match(ui, /h\('ol', \{ class: 'vb-tekst-lijst'/);
  assert.match(ui, /e\.key === 'Escape'\) annuleer\(\)/);
  assert.match(ui, /role: 'status'/);
  assert.match(ui, /h\('form', \{ class: 'vb-form'/);
  assert.match(ui, /'aria-label': `Verwijder verband \$\{i \+ 1\}`/);
  assert.match(ui, /\.focus\(\)/);
  assert.doesNotMatch(ui, /draggable|ondrag|mousedown.*verband|pointerdown/i, 'geen bediening die alleen met een muis kan');
});

// ---------------------------------------------------------------- PF-4: elke pagina laadt alleen de fabrieken die ze nodig heeft

test('PF-4: elke controle in de data van leerblok N bestaat in core, in lbN of in het leerblok van de Wissel: precies wat de pagina laadt', () => {
  const kern = new Set(Object.keys({ ...core }).filter((n) => ['veldGevuld', 'keuzeUitLijst', 'eindigtOp', 'minWoorden', 'minZinnen'].includes(n)));
  const module = { 1: lb1, 2: lb2, 3: lb3, 4: { FABRIEKEN: LB4 } };
  for (const blok of blokken) {
    const geladen = modulesVoor([blok.leerblok, blok.wissel?.leerblok]); // wat js/leerblok.js laadt
    const beschikbaar = new Set([...kern, ...geladen.flatMap((n) => Object.keys(module[n].FABRIEKEN))]);
    for (const t of blok.taken) for (const c of t.controles) assert.ok(beschikbaar.has(c.type), `leerblok ${blok.leerblok}, taak ${t.id}: ${c.type} wordt door de pagina niet geladen`);
  }
});

test('PF-4 (sabotage): laat een leerblok een module missen die zijn controles nodig hebben en de test hierboven ziet het', () => {
  assert.deepEqual(modulesVoor([2]), [1, 2]);
  assert.deepEqual(modulesVoor([1, 4]), [1, 4]);
  assert.deepEqual(modulesVoor([4, undefined]), [4]);
  assert.deepEqual(MODULES_PER_LEERBLOK[3], [1, 3]);
});

test('PF-4: leerblok.js laadt lb4-ui.js alleen dynamisch en met de voorwaarde lb4ui', () => {
  const bron = lees('js/leerblok.js');
  assert.match(bron, /\/\/ gewicht-alleen: lb4ui\n.*await import\('\.\/lb4-ui\.js'\)/);
  assert.match(bron, /const LB4_COMPONENTEN = \['verbanden', 'starr'\]/);
});

// ---------------------------------------------------------------- de contentcontrole ziet fouten in de nieuwe onderdelen (sabotage)

test('QA-3 (sabotage): de contentcontrole meldt een onbekende component, een oefening zonder modelNa en een modelverband dat niet past', () => {
  const fouten = (b) => controleerFormaat(b, 'leerblok-4.json').fouten.join('\n');
  assert.equal(fouten(blok4), '');
  const a = kopie(blok4); a.taken[0].toepassing.component = 'raster';
  assert.match(fouten(a), /toepassing\.component "raster" is onbekend/);
  const b = kopie(blok4); delete b.taken[0].oefening.modelNa;
  assert.match(fouten(b), /modelNa "lijn"/);
  const c = kopie(blok4); c.taken[0].modelantwoord.verbanden[0].naar = 'vpc:b9';
  assert.match(fouten(c), /modelverband us:gebruiker → vpc:b9 klopt niet/);
  const d = kopie(blok4); d.taken[0].oefening.velden.pop();
  assert.match(fouten(d), /precies 3 open vragen/);
  const e = kopie(blok4); e.afsluiting.a3Zin.vraag = '';
  assert.match(fouten(e), /afsluiting\.a3Zin mist een vraag/);
  const f = kopie(blok4); f.taken[0].modelantwoord.verbanden[5].stakeholder = 'Onbekend';
  assert.match(fouten(f), /noemt een stakeholder die niet in oefening\.kaarten\.stakeholders staat/);
});

test('syntheseModellen: een chip telt alleen mee zolang zijn tekst in de alinea staat', () => {
  assert.deepEqual(syntheseModellen(SYNTHESE).sort(), ['kap', 'us']);
  assert.deepEqual(syntheseModellen({ ...SYNTHESE, synthese: 'De chips zijn weggehaald.' }), []);
  assert.deepEqual(syntheseModellen({}), []);
  assert.deepEqual(verbandenUit({ verbanden: [null, 1, { van: 'a' }, V6[0]] }).length, 1);
});
