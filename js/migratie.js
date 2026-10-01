// Eenmalige omzettingen van de opslag als de content verandert. Zuiver op de store; geen DOM.
//
// ADR B102: de stelling van leerblok 2 verhuisde van taak 4.2 naar 4.3; taak 4.2 is nu „Haal meer uit je artikel” (EV-12).
// Records hangen aan het bewijs-ID (EV-05), maar klaar, oefening, klaar-als, invoer en de positie hangen aan het taaknummer.
const OUD = '4.2';
const NIEUW = '4.3';
const PER_TAAK = ['klaar', 'oefening', 'klaarals', 'invoer'];

/** Zet een opslag van vóór B102 om. Alleen als EV-05 nog aan 4.2 hangt en er nog geen EV-12 is. Geeft true als er iets veranderde. */
export function zetStellingOm(store) {
  const ev5 = store.get('EV-05');
  if (!ev5 || ev5.taak !== OUD || store.get('EV-12')) return false;
  for (const soort of PER_TAAK) {
    const w = store.getMeta(`${soort}:${OUD}`);
    if (w === undefined) continue;
    if (store.getMeta(`${soort}:${NIEUW}`) === undefined) store.setMeta(`${soort}:${NIEUW}`, w);
    store.verwijderMeta(`${soort}:${OUD}`);
  }
  const positie = store.getMeta('positie:2');
  if (positie?.taak === OUD) store.setMeta('positie:2', { ...positie, taak: NIEUW });
  store.save({ ...ev5, taak: NIEUW });
  return true;
}
