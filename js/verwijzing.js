// In-tekstverwijzingen als links naar de bronnenpagina (BR-4). Alleen DOM; eigen bestand zodat leerblokpagina's zonder
// lb2-ui.js (PF-4) ze toch kunnen tonen.
import { h } from './dom.js';
import { splitsMetVerwijzingen } from './bronnen.js';

/** Een tekst met in-tekstverwijzingen als links naar de bronregel op de bronnenpagina (BR-4). */
export function metVerwijzingen(tekst, index) {
  return splitsMetVerwijzingen(tekst, index).map((d) => (d.href
    ? h('a', { class: 'bron-verwijzing', href: d.href }, d.tekst)
    : d.tekst));
}
