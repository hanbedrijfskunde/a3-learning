// De afgerond-regel van een leerblok (TK-16). Puur: geen DOM, geen opslag.
//
// Een leerblok is afgerond als elk bewijsonderdeel ervan een record heeft dat Compleet of Bijna is of het label
// `voorlopig` heeft, en geen enkel onderdeel „Nog niet" is. Het label `voorlopig` (ST-3) telt dus mee, ook als de
// controles nog „Nog niet" geven: wie nog geen scherp vraagstuk heeft, wordt daar niet op afgerekend.
// Een onderdeel zonder record is „Nog niet". Afronden is een checkpoint, geen slot (TK-17): niets in de site
// hangt van deze uitkomst af om door te kunnen gaan.

/** Telt dit record mee als afgerond bewijs? */
export function onderdeelTelt(record) {
  if (!record) return false;
  return record.status === 'compleet' || record.status === 'bijna' || record.voorlopig === true;
}

/**
 * @param {string[]} ids id's van de bewijsonderdelen van het leerblok (EV-01, …)
 * @param {Object<string, object|undefined>} records nieuwste record per id
 * @returns {{afgerond: boolean, onderdelen: {id: string, status: string, voorlopig: boolean, telt: boolean}[]}}
 *   `status` is „nog niet" als er geen record is.
 */
export function isAfgerond(ids, records = {}) {
  const onderdelen = ids.map((id) => {
    const r = records[id];
    return { id, status: r?.status ?? 'nog niet', voorlopig: r?.voorlopig === true, telt: onderdeelTelt(r) };
  });
  return { afgerond: onderdelen.length > 0 && onderdelen.every((o) => o.telt), onderdelen };
}

/** Leest de nieuwste records van de gegeven id's (id → record of undefined). */
export function leesRecords(store, ids) {
  return Object.fromEntries(ids.map((id) => [id, store.get(id)]));
}
