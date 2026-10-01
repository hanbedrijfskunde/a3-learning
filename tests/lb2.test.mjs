import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  zoekOperator, heeftOperator, termenPerBegrip, toolBijRouteB, promptZonderVerboden, bouwPrompt, verbodenWoorden,
  bronGegevens, aaoccOordelen, aaoccToelichtingen, verificatieBijRouteB, apaFormaat, apaJaarGelijk, apaJaar, linkVorm, besluitGenomen,
  ROUTE_A, ROUTE_B,
  isVindplaats, imradIngevuld, imradVindplaats, imradMeenemen, aiGeverifieerd, artikelPrompt, kiesTitel, AI_ONTLEDEN,
} from '../js/checks/lb2.js';
import { bouwControles } from '../js/checks/index.js';
import { voerUit } from '../js/checks/core.js';
import { bepaalStatus } from '../js/status.js';
import { oefenModel } from '../js/weergave.js';
import { controleerFormaat } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blok = JSON.parse(readFileSync(resolve(root, 'data/leerblok-2.json'), 'utf8'));
const taak = (id) => blok.taken.find((t) => t.id === id);

/** QA-2: per controle 3 goede en 3 zwakke voorbeelden. [invoer, verwacht, deel van de melding] */
const CONTROLES = {
  zoekOperator: {
    controle: zoekOperator({ id: 'z', veld: 'zoekstring', routeVeld: 'route' }), soort: 'A',
    goed: [
      [{ route: ROUTE_A, zoekstring: '"customer satisfaction" AND webshop' }, 'ok'],
      [{ route: ROUTE_A, zoekstring: 'webshop* tevredenheid' }, 'ok'],
      [{ route: ROUTE_B, zoekstring: '' }, 'ok'],
    ],
    zwak: [
      [{ route: ROUTE_A }, 'mist', 'Schrijf je zoekstring'],
      [{ route: ROUTE_A, zoekstring: 'klanttevredenheid webshop' }, 'let op', 'geen zoekoperator'],
      [{ route: ROUTE_A, zoekstring: 'satisfaction and webshop' }, 'let op', 'geen zoekoperator'],
    ],
  },
  termenPerBegrip: {
    controle: termenPerBegrip({ id: 't', rijen: [['k1', 's1', 'e1'], ['k2', 's2', 'e2']] }), soort: 'A',
    goed: [
      [{ k1: 'a', s1: 'b', e1: 'c' }, 'ok'],
      [{ k1: 'a', s1: 'b', e1: 'c', k2: 'd', s2: 'e', e2: 'f' }, 'ok'],
      [{ k2: 'd', s2: 'e', e2: 'f' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'minstens één kernbegrip'],
      [{ k1: 'a', s1: 'b' }, 'let op', 'rij 1: Engelse term'],
      [{ k1: 'a', s1: 'b', e1: 'c', k2: 'd' }, 'let op', 'rij 2: synoniem en Engelse term'],
    ],
  },
  toolBijRouteB: {
    controle: toolBijRouteB({ id: 'tb', veld: 'tool', routeVeld: 'route' }), soort: 'A',
    goed: [[{ route: ROUTE_B, tool: 'Perplexity' }, 'ok'], [{ route: ROUTE_A }, 'ok'], [{}, 'ok']],
    zwak: [
      [{ route: ROUTE_B }, 'mist', 'Kies welke AI-tool'],
      [{ route: ROUTE_B, tool: '' }, 'mist', 'Kies welke AI-tool'],
      [{ route: ROUTE_B, tool: '  ' }, 'mist', 'Kies welke AI-tool'],
    ],
  },
  promptZonderVerboden: {
    controle: promptZonderVerboden({ id: 'p', veld: 'prompt', lijstVeld: 'lijst', routeVeld: 'route' }), soort: 'B',
    goed: [
      [{ route: ROUTE_B, prompt: 'Zoek bronnen over klanttevredenheid.', lijst: 'Westmoreland, Jansen' }, 'ok'],
      [{ route: ROUTE_B, prompt: 'Zoek over westmorelandse vertaling', lijst: 'Westmoreland' }, 'ok'],
      [{ route: ROUTE_A, prompt: 'Westmoreland', lijst: 'Westmoreland' }, 'ok'],
    ],
    zwak: [
      [{ route: ROUTE_B, prompt: '', lijst: 'x' }, 'mist', 'Maak je prompt'],
      [{ route: ROUTE_B, prompt: 'Zoek bronnen.', lijst: '' }, 'let op', 'niet noemen'],
      [{ route: ROUTE_B, prompt: 'Zoek bij Westmoreland naar bronnen.', lijst: 'Westmoreland' }, 'let op', 'Westmoreland'],
    ],
  },
  bronGegevens: {
    controle: bronGegevens({ id: 'g', velden: ['a', 'j', 't', 'l'], labels: ['auteur', 'jaar', 'titel', 'link'] }), soort: 'A',
    goed: [[{ a: 'x', j: '2020', t: 'y', l: 'https://a.nl' }, 'ok'], [{ a: 'Jan', j: 'z.d.', t: 'T', l: 'doi.org/1' }, 'ok'], [{ a: 'a', j: '1', t: 't', l: 'l' }, 'ok']],
    zwak: [
      [{}, 'mist', 'auteur, jaar, titel, link'],
      [{ a: 'x', j: '2020', t: 'y' }, 'mist', 'link'],
      [{ a: 'x', j: ' ', t: 'y', l: 'l' }, 'mist', 'jaar'],
    ],
  },
  aaoccOordelen: {
    controle: aaoccOordelen({ id: 'o', velden: ['o1', 'o2'], labels: ['Authority', 'Accuracy'] }), soort: 'A',
    goed: [[{ o1: '+', o2: '?' }, 'ok'], [{ o1: '–', o2: '–' }, 'ok'], [{ o1: ['+'], o2: '+' }, 'ok']],
    zwak: [
      [{}, 'mist', 'Authority, Accuracy'],
      [{ o1: '+' }, 'mist', 'Accuracy'],
      [{ o1: 'goed', o2: '+' }, 'mist', 'Authority'],
    ],
  },
  aaoccToelichtingen: {
    controle: aaoccToelichtingen({ id: 'tl', velden: ['t1', 't2'], labels: ['Authority', 'Accuracy'], min: 1 }), soort: 'C',
    goed: [[{ t1: 'Een zin.', t2: 'Nog een.' }, 'ok'], [{ t1: 'Twee. Zinnen.', t2: 'Ook.' }, 'ok'], [{ t1: 'Zin zonder punt', t2: 'Ook zo' }, 'ok']],
    zwak: [
      [{}, 'mist', 'Authority, Accuracy'],
      [{ t1: 'Een zin.' }, 'let op', 'Accuracy'],
      [{ t1: '', t2: 'Een zin.' }, 'let op', 'Authority'],
    ],
  },
  verificatieBijRouteB: {
    controle: verificatieBijRouteB({ id: 'v', veld: 'ver', routeVeld: 'route' }), soort: 'A',
    goed: [
      [{ route: ROUTE_A }, 'ok'],
      [{ route: ROUTE_B, ver: ['de bron bestaat echt', 'er staat in wat de AI zegt'] }, 'ok'],
      [{ route: ROUTE_A, ver: [] }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Kies hoe je de bron vond'],
      [{ route: ROUTE_B }, 'mist', 'beide vinkjes'],
      [{ route: ROUTE_B, ver: ['de bron bestaat echt'] }, 'let op', 'andere vinkje'],
    ],
  },
  apaFormaat: {
    controle: apaFormaat({ id: 'af', veld: 'apa' }), soort: 'A',
    goed: [
      [{ apa: 'Mayer, R. E. (2004). Should there be a three-strikes rule. American Psychologist, 59(1), 14–19.' }, 'ok'],
      [{ apa: 'Atlassian. (z.d.). Problem framing. Atlassian.' }, 'ok'],
      [{ apa: 'Bureau Tromp. (2023, 9 februari). Wat is de A3? [Video]. YouTube.' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Schrijf de bron in APA'],
      [{ apa: 'Mayer 2004, Should there be' }, 'let op', 'jaar tussen haakjes'],
      [{ apa: '(2004). Titel zonder auteur.' }, 'let op', 'jaar tussen haakjes'],
    ],
  },
  apaJaarGelijk: {
    controle: apaJaarGelijk({ id: 'aj', veld: 'apa', jaarVeld: 'jaar' }), soort: 'B',
    goed: [
      [{ jaar: '2004', apa: 'Mayer (2004). Titel.' }, 'ok'],
      [{ jaar: '2023', apa: 'Tromp. (2023, 9 februari). Titel.' }, 'ok'],
      [{ jaar: 'z.d.', apa: 'Atlassian. (z.d.). Titel.' }, 'ok'],
    ],
    zwak: [
      [{ jaar: '2005', apa: 'Mayer (2004). Titel.' }, 'let op', '2004'],
      [{ jaar: '2019', apa: 'Tromp. (2023, 9 februari). Titel.' }, 'let op', '2023'],
      [{ jaar: 'z.d.', apa: 'Atlassian. (2020). Titel.' }, 'let op', '2020'],
    ],
  },
  linkVorm: {
    controle: linkVorm({ id: 'l', veld: 'link' }), soort: 'A',
    goed: [[{ link: 'https://www.a.nl/x' }, 'ok'], [{ link: 'https://doi.org/10.1/2' }, 'ok'], [{ link: 'doi.org/10.1/2' }, 'ok']],
    zwak: [
      [{}, 'mist', 'link of DOI'],
      [{ link: 'www.a.nl' }, 'let op', 'https://'],
      [{ link: 'http://a.nl' }, 'let op', 'https://'],
    ],
  },
  besluitGenomen: {
    controle: besluitGenomen({ id: 'b', veld: 'besluit', toegestaan: ['we gebruiken deze bron', 'we zoeken verder'] }), soort: 'A',
    goed: [[{ besluit: 'we gebruiken deze bron' }, 'ok'], [{ besluit: 'we zoeken verder' }, 'ok'], [{ besluit: ['we zoeken verder'] }, 'ok']],
    zwak: [[{}, 'mist', 'Kies je besluit'], [{ besluit: 'misschien' }, 'mist', 'Kies je besluit'], [{ besluit: '' }, 'mist', 'Kies je besluit']],
  },
  imradIngevuld: {
    controle: imradIngevuld({ id: 'i', velden: ['iWat', 'mWat', 'rWat'], labels: ['Inleiding', 'Methode', 'Resultaten'] }), soort: 'A',
    goed: [
      [{ iWat: 'Bouwt op Oliver.', mWat: 'Acht interviews.', rWat: 'In lopende tekst.' }, 'ok'],
      [{ iWat: 'Twee modellen.', mWat: 'Enquête, n = 300.', rWat: 'Eén tabel.' }, 'ok'],
      [{ iWat: 'Definitie van TOM.', mWat: 'Casestudy.', rWat: 'Een model als figuur.' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Inleiding, Methode, Resultaten'],
      [{ iWat: 'x x x', mWat: '' }, 'mist', 'Methode, Resultaten'],
      [{ iWat: 'Ja.', mWat: 'Ja.', rWat: '   ' }, 'mist', 'Resultaten'],
    ],
  },
  imradVindplaats: {
    controle: imradVindplaats({ id: 'w', velden: ['iWaar', 'mWaar', 'rWaar'], labels: ['Inleiding', 'Methode', 'Resultaten'] }), soort: 'A',
    goed: [
      [{ iWaar: 'Inleiding', mWaar: 'Methode', rWaar: 'p. 7' }, 'ok'],
      [{ iWaar: 'Introduction, p. 2', mWaar: '§ 3.2', rWaar: 'Table 2' }, 'ok'],
      [{ iWaar: 'blz 3', mWaar: 'Methods', rWaar: 'figuur 1' }, 'ok'],
    ],
    zwak: [
      [{ iWaar: 'Inleiding', mWaar: '', rWaar: 'p. 7' }, 'mist', 'Methode'],
      [{ iWaar: 'ergens vooraan', mWaar: 'Methode', rWaar: 'p. 7' }, 'let op', 'Inleiding'],
      [{}, 'mist', 'Inleiding, Methode, Resultaten'],
    ],
  },
  imradMeenemen: {
    controle: imradMeenemen({ id: 'm', velden: ['iMee', 'mMee', 'rMee'], labels: ['Inleiding', 'Methode', 'Resultaten'] }), soort: 'A',
    goed: [
      [{ iMee: 'ja', mMee: 'deels', rMee: 'nee' }, 'ok'],
      [{ iMee: 'nee', mMee: 'nee', rMee: 'nee' }, 'ok'],
      [{ iMee: ['ja'], mMee: 'ja', rMee: 'deels' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Inleiding, Methode, Resultaten'],
      [{ iMee: 'ja', mMee: 'misschien', rMee: 'ja' }, 'mist', 'Methode'],
      [{ iMee: 'ja', mMee: 'ja' }, 'mist', 'Resultaten'],
    ],
  },
  aiGeverifieerd: {
    controle: aiGeverifieerd({ id: 'a', veld: 'aiCheck', aiVeld: 'ai', waarde: AI_ONTLEDEN }), soort: 'A',
    goed: [
      [{ ai: 'nee' }, 'ok'],
      [{ ai: 'ja, om het te begrijpen' }, 'ok'],
      [{ ai: AI_ONTLEDEN, aiCheck: ['Ik heb elk citaat en elke vindplaats zelf in het artikel teruggevonden.'] }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'AI'],
      [{ ai: AI_ONTLEDEN }, 'mist', 'teruggevonden'],
      [{ ai: AI_ONTLEDEN, aiCheck: [] }, 'mist', 'teruggevonden'],
    ],
  },
};

for (const [naam, c] of Object.entries(CONTROLES)) {
  test(`QA-2: ${naam} heeft 3 goede en 3 zwakke voorbeelden`, () => {
    assert.equal(c.goed.length, 3);
    assert.equal(c.zwak.length, 3);
    for (const [invoer, verwacht] of c.goed) {
      const r = c.controle(invoer);
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.equal(r.soort, c.soort);
    }
    for (const [invoer, verwacht, deel] of c.zwak) {
      const r = c.controle(invoer);
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.ok(r.melding.includes(deel), `melding "${r.melding}" noemt niet "${deel}"`);
    }
  });
}

test('EV-04: een optionele bron die helemaal leeg is telt niet mee; een begonnen bron geeft let op, nooit mist', () => {
  const c = bronGegevens({ id: 'g2', velden: ['a', 'j'], labels: ['auteur', 'jaar'], blok: ['a', 'j', 't'], optioneel: true });
  assert.equal(c({}).resultaat, 'ok');
  assert.equal(c({ a: 'x' }).resultaat, 'let op');
  assert.equal(c({ a: 'x', j: '2020' }).resultaat, 'ok');
  const t = aaoccToelichtingen({ id: 'tl', velden: ['t1'], labels: ['A'], blok: ['t1', 'o1'], optioneel: true });
  assert.equal(t({}).resultaat, 'ok');
  assert.equal(t({ o1: '+' }).resultaat, 'mist', 'soort C blijft mist (Bijna)');
});

test('LB-5: heeftOperator herkent aanhalingstekens, AND, OR, NOT, * en ?', () => {
  for (const s of ['"a b"', 'a AND b', 'a OR b', 'a NOT b', 'web*', 'we?', '(a OR b) AND c']) assert.ok(heeftOperator(s), s);
  for (const s of ['', 'a b', 'a and b', 'ANDERS', 'NOTITIE a']) assert.ok(!heeftOperator(s), s);
});

test('apaJaar leest het jaar uit een APA-regel', () => {
  assert.equal(apaJaar('A. (2019). T.'), '2019');
  assert.equal(apaJaar('A. (2019a). T.'), '2019');
  assert.equal(apaJaar('A. (z.d.). T.'), 'z.d.');
  assert.equal(apaJaar('Anderson, L. W. (Red.). (2001). T.'), '2001');
  assert.equal(apaJaar('Geen jaar'), undefined);
});

test('EV-12: isVindplaats herkent sectienamen, pagina’s, paragrafen, tabellen en figuren', () => {
  for (const s of ['Inleiding', 'introductie', 'Introduction', 'Theoretisch kader', 'Literature review', 'Methode', 'methoden', 'Method',
    'Methods section', 'Methodology', 'Resultaten', 'Results', 'Bevindingen', 'Discussie', 'Discussion', 'Conclusie', 'Abstract',
    'Samenvatting', 'p. 4', 'p.4', 'pp. 4-6', 'pag. 12', 'pagina 3', 'blz 12', 'blz. 12', '§ 3.2', '§3', 'tabel 2', 'Table 1', 'figuur 1',
    'Fig. 3', 'sectie 2', 'section 4', 'H3', 'hoofdstuk 2']) assert.ok(isVindplaats(s), s);
  for (const s of ['', '   ', 'ergens vooraan', 'pagina vier', 'in het artikel', 'zie boven']) assert.ok(!isVindplaats(s), s);
});

test('EV-12 (eindreview): isVindplaats kent ook Engelse koppen, page/bladzijde/paragraaf/chapter en samenstellingen', () => {
  for (const s of ['page 4', 'Page 4', 'bladzijde 4', 'paragraaf 3', 'par. 3', 'chapter 3', 'Theoretical framework', 'Theory', 'Literature',
    'Analysis', 'Analyse', 'Data collection', 'Research design', 'Onderzoeksopzet', 'Dataverzameling', 'methodesectie']) assert.ok(isVindplaats(s), s);
  for (const s of ['ergens vooraan', 'pagina vier', 'in het artikel']) assert.ok(!isVindplaats(s), s);
});

test('EV-12: aiGeverifieerd negeert een achtergebleven vinkje als AI niet om te ontleden is gebruikt', () => {
  const c = aiGeverifieerd({ id: 'a', veld: 'aiCheck', aiVeld: 'ai', waarde: AI_ONTLEDEN });
  assert.equal(c({ ai: 'nee', aiCheck: ['x'] }).resultaat, 'ok');
});

test('EV-12: de artikelprompt vult de titel in, vraagt per deel een citaat met pagina en zegt „verzin niets”', () => {
  const p = artikelPrompt('Klanttevredenheid in webwinkels');
  assert.match(p, /^Ik lees dit artikel: Klanttevredenheid in webwinkels\. /);
  assert.match(p, /letterlijk citaat .*paginanummer/);
  assert.match(p, /Verzin niets\. Staat iets niet in het artikel, zeg dat dan\.$/);
  assert.match(artikelPrompt(''), /^Ik lees dit artikel: \[titel van je artikel\]\. /);
});

test('EV-12: kiesTitel neemt de eerste ingevulde titel', () => {
  assert.equal(kiesTitel({ anderArtikel: '  ', b1titel: 'A' }, ['anderArtikel', 'b1titel']), 'A');
  assert.equal(kiesTitel({ anderArtikel: 'B', b1titel: 'A' }, ['anderArtikel', 'b1titel']), 'B');
  assert.equal(kiesTitel({}, ['anderArtikel', 'b1titel']), '');
});

// LB-6: 6 testprompts, elk met de woorden die de waarschuwing moet vinden (0 gemist, 0 vals alarm)
const TESTPROMPTS = [
  { lijst: 'Westmoreland', prompt: 'Zoek bronnen voor Westmoreland over TOM.', verwacht: ['Westmoreland'] },
  { lijst: 'Westmoreland, Jansen', prompt: 'Zoek over klantbeleving. Contact: mevrouw JANSEN.', verwacht: ['Jansen'] },
  { lijst: 'Acme BV; Piet de Vries', prompt: 'Voor acme bv en piet de vries zoeken we bronnen.', verwacht: ['Acme BV', 'Piet de Vries'] },
  { lijst: 'Zoë', prompt: 'Zoek bronnen van zoe over retentie.', verwacht: ['Zoë'] },
  { lijst: 'Westmoreland\nJansen', prompt: 'Zoek over webshops in Nederland.', verwacht: [] },
  { lijst: 'Shop', prompt: 'Zoek over webshops en shopping. Shop! Shop.', verwacht: ['Shop'] },
];
test('LB-6: 0 gemiste woorden en 0 valse alarmen in 6 testprompts, 1 waarschuwing per woord', () => {
  for (const t of TESTPROMPTS) assert.deepEqual(verbodenWoorden(t.prompt, t.lijst), t.verwacht, t.prompt);
  assert.equal(TESTPROMPTS.length, 6);
  assert.deepEqual(verbodenWoorden('Jansen en jansen', 'Jansen, jansen'), ['Jansen'], 'een woord geeft één waarschuwing');
});

test('LB-6: de gegenereerde prompt vult de zoekvraag in en laat lege stukken als plek staan', () => {
  const p = bouwPrompt({ zoekvraag: 'Welke factoren bepalen X?', context: 'retail, Nederland', jaar: '2015' });
  assert.match(p, /bij deze vraag: Welke factoren bepalen X\? Context: retail, Nederland\. Alleen bronnen van na 2015,/);
  assert.match(bouwPrompt({}), /\[zoekvraag uit 2\.2\]\. Context: \[sector, land, soort organisatie\]\. Alleen bronnen van na \[jaar\]/);
  assert.match(p, /Verzin geen bronnen\. Vind je niets, zeg dat dan\.$/);
});

test('EV-03/LB-6: een prompt uit de generator met een verboden woord in de zoekvraag wordt gevonden', () => {
  const invoer = { route: ROUTE_B, lijst: 'Westmoreland', prompt: bouwPrompt({ zoekvraag: 'Hoe werkt Westmoreland?' }) };
  const r = promptZonderVerboden({ id: 'p', veld: 'prompt', lijstVeld: 'lijst', routeVeld: 'route' })(invoer);
  assert.equal(r.resultaat, 'let op');
});

// ---- de data van leerblok 2 zelf

const ALLE_GOED = {
  kb1: 'klanttevredenheid', syn1: 'klantwaardering', en1: 'customer satisfaction',
  route: ROUTE_A, zoekstring: '"customer satisfaction" AND webshop*', bron: 'Mayer, 2004, Should there be', werkte: 'Route A werkte goed.',
};
const BRON = (p) => ({
  [`${p}auteur`]: 'Mayer', [`${p}jaar`]: '2004', [`${p}titel`]: 'Should there be', [`${p}link`]: 'https://doi.org/10.1037/0003-066X.59.1.14',
  [`${p}route`]: ROUTE_A, [`${p}besluit`]: 'we gebruiken deze bron',
  [`${p}apa`]: 'Mayer, R. E. (2004). Should there be a three-strikes rule.',
  ...Object.fromEntries([1, 2, 3, 4, 5].flatMap((i) => [[`${p}o${i}`, '+'], [`${p}t${i}`, 'Een zin.']])),
});
const status = (t, invoer) => bepaalStatus(voerUit(bouwControles(t.controles, t.toepassing.velden), invoer, { taak: t }));

test('EV-03: volledige route A is Compleet, zonder termen Nog niet, zonder operator Bijna', () => {
  const t = taak('3.2');
  assert.equal(status(t, ALLE_GOED), 'compleet');
  assert.equal(status(t, { ...ALLE_GOED, kb1: '', syn1: '', en1: '' }), 'nog niet');
  assert.equal(status(t, { ...ALLE_GOED, zoekstring: 'klanttevredenheid webshop' }), 'bijna');
});

test('EV-03: route B met een naam uit de niet-noemen-lijst in de prompt is Bijna, zonder is Compleet', () => {
  const t = taak('3.2');
  const b = { ...ALLE_GOED, route: ROUTE_B, tool: 'Perplexity', nietNoemen: 'Westmoreland' };
  assert.equal(status(t, { ...b, prompt: bouwPrompt({ zoekvraag: 'Wat vinden klanten?' }) }), 'compleet');
  assert.equal(status(t, { ...b, prompt: bouwPrompt({ zoekvraag: 'Wat vinden klanten van Westmoreland?' }) }), 'bijna');
});

test('EV-04: één volledige bron is Compleet; bron 2 half ingevuld is Bijna; AI-bron zonder vinkjes is Nog niet', () => {
  const t = taak('4.1');
  assert.equal(status(t, BRON('b1')), 'compleet');
  assert.equal(status(t, { ...BRON('b1'), b2auteur: 'Half' }), 'bijna');
  assert.equal(status(t, { ...BRON('b1'), b1route: ROUTE_B }), 'nog niet');
  assert.equal(status(t, { ...BRON('b1'), b1route: ROUTE_B, b1ver: ['de bron bestaat echt', 'er staat in wat de AI zegt'] }), 'compleet');
  assert.equal(status(t, { ...BRON('b1'), ...BRON('b2') }), 'compleet', 'twee bronnen invoerbaar (LB-7)');
  assert.equal(status(t, { ...BRON('b1'), b1apa: 'Mayer, R. E. (2005). Should there be.' }), 'bijna', 'jaar in APA wijkt af');
  assert.equal(status(t, { ...BRON('b1'), b1link: 'www.a.nl' }), 'bijna');
});

test('EV-05 en LB-8: twee kanten, één argumentveld, argument van twee zinnen (stelling in 4.3, ADR B102)', () => {
  const t = taak('4.3');
  assert.deepEqual(t.toepassing.velden.find((v) => v.id === 'kant').opties, ['voor', 'tegen']);
  assert.equal(t.toepassing.velden.filter((v) => v.type === 'lang').length, 1);
  assert.equal(status(t, { kant: 'voor', argument: 'Eerste zin. Tweede zin.' }), 'compleet');
  assert.equal(status(t, { kant: 'voor' }), 'bijna', 'zonder argument: soort C mist');
  const kort = voerUit(bouwControles(t.controles, t.toepassing.velden), { kant: 'voor', argument: 'Eerste zin.' }, { taak: t });
  assert.equal(kort.find((c) => c.id === 'argument-zinnen').resultaat, 'let op', 'één zin: let op (telt niet mee voor de status, BW-11)');
  assert.equal(status(t, { argument: 'Eerste zin. Tweede zin.' }), 'nog niet');
});

test('LB-5/LB-7: de weergave verwijst alleen naar bestaande velden en toont elk veld precies één keer', () => {
  for (const t of blok.taken.filter((x) => x.toepassing.weergave)) {
    const ids = new Set(t.toepassing.velden.map((v) => v.id));
    const gezien = [];
    const loop = (g) => {
      if (!g.afgeleidVan) gezien.push(...(g.velden ?? []), ...(g.tabel?.rijen.flat().filter((c) => typeof c === 'string') ?? []));
      (g.groepen ?? []).forEach(loop);
    };
    t.toepassing.weergave.groepen.forEach(loop);
    for (const id of gezien) assert.ok(ids.has(id), `${t.id}: onbekend veld ${id}`);
    assert.equal(new Set(gezien).size, gezien.length, `${t.id}: een veld staat twee keer op het scherm`);
    const afgeleid = t.toepassing.velden.filter((v) => v.afgeleidVan).map((v) => v.id);
    const nodig = t.toepassing.velden.filter((v) => !v.afgeleidVan).map((v) => v.id).filter((id) => !gezien.includes(id));
    assert.deepEqual(nodig, [], `${t.id}: velden zonder plek op het scherm`);
    assert.ok(afgeleid.every((id) => taak(t.toepassing.weergave.groepen.find((g) => g.afgeleidVan)?.afgeleidVan).toepassing.velden.some((v) => v.id === id)), 'afgeleide velden bestaan in de bron');
  }
});

test('LB-5: leerblok 2 heeft 1 zoektermentabel, 1 zoekstringveld en 2 routes', () => {
  const t31 = taak('3.1');
  assert.equal(t31.toepassing.weergave.groepen.filter((g) => g.tabel).length, 1);
  const t32 = taak('3.2');
  assert.equal(t32.toepassing.velden.filter((v) => v.id === 'zoekstring').length, 1);
  assert.equal(t32.toepassing.velden.find((v) => v.id === 'route').opties.length, 2);
});

test('TK-2: elke taak van leerblok 2 heeft waarom en klaar als; EV-03, EV-04, EV-12 en EV-05 staan bij 3.2, 4.1, 4.2 en 4.3', () => {
  assert.equal(blok.taken.length, 5);
  for (const t of blok.taken) { assert.ok(t.waarom.tekst); assert.ok(t.klaarAls.tekst); }
  assert.deepEqual(blok.bewijsonderdelen.map((b) => [b.id, b.taak]), [['EV-03', '3.2'], ['EV-04', '4.1'], ['EV-12', '4.2'], ['EV-05', '4.3']]);
});

// ---- TK-2: teksten met bron werkboek staan letterlijk in het werkboek (overgeslagen zonder het bestand)
const pad = process.env.WERKBOEK_PAD ?? resolve(root, '../c-cluster-1/WK5/Werkboek_A3-start_week5.html');
const opts = { skip: existsSync(pad) ? false : `werkboek niet gevonden op ${pad}` };
const ENT = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&nbsp;': ' ', '&#39;': "'" };
const schoon = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, (e) => ENT[e] ?? e).replace(/\s+/g, ' ').trim();
function leesWerkboek(html) {
  const uit = {};
  for (const b of html.split('<div class="act">').slice(1)) {
    const nr = schoon(b.match(/<span class="nr">(.*?)<\/span>/s)?.[1] ?? '');
    if (!nr) continue;
    const st = b.match(/<p class="stappen">(.*?)<\/p>/s);
    uit[nr] = {
      titel: schoon(b.match(/<h3>(.*?)<\/h3>/s)?.[1] ?? ''), vorm: schoon(b.match(/<span class="vorm[^"]*">(.*?)<\/span>/s)?.[1] ?? ''),
      tijd: schoon(b.match(/<span class="tijd">(.*?)<\/span>/s)?.[1] ?? ''), stappen: st ? schoon(st[1]) : undefined,
      heeftWaarom: /<p class="waarom">/.test(b), heeftKlaar: /<p class="klaar">/.test(b),
    };
  }
  return uit;
}
// ADR B102: taak 4.2 (IMRAD) staat alleen in de e-learning; de stelling heet in het werkboek 4.2 en heeft daar een andere tekst.
const ALLEEN_ELEARNING = ['4.2'];
const WERKBOEK_NR = { '4.3': '4.2' };
test('TK-2: taken 3.1, 3.2, 4.1 en de stelling kloppen met het werkboek (titel, vorm, tijd, opdracht met bron werkboek)', opts, () => {
  const wb = leesWerkboek(readFileSync(pad, 'utf8'));
  let n = 0;
  for (const t of blok.taken.filter((x) => !ALLEEN_ELEARNING.includes(x.id))) {
    const w = wb[WERKBOEK_NR[t.id] ?? t.id];
    assert.ok(w, `taak ${t.id} staat niet in het werkboek`);
    if (!WERKBOEK_NR[t.id]) assert.equal(t.titel, w.titel);
    assert.equal(t.vorm, w.vorm);
    if (t.richttijd.bron === 'werkboek') { assert.equal(t.richttijd.tekst, w.tijd); n += 1; }
    if (t.toepassing.opdracht.bron === 'werkboek') { assert.equal(t.toepassing.opdracht.tekst, w.stappen); n += 1; }
    if (t.waarom.bron === 'concept-auteur') assert.equal(w.heeftWaarom, false, `waarom ${t.id} staat wel in het werkboek`);
    if (t.klaarAls.bron === 'concept-auteur') assert.equal(w.heeftKlaar, false, `klaar als ${t.id} staat wel in het werkboek`);
  }
  assert.ok(n >= 6, `slechts ${n} teksten vergeleken`);
});

// ---------------------------------------------------------------- oefencasus 3.2: twee routes in tweetallen (ADR B100)

test('ADR B100: de oefening van 3.2 heeft dezelfde twee routes als de toepassing, een promptgenerator en een vergelijking', () => {
  const t = taak('3.2');
  const ids = t.oefening.velden.map((v) => v.id);
  assert.deepEqual(t.oefening.velden.find((v) => v.id === 'route').opties, t.toepassing.velden.find((v) => v.id === 'route').opties);
  const groepen = t.oefening.weergave.groepen;
  assert.deepEqual(groepen.filter((g) => g.alleenBij).map((g) => g.alleenBij.waarde), [ROUTE_A, ROUTE_B]);
  const gezien = groepen.flatMap((g) => g.velden ?? []);
  assert.deepEqual([...gezien].sort(), [...ids].sort(), 'elk oefenveld staat precies één keer op het scherm');
  const p = groepen.find((g) => g.promptgenerator).promptgenerator;
  for (const id of [p.zoekvraag, p.context, p.jaar, p.lijst, p.prompt]) assert.ok(ids.includes(id), id);
  assert.ok(ids.includes('vergelijking'));
});

test('ADR B100 en TK-6: alleen een route kiezen toont het modelantwoord nog niet; eigen werk in een route of de vergelijking wel', () => {
  const t = taak('3.2');
  assert.equal(oefenModel(t, { invoer: { route: ROUTE_B } }).modelZichtbaar, false);
  assert.equal(oefenModel(t, { invoer: { route: ROUTE_A, zoekstring: 'webshop*' } }).modelZichtbaar, true);
  assert.equal(oefenModel(t, { invoer: { route: ROUTE_B, context: 'webshops in Nederland' } }).modelZichtbaar, true);
  assert.equal(oefenModel(t, { invoer: { vergelijking: 'Route A vond meer.' } }).modelZichtbaar, true);
  assert.equal(oefenModel(t, { invoer: { context: 'x' }, overgeslagen: true }).modelZichtbaar, false);
});

test('ADR B100: de modelprompt is wat de promptgenerator maakt en noemt geen naam uit de niet-noemen-lijst', () => {
  const m = taak('3.2').modelantwoord.velden;
  assert.equal(m.prompt, bouwPrompt({ zoekvraag: 'Welke factoren bepalen de klanttevredenheid bij webshops?', context: m.context, jaar: m.jaar }));
  assert.deepEqual(verbodenWoorden(m.prompt, m.nietNoemen), []);
});

test('QA-3 (sabotage): de contentcontrole meldt een modelNa met een onbekend veld of een onbekende waarde', () => {
  const fouten = (b) => controleerFormaat(b, 'leerblok-2.json').fouten.join('\n');
  assert.equal(fouten(blok), '');
  const a = JSON.parse(JSON.stringify(blok)); a.taken.find((t) => t.id === '3.2').oefening.modelNa = ['bestaatniet'];
  assert.match(fouten(a), /modelNa noemt bestaatniet/);
  const b = JSON.parse(JSON.stringify(blok)); b.taken.find((t) => t.id === '3.2').oefening.modelNa = 'later';
  assert.match(fouten(b), /modelNa "later" is onbekend/);
});

// ---------------------------------------------------------------- taak 4.2: een artikel ontleden met IMRAD (EV-12, ADR B102, B103)

const EV12_GOED = {
  ai: 'nee', iWat: 'Bouwt op Oliver (1980).', iWaar: 'Inleiding', iMee: 'ja', iWaarom: 'Past bij onze analyse.',
  mWat: 'Enquête onder 300 klanten.', mWaar: 'p. 4', mMee: 'deels', mWaarom: 'Te groot voor ons.',
  rWat: 'Eén staafdiagram.', rWaar: 'Figuur 1', rMee: 'ja', rWaarom: 'Past op de A3.',
  oogst: 'Ik neem het model mee. Ik doe een kleine enquête. Ik toon de uitkomst in één grafiek.',
};
test('EV-12: volledig is Compleet; vage vindplaats Bijna; AI om te ontleden zonder vinkje Te doen; lege oogst Te doen', () => {
  const t = taak('4.2');
  assert.equal(status(t, EV12_GOED), 'compleet');
  assert.equal(status(t, { ...EV12_GOED, mWaar: 'ergens' }), 'bijna');
  assert.equal(status(t, { ...EV12_GOED, ai: AI_ONTLEDEN }), 'nog niet');
  assert.equal(status(t, { ...EV12_GOED, ai: AI_ONTLEDEN, aiCheck: ['Ik heb elk citaat en elke vindplaats zelf in het artikel teruggevonden.'] }), 'compleet');
  assert.equal(status(t, { ...EV12_GOED, oogst: '' }), 'nog niet');
  assert.equal(status(t, { ...EV12_GOED, oogst: 'Alleen het model.' }), 'compleet', 'te kort: soort C, alleen feedback (BW-11)');
});

test('B102: de oefening van 4.2 toont het model pas na eigen werk, niet na alleen een artikelkeuze', () => {
  const t = taak('4.2');
  assert.equal(oefenModel(t, { invoer: { artikel: 'Artikel 1 · Visser & El Amrani' } }).modelZichtbaar, false);
  assert.equal(oefenModel(t, { invoer: { methode: 'acht gesprekken' } }).modelZichtbaar, true);
});

test('B102: richttijden van leerblok 2 zijn samen 45 minuten', () => {
  assert.deepEqual(blok.taken.map((t) => [t.id, t.richttijd.minuten]), [['3.1', 5], ['3.2', 10], ['4.1', 10], ['4.2', 15], ['4.3', 5]]);
});

test('B102 en SX-15: taak 4.2 toont IMRAD in de stof en de twee mini-artikelen bij de oefening; de AI-prompt hangt aan de keuze „om te ontleden”', () => {
  const t = taak('4.2');
  assert.equal(t.stof.figuur, 'imrad');
  assert.equal(t.oefening.figuur, 'miniartikelen');
  assert.equal(t.oefening.artikelen.length, 2);
  const g = t.toepassing.weergave.groepen.find((x) => x.artikelprompt);
  assert.deepEqual(g.alleenBij, { veld: 'ai', waarde: AI_ONTLEDEN });
  assert.deepEqual(g.artikelprompt.titel, ['anderArtikel', 'b1titel']);
  assert.ok(taak('4.1').toepassing.velden.some((v) => v.id === 'b1soort'), '4.1 vraagt de soort bron');
});

test('LB-8: de stelling staat letterlijk bij de oefening en de toepassing van 4.3, zodat de student niet terug hoeft', () => {
  const t = taak('4.3');
  const stelling = t.titel.match(/"([^"]+)"/)[1];
  assert.match(stelling, /^Je kunt een artikel prima door AI laten ontleden\.$/);
  assert.ok(t.oefening.opdracht.tekst.includes(stelling.replace(/\.$/, '')), 'oefening');
  assert.ok(t.toepassing.opdracht.tekst.includes(stelling.replace(/\.$/, '')), 'toepassing');
});
