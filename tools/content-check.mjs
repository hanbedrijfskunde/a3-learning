// Contentcontrole: valideert data/leerblok-*.json, data/leerblokken.json, data/luk.json en data/tom.json (QA-3, BW-12, TK-2, TK-13, QA-1, BW-13).
// Bronnen (BR-1, BR-3, BR-5): data/bronnen.json en data/bronnen-N.json, zie js/bronnen.js voor het formaat.
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
//                  "stof": { "bron", "alineas": [..], "format"?, "figuur"? },
//                  "oefening": { "opdracht": { "tekst", "bron" }, "figuur"?, "velden"? },
//                  "modelantwoord": { "bron", "velden": { veldId: waarde } },
//                  "toepassing": { "opdracht": { "tekst", "bron" }, "figuur"?, "velden": [ { "id", "label", "type", "opties"? } ], "livevoorbeeld"? },
//                  "controles": [ { "id", "soort": "A"|"B"|"C", "type", "veld"?, "velden"?, ...parameters } ],
//                  "bewijsonderdeel": "EV-01" | null, "luk": [1], "bc": ["BC1"] } ],
//     "verdieping": { "tekst", "bron", "na": "2.2" },
//     "bewijsonderdelen": [ { "id": "EV-01", "taak": "2.1", "titel", "lukOnderdelen": ["…"] } ] }
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bouwControle } from '../js/checks/index.js';
import { apaJaar } from '../js/checks/lb2.js';
import { CITATIE_RE, eersteVolgordefout } from '../js/bronnen.js';
import { normaliseerBlok } from '../js/blok.js';
import { stakeholderRijen } from '../js/raster.js';
import { uitlegWoorden, modelRegels, MAX_WOORDEN_UITLEG, MAX_VIDEO_SECONDEN, MAX_VIDEO_BYTES, METADATA } from '../js/media.js';
import { controleerSpel } from './spel-check.mjs';
import { KAPITALEN, VPC_ONDERDELEN, SPANNING, bouwOefenKaarten, maakVerband } from '../js/verbanden.js';

// De figuren die de stap stof of de oefening kan tonen (FIGUREN in js/leerblok.js).
// De twaalf cellen van het TOM-model zoals ze in een veld staan („Tactisch · Mens”, LB-11).
export const TOM_LABELS = Object.freeze(['Strategisch', 'Tactisch', 'Operationeel'].flatMap((l) => ['Methode', 'Mens', 'Machine', 'Informatie & Rapportage'].map((k) => `${l} · ${k}`)));
export const FIGUUR_NAMEN = ['a3-vel', 'six-capitals', 'vpc', 'bmc', 'tom', 'invloed-belang', 'imrad', 'miniartikelen', 'aisamenvatting']; // invloed-belang: het lege raster van het stakeholderbord (SX-15, SX-16)
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
/** Toepassingen met een eigen scherm (js/leerblok.js): de Wissel, de verbanden-kaart en het STARR-sjabloon. */
export const COMPONENTEN = Object.freeze(['feedbacklog', 'verbanden', 'starr']);
/** Lange velden die een component vult en die de student niet als los tekstvak ziet (SX-11). */
export const ZONDER_ZINSTARTER = Object.freeze(['verbanden', 'markering', 'syntheseKaarten', 'regels', 'teamactie']);
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
    if (taak.stof?.figuur !== undefined && !FIGUUR_NAMEN.includes(taak.stof.figuur)) fout(wie, `stof.figuur ${JSON.stringify(taak.stof.figuur)} is onbekend; kies ${FIGUUR_NAMEN.join(', ')}`);
    else bronTekst(wie, 'stof', taak.stof, { tekst: false });
    if (!isObject(taak.oefening)) fout(wie, 'mist een oefening (TK-3)');
    else bronTekst(wie, 'oefening.opdracht', taak.oefening.opdracht);
    if (taak.toepassing?.figuur !== undefined && !FIGUUR_NAMEN.includes(taak.toepassing.figuur)) fout(wie, `toepassing.figuur ${JSON.stringify(taak.toepassing.figuur)} is onbekend; kies ${FIGUUR_NAMEN.join(', ')}`);
    if (taak.oefening?.figuur !== undefined && !FIGUUR_NAMEN.includes(taak.oefening.figuur)) fout(wie, `oefening.figuur ${JSON.stringify(taak.oefening.figuur)} is onbekend; kies ${FIGUUR_NAMEN.join(', ')}`);
    // B104: het voorbeeld van de collega bij 4.3: een samenvatting met een citatie en de vijf AAOCC-oordelen in vaste volgorde.
    if (taak.oefening?.figuur === 'aisamenvatting') {
      const v = taak.oefening.voorbeeld;
      if (!gevuld(v?.samenvatting) || !gevuld(v?.citatie)) fout(wie, 'oefening.voorbeeld mist samenvatting of citatie (B104)');
      const rijen = Array.isArray(v?.aaocc) ? v.aaocc : [];
      if (JSON.stringify(rijen.map((r) => r?.[0])) !== JSON.stringify(['Authority', 'Accuracy', 'Objectivity', 'Currency', 'Coverage'])) fout(wie, 'oefening.voorbeeld.aaocc moet de vijf AAOCC-criteria in volgorde hebben');
      if (rijen.some((r) => !['+', '?', '–'].includes(r?.[1]) || !gevuld(r?.[2]))) fout(wie, 'elk AAOCC-oordeel in het voorbeeld heeft +, ? of – en een toelichting');
    }
    // B102: de mini-artikelen van de oefening bij 4.2: twee artikelen, elk met de vier IMRAD-secties in volgorde en een citatie.
    if (taak.oefening?.figuur === 'miniartikelen') {
      const art = taak.oefening.artikelen;
      if (!Array.isArray(art) || art.length !== 2) fout(wie, 'oefening.artikelen moet twee mini-artikelen hebben (B102)');
      else for (const [i, a] of art.entries()) {
        if (!gevuld(a?.kop) || !gevuld(a?.citatie)) fout(wie, `mini-artikel ${i + 1} mist kop of citatie`);
        const koppen = (a?.secties ?? []).map((x) => x?.kop);
        if (JSON.stringify(koppen) !== JSON.stringify(['Inleiding', 'Methode', 'Resultaten', 'Discussie'])) fout(wie, `mini-artikel ${i + 1} heeft niet de secties Inleiding, Methode, Resultaten, Discussie`);
        if ((a?.secties ?? []).some((x) => !gevuld(x?.tekst))) fout(wie, `mini-artikel ${i + 1} heeft een lege sectie`);
        if (a?.grafiek && !(gevuld(a.grafiek.titel) && Array.isArray(a.grafiek.rijen) && a.grafiek.rijen.every(([l, w]) => gevuld(l) && Number.isFinite(w)))) fout(wie, `de grafiek van mini-artikel ${i + 1} is onvolledig`);
      }
    }

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
    // SX-13: elke oefenvraag heeft een hint die het modelantwoord niet verklapt (stuk van ≥ 15 tekens).
    const modelVoorHint = JSON.stringify(taak.modelantwoord ?? '').toLowerCase();
    // Een stakeholderbord (SX-16) of een TOM-bord met signalen (ADR B98) bij de oefening is één vraag: de hint staat op de groep,
    // niet op elk veld van het bord.
    const borden = (taak.oefening?.weergave?.groepen ?? []).filter((g) => g?.bord || g?.tombord?.signalen);
    const bordIds = new Set(borden.flatMap((g) => (g.bord ? stakeholderRijen(g.bord).flat() : g.tombord.signalen)));
    const oefenVragen = [...oefenVelden.filter((v) => !bordIds.has(v?.id)), ...borden.map((g) => ({ id: g.bord ? `bord ${g.bord.voor}` : 'TOM-bord', hint: g.hint, hintBron: g.hintBron }))];
    for (const g of borden.filter((x) => x.tombord)) {
      for (const id of g.tombord.signalen) if (!oefenVelden.some((v) => v?.id === id)) fout(wie, `het TOM-bord noemt signaal ${id}, maar dat veld staat niet in de oefening`);
      for (const [id, w] of Object.entries(taak.modelantwoord?.velden ?? {})) if (g.tombord.signalen.includes(id) && !TOM_LABELS.includes(w)) fout(wie, `het modelantwoord zet ${id} in „${w}”; dat is geen cel van het TOM-model`);
    }
    for (const v of oefenVragen) {
      if (!v?.id || v.reeks) continue;
      if (!gevuld(v.hint)) { fout(wie, `oefenvraag ${v.id} heeft geen hint (SX-13)`); continue; }
      // ADR B85: de hint zegt waar het antwoord staat (stof van een taak, een bron, het werkboek of het eigen werk)
      if (!lijstGevuld(v.hintBron)) fout(wie, `oefenvraag ${v.id} zegt niet waar het antwoord staat (hintBron, ADR B85)`);
      // TK-19: een vraag gaat altijd over stof die ervoor is behandeld. Minstens één vindplaats is de stof van deze of een
      // eerdere taak, of eigen werk; een bron of het werkboek alleen is niet genoeg.
      else if (!v.hintBron.some((w) => w?.soort === 'stof' || w?.soort === 'eigen werk')) fout(wie, `oefenvraag ${v.id} gaat niet over stof die ervoor is behandeld (TK-19)`);
      for (const w of v.hintBron ?? []) {
        if (!['stof', 'bron', 'werkboek', 'eigen werk'].includes(w?.soort)) fout(wie, `hintBron bij ${v.id}: onbekende soort ${JSON.stringify(w?.soort)}`);
        else if (w.soort === 'stof' && !w.leerblok && !taken.some((t) => t.id === w.taak)) fout(wie, `hintBron bij ${v.id}: taak ${w.taak} staat niet in dit leerblok`);
        // De student moet de stof al gezien hebben: dezelfde taak, een eerdere taak of een eerder leerblok (nooit vooruit).
        else if (w.soort === 'stof' && w.leerblok && w.leerblok > inhoud.leerblok) fout(wie, `hintBron bij ${v.id}: verwijst vooruit naar leerblok ${w.leerblok}`);
        else if (w.soort === 'stof' && !w.leerblok && taken.findIndex((t) => t.id === w.taak) > taken.findIndex((t) => t.id === taak.id)) fout(wie, `hintBron bij ${v.id}: verwijst vooruit naar taak ${w.taak}, die de student nog niet heeft gezien`);
        else if (w.soort === 'bron' && (!gevuld(w.bron) || !gevuld(w.citatie))) fout(wie, `hintBron bij ${v.id}: een bron heeft bron en citatie`);
        else if (['werkboek', 'eigen werk'].includes(w.soort) && !gevuld(w.vindplaats)) fout(wie, `hintBron bij ${v.id}: vindplaats ontbreekt`);
      }
      const h = v.hint.toLowerCase();
      for (let i = 0; i + 15 <= h.length; i += 5) if (modelVoorHint.includes(h.slice(i, i + 15))) { fout(wie, `de hint bij ${v.id} verklapt het modelantwoord (SX-13): „${h.slice(i, i + 15)}”`); break; }
    }

    // TK-6, ADR B100: modelNa is "veld", "lijn" of een lijst oefenvelden waarvan er één gevuld moet zijn.
    const na = taak.oefening?.modelNa;
    if (Array.isArray(na)) { for (const id of na) if (!oefenIds.has(id)) fout(wie, `oefening.modelNa noemt ${id}, maar dat veld staat niet in de oefening`); }
    else if (na !== undefined && !['veld', 'lijn'].includes(na)) fout(wie, `oefening.modelNa ${JSON.stringify(na)} is onbekend; kies "veld", "lijn" of een lijst velden`);

    if (isObject(taak.modelantwoord)) {
      bronTekst(wie, 'modelantwoord', taak.modelantwoord, { tekst: false });
      for (const k of Object.keys(taak.modelantwoord.velden ?? {})) {
        if (!oefenIds.has(k)) fout(wie, `modelantwoord heeft een antwoord voor onbekend veld ${k}`);
      }
    }

    // SX-5: de „klaar als" als checklist. Elk criterium is een letterlijk stuk van de regel (TK-2) en verwijst alleen naar
    // controles van deze taak; zonder controles vinkt de student het zelf af.
    if (isObject(taak.klaarAls)) {
      const crit = taak.klaarAls.criteria;
      const ids = new Set((taak.controles ?? []).map((c) => c.id));
      if (!lijstGevuld(crit)) fout(wie, 'klaarAls mist criteria voor de checklist (SX-5)');
      else for (const c of crit) {
        if (!gevuld(c?.tekst) || !String(taak.klaarAls.tekst ?? '').includes(c.tekst)) fout(wie, `criterium „${c?.tekst}” staat niet letterlijk in de klaar als-regel (SX-5, TK-2)`);
        if (!Array.isArray(c?.controles)) fout(wie, `criterium „${c?.tekst}” mist een lijst controles (SX-5)`);
        else for (const id of c.controles) if (!ids.has(id)) fout(wie, `criterium „${c.tekst}” verwijst naar onbekende controle ${id} (SX-5)`);
      }
    }

    // SX-11: elk lang tekstvak van de toepassing heeft een zinstarter als placeholder, en die zinstarter zegt het
    // modelantwoord niet voor. Velden die een component vult (lijnen, markeringen, feedbackregels) tellen niet mee.
    const modelTekst = JSON.stringify(taak.modelantwoord ?? '').toLowerCase();
    for (const v of velden) {
      if (v?.type !== 'lang' || ZONDER_ZINSTARTER.includes(v.id)) continue;
      if (!gevuld(v.zinstarter)) { fout(wie, `veld ${v.id} is een lang veld zonder zinstarter (SX-11)`); continue; }
      for (const stuk of v.zinstarter.split('…').map((x) => x.trim().toLowerCase()).filter((x) => x.length >= 15)) {
        if (modelTekst.includes(stuk)) fout(wie, `de zinstarter van ${v.id} staat in het modelantwoord (SX-11): „${stuk}”`);
      }
    }

    if (taak.toepassing?.component !== undefined && !COMPONENTEN.includes(taak.toepassing.component)) fout(wie, `toepassing.component ${JSON.stringify(taak.toepassing.component)} is onbekend; kies uit ${COMPONENTEN.join(', ')}`);
    if (taak.oefening?.component !== undefined && taak.oefening.component !== 'verbanden') fout(wie, `oefening.component ${JSON.stringify(taak.oefening.component)} is onbekend; kies verbanden`);
    if (taak.oefening?.component === 'verbanden') controleerVerbandenOefening(taak, wie, fout);

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

  // TK-11: de zin „wat ik hiermee aan mijn A3 heb” aan het eind van leerblok 4 (afsluiting.a3Zin).
  if (inhoud?.afsluiting !== undefined) {
    if (!gevuld(inhoud.afsluiting?.a3Zin?.vraag)) fout('', 'afsluiting.a3Zin mist een vraag (TK-11)');
    else bronTekst('', 'afsluiting.a3Zin', inhoud.afsluiting.a3Zin, { tekst: false });
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
  for (const m of modellenZonderFiguur(inhoud)) waarschuwingen.push(`${bestand}: de stof noemt het ${m}, maar dat model heeft nog geen figuur (SX-15)`);
  return { fouten, waarschuwingen };
}

/**
 * SX-15 (ADR B92, B95): een model staat in beeld én in tekst. Een model is iets met assen, vakken of lagen; een lijst of
 * ezelsbruggetje (AAOCC, STARR, 3xC) niet. `figuur` is de naam van zijn figuur (stof.figuur, FIGUREN in js/leerblok.js);
 * zolang die niet in FIGUUR_NAMEN staat, heeft het model nog geen figuur.
 */
export const MODELLEN = Object.freeze([
  { naam: 'A3-vel', patroon: /A3-(vel|sjabloon)/i, figuur: 'a3-vel' },
  { naam: 'six capitals-model', patroon: /six capitals/i, figuur: 'six-capitals' },
  { naam: 'invloed/belang-raster', patroon: /invloed en belang|invloed\/belang/i, figuur: 'invloed-belang' },
  { naam: 'value proposition canvas', patroon: /value proposition canvas/i, figuur: 'vpc' },
  { naam: 'business model canvas', patroon: /business model canvas/i, figuur: 'bmc' },
  { naam: 'TOM³-model', patroon: /TOM³|TOM-model/i, figuur: 'tom' },
]);

/** De modellen die de stof of de tekstroute van dit leerblok noemt, maar die nog geen figuur hebben (SX-15). */
export function modellenZonderFiguur(inhoud, figuren = FIGUUR_NAMEN) {
  const stof = [...(inhoud?.taken ?? []).flatMap((t) => t.stof?.alineas ?? []), ...(inhoud?.media?.uitleg?.alineas ?? [])].join('\n');
  return MODELLEN.filter((m) => !figuren.includes(m.figuur) && m.patroon.test(stof)).map((m) => m.naam);
}

/**
 * De oefencasus van taak 9.4 (VB-2): drie open vragen, de kaarten van de casus, `modelNa: "lijn"` (het modelvoorbeeld komt
 * pas na een eigen poging) en een modelvoorbeeld waarvan elk verband op de kaarten van de casus past.
 */
function controleerVerbandenOefening(taak, wie, fout) {
  const o = taak.oefening;
  if (o.modelNa !== 'lijn') fout(wie, 'de oefening met verbanden heeft modelNa "lijn" nodig: het modelvoorbeeld komt pas na een getrokken lijn (VB-2)');
  if (!Array.isArray(o.velden) || o.velden.length !== 3) fout(wie, `de oefening met verbanden heeft precies 3 open vragen (VB-2), niet ${Array.isArray(o.velden) ? o.velden.length : 0}`);
  const k = o.kaarten;
  if (!isObject(k) || !Array.isArray(k.us) || k.us.length !== 3 || !k.us.every(gevuld)) { fout(wie, 'oefening.kaarten.us moet drie teksten hebben (gebruiker, pain of gain, waarde)'); return; }
  if (!Array.isArray(k.vpc) || k.vpc.length < 1 || k.vpc.length > 5 || !k.vpc.every((c) => gevuld(c?.tekst) && VPC_ONDERDELEN.includes(c?.onderdeel))) { fout(wie, `oefening.kaarten.vpc moet 1 tot en met 5 kaarten hebben met een onderdeel uit ${VPC_ONDERDELEN.join(', ')}`); return; }
  if (!Array.isArray(k.gekozen) || !k.gekozen.every((g) => KAPITALEN.includes(g))) fout(wie, 'oefening.kaarten.gekozen bevat een kapitaal dat niet bestaat');
  const kaarten = bouwOefenKaarten(k).kaarten;
  const model = taak.modelantwoord?.verbanden;
  if (!Array.isArray(model) || model.length === 0) { fout(wie, 'het modelantwoord van de verbanden-oefening mist verbanden'); return; }
  const gemaakt = [];
  for (const v of model) {
    const r = maakVerband(v, kaarten, gemaakt);
    if (!r.ok) fout(wie, `modelverband ${v?.van} → ${v?.naar} klopt niet: ${r.fout}`);
    else gemaakt.push(r.verband);
    if (v?.type === SPANNING && !(k.stakeholders ?? []).includes(v.stakeholder)) fout(wie, `een modelverband ${SPANNING} noemt een stakeholder die niet in oefening.kaarten.stakeholders staat`);
  }
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
    if (!gevuld(b.aanbevolen?.week) || !gevuld(b.aanbevolen?.dag)) fout(`leerblok ${i + 1} mist aanbevolen.week en aanbevolen.dag (TP-10)`);
  });
  const velden = inhoud?.start?.velden ?? [];
  const idsVelden = velden.map((v) => v.id).join(',');
  if (idsVelden !== 'alias,teamnummer,vraagstuk,waaromZin') fout(`de startinvoer moet precies alias, teamnummer, vraagstuk en waaromZin vragen (ST-1), niet ${idsVelden}`);
  if (!gevuld(inhoud?.start?.voorlopigLabel)) fout('mist het label voor „nog geen scherp vraagstuk" (ST-1)');
  const woorden = (inhoud?.start?.privacytekst ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (woorden === 0 || woorden > 100) fout(`de privacytekst moet 1 tot en met 100 woorden hebben, heeft er ${woorden} (ST-2)`);
  return fouten;
}

export const TERUGBLIK_BANDEN = Object.freeze(['kort', 'middel', 'volledig', 'lang']);

/**
 * Controleert data/terugblik.json (TP-1, TP-2, TP-3, TP-7, fase 7): per leerblok 2, 3 en 4 een meenemen-kaart met items,
 * precies 2 kennisvragen, een transfervraag en een samenvatting; per bandbreedte een richttijd van hoogstens 15 min (TP-1).
 * Een samenvatting met bron `concept-auteur` geeft een waarschuwing.
 * @returns {{fouten: string[], waarschuwingen: string[]}}
 */
export function controleerTerugblik(inhoud, bestand = 'terugblik.json') {
  const fouten = [];
  const waarschuwingen = [];
  const fout = (t) => fouten.push(`${bestand}: ${t}`);
  if (inhoud?.formaat !== '1.0') fout('formaat moet "1.0" zijn');
  for (const band of TERUGBLIK_BANDEN) {
    const b = inhoud?.bandbreedtes?.[band];
    if (!isObject(b) || !gevuld(b.omschrijving)) fout(`bandbreedte ${band} mist een omschrijving`);
    else if (!(typeof b.minuten === 'number' && b.minuten > 0 && b.minuten <= 15)) fout(`bandbreedte ${band}: de terugblik duurt 1 tot en met 15 min (TP-1), niet ${JSON.stringify(b.minuten)}`);
  }
  const kaarten = Array.isArray(inhoud?.kaarten) ? inhoud.kaarten : [];
  if (kaarten.map((k) => k?.leerblok).join(',') !== '2,3,4') fout('er moet één kaart zijn voor leerblok 2, 3 en 4, in die volgorde');
  for (const k of kaarten) {
    const wie = `kaart voor leerblok ${k?.leerblok}: `;
    if (k?.vorig !== k?.leerblok - 1) fout(`${wie}vorig moet ${k?.leerblok - 1} zijn`);
    if (!lijstGevuld(k?.items) || !k.items.every(gevuld)) fout(`${wie}mist items`);
    if (!(Array.isArray(k?.kennisvragen) && k.kennisvragen.length === 2 && k.kennisvragen.every(gevuld))) fout(`${wie}heeft precies 2 kennisvragen nodig (TP-2)`);
    if (!gevuld(k?.transfervraag)) fout(`${wie}mist een transfervraag (TP-4)`);
    if (!BRONNEN.includes(k?.bron)) fout(`${wie}bron ${JSON.stringify(k?.bron)}; kies uit ${BRONNEN.join(', ')}`);
    if (!gevuld(k?.samenvatting?.tekst)) fout(`${wie}mist een samenvatting (TP-7)`);
    else if (!BRONNEN.includes(k.samenvatting.bron)) fout(`${wie}samenvatting heeft bron ${JSON.stringify(k.samenvatting.bron)}; kies uit ${BRONNEN.join(', ')}`);
    else if (k.samenvatting.bron === 'concept-auteur') waarschuwingen.push(`${bestand}: ${wie}de samenvatting is een concept van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
  }
  return { fouten, waarschuwingen };
}

/**
 * Controleert data/tom.json (LB-11, ADR B98): de celteksten van het TOM-bord. Drie lagen en vier kolommen met een uitleg, en
 * per cel (S1 … O4) een naam, een vraag en minstens twee dingen om naar te kijken. Bron `concept-auteur` geeft een waarschuwing.
 * @returns {{fouten: string[], waarschuwingen: string[]}}
 */
export function controleerTom(inhoud, bestand = 'tom.json') {
  const fouten = [];
  const waarschuwingen = [];
  const fout = (t) => fouten.push(`${bestand}: ${t}`);
  if (inhoud?.formaat !== '1.0') fout('formaat moet "1.0" zijn');
  if (!BRONNEN.includes(inhoud?.bron)) fout(`bron ${JSON.stringify(inhoud?.bron)}; kies uit ${BRONNEN.join(', ')}`);
  else if (inhoud.bron === 'concept-auteur') waarschuwingen.push(`${bestand}: de celteksten zijn een concept van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
  const namen = (lijst) => (Array.isArray(lijst) ? lijst.map((x) => (gevuld(x?.uitleg) ? x.naam : `${x?.naam} (zonder uitleg)`)).join(', ') : '');
  if (namen(inhoud?.lagen) !== 'Strategisch, Tactisch, Operationeel') fout('lagen moeten Strategisch, Tactisch en Operationeel zijn, elk met een uitleg (LB-11)');
  if (namen(inhoud?.kolommen) !== 'Methode, Mens, Machine, Informatie & Rapportage') fout('kolommen moeten Methode, Mens, Machine en Informatie & Rapportage zijn, elk met een uitleg (LB-11)');
  const codes = ['S', 'T', 'O'].flatMap((l) => [1, 2, 3, 4].map((k) => `${l}${k}`));
  for (const code of codes) {
    const c = inhoud?.cellen?.[code];
    if (!gevuld(c?.naam) || !gevuld(c?.vraag)) fout(`cel ${code} mist een naam of een vraag`);
    else if (!(Array.isArray(c.kijk) && c.kijk.length >= 2 && c.kijk.every(gevuld))) fout(`cel ${code}: noem minstens twee dingen om naar te kijken`);
  }
  for (const code of Object.keys(inhoud?.cellen ?? {})) if (!codes.includes(code)) fout(`cel ${code} bestaat niet in het TOM-model`);
  return { fouten, waarschuwingen };
}

export const DEKKINGEN = Object.freeze(['gedekt', 'deels', 'buiten scope']);

/** Woorden die in de docentmodus niet horen: beoordelingsdetails en toetsantwoorden (DM-17). */
export const DOCENT_VERBODEN = /beoordelingscriteri|beoordelingsdetail|beoordelingsformulier|beoordelingsmodel|rubric|toetsantwoord|toetsvra|tentamen|cijfer|slagingsdrempel|\bBC[1-9]\b|\bLUK\s?[1-9]\b/i;
const alleTeksten = (w, uit = []) => {
  if (typeof w === 'string') uit.push(w);
  else if (Array.isArray(w)) w.forEach((x) => alleTeksten(x, uit));
  else if (w && typeof w === 'object') Object.values(w).forEach((x) => alleTeksten(x, uit));
  return uit;
};

/**
 * Controleert data/docent-deelN.json (DM-3, DM-7, DM-17, DM-18; formaat in README). Taken en klaar-als komen uit de
 * leerblokbestanden (DM-2): het docentbestand mag ze niet herhalen. `blokken` is de lijst geladen leerblokken.
 * @returns {{fouten: string[], waarschuwingen: string[]}}
 */
export function controleerDocent(inhoud, blokken = [], bestand = 'docent-deel1.json') {
  const fouten = [];
  const waarschuwingen = [];
  const fout = (t) => fouten.push(`${bestand}: ${t}`);
  if (inhoud?.formaat !== '1.0') fout('formaat moet "1.0" zijn');
  if (!Number.isInteger(inhoud?.deel) || inhoud.deel < 1) fout('deel moet een geheel getal zijn');
  if (!gevuld(inhoud?.titel)) fout('mist een titel');
  const onderdelen = Array.isArray(inhoud?.onderdelen) ? inhoud.onderdelen : [];
  if (onderdelen.length === 0) fout('geen onderdelen');
  if (!(typeof inhoud?.duurMinuten === 'number' && inhoud.duurMinuten > 0)) fout('duurMinuten moet een getal boven 0 zijn');
  else if (onderdelen.reduce((som, o) => som + (typeof o?.minuten === 'number' ? o.minuten : 0), 0) !== inhoud.duurMinuten) fout(`de minuten van de onderdelen tellen op tot ${onderdelen.reduce((som, o) => som + (o?.minuten ?? 0), 0)}, niet tot duurMinuten (${inhoud.duurMinuten})`);
  if (inhoud?.deel === 1 && onderdelen.length !== 11) fout(`deel 1 heeft 11 onderdelen (DM-18), niet ${onderdelen.length}`);
  if (inhoud?.deel === 2) {
    const pauzes = onderdelen.filter((o) => o?.soort === 'pauze').length;
    if (onderdelen.length - pauzes !== 8) fout(`deel 2 heeft 8 onderdelen (DM-18), niet ${onderdelen.length - pauzes}`);
    if (pauzes !== 3) fout(`deel 2 heeft 3 pauzes (DM-18), niet ${pauzes}`);
  }
  const ids = new Set();
  for (const o of onderdelen) {
    const wie = `onderdeel ${o?.id ?? '(zonder id)'}: `;
    if (!gevuld(o?.id) || ids.has(o.id)) fout(`${wie}id ontbreekt of komt dubbel voor`);
    ids.add(o?.id);
    if (!gevuld(o?.titel)) fout(`${wie}mist een titel`);
    if (!(Number.isInteger(o?.minuten) && o.minuten > 0)) fout(`${wie}minuten moet een geheel getal boven 0 zijn`);
    if (o?.soort === 'pauze') continue; // een pauze heeft alleen id, titel en minuten
    if (o?.taak !== null && !gevuld(o?.taak)) fout(`${wie}taak is een taaknummer of null`);
    if (o?.taak) {
      const blok = blokken.find((b) => b.leerblok === o.leerblok);
      if (!blok) fout(`${wie}leerblok ${JSON.stringify(o.leerblok)} is niet geladen of onbekend`);
      else if (!blok.taken?.some((t) => t.id === o.taak)) fout(`${wie}taak ${o.taak} staat niet in leerblok ${o.leerblok}`);
      for (const dubbel of ['klaarAls', 'modelantwoord']) if (dubbel in o) fout(`${wie}${dubbel} hoort in het leerblokbestand, niet hier (DM-2)`);
    } else if (!gevuld(tekstVan(o?.klaarAls))) fout(`${wie}zonder taak is een eigen klaarAls nodig`);
    if (!gevuld(tekstVan(o?.opdracht))) fout(`${wie}mist een opdracht`);
    if (!lijstGevuld(o?.materiaal) || !o.materiaal.every(gevuld)) fout(`${wie}mist materiaal`);
    if (!['open', 'dicht'].includes(o?.laptop)) fout(`${wie}laptop is "open" of "dicht"`);
    if (o?.dia !== null && !gevuld(o?.dia)) fout(`${wie}dia is een tekst of null`);
    for (const veld of ['watDocentDoet', 'kernboodschap']) if (!gevuld(o?.[veld])) fout(`${wie}mist ${veld} (DM-7)`);
    if (!Array.isArray(o?.rondloopvragen) || !o.rondloopvragen.every(gevuld)) fout(`${wie}rondloopvragen moet een lijst zijn (DM-7)`);
    else if (o.taak && o.rondloopvragen.length === 0) fout(`${wie}een onderdeel met taak heeft minstens één rondloopvraag (DM-7)`);
    if (!lijstGevuld(o?.alsHetAndersLoopt) || !o.alsHetAndersLoopt.every(gevuld)) fout(`${wie}mist alsHetAndersLoopt (DM-7)`);
    if (!Array.isArray(o?.veelgemaakteFouten) || !o.veelgemaakteFouten.every(gevuld)) fout(`${wie}veelgemaakteFouten moet een lijst zijn`);
    if (!BRONNEN.includes(o?.bron)) fout(`${wie}bron ${JSON.stringify(o?.bron)}; kies uit ${BRONNEN.join(', ')}`);
    else if (o.bron === 'concept-auteur') waarschuwingen.push(`${bestand}: ${wie}deels een concept van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
    if (o?.ronde !== undefined && !['rondes', 'minutenPerRonde', 'lezenMinuten'].every((k) => typeof o.ronde[k] === 'number' && o.ronde[k] > 0)) fout(`${wie}ronde heeft rondes, minutenPerRonde en lezenMinuten (DM-6)`);
  }
  const conceptOpdrachten = onderdelen.filter((o) => o?.opdracht?.bron === 'concept-auteur').length;
  if (conceptOpdrachten) waarschuwingen.push(`${bestand}: ${conceptOpdrachten} opdrachten op de stapkaart zijn een korte formulering van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
  for (const t of alleTeksten(inhoud)) {
    const m = DOCENT_VERBODEN.exec(t);
    if (m) fout(`de docentmodus bevat beoordelingsinformatie (DM-17): "${m[0]}" in "${t.slice(0, 60)}"`);
  }
  return { fouten, waarschuwingen };
}

/**
 * Controleert data/luk.json: de dekkingstabel van blueprint §4.3 met de 11 bewijsonderdelen (BW-13, fase 3).
 * Zijn de leerblokbestanden meegegeven, dan moeten hun bewijsonderdelen erbij passen (titel, lukOnderdelen en luk).
 * @param {object} inhoud geparste JSON
 * @param {object[]} [blokken] geparste data/leerblok-N.json
 */
export function controleerLuk(inhoud, bestand = 'luk.json', blokken = []) {
  const fouten = [];
  const fout = (t) => fouten.push(`${bestand}: ${t}`);
  if (inhoud?.formaat !== '1.0') fout('formaat moet "1.0" zijn');
  const evs = Array.isArray(inhoud?.bewijsonderdelen) ? inhoud.bewijsonderdelen : [];
  const rijen = Array.isArray(inhoud?.onderdelen) ? inhoud.onderdelen : [];
  const verwacht = Array.from({ length: 12 }, (_, i) => `EV-${String(i + 1).padStart(2, '0')}`); // EV-12: ontleed artikel (ADR B102)
  if (evs.map((e) => e.id).join(',') !== verwacht.join(',')) fout(`bewijsonderdelen moeten ${verwacht[0]} t/m ${verwacht.at(-1)} zijn, in volgorde (blueprint §6.7)`);
  for (const e of evs) if (!gevuld(e.titel)) fout(`bewijsonderdeel ${e.id} mist een titel`);
  if (rijen.length !== 13) fout(`moet 13 onderdelen van de leeruitkomsten hebben (blueprint §4.3), heeft er ${rijen.length}`);
  const ids = new Set(evs.map((e) => e.id));
  const gebruikt = new Set();
  rijen.forEach((r, i) => {
    const wie = `onderdeel ${i + 1}`;
    if (!gevuld(r.label)) fout(`${wie} mist een label`);
    if (!DEKKINGEN.includes(r.dekking)) fout(`${wie}: dekking ${JSON.stringify(r.dekking)}; kies uit ${DEKKINGEN.join(', ')}`);
    if (!(r.luk === null || (Number.isInteger(r.luk) && r.luk >= 1 && r.luk <= 5))) fout(`${wie}: luk moet 1 tot en met 5 of null zijn`);
    if (!Array.isArray(r.bewijs)) { fout(`${wie} mist een lijst bewijs`); return; }
    for (const id of r.bewijs) { if (!ids.has(id)) fout(`${wie} verwijst naar onbekend bewijsonderdeel ${id}`); gebruikt.add(id); }
    if (r.dekking === 'buiten scope' && r.bewijs.length > 0) fout(`${wie} is buiten scope en mag geen bewijs hebben`);
    if ((r.dekking === 'gedekt' || r.dekking === 'deels') && r.bewijs.length === 0) fout(`${wie} is ${r.dekking} en mist bewijs`);
  });
  for (const id of ids) if (!gebruikt.has(id)) fout(`bewijsonderdeel ${id} komt in geen enkel onderdeel voor`);

  for (const blok of blokken) {
    for (const ev of blok?.bewijsonderdelen ?? []) {
      const naam = `leerblok ${blok.leerblok}: ${ev.id}`;
      const eigen = evs.find((e) => e.id === ev.id);
      if (!eigen) { fout(`${naam} staat niet in bewijsonderdelen`); continue; }
      if (gevuld(ev.titel) && ev.titel !== eigen.titel) fout(`${naam} heet in het leerblok "${ev.titel}" en hier "${eigen.titel}"`);
      for (const label of ev.lukOnderdelen ?? []) {
        if (!rijen.some((r) => r.label === label && r.bewijs?.includes(ev.id))) fout(`${naam}: lukOnderdeel "${label}" staat hier niet met ${ev.id} als bewijs`);
      }
      const taak = (blok.taken ?? []).find((t) => t.id === ev.taak);
      const luks = new Set(rijen.filter((r) => r.bewijs?.includes(ev.id)).map((r) => r.luk));
      for (const n of taak?.luk ?? []) if (!luks.has(n)) fout(`${naam}: taak ${ev.taak} claimt LUK ${n}, maar ${ev.id} staat hier niet bij een onderdeel van LUK ${n}`);
    }
  }
  return fouten;
}

export const BRONTYPEN = Object.freeze(['boek', 'artikel', 'hoofdstuk', 'rapport', 'web', 'video', 'sjabloon', 'ongepubliceerd']);

/** Verzamelt alle tekstwaarden van een JSON-waarde met het pad erheen; `opmerking` (aantekening van de bouwer) telt niet mee. */
function tekstenMetPad(waarde, pad = [], uit = []) {
  if (typeof waarde === 'string') uit.push({ pad: pad.join('.'), tekst: waarde });
  else if (Array.isArray(waarde)) waarde.forEach((w, i) => tekstenMetPad(w, [...pad, i], uit));
  else if (isObject(waarde)) for (const [k, w] of Object.entries(waarde)) if (k !== 'opmerking') tekstenMetPad(w, [...pad, k], uit);
  return uit;
}

/**
 * Controleert de bronnen (BR-1, BR-3, BR-5) en geeft { fouten, waarschuwingen, bestanden }.
 *   BR-5  elke in-tekstverwijzing (Auteur, jaar) in de contentbestanden heeft een bronregel, en elke bronregel wordt geciteerd
 *   BR-1  elk bronbestand staat in het manifest en in alfabetische volgorde; elke bron heeft een APA-regel met het jaar van de citatie
 *   BR-3  een niet-openbare bron is „ongepubliceerd document" met de organisatie; een fictieve bron is als fictief gemarkeerd (MD-15)
 * Bronnen in `wachtOpCitatie` (uit het LRD, nog nergens geciteerd) geven een waarschuwing; wordt zo'n bron wel geciteerd,
 * dan is dat een fout: verplaats hem naar `bronnen`.
 */
export function controleerBronnen(map) {
  const fouten = [];
  const waarschuwingen = [];
  const lees = (naam) => {
    try { return JSON.parse(readFileSync(resolve(map, naam), 'utf8')); }
    catch (e) { fouten.push(`${naam}: geen geldige JSON (${e.message})`); return null; }
  };
  const alle = existsSync(map) ? readdirSync(map).filter((n) => n.endsWith('.json')).sort() : [];
  const bronNamen = alle.filter((n) => /^bronnen-\d\.json$/.test(n));

  // manifest: de bronnenpagina en de leerblokpagina's laden alleen wat erin staat
  if (bronNamen.length > 0 || alle.includes('bronnen.json')) {
    const manifest = alle.includes('bronnen.json') ? lees('bronnen.json') : null;
    if (!alle.includes('bronnen.json')) fouten.push('bronnen.json ontbreekt (lijst van de bronbestanden)');
    else if (manifest) {
      const lijst = Array.isArray(manifest.bestanden) ? manifest.bestanden : [];
      for (const n of bronNamen) if (!lijst.includes(n)) fouten.push(`bronnen.json: ${n} staat niet in bestanden; de bronnenpagina zou hem missen (BR-1)`);
      for (const n of lijst) if (!bronNamen.includes(n)) fouten.push(`bronnen.json: ${n} bestaat niet in de datamap`);
    }
  }

  const bronnen = [];
  const wachtend = [];
  const ids = new Set();
  const citaties = new Set();
  for (const naam of bronNamen) {
    const inhoud = lees(naam);
    if (!inhoud) continue;
    const fout = (t) => fouten.push(`${naam}: ${t}`);
    if (inhoud.formaat !== '1.0') fout('formaat moet "1.0" zijn');
    if (!naam.includes(`bronnen-${inhoud.leerblok}.`)) fout(`leerblok ${inhoud.leerblok} past niet bij de bestandsnaam`);
    for (const veld of ['bronnen', 'wachtOpCitatie']) {
      if (!Array.isArray(inhoud[veld])) { fout(`${veld} moet een lijst zijn`); continue; }
      for (const b of inhoud[veld]) {
        const wie = `bron ${b?.id ?? '(zonder id)'}: `;
        if (!/^[a-z0-9-]+$/.test(b?.id ?? '')) fout(`${wie}id bestaat uit kleine letters, cijfers en streepjes`);
        if (ids.has(b?.id)) fout(`${wie}id komt twee keer voor`);
        ids.add(b?.id);
        const m = /^(.+), (\d{4}[a-z]?|z\.d\.(?:-[a-z])?)$/.exec(b?.citatie ?? '');
        if (!m) fout(`${wie}citatie heeft de vorm "Auteur, 2019", "Auteur, z.d." of "Auteur, z.d.-a"`);
        else if (citaties.has(b.citatie)) fout(`${wie}citatie ${b.citatie} komt twee keer voor`);
        citaties.add(b?.citatie);
        if (!gevuld(b?.apa)) fout(`${wie}mist een APA-vermelding`);
        else if (m && apaJaar(b.apa) !== m[2].replace(/(?:-|(?<=\d))[a-z]$/, '')) fout(`${wie}het jaar in de APA-regel (${apaJaar(b.apa) ?? 'geen'}) is niet dat van de citatie (${m[2]})`);
        if (!BRONTYPEN.includes(b?.type)) fout(`${wie}type ${JSON.stringify(b?.type)}; kies uit ${BRONTYPEN.join(', ')}`);
        if (b?.link !== undefined && !(typeof b.link === 'string' && b.link.startsWith('https://'))) fout(`${wie}link begint met https://`);
        if (b?.type === 'ongepubliceerd') {
          if (!gevuld(b.organisatie) || !String(b.apa).includes(b.organisatie)) fout(`${wie}een ongepubliceerde bron noemt de organisatie in de APA-regel (BR-3)`);
          if (!/ongepubliceerd document/i.test(b.apa ?? '')) fout(`${wie}een ongepubliceerde bron heet „ongepubliceerd document" (BR-3)`);
          if (b.link) fout(`${wie}een ongepubliceerde bron heeft geen link`);
        }
        if (b?.fictief === true) {
          if (!/fictie/i.test(b.apa ?? '')) fout(`${wie}een fictieve bron is in de APA-regel als fictief gemarkeerd (MD-15)`);
          if (b.link) fout(`${wie}een fictieve bron heeft geen link`);
          if (veld === 'wachtOpCitatie') fout(`${wie}een fictieve bron hoort in bronnen, niet in wachtOpCitatie`);
        } else if (b?.fictief !== undefined) fout(`${wie}fictief is true of ontbreekt`);
        (veld === 'bronnen' ? bronnen : wachtend).push({ ...b, bestand: naam });
      }
    }
    const volgorde = eersteVolgordefout(inhoud.bronnen ?? []);
    if (volgorde) fout(`bronnen staan niet alfabetisch: ${volgorde[1].citatie} hoort vóór ${volgorde[0].citatie} (BR-1)`);
  }

  // BR-5: verwijzingen en bronregels tegen elkaar
  const geciteerd = new Map(); // citatie → eerste plek
  for (const naam of alle.filter((n) => !/^bronnen(-\d)?\.json$/.test(n))) {
    const inhoud = lees(naam);
    if (!inhoud) continue;
    for (const { pad, tekst } of tekstenMetPad(inhoud)) {
      for (const m of tekst.matchAll(CITATIE_RE)) {
        const sleutel = `${m[1]}, ${m[2]}`;
        if (!geciteerd.has(sleutel)) geciteerd.set(sleutel, `${naam}: ${pad}`);
      }
    }
  }
  // de spellen (spellen/*.json) noemen ook bronnen (BR-4, BR-5)
  const spellenMap = resolve(map, '..', 'spellen');
  for (const naam of existsSync(spellenMap) ? readdirSync(spellenMap).filter((n) => n.endsWith('.json')).sort() : []) {
    try {
      for (const { pad, tekst } of tekstenMetPad(JSON.parse(readFileSync(resolve(spellenMap, naam), 'utf8')))) {
        for (const m of tekst.matchAll(CITATIE_RE)) { const sleutel = `${m[1]}, ${m[2]}`; if (!geciteerd.has(sleutel)) geciteerd.set(sleutel, `spellen/${naam}: ${pad}`); }
      }
    } catch (e) { fouten.push(`spellen/${naam}: geen geldige JSON (${e.message})`); }
  }
  const inBronnen = new Set(bronnen.map((b) => b.citatie));
  const inWacht = new Set(wachtend.map((b) => b.citatie));
  for (const [sleutel, plek] of geciteerd) {
    if (inBronnen.has(sleutel)) continue;
    if (inWacht.has(sleutel)) fouten.push(`${plek}: verwijzing (${sleutel}) staat in wachtOpCitatie; verplaats de bronregel naar bronnen`);
    else fouten.push(`${plek}: verwijzing (${sleutel}) heeft geen bronregel (BR-5)`);
  }
  for (const b of bronnen) if (!geciteerd.has(b.citatie)) fouten.push(`${b.bestand}: bronregel ${b.id} (${b.citatie}) wordt nergens geciteerd (BR-5)`);
  if (wachtend.length > 0) waarschuwingen.push(`bronnen: ${wachtend.length} bronnen uit het LRD wachten nog op een citatie in de content (${wachtend.map((b) => b.id).join(', ')})`);
  return { fouten, waarschuwingen, bestanden: bronNamen.length };
}

/** Eerste zin van een tekst (tot en met het eerste leesteken dat een zin afsluit). */
const eersteZin = (t) => /^[^.!?]+[.!?]/.exec(t.trim())?.[0] ?? t.trim();
const zonderOordeel = (t) => String(t ?? '').replace(/^[+?–-]\s*/u, '');

/** Duur in seconden van een videobestand volgens ffprobe, of null als ffprobe ontbreekt of het bestand niet te lezen is. */
export function ffprobeDuur(pad) {
  try {
    const n = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', pad], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
    return Number.isFinite(n) ? n : null;
  } catch (e) { return null; }
}

/**
 * MD-4: een eigen video duurt hoogstens 3 minuten en is hoogstens 20 MB. De duur komt uit ffprobe en de grootte uit het bestand zelf;
 * de metadata (media/metadata.json) moet daarmee kloppen, zodat een aangepaste metadata een echte te lange video niet kan verbergen.
 * Zonder ffprobe geldt de metadata en komt er een waarschuwing. Geeft { fouten, waarschuwingen }.
 */
export function controleerVideo(pad, meta, naam = pad) {
  const fouten = [];
  const waarschuwingen = [];
  if (!existsSync(pad)) return { fouten: [`${naam}: bestand bestaat niet`], waarschuwingen };
  const bytes = statSync(pad).size;
  if (bytes > MAX_VIDEO_BYTES) fouten.push(`${naam}: ${(bytes / 1048576).toFixed(1)} MB is meer dan ${MAX_VIDEO_BYTES / 1048576} MB (MD-4)`);
  const echt = ffprobeDuur(pad);
  if (echt === null) waarschuwingen.push(`${naam}: ffprobe ontbreekt, de duur is alleen aan de metadata te zien (MD-4)`);
  else if (echt > MAX_VIDEO_SECONDEN) fouten.push(`${naam}: ${echt.toFixed(1)} s is meer dan ${MAX_VIDEO_SECONDEN} s (MD-4, ffprobe)`);
  if (!meta) fouten.push(`${naam}: geen regel in ${METADATA} (duur en grootte)`);
  else {
    if (meta.duurSeconden > MAX_VIDEO_SECONDEN) fouten.push(`${naam}: metadata zegt ${meta.duurSeconden} s, meer dan ${MAX_VIDEO_SECONDEN} s (MD-4)`);
    if (meta.bytes !== bytes) fouten.push(`${naam}: metadata zegt ${meta.bytes} bytes, het bestand heeft er ${bytes}`);
    if (echt !== null && Math.abs(meta.duurSeconden - echt) >= 1) fouten.push(`${naam}: metadata zegt ${meta.duurSeconden} s, ffprobe meldt ${echt.toFixed(1)} s`);
  }
  return { fouten, waarschuwingen };
}

/**
 * Controleert de media (fase 12): `media` in leerblok 2 en 4, `kijktips` in leerblok 1, de spellen in `spellen/`, de video's
 * in `media/` en het `media`-veld van de docentonderdelen. Geeft { fouten, waarschuwingen }.
 *   MD-2/MD-3  de uitleg is hoogstens 300 woorden, met voorbeeld en het modelantwoord van de oefencasus uit de taak zelf
 *   MD-5       een video heeft ondertitels (bestand) en een transcript (de spreektekst van de dia's), verbonden met de uitleg
 *   MD-8/10/11/13/15  de controle van elk spel (zie controleerSpel)
 *   MD-14/16   kijktips zijn gewone https-links met verwijzing, duur en taal
 */
export function controleerMedia(map, blokken, docentDelen = []) {
  const fouten = [];
  const waarschuwingen = [];
  const site = resolve(map, '..');
  const fout = (bestand, wie, t) => fouten.push(`${bestand}: ${wie}${t}`);
  let metaCache = null;
  const videoMeta = () => {
    if (metaCache) return metaCache;
    try { metaCache = JSON.parse(readFileSync(resolve(site, METADATA), 'utf8')); } catch (e) { metaCache = {}; }
    return metaCache;
  };
  for (const blok of blokken) {
    const bestand = `leerblok-${blok.leerblok}.json`;
    const kt = blok.kijktips;
    if (kt !== undefined) {
      if (!gevuld(kt.titel) || !gevuld(kt.intro)) fout(bestand, 'kijktips: ', 'titel en intro zijn nodig');
      if (!Array.isArray(kt.items) || kt.items.length !== 2) fout(bestand, 'kijktips: ', 'precies twee kijktips (MD-16)');
      for (const k of kt.items ?? []) {
        const wie = `kijktip ${k?.id}: `;
        if (!/^https:\/\//.test(k?.url ?? '')) fout(bestand, wie, 'url moet een https-link zijn (MD-14)');
        for (const v of ['rol', 'titel', 'verwijzing', 'duur', 'taal', 'waarom']) if (!gevuld(k?.[v])) fout(bestand, wie, `mist ${v} (MD-16)`);
        if (!/^\(.+, \d{4}\)$/.test(k?.verwijzing ?? '')) fout(bestand, wie, 'verwijzing heeft de vorm (Auteur, jaar) (BR-4)');
      }
    }
    const m = blok.media;
    if (m === undefined) continue;
    const wie = 'media: ';
    const taak = blok.taken.find((t) => t.id === m.taak);
    if (!taak) { fout(bestand, wie, `taak ${m.taak} bestaat niet`); continue; }
    const u = m.uitleg;
    if (!u || !gevuld(u.titel) || !lijstGevuld(u.alineas) || !gevuld(u.voorbeeld)) { fout(bestand, wie, 'uitleg heeft titel, alinea’s en voorbeeld (MD-3)'); continue; }
    if (u.bron === 'concept-auteur') waarschuwingen.push(`${bestand}: ${wie}de uitleg en de video zijn een concept van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
    const velden = u.modelantwoord?.velden ?? [];
    if (u.modelantwoord?.taak !== m.taak || !lijstGevuld(velden) || velden.some((v) => taak.modelantwoord?.velden?.[v] === undefined)) fout(bestand, wie, 'het modelantwoord komt uit velden van de oefentaak (MD-3)');
    const aantal = uitlegWoorden(blok);
    if (aantal > MAX_WOORDEN_UITLEG) fout(bestand, wie, `uitleg heeft ${aantal} woorden; hoogstens ${MAX_WOORDEN_UITLEG} (MD-3)`);
    const v = m.video;
    if (!v) fout(bestand, wie, 'video ontbreekt');
    else if (v.url !== undefined) {
      // B105: een externe video is een link, zoals een kijktip; de transcripteis (MD-3, MD-5) geldt alleen voor eigen video's.
      if (!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(v.url)) fout(bestand, wie, 'externe video: url moet een https-link naar YouTube zijn (B105)');
      for (const veld of ['id', 'titel', 'kanaal', 'verwijzing', 'duur', 'taal', 'waarom']) if (!gevuld(v[veld])) fout(bestand, wie, `externe video mist ${veld}`);
      if (!/^\(.+, \d{4}\)$/.test(v.verwijzing ?? '')) fout(bestand, wie, 'externe video: verwijzing heeft de vorm (Auteur, jaar) (BR-4)');
      for (const veld of ['bestand', 'ondertitels', 'dias']) if (v[veld] !== undefined) fout(bestand, wie, `externe video heeft geen ${veld}`);
    } else {
      for (const veld of ['id', 'titel', 'bestand', 'ondertitels']) if (!gevuld(v[veld])) fout(bestand, wie, `video mist ${veld}`);
      if (v.concept !== true && v.concept !== false) fout(bestand, wie, 'video.concept moet true of false zijn (eerlijk markeren)');
      if (!lijstGevuld(v.dias) || v.dias.some((d) => !gevuld(d?.titel) || !gevuld(d?.spreektekst))) fout(bestand, wie, 'elke dia heeft titel en spreektekst (transcript, MD-5)');
      else {
        const transcript = v.dias.map((d) => d.spreektekst).join(' ');
        const eis = [['voorbeeld', u.voorbeeld], ['„klaar als”', taak.klaarAls.tekst], ...modelRegels(blok).map((r) => [`modelantwoord ${r.id}`, zonderOordeel(r.tekst)]), ...u.alineas.map((a, i) => [`alinea ${i + 1} (eerste zin)`, eersteZin(a)])];
        for (const [naam, tekst] of eis) if (!transcript.includes(tekst)) fout(bestand, wie, `het transcript bevat ${naam} van de uitleg niet letterlijk (video en uitleg horen bij elkaar)`);
      }
      for (const pad of [v.bestand, v.ondertitels]) if (gevuld(pad) && !existsSync(resolve(site, pad))) fout(bestand, wie, `${pad} bestaat niet (maak hem met tools/maak-video.mjs)`);
      if (!/^media\/[\w.-]+\.(mp4|webm)$/.test(v.bestand ?? '')) fout(bestand, wie, 'video staat in media/ als mp4 of webm, op dezelfde site (MD-7)');
      else if (existsSync(resolve(site, v.bestand))) {
        const vid = controleerVideo(resolve(site, v.bestand), videoMeta()[v.bestand], v.bestand);
        fouten.push(...vid.fouten);
        waarschuwingen.push(...vid.waarschuwingen);
      }
    }
    const s = m.spel;
    if (!s || !gevuld(s.bestand) || !gevuld(s.titel) || !(s.minuten > 0)) { fout(bestand, wie, 'spel heeft bestand, titel en minuten'); continue; }
    if (!/^spellen\/[\w.-]+\.json$/.test(s.bestand)) fout(bestand, wie, 'spel staat in spellen/ (op dezelfde site)');
    const spelPad = resolve(site, s.bestand);
    if (!existsSync(spelPad)) { fout(bestand, wie, `${s.bestand} bestaat niet`); continue; }
    let data;
    try { data = JSON.parse(readFileSync(spelPad, 'utf8')); } catch (e) { fout(s.bestand, '', `geen geldige JSON (${e.message})`); continue; }
    fouten.push(...controleerSpel(data, s.bestand));
    if (data.taak !== m.taak || data.leerblok !== blok.leerblok) fout(s.bestand, '', 'taak en leerblok van het spel horen bij de media van dit leerblok');
    if (data.id !== s.id) fout(s.bestand, '', 'id van het spel komt niet overeen met de leerblokdata');
    if (data.bron === 'concept-auteur') waarschuwingen.push(`${s.bestand}: het spel is een concept van de bouwer (bron concept-auteur), wacht op akkoord van de auteur`);
  }
  for (const d of docentDelen) {
    for (const o of d.onderdelen ?? []) {
      if (o?.media === undefined) continue;
      const blok = blokken.find((b) => b.leerblok === o.media.leerblok);
      if (!blok?.media) fouten.push(`docent-deel${d.deel}.json: onderdeel ${o.id}: media verwijst naar leerblok ${o.media.leerblok} zonder media (DM-13)`);
    }
  }
  return { fouten, waarschuwingen };
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
  const blokken = [];
  for (const naam of namen) {
    const inhoud = lees(naam);
    if (!inhoud) continue;
    normaliseerBlok(inhoud); // reeksen velden uitschrijven (js/blok.js)
    blokken.push(inhoud);
    fouten.push(...controleerLeerblok(inhoud, naam));
    const formaat = controleerFormaat(inhoud, naam);
    fouten.push(...formaat.fouten);
    waarschuwingen.push(...formaat.waarschuwingen);
  }
  if (namen.length > 0 || existsSync(resolve(map, 'leerblokken.json'))) {
    if (!existsSync(resolve(map, 'leerblokken.json'))) fouten.push('leerblokken.json ontbreekt (overzicht van de vier leerblokken)');
    else { const o = lees('leerblokken.json'); if (o) fouten.push(...controleerOverzicht(o)); }
  }
  if (existsSync(resolve(map, 'luk.json'))) {
    const luk = lees('luk.json');
    if (luk) fouten.push(...controleerLuk(luk, 'luk.json', blokken));
  }
  if (existsSync(resolve(map, 'terugblik.json'))) {
    const t = lees('terugblik.json');
    if (t) { const r = controleerTerugblik(t); fouten.push(...r.fouten); waarschuwingen.push(...r.waarschuwingen); }
  }
  if (existsSync(resolve(map, 'tom.json'))) {
    const t = lees('tom.json');
    if (t) { const r = controleerTom(t); fouten.push(...r.fouten); waarschuwingen.push(...r.waarschuwingen); }
  }
  const docentDelen = [];
  for (const naam of existsSync(map) ? readdirSync(map).filter((n) => /^docent-deel\d\.json$/.test(n)).sort() : []) {
    const d = lees(naam);
    if (d) { docentDelen.push(d); const r = controleerDocent(d, blokken, naam); fouten.push(...r.fouten); waarschuwingen.push(...r.waarschuwingen); }
  }
  const nietPauze = docentDelen.flatMap((d) => d.onderdelen ?? []).filter((o) => o?.soort !== 'pauze').length;
  if (docentDelen.some((d) => d.deel === 1) && docentDelen.some((d) => d.deel === 2) && nietPauze !== 19) {
    fouten.push(`docent-deel1.json en docent-deel2.json: samen 19 onderdelen zonder pauzes (DM-18), niet ${nietPauze}`);
  }
  const media = controleerMedia(map, blokken, docentDelen);
  fouten.push(...media.fouten);
  waarschuwingen.push(...media.waarschuwingen);
  const bronnen = controleerBronnen(map);
  fouten.push(...bronnen.fouten);
  waarschuwingen.push(...bronnen.waarschuwingen);
  return { bestanden: namen.length, bronbestanden: bronnen.bestanden, fouten, waarschuwingen };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const map = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'data');
  const { bestanden, bronbestanden, fouten, waarschuwingen } = controleerMap(map);
  for (const w of waarschuwingen) console.warn(`WAARSCHUWING ${w}`);
  if (fouten.length) {
    console.error('content-check faalt:\n' + fouten.join('\n'));
    process.exit(1);
  }
  console.log(`content-check: ok (${bestanden} leerblokbestanden, ${bronbestanden} bronbestanden, ${waarschuwingen.length} waarschuwingen)`);
}
