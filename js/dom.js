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

const regexVeilig = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Zet de invulplekken van een format-zin als gemarkeerde stukken neer (DESIGN §5.3): „<gebruiker>” en, in het live
 * voorbeeld, ook wat de student al invulde. Tekst blijft tekst (geen HTML).
 * @param {string} tekst
 * @param {string[]} [ingevuld] waarden van de student die in de zin staan
 */
export function metInvulplekken(tekst, ingevuld = []) {
  const waarden = ingevuld.map((w) => String(w ?? '').trim()).filter((w) => w.length > 0).sort((a, b) => b.length - a.length);
  const patroon = new RegExp(`(<[^>]+>${waarden.map((w) => `|${regexVeilig(w)}`).join('')})`, 'g');
  return String(tekst).split(patroon).filter((s) => s !== '').map((s) => {
    if (/^<[^>]+>$/.test(s)) return h('span', { class: 'invulplek invulplek-leeg' }, s);
    if (waarden.includes(s)) return h('span', { class: 'invulplek invulplek-gevuld' }, s);
    return s;
  });
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
/**
 * Waar het antwoord staat (SX-13, ADR B85): de stof van een taak (link naar die stap), een bron uit de bronnenlijst met
 * vindplaats (link naar de bronnenpagina), het werkboek, of het eigen werk van de student.
 * @param {{soort: 'stof'|'bron'|'werkboek'|'eigen werk', taak?: string, leerblok?: number, bron?: string, citatie?: string, vindplaats?: string}} w
 */
function vindplaatsEl(w) {
  if (w.soort === 'stof') {
    const pagina = w.leerblok ? `leerblok-${w.leerblok}.html` : '';
    return [h('a', { href: `${pagina}#taak-${w.taak}/stof` }, `stof van taak ${w.taak}`), w.vindplaats ? ` (${w.vindplaats})` : ''];
  }
  if (w.soort === 'bron') return [h('a', { class: 'bron-verwijzing', href: `bronnen.html#bron-${w.bron}` }, w.citatie), w.vindplaats ? `, ${w.vindplaats}` : ''];
  return [w.vindplaats];
}

export const hintEl = (tekst, waar = []) => (tekst ? h('details', { class: 'hint' }, h('summary', {}, 'Hint'), h('p', {}, tekst),
  waar.length ? h('p', { class: 'hint-waar' }, h('strong', {}, 'Waar staat het: '), waar.flatMap((w, i) => [i ? '; ' : '', ...vindplaatsEl(w)])) : null) : null);

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
      rij.append(h('fieldset', { class: 'veld' }, h('legend', {}, v.label), hintEl(v.hint, v.hintBron), opties));
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
      rij.append(h('div', { class: 'veld' }, h('label', { for: id }, v.label), hintEl(v.hint, v.hintBron), el));
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

const isJson = (b) => /\.json$/i.test(b.name) || b.type === 'application/json';

/**
 * Bestandkiezer (SX-14, DESIGN §6, ADR B94): een brede knop in plaats van de kale browserknop. Het echte
 * <input type="file"> zit er onzichtbaar in, zodat toetsenbord, schermlezer en de bestandskiezer van de telefoon werken
 * zoals altijd; met een muis kun je het bestand er ook op slepen. De knop noemt het gekozen bestand in het Nederlands,
 * ook nadat het veld is leeggemaakt (de browser zou dan weer „No file chosen” tonen).
 * @param {{id: string, titel: string, meer?: boolean, bijKeuze: (bestanden: File[]) => (void|Promise<void>)}} o
 */
export function bestandKiezer({ id, titel, meer = false, bijKeuze }) {
  const gekozen = h('span', { class: 'bk-gekozen' });
  async function kies(bestanden) {
    const json = bestanden.filter(isJson);
    gekozen.classList.toggle('fout', json.length === 0);
    if (!json.length) { gekozen.textContent = 'Dat is geen .json-bestand. Kies een dossierbestand.'; return; }
    const lijst = meer ? json : json.slice(0, 1);
    gekozen.textContent = lijst.length === 1 ? `Gekozen: ${lijst[0].name}` : `Gekozen: ${lijst.length} bestanden`;
    await bijKeuze(lijst);
  }
  const invoer = h('input', { type: 'file', id, class: 'sr-only', accept: '.json,application/json', multiple: meer, onchange: async (e) => {
    const bestanden = [...e.target.files];
    e.target.value = '';
    if (bestanden.length) await kies(bestanden);
  } });
  const zet = (aan) => knop.classList.toggle('bk-slepen', aan);
  const knop = h('label', {
    class: 'bestandkiezer', for: id,
    ondragover: (e) => { e.preventDefault(); zet(true); },
    ondragleave: (e) => { if (!knop.contains(e.relatedTarget)) zet(false); },
    ondrop: (e) => { e.preventDefault(); zet(false); kies([...e.dataTransfer.files]); },
  },
  h('span', { class: 'bk-icoon', 'aria-hidden': 'true' }, '↑'),
  h('span', { class: 'bk-tekst' },
    h('span', { class: 'bk-titel' }, titel),
    h('span', { class: 'bk-hulp' },
      h('span', { class: 'bk-tik' }, 'Tik om te kiezen'), h('span', { class: 'bk-sleep' }, meer ? 'Klik of sleep ze hierheen' : 'Klik of sleep het hierheen'), ' · .json'),
    gekozen),
  invoer);
  return knop;
}
