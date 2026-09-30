// Statusregel van een bewijsonderdeel (blueprint §5, BW-5). Puur; geen DOM, geen netwerk.
import { SOORTEN, RESULTATEN } from './schema.js';

/** Zichtbare tekst per status (BW-3: status altijd als tekst, nooit alleen kleur). */
export const STATUS_TEKST = Object.freeze({
  compleet: 'Compleet',
  bijna: 'Bijna',
  'nog niet': 'Te doen', // weergave; de sleutel in schema en records blijft `nog niet` (ADR B74)
});

/**
 * Leidt de status af uit de uitkomsten van de controles.
 *   nog niet: minstens één controle van soort A of B op `mist`
 *   bijna:    minstens één controle van soort C op `mist`, of van soort A of B op `let op`
 *   compleet: verder (soort C mag op `let op` staan)
 * „Nog niet" gaat voor „Bijna", en „Bijna" gaat voor Compleet.
 * Zonder controles is er geen bewijs: dan „nog niet".
 * @param {{soort: string, resultaat: string}[]} controles
 * @returns {'compleet'|'bijna'|'nog niet'}
 */
export function bepaalStatus(controles) {
  if (!Array.isArray(controles)) throw new TypeError('bepaalStatus verwacht een lijst controles.');
  for (const c of controles) {
    if (!SOORTEN.includes(c?.soort)) throw new RangeError(`Onbekende soort: ${c?.soort}`);
    if (!RESULTATEN.includes(c?.resultaat)) throw new RangeError(`Onbekend resultaat: ${c?.resultaat}`);
  }
  if (controles.length === 0) return 'nog niet';

  const ab = (c) => c.soort === 'A' || c.soort === 'B';
  if (controles.some((c) => ab(c) && c.resultaat === 'mist')) return 'nog niet';
  if (controles.some((c) => (c.soort === 'C' && c.resultaat === 'mist') || (ab(c) && c.resultaat === 'let op'))) return 'bijna';
  return 'compleet';
}
