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

/** De zes vakken van het VPC uit de figuur van Strategyzer, met de naam uit de stof van taak 6.1. */
const VPC_VAKKEN = [
  ['Klantprofiel (cirkel)', 'Customer Jobs', 'Klanttaken'], ['Klantprofiel (cirkel)', 'Pains', 'Pains'], ['Klantprofiel (cirkel)', 'Gains', 'Gains'],
  ['Waardekaart (vierkant)', 'Products and Services', 'Producten en diensten'], ['Waardekaart (vierkant)', 'Pain Relievers', 'Pain relievers'],
  ['Waardekaart (vierkant)', 'Gain Creators', 'Gain creators'],
];

/**
 * Figuur: het value proposition canvas van Strategyzer (z.d.-b), alleen het canvas zelf (zonder kop, QR-code en logo), als citaat
 * met bronvermelding (media/citaten.json, ADR B84 en B89). Lui geladen zoals het A3-vel (PF-4). Onder de figuur staat welk vak bij welke kant hoort.
 */
export function vpcFiguur({ met = (t) => t } = {}) {
  return h('figure', { class: 'a3-vel citaat' },
    h('img', {
      src: 'media/citaten/strategyzer-zd-value-proposition-canvas.webp', width: 1200, height: 616, loading: 'lazy', decoding: 'async',
      alt: 'Het value proposition canvas. Links een vierkant met een cadeau in het midden: de waardekaart, met de vakken Products and Services, Gain Creators en Pain Relievers. Rechts een cirkel met een hoofd in het midden: het klantprofiel, met de vakken Customer Jobs, Gains en Pains. Een lijn met twee pijlen verbindt het cadeau en het hoofd: daar moeten ze op elkaar passen.',
    }),
    h('figcaption', {},
      h('p', {}, 'Figuur: rechts het klantprofiel, links de waardekaart. Er is een fit als de waardekaart past bij het klantprofiel. Overgenomen uit ', met('(Strategyzer, z.d.-b)'), ', het officiële sjabloon, via ', h('a', { href: 'https://www.strategyzer.com/library/the-value-proposition-canvas' }, 'Strategyzer'), '. De licentie van deze site geldt niet voor deze figuur.'),
      h('details', { class: 'a3-koppeling' }, h('summary', {}, 'De vakken van het canvas in de stof'),
        h('table', {}, h('thead', {}, h('tr', {}, ['Kant', 'In de figuur', 'In de stof'].map((k) => h('th', { scope: 'col' }, k)))),
          h('tbody', {}, VPC_VAKKEN.map(([kant, en, nl]) => h('tr', {}, h('td', {}, kant), h('td', { lang: 'en' }, en), h('td', {}, nl))))))));
}

/** De negen bouwstenen van het BMC uit de figuur van Strategyzer, met de naam uit de stof en de velden van taak 7.1. */
const BMC_BOUWSTENEN = [
  ['Links: wat ervoor nodig is', 'Key Partnerships', 'Kernpartners'], ['Links: wat ervoor nodig is', 'Key Activities', 'Kernactiviteiten'],
  ['Links: wat ervoor nodig is', 'Key Resources', 'Kernmiddelen'], ['Midden', 'Value Propositions', 'Waardepropositie'],
  ['Rechts: de markt', 'Customer Relationships', 'Klantrelaties'], ['Rechts: de markt', 'Channels', 'Kanalen'],
  ['Rechts: de markt', 'Customer Segments', 'Klantsegmenten'], ['Onderaan: het geld', 'Cost Structure', 'Kostenstructuur'],
  ['Onderaan: het geld', 'Revenue Streams', 'Inkomstenstromen'],
];

/**
 * Figuur: het business model canvas van Strategyzer (z.d.-a), alleen het canvas zelf (zonder kop, QR-code en logo). Strategyzer geeft het
 * sjabloon uit onder CC BY-SA 3.0; de uitsnede staat met naamsvermelding in het register (media/citaten.json, ADR B84 en B92).
 * Lui geladen zoals het A3-vel (PF-4). Onder de figuur staat welke bouwsteen waar staat en hoe hij in de stof heet.
 */
export function bmcFiguur({ met = (t) => t } = {}) {
  return h('figure', { class: 'a3-vel citaat' },
    h('img', {
      src: 'media/citaten/strategyzer-zd-business-model-canvas.webp', width: 1200, height: 728, loading: 'lazy', decoding: 'async',
      alt: 'Het business model canvas: een rechthoek met negen vakken. Bovenaan vijf kolommen. Van links naar rechts: Key Partnerships; Key Activities boven Key Resources; Value Propositions in het midden; Customer Relationships boven Channels; Customer Segments. Onderaan twee brede vakken: links Cost Structure, rechts Revenue Streams. Elk vak heeft een pictogram, zoals een cadeau bij Value Propositions en een hoofd bij Customer Segments.',
    }),
    h('figcaption', {},
      h('p', {}, 'Figuur: in het midden de waardepropositie, rechts de markt, links wat nodig is om die markt te bedienen, onderaan kosten en inkomsten. Uit ', met('(Strategyzer, z.d.-a)'), ', het officiële sjabloon, via ', h('a', { href: 'https://www.strategyzer.com/library/the-business-model-canvas' }, 'Strategyzer'), '. Alleen het canvas is overgenomen. Licentie: ', h('a', { href: 'https://creativecommons.org/licenses/by-sa/3.0/' }, 'CC BY-SA 3.0'), '.'),
      h('details', { class: 'a3-koppeling' }, h('summary', {}, 'De bouwstenen van het canvas in de stof'),
        h('table', {}, h('thead', {}, h('tr', {}, ['Plek', 'In de figuur', 'In de stof'].map((k) => h('th', { scope: 'col' }, k)))),
          h('tbody', {}, BMC_BOUWSTENEN.map(([plek, en, nl]) => h('tr', {}, h('td', {}, plek), h('td', { lang: 'en' }, en), h('td', {}, nl))))))));
}

/** De lagen en kolommen van de TOM³-indeling (Westmoreland BV, z.d.), met eigen korte uitleg (geen zinnen uit het ongepubliceerde document, LI-3). */
const TOM_LAGEN = [['Strategisch', 'koers en lange termijn'], ['Tactisch', 'afspraken, processen en rollen'], ['Operationeel', 'het dagelijkse werk']];
const TOM_KOLOMMEN = [['Methode', 'hoe het werk loopt'], ['Mens', 'wie het doet en wat ze kunnen'], ['Machine', 'systemen en gegevens'], ['Informatie & Rapportage', 'cijfers om mee te sturen']];

/**
 * Figuur: eigen weergave van de TOM³-indeling naar Westmoreland BV (z.d.), in HTML en CSS zodat hij meeschaalt en de labels tekst blijven.
 * Drie lagen × vier kolommen; de vierde kolom verbindt de lagen: cijfers gaan omhoog, doelen gaan omlaag (ADR B93). Er is geen gepubliceerd
 * beeld van het model om te citeren; de licentie van de site geldt voor deze weergave.
 */
export function tomFiguur({ met = (t) => t } = {}) {
  const kop = ([naam, uitleg], extra = '') => h('div', { class: `tom-kop ${extra}`.trim() }, h('strong', {}, naam), h('span', {}, uitleg));
  return h('figure', { class: 'a3-vel tom-figuur' },
    h('div', {
      class: 'tom-raster', role: 'img',
      'aria-label': 'Het TOM-model als raster van drie lagen en vier kolommen. De lagen van boven naar beneden: strategisch (koers en lange termijn), tactisch (afspraken, processen en rollen) en operationeel (het dagelijkse werk). De kolommen: Methode (hoe het werk loopt), Mens (wie het doet en wat ze kunnen), Machine (systemen en gegevens) en Informatie & Rapportage (cijfers om mee te sturen). De vierde kolom is gekleurd en loopt door alle lagen. Een pijl omhoog: cijfers van de werkvloer gaan naar boven. Een pijl omlaag: doelen gaan naar beneden. Samen twaalf cellen.',
    },
      h('div', { class: 'tom-hoek' }),
      TOM_KOLOMMEN.map((k, i) => kop(k, i === 3 ? 'tom-ir' : '')),
      TOM_LAGEN.flatMap((laag, i) => [kop(laag, 'tom-laag'), ...[0, 1, 2].map(() => h('div', { class: 'tom-cel' })), h('div', { class: `tom-cel tom-ir tom-rij-${i + 2}` })]),
      h('div', { class: 'tom-lus', 'aria-hidden': 'true' },
        h('span', { class: 'tom-pijl' }, '▲', h('span', { class: 'tom-lijn' }), h('small', {}, 'cijfers')),
        h('span', { class: 'tom-pijl' }, h('small', {}, 'doelen'), h('span', { class: 'tom-lijn' }), '▼'))),
    h('figcaption', {},
      h('p', {}, 'Figuur: twaalf cellen. De vierde kolom verbindt de lagen: cijfers gaan omhoog, doelen gaan omlaag. Eigen weergave van de TOM³-indeling naar ', met('(Westmoreland BV, z.d.)'), '.')));
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
