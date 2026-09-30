// De figuren van leerblok 1 (het A3-vel en de six capitals), als citaat met bronvermelding (ADR B84). Alleen geladen op een pagina
// waarvan de data ze gebruikt (`// gewicht-alleen: figurenlb1` in leerblok.js, PF-4); FIGUREN zegt na welke alinea ze staan.
import { h } from './dom.js';

/** Hoe de blokken van het A3-sjabloon uit de figuur bij de acht vakken van het werkboek (1.1) horen. */
const A3_KOPPELING = [
  ['Plan', 'Background', '1 · Aanleiding / achtergrond'], ['Plan', 'Current Condition', '2 · Huidige situatie'],
  ['Plan', 'Goal', '3 · Doelen'], ['Plan', 'Root Cause Analysis', '4 · Analyse'],
  ['Do', 'Countermeasures', '5 · Toekomstige situatie en 6 · Implementatie'],
  ['Check', 'Effect Confirmation', '7 · Borging en evaluatie'], ['Act', 'Follow-Up Actions', '8 · Next steps'],
];

/**
 * Figuur: het A3-sjabloon met PDCA uit Schwagerman & Ulmer (2013), als citaat met bronvermelding (media/citaten.json,
 * ADR B84). Lui geladen: het beeld staat in de stap stof en telt niet mee voor de eerste lading (PF-4). Onder de figuur
 * staat welk Engels blok bij welk vak van het werkboek hoort.
 */
export function a3VelFiguur({ met = (t) => t } = {}) {
  return h('figure', { class: 'a3-vel citaat' },
    h('img', {
      src: 'media/citaten/schwagerman-ulmer-2013-figuur-1.png', width: 1202, height: 892, loading: 'lazy', decoding: 'async',
      alt: 'Een A3-sjabloon. Links vier blokken onder elkaar: Background, Current Condition, Goal en Root Cause Analysis, samen Plan. Rechts drie blokken: Countermeasures (Do), Effect Confirmation (Check) en Follow-Up Actions (Act). Pijlen lopen van Plan naar Do, omlaag naar Check en Act, en terug naar Plan.',
    }),
    h('figcaption', {},
      h('p', {}, 'Figuur: het A3-sjabloon met de cirkel plan, do, check, act. Overgenomen uit ', met('(Schwagerman & Ulmer, 2013)'), ', figuur 1, via ', h('a', { href: 'https://www.semanticscholar.org/paper/The-A3-Lean-Management-and-Leadership-Thought-Schwagerman/c2db12278e49858626968aa7d02410dc1f337ed5/figure/0' }, 'Semantic Scholar'), '. De licentie van deze site geldt niet voor deze figuur.'),
      h('details', { class: 'a3-koppeling' }, h('summary', {}, 'Zo horen de blokken bij de acht vakken van het werkboek'),
        h('table', {}, h('thead', {}, h('tr', {}, ['PDCA', 'Blok in de figuur', 'Vak in het werkboek'].map((k) => h('th', { scope: 'col' }, k)))),
          h('tbody', {}, A3_KOPPELING.map(([f, en, nl]) => h('tr', {}, h('td', {}, f), h('td', { lang: 'en' }, en), h('td', {}, nl))))))));
}

/** De zes kapitalen uit de figuur van het IIRC, met de Nederlandse naam uit de stof van taak 2.1. */
const KAPITALEN = [
  ['Financial', 'Financieel'], ['Manufactured', 'Productie'], ['Intellectual', 'Intellectueel'],
  ['Human', 'Menselijk'], ['Social and relationship', 'Sociaal en relationeel'], ['Natural', 'Natuurlijk'],
];

/**
 * Figuur: het waardecreatieproces met de six capitals uit het <IR>-framework (IIRC, 2021), als citaat met bronvermelding
 * (media/citaten.json, ADR B84). Lui geladen zoals het A3-vel (PF-4). Onder de figuur staat de Nederlandse naam van elk kapitaal.
 */
export function sixCapitalsFiguur({ met = (t) => t } = {}) {
  return h('figure', { class: 'a3-vel citaat' },
    h('img', {
      src: 'media/citaten/iirc-2021-waardecreatieproces.webp', width: 1110, height: 550, loading: 'lazy', decoding: 'async',
      alt: 'Het waardecreatieproces van het IIRC. Links zes blauwe kapitalen als input: Financial, Manufactured, Intellectual, Human, Social and relationship en Natural. Ze lopen via het businessmodel in het midden (inputs, business activities, outputs) naar outcomes. Rechts staan dezelfde zes kapitalen in groen als uitkomst. Een pijl onderaan loopt terug naar links: de uitkomsten worden weer input. Onder de figuur: value creation, preservation or erosion over time.',
    }),
    h('figcaption', {},
      h('p', {}, 'Figuur: de six capitals gaan als input een organisatie in en komen er als uitkomst weer uit, groter of kleiner dan ze waren. Overgenomen uit ', met('(International Integrated Reporting Council, 2021)'), ', figuur van het waardecreatieproces, via ', h('a', { href: 'https://www.ok-methode.nl/2021/11/09/six-capitals-van-het-iirc-model/' }, 'OK-methode'), '. De licentie van deze site geldt niet voor deze figuur.'),
      h('details', { class: 'a3-koppeling' }, h('summary', {}, 'De zes kapitalen in het Nederlands'),
        h('table', {}, h('thead', {}, h('tr', {}, ['In de figuur', 'Kapitaal'].map((k) => h('th', { scope: 'col' }, k)))),
          h('tbody', {}, KAPITALEN.map(([en, nl]) => h('tr', {}, h('td', { lang: 'en' }, en), h('td', {}, nl))))))));
}

/** Na welke alinea van de stof een figuur staat (0 = de eerste). */
export const FIGUREN = { 'a3-vel': { bouw: a3VelFiguur, na: 0 }, 'six-capitals': { bouw: sixCapitalsFiguur, na: 1 } };
