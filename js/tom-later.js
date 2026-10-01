// Het TOM-bord van taak 8.1 laadt pas als zijn plek in beeld komt (PF-4, ADR B98); hier staan alleen de plekken, het bord zit in
// tombord.js. Een groep geeft meteen lees en zet, zodat opslag en controles niet op het bord wachten.
import { h } from './dom.js';

let geladen = null;
let belofte = null;
let kijker = null;
const wachtend = new Set();
const mislukt = () => document.querySelectorAll('.tm-plek:not(.tm-geladen)').forEach((p) => p.replaceChildren(h('p', { class: 'fout' }, 'Het TOM-model kon niet laden. Herlaad de pagina.')));
function laad() {
  // gewicht-alleen: inbeeld
  belofte ??= import('./tombord.js').then(async (m) => { await m.klaar; geladen = m; wachtend.forEach((vul) => vul(m)); wachtend.clear(); });
  return belofte.catch(mislukt);
}
if (typeof window !== 'undefined') window.addEventListener('beforeprint', laad, { once: true });

/** Een plek die `bouw(module)` tekent zodra hij in beeld komt, of meteen als de module er al is. */
function plekVoor(bouw) {
  const plek = h('div', { class: 'tm-plek' }, h('p', { class: 'klein' }, 'Het TOM-model laadt …'));
  const vul = (m) => { plek.replaceChildren(bouw(m)); plek.classList.add('tm-geladen'); };
  if (geladen) vul(geladen);
  else if (typeof IntersectionObserver !== 'function') { wachtend.add(vul); laad(); }
  else {
    wachtend.add(vul);
    kijker ??= new IntersectionObserver((items) => { if (items.some((i) => i.isIntersecting)) { kijker.disconnect(); laad(); } }, { rootMargin: '300px' });
    kijker.observe(plek);
  }
  return plek;
}

/** De twaalf velden van het TOM-model (tomS1 … tomO4), in leesvolgorde zoals CELLEN in tom.js. */
export const TOM_VELDEN = Object.freeze(['S', 'T', 'O'].flatMap((l) => [1, 2, 3, 4].map((k) => `tom${l}${k}`)));

/** De figuur in de stof: het model om te verkennen. */
export const tomFiguurLater = (opties) => plekVoor((m) => m.tomFiguur(opties));

/** Een bord als invoer ({element, lees, zet, ververs}); tot het bord er is, bewaart de plek de waarden van `ids` zelf. */
export function tomGroepLater({ ids, waarden, maak }) {
  const w = {};
  const zetW = (v = {}) => ids.forEach((id) => { w[id] = typeof v?.[id] === 'string' ? v[id] : ''; });
  zetW(waarden);
  let bord = null;
  const element = plekVoor((m) => { bord = maak(m, { ...w }); return bord.element; });
  return { element, lees: () => (bord ? bord.lees() : { ...w }), zet: (v) => { zetW(v); bord?.zet(v); }, ververs: () => bord?.ververs?.() };
}

/** Het modelantwoord op het bord (TK-6); `ids` zijn de velden die het bord al toont. */
export const tomModelLater = (ids, bouw) => ({ element: plekVoor(bouw), ids: new Set(ids) });
