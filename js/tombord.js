// Het TOM-bord van taak 8.1 (LB-11, SX-15, ADR B98): het TOM³-raster als figuur om te verkennen, als oefenbord (signalen van
// webshop X in de juiste cel) en als invoer voor het eigen vraagstuk. Alleen DOM; de regels staan in tom.js. Laadt via tom-later.js
// pas als het bord in beeld komt (PF-4). De celteksten staan in data/tom.json, zodat een docent ze zonder code aanpast (QA-1).
import { h, wis } from './dom.js';
import { CELLEN, LAGEN, KOLOMMEN, cel, boven, buren, perLaag, kijktips, vergelijk, VERGELIJKING, tomTekst } from './tom.js';

// De opmaak staat in een eigen stylesheet, zodat pagina's zonder bord hem niet laden (PF-4); `klaar` wacht erop en op de celteksten.
const CSS = new URL('../css/tombord.css', import.meta.url).href;
const css = new Promise((af) => {
  if (document.querySelector(`link[href="${CSS}"]`)) { af(); return; }
  document.head.append(h('link', { rel: 'stylesheet', href: CSS, onload: af, onerror: af }));
});
let DATA = null;
const data = fetch(new URL('../data/tom.json', import.meta.url)).then((r) => r.json()).then((d) => { DATA = d; }).catch(() => { /* zonder teksten: alleen de namen */ });
export const klaar = Promise.all([css, data]);

const info = (c) => DATA?.cellen?.[c.code] ?? { naam: c.kolom, vraag: '', kijk: [] };
const uitleg = (lijst, naam) => lijst?.find((x) => x.naam === naam)?.uitleg ?? '';
const opsomming = (w) => (w.length < 2 ? w.join('') : `${w.slice(0, -1).join(', ')} en ${w.at(-1)}`);
const IR = 'Informatie & Rapportage';

/**
 * Het raster: laagkoppen links, vier kolommen, en rechts de lus van de vierde kolom (cijfers omhoog, doelen omlaag).
 * @param {(c: object) => Node} celEl de inhoud van een cel (een knop of een vak)
 * @param {{laagExtra?: (laag: string) => Node|null, niveau?: string, klasse?: string}} o
 */
function raster(celEl, { laagExtra = () => null, niveau = '', klasse = '' } = {}) {
  const kop = (naam, extra) => h('div', { class: `tm-kop ${extra}`.trim() }, h('strong', {}, naam), h('span', {}, uitleg(extra.includes('tm-laag') ? DATA?.lagen : DATA?.kolommen, naam)));
  return h('div', { class: `tm-raster ${klasse}`.trim() },
    h('div', { class: 'tm-hoek', 'aria-hidden': 'true' }),
    KOLOMMEN.map(([, k]) => kop(k, k === IR ? 'tm-ir' : '')),
    h('div', { class: 'tm-hoek', 'aria-hidden': 'true' }),
    LAGEN.flatMap(([, laag], r) => {
      const hier = niveau && laag.toLowerCase() === niveau.toLowerCase();
      const laagKop = kop(laag, `tm-laag${hier ? ' tm-niveau' : ''}`);
      laagKop.style.gridRow = String(r + 2);
      laagKop.append(...[hier ? h('em', { class: 'tm-hier' }, 'speelt hier') : null, laagExtra(laag)].filter(Boolean));
      return [laagKop, ...CELLEN.filter((c) => c.rij === r).map((c) => {
        const el = celEl(c);
        el.classList.add('tm-cel');
        if (c.kolom === IR) el.classList.add('tm-ir');
        if (hier) el.classList.add('tm-niveau');
        el.style.gridRow = String(r + 2);
        el.style.gridColumn = String(c.kol + 2);
        return el;
      })];
    }),
    h('div', { class: 'tm-lus', 'aria-hidden': 'true' },
      h('span', { class: 'tm-pijl' }, '▲', h('span', { class: 'tm-lijn' }), h('small', {}, 'cijfers')),
      h('span', { class: 'tm-pijl' }, h('small', {}, 'doelen'), h('span', { class: 'tm-lijn' }), '▼')));
}

/** De twee kijkrichtingen bij een cel, als zinnen (stof, alinea 3). */
function richtingen(c) {
  const b = boven(c);
  return [
    h('p', { class: 'tm-richting' }, h('strong', {}, '↑ Omhoog'), ' ', b ? `Past dit bij ${info(b).naam.toLowerCase()} (${b.label})?` : 'Hierboven zit niets meer: hier begint de koers.'),
    h('p', { class: 'tm-richting' }, h('strong', {}, '↔ Opzij'), ' ', `Sluit dit aan op ${opsomming(buren(c).map((x) => info(x).naam.toLowerCase()))}?`),
  ];
}

const celKop = (c) => [h('p', { class: 'eyebrow' }, c.label), h('h5', { class: 'tm-celkop' }, info(c).naam)];
const kijkEl = (c) => (info(c).kijk?.length ? h('p', { class: 'klein' }, h('strong', {}, 'Je kijkt naar '), `${opsomming(info(c).kijk)}.`) : null);

/** Markeert de gekozen cel en de cellen in de twee kijkrichtingen: de kolom erboven en de laag opzij. */
function markeer(rasterEl, gekozen) {
  for (const el of rasterEl.querySelectorAll('.tm-cel')) {
    const c = cel(el.dataset.code);
    el.classList.toggle('tm-kies', c === gekozen);
    el.classList.toggle('tm-omhoog', Boolean(gekozen) && c.kol === gekozen.kol && c.rij < gekozen.rij);
    el.classList.toggle('tm-opzij', Boolean(gekozen) && c.rij === gekozen.rij && c !== gekozen);
    if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(c === gekozen));
  }
}

const modelInTekst = () => h('details', { class: 'tm-tekst' }, h('summary', {}, 'Het model in tekst'),
  h('p', {}, 'Drie lagen van boven naar beneden en vier kolommen, samen twaalf cellen. De vierde kolom loopt door alle lagen: cijfers van de werkvloer gaan omhoog, doelen gaan omlaag.'),
  h('ul', {}, LAGEN.map(([l, laag]) => h('li', {}, h('strong', {}, laag), ` (${uitleg(DATA?.lagen, laag)}): `,
    opsomming(CELLEN.filter((c) => c.code.startsWith(l)).map((c) => `${info(c).naam} (${c.kolom})`)), '.'))));

/**
 * Figuur voor de stof (SX-15): het TOM-model om te verkennen. Een tik op een cel toont de vraag die je daar stelt, waar je naar
 * kijkt en de twee kijkrichtingen; de kolom erboven en de laag opzij lichten op. Eigen weergave naar Westmoreland BV (z.d.).
 */
export function tomFiguur({ met = (t) => t } = {}) {
  const paneel = h('div', { class: 'tm-paneel', 'aria-live': 'polite' },
    h('p', { class: 'tm-leeg' }, 'Tik op een cel. Je ziet welke vraag je daar stelt, en waar je omhoog en opzij kijkt.'));
  let r;
  const kies = (c) => {
    markeer(r, c);
    wis(paneel).append(...celKop(c), h('p', { class: 'tm-vraag' }, info(c).vraag), kijkEl(c), ...richtingen(c));
  };
  r = raster((c) => h('button', { type: 'button', 'data-code': c.code, 'aria-pressed': 'false', onclick: () => kies(c) },
    h('span', { class: 'tm-celnaam' }, info(c).naam), h('span', { class: 'sr-only' }, `, ${c.label}`)), { klasse: 'tm-verken' });
  return h('figure', { class: 'a3-vel tm-figuur' }, r, paneel,
    h('figcaption', {},
      h('p', {}, 'Figuur: twaalf cellen. De vierde kolom verbindt de lagen: cijfers gaan omhoog, doelen gaan omlaag. Eigen weergave van de TOM³-indeling naar ', met('(Westmoreland BV, z.d.)'), '.')),
    modelInTekst());
}

// ------------------------------------------------------------------------------------------------ oefenen: signalen plaatsen

const chip = (nr, klasse = '') => h('span', { class: `tm-chip ${klasse}`.trim() }, String(nr));

/**
 * Het oefenbord: signalen van de oefencasus die de student in een cel zet. Tikken op een signaal pakt het op, tikken op een cel
 * zet het neer (ook met het toetsenbord: Tab en Enter). Elk signaal is een veld; de waarde is het label van de cel.
 * @param {{signalen: {id: string, tekst: string}[], waarden: object, bijWijziging: () => void, voorvoegsel: string}} o
 */
export function signaalBord({ signalen, waarden = {}, bijWijziging }) {
  const w = {};
  const zetW = (v = {}) => { for (const s of signalen) w[s.id] = typeof v?.[s.id] === 'string' ? v[s.id] : ''; };
  zetW(waarden);
  let opgepakt = null;
  const status = h('p', { class: 'klein tm-status', role: 'status' });
  const bak = h('ol', { class: 'tm-signalen', 'aria-label': 'Signalen' });
  const bord = h('div', { class: 'tm-bord' });
  const element = h('div', { class: 'tb tm-oefen' }, bak, status, bord);
  const nr = (s) => signalen.indexOf(s) + 1;

  function plaats(c) {
    if (!opgepakt) { status.textContent = 'Kies eerst een signaal hierboven.'; return; }
    const s = opgepakt;
    w[s.id] = c ? c.label : '';
    opgepakt = null;
    status.textContent = c ? `Signaal ${nr(s)} staat nu bij ${c.label}.` : `Signaal ${nr(s)} staat niet meer in het model.`;
    teken(s.id);
    bijWijziging();
  }
  function pak(s) {
    opgepakt = opgepakt === s ? null : s;
    status.textContent = opgepakt ? `Signaal ${nr(s)} opgepakt. Kies de cel waar je het ziet.` : '';
    teken(s.id);
  }

  function teken(focusOp = null) {
    wis(bak).append(...signalen.map((s) => {
      const c = cel(w[s.id]);
      return h('li', {}, h('button', {
        type: 'button', class: `tm-signaal${opgepakt === s ? ' tm-opgepakt' : ''}${c ? ' tm-geplaatst' : ''}`, 'data-id': s.id, 'aria-pressed': String(opgepakt === s),
        onclick: () => pak(s), onkeydown: (e) => { if (e.key === 'Escape' && opgepakt === s) { e.preventDefault(); pak(s); } },
      }, chip(nr(s)), h('span', { class: 'tm-signaaltekst' }, s.tekst), h('span', { class: 'tm-waar' }, c ? `→ ${c.label}` : 'nog niet geplaatst')));
    }));
    const r = raster((c) => {
      const hier = signalen.filter((s) => cel(w[s.id]) === c);
      return h('button', { type: 'button', 'data-code': c.code, onclick: () => plaats(c) },
        h('span', { class: 'tm-celnaam' }, info(c).naam),
        hier.length ? h('span', { class: 'tm-chips', 'aria-hidden': 'true' }, hier.map((s) => chip(nr(s)))) : null,
        h('span', { class: 'sr-only' }, `, ${c.label}${hier.length ? `, met signaal ${hier.map(nr).join(' en ')}` : ''}${opgepakt ? `. Zet signaal ${nr(opgepakt)} hier` : ''}`));
    }, { klasse: opgepakt ? 'tm-bezig' : '' });
    wis(bord).append(r);
    if (opgepakt && cel(w[opgepakt.id])) {
      bord.append(h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop', onclick: () => plaats(null) }, `Haal signaal ${nr(opgepakt)} uit het model`)));
    }
    if (focusOp) bak.querySelector(`[data-id="${focusOp}"]`)?.focus();
  }

  teken();
  return { element, lees: () => ({ ...w }), zet: (v = {}) => { zetW(v); opgepakt = null; status.textContent = ''; teken(); } };
}

/**
 * Het modelantwoord van de oefening op het bord (TK-6): de signalen in de cel van het model, elk vergeleken met de plek die de
 * student koos. De laag van het niveau uit het model licht op. Onder het bord dezelfde vergelijking in tekst; geen totaal (X-3).
 */
export function modelSignaalBord({ signalen, model = {}, eigen = {} }) {
  const nr = (s) => signalen.indexOf(s) + 1;
  const uitkomst = (s) => vergelijk(eigen[s.id], model[s.id]);
  const KLASSE = { goed: 'tm-chip-goed', laag: 'tm-chip-bijna', kolom: 'tm-chip-bijna' };
  const r = raster((c) => {
    const hier = signalen.filter((s) => cel(model[s.id]) === c);
    return h('div', { 'data-code': c.code },
      h('span', { class: 'tm-celnaam' }, info(c).naam),
      hier.length ? h('span', { class: 'tm-chips' }, hier.map((s) => chip(nr(s), KLASSE[uitkomst(s)] ?? ''))) : null);
  }, { niveau: model.niveau ?? '', klasse: 'tm-model' });
  r.setAttribute('aria-hidden', 'true'); // de lijst eronder zegt hetzelfde in woorden
  return h('div', { class: 'tb tm-modelbord' },
    r,
    h('p', { class: 'klein tm-legenda' }, chip('✓', 'tm-chip-goed'), ' zelfde cel als jij · ', chip('~', 'tm-chip-bijna'), ' goede laag of goede kolom · ', chip('·'), ' ergens anders'),
    h('ol', { class: 'tm-vergelijking' }, signalen.map((s) => {
      const u = uitkomst(s);
      return h('li', {}, `${s.tekst} `, h('strong', {}, `→ ${model[s.id] ?? '—'}.`), u === 'open' ? ' Jij: nog niet geplaatst.' : ` Jij: ${cel(eigen[s.id]).label} (${VERGELIJKING[u]}).`);
    })));
}

// ------------------------------------------------------------------------------------------------ toepassen: het eigen vraagstuk

/**
 * Het bord als invoer voor het eigen vraagstuk (EV-07). Een tik op een cel opent eronder de vraag van die cel en een tekstvak;
 * „Volgende cel” loopt de twaalf in leesvolgorde langs. Per laag staat hoeveel cellen er iets hebben; de laag van het gekozen
 * niveau licht op; kijktips wijzen op de kijkrichtingen. Schrijft de velden tomS1 … tomO4; het record merkt er niets van.
 * @param {{voorvoegsel: string, waarden: object, bijWijziging: () => void, niveau: () => string, zinstarter?: string}} o
 */
export function tomBord({ voorvoegsel, waarden = {}, bijWijziging, niveau = () => '', zinstarter = '' }) {
  const w = {};
  const zetW = (v = {}) => { for (const c of CELLEN) w[c.veld] = typeof v?.[c.veld] === 'string' ? v[c.veld] : ''; };
  zetW(waarden);
  let gekozen = null;
  const bord = h('div', { class: 'tm-bord' });
  const editor = h('div', { class: 'tm-editor', hidden: true });
  const tips = h('ul', { class: 'tm-tips', role: 'status' });
  const tekstLijst = h('ul');
  const element = h('div', { class: 'tb tm-toepassen' }, bord, editor, tips,
    h('details', { class: 'tm-tekst' }, h('summary', {}, 'Het bord in tekst'), tekstLijst));
  const tekstId = `${voorvoegsel}-tm-tekst`;

  function tekenBord(focusCode = null) {
    const telling = perLaag(w);
    wis(bord).append(raster((c) => {
      const t = w[c.veld].trim();
      return h('button', { type: 'button', 'data-code': c.code, class: t ? 'tm-gevuld' : '', 'aria-pressed': String(c === gekozen), onclick: () => kies(c) },
        h('span', { class: 'tm-celnaam' }, info(c).naam),
        h('span', { class: 'tm-celtekst' }, t || '+'), // CSS kort in op het scherm; op papier staat alles
        h('span', { class: 'sr-only' }, `, ${c.label}${t ? '' : ', leeg'}`));
    }, { niveau: niveau(), laagExtra: (laag) => h('span', { class: 'tm-telling' }, `${telling[laag]} van 4`) }));
    markeer(bord.querySelector('.tm-raster'), gekozen);
    if (focusCode) bord.querySelector(`[data-code="${focusCode}"]`)?.focus();
  }
  function tekenRest() {
    const lijst = kijktips(w, niveau());
    wis(tips).append(...lijst.map((t) => h('li', {}, t)));
    tips.hidden = lijst.length === 0;
    const regels = tomTekst(w);
    wis(tekstLijst).append(...(regels.length ? regels.map((r) => h('li', {}, r)) : [h('li', {}, 'Er staat nog niets in het model.')]));
  }

  function kies(c, focusVeld = true) {
    gekozen = c;
    const i = CELLEN.indexOf(c);
    const veld = h('textarea', { id: tekstId, rows: 3, placeholder: zinstarter, oninput: () => { w[c.veld] = veld.value; tekenBord(); tekenRest(); bijWijziging(); } });
    veld.value = w[c.veld];
    const stap = (d) => h('button', { type: 'button', class: 'knop', disabled: !CELLEN[i + d], onclick: () => kies(CELLEN[i + d]) }, d < 0 ? '← Vorige cel' : 'Volgende cel →');
    wis(editor).append(...celKop(c),
      h('p', { class: 'tm-vraag' }, info(c).vraag), kijkEl(c),
      h('div', { class: 'veld' }, h('label', { for: tekstId }, 'Hoe zie je het vraagstuk in deze cel? Laat leeg als het vraagstuk hier niets raakt.'), veld),
      h('div', { class: 'knoppen' }, stap(-1), stap(1),
        h('button', { type: 'button', class: 'knop', onclick: () => { gekozen = null; editor.hidden = true; tekenBord(c.code); } }, 'Sluit')));
    editor.hidden = false;
    tekenBord();
    if (focusVeld) veld.focus();
  }

  const teken = () => { tekenBord(); tekenRest(); };
  teken();
  return {
    element,
    lees: () => ({ ...w }),
    zet: (v = {}) => { zetW(v); gekozen = null; editor.hidden = true; teken(); },
    ververs: teken, // het niveau is een ander veld: bij een nieuwe keuze licht een andere laag op
  };
}
