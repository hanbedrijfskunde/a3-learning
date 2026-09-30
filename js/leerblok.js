// Leerblokpagina: bouwt de pagina uit data/leerblok-N.json met het vaste ritme van vijf stappen per taak (TK-18).
// Alleen DOM. Controles, opslag, oefenregels en de afgerond-regel zitten in sessie.js, weergave.js en afgerond.js.
import { h, wis, statusChip, bouwVelden } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import { maakSessie, volgendeStapOk } from './sessie.js';
import { bouwTaakModel, isIngevuld } from './weergave.js';
import { leesProfiel } from './profiel.js';
import { VOORBEELDEN } from './checks/index.js';

const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();
const BEWAAR_NA_MS = 500; // bewaren na de laatste toetsaanslag; de controles zelf lopen direct

/** Het modelantwoord als lijst van veld en antwoord. */
function modelantwoordEl(model, velden) {
  const dl = h('dl', { class: 'model-lijst' });
  for (const v of velden) {
    const w = model.velden?.[v.id];
    if (w === undefined) continue;
    dl.append(h('dt', {}, v.label), h('dd', {}, Array.isArray(w) ? w.join(', ') : w));
  }
  return h('div', {}, h('h5', {}, 'Modelantwoord'), dl, model.tekst ? h('p', {}, model.tekst) : null);
}

async function start() {
  const nummer = document.body.dataset.leerblok;
  const [blok, config, overzicht] = await Promise.all([
    laad(`../data/leerblok-${nummer}.json`), laad('../data/config.json'), laad('../data/leerblokken.json'),
  ]);
  const { opslag, geblokkeerd } = kiesOpslag();
  const store = maakStore(opslag);
  const sessie = maakSessie({ store, blok, elearning: config.versie });
  const main = document.querySelector('#inhoud');
  const h1 = main.querySelector('h1');
  wis(main);

  const taken = new Map(); // id → { leesInhoud, plan, bewaarNu }
  const foutGebied = h('p', { class: 'fout', role: 'alert', hidden: true });
  const afsluitStatus = h('div', { id: 'afsluit-status' });

  // ---------------------------------------------------------------- bewaren

  const wachtend = new Map();
  function bewaarNu(id) {
    if (!wachtend.has(id)) return;
    clearTimeout(wachtend.get(id));
    wachtend.delete(id);
    try {
      sessie.bewaar(id, taken.get(id).leesInhoud());
      foutGebied.hidden = true;
    } catch (e) {
      foutGebied.textContent = `Bewaren is niet gelukt (${e.message}). Exporteer je werk zodra dat kan.`;
      foutGebied.hidden = false;
    }
    tekenAfsluiten();
  }
  const bewaarAlles = () => [...wachtend.keys()].forEach(bewaarNu);
  window.addEventListener('pagehide', bewaarAlles);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bewaarAlles(); });
  const plan = (id) => {
    clearTimeout(wachtend.get(id));
    wachtend.set(id, setTimeout(() => bewaarNu(id), BEWAAR_NA_MS));
  };

  // ---------------------------------------------------------------- een taak

  function taakArtikel(taak) {
    const id = taak.id;
    const model = bouwTaakModel(taak, blok);
    const [s1, s2, s3, s4, s5] = model.stappen;
    const stap = (s, ...kinderen) => h('section', { class: 'stap', 'data-stap': s.nr, id: `stap-${id}-${s.nr}` },
      h('h3', {}, `${s.nr} · ${s.naam}`), kinderen);

    // stap 1: waarom, richttijd, klaar als (TK-2)
    const stap1 = stap(s1,
      h('p', { class: 'waarom' }, h('strong', {}, 'Waarom'), ' ', s1.waarom.tekst),
      h('p', { class: 'klaar' }, h('strong', {}, 'Klaar als'), ' ', s1.klaarAls.tekst));

    // stap 2: stof en de oefenversie (TK-3, TK-5, TK-6, TK-7)
    const oefVelden = bouwVelden(s2.oefening.velden, `oef-${id}`, sessie.oefening(id).invoer, () => {
      toonModel(sessie.zetOefening(id, oefVelden.lees()));
    });
    const modelGebied = h('div', { class: 'model', 'aria-live': 'polite' });
    const toonModel = (m) => {
      wis(modelGebied);
      if (m.modelZichtbaar) modelGebied.append(modelantwoordEl(m.modelantwoord, m.velden));
    };
    const veldGebied = h('div', { class: 'oef-velden' },
      oefVelden.element,
      h('div', { class: 'knoppen' },
        h('button', { type: 'button', class: 'knop', 'data-actie': 'opnieuw', onclick: () => {
          oefVelden.zet({});
          toonModel(sessie.herhaalOefening(id));
        } }, 'Opnieuw oefenen'),
        h('button', { type: 'button', class: 'knop', 'data-actie': 'overslaan', onclick: () => tekenOverslaan(sessie.zetOverslaan(id, true)) }, 'Ik ken dit al')),
      modelGebied);
    const overslaanGebied = h('div', { class: 'overgeslagen', hidden: true },
      h('p', {}, 'Je hebt de oefening overgeslagen. Dat heeft geen gevolgen voor je bewijs.'),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'toch-oefenen', onclick: () => tekenOverslaan(sessie.zetOverslaan(id, false)) }, 'Toch oefenen'));
    function tekenOverslaan(m) {
      veldGebied.hidden = m.overgeslagen;
      overslaanGebied.hidden = !m.overgeslagen;
      if (!m.overgeslagen) toonModel(m);
    }
    const oefening = h('div', { class: 'oefening', id: `oefening-${id}` },
      h('h4', {}, taak.bewijsonderdeel && blok.oefencasus ? `Oefenen op de oefencasus (${blok.oefencasus})` : 'Oefenen'),
      s2.oefening.opdracht ? h('p', {}, s2.oefening.opdracht.tekst) : null,
      veldGebied, overslaanGebied);
    const stof = h('div', { class: 'stof' },
      s2.stof.alineas.map((a) => h('p', {}, a)),
      s2.stof.format ? h('p', { class: 'format' }, s2.stof.format) : null);
    // Het format hoort bij de tweede alinea: zet het na de eerste alinea.
    if (s2.stof.format) stof.insertBefore(stof.lastChild, stof.children[1] ?? null);
    const stap2 = stap(s2, stof, oefening);
    const m0 = sessie.oefening(id);
    toonModel(m0);
    tekenOverslaan(m0);

    // stap 3: toepassen op het eigen vraagstuk (bewijs), met live controles (BW-1, BW-2, BW-6, BW-7)
    const uitkomst = h('div', { class: 'uitkomst', id: `uitkomst-${id}` });
    const voorbeeld = s3.livevoorbeeld ? h('p', { class: 'voorbeeld', id: `voorbeeld-${id}`, 'aria-label': 'Jouw vraag, live samengesteld' }) : null;
    const stapVeld = h('input', { type: 'text', id: `volgende-${id}`, autocomplete: 'off' });
    const klaarKnop = h('button', { type: 'button', class: 'knop knop-accent', id: `klaar-${id}`, hidden: true, onclick: () => {
      bewaarNu(id);
      if (sessie.markeerKlaar(id)) tekenKlaar();
    } }, 'Klaar');
    const klaarBericht = h('p', { class: 'klaar-bericht', role: 'status' });
    const verdiepingKop = h('section', { class: 'stap', 'data-stap': s5.nr, id: `stap-${id}-5`, hidden: true });

    const lees = () => {
      const inhoud = toe.lees();
      const volgende = stapVeld.value.trim();
      if (volgende !== '') inhoud.volgendeStap = stapVeld.value;
      return inhoud;
    };
    function toonResultaat() {
      const inhoud = lees();
      const b = sessie.beoordeel(id, inhoud);
      wis(uitkomst);
      if (b.heeftBewijs) uitkomst.append(h('p', { class: 'status-regel', role: 'status' }, 'Status: ', statusChip(b.status, b.statusTekst)));
      if (!isIngevuld(inhoud)) {
        uitkomst.append(h('p', { class: 'klein' }, 'Vul de velden in; hier zie je direct wat er nog ontbreekt.'));
      } else {
        if (b.ontbreekt.length > 0) uitkomst.append(h('ul', { class: 'ontbreekt' }, b.ontbreekt.map((o) => h('li', {}, o.melding))));
        if (b.modelLink) uitkomst.append(h('p', {}, h('a', { href: b.modelLink }, 'Bekijk de oefening op de oefencasus'), ' (het modelantwoord verschijnt nadat je zelf een poging hebt gedaan).'));
        if (b.compleetMelding) uitkomst.append(h('p', { class: 'compleet' }, b.compleetMelding));
      }
      if (voorbeeld) voorbeeld.textContent = VOORBEELDEN[s3.livevoorbeeld](inhoud);
      klaarKnop.hidden = !b.klaarMogelijk || sessie.isKlaar(id);
      stap4Wacht.hidden = b.klaarMogelijk;
      stap4Inhoud.hidden = !b.klaarMogelijk;
      const zin = stapVeld.value.trim();
      stapHint.textContent = zin && !volgendeStapOk(zin) ? 'Schrijf minstens drie woorden.' : '';
    }
    const bijToepassing = () => { toonResultaat(); plan(id); };
    const toe = bouwVelden(s3.velden, `toe-${id}`, sessie.leesToepassing(id), bijToepassing);
    stapVeld.addEventListener('input', bijToepassing);
    stapVeld.value = sessie.leesToepassing(id).volgendeStap ?? '';

    const stap3 = stap(s3,
      s3.opdracht ? h('p', {}, s3.opdracht.tekst) : null,
      voorbeeld ? h('div', {}, h('p', { class: 'klein' }, 'Zo klinkt je vraag nu:'), voorbeeld) : null,
      toe.element, uitkomst);

    // stap 4: klaar en volgende stap (TK-8, TK-9, TK-10)
    const stapHint = h('p', { class: 'klein', role: 'status' });
    const stap4Wacht = h('p', { class: 'klein' }, 'Zodra je „klaar als” is gehaald, verschijnt hier de knop Klaar. Je kunt ook gewoon doorgaan naar de volgende taak.');
    const stap4Inhoud = h('div', {},
      h('p', {}, 'Is je „klaar als” gehaald? Dan kun je op Klaar drukken, ook als je nog tijd over hebt.'),
      klaarKnop, klaarBericht,
      h('div', { class: 'veld' }, h('label', { for: `volgende-${id}` }, 'Mijn volgende stap is …'), stapVeld, stapHint));
    stap4Inhoud.hidden = true;
    const stap4 = stap(s4, stap4Wacht, stap4Inhoud);

    // stap 5: optionele verdieping, pas zichtbaar na „klaar” (TK-13, TK-14, ST-7)
    verdiepingKop.append(h('h3', {}, `${s5.nr} · ${s5.naam}`));
    if (s5.verdieping) {
      const v0 = sessie.leesVerdieping();
      const tekstVeld = h('textarea', { id: `verdieping-${id}`, rows: 3 });
      tekstVeld.value = v0.tekst;
      const gedaan = h('input', { type: 'checkbox', id: `verdieping-gedaan-${id}` });
      gedaan.checked = v0.gedaan;
      let vt;
      tekstVeld.addEventListener('input', () => { clearTimeout(vt); vt = setTimeout(() => sessie.zetVerdieping({ tekst: tekstVeld.value }), BEWAAR_NA_MS); });
      gedaan.addEventListener('change', () => sessie.zetVerdieping({ tekst: tekstVeld.value, gedaan: gedaan.checked }));
      verdiepingKop.append(
        h('p', {}, s5.verdieping.tekst),
        h('p', { class: 'klein' }, 'Dit is optioneel. Het telt niet mee voor je status en niet voor de richttijd.'),
        h('div', { class: 'veld' }, h('label', { for: `verdieping-${id}` }, 'Jouw antwoord (optioneel)'), tekstVeld),
        h('div', { class: 'optie' }, gedaan, h('label', { for: `verdieping-gedaan-${id}` }, 'Verdieping gedaan')));
    } else {
      verdiepingKop.append(h('p', { class: 'klein' }, 'Bij deze taak is er geen verdieping.'));
    }
    function tekenKlaar() {
      const klaar = sessie.isKlaar(id);
      klaarKnop.hidden = klaar;
      klaarBericht.textContent = klaar ? `Taak ${id} is klaar. Schrijf je volgende stap op en ga door.` : '';
      verdiepingKop.hidden = !klaar;
    }

    taken.set(id, { leesInhoud: lees });
    toonResultaat();
    tekenKlaar();
    const meta = h('p', { class: 'meta' },
      h('span', { class: 'vorm' }, taak.vorm), ' · ', h('span', { class: 'tijd' }, `Richttijd: ${taak.richttijd.tekst}`));
    return h('article', { class: 'taak kaart', id: `taak-${id}`, 'aria-labelledby': `kop-${id}` },
      h('h2', { id: `kop-${id}` }, h('span', { class: 'nr' }, id), ` ${taak.titel}`),
      meta, stap1, stap2, stap3, stap4, verdiepingKop);
  }

  // ---------------------------------------------------------------- afsluiten (TK-15, TK-16, TK-17)

  const volgendeBlok = overzicht.leerblokken.find((b) => b.nummer === blok.leerblok + 1);
  const volgende = volgendeBlok ? { href: volgendeBlok.pagina, titel: `Leerblok ${volgendeBlok.nummer} · ${volgendeBlok.titel}` } : { href: 'dossier.html', titel: 'Dossier' };
  const volgendeStapVeld = h('textarea', { id: 'afsluit-volgende-stap', rows: 2 });
  volgendeStapVeld.value = sessie.leesVolgendeStap();
  let vtimer;
  volgendeStapVeld.addEventListener('input', () => { clearTimeout(vtimer); vtimer = setTimeout(() => sessie.bewaarVolgendeStap(volgendeStapVeld.value), BEWAAR_NA_MS); });
  function tekenAfsluiten() {
    const m = sessie.afsluitModel(volgende);
    wis(afsluitStatus);
    afsluitStatus.append(
      h('ul', { class: 'afsluit-onderdelen' }, m.onderdelen.map((o) => h('li', {},
        `${o.id} · ${o.titel}: `, statusChip(o.status, o.statusTekst), o.voorlopig ? ' (voorlopig)' : ''))),
      h('p', { class: 'afgerond-tekst', role: 'status' }, m.afgerondTekst));
  }
  const afsluiten = h('section', { class: 'kaart', id: 'afsluiten', 'aria-labelledby': 'afsluiten-kop' },
    h('h2', { id: 'afsluiten-kop' }, `Afsluiten van leerblok ${blok.leerblok}`),
    afsluitStatus,
    h('div', { class: 'veld' }, h('label', { for: 'afsluit-volgende-stap' }, m0Vraag()), volgendeStapVeld),
    h('p', { class: 'bewaarmelding' }, sessie.afsluitModel(volgende).bewaarmelding, ' ', h('a', { href: 'dossier.html' }, 'Naar het dossier')),
    h('p', {}, h('a', { class: 'knop knop-link', id: 'door', href: volgende.href }, `Door naar: ${volgende.titel}`)));
  function m0Vraag() { return sessie.afsluitModel(null).volgendeStapVraag; }

  // ---------------------------------------------------------------- pagina

  const profiel = leesProfiel(store);
  const vraagstuk = h('aside', { class: 'kaart', id: 'mijn-vraagstuk', 'aria-labelledby': 'mijn-vraagstuk-kop' },
    h('h2', { id: 'mijn-vraagstuk-kop' }, 'Jouw vraagstuk'),
    profiel.vraagstuk
      ? h('p', {}, profiel.vraagstuk, profiel.waaromZin ? h('span', { class: 'klein' }, ` · Waarom: ${profiel.waaromZin}`) : null)
      : h('p', {}, 'Je hebt nog geen vraagstuk ingevuld. ', h('a', { href: 'index.html' }, 'Vul het op de startpagina in'), ' of werk gewoon door.'),
    profiel.voorlopig ? h('p', { class: 'klein' }, 'Je werkt met een voorlopig vraagstuk: je bewijs krijgt het label voorlopig.') : null);

  const inhoud = h('nav', { 'aria-label': 'Taken in dit leerblok', class: 'taken-nav' },
    h('ol', {}, blok.taken.map((t) => h('li', {}, h('a', { href: `#taak-${t.id}` }, `${t.id} ${t.titel}`))), h('li', {}, h('a', { href: '#afsluiten' }, 'Afsluiten'))));

  main.append(...[
    h1,
    h('p', { class: 'meta' }, `Richttijd: ${blok.richttijd} min. Eindigt met: ${blok.eindigtMet}.`),
    geblokkeerd ? h('p', { class: 'fout', role: 'alert' }, 'Je browser blokkeert opslag: wat je invult blijft alleen staan zolang deze pagina open is.') : null,
    foutGebied, vraagstuk, inhoud,
    ...blok.taken.map(taakArtikel), afsluiten,
  ].filter(Boolean));
  tekenAfsluiten();
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
