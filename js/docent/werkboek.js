// Het werkboek van een deel als afdruk (DM-12): gewone objecten uit dezelfde data/leerblok-N.json als de leerblokpagina's,
// dus met dezelfde taaknummers en dezelfde „klaar als”-regels. Geen DOM; de pagina zit in pagina.js.
const tekstVan = (x) => (typeof x === 'string' ? x : x?.tekst ?? '');

/** De leerblokken die een deel raakt, op volgorde van eerste voorkomen in het docentbestand. */
export const leerblokkenVan = (deel) => [...new Set(deel.onderdelen.map((o) => o.leerblok).filter(Boolean))];

/**
 * Alle taken van de leerblokken van dit deel, in de volgorde van de leerblokbestanden.
 * `blokken` is een object van leerblok-nummer naar inhoud, zoals de docentmodus het laadt.
 */
export function werkboekModel(deel, blokken) {
  const taken = leerblokkenVan(deel).flatMap((n) => (blokken[n]?.taken ?? []).map((t) => ({
    leerblok: n,
    nummer: t.id,
    titel: t.titel,
    vorm: t.vorm,
    tijd: tekstVan(t.richttijd),
    waarom: tekstVan(t.waarom),
    klaarAls: tekstVan(t.klaarAls),
    opdracht: tekstVan(t.toepassing?.opdracht) || tekstVan(t.oefening?.opdracht),
  })));
  return { titel: deel.titel, taken };
}
