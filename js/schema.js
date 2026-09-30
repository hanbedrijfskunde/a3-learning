// Recordvorm van een bewijsonderdeel (schema 1.0, blueprint §5, RC-1…RC-4).
// Puur: geen DOM, geen netwerk. Werkt in de browser en in Node.

export const SCHEMA_VERSIE = '1.0';

/** De 13 velden van een bewijsrecord, in vaste volgorde (RC-1). */
export const VELDEN = Object.freeze([
  'schema', 'id', 'taak', 'leerblok', 'luk', 'bc', 'inhoud', 'controles',
  'status', 'voorlopig', 'versie', 'bijgewerkt', 'elearning',
]);

export const SOORTEN = Object.freeze(['A', 'B', 'C']);
export const RESULTATEN = Object.freeze(['ok', 'let op', 'mist']);
export const STATUSSEN = Object.freeze(['compleet', 'bijna', 'nog niet']);

/** Sleutels die nooit in `inhoud` mogen staan (RC-3: geen naam of alias; PR-2: ook geen teamnummer). */
export const VERBODEN_SLEUTELS_INHOUD = Object.freeze(['alias', 'naam', 'teamnummer']);

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Alle sleutels (ook genest) van een waarde, voor de scans op verboden sleutels. */
function alleSleutels(waarde, uit = []) {
  if (Array.isArray(waarde)) waarde.forEach((w) => alleSleutels(w, uit));
  else if (isObject(waarde)) {
    for (const [k, v] of Object.entries(waarde)) { uit.push(k); alleSleutels(v, uit); }
  }
  return uit;
}

const ISO_MET_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Valideert een bewijsrecord tegen schema 1.0.
 * @param {object} record
 * @param {object} [taakdef] taakdefinitie uit data/leerblok-N.json; als meegegeven
 *   moeten `luk`, `bc`, `taak` en `leerblok` daarmee overeenkomen (RC-2).
 * @returns {{geldig: boolean, fouten: string[]}} `fouten` bevat zinnen in het Nederlands.
 */
export function valideer(record, taakdef) {
  const fouten = [];
  if (!isObject(record)) return { geldig: false, fouten: ['Het record is geen JSON-object.'] };

  for (const veld of VELDEN) if (!(veld in record)) fouten.push(`Veld ontbreekt: ${veld}.`);
  for (const veld of Object.keys(record)) if (!VELDEN.includes(veld)) fouten.push(`Onbekend veld: ${veld}.`);

  if ('schema' in record && record.schema !== SCHEMA_VERSIE) fouten.push(`Veld schema moet "${SCHEMA_VERSIE}" zijn.`);
  if ('id' in record && !/^EV-\d{2}$/.test(record.id)) fouten.push('Veld id moet de vorm EV-01 hebben.');
  if ('taak' in record && !/^\d+\.\d+$/.test(record.taak)) fouten.push('Veld taak moet de vorm 2.1 hebben.');
  if ('leerblok' in record && !(Number.isInteger(record.leerblok) && record.leerblok >= 1 && record.leerblok <= 4)) {
    fouten.push('Veld leerblok moet een geheel getal van 1 tot en met 4 zijn.');
  }
  if ('luk' in record && !(Array.isArray(record.luk) && record.luk.length > 0
      && record.luk.every((n) => Number.isInteger(n) && n >= 1 && n <= 5))) {
    fouten.push('Veld luk moet een lijst zijn met minstens één leeruitkomst (1 tot en met 5).');
  }
  if ('bc' in record && !(Array.isArray(record.bc) && record.bc.length > 0
      && record.bc.every((b) => /^BC\d+$/.test(b)))) {
    fouten.push('Veld bc moet een lijst zijn met minstens één beoordelingscriterium (BC1, BC2, …).');
  }

  if ('inhoud' in record) {
    if (!isObject(record.inhoud)) fouten.push('Veld inhoud moet een object zijn.');
    else {
      const sleutels = alleSleutels(record.inhoud).map((s) => s.toLowerCase());
      for (const verboden of VERBODEN_SLEUTELS_INHOUD) {
        if (sleutels.includes(verboden)) fouten.push(`Inhoud mag geen ${verboden} bevatten (RC-3).`);
      }
      if (sleutels.includes('controles')) fouten.push('Controles horen in het veld controles, niet in inhoud (RC-4).');
    }
  }

  if ('controles' in record) {
    if (!Array.isArray(record.controles)) fouten.push('Veld controles moet een lijst zijn.');
    else record.controles.forEach((c, i) => {
      if (!isObject(c) || typeof c.id !== 'string' || c.id === '' || !RESULTATEN.includes(c.resultaat)
          || Object.keys(c).some((k) => k !== 'id' && k !== 'resultaat')) {
        fouten.push(`Controle ${i + 1} moet precies een id en een resultaat (ok, let op of mist) hebben.`);
      }
    });
  }

  if ('status' in record && !STATUSSEN.includes(record.status)) {
    fouten.push('Veld status moet "compleet", "bijna" of "nog niet" zijn.');
  }
  if ('voorlopig' in record && typeof record.voorlopig !== 'boolean') fouten.push('Veld voorlopig moet waar of onwaar zijn.');
  if ('versie' in record && !(Number.isInteger(record.versie) && record.versie >= 1)) {
    fouten.push('Veld versie moet een geheel getal vanaf 1 zijn.');
  }
  if ('bijgewerkt' in record && !(typeof record.bijgewerkt === 'string' && ISO_MET_ZONE.test(record.bijgewerkt)
      && !Number.isNaN(Date.parse(record.bijgewerkt)))) {
    fouten.push('Veld bijgewerkt moet een tijdstip met tijdzone zijn, bijvoorbeeld 2026-09-30T14:02:11+02:00.');
  }
  if ('elearning' in record && !/^\d+\.\d+\.\d+$/.test(record.elearning)) {
    fouten.push('Veld elearning moet een versienummer als 0.1.0 zijn.');
  }

  if (taakdef) {
    const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if ('luk' in record && !gelijk(record.luk, taakdef.luk)) fouten.push('Veld luk komt niet overeen met de taakdefinitie (RC-2).');
    if ('bc' in record && !gelijk(record.bc, taakdef.bc)) fouten.push('Veld bc komt niet overeen met de taakdefinitie (RC-2).');
    if ('taak' in record && record.taak !== taakdef.taak) fouten.push('Veld taak komt niet overeen met de taakdefinitie.');
    if ('leerblok' in record && record.leerblok !== taakdef.leerblok) fouten.push('Veld leerblok komt niet overeen met de taakdefinitie.');
  }

  return { geldig: fouten.length === 0, fouten };
}

/**
 * Bouwt een record. `luk`, `bc`, `taak`, `leerblok` en `id` komen uit de taakdefinitie (RC-2).
 * Wie `luk` of `bc` als invoer meegeeft krijgt een fout: die horen daar niet vandaan te komen.
 * `status` bepaalt de aanroeper met `bepaalStatus` (status.js); dat houdt schema.js en status.js los van elkaar.
 * @param {object} p
 * @param {object} p.taakdef {id, taak, leerblok, luk, bc}
 * @param {object} p.inhoud invoer van de student
 * @param {{id: string, resultaat: string}[]} p.controles uitkomsten; extra velden (soort, melding) worden weggelaten
 * @param {string} p.status compleet | bijna | nog niet
 * @param {number} p.versie
 * @param {string} p.bijgewerkt
 * @param {string} p.elearning
 * @param {boolean} [p.voorlopig]
 */
export function maakRecord(p) {
  if ('luk' in p || 'bc' in p) throw new Error('luk en bc komen uit de taakdefinitie, niet uit de invoer (RC-2).');
  const { taakdef, inhoud, controles, status, versie, bijgewerkt, elearning, voorlopig = false } = p;
  return {
    schema: SCHEMA_VERSIE,
    id: taakdef.id,
    taak: taakdef.taak,
    leerblok: taakdef.leerblok,
    luk: [...taakdef.luk],
    bc: [...taakdef.bc],
    inhoud,
    controles: controles.map(({ id, resultaat }) => ({ id, resultaat })),
    status,
    voorlopig,
    versie,
    bijgewerkt,
    elearning,
  };
}
