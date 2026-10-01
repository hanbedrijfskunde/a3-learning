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

/** De vier delen: naam, vraag van het deel, wat jij eruit haalt (kort en uitgelegd) en de vorm van het blok in de zandloper. */
export const IMRAD_DELEN = [
  { deel: 'Inleiding', vraag: 'Waarom dit onderzoek?', haalt: 'theorie', uitleg: 'modellen, begrippen, definities', vorm: 'trechter' },
  { deel: 'Methode', vraag: 'Hoe precies?', haalt: 'methode', uitleg: 'hoe data verzameld en verwerkt zijn', vorm: 'smal' },
  { deel: 'Resultaten', vraag: 'Wat gevonden?', haalt: 'presentatie', uitleg: 'tabel, grafiek of model', vorm: 'smal' },
  { deel: 'Discussie', vraag: 'Wat betekent het?', haalt: 'betekenis', uitleg: 'en de beperkingen van het onderzoek', vorm: 'omgekeerd' },
];

// 320 eenheden breed: op een telefoon van 360 px is de schaal ongeveer 1, dus de letters blijven 13 tot 16 px (eindreview).
const BLOK = 112;
const VORM = { trechter: '10,0 310,0 230,58 90,58', smal: '90,0 230,0 230,58 90,58', omgekeerd: '90,0 230,0 310,58 10,58' };

/** Figuur: de IMRAD-zandloper; in elk blok de vraag van het deel, eronder wat jij eruit haalt (B102). */
export function imradFiguur({ met = (t) => t } = {}) {
  const svg = s('svg', { viewBox: `0 0 320 ${IMRAD_DELEN.length * BLOK}`, role: 'img', 'aria-labelledby': 'imrad-titel', 'aria-describedby': 'imrad-uitleg', class: 'imrad' },
    s('title', { id: 'imrad-titel' }, 'IMRAD: de vier delen van een onderzoeksartikel'),
    s('desc', { id: 'imrad-uitleg' }, IMRAD_DELEN.map((d) => `${d.deel}: ${d.vraag} Jij haalt eruit: ${d.haalt}, ${d.uitleg}.`).join(' ')));
  IMRAD_DELEN.forEach((d, i) => {
    const kleur = i < 3 ? 'var(--accent-donker)' : 'var(--grijs-tekst)';
    svg.append(s('g', { transform: `translate(0, ${i * BLOK + 4})` },
      s('polygon', { points: VORM[d.vorm], style: `fill:${i < 3 ? 'var(--wit)' : 'var(--grijs)'}; stroke:var(--zwart); stroke-width:3` }),
      s('text', { x: 160, y: 24, 'text-anchor': 'middle', style: 'font:700 16px var(--f)' }, d.deel),
      s('text', { x: 160, y: 44, 'text-anchor': 'middle', style: 'font:13px var(--f)' }, d.vraag),
      s('text', { x: 160, y: 80, 'text-anchor': 'middle', style: `font:700 14px var(--f); fill:${kleur}` }, `→ ${d.haalt}`),
      s('text', { x: 160, y: 98, 'text-anchor': 'middle', style: 'font:13px var(--f)' }, d.uitleg)));
  });
  return h('figure', { class: 'a3-vel imrad-figuur' }, svg,
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

/** Het voorbeeld van de collega bij de oefening van 4.3 (B104): een AI-samenvatting met de AAOCC-oordelen die de tool er telkens bij geeft. */
export function aiSamenvatting({ met = (t) => t, taak } = {}) {
  const v = taak?.oefening?.voorbeeld;
  if (!v) return null;
  return h('figure', { class: 'ai-voorbeeld' },
    h('figcaption', {}, h('strong', {}, 'Voorbeeld van de collega'), ' · AI-samenvatting van ', met(`(${v.citatie})`)),
    h('p', {}, met(v.samenvatting)),
    // Een lijst en geen tabel: op 360 px breekt een tabel met drie kolommen de woorden af.
    h('p', { class: 'ai-kop' }, 'AAOCC-check die de tool bij elke samenvatting uitvoert'),
    h('dl', { class: 'ai-aaocc' }, v.aaocc.flatMap(([c, o, u]) => [h('dt', {}, h('span', { lang: 'en' }, c), ' ', h('span', { class: 'ai-oordeel' }, o)), h('dd', {}, u)])));
}

/** Na welke alinea van de stof een figuur staat (0 = de eerste). */
export const FIGUREN = { imrad: { bouw: imradFiguur, na: 0 }, miniartikelen: { bouw: miniArtikelen, na: 0 }, aisamenvatting: { bouw: aiSamenvatting, na: 0 } };
