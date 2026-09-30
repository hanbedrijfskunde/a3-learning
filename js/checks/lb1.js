// Controles van leerblok 1 (EV-01 en EV-02, blueprint §6.7) en de bouwer van de samengestelde vraag (LB-2).
// Zuiver: geen DOM, geen netwerk, geen opslag (BW-8). Ze volgen het contract uit core.js.
//
// Soort A telt of iets er staat, soort B toetst of het klopt met iets anders, soort C telt alleen (BW-11).
import { resultaat, tellers } from './core.js';

const isLeeg = (w) => w === undefined || w === null
  || (typeof w === 'string' && w.trim() === '') || (Array.isArray(w) && w.length === 0);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const tekst = (w) => (typeof w === 'string' ? w.trim() : '');
/** Woorden in kleine letters zonder leestekens, om twee teksten te vergelijken. */
const woordenVan = (t) => tekst(t).toLowerCase().split(/\s+/)
  .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);

// ---------------------------------------------------------------- de samengestelde vraag (LB-2)

const kaal = (t) => tekst(t).replace(/[?.!\s]+$/u, '');

/**
 * Stelt de onderzoeksvraag samen uit de drie velden van EV-01. Lege velden blijven als <naam> staan.
 * Werkboek 2.1: „Wat is de beste oplossing voor <gebruiker> om <probleem / pain / gain>, zodat <waardecreatie …>?”
 */
export function stelVraagSamen(inhoud = {}) {
  const deel = (veld, plek) => kaal(inhoud[veld]) || plek;
  return `Wat is de beste oplossing voor ${deel('gebruiker', '<gebruiker>')} om ${deel('pain', '<probleem / pain / gain>')}, `
    + `zodat ${deel('waarde', '<waardecreatie>')}?`;
}

// ---------------------------------------------------------------- fabrieken (soort A)

/**
 * Aantal woorden als aanwezigheidseis (soort A, blueprint §3: „aantal woorden”).
 * Leeg: `mist`; te weinig woorden: `let op`.
 * core.minWoorden is soort C en blijft dat (BW-11); dit is de A-variant voor EV-01 („elk ≥ 4 woorden”).
 */
export function minWoordenAanwezig({ id, veld, label, min }) {
  return (invoer) => {
    const n = tellers.telWoorden(invoer?.[veld]);
    if (n === 0) return resultaat(id, 'A', 'mist', `Schrijf ${label}: minstens ${min} woorden.`);
    if (n < min) return resultaat(id, 'A', 'let op', `${cap(label)} heeft minder dan ${min} woorden; maak het concreter.`);
    return resultaat(id, 'A', 'ok');
  };
}

/**
 * Minstens één kapitaal dat niet financieel is (EV-01: de waarde gaat verder dan geld).
 * Niets gekozen: `mist`. Alleen financieel: `let op`.
 */
export function kapitaalNietFinancieel({ id, veld, label = 'een kapitaal', toegestaan, financieel = 'financieel' }) {
  return (invoer) => {
    const gekozen = [].concat(invoer?.[veld] ?? []).filter((k) => (toegestaan ? toegestaan.includes(k) : true));
    if (gekozen.length === 0) return resultaat(id, 'A', 'mist', `Kies ${label} bij de waardecreatie.`);
    if (gekozen.every((k) => k === financieel)) {
      return resultaat(id, 'A', 'let op', 'Je koos alleen het financiële kapitaal; kies ook een ander kapitaal, zodat de waarde verder gaat dan geld.');
    }
    return resultaat(id, 'A', 'ok');
  };
}

/**
 * Precies één keuze uit een lijst (EV-02: één model). Niets of iets buiten de lijst: `mist`; meer dan één: `let op`.
 */
export function precies1Keuze({ id, veld, label, toegestaan }) {
  const lijst = toegestaan.join(', ');
  return (invoer) => {
    const w = invoer?.[veld];
    if (isLeeg(w)) return resultaat(id, 'A', 'mist', `Kies één ${label} uit de lijst: ${lijst}.`);
    const keuzes = [].concat(w);
    if (keuzes.length > 1) return resultaat(id, 'A', 'let op', `Kies precies één ${label}, niet ${keuzes.length}.`);
    if (!toegestaan.includes(keuzes[0])) return resultaat(id, 'A', 'mist', `Kies één ${label} uit de lijst: ${lijst}.`);
    return resultaat(id, 'A', 'ok');
  };
}

// ---------------------------------------------------------------- fabrieken (soort B)

/**
 * De gekozen frames verschillen van elkaar (EV-02). Twee keer hetzelfde frame: `let op`.
 * Minder dan twee gekozen frames: `ok`; de ontbrekende keuzes vangt de keuzecontrole per frame op.
 */
export function verschillendeFrames({ id, velden }) {
  return (invoer) => {
    const gekozen = velden.map((v) => tekst(invoer?.[v])).filter(Boolean);
    if (new Set(gekozen).size < gekozen.length) {
      return resultaat(id, 'B', 'let op', 'Twee zoekvragen gebruiken hetzelfde frame; kies voor elke zoekvraag een ander frame.');
    }
    return resultaat(id, 'B', 'ok');
  };
}

/**
 * De vraag verschilt in minstens één woord van de vraag uit de oefencasus (EV-01).
 * De casus komt uit het contentbestand: `context.taak.modelantwoord.velden`, dezelfde velden als `velden`.
 * Zijn alle velden woord voor woord gelijk aan het modelantwoord: `let op`. Zonder ingevulde velden: `ok`
 * (er valt niets te vergelijken; de aanwezigheidscontroles vangen dat op).
 */
export function verschiltVanCasus({ id, velden }) {
  return (invoer, context = {}) => {
    const casus = context?.taak?.modelantwoord?.velden;
    const eigen = velden.map((v) => woordenVan(invoer?.[v]).join(' '));
    if (!casus || eigen.every((e) => e === '')) return resultaat(id, 'B', 'ok');
    const referentie = velden.map((v) => woordenVan(casus[v]).join(' '));
    const gelijk = eigen.every((e, i) => e === referentie[i]);
    if (gelijk) return resultaat(id, 'B', 'let op', 'Je vraag is precies die van de oefencasus; schrijf hem over je eigen vraagstuk.');
    return resultaat(id, 'B', 'ok');
  };
}

/** Fabrieken van dit bestand, op naam (gebruikt door `checks/index.js`). */
export const FABRIEKEN = { minWoordenAanwezig, kapitaalNietFinancieel, precies1Keuze, verschillendeFrames, verschiltVanCasus };

/** Bouwers voor het live voorbeeld, op naam (LB-2). */
export const VOORBEELDEN = { onderzoeksvraag: stelVraagSamen };
