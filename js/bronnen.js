// Bronnen (BR-1…BR-5): laden, sorteren, in-tekstverwijzingen. Puur: geen DOM, zodat Node (content-check, tests) en de
// browser (bronnen.html, leerblokpagina's) dezelfde regels gebruiken.
//
// Formaat van data/bronnen-N.json (formaat 1.0):
//   { "formaat": "1.0", "leerblok": N,
//     "bronnen":        [ bron, … ]   bronnen die in de contentbestanden worden geciteerd; ze staan op de bronnenpagina
//     "wachtOpCitatie": [ bron, … ]   bronnen uit het LRD die nog nergens worden geciteerd (BR-5 telt ze niet als wees)
//   }
// Een bron: { id, citatie: "Auteur, jaar", apa: "APA-regel met *cursief*", type, link?, fictief?, organisatie?, bedoeldVoor? }
//   citatie   de sleutel van de in-tekstverwijzing (Auteur, jaar), zoals die in de tekst tussen haakjes staat
//   apa       de volledige APA-vermelding zonder link; tekst tussen sterretjes wordt cursief (titel of tijdschrift met jaargang)
//   link      een https://-URL of DOI-link; ontbreekt als er geen openbare publicatie is (BR-2, BR-3)
//   fictief   waar bij een verzonnen bron voor een oefening of spelkaart (MD-15)

export const MANIFEST = 'data/bronnen.json';

/** Een in-tekstverwijzing: (Auteur, 2019), (Auteur & Ander, 2019a), (Organisatie, z.d.) of (Organisatie, z.d.-a). */
export const CITATIE_RE = /\((\p{Lu}[^(),;]*?), (\d{4}[a-z]?|z\.d\.(?:-[a-z])?)\)/gu;

/** Sorteersleutel van een APA-regel: zonder sterretjes, accenten, hoofdletters en leestekens. */
export function sleutelVan(bron) {
  return String(bron.apa).replace(/\*/g, '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Alfabetisch op de APA-regel (BR-1): auteur, dan jaar. */
export function sorteerBronnen(lijst) {
  return [...lijst].sort((a, b) => {
    const x = sleutelVan(a);
    const y = sleutelVan(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Is de lijst al alfabetisch? Geeft de eerste twee bronnen die in de verkeerde volgorde staan, of null. */
export function eersteVolgordefout(lijst) {
  for (let i = 1; i < lijst.length; i += 1) {
    if (sleutelVan(lijst[i - 1]) > sleutelVan(lijst[i])) return [lijst[i - 1], lijst[i]];
  }
  return null;
}

/** De APA-regel als stukken { tekst, cursief } (tekst tussen sterretjes is cursief). */
export function apaDelen(apa) {
  return String(apa).split('*').map((tekst, i) => ({ tekst, cursief: i % 2 === 1 })).filter((d) => d.tekst !== '');
}

/** Alle in-tekstverwijzingen in een tekst: [{ citatie, tekst, start, einde }]. */
export function vindCitaties(tekst) {
  return [...String(tekst).matchAll(CITATIE_RE)].map((m) => ({
    citatie: `${m[1]}, ${m[2]}`, tekst: m[0], start: m.index, einde: m.index + m[0].length,
  }));
}

/** De sprong van een in-tekstverwijzing naar de bronregel (BR-4). */
export const bronHref = (id) => `bronnen.html#bron-${id}`;
export const bronAnkerId = (id) => `bron-${id}`;

/**
 * Splitst een tekst in stukken: gewone tekst of een verwijzing die bij een bekende bron hoort.
 * @param {string} tekst
 * @param {Map<string, object>} index citatie → bron (zie `maakIndex`)
 * @returns {({tekst: string}|{tekst: string, id: string, href: string})[]}
 */
export function splitsMetVerwijzingen(tekst, index) {
  const uit = [];
  let positie = 0;
  for (const c of vindCitaties(tekst)) {
    const bron = index.get(c.citatie);
    if (!bron) continue;
    if (c.start > positie) uit.push({ tekst: tekst.slice(positie, c.start) });
    uit.push({ tekst: c.tekst, id: bron.id, href: bronHref(bron.id) });
    positie = c.einde;
  }
  if (positie < tekst.length) uit.push({ tekst: tekst.slice(positie) });
  return uit.length > 0 ? uit : [{ tekst }];
}

/** Index citatie → bron over alle bronnen die op de pagina staan. */
export const maakIndex = (bronnen) => new Map(bronnen.map((b) => [b.citatie, b]));

/**
 * Weergavemodel van de bronnenpagina (BR-1…BR-3): alle bronnen, alfabetisch, met de APA-delen, de link en de aanduidingen.
 * @param {object[]} bestanden inhoud van de bronbestanden
 */
export function bouwBronnenModel(bestanden) {
  const bronnen = bestanden.flatMap((b) => b.bronnen ?? []);
  return sorteerBronnen(bronnen).map((b) => ({
    id: b.id,
    ankerId: bronAnkerId(b.id),
    citatie: b.citatie,
    delen: apaDelen(b.apa),
    link: b.link ?? null,
    fictief: b.fictief === true,
    ongepubliceerd: b.type === 'ongepubliceerd',
  }));
}

/**
 * Laadt het manifest en de bronbestanden die daarin staan.
 * @param {(url: string) => Promise<{ok: boolean, json: () => Promise<any>}>} haal `fetch` of een dubbelganger
 * @param {string} [basis] voorvoegsel voor de paden (standaard leeg: relatief aan de pagina)
 */
export async function laadBronnen(haal, basis = '') {
  const lees = async (pad) => {
    const r = await haal(`${basis}${pad}`);
    if (!r.ok) throw new Error(`${pad} kon niet worden geladen`);
    return r.json();
  };
  const manifest = await lees(MANIFEST);
  return Promise.all(manifest.bestanden.map((naam) => lees(`data/${naam}`)));
}
