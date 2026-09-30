// Schermen van leerblok 4: de verbanden-kaart (taak 9.4, VB-1…VB-10, LI-2) en het STARR-sjabloon (taak 6.3, LB-15).
// Alleen DOM; de regels zitten in verbanden.js en checks/lb4.js. De kaart is met het toetsenbord te bedienen (elke kaart is een
// knop, een verband maak je met twee knoppen en een formulier) en heeft een tekstweergave met dezelfde verbanden als de lijnen.
// De kolommen en lijnen worden zelf getekend (HTML en inline SVG); er zijn geen afbeeldingen van Strategyzer of het IIRC (LI-2).
import { h, wis, bouwVelden } from './dom.js';
import { tellers } from './checks/core.js';
import { stakeholdersUit, stakeholderRijen } from './raster.js';
import {
  KAPITALEN, TYPEN, SPANNING, MARKERINGEN, MAX_ZINNEN_SYNTHESE,
  bouwKaarten, bouwOefenKaarten, maakVerband, openPlekken, verbandRegel, verbandenUit, verbondenKaarten,
  markeringen, zetMarkering, chipTekst, kort,
} from './verbanden.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const TYPE_KLASSE = { 'hoort bij': 'hoort', 'leidt tot': 'leidt', 'gaat ten koste van': 'koste' };

// ---------------------------------------------------------------- de kaart met kolommen, lijnen en tekstweergave

/**
 * Bouwt drie kolommen kaarten met de verbanden ertussen.
 * @param {object} p
 * @param {ReturnType<typeof bouwKaarten>} p.kaarten kolommen en kaarten
 * @param {string[]} p.stakeholders namen voor de stakeholder bij een spanning (VB-6)
 * @param {object[]} [p.verbanden] beginwaarde
 * @param {string} p.idVoor voorvoegsel voor id's
 * @param {() => void} p.bijWijziging na elke wijziging van de verbanden
 * @returns {{element: HTMLElement, lees: () => object[], zet: (v: object[]) => void, kaarten: Map<string, object>}}
 */
function bouwKaart({ kaarten, stakeholders, verbanden: begin = [], idVoor, bijWijziging }) {
  let verbanden = verbandenUit({ verbanden: begin });
  let selectie = [];
  const knoppen = new Map();
  const status = h('p', { class: 'klein', role: 'status', id: `${idVoor}-status` });

  const lijnen = svgEl('svg', { class: 'vb-lijnen', 'aria-hidden': 'true', focusable: 'false' });
  const kolomEl = h('div', { class: 'vb-kolommen' }, lijnen, kaarten.kolommen.map((kolom) => h('div', { class: 'vb-kolom', role: 'group', 'aria-label': kolom.titel },
    h('h5', {}, kolom.titel, h('span', { class: 'klein vb-bron' }, kolom.bron === 'IIRC' ? ' (IIRC-model, zelf getekend)' : ` (${kolom.bron})`)),
    kolom.kaarten.length === 0
      ? h('p', { class: 'klein' }, 'Nog geen kaarten: vul eerst het register van leerblok 3 in met minstens één onderdeel van je VPC.')
      : h('ul', { class: 'vb-lijst' }, kolom.kaarten.map((k) => {
        const knop = h('button', { type: 'button', class: 'vb-kaartje', 'data-kaart': k.id, 'aria-pressed': 'false', title: k.label, onclick: () => kies(k.id) },
          h('span', { class: 'vb-kop' }, k.kop),
          k.tekst ? h('span', { class: 'vb-tekst' }, k.tekst) : (k.kolom === 'us' ? h('span', { class: 'vb-tekst' }, '(nog leeg in leerblok 1)') : null),
          k.gekozen ? h('span', { class: 'vb-gekozen' }, 'gekozen in je user story') : null);
        knoppen.set(k.id, knop);
        return h('li', {}, knop);
      })))));

  // ---- het formulier voor één verband (VB-3, VB-6)
  const formKop = h('p', { class: 'vb-form-kop', id: `${idVoor}-form-kop`, tabindex: '-1' });
  const typeRadios = TYPEN.map((t, i) => h('div', { class: 'optie' },
    h('input', { type: 'radio', id: `${idVoor}-type-${i}`, name: `${idVoor}-type`, value: t, onchange: () => { stakeholderRij.hidden = leesType() !== SPANNING; } }),
    h('label', { for: `${idVoor}-type-${i}` }, t)));
  const leesType = () => typeRadios.map((r) => r.firstChild).find((i) => i.checked)?.value ?? '';
  const zinVeld = h('textarea', { id: `${idVoor}-zin`, rows: 2 });
  const lijstId = `${idVoor}-stakeholders`;
  const stakeholderVeld = h('input', { type: 'text', id: `${idVoor}-stakeholder`, list: lijstId, autocomplete: 'off' });
  const stakeholderRij = h('div', { class: 'veld', hidden: true },
    h('label', { for: `${idVoor}-stakeholder` }, 'Welke stakeholder merkt dit als eerste?'), stakeholderVeld,
    h('datalist', { id: lijstId }, stakeholders.map((s) => h('option', { value: s }))),
    h('p', { class: 'klein' }, stakeholders.length ? 'Kies uit je stakeholderlijst.' : 'Je stakeholderlijst is nog leeg (leerblok 3); typ de naam.'));
  const formFout = h('p', { class: 'fout', role: 'alert', hidden: true });
  const form = h('form', { class: 'vb-form', hidden: true, 'aria-labelledby': `${idVoor}-form-kop`, onsubmit: (e) => { e.preventDefault(); voegToe(); }, onkeydown: (e) => { if (e.key === 'Escape') annuleer(); } },
    formKop,
    h('fieldset', {}, h('legend', {}, 'Wat voor verband is het?'), typeRadios),
    h('div', { class: 'veld' }, h('label', { for: `${idVoor}-zin` }, 'Waarom? Schrijf één zin.'), zinVeld),
    stakeholderRij, formFout,
    h('div', { class: 'knoppen' },
      h('button', { type: 'submit', class: 'knop knop-accent', 'data-actie': 'verband-toevoegen' }, 'Verband toevoegen'),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'verband-annuleren', onclick: annuleer }, 'Annuleer')));

  // ---- de tekstweergave en de open plekken (VB-4)
  const tekstLijst = h('ol', { class: 'vb-tekst-lijst', id: `${idVoor}-tekst` });
  const openLijst = h('ul', { class: 'vb-open', id: `${idVoor}-open` });
  const tekstKop = h('h5', { id: `${idVoor}-tekst-kop` }, 'Je verbanden in tekst');
  const openKop = h('h5', {}, 'Open plekken');

  const kaartVan = (id) => kaarten.kaarten.get(id);
  function ververs() {
    const verbonden = verbondenKaarten(verbanden);
    for (const [id, knop] of knoppen) {
      const n = verbanden.filter((v) => v.van === id || v.naar === id).length;
      const k = kaartVan(id);
      knop.setAttribute('aria-pressed', selectie.includes(id) ? 'true' : 'false');
      knop.classList.toggle('vb-verbonden', verbonden.has(id));
      knop.setAttribute('aria-label', `${k.kop}${k.tekst ? `: ${k.tekst}` : ''}${k.gekozen ? ' (gekozen in je user story)' : ''}, ${n === 0 ? 'geen verbanden' : `${n} ${n === 1 ? 'verband' : 'verbanden'}`}`);
    }
    wis(tekstLijst);
    verbanden.forEach((v, i) => tekstLijst.append(h('li', { 'data-verband': v.id },
      verbandRegel(v), !kaartVan(v.van) || !kaartVan(v.naar) ? h('span', { class: 'klein' }, ' (een van de kaarten staat niet meer in je bron)') : null,
      ' ', h('button', { type: 'button', class: 'knop vb-weg', 'aria-label': `Verwijder verband ${i + 1}`, onclick: () => verwijder(v.id) }, 'Verwijder'))));
    tekstKop.textContent = `Je verbanden in tekst (${verbanden.length})`;
    if (verbanden.length === 0) tekstLijst.append(h('li', { class: 'klein vb-leeg' }, 'Nog geen verbanden. Kies twee kaarten uit verschillende kolommen.'));
    wis(openLijst);
    for (const o of openPlekken({ kaarten: kaarten.kaarten, verbanden })) openLijst.append(h('li', { 'data-kaart': o.kaart }, o.vraag));
    openKop.hidden = openLijst.children.length === 0;
    plan();
  }

  // ---- lijnen tekenen (VB-10): automatisch tussen de kolommen, drie typen herkenbaar aan vorm
  let raf = 0;
  function plan() { cancelAnimationFrame(raf); raf = requestAnimationFrame(teken); }
  function teken() {
    wis(lijnen);
    const basis = kolomEl.getBoundingClientRect();
    if (basis.width === 0) return;
    lijnen.setAttribute('viewBox', `0 0 ${basis.width} ${basis.height}`);
    const defs = svgEl('defs');
    const pijl = svgEl('marker', { id: `${idVoor}-pijl`, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '8', markerHeight: '8', orient: 'auto' });
    pijl.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: 'vb-pijl' }));
    defs.append(pijl);
    lijnen.append(defs);
    for (const v of verbanden) {
      const a = knoppen.get(v.van);
      const b = knoppen.get(v.naar);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - basis.left;
      const y1 = ra.top + ra.height / 2 - basis.top;
      const x2 = rb.left - basis.left;
      const y2 = rb.top + rb.height / 2 - basis.top;
      const dx = Math.max(16, (x2 - x1) / 2);
      const pad = svgEl('path', { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, class: `vb-lijn vb-lijn-${TYPE_KLASSE[v.type]}`, 'data-verband': v.id });
      if (v.type === 'leidt tot') pad.setAttribute('marker-end', `url(#${idVoor}-pijl)`);
      lijnen.append(pad);
    }
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(plan).observe(kolomEl); else window.addEventListener('resize', plan);

  // ---- selecteren en toevoegen
  function kies(id) {
    const kaart = kaartVan(id);
    if (selectie.includes(id)) selectie = selectie.filter((s) => s !== id);
    else selectie = [...selectie.filter((s) => kaartVan(s).kolom !== kaart.kolom), id].slice(-2);
    if (selectie.length === 2) toonForm(); else sluitForm();
    status.textContent = selectie.length === 1 ? `Geselecteerd: ${kaart.label}. Kies nu een kaart uit een andere kolom.` : '';
    ververs();
  }
  function toonForm() {
    const [a, b] = selectie.map(kaartVan);
    formKop.textContent = `Verband tussen „${a.label}” en „${b.label}”`;
    form.hidden = false;
    formFout.hidden = true;
    zinVeld.value = '';
    stakeholderVeld.value = '';
    typeRadios.forEach((r) => { r.firstChild.checked = false; });
    stakeholderRij.hidden = true;
    formKop.focus();
  }
  function sluitForm() { form.hidden = true; }
  function annuleer() {
    const eerste = selectie[0];
    selectie = [];
    sluitForm();
    status.textContent = 'Geannuleerd.';
    ververs();
    knoppen.get(eerste)?.focus();
  }
  function voegToe() {
    const [van, naar] = selectie;
    const r = maakVerband({ van, naar, type: leesType(), zin: zinVeld.value, stakeholder: stakeholderVeld.value }, kaarten.kaarten, verbanden);
    if (!r.ok) { formFout.textContent = r.fout; formFout.hidden = false; return; }
    verbanden = [...verbanden, r.verband];
    selectie = [];
    sluitForm();
    status.textContent = `Verband toegevoegd (${verbanden.length}): ${verbandRegel(r.verband)}`;
    ververs();
    bijWijziging();
    knoppen.get(r.verband.van)?.focus();
  }
  function verwijder(id) {
    verbanden = verbanden.filter((v) => v.id !== id);
    status.textContent = `Verband verwijderd (${verbanden.length} over).`;
    ververs();
    bijWijziging();
  }

  const element = h('div', { class: 'vb-kaart', id: idVoor },
    h('p', { class: 'klein' }, 'Kies een kaart en daarna een kaart uit een andere kolom om een verband te leggen. Elke kaart is een knop; alle verbanden staan hieronder ook als tekst. Bronnen: ',
      h('a', { href: 'bronnen.html#bron-osterwalder-2014' }, 'Osterwalder e.a. (2014)'), ' voor het VPC en ', h('a', { href: 'bronnen.html#bron-iirc-2021' }, 'IIRC (2021)'), ' voor de zes kapitalen.'),
    h('div', { class: 'vb-bord' }, kolomEl), status, form, tekstKop, tekstLijst, openKop, openLijst);
  ververs();
  return {
    element, kaarten: kaarten.kaarten,
    lees: () => verbanden.map((v) => ({ ...v })),
    zet: (nieuw) => { verbanden = verbandenUit({ verbanden: nieuw }); selectie = []; sluitForm(); ververs(); },
  };
}

// ---------------------------------------------------------------- taak 9.4: oefencasus (VB-2) en toepassing (VB-1…VB-7)

/** Namen uit de stakeholderlijst van EV-06 (leerblok 3), voor de spanning bij een verband (VB-6). */
const stakeholderNamen = (store) => stakeholdersUit(store.get('EV-06')?.inhoud, stakeholderRijen({ voor: 's', aantal: 7 })).map((s) => s.naam);

/**
 * De oefencasus met drie open vragen en een eigen kaart met de kaarten van webshop X. Het modelvoorbeeld staat niet in deze
 * bouwer: de pagina toont het pas als de student minstens één lijn heeft getrokken (VB-2, `modelNa: 'lijn'`).
 */
export function bouwVerbandenOefening({ taak, velden, waarden, bijWijziging }) {
  const casus = taak.oefening.kaarten;
  const kaarten = bouwOefenKaarten(casus);
  const vragen = bouwVelden(velden, `oef-${taak.id}`, waarden, bijWijziging);
  const kaart = bouwKaart({ kaarten, stakeholders: casus.stakeholders ?? [], verbanden: waarden.verbanden, idVoor: `oef-${taak.id}-kaart`, bijWijziging });
  return {
    element: h('div', {}, h('h5', {}, 'Drie vragen bij de casus'), vragen.element, h('h5', {}, 'De kaart van webshop X'), kaart.element),
    lees: () => ({ ...vragen.lees(), verbanden: kaart.lees() }),
    zet: (w = {}) => { vragen.zet(w); kaart.zet(w.verbanden ?? []); },
    /** Het modelvoorbeeld als lijst verbanden, met de opmerking dat het hypotheses zijn (LRD 6.9). */
    modelExtra: (model) => (model?.verbanden ? h('div', {},
      h('h5', {}, 'Verbanden in het modelvoorbeeld'),
      h('p', { class: 'klein' }, 'Dit zijn hypotheses van de ontwerper en niet het enige juiste antwoord. Jouw verbanden mogen verschillen als je zin ze verdedigt.'),
      h('ul', { class: 'vb-model' }, model.verbanden.map((v) => h('li', {}, verbandRegel({ ...v, vanTekst: kaarten.kaarten.get(v.van)?.label, naarTekst: kaarten.kaarten.get(v.naar)?.label }))))) : null),
  };
}

/** De toepassing op het eigen vraagstuk: kaart, markering van de kapitalen, synthese en drie antwoorden. */
export function bouwVerbandenToepassing({ velden, waarden, bijWijziging, store, voorvoegsel }) {
  const kaarten = bouwKaarten({ ev01: store.get('EV-01')?.inhoud, ev07: store.get('EV-07')?.inhoud });
  const staat = { markering: Array.isArray(waarden.markering) ? waarden.markering : [], syntheseKaarten: Array.isArray(waarden.syntheseKaarten) ? waarden.syntheseKaarten : [] };
  const kaart = bouwKaart({ kaarten, stakeholders: stakeholderNamen(store), verbanden: waarden.verbanden, idVoor: `${voorvoegsel}-kaart`, bijWijziging });
  const label = (id) => velden.find((v) => v.id === id)?.label ?? id;

  // ---- de zes kapitalen markeren (VB-5)
  const markeerBlok = h('div', { class: 'vb-markering' }, KAPITALEN.map((k, i) => h('fieldset', { class: 'vb-markeer' },
    h('legend', {}, k, kaarten.kaarten.get(`kap:${k}`)?.gekozen ? ' (gekozen in je user story)' : ''),
    MARKERINGEN.map((m, j) => {
      const oid = `${voorvoegsel}-mark-${i}-${j}`;
      return h('div', { class: 'optie' },
        h('input', { type: 'radio', id: oid, name: `${voorvoegsel}-mark-${i}`, value: m, 'data-kapitaal': k, onchange: () => { staat.markering = zetMarkering({ markering: staat.markering }, k, m); bijWijziging(); } }),
        h('label', { for: oid }, m));
    }))));
  const zetMarkeringen = () => {
    const nu = markeringen({ markering: staat.markering });
    KAPITALEN.forEach((k, i) => MARKERINGEN.forEach((m, j) => { markeerBlok.querySelector(`#${CSS.escape(`${voorvoegsel}-mark-${i}-${j}`)}`).checked = nu[k] === m; }));
  };
  zetMarkeringen();

  // ---- synthese met kaarten als chips (VB-7)
  const zinstarter = (id) => velden.find((v) => v.id === id)?.zinstarter;
  const synthese = h('textarea', { id: `${voorvoegsel}-synthese`, rows: 5, placeholder: zinstarter('synthese') });
  synthese.value = waarden.synthese ?? '';
  const teller = h('p', { class: 'klein', role: 'status' });
  const tel = () => { const n = tellers.telZinnen(synthese.value); teller.textContent = `${n} van ${MAX_ZINNEN_SYNTHESE} zinnen`; teller.classList.toggle('fout', n > MAX_ZINNEN_SYNTHESE); };
  synthese.addEventListener('input', () => { tel(); bijWijziging(); });
  tel();
  const chips = h('div', { class: 'vb-chips', role: 'group', 'aria-label': 'Kaarten om in je synthese in te voegen' },
    [...kaarten.kaarten.values()].filter((k) => k.kolom !== 'us' || k.tekst).map((k) => h('button', { type: 'button', class: 'vb-chip', 'data-kaart': k.id, onclick: () => {
      const tekst = chipTekst(k);
      const van = synthese.selectionStart ?? synthese.value.length;
      synthese.setRangeText(tekst, van, synthese.selectionEnd ?? van, 'end');
      if (!staat.syntheseKaarten.some((c) => c.id === k.id)) staat.syntheseKaarten = [...staat.syntheseKaarten, { id: k.id, tekst }];
      synthese.focus();
      tel();
      bijWijziging();
    } }, `+ ${kort(k.label, 32)}`)));
  const nietZien = ['nietZien1', 'nietZien2', 'nietZien3'].map((id) => {
    const ta = h('textarea', { id: `${voorvoegsel}-${id}`, rows: 2, placeholder: zinstarter(id) });
    ta.value = waarden[id] ?? '';
    ta.addEventListener('input', bijWijziging);
    return { id, ta, rij: h('div', { class: 'veld' }, h('label', { for: `${voorvoegsel}-${id}` }, label(id)), ta) };
  });

  const geenBron = !store.get('EV-01') || kaarten.kolommen[1].kaarten.length === 0;
  const element = h('div', { class: 'vb-toepassing' },
    geenBron ? h('p', { class: 'klein', id: `${voorvoegsel}-bronmelding` }, 'Let op: je user story (leerblok 1) of het register van je VPC (leerblok 3) is nog leeg, dus sommige kolommen hebben weinig kaarten. Je kunt de kaart wel al gebruiken.') : null,
    kaart.element,
    h('h5', {}, 'Markeer de zes kapitalen'), h('p', { class: 'klein' }, 'Gaat het kapitaal erin als input, of komt het eruit als uitkomst, positief (+) of negatief (−)?'), markeerBlok,
    h('h5', {}, 'Je synthese'), h('div', { class: 'veld' }, h('label', { for: `${voorvoegsel}-synthese` }, label('synthese')), synthese), teller,
    h('p', { class: 'klein' }, 'Voeg kaarten uit minstens twee modellen in:'), chips,
    h('h5', {}, 'Wat laat elk model niet zien?'), nietZien.map((n) => n.rij));
  return {
    element,
    lees: () => ({
      verbanden: kaart.lees(), markering: staat.markering, synthese: synthese.value, syntheseKaarten: staat.syntheseKaarten,
      ...Object.fromEntries(nietZien.map((n) => [n.id, n.ta.value])),
    }),
    zet: (w = {}) => {
      kaart.zet(w.verbanden ?? []);
      staat.markering = Array.isArray(w.markering) ? w.markering : [];
      staat.syntheseKaarten = Array.isArray(w.syntheseKaarten) ? w.syntheseKaarten : [];
      synthese.value = w.synthese ?? '';
      nietZien.forEach((n) => { n.ta.value = w[n.id] ?? ''; });
      zetMarkeringen();
      tel();
    },
  };
}

// ---------------------------------------------------------------- taak 6.3: STARR-sjabloon (LB-15)

/** De vijf delen van de STARR, een keuzelijst voor het eigen gedrag, een optionele koppeling aan een feedbackregel (EV-09) en een volgende stap. */
export function bouwStarr({ velden, waarden, bijWijziging, store, voorvoegsel }) {
  const eerste = bouwVelden(velden.filter((v) => !['feedbackregel', 'volgende'].includes(v.id)), voorvoegsel, waarden, bijWijziging);
  const laatste = bouwVelden(velden.filter((v) => v.id === 'volgende'), voorvoegsel, waarden, bijWijziging);
  const selectId = `${voorvoegsel}-feedbackregel`;
  const select = h('select', { id: selectId, onchange: bijWijziging });
  let gekozen = waarden.feedbackregel ?? '';
  const opties = () => {
    const regels = (store.get('EV-09')?.inhoud?.regels ?? []).filter((r) => r && typeof r === 'object');
    wis(select);
    select.append(h('option', { value: '' }, '— geen koppeling —'));
    for (const r of regels) select.append(h('option', { value: r.id }, `${r.id} · ${r.richting === 'gegeven' ? 'gegeven' : 'ontvangen'} (${r.rol}): ${kort(r.zie || r.mis || r.vraag, 50)}`));
    if (gekozen && !regels.some((r) => r.id === gekozen)) select.append(h('option', { value: gekozen }, `${gekozen} (staat niet meer in je feedbacklog)`));
    select.value = gekozen;
  };
  opties();
  const ververs = () => { gekozen = select.value; opties(); };
  select.addEventListener('mousedown', ververs);
  select.addEventListener('focus', ververs);
  select.addEventListener('change', () => { gekozen = select.value; });
  const label = velden.find((v) => v.id === 'feedbackregel')?.label ?? 'Feedbackregel';
  return {
    element: h('div', { class: 'starr' }, eerste.element, h('div', { class: 'veld' }, h('label', { for: selectId }, label), select), laatste.element),
    lees: () => ({ ...eerste.lees(), feedbackregel: select.value, ...laatste.lees() }),
    zet: (w = {}) => { eerste.zet(w); laatste.zet(w); gekozen = w.feedbackregel ?? ''; opties(); },
  };
}
