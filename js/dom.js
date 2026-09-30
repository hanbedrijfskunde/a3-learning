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
      rij.append(h('fieldset', { class: 'veld' }, h('legend', {}, v.label), opties));
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
      rij.append(h('div', { class: 'veld' }, h('label', { for: id }, v.label), el));
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
