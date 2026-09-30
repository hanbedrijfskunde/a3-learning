// Startinvoer van de student (ST-1): alias of voornaam, teamnummer, vraagstuk in één zin, waarom-zin,
// of de keuze „nog geen scherp vraagstuk" (ST-3). Puur; de opslag en het formulier zitten elders.
import { tellers } from './checks/core.js';

export const PROFIEL_VELDEN = Object.freeze(['alias', 'teamnummer', 'vraagstuk', 'waaromZin']);

/** Eén profielobject met precies deze vijf sleutels; onbekende sleutels vallen weg (ST-1: geen andere persoonsgegevens). */
export function normaliseerProfiel(invoer = {}) {
  const uit = {};
  for (const v of PROFIEL_VELDEN) uit[v] = typeof invoer[v] === 'string' ? invoer[v].trim() : '';
  uit.voorlopig = invoer.voorlopig === true;
  return uit;
}

/**
 * Wat er nog ontbreekt, als hint. Het profiel blokkeert niets: de student kan altijd doorgaan (TK-1).
 * @returns {{compleet: boolean, hints: Object<string, string>}}
 */
export function beoordeelProfiel(invoer) {
  const p = normaliseerProfiel(invoer);
  const hints = {};
  if (p.alias === '') hints.alias = 'Vul een alias of je voornaam in.';
  if (p.teamnummer === '') hints.teamnummer = 'Vul je teamnummer in.';
  if (!p.voorlopig) {
    if (tellers.telWoorden(p.vraagstuk) < 3) hints.vraagstuk = 'Schrijf je vraagstuk in één zin, of kies „nog geen scherp vraagstuk”.';
    else if (tellers.telZinnen(p.vraagstuk) > 1) hints.vraagstuk = 'Schrijf je vraagstuk in één zin.';
    if (tellers.telWoorden(p.waaromZin) < 3) hints.waaromZin = 'Schrijf in één zin waarom je dit wilt aanpakken.';
  }
  return { compleet: Object.keys(hints).length === 0, hints };
}

/**
 * Welke meldingen zichtbaar zijn (SX-2): alleen bij velden die de student al heeft verlaten, hoogstens één per veld.
 * Bij het laden is de set leeg, dus staat er geen enkele melding.
 * @param {Object<string, string>} hints uit beoordeelProfiel
 * @param {Set<string>} aangeraakt velden die de student heeft verlaten
 */
export const zichtbareMeldingen = (hints, aangeraakt) =>
  Object.fromEntries(Object.entries(hints).filter(([id]) => aangeraakt.has(id)));

const PROFIEL_SLEUTEL = 'profiel';

/** Leest het profiel uit de opslag (leeg profiel als er nog niets is). */
export const leesProfiel = (store) => normaliseerProfiel(store.getMeta(PROFIEL_SLEUTEL) ?? {});

/** Bewaart het profiel apart van de bewijsrecords: alias en teamnummer komen nooit in een record (RC-3, PR-2). */
export function bewaarProfiel(store, invoer) {
  const p = normaliseerProfiel(invoer);
  store.setMeta(PROFIEL_SLEUTEL, p);
  return p;
}
