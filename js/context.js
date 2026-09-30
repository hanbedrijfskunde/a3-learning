// Context voor de controles van soort B (BW-10): de ontvangen wisselblokken en de eigen records van andere leerblokken.
// Klein en los van wissel.js, zodat elk leerblok het kan laden zonder de hele Wissel (PF-4).

export const ROL_ANDER_TEAM = 'ander team'; // WS-6: rol van feedback van een ander team
export const META_BLOKKEN = 'wissel:blokken';
/** Records die een controle in een ander leerblok mag inzien: EV-01/02 (leerblok 1), EV-06/07 (leerblok 3), EV-11 (leerblok 4). */
export const CONTEXT_RECORDS = Object.freeze(['EV-01', 'EV-02', 'EV-06', 'EV-07', 'EV-11']);

/** Ontvangen wisselblokken en de eigen records waarmee ze of andere onderdelen worden vergeleken (WS-7, EV-07, EV-11). */
export function wisselContext(store) {
  return {
    wissel: { ontvangen: store.getMeta(META_BLOKKEN) ?? [] },
    eigen: Object.fromEntries(CONTEXT_RECORDS.map((id) => [id, store.get(id)])),
  };
}
