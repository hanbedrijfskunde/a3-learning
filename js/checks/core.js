// Controlecontract en hulpfuncties (blueprint BW-8, BW-9, BW-11).
//
// Een controle is een zuivere functie: (invoer, context) → { id, soort, resultaat, melding }
//   invoer    het `inhoud`-object van het bewijsonderdeel (tekst van de student)
//   context   { taak, records } met eventuele andere onderdelen (soort B); de hulpfuncties hier gebruiken het niet
//   soort     'A' aanwezigheid en vorm, 'B' samenhang tussen onderdelen, 'C' omvang (alleen tellen)
//   resultaat 'ok' | 'let op' | 'mist'
//   melding   bij 'let op' en 'mist' één zin die zegt wat ontbreekt; bij 'ok' een lege tekst
//
// Zuiver betekent: geen netwerk, geen DOM, geen opslag, geen neveneffecten, geen toeval.
// Dit bestand werkt daarom in de browser én in Node.
import { SOORTEN, RESULTATEN } from '../schema.js';

// ---------------------------------------------------------------- tellen (soort C)

/** Aantal woorden: reeksen tekens die minstens één letter of cijfer bevatten. */
export function telWoorden(tekst) {
  if (typeof tekst !== 'string') return 0;
  return tekst.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Aantal zinnen: stukken tekst, gescheiden door . ! ? of … gevolgd door spatie of einde, met minstens één woord. */
export function telZinnen(tekst) {
  if (typeof tekst !== 'string') return 0;
  return tekst.split(/[.!?…]+(?=\s|$)/u).filter((s) => telWoorden(s) > 0).length;
}

/**
 * De enige tellers die controles van soort C mogen gebruiken (BW-11).
 * Ze worden via dit object aangeroepen, zodat een test kan vastleggen dat alleen deze twee worden gebruikt.
 */
export const tellers = { telWoorden, telZinnen };

/** Aantal verschillende woorden van minstens 3 letters, zonder onderscheid in hoofdletters (B107). Geen tekst: 0. */
export function telVerschillendeWoorden(tekst) {
  if (typeof tekst !== 'string') return 0;
  return new Set((tekst.match(/\p{L}{3,}/gu) ?? []).map((w) => w.toLocaleLowerCase('nl'))).size;
}

// ---------------------------------------------------------------- contract

/** Bouwt een controleresultaat en dwingt het contract af (BW-9: bij niet-ok altijd een melding). */
export function resultaat(id, soort, uitkomst, melding = '') {
  if (!SOORTEN.includes(soort)) throw new RangeError(`Onbekende soort: ${soort}`);
  if (!RESULTATEN.includes(uitkomst)) throw new RangeError(`Onbekend resultaat: ${uitkomst}`);
  if (uitkomst !== 'ok' && (typeof melding !== 'string' || melding.trim() === '')) {
    throw new Error(`Controle ${id} geeft ${uitkomst} zonder melding.`);
  }
  return { id, soort, resultaat: uitkomst, melding: uitkomst === 'ok' ? '' : melding };
}

/** Voert een lijst controles uit en geeft de lijst uitkomsten terug (voor `bepaalStatus`). */
export function voerUit(controles, invoer, context = {}) {
  return controles.map((controle) => controle(invoer, context));
}

const isLeeg = (waarde) => waarde === undefined || waarde === null
  || (typeof waarde === 'string' && waarde.trim() === '')
  || (Array.isArray(waarde) && waarde.length === 0);

const tekstVan = (waarde) => (typeof waarde === 'string' ? waarde.trim() : '');

// ---------------------------------------------------------------- hulpfuncties (fabrieken)

/**
 * Het veld is ingevuld. Leeg: `mist`. Minder dan 3 tekens (bijvoorbeeld „x" of „-"): `let op`.
 * @param {{id: string, veld: string, label: string, soort?: 'A'|'B'}} o
 */
export function veldGevuld({ id, veld, label, soort = 'A' }) {
  return (invoer) => {
    const waarde = invoer?.[veld];
    if (isLeeg(waarde)) return resultaat(id, soort, 'mist', `Vul ${label} in.`);
    if (typeof waarde === 'string' && waarde.trim().length < 3) {
      return resultaat(id, soort, 'let op', `${capitaal(label)} is erg kort; maak het concreter.`);
    }
    return resultaat(id, soort, 'ok');
  };
}

/**
 * De keuze(s) komen uit een vaste lijst. Niets gekozen of een onbekende enkele keuze: `mist`.
 * Bij meerdere keuzes waarvan een deel niet in de lijst staat: `let op`.
 * @param {{id: string, veld: string, label: string, toegestaan: string[], soort?: 'A'|'B'}} o
 */
export function keuzeUitLijst({ id, veld, label, toegestaan, soort = 'A' }) {
  const lijst = toegestaan.join(', ');
  return (invoer) => {
    const waarde = invoer?.[veld];
    if (isLeeg(waarde)) return resultaat(id, soort, 'mist', `Kies ${label} uit de lijst: ${lijst}.`);
    const keuzes = Array.isArray(waarde) ? waarde : [waarde];
    const geldig = keuzes.filter((k) => toegestaan.includes(k)).length;
    if (geldig === keuzes.length) return resultaat(id, soort, 'ok');
    if (geldig === 0) return resultaat(id, soort, 'mist', `Kies ${label} uit de lijst: ${lijst}.`);
    return resultaat(id, soort, 'let op', `Een deel van je keuze staat niet in de lijst: ${lijst}.`);
  };
}

/**
 * De tekst eindigt op een van de opgegeven tekens (bijvoorbeeld een vraagteken bij een zoekvraag).
 * Leeg: `mist`. Een ander einde: `let op`.
 * @param {{id: string, veld: string, label: string, tekens: string[], soort?: 'A'|'B'}} o
 */
export function eindigtOp({ id, veld, label, tekens, soort = 'A' }) {
  return (invoer) => {
    const tekst = tekstVan(invoer?.[veld]);
    if (tekst === '') return resultaat(id, soort, 'mist', `Vul ${label} in.`);
    if (tekens.some((t) => tekst.endsWith(t))) return resultaat(id, soort, 'ok');
    return resultaat(id, soort, 'let op', `${capitaal(label)} moet eindigen op ${tekens.map((t) => `"${t}"`).join(' of ')}.`);
  };
}

/**
 * Minstens `min` woorden (soort C, alleen tellen). Geen woorden: `mist`; te weinig: `let op`.
 * @param {{id: string, veld: string, label: string, min: number}} o
 */
export function minWoorden({ id, veld, label, min }) {
  return (invoer) => {
    const n = tellers.telWoorden(invoer?.[veld]);
    if (n === 0) return resultaat(id, 'C', 'mist', `Schrijf ${label}: minstens ${min} woorden.`);
    if (n < min) return resultaat(id, 'C', 'let op', `${capitaal(label)} heeft minder dan ${min} woorden; schrijf iets uitgebreider.`);
    return resultaat(id, 'C', 'ok');
  };
}

/**
 * Minstens `min` zinnen (soort C, alleen tellen). Geen zinnen: `mist`; te weinig: `let op`.
 * @param {{id: string, veld: string, label: string, min: number}} o
 */
/**
 * B107: het antwoord staat in eigen woorden: minstens `min` verschillende woorden van 3 of meer letters. Te weinig: `let op`
 * (status Bijna), zodat „bla bla bla?” niet Compleet wordt. Leeg of geen tekst: `ok`, want daarover gaan andere controles.
 * Dit telt alleen (BW-11); of het antwoord goed is, bespreek je met je coach (BW-6).
 * @param {{id: string, veld: string, label: string, min: number}} o
 */
export function eigenWoorden({ id, veld, label, min }) {
  return (invoer) => {
    const waarde = invoer?.[veld];
    if (typeof waarde !== 'string' || waarde.trim() === '') return resultaat(id, 'A', 'ok');
    const n = telVerschillendeWoorden(waarde);
    if (n >= min) return resultaat(id, 'A', 'ok');
    return resultaat(id, 'A', 'let op', `Schrijf ${label} in je eigen woorden: nu ${n === 1 ? 'staat er 1 verschillend woord' : `staan er ${n} verschillende woorden`}, gebruik er minstens ${min}.`);
  };
}

export function minZinnen({ id, veld, label, min }) {
  return (invoer) => {
    const n = tellers.telZinnen(invoer?.[veld]);
    if (n === 0) return resultaat(id, 'C', 'mist', `Schrijf ${label}: minstens ${min} ${min === 1 ? 'zin' : 'zinnen'}.`);
    if (n < min) return resultaat(id, 'C', 'let op', `${capitaal(label)} heeft minder dan ${min} zinnen; werk het verder uit.`);
    return resultaat(id, 'C', 'ok');
  };
}

function capitaal(tekst) {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}
