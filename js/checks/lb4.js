// Controles van leerblok 4, voor zover ze bij de Wissel horen (EV-09, WS-7, WS-8), en de kopiecontrole voor EV-01 en EV-02.
// Fase 11 voegt hier de controles van EV-10 en EV-11 aan toe. Zuiver: geen DOM, geen netwerk, geen opslag (BW-8).
//
// De feedbacklog is de invoer `regels` (lijst van { richting, rol, zie, mis, vraag, actie, status }).
// Context: `context.wissel.ontvangen` (ontvangen wisselblokken) en `context.eigen` (eigen records EV-01, EV-02), zie wissel.js.
import { resultaat, tellers } from './core.js';
import { gelijkAanWissel, plat, ACTIE_STATUSSEN } from '../wissel.js';
import { stelVraagSamen } from './lb1.js';

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
 * ingevulde velden: `ok`. Voor EV-11 komt in fase 11 een derde onderdeel.
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
    } else throw new Error(`Controle ${id}: onbekend onderdeel ${onderdeel}`);
    return gelijkAanWissel(ontvangen, eigen).length > 0 ? resultaat(id, soort, 'let op', KOPIE_MELDING(wat)) : resultaat(id, soort, 'ok');
  };
}

/**
 * EV-09: de eigen EV-01 en EV-02 zijn niet letterlijk gelijk aan het ontvangen wisselblok (0 tekens verschil = `let op`).
 * Leest de eigen records uit `context.eigen`; ontbreken die, dan is er niets te vergelijken en is het resultaat `ok`.
 */
export function eigenNietGelijkAanWissel({ id, soort = 'B' }) {
  return (invoer, context = {}) => {
    const ontvangen = context?.wissel?.ontvangen ?? [];
    const e1 = context?.eigen?.['EV-01']?.inhoud;
    const e2 = context?.eigen?.['EV-02']?.inhoud;
    const eigen = {
      vraag: e1 && ['gebruiker', 'pain', 'waarde'].every((v) => gevuld(e1[v])) ? stelVraagSamen(e1) : '',
      zoekvragen: e2 ? [1, 2, 3].map((n) => e2[`zoekvraag${n}`]) : [],
    };
    const gelijk = gelijkAanWissel(ontvangen, eigen);
    if (gelijk.length === 0) return resultaat(id, soort, 'ok');
    return resultaat(id, soort, 'let op', KOPIE_MELDING(`je ${gelijk.map((g) => (g === 'zoekvragen' ? 'zoekvragen in EV-02' : 'onderzoeksvraag in EV-01')).join(' en ')}`));
  };
}

/** Fabrieken van dit bestand, op naam (gebruikt door `checks/index.js`). */
export const FABRIEKEN = { feedbackGegeven, zieMisVraag, actieMetStatus, nietGelijkAanWissel, eigenNietGelijkAanWissel };
