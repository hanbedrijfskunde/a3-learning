// Het stakeholderbord (SX-16, ADR B96, DESIGN §6): het invloed/belang-raster als figuur én als invoer. Alleen DOM; de regels
// staan in raster.js. Het bord schrijft de velden van EV-06 (s1naam … s7belang); het dossier merkt er niets van.
import { h, wis } from './dom.js';
import { KWADRANTEN, bouwRaster, rasterTekst, stakeholdersUit, stakeholderRijen, vakVan, schuif } from './raster.js';

// De opmaak staat in een eigen stylesheet, zodat pagina's zonder bord hem niet laden (PF-4); `klaar` wacht erop.
const CSS = new URL('../css/stakeholderbord.css', import.meta.url).href;
export const klaar = new Promise((af) => {
  if (document.querySelector(`link[href="${CSS}"]`)) { af(); return; }
  document.head.append(h('link', { rel: 'stylesheet', href: CSS, onload: af, onerror: af }));
});

// Zoals de figuur: boven invloed hoog, rechts belang hoog.
const OPSTELLING = ['tevreden', 'nauw', 'volgen', 'informeren'];
const KORT = { intern: 'int', extern: 'ext' };
const [NAAM, SOORT, RAAKT, INVLOED, BELANG] = [0, 1, 2, 3, 4];

/** Naam plus „int” of „ext”: intern of extern staat er altijd in tekst bij, nooit alleen als vorm (TG-4). */
function kaartInhoud(s) {
  return [h('span', { class: 'sb-naam' }, s.naam),
    h('span', { class: `sb-soort${s.soort ? '' : ' sb-soort-open'}`, 'aria-hidden': 'true' }, KORT[s.soort] ?? '?'),
    h('span', { class: 'sr-only' }, s.soort ? ` (${s.soort})` : ' (intern of extern nog niet gekozen)')];
}
const kaartKlasse = (s) => `sb-kaart${s.soort === 'intern' ? ' sb-intern' : ''}`;

function zetMidden(el, vraagstuk) {
  const leeg = !String(vraagstuk ?? '').trim();
  el.classList.toggle('sb-midden-leeg', leeg);
  wis(el).append(h('span', { class: 'sr-only' }, 'Vraagstuk: '), leeg ? 'Je vraagstuk' : vraagstuk);
}

/** Het raster met assen, vier vakken en het vraagstuk op het kruispunt (zoals op vel 1). `extra`: de knop „Zet hier”. */
function rasterEl(stakeholders, vraagstuk, kaart, extra = () => null) {
  const r = bouwRaster(stakeholders);
  const midden = h('div', { class: 'sb-midden' });
  zetMidden(midden, vraagstuk);
  const vakken = OPSTELLING.map((id) => {
    const k = r.kwadranten.find((q) => q.id === id);
    return h('div', { class: 'sb-vak', 'data-vak': id },
      h('p', { class: 'sb-vaknaam' }, k.titel),
      h('p', { class: 'sb-vakmeta' }, `invloed ${k.invloed} · belang ${k.belang}`),
      h('ul', { class: 'sb-kaarten', 'aria-label': k.titel }, k.leden.map((s) => h('li', {}, kaart(s)))),
      extra(k));
  });
  const as = (klasse, naam) => h('div', { class: `sb-as ${klasse}`, 'aria-hidden': 'true' }, h('span', {}, 'laag'), h('span', { class: 'sb-asnaam' }, `${naam} →`), h('span', {}, 'hoog'));
  return h('div', { class: 'sb-assen' }, as('sb-as-y', 'Invloed'), h('div', { class: 'sb-raster' }, vakken, midden), as('sb-as-x', 'Belang'));
}

function tekstLijst(lijst, stakeholders) {
  const regels = rasterTekst(bouwRaster(stakeholders));
  wis(lijst).append(...(regels.length ? regels.map((r) => h('li', {}, r)) : [h('li', {}, 'Er staan nog geen stakeholders op het bord.')]));
  return lijst;
}
const tekstEl = (lijst) => h('details', { class: 'sb-tekst' }, h('summary', {}, 'Het bord in tekst'), lijst);

/** Een vast bord (stof, voorbeeld, modelantwoord): dezelfde tekening, zonder invoer. */
export function vastBord({ stakeholders = [], vraagstuk = '', bijschrift = null }) {
  return h('figure', { class: 'sb-figuur' },
    rasterEl(stakeholders, vraagstuk, (s) => h('span', { class: `${kaartKlasse(s)} sb-vast` }, kaartInhoud(s))),
    bijschrift ? h('figcaption', { class: 'klein' }, bijschrift) : null,
    stakeholders.length ? tekstEl(tekstLijst(h('ul'), stakeholders)) : null);
}

/** Het model zelf, leeg, voor in de stof van taak 5.1 (SX-15). */
export const rasterFiguur = () => vastBord({
  vraagstuk: 'Het vraagstuk',
  bijschrift: 'Figuur: het invloed/belang-raster. Omhoog neemt de invloed toe, naar rechts het belang. Elk vak zegt wat je met de stakeholders erin doet.',
});

/** Het modelantwoord op het bord (TK-6): de stakeholders uit de velden, plus welke veld-id's het bord al toont. */
export function modelBord(velden, cfg) {
  const rijen = stakeholderRijen(cfg);
  return { element: vastBord({ stakeholders: stakeholdersUit(velden, rijen), vraagstuk: cfg.vraagstukTekst ?? '' }), ids: new Set(rijen.flat()) };
}

const lijkt = (a, b) => {
  const [x, y] = [a, b].map((t) => String(t ?? '').trim().toLowerCase());
  return x !== '' && y !== '' && (x.includes(y) || y.includes(x));
};

/**
 * Het bord als invoer (SX-16), in de vorm van bouwVelden ({element, lees, zet}) plus `ververs` voor het midden. Plaatsen:
 * slepen, tikken (kaart, dan vak) of pijltjes. `rijen`: per stakeholder [naam, soort, raakt, invloed, belang];
 * `voorstel`: de gebruiker uit EV-01, als voorstel in de bak.
 */
export function stakeholderBord({ rijen, voorvoegsel, waarden = {}, bijWijziging, vraagstuk, voorstel = '', hint = null }) {
  const ids = rijen.flat();
  const w = {};
  const zetW = (v = {}) => { for (const id of ids) w[id] = typeof v?.[id] === 'string' ? v[id] : ''; };
  zetW(waarden);
  const veld = (nr, i) => rijen[nr - 1][i];
  const alle = () => stakeholdersUit(w, rijen);
  const vanNr = (nr) => alle().find((s) => s.nr === nr);
  let opgepakt = null; // de kaart die de student verplaatst
  let gekozen = null; // de kaart in het detailpaneel
  let focusNa = null; // wat na het tekenen de focus krijgt

  const status = h('p', { class: 'klein sb-status', role: 'status' });
  const bak = h('div', { class: 'sb-bak', 'data-doel': 'bak' });
  const bord = h('div', { class: 'sb-bord' });
  const paneel = h('div', { class: 'sb-paneel', hidden: true });
  const lijst = h('ul');
  const nieuw = h('input', { type: 'text', id: `${voorvoegsel}-sb-nieuw`, autocomplete: 'off', placeholder: 'Bijvoorbeeld: klantenservice', onkeydown: (e) => {
    if (e.key === 'Enter') { e.preventDefault(); voegToe(nieuw.value); }
  } });
  const element = h('div', { class: 'sb' }, hint, bak, bord, status, paneel, tekstEl(lijst));

  const wijzig = (bericht) => { if (bericht) status.textContent = bericht; teken(); bijWijziging(); };

  function voegToe(naam) {
    const n = naam.trim();
    if (!n) return;
    const vrij = rijen.findIndex((r) => w[r[NAAM]].trim() === '');
    if (vrij < 0) { status.textContent = `Het bord is vol (${rijen.length}).`; return; }
    rijen[vrij].forEach((id) => { w[id] = ''; });
    w[rijen[vrij][NAAM]] = n;
    nieuw.value = '';
    focusNa = 'nieuw';
    wijzig(`${n} ligt in de bak. Sleep de kaart naar een vak, of tik erop en kies een vak.`);
  }

  function plaats(nr, pos) {
    const s = vanNr(nr);
    if (!s) return;
    w[veld(nr, INVLOED)] = pos?.invloed ?? '';
    w[veld(nr, BELANG)] = pos?.belang ?? '';
    opgepakt = null;
    focusNa = nr;
    const vak = pos ? vakVan(pos) : null;
    wijzig(vak ? `${s.naam} staat nu bij ${vak.titel}.` : `${s.naam} ligt weer in de bak.`);
  }

  function pak(nr) {
    const s = vanNr(nr);
    opgepakt = opgepakt === nr ? null : nr;
    gekozen = nr;
    focusNa = nr;
    status.textContent = opgepakt ? `${s.naam} opgepakt. Kies een vak, of gebruik de pijltjes.` : `${s.naam} blijft staan.`;
    teken();
    tekenPaneel();
  }

  function verwijder(nr) {
    const s = vanNr(nr);
    rijen[nr - 1].forEach((id) => { w[id] = ''; });
    gekozen = null;
    opgepakt = null;
    focusNa = 'nieuw';
    tekenPaneel();
    wijzig(`${s?.naam ?? 'De kaart'} is van het bord gehaald.`);
  }

  // ------------------------------------------------------------ slepen (muis en aanraking)
  let sleep = null;
  let negeerKlik = false;
  const doelOnder = (x, y) => {
    const d = document.elementFromPoint(x, y)?.closest('.sb-vak, .sb-bak');
    return d && element.contains(d) ? d : null;
  };
  function sleepStart(e, nr) {
    if (e.button !== 0) return;
    sleep = { nr, el: e.currentTarget, x: e.clientX, y: e.clientY, bezig: false, doel: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  element.addEventListener('pointermove', (e) => {
    if (!sleep) return;
    const [dx, dy] = [e.clientX - sleep.x, e.clientY - sleep.y];
    if (!sleep.bezig && Math.hypot(dx, dy) < 6) return;
    sleep.bezig = true;
    sleep.el.classList.add('sb-sleept');
    sleep.el.style.transform = `translate(${dx}px, ${dy}px)`;
    sleep.doel = doelOnder(e.clientX, e.clientY);
    element.querySelectorAll('.sb-vak, .sb-bak').forEach((d) => d.classList.toggle('sb-doel', d === sleep.doel));
  });
  const sleepEind = (e) => {
    if (!sleep) return;
    const { nr, bezig, doel } = sleep;
    sleep = null;
    if (!bezig) return;
    negeerKlik = true;
    setTimeout(() => { negeerKlik = false; }, 0);
    if (e.type === 'pointercancel' || !doel) { teken(); return; }
    if (doel.dataset.doel === 'bak') { plaats(nr, null); return; }
    const k = KWADRANTEN.find((q) => q.id === doel.dataset.vak);
    plaats(nr, { invloed: k.invloed, belang: k.belang });
  };
  element.addEventListener('pointerup', sleepEind);
  element.addEventListener('pointercancel', sleepEind);

  // ------------------------------------------------------------ tekenen
  const kaartKnop = (s) => h('button', {
    type: 'button', class: `${kaartKlasse(s)}${opgepakt === s.nr ? ' sb-opgepakt' : ''}`, 'data-nr': s.nr, 'aria-pressed': String(opgepakt === s.nr),
    onclick: () => { if (!negeerKlik) pak(s.nr); },
    onkeydown: (e) => {
      const pos = schuif(s, e.key);
      if (pos) { e.preventDefault(); plaats(s.nr, pos); } else if (e.key === 'Escape' && opgepakt === s.nr) { e.preventDefault(); pak(s.nr); }
    },
    onpointerdown: (e) => sleepStart(e, s.nr),
  }, kaartInhoud(s));

  const zetHier = (k) => (opgepakt === null ? null : h('button', { type: 'button', class: 'knop sb-zet', onclick: (e) => { e.stopPropagation(); plaats(opgepakt, k); } },
    'Zet hier', h('span', { class: 'sr-only' }, `: ${k.titel}`)));

  function teken() {
    const alles = alle();
    const inBak = alles.filter((s) => !vakVan(s));
    const vol = alles.length >= rijen.length;
    const metVoorstel = voorstel && !vol && !alles.some((s) => lijkt(s.naam, voorstel));
    wis(bak).append(
      h('p', { class: 'sb-baknaam' }, 'Nog te plaatsen'),
      inBak.length || metVoorstel
        ? h('ul', { class: 'sb-kaarten' }, inBak.map((s) => h('li', {}, kaartKnop(s))),
          metVoorstel ? h('li', {}, h('button', { type: 'button', class: 'sb-voorstel', onclick: () => voegToe(voorstel) },
            `+ ${voorstel}`, h('span', { class: 'sb-voorstel-uitleg' }, ' · uit je onderzoeksvraag'))) : null)
        : h('p', { class: 'klein sb-leeg' }, alles.length ? 'Alles staat op het bord.' : 'Nog leeg. Voeg hieronder je eerste stakeholder toe.'),
      vol
        ? h('p', { class: 'klein' }, `Het bord is vol (${rijen.length}).`)
        : h('div', { class: 'sb-nieuw' }, h('label', { for: nieuw.id }, 'Stakeholder toevoegen'),
          h('div', { class: 'sb-nieuwrij' }, nieuw, h('button', { type: 'button', class: 'knop', onclick: () => voegToe(nieuw.value) }, 'Voeg toe'))));
    wis(bord).append(rasterEl(alles, vraagstuk(), kaartKnop, zetHier));
    bord.querySelectorAll('.sb-vak').forEach((v) => v.addEventListener('click', (e) => {
      if (opgepakt === null || e.target.closest('button')) return;
      const k = KWADRANTEN.find((q) => q.id === v.dataset.vak);
      plaats(opgepakt, k);
    }));
    element.classList.toggle('sb-bezig', opgepakt !== null);
    tekstLijst(lijst, alles);
    if (focusNa === 'nieuw') nieuw.focus();
    else if (focusNa) element.querySelector(`.sb-kaart[data-nr="${focusNa}"]`)?.focus();
    focusNa = null;
  }

  function tekenPaneel(focusOp = null) {
    const s = gekozen ? vanNr(gekozen) : null;
    wis(paneel);
    paneel.hidden = !s;
    if (!s) return;
    const nr = s.nr;
    const naamId = `${voorvoegsel}-sb-naam`;
    const raaktId = `${voorvoegsel}-sb-raakt`;
    const naamVeld = h('input', { type: 'text', id: naamId, autocomplete: 'off', value: s.naam, oninput: () => {
      if (naamVeld.value.trim() === '') return; // een lege naam haalt de kaart pas weg met „Verwijder”
      w[veld(nr, NAAM)] = naamVeld.value; teken(); bijWijziging();
    } });
    const raaktVeld = h('input', { type: 'text', id: raaktId, autocomplete: 'off', value: s.raakt, oninput: () => { w[veld(nr, RAAKT)] = raaktVeld.value; bijWijziging(); } });
    const soortKnop = (soort) => h('button', { type: 'button', class: 'knop sb-soortknop', 'data-soort': soort, 'aria-pressed': String(s.soort === soort), onclick: () => {
      w[veld(nr, SOORT)] = soort; teken(); tekenPaneel(soort); bijWijziging();
    } }, soort);
    paneel.append(
      h('p', { class: 'eyebrow' }, 'Kaart'),
      h('h5', { class: 'sb-paneelkop' }, s.naam),
      h('div', { class: 'veld' }, h('label', { for: naamId }, 'Naam'), naamVeld),
      h('div', { class: 'veld' }, h('span', { class: 'sb-label', id: `${voorvoegsel}-sb-soortlabel` }, 'Intern of extern'),
        h('div', { class: 'knoppen sb-soortknoppen', role: 'group', 'aria-labelledby': `${voorvoegsel}-sb-soortlabel` }, soortKnop('intern'), soortKnop('extern'))),
      h('div', { class: 'veld' }, h('label', { for: raaktId }, 'Hoe raakt het vraagstuk deze stakeholder?'), raaktVeld),
      h('div', { class: 'knoppen' },
        vakVan(s) ? h('button', { type: 'button', class: 'knop', onclick: () => plaats(nr, null) }, 'Terug naar de bak') : null,
        h('button', { type: 'button', class: 'knop', onclick: () => verwijder(nr) }, 'Verwijder'),
        h('button', { type: 'button', class: 'knop', onclick: () => { gekozen = null; opgepakt = null; focusNa = nr; tekenPaneel(); teken(); } }, 'Sluit')));
    if (focusOp) paneel.querySelector(`[data-soort="${focusOp}"]`)?.focus();
  }

  const lees = () => ({ ...w });
  const zet = (v = {}) => { zetW(v); opgepakt = null; gekozen = null; teken(); tekenPaneel(); };
  const ververs = () => { const m = bord.querySelector('.sb-midden'); if (m) zetMidden(m, vraagstuk()); };
  teken();
  return { element, lees, zet, ververs };
}
