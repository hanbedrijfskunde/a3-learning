// Weergavemodellen van de docentmodus (DM-2, DM-3, DM-7, DM-8, DM-10, DM-11, DM-14): gewone objecten, geen DOM.
// De docentvelden staan in data/docent-deelN.json; taak, klaar-als en modelantwoorden komen uit dezelfde
// data/leerblok-N.json als de studentweergave (DM-2), zodat een wijziging daar in beide weergaven verschijnt.
import { waardeTekst } from '../weergave.js';

/** De taak `taakId` uit de geladen leerblokken (`blokken`: leerblok-nummer naar inhoud), of null. */
export const taakUit = (blokken, leerblok, taakId) => blokken?.[leerblok]?.taken?.find((t) => t.id === taakId) ?? null;

const tekstVan = (x) => (typeof x === 'string' ? x : x?.tekst ?? '');
const velden = (taak) => taak?.oefening?.velden ?? taak?.toepassing?.velden ?? [];

/** Het klaar-als van een onderdeel: uit de taak als er een is, anders uit het docentbestand. */
export function klaarAlsVan(o, blokken) {
  return tekstVan(taakUit(blokken, o.leerblok, o.taak)?.klaarAls) || tekstVan(o.klaarAls);
}

const laptopTekst = (l) => (l === 'open' ? 'Laptop open' : 'Laptop dicht');
const diaTekst = (d) => (d ? `Dia ${d}` : 'Geen dia');

/** De stapkaart (DM-3): precies zeven elementen. `minuten` is de tijd na eventueel aanpassen. */
export function stapkaartModel(o, blokken, { minuten = o.minuten } = {}) {
  return {
    taaknummer: o.taak ? `Taak ${o.taak}` : 'Geen taak',
    opdracht: tekstVan(o.opdracht),
    klaarAls: klaarAlsVan(o, blokken) ? `Klaar als ${klaarAlsVan(o, blokken)}` : 'Klaar als: uitleg, geen opdracht',
    tijd: `Richttijd ${minuten} min`,
    materiaal: o.materiaal?.length ? `Materiaal: ${o.materiaal.join('; ')}` : 'Materiaal: geen',
    dia: diaTekst(o.dia),
    laptop: laptopTekst(o.laptop),
  };
}

/**
 * Het modelantwoord van de taak als lijst { label, antwoord }, met de labels van de oefenvelden.
 * Geeft een lege lijst als het onderdeel geen taak of geen modelantwoord heeft.
 */
export function modelantwoorden(o, blokken) {
  const taak = taakUit(blokken, o.leerblok, o.taak);
  const m = taak?.modelantwoord;
  if (!m) return [];
  const labels = Object.fromEntries(velden(taak).map((v) => [v.id, v.label]));
  const lijst = m.velden ? Object.entries(m.velden).map(([id, w]) => ({ label: labels[id] ?? id, antwoord: waardeTekst(w) })) : [{ label: '', antwoord: tekstVan(m) }];
  return lijst.filter((r) => r.antwoord !== '');
}

/**
 * De docentkaart (DM-7): vier elementen. Modelantwoorden en veelgemaakte fouten zitten er alleen in als de docent
 * ze heeft geopend (DM-8); ervoor zit er niets van in het model, dus ook niet in de pagina.
 */
export function docentkaartModel(o, blokken, { geopend = false } = {}) {
  const antwoorden = modelantwoorden(o, blokken);
  const fouten = o.veelgemaakteFouten ?? [];
  return {
    watDocentDoet: o.watDocentDoet,
    kernboodschap: o.kernboodschap,
    rondloopvragen: o.rondloopvragen ?? [],
    alsHetAndersLoopt: o.alsHetAndersLoopt ?? [],
    heeftModel: antwoorden.length > 0 || fouten.length > 0,
    modelantwoorden: geopend ? antwoorden : null,
    veelgemaakteFouten: geopend ? fouten : null,
  };
}

/** 0 → "0:00", 65 → "1:05": een klokstand binnen het deel. */
export const deelTijd = (minuten) => `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, '0')}`;

/** "09:30" + 95 → "11:05"; een ongeldige begintijd geeft null. */
export function tijdBijBegin(begintijd, plusMinuten) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(begintijd ?? '').trim());
  if (!m) return null;
  const totaal = (Number(m[1]) * 60 + Number(m[2]) + plusMinuten) % 1440;
  return `${String(Math.floor(totaal / 60)).padStart(2, '0')}:${String(totaal % 60).padStart(2, '0')}`;
}

const STATUS_TEKST = { gedaan: 'Klaar', overgeslagen: 'Overgeslagen', gepland: 'Komt', actief: 'Nu bezig' };

/**
 * Het programmaoverzicht van een deel (DM-10): per onderdeel wat klaar is, wat nu is en wat komt, met de tijd binnen
 * het deel en, als de docent de begintijd heeft ingevuld, de tijd uit het rooster. Volgorde en tijden van de klok.
 */
export function programmaModel(deel, toestand, begintijd) {
  const perId = Object.fromEntries(deel.onderdelen.map((o) => [o.id, o]));
  let som = 0;
  return toestand.onderdelen.map((p) => {
    const rij = {
      id: p.id, titel: perId[p.id].titel, minuten: p.minuten, status: p.actief ? 'actief' : p.status,
      statusTekst: STATUS_TEKST[p.actief ? 'actief' : p.status],
      inDeel: deelTijd(som), rooster: tijdBijBegin(begintijd, som),
    };
    if (p.status !== 'overgeslagen') som += p.minuten;
    return rij;
  });
}

/**
 * De afdruk van een deel als draaiboek (DM-11): alle onderdelen in de volgorde van het bestand, met tijd, stapkaart en
 * docentkaart. Modelantwoorden en veelgemaakte fouten staan er alleen in als de docent daarom vraagt (DM-8).
 */
export function draaiboekModel(deel, blokken, { metModel = false } = {}) {
  let som = 0;
  const rijen = deel.onderdelen.map((o) => {
    const rij = {
      id: o.id, titel: o.titel, start: deelTijd(som), minuten: o.minuten,
      stapkaart: stapkaartModel(o, blokken),
      kaart: docentkaartModel(o, blokken, { geopend: metModel }),
    };
    som += o.minuten;
    return rij;
  });
  return { titel: deel.titel, duurMinuten: deel.duurMinuten, afsluiting: deel.afsluiting ?? '', rijen };
}

/** De terugblik-kaarten (DM-14): per leerblok de items en vragen uit data/terugblik.json (LRD 8.5). */
export function terugblikKaarten(terugblik) {
  return (terugblik?.kaarten ?? []).map((k) => ({
    leerblok: k.leerblok, vorig: k.vorig, items: k.items, kennisvragen: k.kennisvragen, transfervraag: k.transfervraag,
  }));
}
