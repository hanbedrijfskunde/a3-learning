// Metrokaart bovenaan elke studentpagina (SX-18, SX-19; ADR B110; DESIGN §6 Metrokaart). Alleen DOM: het model staat in
// metro-model.js, de maten in metro-indeling.js. Tekent opnieuw bij een adreswissel, bij `a3-voortgang` (leerblok.js,
// media.js) en bij een andere breedte. Laadt de data niet, dan komt er geen kaart en werkt de pagina gewoon (spec §5).
import { h, wis } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import { normaliseerBlok } from './blok.js';
import { leesAdres } from './taakweergave.js';
import { metroModel, laatsteLeerblok } from './metro-model.js';
import { metroIndeling, vormSleutel } from './metro-indeling.js';

const SVG = 'http://www.w3.org/2000/svg';
/** Een SVG-element (h() in dom.js maakt HTML-elementen). */
function s(tag, attrs = {}, ...kinderen) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  for (const kind of kinderen.flat()) if (kind !== undefined && kind !== null) el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  return el;
}
const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();

/** Neemt attributen en tekst van `nieuw` over in `oud` (zelfde vorm), zodat CSS-overgangen zoals het vullen van een halte afspelen. */
function werkBij(oud, nieuw) {
  for (const a of [...oud.attributes]) if (!nieuw.hasAttribute(a.name)) oud.removeAttribute(a.name);
  for (const a of [...nieuw.attributes]) if (oud.getAttribute(a.name) !== a.value) oud.setAttribute(a.name, a.value);
  if (nieuw.children.length === 0) { if (oud.textContent !== nieuw.textContent) oud.textContent = nieuw.textContent; return; }
  [...nieuw.children].forEach((kind, i) => werkBij(oud.children[i], kind));
}

/** De kaart als SVG: sporen en labels zijn decoratief, de haltes zijn links in een lijst. */
export function tekenMetro(model, breedte, ind = metroIndeling(model, breedte)) {
  const svg = s('svg', {
    // kleur via klassen, niet via een style-attribuut: de CSP van het dossier (style-src 'self') blokkeert inline stijl
    class: `metro-kaart lijn-${model.leerblok}`, viewBox: `0 0 ${breedte} ${ind.hoogte}`, width: breedte, height: ind.hoogte,
    role: 'list', 'aria-label': model.label,
  });
  for (const sp of ind.sporen) {
    svg.append(s('line', {
      x1: sp.x1, y1: sp.y1, x2: sp.x2, y2: sp.y2, 'aria-hidden': 'true',
      class: `metro-spoor${sp.gestippeld ? ' gestippeld' : ''}${sp.lijn === model.leerblok ? '' : ` spoor-lijn-${sp.lijn}`}`,
    }));
  }
  for (const l of ind.labels) {
    svg.append(s('text', { x: l.x, y: l.y, 'text-anchor': l.anker, class: `metro-label metro-label-${l.soort}`, 'aria-hidden': 'true' }, l.tekst));
  }
  for (const h of ind.haltes) {
    // de rol listitem staat op een omhullende g: op de link zelf zou ze de linkrol vervangen (schermlezers, axe aria-allowed-role)
    svg.append(s('g', { role: 'listitem' },
      s('a', {
        href: h.href, 'aria-label': h.naam, 'aria-current': h.stand === 'hier' ? 'step' : null,
        // voor het infovenster (SX-20): titel, thema en de plek van de halte in de breedte
        'data-titel': h.info.titel, 'data-thema': h.info.thema, 'data-x': h.x,
        class: `metro-halte halte-${h.stand} halte-${h.soort}${h.gestippeld ? ' halte-niet-gekozen' : ''}`,
      },
      s('rect', { class: 'metro-tik', x: h.tik.x, y: h.tik.y, width: h.tik.b, height: h.tik.h }),
      s('circle', { cx: h.x, cy: h.y, r: h.r }))));
  }
  return svg;
}

async function plaatsMetro() {
  const nummer = Number(document.body.dataset.leerblok) || null;
  const header = document.querySelector('body > header');
  if (!header) return;
  const { opslag } = kiesOpslag();
  const store = maakStore(opslag);
  const laatste = nummer ? null : laatsteLeerblok(store);
  const elders = laatste?.leerblok;
  // Leerblokpagina's lezen hun eigen bestand; start, dossier en bronnen dat van de laatste positie (tools/gewicht-check.mjs: ${elders}).
  const blok = normaliseerBlok(nummer ? await laad(`../data/leerblok-${nummer}.json`) : await laad(`../data/leerblok-${elders}.json`));
  const ids = blok.taken.map((t) => t.id);
  const adres = () => (nummer ? leesAdres(location.hash, ids) : { soort: 'elders', ...laatste });

  const doek = h('div', { class: 'metro-doek' });
  const regel = h('p', { class: 'metro-regel' });
  // Eén gedeeld infovenster (SX-20, ADR B112): titel en thema van de halte waar de muis of de focus op staat.
  const infoTitel = h('strong', {});
  const infoThema = h('span', {});
  const info = h('div', { class: 'metro-info', id: 'metro-info', role: 'tooltip', hidden: true }, infoTitel, infoThema);
  const nav = h('nav', { class: 'metro', 'aria-label': `Waar je bent in leerblok ${blok.leerblok}` }, doek, regel, info);
  header.after(nav);
  let bij = null; // de halte waar het venster nu bij hoort
  let sluitStraks = null;
  function sluitInfo() {
    clearTimeout(sluitStraks);
    info.hidden = true;
    bij?.removeAttribute('aria-describedby');
    bij = null;
  }
  function toonInfo(a) {
    clearTimeout(sluitStraks);
    if (bij && bij !== a) bij.removeAttribute('aria-describedby');
    bij = a;
    infoTitel.textContent = a.dataset.titel;
    infoThema.textContent = a.dataset.thema;
    a.setAttribute('aria-describedby', 'metro-info');
    info.hidden = false;
    // onder de kaart, bij de halte en binnen de breedte van de kaart: over de kaart zou het venster de tikstroken bedekken.
    // Positie via CSSOM, dat de CSP van het dossier toestaat.
    const kaart = doek.firstElementChild.getBoundingClientRect();
    const basis = nav.getBoundingClientRect();
    const links = kaart.left - basis.left;
    const midden = links + Number(a.dataset.x);
    const b = info.offsetWidth;
    info.style.left = `${Math.max(links, Math.min(midden - b / 2, links + kaart.width - b))}px`;
    info.style.top = `${kaart.bottom - basis.top + 4}px`;
  }
  const halteVan = (el) => el?.closest?.('a.metro-halte') ?? null;
  const planSluit = () => { clearTimeout(sluitStraks); sluitStraks = setTimeout(sluitInfo, 150); };
  doek.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const a = halteVan(e.target); if (a) toonInfo(a); });
  doek.addEventListener('pointerout', (e) => { if (e.pointerType !== 'touch' && halteVan(e.target)) planSluit(); });
  // het venster blijft staan zolang de muis erop staat (WCAG 1.4.13)
  info.addEventListener('pointerenter', () => clearTimeout(sluitStraks));
  info.addEventListener('pointerleave', planSluit);
  doek.addEventListener('focusin', (e) => { const a = halteVan(e.target); if (a) toonInfo(a); });
  doek.addEventListener('focusout', (e) => { if (!halteVan(e.relatedTarget)) sluitInfo(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !info.hidden) sluitInfo(); });
  let breedte = 0;
  let vorm = null;
  function teken() {
    breedte = Math.floor(doek.clientWidth) || 328;
    const model = metroModel({ blok, store, adres: adres() });
    const ind = metroIndeling(model, breedte);
    const nieuw = tekenMetro(model, breedte, ind);
    const sleutel = vormSleutel(ind);
    if (doek.firstElementChild && sleutel === vorm) werkBij(doek.firstElementChild, nieuw); else { sluitInfo(); wis(doek).append(nieuw); }
    vorm = sleutel;
    regel.textContent = model.tekst;
  }
  teken();
  // Meldingen komen soms vlak na elkaar (typen, bewaren, adreswissel): één tekening per frame is genoeg.
  let gepland = false;
  const straks = () => { if (gepland) return; gepland = true; requestAnimationFrame(() => { gepland = false; teken(); }); };
  window.addEventListener('hashchange', straks);
  window.addEventListener('popstate', straks);
  document.addEventListener('a3-voortgang', straks);
  const opnieuw = () => { if (Math.floor(doek.clientWidth) !== breedte) straks(); };
  if (typeof ResizeObserver === 'function') new ResizeObserver(opnieuw).observe(doek); else window.addEventListener('resize', opnieuw);
}

plaatsMetro().catch(() => { /* zonder data of opslag geen kaart; de rest van de pagina werkt (spec §5) */ });
