// Terugblik en werken met tussenpozen (TP-1…TP-11). Geen DOM en geen netwerk: de opslag, de gegevens en de klok
// worden meegegeven, zodat dit in Node te testen is. De pagina zit in terugblik-pagina.js.
//
// Onderdelen:
//   pauzeInDagen(records, { leerblok, nu })  de pauze tussen twee leerblokken, uit de tijdstempels van het dossier (TP-6)
//   bandbreedte(dagen)                        kort | middel | volledig | lang (TP-7; besluit A-5 in ADR B65)
//   dossierControle(...)                      is het dossier er, en welke bewijsonderdelen van eerdere leerblokken ontbreken (TP-9)
//   maakTerugblik(...)                        de terugblik zelf: eerst ophalen, dan de kaart, dan de transfervraag (TP-2…TP-5)
//   leesTerugblikLog / importeerTerugblikLog  het log met pauze en „gedaan" of „overgeslagen" (TP-8)
//
// De terugblik levert geen bewijs (TP-5): niets hiervan wordt een bewijsrecord. De invoer staat in de meta-ruimte van
// store.js onder `terugblik:<leerblok>`, het log onder `terugblik:log`; alleen het log gaat mee in de export.
import { tellers } from './checks/core.js';
import { waardeTekst } from './weergave.js';

export const UUR_MS = 60 * 60 * 1000;
export const DAG_MS = 24 * UUR_MS;
/** TP-7: de grenzen tussen de vier bandbreedtes. Een grens hoort bij de hogere band (2 uur is „middel", 14 dagen is „lang"). */
export const GRENZEN = Object.freeze({ kortTotMs: 2 * UUR_MS, middelTotMs: 2 * DAG_MS, volledigTotMs: 14 * DAG_MS });
export const BANDEN = Object.freeze(['kort', 'middel', 'volledig', 'lang']);
export const STATUSSEN = Object.freeze(['gedaan', 'overgeslagen']);
export const MIN_PUNTEN = 3; // TP-2
export const MIN_WOORDEN_ZIN = 3; // TP-4
export const ZINNEN = 2; // TP-4
export const ZONDER_PAUZE = 'volledig'; // geen werk van het vorige leerblok in deze browser: de pauze is onbekend

const LOG = 'terugblik:log';
const sleutel = (leerblok) => `terugblik:${leerblok}`;
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const heeftTekst = (t) => /[\p{L}\p{N}]{2,}/u.test(String(t ?? ''));

// ------------------------------------------------------------------ pauze en bandbreedte (TP-6, TP-7)

/** Records uit een lijst records of uit een dossierexport ({ records: [{ record }] }). */
const alsRecords = (x) => {
  const lijst = Array.isArray(x) ? x : Array.isArray(x?.records) ? x.records : [];
  return lijst.map((r) => (isObject(r?.record) ? r.record : r)).filter(isObject);
};

/**
 * De pauze in dagen (met decimalen) tussen het laatste werk aan het vorige leerblok en `nu`, uit `bijgewerkt` van de
 * records (TP-6). Zonder records van het vorige leerblok telt het laatste record van een eerder leerblok; zonder
 * beide is er geen pauze te berekenen (null).
 * @param {object[]|{records: object[]}} records records of een dossierexport
 * @param {{leerblok: number, nu?: Date}} p `leerblok` is het leerblok dat nu begint
 */
export function pauzeInDagen(records, { leerblok, nu = new Date() }) {
  const lijst = alsRecords(records);
  const vorige = lijst.filter((r) => r.leerblok === leerblok - 1);
  const bron = vorige.length > 0 ? vorige : lijst.filter((r) => r.leerblok < leerblok);
  const tijden = bron.map((r) => Date.parse(r.bijgewerkt)).filter(Number.isFinite);
  if (tijden.length === 0) return null;
  return Math.max(0, nu.getTime() - Math.max(...tijden)) / DAG_MS;
}

/**
 * De bandbreedte bij een pauze in dagen (TP-7): < 2 uur `kort`, tot < 2 dagen `middel`, tot < 14 dagen `volledig`,
 * daarna `lang`. Een onbekende pauze (null) geeft `volledig`.
 */
export function bandbreedte(pauzeDagen) {
  if (typeof pauzeDagen !== 'number' || Number.isNaN(pauzeDagen)) return ZONDER_PAUZE;
  const ms = Math.round(Math.max(0, pauzeDagen) * DAG_MS); // afronden op een milliseconde: geen drijvendekommaruis op de grens
  if (ms < GRENZEN.kortTotMs) return 'kort';
  if (ms < GRENZEN.middelTotMs) return 'middel';
  if (ms < GRENZEN.volledigTotMs) return 'volledig';
  return 'lang';
}

/** De pauze als korte tekst voor de student. */
export function pauzeTekst(pauzeDagen) {
  if (typeof pauzeDagen !== 'number') return 'Je hebt in deze browser nog geen werk van het vorige leerblok.';
  const ms = Math.round(pauzeDagen * DAG_MS);
  if (ms < UUR_MS) return 'Minder dan een uur geleden werkte je aan het vorige leerblok.';
  if (ms < DAG_MS) return `${Math.floor(ms / UUR_MS)} uur geleden werkte je aan het vorige leerblok.`;
  const dagen = Math.floor(ms / DAG_MS);
  return `${dagen} ${dagen === 1 ? 'dag' : 'dagen'} geleden werkte je aan het vorige leerblok.`;
}

/** Wat elke bandbreedte van de student vraagt (TP-2, TP-7): punten uit het hoofd, kennisvragen, kaart en samenvatting. */
export function eisenVoor(band) {
  const eisen = {
    kort: { punten: 0, kennisvragen: 0, kaart: false, samenvatting: false },
    middel: { punten: 0, kennisvragen: 1, kaart: false, samenvatting: false },
    volledig: { punten: MIN_PUNTEN, kennisvragen: 2, kaart: true, samenvatting: false },
    lang: { punten: MIN_PUNTEN, kennisvragen: 2, kaart: true, samenvatting: true },
  }[band];
  if (!eisen) throw new Error(`Onbekende bandbreedte ${JSON.stringify(band)}.`);
  return { ...eisen };
}

/** Het aantal punten in een tekst: één punt per niet-lege regel met minstens twee letters of cijfers. */
export const telPunten = (tekst) => String(tekst ?? '').split(/\r?\n/).filter(heeftTekst).length;

// ------------------------------------------------------------------ het log (TP-8)

/** Het log als lijst { leerblok, pauzeDagen, status }, oplopend op leerblok. Dit gaat mee in de export van het dossier. */
export function leesTerugblikLog(store) {
  const l = store.getMeta(LOG);
  return (Array.isArray(l) ? l : []).filter(geldigLogItem).map((e) => ({ leerblok: e.leerblok, pauzeDagen: e.pauzeDagen, status: e.status }))
    .sort((a, b) => a.leerblok - b.leerblok);
}

function geldigLogItem(e) {
  return isObject(e) && Number.isInteger(e.leerblok) && e.leerblok >= 2 && e.leerblok <= 4
    && STATUSSEN.includes(e.status) && (e.pauzeDagen === null || (typeof e.pauzeDagen === 'number' && e.pauzeDagen >= 0));
}

function zetLog(store, item) {
  const rest = leesTerugblikLog(store).filter((e) => e.leerblok !== item.leerblok);
  store.setMeta(LOG, [...rest, item].sort((a, b) => a.leerblok - b.leerblok));
}
const wisLog = (store, leerblok) => store.setMeta(LOG, leesTerugblikLog(store).filter((e) => e.leerblok !== leerblok));

/**
 * Vult het log aan met de regels uit een geïmporteerd dossier, alleen voor leerblokken waarvoor de opslag nog niets heeft.
 * @returns {number[]} de leerblokken die zijn overgenomen
 */
export function importeerTerugblikLog(store, lijst) {
  if (!Array.isArray(lijst)) return [];
  const heeft = new Set(leesTerugblikLog(store).map((e) => e.leerblok));
  const overgenomen = [];
  for (const e of lijst.filter(geldigLogItem)) {
    if (heeft.has(e.leerblok)) continue;
    zetLog(store, { leerblok: e.leerblok, pauzeDagen: e.pauzeDagen, status: e.status });
    heeft.add(e.leerblok);
    overgenomen.push(e.leerblok);
  }
  return overgenomen.sort();
}

// ------------------------------------------------------------------ dossiercontrole (TP-9)

/**
 * Is het dossier aanwezig en welke bewijsonderdelen van eerdere leerblokken hebben nog geen record? Ontbreekt er iets,
 * dan hoort de pagina een import aan te bieden.
 * @param {object} p
 * @param {ReturnType<import('./store.js').maakStore>} p.store
 * @param {{leerblokken: {nummer: number, bewijsonderdelen: string[]}[]}} p.overzicht data/leerblokken.json
 * @param {number} p.leerblok het leerblok dat nu begint
 * @param {Object<string, string>} [p.titels] titel per bewijsonderdeel
 */
export function dossierControle({ store, overzicht, leerblok, titels = {} }) {
  const eerder = overzicht.leerblokken.filter((b) => b.nummer < leerblok);
  const verwacht = eerder.flatMap((b) => b.bewijsonderdelen.map((id) => ({ id, leerblok: b.nummer, titel: titels[id] ?? id })));
  const ontbrekend = verwacht.filter((v) => !store.get(v.id));
  const aanwezig = store.ids().length > 0;
  return { aanwezig, ontbrekend, importAanbod: !aanwezig || ontbrekend.length > 0, verwacht: verwacht.length };
}

// ------------------------------------------------------------------ de meenemen-kaart (TP-3)

/** Eigen bewijsstukken uit het vorige leerblok als lijst velden met label en waarde (TP-3). */
function eigenBewijs({ overzicht, vorig, records, titels, labels }) {
  const ids = overzicht.leerblokken.find((b) => b.nummer === vorig)?.bewijsonderdelen ?? [];
  return ids.map((id) => {
    const r = records[id];
    const velden = r ? Object.entries(r.inhoud ?? {}).map(([veld, w]) => ({ veld, label: labels[id]?.[veld] ?? veld, waarde: waardeTekst(w) }))
      .filter((v) => v.waarde.trim() !== '') : [];
    return { id, titel: titels[id] ?? id, heeftRecord: Boolean(r), velden };
  });
}

// ------------------------------------------------------------------ de terugblik zelf (TP-1…TP-5, TP-7, TP-8)

const leeg = () => ({ punten: '', antwoorden: [], item: '', zinnen: [], overgeslagen: false, gedaan: false, pauzeDagen: null });

/**
 * De terugblik aan het begin van een leerblok vanaf 2.
 * @param {object} p
 * @param {ReturnType<import('./store.js').maakStore>} p.store
 * @param {{bandbreedtes: object, kaarten: object[]}} p.terugblik data/terugblik.json
 * @param {object} p.overzicht data/leerblokken.json
 * @param {number} p.leerblok het leerblok dat nu begint (2, 3 of 4)
 * @param {() => Date} [p.nu] injecteerbare klok
 * @param {Object<string, string>} [p.titels] titel per bewijsonderdeel
 * @param {Object<string, Object<string, string>>} [p.labels] veldlabels per bewijsonderdeel
 */
export function maakTerugblik({ store, terugblik, overzicht, leerblok, nu = () => new Date(), titels = {}, labels = {} }) {
  const kaart = terugblik.kaarten.find((k) => k.leerblok === leerblok);
  if (!kaart) throw new Error(`Geen terugblik voor leerblok ${leerblok}.`);
  const vorig = kaart.vorig;
  const evIds = overzicht.leerblokken.flatMap((b) => b.bewijsonderdelen);
  const records = () => Object.fromEntries(evIds.map((id) => [id, store.get(id)]).filter(([, r]) => r));

  const lees = () => ({ ...leeg(), ...(isObject(store.getMeta(sleutel(leerblok))) ? store.getMeta(sleutel(leerblok)) : {}) });
  const pauze = () => pauzeInDagen(Object.values(records()), { leerblok, nu: nu() });

  const punten = (inv) => telPunten(inv.punten);
  const kennisvragen = (inv, band) => kaart.kennisvragen.slice(0, eisenVoor(band).kennisvragen)
    .map((vraag, i) => ({ vraag, antwoord: inv.antwoorden[i] ?? '', beantwoord: heeftTekst(inv.antwoorden[i]) }));
  const ophalenKlaar = (inv, band) => {
    const eis = eisenVoor(band);
    return punten(inv) >= eis.punten && kennisvragen(inv, band).every((k) => k.beantwoord);
  };
  const zinnenOk = (inv) => Array.from({ length: ZINNEN }, (_, i) => tellers.telWoorden(inv.zinnen[i] ?? '') >= MIN_WOORDEN_ZIN).every(Boolean);
  const transferOk = (inv) => kaart.items.includes(inv.item) && zinnenOk(inv);

  /** Schrijft de invoer weg en werkt „gedaan" en het log bij: gedaan = ophalen klaar én transfervraag beantwoord. */
  function bewaar(inv) {
    const band = bandbreedte(pauze());
    const gedaan = !inv.overgeslagen && ophalenKlaar(inv, band) && transferOk(inv);
    const nieuw = { ...inv, gedaan };
    if (gedaan && !inv.gedaan) {
      nieuw.pauzeDagen = pauze();
      zetLog(store, { leerblok, pauzeDagen: nieuw.pauzeDagen, status: 'gedaan' });
    } else if (!gedaan && inv.gedaan) {
      wisLog(store, leerblok);
    }
    store.setMeta(sleutel(leerblok), nieuw);
  }

  function model() {
    const inv = lees();
    const p = inv.gedaan && inv.pauzeDagen !== null ? inv.pauzeDagen : pauze();
    const band = bandbreedte(p);
    const eis = eisenVoor(band);
    const ophalenOk = ophalenKlaar(inv, band);
    const status = inv.overgeslagen ? 'overgeslagen' : inv.gedaan ? 'gedaan' : 'open';
    // TP-2: de kaart is pas zichtbaar als de student heeft opgehaald of de terugblik overslaat. In `kort` en `middel`
    // is er geen kaart; de items staan dan alleen als keuze bij de transfervraag.
    const kaartZichtbaar = eis.kaart && (ophalenOk || inv.overgeslagen);
    const transferZichtbaar = !inv.overgeslagen && (eis.kaart ? kaartZichtbaar : ophalenOk);
    const bewijs = kaartZichtbaar ? eigenBewijs({ overzicht, vorig, records: records(), titels, labels }) : null;
    const kv = kennisvragen(inv, band);
    return {
      leerblok, vorig, pauzeDagen: p, pauzeTekst: pauzeTekst(p), band,
      minuten: terugblik.bandbreedtes[band].minuten,
      omschrijving: terugblik.bandbreedtes[band].omschrijving,
      status,
      ophalen: {
        eis, punten: punten(inv), puntenTekst: inv.punten, kennisvragen: kv, klaar: ophalenOk,
        nog: { punten: Math.max(0, eis.punten - punten(inv)), kennisvragen: kv.filter((k) => !k.beantwoord).length },
      },
      kaartZichtbaar,
      kaart: kaartZichtbaar
        ? { items: [...kaart.items], eigenBewijs: bewijs, samenvatting: eis.samenvatting ? kaart.samenvatting.tekst : null }
        : null,
      transfer: {
        zichtbaar: transferZichtbaar, vraag: kaart.transfervraag, items: transferZichtbaar ? [...kaart.items] : [],
        item: inv.item, zinnen: Array.from({ length: ZINNEN }, (_, i) => inv.zinnen[i] ?? ''), geldig: transferOk(inv),
      },
    };
  }

  return {
    model,
    /** De invoer van het ophalen: `punten` (één per regel) en `antwoorden` op de kennisvragen. */
    zetOphalen({ punten: p = '', antwoorden = [] }) { bewaar({ ...lees(), punten: String(p), antwoorden: antwoorden.map(String) }); return model(); },
    /** TP-4: één item uit de kaart en twee zinnen. */
    zetTransfer({ item = '', zinnen = [] }) { bewaar({ ...lees(), item: String(item), zinnen: zinnen.map(String) }); return model(); },
    /** TP-5: „ik weet het nog": één klik, de terugblik is overgeslagen en levert geen bewijsrecord. */
    weetHetNog() {
      const inv = lees();
      if (inv.gedaan) wisLog(store, leerblok);
      store.setMeta(sleutel(leerblok), { ...inv, overgeslagen: true, gedaan: false, pauzeDagen: null });
      zetLog(store, { leerblok, pauzeDagen: pauze(), status: 'overgeslagen' });
      return model();
    },
    /** Weer aan de terugblik beginnen: de invoer en het log van dit leerblok zijn dan weg. */
    opnieuw() { wisLog(store, leerblok); store.setMeta(sleutel(leerblok), leeg()); return model(); },
  };
}
