// Metrokaart van het leerblok (SX-18, SX-19; ADR B110; DESIGN §6 Metrokaart): welke kolommen en haltes de kaart heeft,
// met stand, label, toegankelijke naam en link. Puur: geen DOM, geen maten (die staan in metro-indeling.js).
import { stapStand, STAP_NAMEN, segmentLabel } from './voortgang.js';
import { STAP_SLUGS, maakAdres } from './taakweergave.js';
import { isIngevuld, oefenModel } from './weergave.js';
import { isAfgerond, leesRecords } from './afgerond.js';

/** Korte labels van de vier stap-haltes (TK-18). */
export const STAP_KORT = Object.freeze(['W', 'S', 'O', 'T']);
/** De drie routes in de stap stof van de mediataak (MD-2). */
export const MEDIA_TAKKEN = Object.freeze([
  { waarde: 'tekst', kort: 'T', naam: 'Tekst' },
  { waarde: 'video', kort: 'V', naam: 'Video' },
  { waarde: 'spel', kort: 'S', naam: 'Spel' },
]);
/** Rijen van de takken in één kolom: boven (-1), op (0) en onder (1) de hoofdlijn. */
export const RIJEN = Object.freeze({ 1: [0], 2: [-1, 1], 3: [-1, 0, 1] });
// Dezelfde sleutel als routeSleutel in js/media.js. media.js zelf laadt hier niet: te zwaar voor elke pagina (PF-4).
const mediaSleutel = (n) => `media:route:${n}`;
const STAND_TEKST = Object.freeze({ af: 'afgerond', hier: 'je bent hier', open: 'open' });
const stand3 = (af, hier) => (hier ? 'hier' : af ? 'af' : 'open');

/** Het leerblok waar de student het laatst werkte: de jongste `positie:N`; zonder positie leerblok 1 (SX-18). `afgesloten`: alle taken klaar. */
export function laatsteLeerblok(store) {
  let laatste = null;
  for (const n of [1, 2, 3, 4]) {
    const p = store.getMeta(`positie:${n}`);
    if (p?.bijgewerkt && (!laatste || p.bijgewerkt > laatste.bijgewerkt)) laatste = { leerblok: n, taak: p.taak ?? null, stap: p.stap ?? null, afgesloten: p.afgesloten === true, bijgewerkt: p.bijgewerkt };
  }
  return laatste ? { leerblok: laatste.leerblok, taak: laatste.taak, stap: laatste.stap, afgesloten: laatste.afgesloten } : { leerblok: 1, taak: null, stap: null, afgesloten: false };
}

/** Stand van één taak uit de opslag, zoals de taakkop hem berekent (js/leerblok.js, tekenVoortgang). */
export function taakStand(store, taak) {
  const toepassing = (taak.bewijsonderdeel ? store.get(taak.bewijsonderdeel)?.inhoud : store.getMeta(`invoer:${taak.id}`)) ?? {};
  const oefening = oefenModel(taak, store.getMeta(`oefening:${taak.id}`) ?? {});
  const stand = stapStand({
    gestart: isIngevuld(toepassing) || isIngevuld(oefening.invoer),
    geoefend: isIngevuld(oefening.invoer) || oefening.overgeslagen,
    oefeningAf: oefening.modelZichtbaar || oefening.overgeslagen,
    klaar: Boolean(store.getMeta(`klaar:${taak.id}`)?.op),
  });
  return { stand, toepassing, oefening: oefening.invoer };
}

/** De gekozen tak van een splitsing: eerst de toepassing, dan de oefening; een onbekende waarde telt als geen keuze. */
export function gekozenTak(spoor, toepassing = {}, oefening = {}) {
  for (const w of [toepassing[spoor.veld], oefening[spoor.veld]]) if (spoor.takken.some((t) => t.waarde === w)) return w;
  return null;
}

/** Eén halte op de hoofdlijn. */
function enkel({ id, naam, href, af, hier }) {
  const stand = stand3(af, hier);
  return { id, rij: 0, href, stand, gestippeld: false, naam: `${naam}, ${STAND_TEKST[stand]}` };
}

/** Haltes van een kolom met takken. De ring „hier” staat op de gekozen tak, zonder keuze op de eerste. */
function takHaltes(takken, keuze, { id, naam, href, af, hier }) {
  const ring = hier ? (takken.find((t) => t.waarde === keuze) ?? takken[0]).waarde : null;
  return takken.map((t, i) => {
    const stand = stand3(af, t.waarde === ring);
    return {
      id: `${id}-${t.kort}`, rij: RIJEN[takken.length][i], label: t.kort, href, stand,
      gestippeld: keuze !== null && t.waarde !== keuze,
      naam: `${naam}, ${t.naam ?? t.waarde}${t.waarde === keuze ? ' (gekozen)' : ''}, ${STAND_TEKST[stand]}`,
    };
  });
}

/**
 * Het model van de kaart voor één leerblok.
 * @param {object} p
 * @param {object} p.blok genormaliseerde leerblokdata (normaliseerBlok)
 * @param {{getMeta: Function, get: Function}} p.store
 * @param {{soort: 'overzicht'|'afsluiten'|'taak'|'elders', taak?: string|null, stap?: number|null}} p.adres
 *   `elders`: start, dossier of bronnen, met de laatste positie (laatsteLeerblok)
 */
export function metroModel({ blok, store, adres }) {
  const n = blok.leerblok;
  const pagina = `leerblok-${n}.html`;
  const ids = blok.taken.map((t) => t.id);
  const standen = new Map(blok.taken.map((t) => [t.id, taakStand(store, t)]));
  const gestart = [...standen.values()].some((s) => s.stand.stappen[0].stand === 'voltooid');
  const ev = (blok.bewijsonderdelen ?? []).map((e) => e.id);
  const afgerond = isAfgerond(ev, leesRecords(store, ev)).afgerond;
  const bewaard = store.getMeta(mediaSleutel(n));
  const route = MEDIA_TAKKEN.some((t) => t.waarde === bewaard) ? bewaard : 'tekst';
  const verdiepingGedaan = store.getMeta(`verdieping:${n}`)?.gedaan === true;
  const open = adres.soort === 'taak' && ids.includes(adres.taak) ? adres.taak : null;
  const elders = adres.soort === 'elders' && ids.includes(adres.taak) ? adres.taak : null;
  const kolommen = [];

  const eindHier = adres.soort === 'afsluiten' || (adres.soort === 'elders' && !elders && adres.afgesloten === true);
  const beginHier = !eindHier && (adres.soort === 'overzicht' || (adres.soort === 'elders' && !elders) || (adres.soort === 'taak' && !open));
  kolommen.push({ soort: 'begin', label: n === 1 ? 'Start' : 'Vorige keer', spoor: null, overstap: n > 1 ? n - 1 : null, haltes: [{
    id: 'begin', rij: 0, href: n === 1 ? 'index.html' : `${pagina}#overzicht`, stand: stand3(gestart, beginHier), gestippeld: false,
    naam: `${n === 1 ? 'Start' : `Vorige keer, overstap van leerblok ${n - 1}`}, ${beginHier ? STAND_TEKST.hier : gestart ? 'geweest' : 'open'}`,
  }] });

  for (const t of blok.taken) {
    const { stand, toepassing, oefening } = standen.get(t.id);
    const keuze = t.spoor ? gekozenTak(t.spoor, toepassing, oefening) : null;
    if (t.id === open) {
      const hierStap = adres.stap ?? stand.actief + 1;
      STAP_SLUGS.forEach((slug, j) => {
        const opSpoor = Boolean(t.spoor?.stappen.includes(slug));
        const media = !opSpoor && slug === 'stof' && blok.media?.taak === t.id;
        const takken = opSpoor ? t.spoor.takken : media ? MEDIA_TAKKEN : null;
        const kern = {
          id: `${t.id}-${slug}`, naam: `Taak ${t.id}, stap ${j + 1} van 4: ${STAP_NAMEN[j]}`,
          href: `${pagina}${maakAdres(t.id, j + 1)}`, af: stand.stappen[j].stand === 'voltooid', hier: j + 1 === hierStap,
        };
        kolommen.push({ soort: 'stap', taak: t.id, label: STAP_KORT[j], spoor: opSpoor ? `${t.id}:spoor` : media ? `${t.id}:media` : null,
          haltes: takken ? takHaltes(takken, media ? route : keuze, kern) : [enkel(kern)] });
      });
    } else {
      const kern = { id: t.id, naam: `Taak ${t.id}: ${t.titel}`, href: `${pagina}#taak-${t.id}`, af: stand.klaar, hier: t.id === elders };
      kolommen.push({ soort: 'taak', taak: t.id, label: t.id, spoor: t.spoor ? `${t.id}:spoor` : null,
        haltes: t.spoor ? takHaltes(t.spoor.takken, keuze, kern) : [enkel(kern)] });
    }
    // De verdieping is een zijtak, geen halte op de hoofdlijn (TK-13, TK-14): het doorgaande spoor loopt ernaast.
    if (blok.verdieping?.na === t.id) {
      kolommen.push({ soort: 'verdieping', label: '', spoor: null, haltes: [
        { id: 'doorgang', rij: 0, doorgang: true, gestippeld: false },
        { id: 'verdieping', rij: 1, label: '+', href: `${pagina}${maakAdres(t.id, 4)}`, stand: verdiepingGedaan ? 'af' : 'open',
          gestippeld: !verdiepingGedaan, naam: `Verdieping na taak ${t.id}, optioneel, ${verdiepingGedaan ? 'gedaan' : 'open'}` }] });
    }
  }

  kolommen.push({ soort: 'eind', label: n < 4 ? 'Afsluiten' : 'Dossier', spoor: null, overstap: n < 4 ? n + 1 : null, haltes: [{
    id: 'eind', rij: 0, href: n < 4 ? `${pagina}#afsluiten` : 'dossier.html', stand: stand3(afgerond, eindHier), gestippeld: false,
    naam: `${n < 4 ? `Afsluiten, overstap naar leerblok ${n + 1}` : 'Dossier, einde van de e-learning'}, ${eindHier ? STAND_TEKST.hier : afgerond ? 'leerblok afgerond' : 'open'}`,
  }] });

  const taakNr = open ? ids.indexOf(open) + 1 : null;
  const label = open ? segmentLabel(taakNr, ids.length, standen.get(open).stand) : `Leerblok ${n}: ${blok.titel}`;
  const tekst = open ? `Leerblok ${n} · taak ${taakNr} van ${ids.length} · stap ${adres.stap ?? standen.get(open).stand.actief + 1} van 4`
    : eindHier ? `Leerblok ${n} · ${adres.soort === 'afsluiten' ? 'afsluiten' : 'afgesloten'}`
      : elders ? `Leerblok ${n} · laatst bij taak ${elders}`
        : `Leerblok ${n} · ${blok.titel}`;
  return { leerblok: n, kolommen, label, tekst };
}
