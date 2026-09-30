// Eén taak per scherm (SX-6; DESIGN §5.3): adressen van taak en stap, en de ene hoofdknop in de vaste voet.
// Puur: geen DOM, geen opslag. De bestaande id's blijven werken (#taak-2.1, #oefening-2.1, #stap-2.1-4, #afsluiten).

/** De vier stappen in het adres, in de volgorde van TK-18. */
export const STAP_SLUGS = Object.freeze(['waarom', 'stof', 'oefenen', 'toepassen']);

/** Het adres van een taak en stap (1–4): `#taak-2.1/oefenen`. */
export const maakAdres = (taak, stap) => `#taak-${taak}/${STAP_SLUGS[stap - 1]}`;

/**
 * Leest een adres. Onbekende taken en andere ankers (#media, #wissel, …) geven het overzicht van het leerblok.
 * @param {string} hash location.hash
 * @param {string[]} taken de taaknummers van dit leerblok
 * @returns {{soort: 'overzicht'} | {soort: 'afsluiten'} | {soort: 'taak', taak: string, stap: number|null}}
 */
export function leesAdres(hash, taken) {
  const h = decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  if (h === 'afsluiten') return { soort: 'afsluiten' };
  let m = /^taak-([\d.]+)(?:\/(\w+))?$/.exec(h);
  if (m && taken.includes(m[1])) {
    const i = STAP_SLUGS.indexOf(m[2]);
    return { soort: 'taak', taak: m[1], stap: i === -1 ? null : i + 1 };
  }
  m = /^oefening-([\d.]+)$/.exec(h);
  if (m && taken.includes(m[1])) return { soort: 'taak', taak: m[1], stap: 3 };
  m = /^stap-([\d.]+)-([1-4])$/.exec(h);
  if (m && taken.includes(m[1])) return { soort: 'taak', taak: m[1], stap: Number(m[2]) };
  return { soort: 'overzicht' };
}

/**
 * De ene hoofdknop in de vaste voet (hoogstens één primaire knop per scherm) en de knop terug.
 * @param {object} s
 * @param {'overzicht'|'taak'|'afsluiten'} s.soort
 * @param {string[]} s.taken taaknummers van het leerblok
 * @param {string} [s.taak] huidige taak
 * @param {number} [s.stap] huidige stap (1–4)
 * @param {string} [s.verder] taak om mee verder te gaan vanaf het overzicht
 * @param {boolean} [s.modelOpen] modelantwoord open of oefening overgeslagen
 * @param {boolean} [s.klaarMogelijk] „klaar als" gehaald
 * @param {boolean} [s.klaar] taak is klaar
 * @returns {{primair: {label: string, actie: string, doel?: string}|null, terug: {label: string, doel: string}|null}}
 */
export function voetActies({ soort, taken, taak, stap, verder, modelOpen = false, klaarMogelijk = false, klaar = false }) {
  if (soort === 'afsluiten') return { primair: null, terug: { label: 'Terug', doel: maakAdres(taken[taken.length - 1], 4) } };
  if (soort === 'overzicht') {
    const doel = verder && taken.includes(verder) ? verder : taken[0];
    return { primair: { label: verder ? `Ga verder met taak ${doel}` : `Begin met taak ${doel}`, actie: 'ga', doel: `#taak-${doel}` }, terug: null };
  }
  const i = taken.indexOf(taak);
  const volgende = i < taken.length - 1 ? { label: `Naar taak ${taken[i + 1]}`, actie: 'ga', doel: maakAdres(taken[i + 1], 1) } : { label: 'Klaar met dit blok', actie: 'ga', doel: '#afsluiten' };
  const terug = stap > 1 ? { label: 'Vorige stap', doel: maakAdres(taak, stap - 1) } : i > 0 ? { label: 'Vorige taak', doel: maakAdres(taken[i - 1], 4) } : { label: 'Overzicht', doel: '#' };
  if (stap === 1) return { primair: { label: 'Verder', actie: 'ga', doel: maakAdres(taak, 2) }, terug };
  if (stap === 2) return { primair: { label: 'Naar oefenen', actie: 'ga', doel: maakAdres(taak, 3) }, terug };
  if (stap === 3) {
    return { primair: modelOpen ? { label: 'Naar toepassen', actie: 'ga', doel: maakAdres(taak, 4) } : { label: 'Check en zie modelantwoord', actie: 'model' }, terug };
  }
  if (klaarMogelijk && !klaar) return { primair: { label: 'Klaar: bewaar in dossier', actie: 'klaar' }, terug };
  return { primair: volgende, terug };
}
