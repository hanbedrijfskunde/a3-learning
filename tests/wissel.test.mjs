// Fase 4: de Wissel en de feedbacklog (LB-14, EV-09, WS-1, WS-3…WS-11, ST-7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geheugenOpslag, maakStore } from '../js/store.js';
import { maakSessie } from '../js/sessie.js';
import { bewaarProfiel } from '../js/profiel.js';
import { tellers } from '../js/checks/core.js';
import { voerUit } from '../js/checks/core.js';
import { bouwControles } from '../js/checks/index.js';
import { feedbackGegeven, zieMisVraag, actieMetStatus, nietGelijkAanWissel, eigenNietGelijkAanWissel } from '../js/checks/lb4.js';
import {
  maakWisselblok, leesWisselblok, gelijkAanWissel, maakFeedbackTekst, leesFeedbackTekst, herinneringen,
  maakWissel, wisselContext, ROLLEN, ROL_ANDER_TEAM, PRIVACYTEKST, herinneringenUitStore,
} from '../js/wissel.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const blok1 = lees('data/leerblok-1.json');
const blok4 = lees('data/leerblok-4.json');
const START = Date.parse('2026-10-05T10:00:00+02:00');
const DAG = 24 * 60 * 60 * 1000;

const EV01 = { gebruiker: 'de planners van de afdeling', pain: 'sneller de roosters te maken', waarde: 'medewerkers minder stress hebben', kapitalen: ['menselijk'] };
const EV02 = {
  frame1: 'functioneel', zoekvraag1: 'Welke factoren spelen bij roosteren?',
  frame2: 'intern of extern', zoekvraag2: 'In hoeverre werkt het rooster intern?',
  frame3: 'theoretisch of empirisch', zoekvraag3: 'Wat zegt de literatuur over roosteren?',
  model: '7S', verantwoording: 'Het model past bij het vraagstuk.', mis: 'Je mist de kant van de klant.',
};
const ANDERE01 = { gebruiker: 'de magazijnmedewerkers van de locatie', pain: 'minder fouten bij het orderpicken te maken', waarde: 'klanten vaker de juiste bestelling krijgen', kapitalen: ['sociaal en relationeel'] };
const ANDERE02 = {
  ...EV02, zoekvraag1: 'Welke factoren veroorzaken pickfouten?', zoekvraag2: 'In hoeverre helpt scanning intern?', zoekvraag3: 'Wat zegt de literatuur over orderpicken?',
};

/** Een tester: eigen opslag, eigen klok, sessies voor leerblok 1 en 4 (met de Wissel-context) en de Wissel. */
function tester({ start = START } = {}) {
  const store = maakStore(geheugenOpslag());
  const klok = { ms: start };
  const nu = () => new Date(klok.ms);
  const context = () => wisselContext(store);
  const sessie1 = maakSessie({ store, blok: blok1, elearning: '0.1.0', nu, context });
  const sessie4 = maakSessie({ store, blok: blok4, elearning: '0.1.0', nu, context });
  const wissel = maakWissel({ store, sessie: sessie4, nu });
  const opnieuw = () => { sessie1.bewaar('2.1', sessie1.leesToepassing('2.1')); sessie1.bewaar('2.2', sessie1.leesToepassing('2.2')); };
  return { store, klok, nu, sessie1, sessie4, wissel, opnieuw, dagen: (n) => { klok.ms += n * DAG; } };
}
const metEigenWerk = (t, e1 = EV01, e2 = EV02) => { t.sessie1.bewaar('2.1', e1); t.sessie1.bewaar('2.2', e2); return t; };
const ev09 = (t) => t.store.get('EV-09');

// ------------------------------------------------------------ WS-1: wisselblok

test('WS-1: het wisselblok bevat de onderzoeksvraag en de drie zoekvragen en geen alias', () => {
  const t = metEigenWerk(tester());
  bewaarProfiel(t.store, { alias: 'Kim', teamnummer: '7', vraagstuk: 'Onze retouren duren te lang', waaromZin: 'Klanten wachten te lang' });
  const w = t.wissel.mijnWisselblok('Kim');
  assert.match(w.tekst, /^A3-WISSELBLOK\n/);
  assert.match(w.tekst, /Onderzoeksvraag: Wat is de beste oplossing voor de planners van de afdeling om sneller de roosters te maken, zodat medewerkers minder stress hebben\?/);
  assert.equal((w.tekst.match(/^Zoekvraag \d/gm) ?? []).length, 3);
  assert.equal(w.leeg, false);
  assert.ok(!/Kim/i.test(w.tekst), 'alias in wisselblok');
  assert.ok(!/teamnummer/i.test(w.tekst));
});

test('WS-1: staat de alias in de eigen tekst, dan wordt hij uit het wisselblok gehaald', () => {
  const t = metEigenWerk(tester(), { ...EV01, gebruiker: 'de planners van Kim en haar afdeling' });
  const w = t.wissel.mijnWisselblok('Kim');
  assert.ok(!/Kim/.test(w.tekst));
  assert.ok(w.tekst.includes('[alias]'));
  assert.ok(!/Kim/.test(JSON.stringify(w.zoekvragen)) && !/Kim/.test(w.vraag));
});

test('WS-1: zonder ingevulde onderdelen is het wisselblok leeg en komt er geen half blok', () => {
  assert.equal(tester().wissel.mijnWisselblok().leeg, true);
  const t = metEigenWerk(tester(), { gebruiker: 'planners' }, {});
  assert.equal(t.wissel.mijnWisselblok().vraag, ''); // niet alle drie de delen
});

// ------------------------------------------------------------ WS-3: plakken, drie rollen

test('WS-3: het wisselblok van een wisselpartner wordt geaccepteerd met de rollen teamgenoot, medestudent en coach', () => {
  const partner = metEigenWerk(tester(), ANDERE01, ANDERE02);
  const blok = partner.wissel.mijnWisselblok().tekst;
  const t = tester();
  for (const rol of ROLLEN) {
    const r = t.wissel.plakWisselblok(blok.replace('Welke factoren', `Welke factoren (${rol})`), rol);
    assert.equal(r.ok, true, rol);
    assert.equal(r.blok.rol, rol);
  }
  assert.equal(ROLLEN.length, 3);
  assert.equal(t.wissel.blokken().length, 3);
});

test('WS-3: een onbekende rol, een tekst zonder kop en een leeg wisselblok worden geweigerd; hetzelfde blok twee keer telt één keer', () => {
  const blok = metEigenWerk(tester(), ANDERE01, ANDERE02).wissel.mijnWisselblok().tekst;
  const t = tester();
  assert.equal(t.wissel.plakWisselblok(blok, 'docent').ok, false);
  assert.equal(t.wissel.plakWisselblok(blok, ROL_ANDER_TEAM).ok, false); // „ander team" is geen wisselpartner
  assert.equal(t.wissel.plakWisselblok('Wat is de beste oplossing?', 'coach').ok, false);
  assert.equal(t.wissel.plakWisselblok('A3-WISSELBLOK\nhier staat niets', 'coach').ok, false);
  assert.equal(t.wissel.plakWisselblok('Onderzoeksvraag: Wat is de beste oplossing?', 'coach').ok, false); // inhoud zonder kop
  assert.equal(t.wissel.blokken().length, 0);
  assert.equal(t.wissel.plakWisselblok(blok, 'coach').nieuw, true);
  assert.equal(t.wissel.plakWisselblok(blok, 'coach').nieuw, false);
  assert.equal(t.wissel.blokken().length, 1);
});

test('WS-3: het wisselblok wordt ook gelezen als het in een chat is geplakt (extra regels ervoor, Windows-regeleinden)', () => {
  const g = leesWisselblok('Hoi, hier mijn blok!\r\nA3-WISSELBLOK\r\nOnderzoeksvraag: Wat is de beste oplossing?\r\nZoekvraag 1 (functioneel): Welke factoren?\r\nGroet');
  assert.equal(g.geldig, true);
  assert.deepEqual(g.blok, { vraag: 'Wat is de beste oplossing?', zoekvragen: [{ frame: 'functioneel', tekst: 'Welke factoren?' }] });
});

// ------------------------------------------------------------ LB-14, WS-4: de feedbacklog

test('LB-14/WS-4: elke regel van de feedbacklog heeft 6 velden en er passen ≥ 10 regels in', () => {
  const t = tester();
  for (let i = 1; i <= 12; i += 1) {
    const r = t.wissel.voegRegelToe({ richting: i % 2 ? 'ontvangen' : 'gegeven', rol: ROLLEN[i % 3], zie: `ik zie ${i}`, mis: `ik mis ${i}`, vraag: `ik vraag ${i}`, actie: `actie ${i}` });
    assert.equal(r.ok, true);
  }
  const { regels } = t.wissel.leesInhoud();
  assert.equal(regels.length, 12);
  for (const r of regels) for (const veld of ['zie', 'mis', 'vraag', 'rol', 'actie', 'status']) assert.ok(veld in r, veld);
  assert.equal(new Set(regels.map((r) => r.id)).size, 12);
  assert.equal(ev09(t).inhoud.regels.length, 12); // in het bewijsrecord
});

test('WS-4: bij een ontvangen wisselblok legt de student 3 tekstvelden, 1 actie en 1 status vast; een lege regel of onbekende status kan niet', () => {
  const t = tester();
  t.wissel.plakWisselblok(metEigenWerk(tester(), ANDERE01, ANDERE02).wissel.mijnWisselblok().tekst, 'teamgenoot');
  const blokId = t.wissel.blokken()[0].id;
  assert.equal(t.wissel.geefFeedback({ blokId, zie: '', mis: ' ', vraag: '' }).ok, false);
  assert.equal(t.wissel.geefFeedback({ blokId: 'w99', zie: 'x' }).ok, false);
  const r = t.wissel.geefFeedback({ blokId, zie: 'een duidelijke vraag', mis: 'een tweede kapitaal', vraag: 'is de grens goed?' });
  assert.equal(r.regel.richting, 'gegeven');
  assert.equal(r.regel.rol, 'teamgenoot');
  assert.equal(t.wissel.voegRegelToe({ richting: 'ontvangen', rol: 'coach', zie: 'a', status: 'klaar' }).ok, false);
  assert.equal(t.wissel.voegRegelToe({ richting: 'ontvangen', rol: 'buurman', zie: 'a' }).ok, false);
  assert.equal(t.wissel.wijzigRegel('r99', { actie: 'x' }).ok, false);
});

// ------------------------------------------------------------ WS-5: uitwisseling van twee testers

test('WS-5: na een uitwisseling van 2 testers staat bij elk 1 ontvangen en 1 gegeven regel in EV-09', () => {
  const a = metEigenWerk(tester(), EV01, EV02);
  const b = metEigenWerk(tester(), ANDERE01, ANDERE02);
  // A en B sturen elkaar het wisselblok
  assert.equal(a.wissel.plakWisselblok(b.wissel.mijnWisselblok().tekst, 'medestudent').ok, true);
  assert.equal(b.wissel.plakWisselblok(a.wissel.mijnWisselblok().tekst, 'medestudent').ok, true);
  // beiden geven feedback en sturen de tekst terug
  const vanA = a.wissel.geefFeedback({ blokId: a.wissel.blokken()[0].id, zie: 'concrete gebruiker', mis: 'een cijfer', vraag: 'wat is de norm?' });
  const vanB = b.wissel.geefFeedback({ blokId: b.wissel.blokken()[0].id, zie: 'drie frames', mis: 'een intern frame', vraag: 'welk model?' });
  assert.match(vanA.tekst, /^A3-FEEDBACK\nIk zie: concrete gebruiker\nIk mis: een cijfer\nIk vraag me af: wat is de norm\?$/);
  assert.equal(a.wissel.plakFeedback(vanB.tekst, 'medestudent').ok, true);
  assert.equal(b.wissel.plakFeedback(vanA.tekst, 'medestudent').ok, true);
  for (const t of [a, b]) {
    const regels = ev09(t).inhoud.regels;
    assert.equal(regels.filter((r) => r.richting === 'ontvangen').length, 1);
    assert.equal(regels.filter((r) => r.richting === 'gegeven').length, 1);
  }
  assert.equal(ev09(a).inhoud.regels.find((r) => r.richting === 'ontvangen').mis, 'een intern frame');
});

test('WS-5: geplakte feedback zonder kop of zonder inhoud wordt geweigerd', () => {
  const t = tester();
  assert.equal(t.wissel.plakFeedback('Ik zie: iets', 'coach').ok, false);
  assert.equal(t.wissel.plakFeedback('A3-FEEDBACK\nIk zie: \nIk mis: \nIk vraag me af: ', 'coach').ok, false);
  assert.equal(t.wissel.plakFeedback(maakFeedbackTekst({ zie: 'a', mis: 'b', vraag: 'c' }), 'kennis').ok, false);
  assert.equal(ev09(t), undefined);
  assert.deepEqual(leesFeedbackTekst(maakFeedbackTekst({ zie: 'a\nb', mis: '', vraag: 'c?' })).feedback, { zie: 'a b', mis: '', vraag: 'c?' });
});

// ------------------------------------------------------------ WS-7: kopiecontrole

test('WS-7: is de eigen EV-01 letterlijk gelijk aan het ontvangen wisselblok, dan volgt „let op" en blijft de status Bijna', () => {
  const t = tester();
  t.wissel.plakWisselblok(metEigenWerk(tester(), ANDERE01, ANDERE02).wissel.mijnWisselblok().tekst, 'teamgenoot');
  const r = t.sessie1.bewaar('2.1', ANDERE01).record; // de student neemt de vraag van de partner over
  assert.equal(r.status, 'bijna');
  const u = t.sessie1.beoordeel('2.1', ANDERE01);
  assert.equal(u.status, 'bijna');
  const m = u.uitkomsten.find((x) => x.id === 'niet-tekst-wisselpartner');
  assert.equal(m.resultaat, 'let op');
  assert.match(m.melding, /dit is de tekst van je wisselpartner/);
  assert.equal(u.ontbreekt.filter((o) => o.id === 'niet-tekst-wisselpartner').length, 1); // 1 melding
});

test('WS-7: 1 teken verschil is genoeg voor „ok"; alleen witruimte telt niet als verschil', () => {
  const t = tester();
  t.wissel.plakWisselblok(metEigenWerk(tester(), ANDERE01, ANDERE02).wissel.mijnWisselblok().tekst, 'teamgenoot');
  assert.equal(t.sessie1.beoordeel('2.1', { ...ANDERE01, gebruiker: ANDERE01.gebruiker.replace('locatie', 'locaties') }).status, 'compleet');
  assert.equal(t.sessie1.beoordeel('2.1', { ...ANDERE01, gebruiker: `  ${ANDERE01.gebruiker.replace(' ', '   ')} \n` }).status, 'bijna');
  assert.equal(t.sessie1.beoordeel('2.1', EV01).status, 'compleet'); // eigen tekst: geen melding
});

test('WS-7: hetzelfde voor EV-02 (drie zoekvragen, in willekeurige volgorde), en een gedeeltelijke overlap is geen kopie', () => {
  const t = tester();
  t.wissel.plakWisselblok(metEigenWerk(tester(), ANDERE01, ANDERE02).wissel.mijnWisselblok().tekst, 'coach');
  assert.equal(t.sessie1.beoordeel('2.2', ANDERE02).status, 'bijna');
  const omgedraaid = { ...ANDERE02, zoekvraag1: ANDERE02.zoekvraag3, zoekvraag3: ANDERE02.zoekvraag1 };
  assert.equal(t.sessie1.beoordeel('2.2', omgedraaid).status, 'bijna');
  assert.equal(t.sessie1.beoordeel('2.2', { ...ANDERE02, zoekvraag2: 'In hoeverre werkt het rooster intern?' }).status, 'compleet');
  assert.equal(t.sessie1.beoordeel('2.2', EV02).status, 'compleet');
});

test('WS-7: het plakken van het wisselblok werkt de status van reeds opgeslagen EV-01 en EV-02 bij zodra ze opnieuw worden beoordeeld', () => {
  const t = metEigenWerk(tester(), ANDERE01, ANDERE02); // student had toevallig dezelfde tekst
  assert.equal(t.store.get('EV-01').status, 'compleet');
  t.wissel.plakWisselblok(t.wissel.mijnWisselblok().tekst, 'teamgenoot');
  t.opnieuw();
  assert.equal(t.store.get('EV-01').status, 'bijna');
  assert.equal(t.store.get('EV-02').status, 'bijna');
});

test('WS-7: EV-09 meldt „let op" als de eigen opgeslagen EV-01 of EV-02 gelijk is aan het ontvangen wisselblok', () => {
  const t = metEigenWerk(tester(), ANDERE01, ANDERE02);
  t.wissel.plakWisselblok(t.wissel.mijnWisselblok().tekst, 'teamgenoot');
  t.wissel.voegRegelToe({ richting: 'gegeven', rol: 'teamgenoot', zie: 'x' });
  const r = t.wissel.plakFeedback(maakFeedbackTekst({ zie: 'a', mis: 'b', vraag: 'c' }), 'teamgenoot');
  assert.equal(r.ok, true);
  const c = ev09(t).controles.find((x) => x.id === 'eigen-niet-kopie-wissel');
  assert.equal(c.resultaat, 'let op');
  assert.equal(ev09(t).status, 'bijna');
});

test('WS-7: de kopiecontrole heeft geen last van een leeg ontvangen wisselblok of van invoer zonder velden', () => {
  const c = nietGelijkAanWissel({ id: 'k', onderdeel: 'vraag', velden: ['gebruiker', 'pain', 'waarde'] });
  assert.equal(c({}, {}).resultaat, 'ok');
  assert.equal(c(EV01, { wissel: { ontvangen: [] } }).resultaat, 'ok');
  assert.equal(c(EV01, undefined).resultaat, 'ok');
  assert.throws(() => nietGelijkAanWissel({ id: 'k', onderdeel: 'iets', velden: [] })({}), /onbekend onderdeel/);
  assert.deepEqual(gelijkAanWissel([], { vraag: 'x', zoekvragen: ['y?'] }), []);
});

// ------------------------------------------------------------ WS-8: Bijna zolang er geen feedback is

/** Een tester die feedback gaf maar nog niets ontving. */
function wachtOpFeedback() {
  const t = metEigenWerk(tester());
  t.wissel.plakWisselblok(metEigenWerk(tester(), ANDERE01, ANDERE02).wissel.mijnWisselblok().tekst, 'teamgenoot');
  t.wissel.geefFeedback({ blokId: t.wissel.blokken()[0].id, zie: 'een concrete gebruiker', mis: 'een tweede kapitaal', vraag: 'is 8 de goede grens?' });
  return t;
}

test('WS-8: zonder ontvangen feedback staat EV-09 op Bijna, ook na 14 dagen en na 60 dagen; na ontvangst is hij Compleet', () => {
  const t = wachtOpFeedback();
  assert.equal(ev09(t).status, 'bijna');
  for (const dagen of [1, 13, 14, 15, 60]) {
    t.klok.ms = START + dagen * DAG;
    t.sessie4.bewaar('6.2', t.wissel.leesInhoud());
    assert.equal(t.sessie4.beoordeel('6.2', t.wissel.leesInhoud()).status, 'bijna', `na ${dagen} dagen`);
    assert.equal(ev09(t).status, 'bijna', `opgeslagen na ${dagen} dagen`);
  }
  const r = t.wissel.plakFeedback(maakFeedbackTekst({ zie: 'een heldere vraag', mis: 'een cijfer', vraag: 'wat is de norm?' }), 'teamgenoot');
  assert.equal(ev09(t).status, 'bijna'); // nog geen actie
  t.wissel.wijzigRegel(r.regel.id, { actie: 'Ik voeg een cijfer toe aan mijn vraag', status: 'bezig' });
  assert.equal(ev09(t).status, 'compleet');
});

test('EV-09: Nog niet zolang de student zelf geen feedback gaf; Compleet alleen met gegeven én ontvangen feedback met actie en status', () => {
  const t = tester();
  assert.equal(t.sessie4.beoordeel('6.2', {}).status, 'nog niet');
  const ontv = t.wissel.plakFeedback(maakFeedbackTekst({ zie: 'a', mis: 'b', vraag: 'c' }), 'coach');
  assert.equal(ev09(t).status, 'nog niet'); // wel ontvangen, niets gegeven
  t.wissel.voegRegelToe({ richting: 'gegeven', rol: 'coach', zie: 'x' });
  assert.equal(ev09(t).status, 'bijna'); // ontvangen feedback zonder actie: niet terug naar Nog niet
  t.wissel.wijzigRegel(ontv.regel.id, { actie: 'Ik pas mijn vraag aan' });
  assert.equal(ev09(t).status, 'compleet');
  t.wissel.wijzigRegel(ontv.regel.id, { vraag: '' });
  assert.equal(ev09(t).status, 'bijna'); // ik vraag me af niet meer ingevuld
});

// ------------------------------------------------------------ WS-6: post-its van andere teams

test('WS-6: een post-it van een ander team krijgt de rol „ander team" en het team legt één teamactie vast; beide staan in EV-09', () => {
  const t = tester();
  const r = t.wissel.voegRegelToe({ richting: 'ontvangen', rol: ROL_ANDER_TEAM, zie: 'een duidelijke muur', mis: 'de kosten', vraag: 'wie is de eigenaar?' });
  assert.equal(r.regel.rol, 'ander team');
  t.wissel.voegRegelToe({ richting: 'gegeven', rol: 'coach', zie: 'x' });
  const ta = t.wissel.zetTeamactie({ tekst: 'We voegen de kosten toe aan vel 2', status: 'open' });
  assert.equal(ta.ok, true);
  const inhoud = ev09(t).inhoud; // dossierpagina leest dit record: post-its en teamactie naast individuele feedback
  assert.equal(inhoud.regels.filter((x) => x.rol === 'ander team').length, 1);
  assert.equal(inhoud.teamactie.tekst, 'We voegen de kosten toe aan vel 2');
  assert.equal(t.wissel.zetTeamactie({ tekst: 'x', status: 'later' }).ok, false);
  t.wissel.zetTeamactie({ tekst: '', status: 'open' });
  assert.equal(ev09(t).inhoud.teamactie, null);
});

// ------------------------------------------------------------ WS-10, WS-9

test('WS-10: de privacytekst bij de Wissel noemt het klembord en heeft ≤ 60 woorden', () => {
  assert.match(PRIVACYTEKST, /klembord/);
  const n = tellers.telWoorden(PRIVACYTEKST);
  assert.ok(n > 0 && n <= 60, `${n} woorden`);
});

test('WS-9: de Wissel werkt zonder netwerk: geen fetch, XMLHttpRequest, sendBeacon of WebSocket, ook niet in de code', () => {
  const fetchOrigineel = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('netwerk aangeroepen'); };
  try {
    const a = metEigenWerk(tester());
    const b = metEigenWerk(tester(), ANDERE01, ANDERE02);
    a.wissel.plakWisselblok(b.wissel.mijnWisselblok().tekst, 'coach');
    a.wissel.geefFeedback({ blokId: a.wissel.blokken()[0].id, zie: 'x' });
    a.wissel.plakFeedback(maakFeedbackTekst({ zie: 'a', mis: 'b', vraag: 'c' }), 'coach');
  } finally { globalThis.fetch = fetchOrigineel; }
  for (const bestand of ['js/wissel.js', 'js/wissel-paneel.js', 'js/checks/lb4.js']) {
    const code = readFileSync(resolve(root, bestand), 'utf8');
    assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b|\bimport\(/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), `${bestand} maakt een verzoek`);
  }
});

test('RC-3/PR-2: EV-09 bevat geen alias, geen teamnummer en niet de tekst van het ontvangen wisselblok', () => {
  const t = wachtOpFeedback();
  bewaarProfiel(t.store, { alias: 'Kim', teamnummer: '7', vraagstuk: 'a b c', waaromZin: 'd e f' });
  t.wissel.plakFeedback(maakFeedbackTekst({ zie: 'a', mis: 'b', vraag: 'c' }), 'coach');
  const tekst = JSON.stringify(t.store.get('EV-09'));
  assert.ok(!tekst.includes('Kim') && !/teamnummer/i.test(tekst));
  assert.ok(!tekst.includes('orderpicken'), 'het ontvangen wisselblok staat in het bewijsrecord');
});

// ------------------------------------------------------------ WS-11: herinnering

const metActie = (dagenGeleden) => {
  const t = tester();
  const r = t.wissel.plakFeedback(maakFeedbackTekst({ zie: 'a', mis: 'b', vraag: 'c' }), 'coach');
  t.wissel.wijzigRegel(r.regel.id, { actie: 'Ik pas mijn onderzoeksvraag aan', status: 'bezig' });
  t.dagen(dagenGeleden);
  return { t, id: r.regel.id };
};

test('WS-11: 1 herinnering als de actie ≥ 7 dagen dezelfde status heeft, 0 bij 6 dagen', () => {
  assert.equal(metActie(6).t.wissel.herinneringen().length, 0);
  const h7 = metActie(7).t.wissel.herinneringen();
  assert.equal(h7.length, 1);
  assert.equal(h7[0].dagen, 7);
  assert.equal(metActie(30).t.wissel.herinneringen().length, 1);
  assert.equal(herinneringenUitStore(metActie(8).t.store, () => new Date(START + 8 * DAG)).length, 1); // ook buiten de Wissel te lezen
});

test('WS-11: geen herinnering bij een actie op „gedaan", zonder actietekst, of nadat de status is gezet (de teller begint opnieuw)', () => {
  const { t, id } = metActie(9);
  assert.equal(t.wissel.herinneringen().length, 1);
  t.wissel.wijzigRegel(id, { status: 'gedaan' });
  assert.equal(t.wissel.herinneringen().length, 0);
  t.dagen(30);
  assert.equal(t.wissel.herinneringen().length, 0); // gedaan blijft gedaan, ook na weken
  t.wissel.wijzigRegel(id, { status: 'open' });
  assert.equal(t.wissel.herinneringen().length, 0); // net gezet
  t.dagen(6);
  assert.equal(t.wissel.herinneringen().length, 0);
  t.dagen(1);
  assert.equal(t.wissel.herinneringen().length, 1);
  assert.equal(herinneringen({ regels: [{ id: 'r1', richting: 'ontvangen', actie: '', status: 'open', statusOp: '2026-01-01T00:00:00Z' }] }, new Date(START)).length, 0);
});

test('WS-11: de teamactie krijgt dezelfde herinnering; de klok is injecteerbaar', () => {
  const t = tester();
  t.wissel.zetTeamactie({ tekst: 'We passen vel 2 aan', status: 'open' });
  t.dagen(7);
  const h = t.wissel.herinneringen();
  assert.equal(h.length, 1);
  assert.equal(h[0].soort, 'teamactie');
  assert.equal(herinneringen(ev09(t).inhoud, new Date(START + 6 * DAG)).length, 0);
});

// ------------------------------------------------------------ ST-7 en de data

test('ST-7: leerblok 1 noemt de Wissel pas zichtbaar na de eerste versie van EV-02 (data en pagina)', () => {
  assert.equal(blok1.wissel.zichtbaarNa, 'EV-02');
  const js = readFileSync(resolve(root, 'js/leerblok.js'), 'utf8');
  assert.match(js, /wisselSectie\.hidden = !store\.get\(blok\.wissel\.zichtbaarNa\)/);
  assert.match(js, /hidden: true/);
});

test('data: leerblok-4.json bevat alleen taak 6.2 met EV-09, met de vier controles en de component feedbacklog', () => {
  assert.deepEqual(blok4.taken.map((x) => x.id), ['6.2']);
  assert.deepEqual(blok4.bewijsonderdelen.map((x) => x.id), ['EV-09']);
  assert.equal(blok4.taken[0].toepassing.component, 'feedbacklog');
  assert.deepEqual(blok4.taken[0].luk, [5]);
  assert.equal(bouwControles(blok4.taken[0].controles, blok4.taken[0].toepassing.velden).length, 4);
});

test('EV-01 en EV-02 hebben elk één kopiecontrole van soort B in de data', () => {
  for (const id of ['2.1', '2.2']) {
    const c = blok1.taken.find((x) => x.id === id).controles.filter((x) => x.type === 'nietGelijkAanWissel');
    assert.equal(c.length, 1);
    assert.equal(c[0].soort, 'B');
  }
});

// ------------------------------------------------------------ QA-2: drie goede en drie zwakke voorbeelden per controle

const LOG = (...regels) => ({ regels });
const R = (o) => ({ richting: 'ontvangen', rol: 'coach', zie: '', mis: '', vraag: '', actie: '', status: 'open', ...o });
const VOL = { zie: 'een heldere vraag', mis: 'een cijfer', vraag: 'wat is de norm?' };

const QA2 = {
  feedbackGegeven: {
    controle: feedbackGegeven({ id: 'g' }), soort: 'A',
    goed: [
      [LOG(R({ richting: 'gegeven', zie: 'een duidelijke vraag' })), 'ok'],
      [LOG(R({ richting: 'gegeven', mis: 'een cijfer' }), R(VOL)), 'ok'],
      [LOG(R(VOL), R({ richting: 'gegeven', vraag: 'is dit haalbaar?' })), 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Geef zelf feedback'],
      [LOG(R(VOL)), 'mist', 'Geef zelf feedback'],
      [LOG(R({ richting: 'gegeven', zie: '   ' })), 'mist', 'Geef zelf feedback'],
    ],
  },
  zieMisVraag: {
    controle: zieMisVraag({ id: 'z' }), soort: 'A',
    goed: [
      [LOG(R(VOL)), 'ok'],
      [LOG(R({ zie: 'a' }), R(VOL)), 'ok'],
      [LOG(R(VOL), R({ richting: 'gegeven', zie: 'x' })), 'ok'],
    ],
    zwak: [
      [{}, 'let op', 'Wacht op de feedback van je wisselpartner'],
      [LOG(R({ richting: 'gegeven', zie: 'x' })), 'let op', 'Wacht op de feedback'],
      [LOG(R({ zie: 'a', mis: 'b' })), 'let op', 'Vul bij de ontvangen feedback alle drie in'],
    ],
  },
  actieMetStatus: {
    controle: actieMetStatus({ id: 'a' }), soort: 'A',
    goed: [
      [LOG(R({ ...VOL, actie: 'Ik pas de vraag aan', status: 'open' })), 'ok'],
      [LOG(R({ ...VOL, actie: 'Ik overleg', status: 'bezig' })), 'ok'],
      [LOG(R(VOL), R({ ...VOL, actie: 'Klaar met aanpassen', status: 'gedaan' })), 'ok'],
    ],
    zwak: [
      [{}, 'let op', 'Wacht op de feedback van je wisselpartner'],
      [LOG(R(VOL)), 'let op', 'Schrijf bij de ontvangen feedback wat je ermee doet'],
      [LOG(R({ ...VOL, actie: 'Ik pas aan', status: 'misschien' })), 'let op', 'kies een status'],
    ],
  },
  eigenNietGelijkAanWissel: {
    controle: eigenNietGelijkAanWissel({ id: 'e' }), soort: 'B', context: null,
  },
};
const ontvangenBlok = { blok: { vraag: 'Wat is de beste oplossing voor de planners van de afdeling om sneller de roosters te maken, zodat medewerkers minder stress hebben?', zoekvragen: [{ frame: '', tekst: EV02.zoekvraag1 }, { frame: '', tekst: EV02.zoekvraag2 }, { frame: '', tekst: EV02.zoekvraag3 }] } };
const rec = (inhoud) => ({ inhoud });
QA2.eigenNietGelijkAanWissel.goed = [
  [{}, 'ok'], // niets ontvangen
  [{}, 'ok', { wissel: { ontvangen: [ontvangenBlok] }, eigen: { 'EV-01': rec({ ...EV01, gebruiker: 'de roosteraars' }), 'EV-02': rec({ ...EV02, zoekvraag1: 'Wat is anders?' }) } }],
  [{}, 'ok', { wissel: { ontvangen: [ontvangenBlok] }, eigen: {} }],
];
QA2.eigenNietGelijkAanWissel.zwak = [
  [{}, 'let op', 'dit is de tekst van je wisselpartner', { wissel: { ontvangen: [ontvangenBlok] }, eigen: { 'EV-01': rec(EV01) } }],
  [{}, 'let op', 'zoekvragen in EV-02', { wissel: { ontvangen: [ontvangenBlok] }, eigen: { 'EV-02': rec(EV02) } }],
  [{}, 'let op', 'onderzoeksvraag in EV-01 en zoekvragen in EV-02', { wissel: { ontvangen: [ontvangenBlok] }, eigen: { 'EV-01': rec(EV01), 'EV-02': rec(EV02) } }],
];
QA2.nietGelijkAanWissel = {
  controle: nietGelijkAanWissel({ id: 'n', onderdeel: 'vraag', velden: ['gebruiker', 'pain', 'waarde'] }), soort: 'B',
  goed: [
    [EV01, 'ok', { wissel: { ontvangen: [{ blok: { vraag: 'iets anders?', zoekvragen: [] } }] } }],
    [{ gebruiker: 'planners' }, 'ok', { wissel: { ontvangen: [ontvangenBlok] } }],
    [{}, 'ok', { wissel: { ontvangen: [ontvangenBlok] } }],
  ],
  zwak: [
    [EV01, 'let op', 'de onderzoeksvraag', { wissel: { ontvangen: [ontvangenBlok] } }],
    [EV01, 'let op', 'Schrijf je eigen versie', { wissel: { ontvangen: [{ blok: { vraag: '' , zoekvragen: [] } }, ontvangenBlok] } }],
    [{ ...EV01, waarde: `${EV01.waarde}.` }, 'let op', 'dit is de tekst van je wisselpartner', { wissel: { ontvangen: [ontvangenBlok] } }],
  ],
};

for (const [naam, h] of Object.entries(QA2)) {
  test(`QA-2: ${naam} heeft 3 goede en 3 zwakke voorbeelden met een melding die zegt wat ontbreekt`, () => {
    assert.equal(h.goed.length, 3);
    assert.equal(h.zwak.length, 3);
    const bevries = (o) => { Object.values(o ?? {}).forEach((v) => v && typeof v === 'object' && bevries(v)); return Object.freeze(o); };
    for (const [invoer, verwacht, ctx] of h.goed) {
      const r = h.controle(bevries(structuredClone(invoer)), ctx === undefined ? {} : ctx);
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.equal(r.soort, h.soort);
      assert.equal(r.melding, '');
    }
    for (const [invoer, verwacht, deel, ctx] of h.zwak) {
      const r = h.controle(bevries(structuredClone(invoer)), ctx === undefined ? {} : ctx);
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.equal(r.soort, h.soort);
      assert.ok(r.melding.toLowerCase().includes(deel.toLowerCase()), `melding "${r.melding}" mist "${deel}"`); // BW-9
      assert.ok(r.melding.endsWith('.'));
    }
  });
}

test('BW-8: de controles van de Wissel geven bij vreemde invoer geen fout maar een resultaat (zoals de contentcontrole ze aanroept)', () => {
  for (const c of blok4.taken[0].controles) {
    const f = bouwControles([c], blok4.taken[0].toepassing.velden)[0];
    for (const invoer of [{}, { regels: 'x y z' }, { regels: [null, 3, 'a'] }, { regels: 'x y z w v', teamactie: 'x y z w v' }]) {
      assert.ok(['ok', 'let op', 'mist'].includes(f(invoer, { taak: blok4.taken[0] }).resultaat));
    }
  }
  const a = voerUit(bouwControles(blok4.taken[0].controles, blok4.taken[0].toepassing.velden), { regels: [] }, {});
  assert.deepEqual(a, voerUit(bouwControles(blok4.taken[0].controles, blok4.taken[0].toepassing.velden), { regels: [] }, {})); // geen toeval
});
