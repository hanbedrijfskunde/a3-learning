// Dunne DOM-hulpen voor de pagina's (geen logica: die zit in sessie.js, weergave.js en checks/).

/** Maakt een element: h('p', { class: 'x', hidden: true }, 'tekst', kind, …). Tekst gaat via textContent (geen HTML). */
export function h(tag, props = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinderen.flat()) {
    if (kind === undefined || kind === null || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

export const wis = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/** De acht vakken van de A3 (werkboek 1.1), met de vraag die elk vak beantwoordt, gegroepeerd naar PDCA. */
const A3_VEL = [
  { fase: 'Plan', pijl: '→', vakken: [[1, 'Aanleiding / achtergrond', 'Waarom dit vraagstuk?'], [2, 'Huidige situatie', 'Hoe is het nu?'], [3, 'Doelen', 'Waar wil je heen?'], [4, 'Analyse', 'Wat is de oorzaak?']] },
  { fase: 'Do', pijl: '↓', vakken: [[5, 'Toekomstige situatie', 'Hoe wordt het?'], [6, 'Implementatie', 'Wie doet wat, wanneer?']] },
  { fase: 'Check', pijl: '↓', vakken: [[7, 'Borging en evaluatie', 'Werkt het, en blijft het zo?']] },
  { fase: 'Act', pijl: '↩ terug naar Plan', vakken: [[8, 'Next steps', 'Wat is de volgende stap?']] },
];

/**
 * Figuur: één A3-vel met de acht vakken en de cirkel plan, do, check, act eroverheen. Eigen weergave (HTML, geen beeld van
 * derden, LI-1) naar het idee van Schwagerman & Ulmer (2013). `hier` is het vak waar de student begint.
 */
export function a3VelFiguur({ hier = 1, met = (t) => t } = {}) {
  const groep = (g) => h('div', { class: `a3v-groep a3v-${g.fase.toLowerCase()}` },
    h('p', { class: 'a3v-fase' }, h('span', {}, g.fase), h('span', { class: 'a3v-pijl', 'aria-hidden': 'true' }, ` ${g.pijl}`)),
    h('ol', { class: 'a3v-vakken', start: g.vakken[0][0] }, g.vakken.map(([nr, naam, vraag]) => h('li', { class: `a3v-vak${nr === hier ? ' a3v-hier' : ''}` },
      h('span', { class: 'a3v-nr', 'aria-hidden': 'true' }, String(nr)),
      h('span', { class: 'a3v-naam' }, naam), h('span', { class: 'a3v-vraag' }, vraag),
      nr === hier ? h('span', { class: 'a3v-label' }, 'Hier begin je') : null))));
  return h('figure', { class: 'a3-vel' },
    h('div', { class: 'a3v-blad' },
      h('div', { class: 'a3v-links' }, groep(A3_VEL[0])),
      h('div', { class: 'a3v-rechts' }, A3_VEL.slice(1).map(groep))),
    h('figcaption', {}, 'Eén A3-vel: links het plan (vak 1 tot en met 4), rechts uitvoeren (do, vak 5 en 6), controleren (check, vak 7) en bijsturen (act, vak 8). Daarna begint de cirkel opnieuw. Eigen weergave naar het idee van ', met('(Schwagerman & Ulmer, 2013)'), '.'));
}

/** A3-vak 1 in vier delen (SX-12): gevulde delen in vlak, de rest alleen een rand; de stand ook als tekst (TG-4). */
export function tekenA3Vak(el, stand) {
  wis(el);
  el.append(
    h('ol', { class: 'a3-delen' }, stand.delen.map((d) => h('li', { class: `a3-deel${d.gevuld ? ' a3-gevuld' : ''}${d.opbouw ? ' a3-bezig' : ''}${d.nieuw ? ' a3-nieuw' : ''}` },
      h('span', { class: 'a3-nr' }, String(d.leerblok)), h('span', { class: 'a3-label' }, d.label),
      d.opbouw ? h('span', { class: 'a3-opbouw' }, d.opbouw) : null,
      h('span', { class: 'sr-only' }, d.gevuld ? ' (staat)' : d.opbouw ? ' (in opbouw)' : ' (nog leeg)')))),
    h('p', { class: 'a3-onderschrift' }, stand.tekst));
  return el;
}

/** Een status als tekst met kleur erbij; nooit alleen kleur (BW-3, TG-4). */
export function statusChip(status, tekst) {
  return h('span', { class: `status status-${status.replace(' ', '-')}` }, tekst);
}

/**
 * Bouwt de velden van een oefenversie of toepassing. Elk veld heeft een zichtbaar label (of legend).
 * @param {object[]} velden veldbeschrijvingen uit de data ({id, label, type, opties?})
 * @param {string} voorvoegsel unieke aanhef voor id's en name's
 * @param {object} waarden beginwaarden
 * @param {() => void} bijWijziging wordt na elke wijziging aangeroepen
 * @returns {{element: HTMLElement, lees: () => object, zet: (w: object) => void}}
 */
/**
 * Een hint bij een vraag (SX-13): een knop „Hint” die de aanwijzing onder de vraag openklapt. Bewust <details> en geen
 * mouse-over: werkt met tikken, toetsenbord en schermlezer, zonder script of polyfill (PR-1), en de student kiest zelf
 * wanneer de hint verschijnt (eerst zelf nadenken).
 */
export const hintEl = (tekst) => (tekst ? h('details', { class: 'hint' }, h('summary', {}, 'Hint'), h('p', {}, tekst)) : null);

export function bouwVelden(velden, voorvoegsel, waarden, bijWijziging) {
  const rij = h('div', { class: 'velden' });
  const lezers = {};
  const zetters = {};
  for (const v of velden) {
    const id = `${voorvoegsel}-${v.id}`;
    if (v.type === 'keuze' || v.type === 'meer') {
      const soort = v.type === 'keuze' ? 'radio' : 'checkbox';
      const opties = v.opties.map((o, i) => {
        const oid = `${id}-${i}`;
        const input = h('input', { type: soort, id: oid, name: id, value: o, onchange: bijWijziging });
        return h('div', { class: 'optie' }, input, h('label', { for: oid }, o));
      });
      rij.append(h('fieldset', { class: 'veld' }, h('legend', {}, v.label), hintEl(v.hint), opties));
      const inputs = () => [...rij.querySelectorAll(`input[name="${id}"]`)];
      lezers[v.id] = () => {
        const gekozen = inputs().filter((i) => i.checked).map((i) => i.value);
        return v.type === 'keuze' ? gekozen[0] : gekozen;
      };
      zetters[v.id] = (w) => { const lijst = [].concat(w ?? []); inputs().forEach((i) => { i.checked = lijst.includes(i.value); }); };
    } else {
      let el;
      if (v.type === 'lijst') {
        el = h('select', { id, onchange: bijWijziging }, h('option', { value: '' }, '— kies —'), v.opties.map((o) => h('option', { value: o }, o)));
      } else if (v.type === 'lang') {
        el = h('textarea', { id, rows: 3, oninput: bijWijziging, placeholder: v.zinstarter });
      } else {
        el = h('input', { type: 'text', id, oninput: bijWijziging, autocomplete: 'off', placeholder: v.zinstarter });
      }
      rij.append(h('div', { class: 'veld' }, h('label', { for: id }, v.label), hintEl(v.hint), el));
      lezers[v.id] = () => el.value;
      zetters[v.id] = (w) => { el.value = typeof w === 'string' ? w : ''; };
    }
  }
  const zet = (w = {}) => { for (const v of velden) zetters[v.id](w[v.id]); };
  zet(waarden);
  const lees = () => {
    const uit = {};
    for (const v of velden) {
      const w = lezers[v.id]();
      if (w !== undefined) uit[v.id] = w;
    }
    return uit;
  };
  return { element: rij, lees, zet };
}

/**
 * De knop „Wis alles" met één bevestiging (ST-6). Wist alle gegevens van de site uit localStorage, sessionStorage
 * en IndexedDB en roept daarna `na` aan.
 */
export function maakWisAlles(store, na) {
  const knop = h('button', { type: 'button', class: 'knop', id: 'wis-alles' }, 'Wis alles');
  const bevestig = h('div', { class: 'bevestiging', hidden: true, role: 'alertdialog', 'aria-labelledby': 'wis-vraag' },
    h('p', { id: 'wis-vraag' }, 'Weet je het zeker? Alles wat je op deze site hebt ingevuld wordt van dit apparaat verwijderd. Dat kun je niet ongedaan maken.'),
    h('button', { type: 'button', class: 'knop knop-accent', id: 'wis-bevestig', onclick: async () => {
      store.clear();
      try { sessionStorage.clear(); } catch (e) { /* geen sessionStorage */ }
      try {
        const dbs = (await indexedDB.databases?.()) ?? [];
        dbs.forEach((d) => d.name && indexedDB.deleteDatabase(d.name));
      } catch (e) { /* geen IndexedDB */ }
      bevestig.hidden = true;
      knop.hidden = false;
      na();
    } }, 'Ja, wis alles'),
    ' ',
    h('button', { type: 'button', class: 'knop', id: 'wis-annuleer', onclick: () => { bevestig.hidden = true; knop.hidden = false; knop.focus(); } }, 'Annuleer'));
  knop.addEventListener('click', () => { knop.hidden = true; bevestig.hidden = false; bevestig.querySelector('#wis-annuleer').focus(); });
  return h('div', { class: 'wis' }, knop, bevestig);
}
