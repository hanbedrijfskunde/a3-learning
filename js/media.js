// Media per leerblok (MD-1…MD-7, MD-14, MD-16): de routekeuze tekst, video of spel, de uitleg, de video's en de kijktips.
// Tekst is de standaard (MD-2). Alle drie de routes leiden naar dezelfde „klaar als” en dezelfde oefentaak (MD-1, MD-2).
// De data staat in `media` in data/leerblok-N.json (formaat: zie README, fase 12) en `kijktips` in data/leerblok-1.json.
//
// Video (MD-5, MD-6, MD-7): geen <video> in de pagina en geen verzoek naar een videobestand voor de klik. Na de klik komt er een
// element met preload="none" en zonder autoplay; het bestand en de ondertitels staan op dezelfde site. Het transcript staat als
// tekst op de pagina. Spel (MD-11): dit bestand geeft een spel geen opslag; alleen de gekozen route wordt onthouden, als meta.
// Video's van derden zijn gewone links (MD-14, MD-16); er komt nooit een iframe.
import { h, wis } from './dom.js';

export const ROUTES = Object.freeze(['tekst', 'video', 'spel']);
export const ROUTE_NAMEN = Object.freeze({ tekst: 'Tekst', video: 'Video', spel: 'Spel' });
export const MAX_WOORDEN_UITLEG = 300; // MD-3
export const MAX_VIDEO_SECONDEN = 180; // MD-4
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // MD-4: 20 MB
export const METADATA = 'media/metadata.json'; // duur en grootte per videobestand, geschreven door tools/maak-video.mjs

const routeSleutel = (leerblok) => `media:route:${leerblok}`;
const woorden = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean);

// ---------------------------------------------------------------- logica

/** De onthouden route van een leerblok; tekst als er niets bewaard is (MD-2). Een onbekende waarde geeft ook tekst. */
export function leesRoute(store, leerblok) {
  const r = store?.getMeta?.(routeSleutel(leerblok));
  return ROUTES.includes(r) ? r : 'tekst';
}
/** Onthoudt de laatste keuze als meta (nooit een bewijsrecord). */
export function bewaarRoute(store, leerblok, route) {
  if (!ROUTES.includes(route)) throw new Error(`Onbekende route ${route}`);
  store.setMeta(routeSleutel(leerblok), route);
}

/** De taak waar de media bij horen (de oefentaak van de „klaar als”). */
export const mediaTaak = (blok) => blok.taken.find((t) => t.id === blok.media?.taak);

/** Het modelantwoord van de oefencasus als [{ label, tekst }], uit de taak zelf zodat er één bron is (MD-3). */
export function modelRegels(blok) {
  const taak = mediaTaak(blok);
  const gevraagd = blok.media?.uitleg?.modelantwoord?.velden ?? [];
  // De velden staan bij de oefening zelf, of (leerblok 1, taak 2.1) bij de toepassing op het eigen vraagstuk.
  const velden = [...(taak.oefening?.velden ?? []), ...(taak.toepassing?.velden ?? [])];
  return gevraagd.map((id) => ({
    id, label: velden.find((v) => v.id === id)?.label ?? id, tekst: taak.modelantwoord.velden[id],
  })).filter((r) => r.tekst !== undefined);
}

/** Aantal woorden van de uitlegtekst: alinea's, voorbeeld en modelantwoord samen (MD-3). */
export function uitlegWoorden(blok) {
  const u = blok.media?.uitleg;
  if (!u) return 0;
  return [...u.alineas, u.voorbeeld, ...modelRegels(blok).map((r) => r.tekst)].reduce((t, x) => t + woorden(x).length, 0);
}

/** Het transcript van een video als lijst stukken tekst, uit dezelfde dia's als de ondertitels en de stem (MD-5). */
export const transcriptVan = (video) => video.dias.map((d) => d.spreektekst);
/** De tekst van de „klaar als” die elke route toont (MD-2). */
export const klaarAlsVan = (blok) => mediaTaak(blok).klaarAls.tekst;

/** Seconden als m:ss. */
export const klokTekst = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const megabytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;

// ---------------------------------------------------------------- video

async function leesMetadata(bestand) {
  try {
    const r = await fetch(METADATA);
    if (!r.ok) return null;
    return (await r.json())[bestand] ?? null;
  } catch (e) { return null; }
}

/**
 * De videospeler van een eigen video: eerst een knop, na de klik pas het element (MD-6). Geen autoplay, preload="none",
 * ondertitels als <track> en het transcript als tekst eronder (MD-5). Alles op dezelfde site (MD-7).
 */
export function bouwVideo({ video, met = (t) => t }) {
  const gebied = h('div', { class: 'md-speler' });
  const meta = h('span', { class: 'klein' }, '');
  const start = () => {
    const element = h('video', { class: 'md-video', controls: true, preload: 'none', playsinline: true, 'aria-label': video.titel },
      h('source', { src: video.bestand, type: 'video/mp4' }),
      h('track', { kind: 'subtitles', srclang: 'nl', label: 'Nederlands', src: video.ondertitels, default: true }));
    wis(gebied);
    gebied.append(element);
    element.play?.().catch(() => { /* de bezoeker kan zelf op afspelen drukken */ });
    element.focus();
  };
  const knop = h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'speel-video', onclick: start }, `Speel de video (${video.id})`);
  gebied.append(knop, ' ', meta);
  leesMetadata(video.bestand).then((m) => { if (m) meta.textContent = `${klokTekst(m.duurSeconden)} min · ${megabytes(m.bytes)}`; });
  const transcript = h('div', { class: 'md-transcript' },
    h('h4', {}, 'Transcript'),
    video.dias.map((d) => h('p', {}, h('strong', {}, `${d.titel}. `), met(d.spreektekst))));
  return h('div', { class: 'md-video-blok' },
    h('p', {}, video.concept ? h('span', { class: 'md-concept' }, 'Conceptvideo') : null, ' ', video.concept
      ? 'Computerstem en tekstdia’s; de docent kan later een eigen opname plaatsen.' : ''),
    gebied,
    h('p', { class: 'klein' }, 'Met ondertitels (Nederlands) en een transcript. De video start niet vanzelf en wordt pas geladen als je op de knop drukt.'),
    transcript);
}

// ---------------------------------------------------------------- spel

/** Laadt een spel na de klik: eerst de data van het spel, dan het scherm. Geeft het element. */
export async function laadSpel({ spel, met = (t) => t }) {
  const [data, { bouwSpel }] = await Promise.all([
    fetch(spel.bestand).then((r) => { if (!r.ok) throw new Error(`${spel.bestand}: ${r.status}`); return r.json(); }),
    // gewicht-alleen: naklik
    import('./spel.js'),
  ]);
  return bouwSpel({ spel: data, met });
}

/** Het spelpaneel: een startknop; het spel zelf laadt pas na de klik. Zonder netwerk werkt het na het laden (MD-13). */
export function bouwSpelPaneel({ spel, met = (t) => t }) {
  const gebied = h('div', { class: 'md-spel' });
  const melding = h('p', { class: 'fout', role: 'alert', hidden: true });
  const knop = h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'start-spel', onclick: async () => {
    knop.disabled = true;
    try {
      const s = await laadSpel({ spel, met });
      wis(gebied);
      gebied.append(s.element);
      s.focus();
    } catch (e) {
      knop.disabled = false;
      melding.textContent = `Het spel kon niet worden geladen (${e.message}).`;
      melding.hidden = false;
    }
  } }, `Start het spel: ${spel.titel}`);
  gebied.append(h('p', { class: 'klein' }, `Ongeveer ${spel.minuten} minuten, met toetsenbord te bedienen, met een tekstversie. Alle voorbeelden zijn verzonnen (fictief). Het levert niets op voor je dossier.`), knop, melding);
  return gebied;
}

// ---------------------------------------------------------------- de sectie op de leerblokpagina

function tekstRoute({ blok, met, modelZichtbaar, bord }) {
  const u = blok.media.uitleg;
  const model = h('div', { class: 'md-model', 'aria-live': 'polite' });
  const toonModel = () => {
    wis(model);
    const taak = blok.media.taak;
    if (!modelZichtbaar()) {
      model.append(h('p', { class: 'klein' }, `Het modelantwoord van de oefencasus verschijnt nadat je de oefening bij taak ${taak} zelf hebt geprobeerd.`));
      return;
    }
    // Een model staat ook in het modelantwoord in beeld (SX-15): de stakeholders van taak 5.1 op het bord (SX-16).
    const bordCfg = u.modelantwoord?.bord && mediaTaak(blok).oefening?.weergave?.groepen?.find((g) => g.bord)?.bord;
    model.append(h('h4', {}, `Modelantwoord van de oefencasus (taak ${taak})`),
      bord && bordCfg ? bord.modelBord(mediaTaak(blok).modelantwoord.velden, bordCfg).element : null,
      h('dl', { class: 'model-lijst' }, modelRegels(blok).flatMap((r) => [h('dt', {}, r.label), h('dd', {}, r.tekst)])));
  };
  toonModel();
  const paneel = h('div', { class: 'md-tekst' },
    h('h3', {}, u.titel),
    u.alineas.map((a) => h('p', {}, met(a))),
    h('p', { class: 'voorbeeld' }, u.voorbeeld),
    // Het voorbeeld staat in de figuur van het model (SX-15), naast de tekst hierboven.
    bord && u.voorbeeldBord ? bord.vastBord({ ...u.voorbeeldBord, bijschrift: 'Het voorbeeld hierboven op het invloed/belang-raster.' }) : null,
    model);
  return { element: paneel, ververs: toonModel };
}

/**
 * De mediasectie van een leerblok: drie routes met dezelfde „klaar als” en oefentaak.
 * @param {object} p
 * @param {object} p.blok geladen leerblokdata met `media`
 * @param {object} p.store voor de laatste keuze (meta)
 * @param {(tekst: string) => any} p.met in-tekstverwijzingen naar de bronnenpagina (BR-4)
 * @param {() => boolean} p.modelZichtbaar is het modelantwoord van de oefening al te zien (TK-6)
 * @returns {{ element: HTMLElement, ververs: () => void, toon: (route: string) => void }}
 */
export function bouwMediaSectie({ blok, store, met = (t) => t, modelZichtbaar = () => false, bord = null }) {
  const m = blok.media;
  const knoppen = new Map();
  const paneel = h('div', { class: 'md-paneel', id: 'media-paneel' });
  let tekst = null;
  let route = leesRoute(store, blok.leerblok);
  const bouwers = {
    tekst: () => { tekst = tekstRoute({ blok, met, modelZichtbaar, bord }); return tekst.element; },
    video: () => h('div', {}, h('h3', {}, `Video ${m.video.id}: ${m.video.titel}`), bouwVideo({ video: m.video, met })),
    spel: () => h('div', {}, h('h3', {}, `Spel: ${m.spel.titel}`), bouwSpelPaneel({ spel: m.spel, met })),
  };
  function toon(nieuw, { bewaar = false } = {}) {
    route = nieuw;
    if (bewaar) { try { bewaarRoute(store, blok.leerblok, route); } catch (e) { /* zonder opslag werkt alles, alleen de keuze blijft niet staan */ } }
    for (const [r, knop] of knoppen) knop.setAttribute('aria-pressed', String(r === route));
    wis(paneel);
    paneel.append(bouwers[route]());
    paneel.dataset.route = route;
  }
  for (const r of ROUTES) knoppen.set(r, h('button', { type: 'button', class: 'knop md-knop', 'data-route': r, 'aria-pressed': 'false', onclick: () => toon(r, { bewaar: true }) }, ROUTE_NAMEN[r]));
  const taak = m.taak;
  const element = h('section', { class: 'kaart media', id: 'media', 'aria-labelledby': 'media-kop' },
    h('h4', { id: 'media-kop' }, 'Kies hoe je de stof doorneemt'),
    h('p', {}, `Lees de tekst, kijk de video of speel het spel. Alle drie leiden naar dezelfde „klaar als” en dezelfde oefening (taak ${taak}). Alles hieronder staat ook in de taken zelf; je kunt dit leerblok volledig met alleen tekst doen.`),
    h('div', { class: 'md-routes', role: 'group', 'aria-label': 'Route' }, [...knoppen.values()]),
    paneel,
    h('div', { class: 'md-klaar' },
      h('p', { class: 'klaar' }, h('strong', {}, 'Klaar als'), ' ', met(klaarAlsVan(blok))),
      h('p', {}, `Doe daarna de oefening bij taak ${taak}: `, h('a', { href: `#oefening-${taak}` }, `naar de oefening van taak ${taak}`), '.')));
  toon(route);
  return { element, ververs: () => { if (route === 'tekst') tekst?.ververs(); }, toon };
}

// ---------------------------------------------------------------- kijktips (MD-14, MD-16)

/** Twee kijktips van derden als gewone links, met bron, duur en taal; nooit een iframe of embed (MD-14, MD-16). */
export function bouwKijktips({ kijktips, met = (t) => t }) {
  return h('section', { class: 'kaart kijktips', id: 'kijktips', 'aria-labelledby': 'kijktips-kop' },
    h('h2', { id: 'kijktips-kop' }, kijktips.titel),
    h('p', {}, kijktips.intro),
    h('ul', { class: 'md-kijktips' }, kijktips.items.map((k) => h('li', { 'data-kijktip': k.id },
      h('p', {}, h('strong', {}, `${k.rol}: `), h('a', { href: k.url, target: '_blank', rel: 'noopener noreferrer' }, k.titel), ' (opent YouTube in een nieuw tabblad)'),
      h('p', { class: 'meta' }, 'Bron: ', met(k.verwijzing), ` · Duur: ${k.duur} · Taal: ${k.taal}`),
      h('p', {}, k.waarom)))));
}
