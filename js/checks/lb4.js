// Controles van leerblok 4: de Wissel (EV-09, WS-7, WS-8), de kopiecontrole voor EV-01, EV-02 en EV-11, de STARR-reflectie
// (EV-10) en de verbanden-kaart (EV-11, VB-1…VB-7, BW-10). Zuiver: geen DOM, geen netwerk, geen opslag (BW-8).
//
// De feedbacklog is de invoer `regels` (lijst van { richting, rol, zie, mis, vraag, actie, status }).
// Context: `context.wissel.ontvangen` (ontvangen wisselblokken) en `context.eigen` (eigen records EV-01, EV-02, EV-06, EV-07,
// EV-11), zie context.js; `context.records` zijn de records van dit leerblok (EV-09, EV-10, EV-11).
import { resultaat, tellers } from './core.js';
import { gelijkAanWissel, plat, ACTIE_STATUSSEN } from '../wissel.js';
import { stelVraagSamen } from './lb1.js';
import { stakeholdersUit, stakeholderRijen } from '../raster.js';
import {
  KAPITALEN, SPANNING, MIN_VERBANDEN, MIN_ZIN_WOORDEN, MAX_ZINNEN_SYNTHESE, OPLOSSING_ONDERDELEN, NIET_ZIEN_VELDEN,
  verbandenUit, verbandRegel, markeringen, syntheseModellen,
} from '../verbanden.js';

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const gevuld = (t) => plat(t) !== '';
const regelsVan = (invoer, veld = 'regels') => (Array.isArray(invoer?.[veld]) ? invoer[veld].filter(isObject) : []);
const heeftInhoud = (r) => gevuld(r.zie) || gevuld(r.mis) || gevuld(r.vraag);

/** WS-8: zolang er geen ontvangen feedback is, is dat een `let op` (status Bijna), ook na 14 dagen; er is geen klok in de regel. */
const WACHT = 'Wacht op de feedback van je wisselpartner en plak die hier zodra je hem hebt.';

/**
 * Minstens één zelf gegeven feedbackregel (EV-09). Geen: `mist`.
 */
export function feedbackGegeven({ id, veld = 'regels' }) {
  return (invoer) => (regelsVan(invoer, veld).some((r) => r.richting === 'gegeven' && heeftInhoud(r))
    ? resultaat(id, 'A', 'ok')
    : resultaat(id, 'A', 'mist', 'Geef zelf feedback op het wisselblok van je wisselpartner: ik zie, ik mis of ik vraag me af.'));
}

/**
 * Ik zie, ik mis en ik vraag me af zijn alle drie ingevuld bij minstens één ontvangen regel (EV-09).
 * Geen ontvangen regel: `let op` (WS-8). Wel ontvangen, maar onvolledig: ook `let op`: ontvangen feedback mag de status niet
 * van Bijna terug naar Nog niet zetten. „Nog niet" is er alleen zolang de student zelf niets gaf (feedbackGegeven).
 */
export function zieMisVraag({ id, veld = 'regels' }) {
  return (invoer) => {
    const ontvangen = regelsVan(invoer, veld).filter((r) => r.richting === 'ontvangen');
    if (ontvangen.length === 0) return resultaat(id, 'A', 'let op', WACHT);
    if (ontvangen.some((r) => gevuld(r.zie) && gevuld(r.mis) && gevuld(r.vraag))) return resultaat(id, 'A', 'ok');
    return resultaat(id, 'A', 'let op', 'Vul bij de ontvangen feedback alle drie in: ik zie, ik mis en ik vraag me af.');
  };
}

/**
 * Minstens één ontvangen regel met een actie en een status (EV-09: „1 actie met 1 status").
 * Geen ontvangen regel: `let op` (WS-8). Wel ontvangen maar zonder actie of status: ook `let op` (zie zieMisVraag).
 */
export function actieMetStatus({ id, veld = 'regels' }) {
  return (invoer) => {
    const ontvangen = regelsVan(invoer, veld).filter((r) => r.richting === 'ontvangen');
    if (ontvangen.length === 0) return resultaat(id, 'A', 'let op', WACHT);
    if (ontvangen.some((r) => tellers.telWoorden(r.actie) > 0 && ACTIE_STATUSSEN.includes(r.status))) return resultaat(id, 'A', 'ok');
    return resultaat(id, 'A', 'let op', 'Schrijf bij de ontvangen feedback wat je ermee doet (een actie) en kies een status.');
  };
}

const KOPIE_MELDING = (wat) => `Let op: dit is de tekst van je wisselpartner (${wat}). Schrijf je eigen versie.`;

/**
 * De eigen tekst is niet letterlijk gelijk aan een ontvangen wisselblok (WS-7). 0 tekens verschil: `let op`.
 * `onderdeel` is `vraag` (de samengestelde onderzoeksvraag van EV-01; `velden`: gebruiker, pain, waarde)
 * of `zoekvragen` (de zoekvragen van EV-02; `velden`: de drie zoekvraagvelden). Zonder ontvangen wisselblok of zonder
 * ingevulde velden: `ok`. `verbanden` (EV-11) vergelijkt de regels van de verbanden-kaart.
 */
export function nietGelijkAanWissel({ id, onderdeel, velden, soort = 'B' }) {
  return (invoer, context = {}) => {
    const ontvangen = context?.wissel?.ontvangen ?? [];
    let eigen;
    let wat;
    if (onderdeel === 'vraag') {
      eigen = velden.every((v) => gevuld(invoer?.[v])) ? { vraag: stelVraagSamen(invoer) } : {};
      wat = 'de onderzoeksvraag';
    } else if (onderdeel === 'zoekvragen') {
      eigen = { zoekvragen: velden.map((v) => invoer?.[v]) };
      wat = 'de zoekvragen';
    } else if (onderdeel === 'verbanden') {
      eigen = { verbanden: verbandenUit(invoer).map(verbandRegel) };
      wat = 'de verbanden';
    } else throw new Error(`Controle ${id}: onbekend onderdeel ${onderdeel}`);
    return gelijkAanWissel(ontvangen, eigen).length > 0 ? resultaat(id, soort, 'let op', KOPIE_MELDING(wat)) : resultaat(id, soort, 'ok');
  };
}

/**
 * EV-09: de eigen EV-01, EV-02 en EV-11 zijn niet letterlijk gelijk aan het ontvangen wisselblok (0 tekens verschil = `let op`).
 * Leest de eigen records uit `context.eigen`; ontbreken die, dan is er niets te vergelijken en is het resultaat `ok`.
 */
export function eigenNietGelijkAanWissel({ id, soort = 'B' }) {
  return (invoer, context = {}) => {
    const ontvangen = context?.wissel?.ontvangen ?? [];
    const e1 = context?.eigen?.['EV-01']?.inhoud;
    const e2 = context?.eigen?.['EV-02']?.inhoud;
    const e11 = context?.eigen?.['EV-11']?.inhoud;
    const eigen = {
      vraag: e1 && ['gebruiker', 'pain', 'waarde'].every((v) => gevuld(e1[v])) ? stelVraagSamen(e1) : '',
      zoekvragen: e2 ? [1, 2, 3].map((n) => e2[`zoekvraag${n}`]) : [],
      verbanden: e11 ? verbandenUit(e11).map(verbandRegel) : [],
    };
    const gelijk = gelijkAanWissel(ontvangen, eigen);
    if (gelijk.length === 0) return resultaat(id, soort, 'ok');
    return resultaat(id, soort, 'let op', KOPIE_MELDING(`je ${gelijk.map((g) => (({ zoekvragen: 'zoekvragen in EV-02', verbanden: 'verbanden in EV-11' })[g] ?? 'onderzoeksvraag in EV-01')).join(' en ')}`));
  };
}

// ---------------------------------------------------------------- EV-10: STARR-reflectie (LB-15)

const STARR_DELEN = Object.freeze([['situatie', 'situatie'], ['taak', 'taak'], ['actie', 'actie'], ['resultaat', 'resultaat'], ['reflectie', 'reflectie']]);

/** Alle vijf de delen van de STARR zijn ingevuld (EV-10). Geen enkel deel: `mist`; een deel ontbreekt: `let op` met de naam van dat deel. */
export function starrDelen({ id, velden = STARR_DELEN.map(([v]) => v) }) {
  return (invoer) => {
    const leeg = velden.filter((v) => !gevuld(invoer?.[v])).map((v) => (STARR_DELEN.find(([k]) => k === v)?.[1] ?? v));
    if (leeg.length === velden.length) return resultaat(id, 'A', 'mist', 'Schrijf je STARR-reflectie: situatie, taak, actie, resultaat en reflectie.');
    return leeg.length === 0 ? resultaat(id, 'A', 'ok') : resultaat(id, 'A', 'let op', `Vul nog in: ${leeg.join(', ')}.`);
  };
}

/** De volgende stap uit de reflectie is minstens `min` woorden (EV-10). Leeg: `mist`. */
export function volgendeStapReflectie({ id, veld = 'volgende', min = 3 }) {
  return (invoer) => {
    const n = tellers.telWoorden(plat(invoer?.[veld]));
    if (n === 0) return resultaat(id, 'A', 'mist', 'Schrijf je volgende stap: wat ga je de volgende keer anders doen?');
    return n < min ? resultaat(id, 'A', 'let op', `Maak je volgende stap concreter (minstens ${min} woorden).`) : resultaat(id, 'A', 'ok');
  };
}

/**
 * De optionele koppeling van de reflectie aan een feedbackregel bestaat in de feedbacklog (EV-10 → EV-09, B). Geen koppeling: `ok`.
 * Een regel die niet meer bestaat, of een log die ontbreekt: `let op`.
 */
export function feedbackKoppeling({ id, veld = 'feedbackregel', bron = 'EV-09' }) {
  return (invoer, context = {}) => {
    const gekozen = plat(invoer?.[veld]);
    if (gekozen === '') return resultaat(id, 'B', 'ok');
    const regels = regelsVan(context?.records?.[bron]?.inhoud);
    return regels.some((r) => r.id === gekozen)
      ? resultaat(id, 'B', 'ok')
      : resultaat(id, 'B', 'let op', `De feedbackregel waaraan je reflectie hangt (${gekozen}) staat niet meer in je feedbacklog (${bron}); kies een andere of haal de koppeling weg.`);
  };
}

// ---------------------------------------------------------------- EV-11: verbanden tussen modellen (VB-1…VB-7, BW-10)

const opsomming = (lijst) => lijst.join(', ');

/** Minstens één verband (A). Geen: `mist`. */
export function verbandenAanwezig({ id }) {
  return (invoer) => (verbandenUit(invoer).length > 0
    ? resultaat(id, 'A', 'ok')
    : resultaat(id, 'A', 'mist', 'Trek minstens één lijn tussen twee kaarten uit verschillende kolommen.'));
}

/** Minstens zes verbanden (C, alleen tellen). */
export function verbandenAantal({ id, min = MIN_VERBANDEN }) {
  return (invoer) => {
    const n = verbandenUit(invoer).length;
    return n >= min ? resultaat(id, 'C', 'ok') : resultaat(id, 'C', 'mist', `Je hebt ${n} ${n === 1 ? 'verband' : 'verbanden'}; trek er minstens ${min}.`);
  };
}

/** Minstens twee verschillende verbandtypen (C, alleen tellen). */
export function verbandTypen({ id, min = 2 }) {
  return (invoer) => {
    const n = new Set(verbandenUit(invoer).map((v) => v.type)).size;
    return n >= min ? resultaat(id, 'C', 'ok') : resultaat(id, 'C', 'mist', `Gebruik minstens ${min} verschillende typen verbanden (hoort bij, leidt tot, gaat ten koste van).`);
  };
}

/** Elk verband heeft één zin waarom van minstens drie woorden (A). Zonder verbanden: `ok` (dat meldt verbandenAanwezig). */
export function verbandZinnen({ id, min = MIN_ZIN_WOORDEN }) {
  return (invoer) => {
    const zonder = verbandenUit(invoer).filter((v) => tellers.telWoorden(plat(v.zin)) < min).length;
    return zonder === 0 ? resultaat(id, 'A', 'ok') : resultaat(id, 'A', 'let op', `${zonder === 1 ? 'Eén verband heeft' : `${zonder} verbanden hebben`} nog geen zin waarom.`);
  };
}

/** Elk van de zes kapitalen is gemarkeerd als input, uitkomst (+) of uitkomst (−) (A). Niets: `mist`; een deel: `let op`. */
export function kapitalenGemarkeerd({ id }) {
  return (invoer) => {
    const n = Object.keys(markeringen(invoer)).length;
    if (n === KAPITALEN.length) return resultaat(id, 'A', 'ok');
    return resultaat(id, 'A', n === 0 ? 'mist' : 'let op', `Markeer elk kapitaal als input, uitkomst (+) of uitkomst (−) (${n} van ${KAPITALEN.length}).`);
  };
}

/** De synthese-alinea is ingevuld en telt hoogstens vijf zinnen (A). */
export function syntheseAlinea({ id, veld = 'synthese', max = MAX_ZINNEN_SYNTHESE }) {
  return (invoer) => {
    const tekst = plat(invoer?.[veld]);
    if (tekst === '') return resultaat(id, 'A', 'mist', 'Schrijf je synthese-alinea van hoogstens vijf zinnen.');
    const n = tellers.telZinnen(tekst);
    return n <= max ? resultaat(id, 'A', 'ok') : resultaat(id, 'A', 'let op', `Je synthese heeft ${n} zinnen; maak er hoogstens ${max} van.`);
  };
}

/** De synthese noemt (als chip) kaarten uit minstens twee modellen (B: samenhang tussen synthese en kaart). */
export function syntheseKaarten({ id, min = 2 }) {
  return (invoer) => {
    const n = syntheseModellen(invoer).length;
    return n >= min ? resultaat(id, 'B', 'ok') : resultaat(id, 'B', 'let op', `Voeg in je synthese kaarten uit minstens ${min} modellen in als chip (nu ${n}).`);
  };
}

/** Drie korte antwoorden op „wat laat dit model niet zien?" (A). */
export function nietZienAntwoorden({ id, velden = NIET_ZIEN_VELDEN.map(([v]) => v) }) {
  return (invoer) => {
    const n = velden.filter((v) => gevuld(invoer?.[v])).length;
    if (n === velden.length) return resultaat(id, 'A', 'ok');
    return resultaat(id, 'A', n === 0 ? 'mist' : 'let op', `Beantwoord bij alle drie de modellen „wat laat dit model niet zien?” (${n} van ${velden.length}).`);
  };
}

/** Elk deel van de user story (gebruiker, pain of gain, waarde) is verbonden met minstens één kaart uit het VPC (B). */
export function userStoryVerbonden({ id }) {
  const delen = [['us:gebruiker', 'de gebruiker'], ['us:pain', 'de pain of gain'], ['us:waarde', 'de waarde']];
  return (invoer) => {
    const verbanden = verbandenUit(invoer);
    const zonder = delen.filter(([kaart]) => !verbanden.some((v) => v.van === kaart && String(v.naar).startsWith('vpc:'))).map(([, naam]) => naam);
    return zonder.length === 0 ? resultaat(id, 'B', 'ok') : resultaat(id, 'B', 'let op', `Verbind ${opsomming(zonder)} uit je user story met minstens één kaart uit je VPC.`);
  };
}

/**
 * EV-11 → EV-01 (B): elk kapitaal dat je in je user story koos (EV-01) is verbonden met minstens één gain, pain reliever of
 * gain creator uit het VPC. Zonder EV-01: `let op`; zonder gekozen kapitalen valt er niets na te gaan: `ok`.
 */
export function kapitalenUitEv01Verbonden({ id, bron = 'EV-01' }) {
  return (invoer, context = {}) => {
    const ev = context?.eigen?.[bron]?.inhoud ?? context?.records?.[bron]?.inhoud;
    if (!ev) return resultaat(id, 'B', 'let op', `Je user story (${bron}, leerblok 1) ontbreekt; daarom kan ik niet nagaan of je gekozen kapitalen zijn verbonden.`);
    const verbanden = verbandenUit(invoer);
    const zonder = [].concat(ev.kapitalen ?? []).filter((k) => KAPITALEN.includes(k)).filter((k) => !verbanden.some((v) => v.naar === `kap:${k}`
      && String(v.van).startsWith('vpc:') && OPLOSSING_ONDERDELEN.includes(v.vpcOnderdeel)));
    return zonder.length === 0
      ? resultaat(id, 'B', 'ok')
      : resultaat(id, 'B', 'let op', `Je koos ${opsomming(zonder)} in je user story (${bron}), maar ${zonder.length === 1 ? 'dat kapitaal is' : 'die kapitalen zijn'} nog niet verbonden met een gain, pain reliever of gain creator.`);
  };
}

/**
 * EV-11 → EV-06 (B): minstens één verband „gaat ten koste van” met een stakeholder uit je stakeholderlijst (EV-06) die dat merkt.
 * Zonder EV-06, zonder spanning, zonder stakeholder of met een stakeholder die niet in de lijst staat: `let op`.
 */
export function spanningMetStakeholder({ id, bron = 'EV-06', ...p }) {
  const rijen = stakeholderRijen({ voor: 's', aantal: 7, ...p });
  const sleutel = (t) => plat(t).toLowerCase();
  return (invoer, context = {}) => {
    const spanningen = verbandenUit(invoer).filter((v) => v.type === SPANNING);
    if (spanningen.length === 0) return resultaat(id, 'B', 'let op', 'Wijs minstens één verband „gaat ten koste van” aan: waar gaat de waarde ten koste van iets?');
    const benoemd = spanningen.filter((v) => gevuld(v.stakeholder));
    if (benoemd.length === 0) return resultaat(id, 'B', 'let op', 'Noem bij een verband „gaat ten koste van” de stakeholder die dat merkt.');
    const ev = context?.eigen?.[bron]?.inhoud ?? context?.records?.[bron]?.inhoud;
    const lijst = ev ? stakeholdersUit(ev, rijen) : [];
    if (lijst.length === 0) return resultaat(id, 'B', 'let op', `Je stakeholderlijst (${bron}, taak 5.1) is nog leeg; daarom kan ik niet nagaan of de stakeholder die de spanning merkt erin staat.`);
    return benoemd.some((v) => lijst.some((s) => sleutel(s.naam) === sleutel(v.stakeholder)))
      ? resultaat(id, 'B', 'ok')
      : resultaat(id, 'B', 'let op', `De stakeholder bij je spanning staat niet in je stakeholderlijst (${bron}); kies een stakeholder uit die lijst.`);
  };
}

/** Fabrieken van dit bestand, op naam (gebruikt door `checks/index.js`). */
export const FABRIEKEN = {
  feedbackGegeven, zieMisVraag, actieMetStatus, nietGelijkAanWissel, eigenNietGelijkAanWissel,
  starrDelen, volgendeStapReflectie, feedbackKoppeling,
  verbandenAanwezig, verbandenAantal, verbandTypen, verbandZinnen, kapitalenGemarkeerd, syntheseAlinea, syntheseKaarten,
  nietZienAntwoorden, userStoryVerbonden, kapitalenUitEv01Verbonden, spanningMetStakeholder,
};
