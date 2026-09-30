// Spellen en simulaties (MD-8…MD-11, MD-13, MD-15): alleen logica, geen DOM, geen netwerk en geen opslag. Een spel leest zijn
// data (spellen/<id>.json) en geeft feedback; het schrijft nooit iets weg. Daarom importeert dit bestand `store.js` niet,
// en `spel.js` evenmin (tests/media.test.mjs controleert dat, MD-11). De controle van de spelbestanden staat in tools/spel-check.mjs.
//
// Vier soorten (veld `type` in de data):
//   "kaarten"    Bronnen-detective: kaarten met gegevens om te onderzoeken, drie opties met feedback per optie, en het AAOCC-oordeel.
//   "simulatie"  Waarde-simulator: per beslissing een optie kiezen, het effect op de zes kapitalen voorspellen en het effect zien.
//   "rondes"     Vraagslijper: per ronde een vage vraag en per veld van het user-story-format een keuze met feedback.
//   "radar"      Stakeholder-radar: per stakeholder invloed en belang kiezen, dan het raster zien en twee vragen beantwoorden.
// Geen score, geen ranglijst en geen punten (MD-10): feedback is tekst per keuze. Alles wat verzonnen is heeft `fictief: true` (MD-15).

export const KAPITALEN = Object.freeze(['financieel', 'productie', 'intellectueel', 'menselijk', 'sociaal en relationeel', 'natuurlijk']);
export const TERMIJNEN = Object.freeze(['korte termijn', 'middellange termijn', 'lange termijn']);
export const EFFECT_TEKST = Object.freeze({ geen: 'geen effect', input: 'input', plus: 'uitkomst plus', min: 'uitkomst min' });
export const SOORTEN = Object.freeze(['kaarten', 'simulatie', 'rondes', 'radar']);
export const AAOCC = Object.freeze(['Authority', 'Accuracy', 'Objectivity', 'Currency', 'Coverage']);

/** Hoogstens vijf minuten (MD-8). De tijden per onderdeel komen uit de meting van fase 13 (13.4, leestempo 240 woorden per minuut); zie het bouwplan. */
export const MAX_SECONDEN = 300;
export const SECONDEN_PER_KAART = 50; // gemeten in fase 13 (13.4): 6 kaarten ongeveer 300 s
export const SECONDEN_PER_BESLISSING = 100;
export const SECONDEN_PER_RONDE = 85; // Vraagslijper: een vage vraag lezen en drie keuzes met feedback
export const SECONDEN_PER_STAKEHOLDER = 35; // Stakeholder-radar: een stakeholder lezen en twee keuzes
export const SECONDEN_PER_SLOTVRAAG = 35;

/** Geschatte duur in seconden (bovengrens): aantal kaarten of beslissingen maal de tijd per onderdeel. */
export function geschatteSeconden(spel) {
  if (spel?.type === 'kaarten') return (spel.kaarten ?? []).length * SECONDEN_PER_KAART;
  if (spel?.type === 'simulatie') return (spel.beslissingen ?? []).length * SECONDEN_PER_BESLISSING;
  if (spel?.type === 'rondes') return (spel.rondes ?? []).length * SECONDEN_PER_RONDE;
  if (spel?.type === 'radar') return (spel.rondes ?? []).length * SECONDEN_PER_STAKEHOLDER + (spel.slotVragen ?? []).length * SECONDEN_PER_SLOTVRAAG;
  return Infinity;
}

// ---------------------------------------------------------------- Bronnen-detective

/** De feedback bij een gekozen optie van een kaart, en of die optie het best past (geen score: alleen tekst). */
export function beoordeelKaart(kaart, optieId) {
  const optie = kaart.opties.find((o) => o.id === optieId);
  if (!optie) throw new Error(`Kaart ${kaart.id}: onbekende optie ${optieId}`);
  return { feedback: optie.feedback, passend: optie.passend === true, kernpunt: kaart.kernpunt, aaocc: kaart.aaocc };
}

// ---------------------------------------------------------------- Waarde-simulator

/** Het effect van een gekozen optie op alle zes de kapitalen: [{ kapitaal, termijn: [kort, middel, lang], toelichting? }]. */
export function effectVan(beslissing, optieId) {
  const optie = beslissing.opties.find((o) => o.id === optieId);
  if (!optie) throw new Error(`Beslissing ${beslissing.id}: onbekende optie ${optieId}`);
  return KAPITALEN.map((kapitaal) => {
    const e = optie.effect?.[kapitaal];
    return { kapitaal, termijn: e ? [...e.termijn] : ['geen', 'geen', 'geen'], toelichting: e?.toelichting ?? null };
  });
}

/**
 * Vergelijkt de voorspelling (per kapitaal geen, input, plus of min, voor de lange termijn) met het effect. Geeft per kapitaal
 * wat er voorspeld is, wat er gebeurt, of dat gelijk is en de toelichting. Er komt geen totaal of percentage uit (MD-10).
 */
export function vergelijkVoorspelling(beslissing, optieId, voorspelling) {
  return effectVan(beslissing, optieId).map((e) => {
    const werkelijk = e.termijn[2];
    const voorspeld = voorspelling?.[e.kapitaal] ?? null;
    return { kapitaal: e.kapitaal, voorspeld, werkelijk, gelijk: voorspeld === werkelijk, termijn: e.termijn, toelichting: e.toelichting };
  });
}

/** Is de voorspelling volledig (voor elk kapitaal een keuze)? Pas dan toont het spel het effect. */
export const voorspellingVolledig = (voorspelling) => KAPITALEN.every((k) => Boolean(voorspelling?.[k]));

const RICHTING = { plus: 1, min: -1 };
/** Kapitalen waar het effect op korte en lange termijn tegengesteld is (plus tegen min): de spanning in de tijd. */
export function spanningen(effect) {
  return effect.filter((e) => RICHTING[e.termijn[0]] && RICHTING[e.termijn[2]] && RICHTING[e.termijn[0]] !== RICHTING[e.termijn[2]]).map((e) => e.kapitaal);
}
/** Kapitalen die op de lange termijn afnemen terwijl een ander kapitaal groeit: de kant die ten koste gaat. */
export const kostenKant = (effect) => effect.filter((e) => e.termijn[2] === 'min').map((e) => e.kapitaal);

/** De regel onder een effect: waar het kantelt en wie of wat afneemt. Alleen tekst, geen oordeel. */
export function spanningTekst(effect) {
  const kantelt = spanningen(effect);
  const neemtAf = kostenKant(effect);
  const delen = [];
  if (kantelt.length) delen.push(`Het effect kantelt in de tijd bij: ${kantelt.join(', ')}.`);
  if (neemtAf.length) delen.push(`Op lange termijn neemt af: ${neemtAf.join(', ')}.`);
  return delen.length ? delen.join(' ') : 'Bij deze keuze verandert geen enkel kapitaal van richting en neemt er op lange termijn niets af.';
}

// ---------------------------------------------------------------- Vraagslijper

/** De feedback bij een gekozen optie van een veld in een ronde of stakeholder (alleen tekst, geen score). */
export function beoordeelKeuze(opties, optieId) {
  const optie = opties.find((o) => o.id === optieId);
  if (!optie) throw new Error(`Onbekende optie ${optieId}`);
  return { feedback: optie.feedback, passend: optie.passend === true, tekst: optie.tekst };
}

/** De vraag die de speler heeft samengesteld: het format met de gekozen tekst per veld. Ontbreekt een keuze, dan blijft {veld} staan. */
export function stelVraagSamen(spel, ronde, keuzes) {
  return spel.format.replace(/\{(\w+)\}/g, (los, id) => {
    const optie = ronde.keuzes[id]?.find((o) => o.id === keuzes?.[id]);
    return optie ? optie.tekst : los;
  });
}

// ---------------------------------------------------------------- Stakeholder-radar

/** In welk vak van het raster hoort een stakeholder bij deze invloed en dit belang? */
export const vakVoor = (spel, invloed, belang) => spel.vakken.find((v) => v.invloed === invloed && v.belang === belang);

/** Het raster van de speler: per vak de stakeholders die hij daar plaatste. Stakeholders zonder volledige keuze ontbreken. */
export function rasterVan(spel, plaatsing) {
  return spel.vakken.map((v) => ({
    ...v, stakeholders: spel.rondes.filter((r) => plaatsing?.[r.id]?.invloed === v.invloed && plaatsing?.[r.id]?.belang === v.belang).map((r) => r.titel),
  }));
}

// ---------------------------------------------------------------- tekstversie (MD-9)

/**
 * De tekstversie van een spel: alle kaarten of beslissingen met opties en feedback als gewone tekst, zodat het ook zonder spelen
 * te lezen is. Geeft [{ kop, regels: [tekst] }].
 */
export function tekstversie(spel) {
  if (spel.type === 'kaarten') {
    return spel.kaarten.map((k) => ({
      kop: `${k.titel} (fictief)`,
      regels: [
        `${k.soort}, ${k.auteur}, ${k.jaar}. ${k.uitgever}.`, k.samenvatting,
        ...k.gegevens.map((g) => `${g.label}: ${g.tekst}`),
        ...k.opties.map((o) => `Keuze: ${o.tekst}. ${o.feedback}`),
        ...AAOCC.map((c) => `${c}: ${k.aaocc[c]}`), k.kernpunt,
      ],
    }));
  }
  if (spel.type === 'rondes') {
    return spel.rondes.map((r) => ({
      kop: `${r.titel} (fictief)`,
      regels: [`Vage vraag: ${r.vageVraag}`, r.situatie, `Format: ${spel.format}`,
        ...spel.velden.flatMap((v) => r.keuzes[v.id].map((o) => `${v.label} Keuze: ${o.tekst}. ${o.feedback}`))],
    }));
  }
  if (spel.type === 'radar') {
    return [
      ...spel.rondes.map((r) => ({
        kop: `${r.titel} (${r.soort}, fictief)`,
        regels: [r.situatie, ...r.velden.flatMap((v) => v.opties.map((o) => `${v.label} Keuze: ${o.tekst}. ${o.feedback}`))],
      })),
      ...spel.slotVragen.map((q) => ({ kop: q.label, regels: q.opties.map((o) => `Keuze: ${o.tekst}. ${o.feedback}`) })),
    ];
  }
  return spel.beslissingen.map((b) => ({
    kop: `${b.titel} (fictief)`,
    regels: [
      b.situatie,
      ...b.opties.flatMap((o) => [
        `Keuze: ${o.tekst}. ${o.feedback}`,
        ...effectVan(b, o.id).filter((e) => e.termijn.some((t) => t !== 'geen')).map((e) => `${e.kapitaal}: ${e.termijn.map((t, i) => `${TERMIJNEN[i]} ${EFFECT_TEKST[t]}`).join(', ')}. ${e.toelichting ?? ''}`.trim()),
      ]),
    ],
  }));
}
