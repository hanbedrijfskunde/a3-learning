// Spellen en simulaties (MD-8…MD-11, MD-13, MD-15): alleen logica, geen DOM, geen netwerk en geen opslag. Een spel leest zijn
// data (spellen/<id>.json) en geeft feedback; het schrijft nooit iets weg. Daarom importeert dit bestand `store.js` niet,
// en `spel.js` evenmin (tests/media.test.mjs controleert dat, MD-11).
//
// Twee soorten (veld `type` in de data):
//   "kaarten"    Bronnen-detective: kaarten met gegevens om te onderzoeken, drie opties met feedback per optie, en het AAOCC-oordeel.
//   "simulatie"  Waarde-simulator: per beslissing een optie kiezen, het effect op de zes kapitalen voorspellen en het effect zien.
// Geen score, geen ranglijst en geen punten (MD-10): feedback is tekst per keuze. Alles wat verzonnen is heeft `fictief: true` (MD-15).

export const KAPITALEN = Object.freeze(['financieel', 'productie', 'intellectueel', 'menselijk', 'sociaal en relationeel', 'natuurlijk']);
export const TERMIJNEN = Object.freeze(['korte termijn', 'middellange termijn', 'lange termijn']);
export const EFFECT_TEKST = Object.freeze({ geen: 'geen effect', input: 'input', plus: 'uitkomst plus', min: 'uitkomst min' });
export const AAOCC = Object.freeze(['Authority', 'Accuracy', 'Objectivity', 'Currency', 'Coverage']);

/** Hoogstens vijf minuten (MD-8). De schatting is een bovengrens per onderdeel; de echte tijden meet fase 13 (13.4). */
export const MAX_SECONDEN = 300;
export const SECONDEN_PER_KAART = 40;
export const SECONDEN_PER_BESLISSING = 90;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const gevuld = (t) => typeof t === 'string' && t.trim() !== '';
/** Sleutels die op een score, punten of ranglijst wijzen (MD-10); ze komen in geen enkel spel voor. */
const SCORE_SLEUTEL = /^(score|scores|punten|ranglijst|highscore|niveau|cijfer|goedAantal|aantalGoed)$/i;

/** Geschatte duur in seconden (bovengrens): aantal kaarten of beslissingen maal de tijd per onderdeel. */
export function geschatteSeconden(spel) {
  if (spel?.type === 'kaarten') return (spel.kaarten ?? []).length * SECONDEN_PER_KAART;
  if (spel?.type === 'simulatie') return (spel.beslissingen ?? []).length * SECONDEN_PER_BESLISSING;
  return Infinity;
}

/** Alle sleutels in de data, ook diep erin (voor de controle op scores en netwerkadressen). */
function sleutelsEnTeksten(x, uit = { sleutels: [], teksten: [] }) {
  if (typeof x === 'string') uit.teksten.push(x);
  else if (Array.isArray(x)) x.forEach((w) => sleutelsEnTeksten(w, uit));
  else if (isObject(x)) for (const [k, w] of Object.entries(x)) { uit.sleutels.push(k); sleutelsEnTeksten(w, uit); }
  return uit;
}

/**
 * Controleert een spel op de regels van het blueprint en geeft een lijst fouten.
 *   MD-8   hoogstens 5 minuten (geschat)
 *   MD-10  feedback bij elke keuze, geen score of ranglijst
 *   MD-13  werkt zonder netwerk: geen adressen in de data
 *   MD-15  elke kaart of beslissing is als fictief gemarkeerd, en het spel legt dat uit
 */
export function controleerSpel(spel, naam = spel?.id ?? 'spel') {
  const fouten = [];
  const fout = (t) => fouten.push(`${naam}: ${t}`);
  if (!isObject(spel)) return [`${naam}: geen object`];
  if (spel.formaat !== '1.0') fout('formaat moet "1.0" zijn');
  if (!gevuld(spel.id)) fout('mist een id');
  if (!['kaarten', 'simulatie'].includes(spel.type)) fout('type moet kaarten of simulatie zijn');
  if (!gevuld(spel.titel)) fout('mist een titel');
  if (!gevuld(spel.intro)) fout('mist een introductie');
  if (!gevuld(spel.fictiefUitleg) || !/verzonnen/i.test(spel.fictiefUitleg)) fout('fictiefUitleg moet zeggen dat de voorbeelden verzonnen zijn (MD-15)');
  if (!gevuld(spel.geenBewijs)) fout('geenBewijs mist: het spel zegt dat het geen bewijs oplevert (MD-11)');
  if (geschatteSeconden(spel) > MAX_SECONDEN) fout(`geschatte duur ${geschatteSeconden(spel)} s is meer dan ${MAX_SECONDEN} s (MD-8)`);

  const { sleutels, teksten } = sleutelsEnTeksten(spel);
  for (const k of sleutels) if (SCORE_SLEUTEL.test(k)) fout(`sleutel ${k}: een spel toont geen score of ranglijst (MD-10)`);
  for (const t of teksten) {
    if (/https?:\/\/|\/\/[\w-]+\.\w/i.test(t)) fout(`tekst met een netwerkadres (${t.slice(0, 40)}…): een spel werkt zonder netwerk (MD-13)`);
    if (/\b(score|punten|ranglijst|highscore)\b/i.test(t) && !/geen (score|punten|ranglijst)/i.test(t)) fout(`tekst noemt een score of ranglijst (MD-10): ${t.slice(0, 50)}…`);
  }

  if (spel.type === 'kaarten') {
    if (!Array.isArray(spel.kaarten) || spel.kaarten.length !== 6) fout('een bronnen-detective heeft zes kaarten');
    for (const k of spel.kaarten ?? []) {
      const wie = `kaart ${k?.id ?? '(zonder id)'}: `;
      if (k?.fictief !== true) fout(`${wie}fictief moet true zijn (MD-15)`);
      for (const veld of ['titel', 'soort', 'auteur', 'jaar', 'uitgever', 'samenvatting', 'kernpunt']) if (!gevuld(k?.[veld])) fout(`${wie}mist ${veld}`);
      if (!Array.isArray(k?.gegevens) || k.gegevens.length < 3) fout(`${wie}minstens drie gegevens om te onderzoeken`);
      for (const c of AAOCC) if (!gevuld(k?.aaocc?.[c])) fout(`${wie}AAOCC mist ${c}`);
      if (!Array.isArray(k?.opties) || k.opties.length !== 3) fout(`${wie}drie opties`);
      for (const o of k?.opties ?? []) if (!gevuld(o?.id) || !gevuld(o?.tekst) || !gevuld(o?.feedback)) fout(`${wie}elke optie heeft id, tekst en feedback (MD-10)`);
      if ((k?.opties ?? []).filter((o) => o.passend).length !== 1) fout(`${wie}precies één optie past het best`);
    }
  }
  if (spel.type === 'simulatie') {
    if (!Array.isArray(spel.beslissingen) || spel.beslissingen.length !== 3) fout('een waarde-simulator heeft drie beslissingen');
    if (spel.fictief !== true) fout('fictief moet true zijn (MD-15)');
    if ((spel.voorspelOpties ?? []).map((o) => o.id).join() !== 'geen,input,plus,min') fout('voorspelOpties zijn geen, input, plus, min');
    for (const b of spel.beslissingen ?? []) {
      const wie = `beslissing ${b?.id ?? '(zonder id)'}: `;
      if (b?.fictief !== true) fout(`${wie}fictief moet true zijn (MD-15)`);
      for (const veld of ['titel', 'situatie']) if (!gevuld(b?.[veld])) fout(`${wie}mist ${veld}`);
      if (!Array.isArray(b?.opties) || b.opties.length < 2) fout(`${wie}minstens twee opties`);
      for (const o of b?.opties ?? []) {
        if (!gevuld(o?.id) || !gevuld(o?.tekst) || !gevuld(o?.feedback)) fout(`${wie}elke optie heeft id, tekst en feedback (MD-10)`);
        for (const [kap, e] of Object.entries(o?.effect ?? {})) {
          if (!KAPITALEN.includes(kap)) fout(`${wie}${kap} is geen van de zes kapitalen`);
          if (!Array.isArray(e?.termijn) || e.termijn.length !== 3 || e.termijn.some((t) => !(t in EFFECT_TEKST))) fout(`${wie}${kap} heeft drie termijnen uit geen, input, plus, min`);
          if (!gevuld(e?.toelichting)) fout(`${wie}${kap} mist een toelichting (MD-10)`);
        }
      }
    }
  }
  return fouten;
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
