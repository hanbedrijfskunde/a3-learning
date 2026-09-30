// Controles van leerblok 2 (EV-03, EV-04, EV-05, blueprint §6.7) en de promptgenerator (LB-6).
// Zuiver: geen DOM, geen netwerk, geen opslag (BW-8). Ze volgen het contract uit core.js.
//
// Soort A telt of iets er staat, soort B toetst of het klopt met iets anders, soort C telt alleen (BW-11).
// Een bron in de bronlog kan optioneel zijn (`optioneel: true` met `blok`: alle velden van die bron): is het hele blok
// leeg, dan is de controle `ok`; is de bron begonnen, dan telt wat mist als `let op` (status Bijna), niet als `mist`.
import { resultaat, tellers } from './core.js';

export const ROUTE_A = 'A · databank';
export const ROUTE_B = 'B · AI-tool';

const isLeeg = (w) => w === undefined || w === null
  || (typeof w === 'string' && w.trim() === '') || (Array.isArray(w) && w.length === 0);
const tekst = (w) => (typeof w === 'string' ? w.trim() : '');
const isRouteB = (w) => tekst([].concat(w ?? [])[0]).startsWith('B');
const isRouteA = (w) => tekst([].concat(w ?? [])[0]).startsWith('A');

/** Een optioneel blok dat helemaal leeg is, telt niet mee; een begonnen blok dat mist, geeft `let op` in plaats van `mist`. */
function metOptioneel(controle, { id, soort, blok, optioneel }) {
  if (!optioneel) return controle;
  return (invoer, context) => {
    if ((blok ?? []).every((v) => isLeeg(invoer?.[v]))) return resultaat(id, soort, 'ok');
    const r = controle(invoer, context);
    if (r.resultaat === 'mist' && soort !== 'C') return resultaat(id, soort, 'let op', r.melding);
    return r;
  };
}

// ---------------------------------------------------------------- zoekstring en zoektermen (EV-03)

/** Bevat de zoekstring minstens één operator: aanhalingstekens (paar), AND, OR, NOT (hoofdletters), * of ? (LB-5). */
export function heeftOperator(zoekstring) {
  const t = tekst(zoekstring);
  if (t === '') return false;
  const aanhaling = /["“”][^"“”]+["“”]/u.test(t);
  const boolean = /(^|[\s(])(AND|OR|NOT)(?=[\s)]|$)/.test(t);
  return aanhaling || boolean || /[*?]/.test(t);
}

/**
 * Route A: de zoekstring bevat minstens één operator (EV-03). Geen route gekozen of route B: `ok` (de routecontrole
 * en de promptcontrole vangen dat op). Route A met een lege string: `mist`; zonder operator: `let op`.
 */
export function zoekOperator({ id, veld, routeVeld, label = 'je zoekstring' }) {
  return (invoer) => {
    if (!isRouteA(invoer?.[routeVeld])) return resultaat(id, 'A', 'ok');
    const t = tekst(invoer?.[veld]);
    if (t === '') return resultaat(id, 'A', 'mist', `Schrijf ${label} voor route A.`);
    if (!heeftOperator(t)) {
      return resultaat(id, 'A', 'let op', `In ${label} staat nog geen zoekoperator; gebruik "aanhalingstekens", AND, OR, NOT, * of ?.`);
    }
    return resultaat(id, 'A', 'ok');
  };
}

/**
 * Per kernbegrip minstens één synoniem en één Engelse term (EV-03). `rijen` is een lijst van [begrip, synoniem, Engels].
 * Geen enkel kernbegrip: `mist`. Een begrip zonder synoniem of Engelse term: `let op`, met het rijnummer.
 */
export function termenPerBegrip({ id, rijen }) {
  return (invoer) => {
    const gevuld = rijen.map(([b, s, e], i) => ({ nr: i + 1, begrip: !isLeeg(invoer?.[b]), syn: !isLeeg(invoer?.[s]), en: !isLeeg(invoer?.[e]) }));
    const begrippen = gevuld.filter((r) => r.begrip);
    if (begrippen.length === 0) return resultaat(id, 'A', 'mist', 'Vul minstens één kernbegrip in, met een synoniem en een Engelse term.');
    const gaten = begrippen.filter((r) => !r.syn || !r.en);
    if (gaten.length > 0) {
      const wat = gaten.map((r) => `rij ${r.nr}: ${[!r.syn && 'synoniem', !r.en && 'Engelse term'].filter(Boolean).join(' en ')}`).join('; ');
      return resultaat(id, 'A', 'let op', `Vul per kernbegrip een synoniem en een Engelse term in (${wat}).`);
    }
    return resultaat(id, 'A', 'ok');
  };
}

/** Route B: er is een tool gekozen (EV-03). Route A of nog geen route: `ok`. */
export function toolBijRouteB({ id, veld, routeVeld }) {
  return (invoer) => {
    if (!isRouteB(invoer?.[routeVeld])) return resultaat(id, 'A', 'ok');
    if (isLeeg(invoer?.[veld])) return resultaat(id, 'A', 'mist', 'Kies welke AI-tool je gebruikt.');
    return resultaat(id, 'A', 'ok');
  };
}

// ---------------------------------------------------------------- promptgenerator (LB-6)

/** De vaste prompt van werkboek 3.2. Lege stukken blijven als <plek> staan. */
export function bouwPrompt({ zoekvraag, context, jaar } = {}) {
  const deel = (w, plek) => tekst(w) || plek;
  const vraag = deel(zoekvraag, '[zoekvraag uit 2.2]');
  return `Zoek wetenschappelijke artikelen of vakpublicaties bij deze vraag: ${vraag}${/[.?!]$/.test(vraag) ? '' : '.'} `
    + `Context: ${deel(context, '[sector, land, soort organisatie]')}. `
    + `Alleen bronnen van na ${deel(jaar, '[jaar]')}, in het Nederlands of Engels. `
    + 'Geef per bron in één zin waarom hij bij de vraag past. '
    + 'Sluit af met een bronnenlijst volgens APA (7e editie), met DOI of link. '
    + 'Verzin geen bronnen. Vind je niets, zeg dat dan.';
}

/** Splitst de „niet noemen"-lijst op komma, puntkomma of regeleinde. */
export const splitsLijst = (lijst) => tekst(lijst).split(/[,;\n]+/).map((w) => w.trim()).filter(Boolean);

/** Kleine letters zonder accenten, voor het vergelijken van woorden. */
const plat = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const ontsnap = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Welke woorden uit de „niet noemen"-lijst staan in de prompt? Hele woorden of woordgroepen, zonder onderscheid in
 * hoofdletters of accenten. Elk woord uit de lijst komt hoogstens één keer terug (1 waarschuwing per woord, LB-6).
 * @returns {string[]} de woorden zoals de student ze schreef
 */
export function verbodenWoorden(prompt, lijst) {
  const haystack = plat(tekst(prompt));
  const gezien = new Set();
  const gevonden = [];
  for (const woord of splitsLijst(lijst)) {
    const sleutel = plat(woord);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${ontsnap(sleutel)}(?=$|[^\\p{L}\\p{N}])`, 'u');
    if (re.test(haystack)) gevonden.push(woord);
  }
  return gevonden;
}

/**
 * Route B: de prompt bevat geen woord uit de „niet noemen"-lijst (EV-03, LB-6). Lege prompt: `mist`.
 * Een lege lijst: `let op` (er valt niets te controleren). Een gevonden woord: `let op`, met het woord genoemd.
 * Geen route of route A: `ok`.
 */
export function promptZonderVerboden({ id, veld, lijstVeld, routeVeld }) {
  return (invoer) => {
    if (!isRouteB(invoer?.[routeVeld])) return resultaat(id, 'B', 'ok');
    if (isLeeg(invoer?.[veld])) return resultaat(id, 'B', 'mist', 'Maak je prompt voor route B.');
    if (splitsLijst(invoer?.[lijstVeld]).length === 0) {
      return resultaat(id, 'B', 'let op', 'Vul de „niet noemen"-lijst in: namen van de opdrachtgever, personen en vertrouwelijke termen.');
    }
    const gevonden = verbodenWoorden(invoer[veld], invoer[lijstVeld]);
    if (gevonden.length > 0) {
      return resultaat(id, 'B', 'let op', `In je prompt staat ${gevonden.length === 1 ? 'een woord' : 'staan woorden'} van je „niet noemen"-lijst: ${gevonden.join(', ')}.`);
    }
    return resultaat(id, 'B', 'ok');
  };
}

// ---------------------------------------------------------------- bronbeoordeling (EV-04)

/** Auteur, jaar, titel en link zijn ingevuld (EV-04). `velden` zijn de veld-id's, `labels` de namen voor in de melding. */
export function bronGegevens({ id, velden, labels, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const ontbreekt = velden.filter((v) => isLeeg(invoer?.[v])).map((v) => labels[velden.indexOf(v)]);
    if (ontbreekt.length > 0) return resultaat(id, 'A', 'mist', `Vul van de bron in: ${ontbreekt.join(', ')}.`);
    return resultaat(id, 'A', 'ok');
  }, { id, soort: 'A', blok, optioneel });
}

/** Op alle vijf AAOCC-criteria is een oordeel gekozen (EV-04). `velden` zijn de oordeelvelden, `labels` de criteria. */
export function aaoccOordelen({ id, velden, labels, toegestaan = ['+', '?', '–'], blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const mist = velden.map((v, i) => [v, labels[i]]).filter(([v]) => {
      const w = [].concat(invoer?.[v] ?? [])[0];
      return !toegestaan.includes(w);
    }).map(([, l]) => l);
    if (mist.length > 0) return resultaat(id, 'A', 'mist', `Kies een oordeel (+, ? of –) bij: ${mist.join(', ')}.`);
    return resultaat(id, 'A', 'ok');
  }, { id, soort: 'A', blok, optioneel });
}

/** Elk AAOCC-oordeel heeft een toelichting van minstens `min` zinnen (soort C: alleen tellen). */
export function aaoccToelichtingen({ id, velden, labels, min = 1, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const kort = velden.map((v, i) => [v, labels[i]]).filter(([v]) => tellers.telZinnen(invoer?.[v]) < min).map(([, l]) => l);
    if (kort.length === 0) return resultaat(id, 'C', 'ok');
    const leeg = kort.length === velden.length && velden.every((v) => tellers.telZinnen(invoer?.[v]) === 0);
    return resultaat(id, 'C', leeg ? 'mist' : 'let op',
      `Schrijf bij elk oordeel minstens ${min} ${min === 1 ? 'zin' : 'zinnen'} toelichting; nog te kort: ${kort.join(', ')}.`);
  }, { id, soort: 'C', blok, optioneel });
}

/**
 * Route B: beide verificatievinkjes staan aan (de bron bestaat; er staat in wat de AI zegt) (EV-04).
 * Geen route gekozen: `mist`. Route A: `ok`. Route B met één vinkje: `let op`; zonder vinkjes: `mist`.
 */
export function verificatieBijRouteB({ id, veld, routeVeld, aantal = 2, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const route = invoer?.[routeVeld];
    if (isLeeg(route)) return resultaat(id, 'A', 'mist', 'Kies hoe je de bron vond: route A of route B.');
    if (!isRouteB(route)) return resultaat(id, 'A', 'ok');
    const n = [].concat(invoer?.[veld] ?? []).length;
    if (n === 0) return resultaat(id, 'A', 'mist', `Controleer de AI-bron en zet beide vinkjes (${aantal}).`);
    if (n < aantal) return resultaat(id, 'A', 'let op', `Zet ook het andere vinkje: controleer of de bron bestaat én of er staat wat de AI zegt.`);
    return resultaat(id, 'A', 'ok');
  }, { id, soort: 'A', blok, optioneel });
}

/** Het jaar tussen haakjes in een APA-regel: (2019), (2019, 9 februari), (2019a) of (z.d.). Anders undefined. */
export function apaJaar(apa) {
  const m = tekst(apa).match(/\((\d{4})[a-z]?(?:,[^)]*)?\)|\((z\.d\.)\)/);
  return m ? (m[1] ?? m[2]) : undefined;
}

/** De APA-regel is ingevuld en heeft het jaar tussen haakjes achter de auteur (EV-04, formaatcontrole). */
export function apaFormaat({ id, veld, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const t = tekst(invoer?.[veld]);
    if (t === '') return resultaat(id, 'A', 'mist', 'Schrijf de bron in APA.');
    if (apaJaar(t) === undefined || !/^[^(]*\S\s*\(/.test(t)) {
      return resultaat(id, 'A', 'let op', 'Zet het jaar tussen haakjes achter de auteur, bijvoorbeeld: Achternaam, A. (2020). Titel.');
    }
    return resultaat(id, 'A', 'ok');
  }, { id, soort: 'A', blok, optioneel });
}

/** Het jaar in de APA-regel is gelijk aan het jaarveld (EV-04, soort B). Ontbreekt een van beide, dan `ok`: dat vangen andere controles op. */
export function apaJaarGelijk({ id, veld, jaarVeld, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const jaar = tekst(invoer?.[jaarVeld]).replace(/[a-z]$/, '');
    const inApa = apaJaar(invoer?.[veld]);
    if (jaar === '' || inApa === undefined) return resultaat(id, 'B', 'ok');
    if (jaar !== inApa) return resultaat(id, 'B', 'let op', `Het jaar in je APA-regel (${inApa}) is niet gelijk aan het jaar dat je bij de bron invulde (${jaar}).`);
    return resultaat(id, 'B', 'ok');
  }, { id, soort: 'B', blok, optioneel });
}

/** De link begint met https:// of bevat doi.org (EV-04). Leeg: `mist`. */
export function linkVorm({ id, veld, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const t = tekst(invoer?.[veld]);
    if (t === '') return resultaat(id, 'A', 'mist', 'Vul de link of DOI van de bron in.');
    if (!(t.startsWith('https://') || /^(https?:\/\/)?(dx\.)?doi\.org\//i.test(t))) {
      return resultaat(id, 'A', 'let op', 'Een link begint met https:// (of is een DOI-link van doi.org).');
    }
    return resultaat(id, 'A', 'ok');
  }, { id, soort: 'A', blok, optioneel });
}

/** Er is een besluit genomen over de bron (EV-04). */
export function besluitGenomen({ id, veld, toegestaan, blok, optioneel = false }) {
  return metOptioneel((invoer) => {
    const w = [].concat(invoer?.[veld] ?? [])[0];
    if (!toegestaan.includes(w)) return resultaat(id, 'A', 'mist', `Kies je besluit: ${toegestaan.join(' of ')}.`);
    return resultaat(id, 'A', 'ok');
  }, { id, soort: 'A', blok, optioneel });
}

/** Fabrieken van dit bestand, op naam (gebruikt door `checks/index.js`). */
export const FABRIEKEN = {
  zoekOperator, termenPerBegrip, toolBijRouteB, promptZonderVerboden,
  bronGegevens, aaoccOordelen, aaoccToelichtingen, verificatieBijRouteB, apaFormaat, apaJaarGelijk, linkVorm, besluitGenomen,
};

