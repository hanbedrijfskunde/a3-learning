// Controles van leerblok 3 (EV-06, EV-07, EV-08) en de samenhangcontroles EV-01 → EV-06, EV-07 → EV-02 en EV-08 → EV-06
// (BW-10). Zuiver (BW-8). Rijen velden staan kort als `voor` en `aantal`: rij i heeft de velden <voor>i + achtervoegsel
// (s1naam: naam, soort, raakt, invloed, belang; b1tekst: tekst, label, onderdeel, bron, zoek); een lijst `rijen` mag ook.
// Context voor soort B: `context.eigen['EV-01']` en `['EV-02']` (leerblok 1, zie wissel.js), `context.records['EV-06']`.
import { resultaat } from './core.js';
import { stakeholdersUit, stakeholderRijen, reeks } from '../raster.js';

export const REGISTER_SUFFIXEN = Object.freeze(['tekst', 'label', 'onderdeel', 'bron', 'zoek']);
const registerRijen = ({ rijen, voor, aantal }) => rijen ?? reeks(voor, aantal, REGISTER_SUFFIXEN);
const isLeeg = (w) => w === undefined || w === null || (typeof w === 'string' && w.trim() === '') || (Array.isArray(w) && w.length === 0);
const tekst = (w) => (typeof w === 'string' ? w.trim() : '');
const enLijst = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} en ${l[l.length - 1]}` : l.join(''));

// ---------------------------------------------------------------- woorden vergelijken (heuristiek voor de samenhang)

const STOPWOORDEN = new Set(['de', 'het', 'een', 'van', 'voor', 'en', 'of', 'bij', 'op', 'in', 'met', 'aan', 'die', 'dat', 'te', 'uit', 'als', 'om', 'zijn', 'haar']);
/** Woorden als stammen: „klanten” en „klant” geven dezelfde stam. */
export const woordStammen = (t) => tekst(t).toLowerCase().split(/[^\p{L}\p{N}]+/u)
  .filter((w) => w.length >= 2 && !STOPWOORDEN.has(w)).map((w) => (w.length > 4 ? w.replace(/(en|s|n|e)$/u, '') : w));

/** De helft van de woorden van `naam` (naar boven afgerond, minstens één) staat in `stammen`. */
const bevatNaam = (stammen, naam) => {
  const delen = woordStammen(naam);
  return delen.length > 0 && delen.filter((d) => stammen.includes(d)).length >= Math.ceil(delen.length / 2);
};
/** Noemt de tekst minstens één van de stakeholders bij naam? */
export const noemtEenVan = (t, stakeholders) => stakeholders.some((s) => bevatNaam(woordStammen(t), s.naam));

/** Staat de gebruiker (EV-01) in de lijst? „terugkerende klanten van webshop X” en „klanten” tellen als dezelfde partij (helft van de woorden van de kortste naam). */
export function gebruikerStaatInLijst(gebruiker, stakeholders) {
  const g = woordStammen(gebruiker);
  return g.length > 0 && stakeholders.some((s) => {
    const n = woordStammen(s.naam);
    return n.length > 0 && n.filter((w) => g.includes(w)).length >= Math.ceil(Math.min(n.length, g.length) / 2);
  });
}

// ---------------------------------------------------------------- EV-06: stakeholders

/** Minstens `min` stakeholders met een naam. Geen: `mist`; te weinig: `let op`. */
export function stakeholdersAantal({ id, min = 5, ...p }) {
  const rijen = stakeholderRijen(p);
  return (invoer) => {
    const n = stakeholdersUit(invoer, rijen).length;
    if (n === 0) return resultaat(id, 'A', 'mist', `Noteer minstens ${min} stakeholders.`);
    if (n < min) return resultaat(id, 'A', 'let op', `Je hebt ${n} ${n === 1 ? 'stakeholder' : 'stakeholders'}; noteer er minstens ${min}.`);
    return resultaat(id, 'A', 'ok');
  };
}

/** Minstens één interne en één externe stakeholder. Geen stakeholders: `mist`; één soort ontbreekt: `let op`. */
export function internEnExtern({ id, ...p }) {
  const rijen = stakeholderRijen(p);
  return (invoer) => {
    const lijst = stakeholdersUit(invoer, rijen);
    if (lijst.length === 0) return resultaat(id, 'A', 'mist', 'Noteer stakeholders, minstens één intern en één extern.');
    const ontbreekt = ['intern', 'extern'].filter((soort) => !lijst.some((s) => s.soort === soort));
    return ontbreekt.length > 0
      ? resultaat(id, 'A', 'let op', `Er staat nog geen ${enLijst(ontbreekt)} stakeholder in je lijst; kies intern of extern bij elke stakeholder.`)
      : resultaat(id, 'A', 'ok');
  };
}

/** Bij elke stakeholder zijn invloed, belang en de relatie met het vraagstuk ingevuld. */
export function stakeholderVelden({ id, ...p }) {
  const rijen = stakeholderRijen(p);
  const hl = (w) => ['hoog', 'laag'].includes(w);
  return (invoer) => {
    const lijst = stakeholdersUit(invoer, rijen);
    if (lijst.length === 0) return resultaat(id, 'A', 'mist', 'Noteer stakeholders met invloed, belang en de relatie met het vraagstuk.');
    const gaten = lijst.map((s) => {
      const mist = [!hl(s.invloed) && 'invloed', !hl(s.belang) && 'belang', s.raakt === '' && 'de relatie met het vraagstuk'].filter(Boolean);
      return mist.length > 0 ? `${s.naam}: ${enLijst(mist)}` : null;
    }).filter(Boolean);
    return gaten.length > 0
      ? resultaat(id, 'A', 'let op', `Vul bij elke stakeholder invloed, belang en de relatie in (${gaten.join('; ')}).`)
      : resultaat(id, 'A', 'ok');
  };
}

/** EV-01 → EV-06 (B): de gebruiker uit de onderzoeksvraag staat in de lijst. Zonder EV-01: `let op`; zonder passende stakeholder: `mist`. */
export function gebruikerInLijst({ id, bron = 'EV-01', ...p }) {
  const rijen = stakeholderRijen(p);
  return (invoer, context = {}) => {
    const gebruiker = tekst(context?.eigen?.[bron]?.inhoud?.gebruiker);
    if (gebruiker === '') return resultaat(id, 'B', 'let op', `Je onderzoeksvraag uit leerblok 1 (${bron}) is nog leeg; daarom kan ik niet nagaan of je gebruiker in de lijst staat.`);
    return gebruikerStaatInLijst(gebruiker, stakeholdersUit(invoer, rijen))
      ? resultaat(id, 'B', 'ok')
      : resultaat(id, 'B', 'mist', `Je gebruiker uit ${bron} („${gebruiker}”) staat niet in je stakeholderlijst. Zet hem erin, of pas je onderzoeksvraag aan.`);
  };
}

// ---------------------------------------------------------------- EV-07: register van feit en aanname

const beweringenVan = (invoer, rijen) => rijen.map(([t, l, o, b, z], i) => ({
  nr: i + 1, tekst: tekst(invoer?.[t]), label: tekst(invoer?.[l]), onderdeel: tekst(invoer?.[o]), bron: tekst(invoer?.[b]), zoek: tekst(invoer?.[z]),
})).filter((b) => b.tekst !== '');
const volgnummers = (lijst, wat) => lijst.map((b) => `bewering ${b.nr}: ${wat(b)}`).join('; ');

/** Minstens `min` kernbeweringen, elk met label en onderdeel (LB-12). Geen: `mist`; onvolledig of te weinig: `let op`. */
export function beweringenGelabeld({ id, min = 3, ...p }) {
  const rijen = registerRijen(p);
  return (invoer) => {
    const lijst = beweringenVan(invoer, rijen);
    if (lijst.length === 0) return resultaat(id, 'A', 'mist', `Schrijf minstens ${min} kernbeweringen in het register, elk als feit of aanname en gekoppeld aan een onderdeel.`);
    const gaten = lijst.map((b) => ({ ...b, mist: [b.label === '' && 'feit of aanname', b.onderdeel === '' && 'onderdeel'].filter(Boolean) })).filter((b) => b.mist.length > 0);
    if (gaten.length > 0) return resultaat(id, 'A', 'let op', `Kies bij elke bewering feit of aanname en een onderdeel (${volgnummers(gaten, (b) => enLijst(b.mist))}).`);
    return lijst.length < min
      ? resultaat(id, 'A', 'let op', `Je register heeft ${lijst.length} ${lijst.length === 1 ? 'bewering' : 'beweringen'}; schrijf er minstens ${min}.`)
      : resultaat(id, 'A', 'ok');
  };
}

/** Elk feit heeft een herkomst of bron. Geen feiten: `ok`. */
export function feitMetHerkomst({ id, ...p }) {
  const rijen = registerRijen(p);
  return (invoer) => {
    const zonder = beweringenVan(invoer, rijen).filter((b) => b.label === 'feit' && b.bron === '');
    return zonder.length === 0
      ? resultaat(id, 'A', 'ok')
      : resultaat(id, 'A', 'let op', `Een feit heeft een herkomst nodig: waar komt het vandaan? (${volgnummers(zonder, () => 'noem de bron of herkomst')}).`);
  };
}

/** EV-07 → EV-02 (B): elke aanname wijst naar een zoekvraag die in EV-02 staat. Geen aannames: `ok`; anders `let op`. */
export function aannameMetZoekvraag({ id, bron = 'EV-02', ...p }) {
  const rijen = registerRijen(p);
  return (invoer, context = {}) => {
    const aannames = beweringenVan(invoer, rijen).filter((b) => b.label === 'aanname');
    const zonder = aannames.filter((b) => !/\d$/.test(b.zoek));
    if (zonder.length > 0) return resultaat(id, 'B', 'let op', `Koppel elke aanname aan een zoekvraag uit leerblok 1 (${volgnummers(zonder, () => 'kies een zoekvraag')}).`);
    const inhoud = context?.eigen?.[bron]?.inhoud;
    const leeg = aannames.filter((b) => tekst(inhoud?.[`zoekvraag${b.zoek.slice(-1)}`]) === '');
    if (leeg.length === 0) return resultaat(id, 'B', 'ok');
    return resultaat(id, 'B', 'let op', inhoud
      ? `Een aanname wijst naar een zoekvraag die in leerblok 1 (${bron}) leeg is (${volgnummers(leeg, (b) => b.zoek)}).`
      : `Je zoekvragen uit leerblok 1 (${bron}) ontbreken nog; daarom kan ik niet nagaan of je aannames naar een zoekvraag wijzen.`);
  };
}

/** Minstens `min` van de velden is ingevuld (soort C, alleen tellen): de cellen van het TOM-model. Geen: `mist`; te weinig: `let op`. */
export function minGevuld({ id, velden, min, label }) {
  return (invoer) => {
    const n = velden.filter((v) => !isLeeg(invoer?.[v])).length;
    if (n === 0) return resultaat(id, 'C', 'mist', `Vul ${label} in: minstens ${min} velden.`);
    return n < min ? resultaat(id, 'C', 'let op', `Je vulde ${n} van de ${min} velden in die ik minstens verwacht; ${label}.`) : resultaat(id, 'C', 'ok');
  };
}

/** De bouwsteen die het hardst wordt geraakt is een van de aangevinkte bouwstenen (soort B, binnen dit onderdeel). */
export function hardstBinnenGeraakt({ id, veld, geraaktVeld }) {
  return (invoer) => {
    const hardst = tekst(invoer?.[veld]);
    const geraakt = [].concat(invoer?.[geraaktVeld] ?? []);
    return hardst === '' || geraakt.length === 0 || geraakt.includes(hardst)
      ? resultaat(id, 'B', 'ok')
      : resultaat(id, 'B', 'let op', `„${hardst}” is niet aangevinkt bij de bouwstenen die worden geraakt; vink hem aan of kies een andere bouwsteen.`);
  };
}

// ---------------------------------------------------------------- EV-08: plaatsing en onderzoeksvraag

/** EV-08 → EV-06 (B): elke ingevulde tekst uit `velden` noemt een stakeholder uit EV-06. Zonder stakeholders: `let op`; lege velden telt soort A. */
export function noemtStakeholder({ id, velden, label = 'je antwoorden', bron = 'EV-06', ...p }) {
  const rijen = stakeholderRijen(p);
  return (invoer, context = {}) => {
    const teksten = velden.map((v) => tekst(invoer?.[v])).filter((t) => t !== '');
    if (teksten.length === 0) return resultaat(id, 'B', 'ok');
    const lijst = stakeholdersUit(context?.records?.[bron]?.inhoud, rijen);
    if (lijst.length === 0) return resultaat(id, 'B', 'let op', `Je stakeholderlijst (${bron}, taak 5.1) is nog leeg; daarom kan ik niet nagaan of ${label} een stakeholder noemen.`);
    const zonder = teksten.filter((t) => !noemtEenVan(t, lijst));
    return zonder.length > 0
      ? resultaat(id, 'B', 'let op', `Noem in ${zonder.length === 1 ? 'dit antwoord' : 'deze antwoorden'} minstens één stakeholder uit je lijst (${enLijst(lijst.slice(0, 3).map((s) => s.naam))}, …).`)
      : resultaat(id, 'B', 'ok');
  };
}

/** Alles aangevinkt: elk veld in `velden` heeft een vinkje, of alle opties van `veld` zijn gekozen. Niets: `leegIs` (`mist`); een deel: `let op`. */
export function alleAangevinkt({ id, veld, velden, label, toegestaan = [], leegIs = 'mist' }) {
  return (invoer) => {
    const totaal = velden ? velden.length : toegestaan.length;
    const gezet = velden ? velden.filter((v) => !isLeeg(invoer?.[v])).length : toegestaan.filter((o) => [].concat(invoer?.[veld] ?? []).includes(o)).length;
    if (gezet === totaal && totaal > 0) return resultaat(id, 'A', 'ok');
    return resultaat(id, 'A', gezet === 0 ? leegIs : 'let op', `Vink ${label} aan (${gezet} van ${totaal}).`);
  };
}

/** Fabrieken van dit bestand, op naam (gebruikt door `checks/index.js`). */
export const FABRIEKEN = {
  stakeholdersAantal, internEnExtern, stakeholderVelden, gebruikerInLijst,
  beweringenGelabeld, feitMetHerkomst, aannameMetZoekvraag, minGevuld, hardstBinnenGeraakt,
  noemtStakeholder, alleAangevinkt,
};
