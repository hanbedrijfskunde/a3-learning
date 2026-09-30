// Weergavemodellen: wat een pagina toont, als gewone objecten (TK-2, TK-3, TK-6, TK-15, LB-1, TK-18).
// Puur en zonder DOM, zodat de regels erin in Node te testen zijn; de DOM-code (leerblok.js, index-pagina.js)
// bouwt er alleen elementen van.
import { STATUS_TEKST } from './status.js';
import { isAfgerond } from './afgerond.js';
import { verbandRegel } from './verbandregel.js';

/** De vier stappen van elke taak, in vaste volgorde (TK-18, ADR B76). „Klaar" en de volgende stap sluiten Toepassen af;
 *  de verdieping komt na „klaar" en is geen stap. */
export { STAP_NAMEN as STAPPEN } from './voortgang.js';
import { STAP_NAMEN as STAPPEN } from './voortgang.js';

export const BEWAARMELDING = 'Bewaar je dossier: je werk staat alleen in deze browser. Ga naar het dossier om het te bewaren.';

const heeftWaarde = (w) => (Array.isArray(w) ? w.length > 0 : typeof w === 'string' ? w.trim() !== '' : w !== undefined && w !== null);

/**
 * Een veldwaarde als leesbare tekst: een tekst blijft een tekst, een lijst wordt „a; b", een object „sleutel: waarde, …".
 * Nodig voor records met geneste inhoud (EV-09: regels en teamactie) op de afdrukpagina en in de meenemen-kaart.
 */
export function waardeTekst(w) {
  if (w === undefined || w === null) return '';
  if (Array.isArray(w)) return w.map(waardeTekst).filter((t) => t !== '').join('; ');
  if (typeof w === 'object' && w.van && w.naar && w.type) return verbandRegel(w); // een verband uit EV-11
  if (typeof w === 'object' && typeof w.id === 'string' && w.id.includes(':') && w.tekst) return w.tekst; // een kaart als chip in de synthese
  if (typeof w === 'object' && w.kapitaal && w.waarde) return `${w.kapitaal}: ${w.waarde}`; // een markering uit EV-11
  if (typeof w === 'object') return Object.entries(w).map(([k, v]) => [k, waardeTekst(v)]).filter(([, t]) => t !== '').map(([k, t]) => `${k}: ${t}`).join(', ');
  return String(w);
}

/** Is er in minstens één veld iets ingevuld? */
export const isIngevuld = (invoer = {}) => Object.values(invoer).some(heeftWaarde);

/** De velden van de oefenversie: eigen velden, anders dezelfde als bij het toepassen. */
export const oefenVelden = (taak) => taak.oefening?.velden ?? taak.toepassing.velden;

/** Het verdiepingsonderdeel dat bij deze taak hoort (na „klaar"), of null (TK-13). */
export const verdiepingBijTaak = (blok, taakId) => (blok.verdieping?.na === taakId ? blok.verdieping : null);

/**
 * Het modelantwoord is pas zichtbaar als de student in minstens één veld iets heeft ingevuld (TK-6); bij `modelNa: 'lijn'` (taak 9.4)
 * pas na minstens één getrokken lijn in de verbanden-kaart (VB-2).
 * Wie de oefening overslaat, krijgt het modelantwoord niet: die stap is dan niet gedaan.
 */
export function modelZichtbaar(velden, invoer = {}, overgeslagen = false, modelNa = 'veld') {
  if (overgeslagen) return false;
  // Taak 9.4 (VB-2): het modelvoorbeeld komt pas na minstens één getrokken lijn, niet al na een ingevuld antwoord.
  if (modelNa === 'lijn') return Array.isArray(invoer.verbanden) && invoer.verbanden.length > 0;
  return velden.some((v) => heeftWaarde(invoer[v.id]));
}

/** Model van de oefenversie. Het modelantwoord zit er alleen in als het zichtbaar mag zijn (TK-6). */
export function oefenModel(taak, staat = {}) {
  const velden = oefenVelden(taak);
  const invoer = staat.invoer ?? {};
  const overgeslagen = staat.overgeslagen === true;
  const zichtbaar = modelZichtbaar(velden, invoer, overgeslagen, taak.oefening?.modelNa);
  return {
    opdracht: taak.oefening?.opdracht ?? null,
    velden,
    invoer,
    overgeslagen,
    pogingen: staat.pogingen ?? 0,
    modelZichtbaar: zichtbaar,
    modelantwoord: zichtbaar ? taak.modelantwoord : null,
  };
}

/**
 * Model van één taak met de vier stappen in vaste volgorde (TK-18) en, bij stap 1, werkboeknummer, waarom,
 * richttijd en „klaar als" (TK-2). De oefenversie (stap 3) en het toepassen (stap 4) zijn twee aparte delen (TK-3).
 * De verdieping (TK-13) staat apart: ze verschijnt na „klaar" en telt niet als stap.
 */
export function bouwTaakModel(taak, blok) {
  const verdieping = verdiepingBijTaak(blok, taak.id);
  return {
    id: taak.id,
    nummer: taak.id,
    titel: taak.titel,
    vorm: taak.vorm,
    richttijd: taak.richttijd,
    heeftBewijs: Boolean(taak.bewijsonderdeel),
    bewijsonderdeel: taak.bewijsonderdeel ?? null,
    stappen: [
      { nr: 1, naam: STAPPEN[0], nummer: taak.id, waarom: taak.waarom, richttijd: taak.richttijd, klaarAls: taak.klaarAls },
      { nr: 2, naam: STAPPEN[1], stof: taak.stof },
      { nr: 3, naam: STAPPEN[2], oefening: { opdracht: taak.oefening?.opdracht ?? null, figuur: taak.oefening?.figuur ?? null, velden: oefenVelden(taak) } },
      { nr: 4, naam: STAPPEN[3], opdracht: taak.toepassing.opdracht, figuur: taak.toepassing.figuur ?? null, velden: taak.toepassing.velden, livevoorbeeld: taak.toepassing.livevoorbeeld ?? null,
        klaarAls: taak.klaarAls, volgendeStapVraag: 'Mijn volgende stap is …' },
    ],
    verdieping,
  };
}

/**
 * Afsluitscherm van een leerblok (TK-15): status per bewijsonderdeel, een volgende stap en de bewaarmelding.
 * Doorgaan kan altijd, ook als het leerblok niet is afgerond (TK-17).
 * @param {object} blok inhoud van data/leerblok-N.json
 * @param {Object<string, object|undefined>} records nieuwste record per id
 * @param {{href: string, titel: string}|null} volgende het volgende leerblok in de aanbevolen volgorde
 */
export function bouwAfsluitModel(blok, records, volgende = null) {
  const { afgerond, onderdelen } = isAfgerond(blok.bewijsonderdelen.map((b) => b.id), records);
  return {
    leerblok: blok.leerblok,
    onderdelen: blok.bewijsonderdelen.map((b, i) => ({
      id: b.id,
      titel: b.titel ?? b.id,
      status: onderdelen[i].status,
      statusTekst: STATUS_TEKST[onderdelen[i].status],
      voorlopig: onderdelen[i].voorlopig,
    })),
    afgerond,
    afgerondTekst: afgerond
      ? `Leerblok ${blok.leerblok} is afgerond.`
      : `Leerblok ${blok.leerblok} is nog niet afgerond. Je kunt gewoon doorgaan; afronden kan later.`,
    volgendeStapVraag: 'Wat is je volgende stap?',
    bewaarmelding: BEWAARMELDING,
    volgende,
    doorgaanBlokkeert: false,
  };
}

/**
 * Overzicht van de vier leerblokken voor de startpagina (LB-1, TK-1): titel, richttijd, het bewijs waarmee het
 * leerblok eindigt en of dat is afgerond. Alle leerblokken zijn direct te openen; er is geen voorwaarde.
 * @param {object} overzicht data/leerblokken.json
 * @param {Object<string, object|undefined>} records nieuwste record per id
 */
export function bouwIndexModel(overzicht, records = {}) {
  return overzicht.leerblokken.map((lb) => {
    const { afgerond, onderdelen } = isAfgerond(lb.bewijsonderdelen, records);
    const tijd = lb.terugblik > 0 ? `${lb.richttijd} min, plus hoogstens ${lb.terugblik} min terugblik` : `${lb.richttijd} min`;
    return {
      nummer: lb.nummer,
      titel: lb.titel,
      href: lb.pagina,
      richttijdTekst: tijd,
      afgerondBewijs: lb.afgerondBewijs,
      el: lb.el,
      aanbevolen: lb.aanbevolen ? `${lb.aanbevolen.week}, ${lb.aanbevolen.dag}` : '',
      afgerond,
      afgerondTekst: afgerond ? 'Afgerond' : 'Te doen',
      onderdelen: onderdelen.map((o) => ({ id: o.id, status: o.status, statusTekst: STATUS_TEKST[o.status], voorlopig: o.voorlopig })),
    };
  });
}
