// De figuren van leerblok 2 (ADR B102): IMRAD als eigen zandloper (SX-15) en de twee fictieve mini-artikelen van de oefening bij
// taak 4.2. Alleen geladen op een pagina waarvan de data ze gebruikt (`// gewicht-alleen: figurenlb2` in leerblok.js, PF-4).
// De vorm van IMRAD volgt de bekende zandloper; niets is overgenomen uit Wu (2011), dat alleen geciteerd wordt.
import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) el.append(k);
  return el;
};

/** De vier delen: naam, vraag van het deel, wat jij eruit haalt, en de vorm (breed naar smal, smal, smal, smal naar breed). */
export const IMRAD_DELEN = [
  ['Inleiding', 'Waarom dit onderzoek?', 'theorie: modellen, begrippen, definities', 'trechter'],
  ['Methode', 'Hoe precies?', 'methode: hoe data verzameld en verwerkt zijn', 'smal'],
  ['Resultaten', 'Wat gevonden?', 'presentatie: tabel, grafiek of model', 'smal'],
  ['Discussie', 'Wat betekent het?', 'betekenis en beperkingen', 'omgekeerd'],
];

const VORM = { trechter: '20,0 300,0 230,70 90,70', smal: '90,0 230,0 230,70 90,70', omgekeerd: '90,0 230,0 300,70 20,70' };

/** Figuur: de IMRAD-zandloper met per deel de vraag en wat jij eruit haalt (B102). */
export function imradFiguur({ met = (t) => t } = {}) {
  const svg = s('svg', { viewBox: '0 0 640 340', role: 'img', 'aria-labelledby': 'imrad-titel imrad-uitleg', class: 'imrad' },
    s('title', { id: 'imrad-titel' }, 'IMRAD: de vier delen van een onderzoeksartikel'),
    s('desc', { id: 'imrad-uitleg' }, IMRAD_DELEN.map(([d, v, w]) => `${d}: ${v} Jij haalt eruit: ${w}.`).join(' ')));
  IMRAD_DELEN.forEach(([deel, vraag, wat, vorm], i) => {
    svg.append(s('g', { transform: `translate(0, ${i * 82 + 8})` },
      s('polygon', { points: VORM[vorm], style: `fill:${i < 3 ? 'var(--wit)' : 'var(--grijs)'}; stroke:var(--zwart); stroke-width:3` }),
      s('text', { x: 160, y: 32, 'text-anchor': 'middle', style: 'font:700 18px var(--f)' }, deel),
      s('text', { x: 160, y: 54, 'text-anchor': 'middle', style: 'font:14px var(--f)' }, vraag),
      s('text', { x: 318, y: 42, style: `font:700 15px var(--f); fill:${i < 3 ? 'var(--accent-donker)' : 'var(--grijs-tekst)'}` }, `→ ${wat}`)));
  });
  return h('figure', { class: 'a3-vel' }, svg,
    h('figcaption', {}, h('p', {}, 'Figuur: IMRAD. De Inleiding begint breed, bij wat al bekend is, en eindigt smal, bij de eigen vraag. De Discussie gaat van de eigen uitkomst weer naar het brede beeld. Naar ', met('(Wu, 2011)'), '.')));
}

/** Een staafdiagram uit `grafiek.rijen`; de laagste staaf in accent, de titel draagt de kernboodschap. */
function grafiekEl(gr) {
  const max = Math.max(...gr.rijen.map(([, w]) => w));
  const breed = (w) => Math.round((w / max) * 220);
  const komma = (w) => String(w).replace('.', ',');
  const svg = s('svg', { viewBox: `0 0 400 ${gr.rijen.length * 34 + 10}`, role: 'img', class: 'mini-grafiek',
    'aria-label': `${gr.titel}. ${gr.rijen.map(([l, w]) => `${l} ${komma(w)}`).join(', ')}.` });
  gr.rijen.forEach(([label, w], i) => {
    const y = i * 34 + 6;
    svg.append(
      s('text', { x: 0, y: y + 18, style: 'font:13px var(--f)' }, label),
      s('rect', { x: 110, y, width: breed(w), height: 24, style: `fill:${label === gr.laagste ? 'var(--accent)' : 'var(--zwart)'}` }),
      s('text', { x: 116 + breed(w), y: y + 18, style: 'font:700 13px var(--f)' }, komma(w)));
  });
  return h('figure', { class: 'mini-figuur' }, h('figcaption', {}, h('strong', {}, gr.titel), gr.eenheid ? ` (${gr.eenheid})` : ''), svg);
}

/** De twee fictieve mini-artikelen van de oefening bij 4.2: naast elkaar op een breed scherm, onder elkaar op de telefoon. */
export function miniArtikelen({ met = (t) => t, taak } = {}) {
  const artikelen = taak?.oefening?.artikelen ?? [];
  return h('div', { class: 'mini-artikelen' }, artikelen.map((a, n) => h('article', { class: 'mini-artikel', 'aria-labelledby': `mini-${n + 1}` },
    h('p', { class: 'klein fictief' }, 'Verzonnen artikel voor deze oefening'),
    h('h5', { id: `mini-${n + 1}` }, `Artikel ${n + 1} · ${a.kop}`),
    h('p', { class: 'klein' }, met(`(${a.citatie})`)),
    a.secties.flatMap((sec) => [h('h6', {}, sec.kop), h('p', {}, met(sec.tekst)), sec.kop === 'Resultaten' && a.grafiek ? grafiekEl(a.grafiek) : null]))));
}

/** Na welke alinea van de stof een figuur staat (0 = de eerste). */
export const FIGUREN = { imrad: { bouw: imradFiguur, na: 0 }, miniartikelen: { bouw: miniArtikelen, na: 0 } };
