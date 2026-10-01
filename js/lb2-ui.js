// Weergave van leerblok 2 (LB-5…LB-8) en in-tekstverwijzingen (BR-4). Alleen DOM; de regels zitten in checks/lb2.js en bronnen.js.
//
// Een taak kan bij `toepassing` een `weergave` hebben: een lijst `groepen` die bepaalt hoe de velden op het scherm staan.
// De velden zelf (id, label, type) blijven in `toepassing.velden` staan, dus opslag, controles en record veranderen niet.
//   groep  { titel?, velden?: [id], tabel?: { kolommen, rijen: [[id | { tekst }]] | reeks: { voor, aantal, suffixen } }, groepen?: [groep],
//            alleenBij?: { veld, waarde }        alleen zichtbaar als dat veld die waarde heeft (route A of B)
//            optioneel?, toevoegKnop?            verborgen tot iemand de knop indrukt of er al iets in staat
//            afgeleidVan?: "3.1", kolommen?      toont alleen de waarden van een andere taak (dezelfde veld-id's)
//            promptgenerator?: { zoekvraag, context, jaar, lijst, prompt, overnemenUit? }   (LB-6)
//            bord?: { voor, aantal, vraagstuk?, vraagstukTekst?, voorstel? }   het stakeholderbord (LB-9, SX-16): het invloed/belang-raster als
//                                                 invoer; rij i heeft de velden <voor>i + naam, soort, raakt, invloed en belang;
//                                                 het vraagstuk in het midden komt uit veld `vraagstuk` of is `vraagstukTekst` (oefencasus);
//                                                 `voorstel` is een bewijsonderdeel (EV-01) waarvan de gebruiker als voorstel in de bak ligt.
//                                                 Met `hint` en `hintBron` op de groep (SX-13). De module komt via ctx.bord (alleen leerblok 3).
//            tombord?: { niveau? } | { signalen }  TOM-bord van 8.1 (ADR B98): invoer voor tomS1 … tomO4, of signalen om te plaatsen
//            zoekvragenHint?                      toont de zoekvragen uit EV-02 (LB-12)
//            hint?                                 bij afgeleidVan: eigen tekst onder de spiegeltabel }
import { h, wis, bouwVelden, hintEl } from './dom.js';
import { bouwPrompt, verbodenWoorden } from './checks/lb2.js';
import { zoekvragenEl } from './lb3-ui.js';
import { stakeholderRijen, reeks } from './raster.js';
import { tomGroepLater, tomModelLater, TOM_VELDEN } from './tom-later.js';

export { metVerwijzingen } from './verwijzing.js';

// Een taak die zijn waarden deelt met een andere taak (3.1 → 3.2): één plek per taak op de pagina.
const delen = new Map();
const deelVan = (taakId) => {
  if (!delen.has(taakId)) delen.set(taakId, { lees: null, luisteraars: new Set() });
  return delen.get(taakId);
};

/** De rijen van een tabel: expliciet, of als reeks (rij i heeft de velden <voor>i + suffix). */
const tabelRijen = (g) => g.tabel?.rijen ?? (g.tabel?.reeks ? reeks(g.tabel.reeks.voor, g.tabel.reeks.aantal, g.tabel.reeks.suffixen) : []);

/** „Ons vraagstuk is dat planners te laat roosteren” → „Planners te laat roosteren”: in het midden van het bord staat alleen de kern. */
function zonderZinstarter(tekst, zinstarter) {
  const t = String(tekst ?? '').trim();
  const begin = String(zinstarter ?? '').split('…')[0].trim().toLowerCase();
  if (!begin || !t.toLowerCase().startsWith(begin)) return t;
  const kern = t.slice(begin.length).trim();
  return kern.charAt(0).toUpperCase() + kern.slice(1);
}

const heeftWaarde = (w) => (Array.isArray(w) ? w.length > 0 : typeof w === 'string' ? w.trim() !== '' : w !== undefined && w !== null);

/**
 * Bouwt de velden van een toepassing volgens `weergave`. Zelfde uitvoer als `bouwVelden`.
 * @param {object[]} velden
 * @param {string} voorvoegsel
 * @param {object} waarden beginwaarden
 * @param {() => void} bijWijziging
 * @param {{groepen: object[]}} weergave
 * @param {{taakId: string, store: object, leesToepassing: (taakId: string) => object}} ctx
 */
export function bouwWeergave(velden, voorvoegsel, waarden, bijWijziging, weergave, ctx) {
  const def = new Map(velden.map((v) => [v.id, v]));
  const bouwers = new Map(); // veld-id → { element, lees, zet }
  const spiegels = []; // { velden, toon }
  const verversers = []; // tekeningen die meegaan met de velden (het vraagstuk in het midden van het bord)
  const regels = []; // { el, veld, waarde }
  let generator = null; // { p, genereer, toon } zodra een groep een promptgenerator heeft
  const hier = deelVan(ctx.taakId);
  let bezig = false;

  const eigenWaarde = (id) => (bouwers.get(id)?.lees() ?? {})[id];
  const pasZichtbaarheid = () => regels.forEach((r) => { r.el.hidden = eigenWaarde(r.veld) !== r.waarde; });
  const melding = () => {
    if (bezig) return;
    pasZichtbaarheid();
    verversers.forEach((f) => f());
    bijWijziging();
    hier.luisteraars.forEach((f) => f());
  };

  const bouwVeld = (id) => {
    if (!def.has(id)) throw new Error(`weergave verwijst naar onbekend veld ${id}`);
    if (!bouwers.has(id)) bouwers.set(id, bouwVelden([def.get(id)], voorvoegsel, waarden, () => veldWijziging(id)));
    return bouwers.get(id);
  };

  // ---------------------------------------------------------------- groepen

  const alleIds = (g) => [...(g.velden ?? []), ...(tabelRijen(g).flat().filter((c) => typeof c === 'string')), ...(g.groepen ?? []).flatMap(alleIds)];

  function spiegelEl(g) {
    const bron = deelVan(g.afgeleidVan);
    const lees = () => (bron.lees ? bron.lees() : ctx.leesToepassing(g.afgeleidVan));
    const kolommen = g.kolommen ?? ['Kernbegrip', 'Synoniemen / verwante termen', 'Engelse term'];
    const tbody = h('tbody');
    const toon = () => {
      wis(tbody);
      const w = lees();
      for (let i = 0; i < g.velden.length; i += kolommen.length) {
        const rij = g.velden.slice(i, i + kolommen.length).map((id) => w[id] ?? '');
        tbody.append(h('tr', {}, rij.map((c) => h('td', {}, c === '' ? '—' : c))));
      }
    };
    spiegels.push({ velden: g.velden, toon });
    bron.luisteraars.add(() => { toon(); melding(); });
    toon();
    return h('div', { class: 'lb2-tabel-wrap' },
      h('table', { class: 'lb2-tabel' }, h('thead', {}, h('tr', {}, kolommen.map((k) => h('th', { scope: 'col' }, k)))), tbody),
      h('p', { class: 'klein' }, g.hint ?? `Je vult of wijzigt deze termen bij taak ${g.afgeleidVan}.`));
  }

  function tabelEl(g) {
    const kop = h('thead', {}, h('tr', {}, g.tabel.kolommen.map((k) => h('th', { scope: 'col' }, k))));
    const rijen = tabelRijen(g).map((rij) => h('tr', {}, rij.map((cel, i) => (typeof cel === 'string'
      ? h('td', { class: 'lb2-cel-veld', 'data-kolom': g.tabel.kolommen[i] }, bouwVeld(cel).element)
      : h('td', { 'data-kolom': g.tabel.kolommen[i] }, cel.tekst)))));
    return h('div', { class: 'lb2-tabel-wrap' }, h('table', { class: 'lb2-tabel' }, kop, h('tbody', {}, rijen)));
  }

  function promptEl(g) {
    const p = g.promptgenerator;
    const waarde = (id) => eigenWaarde(id) ?? '';
    const waarschuwingen = h('ul', { class: 'lb2-waarschuwing', role: 'status', 'aria-live': 'polite' });
    const toonWaarschuwing = () => {
      wis(waarschuwingen);
      for (const w of verbodenWoorden(waarde(p.prompt), waarde(p.lijst))) {
        waarschuwingen.append(h('li', {}, `Let op: „${w}” staat in je prompt, maar staat ook in je „niet noemen”-lijst. Haal het woord uit de prompt.`));
      }
    };
    const genereer = () => bouwers.get(p.prompt).zet({ [p.prompt]: bouwPrompt({ zoekvraag: waarde(p.zoekvraag), context: waarde(p.context), jaar: waarde(p.jaar) }) });
    generator = { p, genereer, toon: toonWaarschuwing };

    const bewijs = p.overnemenUit ? ctx.store.get(p.overnemenUit.bewijs)?.inhoud : null;
    const keuzes = (p.overnemenUit?.velden ?? []).map((id) => bewijs?.[id]).filter((t) => typeof t === 'string' && t.trim() !== '');
    let overnemen = null;
    if (keuzes.length > 0) {
      const sel = h('select', { id: `${voorvoegsel}-overnemen`, onchange: () => {
        if (sel.value === '') return;
        bouwers.get(p.zoekvraag).zet({ [p.zoekvraag]: sel.value });
        genereer(); toonWaarschuwing(); melding();
      } }, h('option', { value: '' }, '— kies —'), keuzes.map((k) => h('option', { value: k }, k)));
      overnemen = h('div', { class: 'veld' }, h('label', { for: `${voorvoegsel}-overnemen` }, 'Neem een zoekvraag uit leerblok 1 over'), sel);
      if (waarde(p.zoekvraag).trim() === '') { bouwers.get(p.zoekvraag).zet({ [p.zoekvraag]: keuzes[0] }); sel.value = keuzes[0]; }
    }
    if (waarde(p.prompt).trim() === '' && waarde(p.zoekvraag).trim() !== '') genereer();
    toonWaarschuwing();

    const kopieerStatus = h('span', { class: 'klein', role: 'status' });
    const kopieer = h('button', { type: 'button', class: 'knop', onclick: async () => {
      try { await navigator.clipboard.writeText(waarde(p.prompt)); kopieerStatus.textContent = ' Gekopieerd.'; }
      catch (e) { kopieerStatus.textContent = ' Kopiëren lukt hier niet; selecteer de tekst en kopieer hem zelf.'; }
    } }, 'Kopieer de prompt');
    return h('div', { class: 'lb2-generator' }, overnemen,
      h('p', { class: 'klein' }, 'Vul de velden in; de prompt hieronder wordt dan opnieuw gemaakt. Je kunt hem daarna nog aanpassen.'),
      h('div', { class: 'lb2-generator-acties' }, kopieer, kopieerStatus), waarschuwingen);
  }

  function groepEl(g) {
    const doos = h('div', { class: 'lb2-groep' });
    if (g.titel) doos.append(h('h4', {}, g.titel));
    if (g.afgeleidVan) doos.append(spiegelEl(g));
    else {
      if (g.zoekvragenHint) doos.append(zoekvragenEl(ctx.store));
      if (g.tabel) doos.append(tabelEl(g));
      if (g.bord) {
        const b = ctx.bord.stakeholderBord({
          rijen: stakeholderRijen(g.bord), voorvoegsel, waarden, bijWijziging: melding, hint: hintEl(g.hint, g.hintBron),
          vraagstuk: () => (g.bord.vraagstuk ? zonderZinstarter(eigenWaarde(g.bord.vraagstuk), def.get(g.bord.vraagstuk)?.zinstarter) : g.bord.vraagstukTekst ?? ''),
          voorstel: g.bord.voorstel ? String(ctx.store?.get(g.bord.voorstel)?.inhoud?.gebruiker ?? '').trim() : '',
        });
        bouwers.set(`bord:${g.bord.voor}`, b);
        verversers.push(b.ververs);
        doos.append(b.element);
      }
      if (g.tombord) doos.append(hintEl(g.hint, g.hintBron) ?? '', tomGroepEl(g.tombord));
      (g.velden ?? []).forEach((id) => doos.append(bouwVeld(id).element));
      if (g.promptgenerator) doos.append(promptEl(g));
      (g.groepen ?? []).forEach((k) => doos.append(groepEl(k)));
    }
    if (g.alleenBij) regels.push({ el: doos, ...g.alleenBij });
    if (!g.optioneel) return doos;
    // optioneel blok (bron 2): verborgen tot er iets in staat of iemand de knop indrukt
    const begonnen = alleIds(g).some((id) => heeftWaarde(waarden?.[id]));
    const knop = h('button', { type: 'button', class: 'knop', onclick: () => { doos.hidden = false; knop.hidden = true; doos.querySelector('input, textarea, select')?.focus(); } }, g.toevoegKnop ?? 'Toevoegen');
    doos.hidden = !begonnen;
    knop.hidden = begonnen;
    return h('div', { class: 'lb2-optioneel' }, knop, doos);
  }

  const signaalLijst = (ids) => ids.map((id) => ({ id, tekst: def.get(id)?.label ?? id }));
  function tomGroepEl(t) {
    const b = tomGroepLater({ ids: t.signalen ?? TOM_VELDEN, waarden, maak: (m, w) => (t.signalen
      ? m.signaalBord({ signalen: signaalLijst(t.signalen), waarden: w, bijWijziging: melding })
      : m.tomBord({ voorvoegsel, waarden: w, bijWijziging: melding, niveau: () => eigenWaarde(t.niveau) ?? '', zinstarter: def.get(TOM_VELDEN[0])?.zinstarter })) });
    bouwers.set(`tombord:${t.signalen ? 'oefening' : 'toepassing'}`, b);
    verversers.push(b.ververs);
    return b.element;
  }

  function veldWijziging(id) {
    if (generator) {
      const { p } = generator;
      if ([p.zoekvraag, p.context, p.jaar].includes(id)) generator.genereer();
      if ([p.zoekvraag, p.context, p.jaar, p.lijst, p.prompt].includes(id)) generator.toon();
    }
    melding();
  }

  const flat = (g) => [g, ...(g.groepen ?? []).flatMap(flat)];
  const alleGroepen = weergave.groepen.flatMap(flat);
  const element = h('div', { class: 'lb2-weergave' }, weergave.groepen.map(groepEl));
  pasZichtbaarheid();

  const lees = () => {
    const uit = {};
    for (const b of bouwers.values()) Object.assign(uit, b.lees());
    for (const g of alleGroepen.filter((x) => x.afgeleidVan)) {
      const bron = deelVan(g.afgeleidVan);
      const w = bron.lees ? bron.lees() : ctx.leesToepassing(g.afgeleidVan);
      for (const id of g.velden) if (w[id] !== undefined) uit[id] = w[id];
    }
    return uit;
  };
  const zet = (w = {}) => {
    bezig = true;
    for (const b of bouwers.values()) b.zet(w);
    bezig = false;
    pasZichtbaarheid();
    verversers.forEach((f) => f());
    spiegels.forEach((s) => s.toon());
  };
  hier.lees = lees;
  verversers.forEach((f) => f()); // het raster tekent de beginwaarden
  // Het modelantwoord van een oefening met signalen staat op het TOM-bord, naast de plek die de student koos (TK-6).
  const sig = alleGroepen.find((g) => g.tombord?.signalen)?.tombord.signalen;
  const modelFiguur = sig && ((model, eigen) => tomModelLater(sig, (m) => m.modelSignaalBord({ signalen: signaalLijst(sig), model: model?.velden, eigen })));
  return { element, lees, zet, modelFiguur };
}
