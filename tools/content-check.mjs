// Contentcontrole: valideert data/leerblok-*.json en data/leerblokken.json (QA-3, BW-12, TK-2, TK-13, QA-1).
// Bronnen (BR-5) volgen in fase 6.
//
// Gebruik: node tools/content-check.mjs [datamap]   (standaard: data/)
// Fouten laten het commando falen (exit 1). Waarschuwingen niet: teksten met "bron": "concept-auteur" zijn door de
// bouwer geschreven en wachten op akkoord van de auteur.
//
// Formaat van data/leerblok-N.json (definitief sinds fase 2, beschreven in README.md):
//   { "formaat": "1.0", "leerblok": 1, "titel", "richttijd": 45, "eindigtMet", "oefencasus",
//     "taken": [ { "id": "2.1", "titel", "vorm": "Alleen"|"Team",
//                  "richttijd": { "tekst", "minuten", "bron" },
//                  "waarom": { "tekst", "bron" }, "klaarAls": { "tekst", "bron" },
//                  "stof": { "bron", "alineas": [..], "format"? },
//                  "oefening": { "opdracht": { "tekst", "bron" }, "velden"? },
//                  "modelantwoord": { "bron", "velden": { veldId: waarde } },
//                  "toepassing": { "opdracht": { "tekst", "bron" }, "velden": [ { "id", "label", "type", "opties"? } ], "livevoorbeeld"? },
//                  "controles": [ { "id", "soort": "A"|"B"|"C", "type", "veld"?, "velden"?, ...parameters } ],
//                  "bewijsonderdeel": "EV-01" | null, "luk": [1], "bc": ["BC1"] } ],
//     "verdieping": { "tekst", "bron", "na": "2.2" },
//     "bewijsonderdelen": [ { "id": "EV-01", "taak": "2.1", "titel", "lukOnderdelen": ["…"] } ] }
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bouwControle } from '../js/checks/index.js';

const gevuld = (t) => typeof t === 'string' && t.trim() !== '';
const lijstGevuld = (l) => Array.isArray(l) && l.length > 0;
/** Een tekstveld is een tekst of een object { tekst }. */
const tekstVan = (x) => (typeof x === 'string' ? x : x?.tekst);
/** Een modelantwoord is een tekst, of een object met tekst of met ingevulde velden. */
const modelGevuld = (m) => gevuld(tekstVan(m)) || (m && typeof m === 'object' && m.velden && Object.keys(m.velden).length > 0);

/**
 * Controleert één leerblokbestand en geeft een lijst foutmeldingen (leeg = in orde).
 * Elke ontbrekende eis van een taak levert één fout op, met het taaknummer in de melding (QA-3).
 * @param {object} inhoud geparste JSON
 * @param {string} bestand naam voor in de melding
 */
export function controleerLeerblok(inhoud, bestand) {
  const fouten = [];
  const taken = Array.isArray(inhoud?.taken) ? inhoud.taken : [];
  if (taken.length === 0) fouten.push(`${bestand}: geen taken gevonden`);

  for (const taak of taken) {
    const wie = `${bestand}: taak ${taak?.id ?? '(zonder id)'}`;
    if (!lijstGevuld(taak.luk) || !lijstGevuld(taak.bc)) fouten.push(`${wie} mist een LUK-koppeling (luk en bc)`);
    if (!gevuld(tekstVan(taak.klaarAls))) fouten.push(`${wie} mist een „klaar als"`);
    if (!lijstGevuld(taak.controles)) fouten.push(`${wie} mist een controle`);
    if (!modelGevuld(taak.modelantwoord)) fouten.push(`${wie} mist een modelantwoord`);
  }

  const onderdelen = Array.isArray(inhoud?.bewijsonderdelen) ? inhoud.bewijsonderdelen : [];
  for (const ev of onderdelen) {
    if (!lijstGevuld(ev.lukOnderdelen)) fouten.push(`${bestand}: bewijsonderdeel ${ev.id ?? '(zonder id)'} mist een LUK-onderdeel (BW-12)`);
    if (!taken.some((t) => t.id === ev.taak)) fouten.push(`${bestand}: bewijsonderdeel ${ev.id ?? '(zonder id)'} verwijst naar een onbekende taak ${ev.taak}`);
  }
  return fouten;
}

export const BRONNEN = Object.freeze(['werkboek', 'concept-auteur', 'draaiboek', 'lrd']);
export const VELDTYPEN = Object.freeze(['tekst', 'lang', 'keuze', 'lijst', 'meer']);
const MET_OPTIES = ['keuze', 'lijst', 'meer'];

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/**
 * Controleert het formaat van een leerblokbestand (formaat 1.0) en geeft { fouten, waarschuwingen }.
 * Wat QA-3 al meldt (LUK-koppeling, klaar als, controle, modelantwoord ontbreekt) wordt hier niet nog eens gemeld;
 * is het er wel, dan wordt het op vorm gecontroleerd.
 * Een tekst met bron `concept-auteur` geeft een waarschuwing, geen fout.
 * @param {object} inhoud geparste JSON
 * @param {string} bestand naam voor in de melding
 */
export function controleerFormaat(inhoud, bestand) {
  const fouten = [];
  const waarschuwingen = [];
  const fout = (wie, tekst) => fouten.push(`${bestand}: ${wie}${tekst}`);

  if (inhoud?.formaat !== '1.0') fout('', 'formaat moet "1.0" zijn');
  if (!(Number.isInteger(inhoud?.leerblok) && inhoud.leerblok >= 1 && inhoud.leerblok <= 4)) fout('', 'leerblok moet 1 tot en met 4 zijn');
  else if (!bestand.includes(`leerblok-${inhoud.leerblok}.`)) fout('', `leerblok ${inhoud.leerblok} past niet bij de bestandsnaam`);
  if (!gevuld(inhoud?.titel)) fout('', 'mist een titel');
  if (!(typeof inhoud?.richttijd === 'number' && inhoud.richttijd > 0)) fout('', 'mist een richttijd in minuten');
  if (!gevuld(inhoud?.eindigtMet)) fout('', 'mist eindigtMet (het bewijs waarmee het leerblok eindigt, LB-1)');

  /** Controleert { tekst, bron } en geeft een waarschuwing bij een concept van de bouwer. */
  const bronTekst = (wie, naam, waarde, { tekst = true } = {}) => {
    if (!isObject(waarde)) { fout(wie, `${naam} moet een object met tekst en bron zijn`); return; }
    if (tekst && !gevuld(waarde.tekst)) fout(wie, `${naam} mist tekst`);
    if (!BRONNEN.includes(waarde.bron)) fout(wie, `${naam} heeft bron ${JSON.stringify(waarde.bron)}; kies uit ${BRONNEN.join(', ')}`);
    else if (waarde.bron === 'concept-auteur') waarschuwingen.push(`${bestand}: ${wie}${naam} is een concept van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
  };

  const taken = Array.isArray(inhoud?.taken) ? inhoud.taken : [];
  const onderdelen = Array.isArray(inhoud?.bewijsonderdelen) ? inhoud.bewijsonderdelen : [];
  const ids = new Set();

  for (const taak of taken) {
    const wie = `taak ${taak?.id ?? '(zonder id)'}: `;
    if (!/^\d+\.\d+$/.test(taak?.id ?? '')) fout(wie, 'id moet de vorm 2.1 hebben (werkboeknummer)');
    if (ids.has(taak.id)) fout(wie, 'id komt twee keer voor');
    ids.add(taak.id);
    if (!gevuld(taak.titel)) fout(wie, 'mist een titel');
    if (!['Alleen', 'Team'].includes(taak.vorm)) fout(wie, 'vorm moet Alleen of Team zijn');

    if (!isObject(taak.richttijd)) fout(wie, 'mist een richttijd');
    else {
      if (!gevuld(taak.richttijd.tekst)) fout(wie, 'richttijd mist tekst');
      if (!(typeof taak.richttijd.minuten === 'number' && taak.richttijd.minuten > 0)) fout(wie, 'richttijd mist minuten');
      bronTekst(wie, 'richttijd', taak.richttijd, { tekst: false });
      if (taak.richttijd.minutenBron === 'concept-auteur') waarschuwingen.push(`${bestand}: ${wie}minuten van de richttijd zijn een concept van de bouwer (minutenBron concept-auteur), wacht op akkoord van de auteur`);
    }
    if (taak.waarom === undefined || !gevuld(tekstVan(taak.waarom))) fout(wie, 'mist een waarom (TK-2)');
    else bronTekst(wie, 'waarom', taak.waarom);
    if (taak.klaarAls !== undefined && gevuld(tekstVan(taak.klaarAls))) bronTekst(wie, 'klaarAls', taak.klaarAls);

    if (!isObject(taak.stof) || !lijstGevuld(taak.stof.alineas)) fout(wie, 'mist stof met alineas');
    else bronTekst(wie, 'stof', taak.stof, { tekst: false });
    if (!isObject(taak.oefening)) fout(wie, 'mist een oefening (TK-3)');
    else bronTekst(wie, 'oefening.opdracht', taak.oefening.opdracht);

    const velden = Array.isArray(taak.toepassing?.velden) ? taak.toepassing.velden : [];
    if (!lijstGevuld(velden)) fout(wie, 'toepassing mist velden (TK-3)');
    else bronTekst(wie, 'toepassing.opdracht', taak.toepassing.opdracht);
    const veldIds = new Set();
    const controleerVelden = (lijst, naam) => {
      for (const v of lijst) {
        if (!gevuld(v?.id) || !gevuld(v?.label)) fout(wie, `${naam}: elk veld heeft id en label`);
        else if (naam === 'toepassing' && veldIds.has(v.id)) fout(wie, `veld ${v.id} komt twee keer voor`);
        if (naam === 'toepassing') veldIds.add(v?.id);
        if (!VELDTYPEN.includes(v?.type)) fout(wie, `${naam}: veld ${v?.id} heeft type ${JSON.stringify(v?.type)}; kies uit ${VELDTYPEN.join(', ')}`);
        if (MET_OPTIES.includes(v?.type) && !lijstGevuld(v.opties)) fout(wie, `${naam}: veld ${v?.id} mist opties`);
      }
    };
    controleerVelden(velden, 'toepassing');
    const oefenVelden = Array.isArray(taak.oefening?.velden) ? taak.oefening.velden : velden;
    if (taak.oefening?.velden) controleerVelden(taak.oefening.velden, 'oefening');
    const oefenIds = new Set(oefenVelden.map((v) => v.id));

    if (isObject(taak.modelantwoord)) {
      bronTekst(wie, 'modelantwoord', taak.modelantwoord, { tekst: false });
      for (const k of Object.keys(taak.modelantwoord.velden ?? {})) {
        if (!oefenIds.has(k)) fout(wie, `modelantwoord heeft een antwoord voor onbekend veld ${k}`);
      }
    }

    if (Array.isArray(taak.controles)) {
      const controleIds = new Set();
      for (const c of taak.controles) {
        if (!gevuld(c?.id) || !['A', 'B', 'C'].includes(c?.soort)) { fout(wie, `controle ${c?.id ?? '(zonder id)'} mist id of soort (A, B of C)`); continue; }
        if (controleIds.has(c.id)) fout(wie, `controle ${c.id} komt twee keer voor`);
        controleIds.add(c.id);
        for (const v of [c.veld, ...(c.velden ?? [])].filter(Boolean)) {
          if (!veldIds.has(v)) fout(wie, `controle ${c.id} verwijst naar onbekend veld ${v}`);
        }
        try {
          const controle = bouwControle(c, velden);
          controle({}, { taak });
          controle(Object.fromEntries(velden.map((v) => [v.id, 'x y z w v'])), { taak });
        } catch (e) { fout(wie, `controle ${c.id} werkt niet: ${e.message}`); }
      }
    }

    if (taak.bewijsonderdeel !== null && taak.bewijsonderdeel !== undefined) {
      const ev = onderdelen.find((o) => o.id === taak.bewijsonderdeel);
      if (!ev || ev.taak !== taak.id) fout(wie, `bewijsonderdeel ${taak.bewijsonderdeel} staat niet bij deze taak in bewijsonderdelen`);
    } else if (taak.bewijsonderdeel === undefined) fout(wie, 'bewijsonderdeel moet een id of null zijn');
    if (Array.isArray(taak.luk) && !taak.luk.every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) fout(wie, 'luk bevat een getal buiten 1 tot en met 5');
    if (Array.isArray(taak.bc) && !taak.bc.every((b) => /^BC\d+$/.test(b))) fout(wie, 'bc heeft de vorm BC1');
  }

  // TK-13: één optionele verdiepingstaak per leerblok, zichtbaar na „klaar" bij een taak van dit leerblok.
  if (!isObject(inhoud?.verdieping) || !gevuld(inhoud.verdieping.tekst)) fout('', 'mist een verdieping (TK-13)');
  else {
    bronTekst('', 'verdieping', inhoud.verdieping);
    if (!ids.has(inhoud.verdieping.na)) fout('', `verdieping hoort na taak ${inhoud.verdieping.na}, die niet bestaat`);
  }

  for (const ev of onderdelen) {
    if (!/^EV-\d{2}$/.test(ev?.id ?? '')) fout('', `bewijsonderdeel ${ev?.id} heeft niet de vorm EV-01`);
    else {
      const t = taken.find((x) => x.id === ev.taak);
      if (t && t.bewijsonderdeel !== ev.id) fout('', `bewijsonderdeel ${ev.id} wordt niet genoemd door taak ${ev.taak}`);
    }
  }
  return { fouten, waarschuwingen };
}

/** Controleert data/leerblokken.json: de vier leerblokken van de startpagina (LB-1) en de startinvoer (ST-1, ST-2). */
export function controleerOverzicht(inhoud, bestand = 'leerblokken.json') {
  const fouten = [];
  const fout = (t) => fouten.push(`${bestand}: ${t}`);
  const blokken = Array.isArray(inhoud?.leerblokken) ? inhoud.leerblokken : [];
  if (blokken.length !== 4) fout(`moet 4 leerblokken hebben, heeft er ${blokken.length} (LB-1)`);
  blokken.forEach((b, i) => {
    if (b.nummer !== i + 1) fout(`leerblok ${i + 1} heeft nummer ${b.nummer}`);
    if (!gevuld(b.titel) || !gevuld(b.afgerondBewijs) || !gevuld(b.pagina)) fout(`leerblok ${i + 1} mist titel, afgerondBewijs of pagina`);
    if (b.richttijd !== 45) fout(`leerblok ${i + 1} moet een richttijd van 45 min hebben`);
    if (!lijstGevuld(b.bewijsonderdelen) || !b.bewijsonderdelen.every((e) => /^EV-\d{2}$/.test(e))) fout(`leerblok ${i + 1} mist bewijsonderdelen (EV-01, …)`);
  });
  const velden = inhoud?.start?.velden ?? [];
  const idsVelden = velden.map((v) => v.id).join(',');
  if (idsVelden !== 'alias,teamnummer,vraagstuk,waaromZin') fout(`de startinvoer moet precies alias, teamnummer, vraagstuk en waaromZin vragen (ST-1), niet ${idsVelden}`);
  if (!gevuld(inhoud?.start?.voorlopigLabel)) fout('mist het label voor „nog geen scherp vraagstuk" (ST-1)');
  const woorden = (inhoud?.start?.privacytekst ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (woorden === 0 || woorden > 100) fout(`de privacytekst moet 1 tot en met 100 woorden hebben, heeft er ${woorden} (ST-2)`);
  return fouten;
}

/** Controleert alle leerblokbestanden in een map. */
export function controleerMap(map) {
  const namen = existsSync(map) ? readdirSync(map).filter((n) => /^leerblok-\d\.json$/.test(n)).sort() : [];
  const fouten = [];
  const waarschuwingen = [];
  const lees = (naam) => {
    try { return JSON.parse(readFileSync(resolve(map, naam), 'utf8')); }
    catch (e) { fouten.push(`${naam}: geen geldige JSON (${e.message})`); return null; }
  };
  for (const naam of namen) {
    const inhoud = lees(naam);
    if (!inhoud) continue;
    fouten.push(...controleerLeerblok(inhoud, naam));
    const formaat = controleerFormaat(inhoud, naam);
    fouten.push(...formaat.fouten);
    waarschuwingen.push(...formaat.waarschuwingen);
  }
  if (namen.length > 0 || existsSync(resolve(map, 'leerblokken.json'))) {
    if (!existsSync(resolve(map, 'leerblokken.json'))) fouten.push('leerblokken.json ontbreekt (overzicht van de vier leerblokken)');
    else { const o = lees('leerblokken.json'); if (o) fouten.push(...controleerOverzicht(o)); }
  }
  return { bestanden: namen.length, fouten, waarschuwingen };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const map = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'data');
  const { bestanden, fouten, waarschuwingen } = controleerMap(map);
  for (const w of waarschuwingen) console.warn(`WAARSCHUWING ${w}`);
  if (fouten.length) {
    console.error('content-check faalt:\n' + fouten.join('\n'));
    process.exit(1);
  }
  console.log(`content-check: ok (${bestanden} leerblokbestanden, ${waarschuwingen.length} waarschuwingen)`);
}
