// Voortgang zichtbaar maken (SX-4, SX-5, SX-12; DESIGN §5 en §6): de stappen van een taak, de „klaar als"-checklist en
// A3-vak 1 in vier delen. Puur: geen DOM, geen opslag, geen netwerk. Geen scores of percentages (BW-4, X-3).

/** A3-vak 1 in vier delen, één per leerblok (ADR B75, B81). */
export const A3_DELEN = Object.freeze([
  { leerblok: 1, label: 'Onderzoeksvraag en zoekvragen' },
  { leerblok: 2, label: 'Bronnen' },
  { leerblok: 3, label: 'Plaatsing' },
  { leerblok: 4, label: 'Verbanden en reflectie' },
]);

/**
 * Welke delen van A3-vak 1 gevuld zijn: een deel is gevuld als het leerblok is afgerond (TK-16).
 * @param {Object<number, boolean>} afgerond leerbloknummer → afgerond
 * @param {number|null} nieuw het leerblok dat zojuist is afgerond (afsluitscherm), om dat deel te markeren
 * @param {Object<number, [number, number]>} bezig per leerblok [resultaten die meetellen, totaal]: een deel in opbouw
 */
export function a3Stand(afgerond = {}, nieuw = null, bezig = {}) {
  const delen = A3_DELEN.map((d) => {
    const gevuld = afgerond[d.leerblok] === true;
    const [n, m] = bezig[d.leerblok] ?? [0, 0];
    return { ...d, gevuld, nieuw: d.leerblok === nieuw, opbouw: !gevuld && n > 0 ? `${n} van ${m} resultaten` : '' };
  });
  const aantal = delen.filter((d) => d.gevuld).length;
  return {
    delen,
    aantal,
    tekst: aantal === 4 ? 'Je A3-vak 1 staat.' : `${aantal} van de 4 delen van je A3-vak 1 staan.`,
  };
}

/** Een controle telt als gehaald bij `ok`; een controle van soort C ook bij `let op` (die maakt het hoogstens Bijna). */
const gehaald = (u) => u.resultaat === 'ok' || (u.soort === 'C' && u.resultaat === 'let op');

/**
 * De „klaar als"-regel als checklist (SX-5). Elk criterium is een letterlijk stuk van de werkboekregel (TK-2) met de
 * controles die erbij horen. Zonder controles vinkt de student het criterium zelf af.
 * @param {{klaarAls: {tekst: string, criteria?: {tekst: string, controles: string[]}[]}}} taak
 * @param {{id: string, soort: string, resultaat: string}[]} uitkomsten uit sessie.beoordeel
 * @param {number[]} zelf indexen van de criteria die de student zelf heeft afgevinkt
 * @returns {{tekst: string, zelf: boolean, afgevinkt: boolean}[]}
 */
export function klaarAlsLijst(taak, uitkomsten = [], zelf = []) {
  const criteria = taak.klaarAls?.criteria ?? [{ tekst: taak.klaarAls?.tekst ?? '', controles: [] }];
  const perId = new Map(uitkomsten.map((u) => [u.id, u]));
  return criteria.map((c, i) => {
    const eigen = c.controles.length === 0;
    const afgevinkt = eigen ? zelf.includes(i) : c.controles.every((id) => perId.has(id) && gehaald(perId.get(id)));
    return { tekst: c.tekst, zelf: eigen, afgevinkt };
  });
}

/** De vier stappen van een taak (TK-18, ADR B76). */
export const STAP_NAMEN = Object.freeze(['Waarom', 'Stof', 'Oefenen', 'Toepassen']);

/**
 * Waar de student in een taak staat, voor de segmentbalk (SX-4): per stap voltooid, actief of open.
 * @param {{gestart?: boolean, geoefend?: boolean, oefeningAf?: boolean, klaar?: boolean, bezocht?: number}} s
 *   gestart: iets ingevuld in oefening of toepassing; geoefend: iets in de oefening of overgeslagen;
 *   oefeningAf: modelantwoord gezien of overgeslagen; klaar: „klaar" gedrukt; bezocht: hoogste stap die de student opende (0–3)
 */
export function stapStand({ gestart = false, geoefend = false, oefeningAf = false, klaar = false, bezocht = 0 } = {}) {
  const voltooid = [gestart || bezocht >= 1, geoefend || gestart || bezocht >= 2, oefeningAf, klaar];
  for (let i = 1; i < 4; i += 1) if (voltooid[i]) for (let j = 0; j < i; j += 1) voltooid[j] = true;
  const actief = voltooid.indexOf(false);
  return {
    stappen: STAP_NAMEN.map((naam, i) => ({ naam, stand: voltooid[i] ? 'voltooid' : i === actief ? 'actief' : 'open' })),
    actief: actief === -1 ? 3 : actief,
    klaar: actief === -1,
  };
}

/** Tekstalternatief van de segmentbalk (SX-4). */
export const segmentLabel = (taakNr, aantalTaken, stand) =>
  `Taak ${taakNr} van ${aantalTaken}, ${stand.klaar ? 'klaar' : `stap ${stand.actief + 1} van 4`}`;
