// Het invloed/belang-raster van de stakeholdertabel (LB-9, EV-06). Puur: geen DOM, geen opslag.
//
// De stakeholders staan als vaste rijen velden in het bewijsrecord: rij i heeft de velden <voor>i + naam, soort, raakt,
// invloed en belang (bijvoorbeeld s1naam). Een rij zonder naam bestaat niet. Dezelfde functies leveren het raster, de
// tekstweergave van het raster (voor wie de tekening niet ziet) en de lijst die de controles van EV-06 en EV-08 gebruiken.

const tekst = (w) => (typeof w === 'string' ? w.trim() : '');

export const STAKEHOLDER_SUFFIXEN = Object.freeze(['naam', 'soort', 'raakt', 'invloed', 'belang']);

/** De rijen veld-id's van een reeks: reeks('s', 2, ['a', 'b']) → [['s1a', 's1b'], ['s2a', 's2b']]. */
export const reeks = (voor, aantal, suffixen) => Array.from({ length: aantal }, (_, i) => suffixen.map((s) => `${voor}${i + 1}${s}`));
/** De rijen van de stakeholdertabel: uit `rijen`, of uit `voor` en `aantal`. */
export const stakeholderRijen = ({ rijen, voor, aantal }) => rijen ?? reeks(voor, aantal, STAKEHOLDER_SUFFIXEN);

/** De vier vakken: invloed (hoog of laag) en belang (hoog of laag), met de gebruikelijke aanpak per vak. */
export const KWADRANTEN = Object.freeze([
  { id: 'nauw', invloed: 'hoog', belang: 'hoog', titel: 'Nauw betrekken' },
  { id: 'tevreden', invloed: 'hoog', belang: 'laag', titel: 'Tevreden houden' },
  { id: 'informeren', invloed: 'laag', belang: 'hoog', titel: 'Op de hoogte houden' },
  { id: 'volgen', invloed: 'laag', belang: 'laag', titel: 'Volgen' },
]);

/**
 * De stakeholders uit de inhoud van het bewijsonderdeel: alleen rijen met een naam.
 * @param {object} inhoud
 * @param {string[][]} rijen per stakeholder de veld-id's [naam, soort, relatie, invloed, belang]
 * @returns {{nr: number, naam: string, soort: string, raakt: string, invloed: string, belang: string}[]}
 */
export function stakeholdersUit(inhoud, rijen) {
  return (rijen ?? []).map(([n, s, r, i, b], idx) => ({
    nr: idx + 1, naam: tekst(inhoud?.[n]), soort: tekst(inhoud?.[s]), raakt: tekst(inhoud?.[r]), invloed: tekst(inhoud?.[i]), belang: tekst(inhoud?.[b]),
  })).filter((s) => s.naam !== '');
}

/**
 * Zet de stakeholders in de vier vakken. Wie nog geen invloed of belang heeft gekozen, staat bij `ongeplaatst`.
 * @returns {{kwadranten: (object & {leden: object[]})[], ongeplaatst: object[], getekend: number}}
 */
export function bouwRaster(stakeholders) {
  const kwadranten = KWADRANTEN.map((k) => ({ ...k, leden: stakeholders.filter((s) => s.invloed === k.invloed && s.belang === k.belang) }));
  const ongeplaatst = stakeholders.filter((s) => !['hoog', 'laag'].includes(s.invloed) || !['hoog', 'laag'].includes(s.belang));
  return { kwadranten, ongeplaatst, getekend: stakeholders.length - ongeplaatst.length };
}

const soortTekst = (s) => (s.soort ? ` (${s.soort})` : '');

/** Het raster in gewone zinnen, één per stakeholder, vak voor vak (de tekstweergave van LB-9). */
export function rasterTekst(raster) {
  const regels = [];
  for (const k of raster.kwadranten) {
    for (const s of k.leden) regels.push(`${s.naam}${soortTekst(s)}: invloed ${s.invloed}, belang ${s.belang}. Vak: ${k.titel}.`);
  }
  for (const s of raster.ongeplaatst) {
    const mist = [!['hoog', 'laag'].includes(s.invloed) && 'invloed', !['hoog', 'laag'].includes(s.belang) && 'belang'].filter(Boolean).join(' en ');
    regels.push(`${s.naam}${soortTekst(s)}: kies nog ${mist}.`);
  }
  return regels;
}
