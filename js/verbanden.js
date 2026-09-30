// De verbanden-kaart (VB-1…VB-10): drie kolommen met kaarten, verbanden ertussen, open plekken als vraag, markering van de
// zes kapitalen en de synthese. Alleen logica: geen DOM, geen netwerk, geen opslag; de kaart zelf zit in lb4-ui.js.
//
// Een verband is { id, van, naar, vanTekst, naarTekst, type, zin, stakeholder?, vpcOnderdeel? }: `van` en `naar` zijn kaart-id's
// (`us:gebruiker`, `vpc:b2`, `kap:financieel`), `van` staat in de kolom links van `naar`. De teksten van de kaarten worden
// meegeslagen, zodat het verband ook leesbaar is als de bron later verandert. De sleutel `stakeholder` is bewust geen `naam`
// (RC-3: geen sleutel `naam` in een record).
import { tellers } from './checks/core.js';
import { verbandenUit, verbandRegel } from './verbandregel.js';

export const KAPITALEN = Object.freeze(['financieel', 'productie', 'intellectueel', 'menselijk', 'sociaal en relationeel', 'natuurlijk']);
export const TYPEN = Object.freeze(['hoort bij', 'leidt tot', 'gaat ten koste van']);
export const SPANNING = 'gaat ten koste van';
export const MARKERINGEN = Object.freeze(['input', 'uitkomst (+)', 'uitkomst (−)']);
export const VPC_ONDERDELEN = Object.freeze(['klanttaak', 'pain', 'gain', 'product of dienst', 'pain reliever', 'gain creator']);
/** Onderdelen van het VPC waarmee een kapitaal uit de user story verbonden moet zijn (EV-11). */
export const OPLOSSING_ONDERDELEN = Object.freeze(['gain', 'pain reliever', 'gain creator']);
export const MAX_ZINNEN_SYNTHESE = 5;
export const MIN_VERBANDEN = 6;
export const MIN_ZIN_WOORDEN = 3;

export const KOLOMMEN = Object.freeze([
  { id: 'us', titel: 'User story', bron: 'EV-01' },
  { id: 'vpc', titel: 'Value proposition canvas', bron: 'EV-07' },
  { id: 'kap', titel: 'Zes kapitalen', bron: 'IIRC' },
]);
const KOLOM_VOLGORDE = KOLOMMEN.map((k) => k.id);
const STORY_DELEN = Object.freeze([['gebruiker', 'Gebruiker'], ['pain', 'Pain of gain'], ['waarde', 'Waarde']]);
export const VPC_RIJEN = 5; // het register van EV-07: b1…b5

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const platTekst = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
export const kort = (t, max = 60) => { const p = platTekst(t); return p.length > max ? `${p.slice(0, max - 1).trimEnd()}…` : p; };
const lijst = (x) => (Array.isArray(x) ? x.filter(isObject) : []);

// ---------------------------------------------------------------- kaarten (VB-1)

/**
 * De kaarten van de drie kolommen. Links de drie delen van de user story uit EV-01, in het midden de kernbeweringen uit het
 * register van EV-07 die bij een onderdeel van het VPC horen, rechts de zes kapitalen (`gekozen`: de kapitalen die de student
 * in EV-01 koos). Een lege bron geeft lege kaarten of een lege kolom; er staat nooit een verband in.
 * @param {{ev01?: object, ev07?: object}} bronnen inhoud van EV-01 en EV-07
 * @returns {{kolommen: {id: string, titel: string, bron: string, kaarten: object[]}[], kaarten: Map<string, object>}}
 */
export function bouwKaarten({ ev01 = {}, ev07 = {} } = {}) {
  const gekozen = [].concat(ev01?.kapitalen ?? []);
  const us = STORY_DELEN.map(([sleutel, kop]) => {
    const tekst = platTekst(ev01?.[sleutel]);
    return { id: `us:${sleutel}`, kolom: 'us', kop, tekst, label: tekst ? `${kop}: ${kort(tekst)}` : kop };
  });
  const vpc = [];
  for (let n = 1; n <= VPC_RIJEN; n += 1) {
    const tekst = platTekst(ev07?.[`b${n}tekst`]);
    const onderdeel = platTekst(ev07?.[`b${n}onderdeel`]);
    if (tekst && VPC_ONDERDELEN.includes(onderdeel)) vpc.push({ id: `vpc:b${n}`, kolom: 'vpc', kop: onderdeel, tekst, label: `${onderdeel}: ${kort(tekst)}`, onderdeel });
  }
  const kap = KAPITALEN.map((k) => ({ id: `kap:${k}`, kolom: 'kap', kop: k, tekst: '', label: k, gekozen: gekozen.includes(k) }));
  const kolommen = KOLOMMEN.map((k, i) => ({ ...k, kaarten: [us, vpc, kap][i] }));
  return { kolommen, kaarten: new Map(kolommen.flatMap((k) => k.kaarten).map((c) => [c.id, c])) };
}

/** Bouwt de kaarten van de oefencasus uit `oefening.kaarten` in het leerblokbestand ({ us: [{kop, tekst}], vpc: [{onderdeel, tekst}], gekozen: [..] }). */
export function bouwOefenKaarten(casus = {}) {
  const ev01 = { kapitalen: casus.gekozen ?? [] };
  STORY_DELEN.forEach(([sleutel], i) => { ev01[sleutel] = casus.us?.[i] ?? ''; });
  const ev07 = {};
  (casus.vpc ?? []).slice(0, VPC_RIJEN).forEach((k, i) => { ev07[`b${i + 1}tekst`] = k.tekst; ev07[`b${i + 1}onderdeel`] = k.onderdeel; });
  return bouwKaarten({ ev01, ev07 });
}

// ---------------------------------------------------------------- verbanden (VB-3)

const kolomVan = (id) => String(id).split(':')[0];

/**
 * Maakt een verband tussen twee kaarten (VB-3): twee verschillende kolommen, een van de drie typen en één zin waarom (minstens
 * drie woorden). `van` is altijd de kaart in de kolom links van `naar`. Twee kaarten hebben hoogstens één verband.
 * @returns {{ok: true, verband: object} | {ok: false, fout: string}}
 */
export function maakVerband({ van, naar, type, zin, stakeholder = '' }, kaarten, bestaand = []) {
  const a = kaarten.get(van);
  const b = kaarten.get(naar);
  if (!a || !b) return { ok: false, fout: 'Kies twee kaarten.' };
  if (a.kolom === b.kolom) return { ok: false, fout: 'Verbind kaarten uit twee verschillende kolommen.' };
  if (!TYPEN.includes(type)) return { ok: false, fout: `Kies een type: ${TYPEN.join(', ')}.` };
  if (tellers.telWoorden(platTekst(zin)) < MIN_ZIN_WOORDEN) return { ok: false, fout: 'Schrijf in één zin waarom (minstens drie woorden).' };
  const [l, r] = KOLOM_VOLGORDE.indexOf(a.kolom) < KOLOM_VOLGORDE.indexOf(b.kolom) ? [a, b] : [b, a];
  if (bestaand.some((v) => v.van === l.id && v.naar === r.id)) return { ok: false, fout: 'Deze twee kaarten zijn al verbonden. Wijzig of verwijder dat verband.' };
  const vpc = [l, r].find((c) => c.kolom === 'vpc');
  const verband = {
    id: volgendVerbandId(bestaand), van: l.id, naar: r.id, vanTekst: l.label, naarTekst: r.label, type, zin: platTekst(zin),
    ...(type === SPANNING && platTekst(stakeholder) ? { stakeholder: platTekst(stakeholder) } : {}),
    ...(vpc ? { vpcOnderdeel: vpc.onderdeel } : {}),
  };
  return { ok: true, verband };
}

export const volgendVerbandId = (bestaand) => `v${1 + Math.max(0, ...bestaand.map((v) => Number(String(v.id).slice(1)) || 0))}`;

export { verbandenUit, verbandRegel };

/** Alle verbanden als regels. */
export const verbandRegels = (verbanden) => verbanden.map(verbandRegel);

/** Kaart-id's die minstens één verband hebben. */
export const verbondenKaarten = (verbanden) => new Set(verbanden.flatMap((v) => [v.van, v.naar]));

// ---------------------------------------------------------------- open plekken als vraag (VB-4)

/**
 * Kaarten zonder verband en kapitalen uit EV-01 zonder verband, als vraag. De vraag noemt alleen de kaart zelf: er staat nooit
 * een antwoord of een voorstel voor een verband in (VB-4, Mayer, 2004: geleid ontdekken, geen invulschema).
 * @returns {{kaart: string, vraag: string}[]}
 */
export function openPlekken({ kaarten, verbanden }) {
  const verbonden = verbondenKaarten(verbanden);
  const uit = [];
  for (const kaart of kaarten.values()) {
    if (verbonden.has(kaart.id)) continue;
    if (kaart.kolom === 'kap') {
      if (kaart.gekozen) uit.push({ kaart: kaart.id, vraag: `Je koos „${kaart.kop}” in je user story. Hoe komt dat kapitaal terug in je verbanden?` });
    } else if (kaart.kolom === 'us' && kaart.tekst === '') {
      continue; // een leeg deel van de user story is een taak van leerblok 1, geen open plek van deze kaart
    } else {
      uit.push({ kaart: kaart.id, vraag: `Waar hoort „${kaart.label}” bij?` });
    }
  }
  return uit;
}

// ---------------------------------------------------------------- markering van de kapitalen (VB-5)

/** De markering per kapitaal uit de lijst [{kapitaal, waarde}]; onbekende kapitalen of waarden vallen weg. */
export function markeringen(invoer) {
  const uit = {};
  for (const m of lijst(invoer?.markering)) if (KAPITALEN.includes(m.kapitaal) && MARKERINGEN.includes(m.waarde)) uit[m.kapitaal] = m.waarde;
  return uit;
}

/** Zet (of wist, bij waarde '') de markering van één kapitaal; geeft de nieuwe lijst. */
export function zetMarkering(invoer, kapitaal, waarde) {
  const huidig = markeringen(invoer);
  if (waarde && MARKERINGEN.includes(waarde)) huidig[kapitaal] = waarde; else delete huidig[kapitaal];
  return KAPITALEN.filter((k) => huidig[k]).map((k) => ({ kapitaal: k, waarde: huidig[k] }));
}

// ---------------------------------------------------------------- synthese (VB-7)

export const NIET_ZIEN_VELDEN = Object.freeze([['nietZien1', 'user story'], ['nietZien2', 'value proposition canvas'], ['nietZien3', 'zes kapitalen']]);

/** De kaart als chip in de synthese: `[label]`. */
export const chipTekst = (kaart) => `[${kort(kaart.label, 40)}]`;

/**
 * Welke kolommen (modellen) komen als chip in de synthese voor? Een chip telt alleen als zijn tekst nog in de alinea staat.
 * @param {{synthese?: string, syntheseKaarten?: {id: string, tekst: string}[]}} invoer
 */
export function syntheseModellen(invoer) {
  const tekst = String(invoer?.synthese ?? '');
  return [...new Set(lijst(invoer?.syntheseKaarten).filter((k) => k.tekst && tekst.includes(k.tekst)).map((k) => kolomVan(k.id)))];
}
