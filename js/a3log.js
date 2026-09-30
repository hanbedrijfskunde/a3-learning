// Het logboek van „kopieer naar A3 vak 1” (LB-17): één datum per kopieeractie, in de meta-opslag en in de export van het dossier.
// Klein en los van a3tekst.js, zodat de export (dossier.js) niet het hele tekstblok laadt (PF-4).

export const META_KOPIEER_LOG = 'a3:kopieerlog';

/** De kopieeracties tot nu toe: lijst van ISO-datums, oudste eerst (LB-17). */
export function leesKopieLog(store) {
  const l = store.getMeta(META_KOPIEER_LOG);
  return Array.isArray(l) ? l.filter((d) => typeof d === 'string') : [];
}

/** Logt één kopieeractie met de datum en tijd van dat moment (LB-17): één datum per actie. */
export function logKopie(store, nu = new Date()) {
  const log = [...leesKopieLog(store), nu.toISOString()];
  store.setMeta(META_KOPIEER_LOG, log);
  return log;
}
