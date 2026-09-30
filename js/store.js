// Browseropslag met versies (RC-5, RC-6, ST-6, DS-1). Geen DOM: de opslag wordt meegegeven, zodat dit in Node te testen is.
//
// API (bindend voor latere fasen):
//   const store = maakStore(opslag)        opslag = iets met getItem/setItem/removeItem/key/length (Storage of geheugenOpslag())
//   store.save(record)   -> opgeslagen record   valideert tegen schema 1.0, zet `versie` op vorige + 1, bewaart alle eerdere versies
//   store.get(id)        -> nieuwste record of undefined
//   store.versions(id)   -> alle versies, oudste eerst (RC-6)
//   store.ids()          -> gesorteerde lijst met id's van bewijsonderdelen die een record hebben
//   store.clear()        -> aantal verwijderde sleutels; verwijdert alles van de site uit deze opslag (ST-6)
// Los van de bewijsrecords staat een tweede, onversioneerde ruimte voor alles wat geen bewijs is
// (profiel, oefeninvoer, klaar-markering, verdieping): getMeta(naam), setMeta(naam, waarde), verwijderMeta(naam).
// Oefeninvoer komt daardoor nooit in een bewijsrecord terecht (TK-4).
import { valideer } from './schema.js';

export const PREFIX = 'a3l:';
const RECORD = `${PREFIX}rec:`;
const META = `${PREFIX}meta:`;

/** Opslag in het geheugen met dezelfde vorm als localStorage; voor tests en als terugval als de browser opslag blokkeert. */
export function geheugenOpslag() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

/**
 * Kiest de browseropslag. Geeft { opslag, geblokkeerd }: is localStorage niet bruikbaar (privévenster, geblokkeerd),
 * dan is `opslag` een geheugenopslag en `geblokkeerd` waar, zodat de pagina dat kan melden (fase 3, DS-12).
 */
export function kiesOpslag(win = globalThis) {
  try {
    const s = win.localStorage;
    const sleutel = `${PREFIX}test`;
    s.setItem(sleutel, '1');
    s.removeItem(sleutel);
    return { opslag: s, geblokkeerd: false };
  } catch (e) {
    return { opslag: geheugenOpslag(), geblokkeerd: true };
  }
}

const kopie = (x) => JSON.parse(JSON.stringify(x));

export function maakStore(opslag) {
  const leesLijst = (id) => {
    const ruw = opslag.getItem(RECORD + id);
    if (ruw === null) return [];
    try {
      const lijst = JSON.parse(ruw);
      return Array.isArray(lijst) ? lijst : [];
    } catch (e) { return []; }
  };

  function versions(id) {
    return kopie(leesLijst(id));
  }

  function get(id) {
    const lijst = leesLijst(id);
    return lijst.length ? kopie(lijst[lijst.length - 1]) : undefined;
  }

  function save(record) {
    const lijst = leesLijst(record?.id);
    const versie = lijst.length ? lijst[lijst.length - 1].versie + 1 : 1;
    const nieuw = { ...kopie(record), versie };
    const { geldig, fouten } = valideer(nieuw);
    if (!geldig) throw new Error(`Record ${record?.id} is ongeldig: ${fouten.join(' ')}`);
    lijst.push(nieuw);
    opslag.setItem(RECORD + nieuw.id, JSON.stringify(lijst));
    return kopie(nieuw);
  }

  function sleutels(voorvoegsel) {
    const uit = [];
    for (let i = 0; i < opslag.length; i += 1) {
      const k = opslag.key(i);
      if (typeof k === 'string' && k.startsWith(voorvoegsel)) uit.push(k);
    }
    return uit;
  }

  const ids = () => sleutels(RECORD).map((k) => k.slice(RECORD.length)).sort();

  function clear() {
    const weg = sleutels(PREFIX);
    weg.forEach((k) => opslag.removeItem(k));
    return weg.length;
  }

  function getMeta(naam) {
    const ruw = opslag.getItem(META + naam);
    if (ruw === null) return undefined;
    try { return JSON.parse(ruw); } catch (e) { return undefined; }
  }
  const setMeta = (naam, waarde) => { opslag.setItem(META + naam, JSON.stringify(waarde)); };
  const verwijderMeta = (naam) => { opslag.removeItem(META + naam); };

  return Object.freeze({ get, save, versions, ids, clear, getMeta, setMeta, verwijderMeta });
}
