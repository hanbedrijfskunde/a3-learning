// Leerblokpagina: bouwt de pagina uit data/leerblok-N.json met het vaste ritme van vijf stappen per taak (TK-18).
// Alleen DOM. Controles, opslag, oefenregels en de afgerond-regel zitten in sessie.js, weergave.js en afgerond.js.
import { h, wis, statusChip, bouwVelden } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import { maakSessie, volgendeStapOk } from './sessie.js';
import { bouwTaakModel, isIngevuld } from './weergave.js';
import { leesProfiel } from './profiel.js';
import { VOORBEELDEN, laadControles } from './checks/register.js';
import { wisselContext } from './context.js';
import { geblokkeerdMelding, toonBewaarHerinnering } from './dossier-dom.js'; // fase 3: DS-2, DS-12
import { metVerwijzingen } from './verwijzing.js';
import { laadBronnen, maakIndex } from './bronnen.js';
import { vorigeKeerSectie } from './terugblik-pagina.js'; // fase 7: TP-11
import { normaliseerBlok } from './blok.js';

const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();
const laadBlok = async (pad) => normaliseerBlok(await laad(pad)); // reeksen velden uitschrijven
/** citatie → bron voor de in-tekstverwijzingen (BR-4); lukt het laden niet, dan blijven het gewone tekst. */
const laadBronIndex = () => laadBronnen((u) => fetch(new URL(`../${u}`, import.meta.url)))
  .then((bestanden) => maakIndex(bestanden.flatMap((b) => b.bronnen ?? []))).catch(() => new Map());
const LB4_COMPONENTEN = ['verbanden', 'starr']; // taken met een eigen scherm in lb4-ui.js
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
  const [blok, config, overzicht, bronIndex] = await Promise.all([
    laadBlok(`../data/leerblok-${nummer}.json`), laad('../data/config.json'), laad('../data/leerblokken.json'), laadBronIndex(),
  ]);
  const met = (tekst) => metVerwijzingen(tekst, bronIndex);
  // PF-4 (ADR B69): elke pagina laadt alleen wat haar leerblok nodig heeft. De controlefabrieken van dit leerblok en van het
  // leerblok van de Wissel, de Wissel zelf (alleen leerblok 1 en 4), de weergavegroepen (leerblok 2 en 3) en de verbanden-kaart
  // en het STARR-sjabloon (leerblok 4) komen dynamisch binnen, elk met de voorwaarde die tools/gewicht-check.mjs leest.
  const heeftWissel = Boolean(blok.wissel) || blok.taken.some((t) => t.toepassing.component === 'feedbacklog');
  const heeftWeergave = blok.taken.some((t) => t.toepassing.weergave);
  const heeftLb4Ui = blok.taken.some((t) => LB4_COMPONENTEN.includes(t.toepassing.component));
  await laadControles([blok.leerblok, blok.wissel?.leerblok]);
  // gewicht-alleen: wissel
  const [{ maakWissel, EV09_TAAK }, { bouwWisselPaneel }] = heeftWissel ? await Promise.all([import('./wissel.js'), import('./wissel-paneel.js')]) : [{}, {}];
  // gewicht-alleen: weergave
  const { bouwWeergave } = heeftWeergave ? await import('./lb2-ui.js') : {};
  // gewicht-alleen: lb4ui
  const lb4Ui = heeftLb4Ui ? await import('./lb4-ui.js') : {};
  const { opslag, geblokkeerd } = kiesOpslag();
  const store = maakStore(opslag);
  const context = () => wisselContext(store); // ontvangen wisselblokken voor de kopiecontrole (WS-7)
  const sessie = maakSessie({ store, blok, elearning: config.versie, context });
  // De Wissel hoort bij leerblok 4 (taak 6.2, EV-09); in leerblok 1 staat hij na de eerste versie van EV-02 (ST-7).
  const wisselSessie = blok.wissel
    ? maakSessie({ store, blok: await laadBlok(`../data/leerblok-${blok.wissel.leerblok}.json`), elearning: config.versie, context })
    : null;
  function wisselPaneel(wsessie, opties) {
    const wissel = maakWissel({ store, sessie: wsessie });
    const leesStatus = () => wsessie.beoordeel(EV09_TAAK, wissel.leesInhoud());
    return { wissel, ...bouwWisselPaneel({ wissel, alias: leesProfiel(store).alias, leesStatus, ...opties }) };
  }
  const main = document.querySelector('#inhoud');
  const h1 = main.querySelector('h1');
  wis(main);

  const taken = new Map(); // id → { leesInhoud, toon }
  const foutGebied = h('p', { class: 'fout', role: 'alert', hidden: true });
  const afsluitStatus = h('div', { id: 'afsluit-status' });
  const herinneringGebied = h('div', { id: 'bewaarherinnering' }); // DS-2: na elke 10 wijzigingen

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
    tekenWissel();
    toonBewaarHerinnering(herinneringGebied, store, config.versie);
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
      h('p', { class: 'waarom' }, h('strong', {}, 'Waarom'), ' ', met(s1.waarom.tekst)),
      h('p', { class: 'klaar' }, h('strong', {}, 'Klaar als'), ' ', met(s1.klaarAls.tekst)));

    // stap 2: stof en de oefenversie (TK-3, TK-5, TK-6, TK-7)
    const bijOefening = () => toonModel(sessie.zetOefening(id, oefVelden.lees()));
    // Een oefening met component `verbanden` (taak 9.4) heeft een eigen kaart en toont het modelvoorbeeld pas na een getrokken lijn (VB-2).
    const oefVelden = taak.oefening.component === 'verbanden'
      ? lb4Ui.bouwVerbandenOefening({ taak, velden: s2.oefening.velden, waarden: sessie.oefening(id).invoer, bijWijziging: bijOefening })
      : bouwVelden(s2.oefening.velden, `oef-${id}`, sessie.oefening(id).invoer, bijOefening);
    const modelGebied = h('div', { class: 'model', 'aria-live': 'polite' });
    const toonModel = (m) => {
      wis(modelGebied);
      if (m.modelZichtbaar) modelGebied.append(modelantwoordEl(m.modelantwoord, m.velden), oefVelden.modelExtra?.(m.modelantwoord));
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
      s2.oefening.opdracht ? h('p', {}, met(s2.oefening.opdracht.tekst)) : null,
      veldGebied, overslaanGebied);
    const stof = h('div', { class: 'stof' },
      s2.stof.alineas.map((a) => h('p', {}, met(a))),
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
      opnieuwGebied.hidden = !sessie.kanOpnieuw(id);
      stap4Wacht.hidden = b.klaarMogelijk;
      stap4Inhoud.hidden = !b.klaarMogelijk;
      const zin = stapVeld.value.trim();
      stapHint.textContent = zin && !volgendeStapOk(zin) ? 'Schrijf minstens drie woorden.' : '';
    }
    const bijToepassing = () => { toonResultaat(); plan(id); };
    // Een toepassing met component `feedbacklog` (EV-09) is de Wissel zelf; alles wat de Wissel wijzigt, bewaart hij direct.
    const feedbacklog = () => {
      const w = wisselPaneel(sessie, { metTeamactie: true, bijWijziging: bijToepassing });
      return { element: w.element, lees: () => w.wissel.leesInhoud(), zet: () => w.ververs() };
    };
    // Een taak met `toepassing.weergave` (leerblok 2: tabel, route, promptgenerator, bronlog) legt de velden anders neer.
    const gewoneVelden = () => (taak.toepassing.weergave
      ? bouwWeergave(s3.velden, `toe-${id}`, sessie.leesToepassing(id), bijToepassing, taak.toepassing.weergave,
        { taakId: id, store, leesToepassing: (t) => sessie.leesToepassing(t) })
      : bouwVelden(s3.velden, `toe-${id}`, sessie.leesToepassing(id), bijToepassing));
    // Leerblok 4: de verbanden-kaart (9.4) en het STARR-sjabloon (6.3) hebben een eigen scherm in lb4-ui.js.
    const lb4Scherm = (bouw) => bouw({ velden: s3.velden, waarden: sessie.leesToepassing(id), bijWijziging: bijToepassing, store, voorvoegsel: `toe-${id}` });
    const toe = { feedbacklog, verbanden: () => lb4Scherm(lb4Ui.bouwVerbandenToepassing), starr: () => lb4Scherm(lb4Ui.bouwStarr) }[taak.toepassing.component]?.() ?? gewoneVelden();
    stapVeld.addEventListener('input', bijToepassing);
    stapVeld.value = sessie.leesToepassing(id).volgendeStap ?? '';

    // Voorlopig vraagstuk (ST-3, ST-4): een voorlopig bewijsonderdeel kan met één klik opnieuw, de oude versie blijft in het dossier (ST-5).
    const opnieuwMelding = h('p', { class: 'klein', role: 'status' });
    const opnieuwGebied = h('div', { class: 'voorlopig-opnieuw', id: `opnieuw-${id}`, hidden: true },
      h('p', {}, 'Dit bewijs heeft het label voorlopig, omdat je vraagstuk nog niet scherp was. Is je vraagstuk nu afgebakend? Werk het dan eerst bij op de startpagina en doe dit onderdeel opnieuw. Het veld wordt leeg; je voorlopige versie blijft bewaard en staat naast de nieuwe in je dossier.'),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'opnieuw-doen', onclick: () => {
        const r = sessie.opnieuwDoen(id);
        if (!r.ok) { opnieuwMelding.textContent = r.fout; return; }
        toe.zet({});
        stapVeld.value = '';
        opnieuwMelding.textContent = leesProfiel(store).voorlopig
          ? 'Het veld is leeg. Let op: je vraagstuk staat nog op voorlopig, dus ook de nieuwe versie krijgt dat label.'
          : 'Het veld is leeg. De voorlopige versie blijft bewaard.';
        toonResultaat(); tekenKlaar(); tekenAfsluiten();
      } }, 'Opnieuw doen'),
      opnieuwMelding);
    const stap3 = stap(s3,
      s3.opdracht ? h('p', {}, met(s3.opdracht.tekst)) : null,
      voorbeeld ? h('div', {}, h('p', { class: 'klein' }, 'Zo klinkt je vraag nu:'), voorbeeld) : null,
      toe.element, uitkomst, opnieuwGebied);

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

    taken.set(id, { leesInhoud: lees, toon: toonResultaat });
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
  // TK-11: „wat ik hiermee aan mijn A3 heb”, aan het eind van leerblok 4; de dossierpagina toont de zin naast de waarom-zin.
  const a3Vraag = blok.afsluiting?.a3Zin;
  const a3Veld = h('textarea', { id: 'afsluit-a3-zin', rows: 2 });
  a3Veld.value = sessie.leesA3Zin();
  let atimer;
  a3Veld.addEventListener('input', () => { clearTimeout(atimer); atimer = setTimeout(() => sessie.bewaarA3Zin(a3Veld.value), BEWAAR_NA_MS); });
  if (a3Vraag) window.addEventListener('pagehide', () => sessie.bewaarA3Zin(a3Veld.value));
  const afsluiten = h('section', { class: 'kaart', id: 'afsluiten', 'aria-labelledby': 'afsluiten-kop' },
    h('h2', { id: 'afsluiten-kop' }, `Afsluiten van leerblok ${blok.leerblok}`),
    afsluitStatus,
    a3Vraag ? h('div', { class: 'veld' }, h('label', { for: 'afsluit-a3-zin' }, a3Vraag.vraag), h('p', { class: 'klein' }, a3Vraag.uitleg), a3Veld) : null,
    h('div', { class: 'veld' }, h('label', { for: 'afsluit-volgende-stap' }, m0Vraag()), volgendeStapVeld),
    h('p', { class: 'bewaarmelding' }, sessie.afsluitModel(volgende).bewaarmelding, ' ', h('a', { href: 'dossier.html' }, 'Naar het dossier')),
    h('p', {}, h('a', { class: 'knop knop-link', id: 'door', href: volgende.href }, `Door naar: ${volgende.titel}`)));
  function m0Vraag() { return sessie.afsluitModel(null).volgendeStapVraag; }

  // ---------------------------------------------------------------- de Wissel in leerblok 1 (ST-7)

  const wisselSectie = wisselSessie && h('section', { class: 'kaart wis-sectie', id: 'wissel', 'aria-labelledby': 'wissel-kop', hidden: true },
    h('h2', { id: 'wissel-kop' }, 'De Wissel'),
    h('details', { class: 'wis-details' },
      h('summary', {}, 'Feedback vragen en geven aan een wisselpartner'),
      wisselPaneel(wisselSessie, {
        bijWijziging: () => {
          // een ontvangen wisselblok kan de kopiecontrole van EV-01 en EV-02 veranderen (WS-7)
          for (const id of ['2.1', '2.2']) if (taken.has(id)) { sessie.bewaar(id, taken.get(id).leesInhoud()); taken.get(id).toon(); }
          tekenAfsluiten();
        },
      }).element));
  function tekenWissel() {
    if (wisselSectie) wisselSectie.hidden = !store.get(blok.wissel.zichtbaarNa);
  }

  // ---------------------------------------------------------------- pagina

  const profiel = leesProfiel(store);
  const aanbevolen = overzicht.leerblokken.find((b) => b.nummer === blok.leerblok)?.aanbevolen; // TP-10: alleen tekst
  const vorigeKeer = blok.leerblok >= 2 ? await vorigeKeerSectie({ store, opslag, overzicht, leerblok: blok.leerblok }) : null; // TP-11
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
    aanbevolen ? h('p', { class: 'meta', id: 'aanbevolen' }, `Aanbevolen: ${aanbevolen.week}, ${aanbevolen.dag}.`) : null,
    geblokkeerd ? geblokkeerdMelding(store, config.versie) : null,
    foutGebied, herinneringGebied, vorigeKeer, vraagstuk, inhoud,
    ...blok.taken.flatMap((t) => [taakArtikel(t), t.bewijsonderdeel === blok.wissel?.zichtbaarNa ? wisselSectie : null]), afsluiten,
  ].filter(Boolean));
  tekenAfsluiten();
  tekenWissel();
  toonBewaarHerinnering(herinneringGebied, store, config.versie);
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
