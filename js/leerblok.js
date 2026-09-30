// Leerblokpagina: bouwt de pagina uit data/leerblok-N.json met het vaste ritme van vier stappen per taak (TK-18, ADR B76).
// Alleen DOM. Controles, opslag, oefenregels en de afgerond-regel zitten in sessie.js, weergave.js en afgerond.js.
import { h, wis, statusChip, bouwVelden, tekenA3Vak, a3VelFiguur, sixCapitalsFiguur, vpcFiguur, metInvulplekken } from './dom.js';
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
import { klaarAlsLijst, stapStand, segmentLabel, a3Stand } from './voortgang.js'; // fase 17: SX-4, SX-5, SX-12
import { isAfgerond, leesRecords } from './afgerond.js';
import { leesAdres, maakAdres, voetActies } from './taakweergave.js'; // fase 19: SX-6

const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();
const laadBlok = async (pad) => normaliseerBlok(await laad(pad)); // reeksen velden uitschrijven
/** citatie → bron voor de in-tekstverwijzingen (BR-4); lukt het laden niet, dan blijven het gewone tekst. */
const laadBronIndex = () => laadBronnen((u) => fetch(new URL(`../${u}`, import.meta.url)))
  .then((bestanden) => maakIndex(bestanden.flatMap((b) => b.bronnen ?? []))).catch(() => new Map());
const LB4_COMPONENTEN = ['verbanden', 'starr']; // taken met een eigen scherm in lb4-ui.js
// De figuren in de stap stof (stof.figuur) en na welke alinea ze staan (0 = de eerste).
const FIGUREN = { 'a3-vel': { bouw: a3VelFiguur, na: 0 }, 'six-capitals': { bouw: sixCapitalsFiguur, na: 1 }, vpc: { bouw: vpcFiguur, na: 0 } };
const BEWAAR_NA_MS = 500; // bewaren na de laatste toetsaanslag; de controles zelf lopen direct
const CHECKLIST_NA_MS = 600; // de „klaar als"-checklist vinkt mee na 600 ms zonder typen (SX-5)
const BEVESTIG_MS = 1500; // kort bevestigingsmoment na „klaar" (DESIGN §7.1), geen modaal venster

/** Het modelantwoord als lijst van veld en antwoord. */
function modelantwoordEl(model, velden) {
  const dl = h('dl', { class: 'model-lijst' });
  for (const v of velden) {
    const w = model.velden?.[v.id];
    if (w === undefined) continue;
    dl.append(h('dt', {}, v.label), h('dd', {}, Array.isArray(w) ? w.join(', ') : w));
  }
  return h('div', {}, dl, model.tekst ? h('p', {}, model.tekst) : null);
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
  const heeftKijktips = Boolean(blok.kijktips); // leerblok 1: kijktips staan in het overzicht, dus media.js laadt meteen
  await laadControles([blok.leerblok, blok.wissel?.leerblok]);
  // gewicht-alleen: wissel
  const [{ maakWissel, EV09_TAAK }, { bouwWisselPaneel }] = heeftWissel ? await Promise.all([import('./wissel.js'), import('./wissel-paneel.js')]) : [{}, {}];
  // gewicht-alleen: weergave
  const { bouwWeergave } = heeftWeergave ? await import('./lb2-ui.js') : {};
  // gewicht-alleen: lb4ui
  const lb4Ui = heeftLb4Ui ? await import('./lb4-ui.js') : {};
  // gewicht-alleen: kijktips
  const mediaDirect = heeftKijktips ? await import('./media.js') : null;
  // De routekeuze (tekst, video, spel) laadt pas als de student de stap stof van de mediataak opent (fase 19, ADR B82).
  const laadMedia = async () => {
    // gewicht-alleen: naklik
    return mediaDirect ?? import('./media.js');
  };
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
  let klaarVoorVoet = false; // de vaste voet tekent pas als alle taken er zijn (fase 19)
  let adres = { soort: 'overzicht' }; // waar de student is: overzicht, een taak en stap, of afsluiten
  const bevestiging = h('p', { class: 'bevestig', role: 'status', hidden: true });
  let bevestigTimer;
  function bevestig(tekst) {
    bevestiging.textContent = tekst;
    bevestiging.hidden = false;
    clearTimeout(bevestigTimer);
    bevestigTimer = setTimeout(() => { bevestiging.hidden = true; }, BEVESTIG_MS);
  }
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

  function taakArtikel(taak, taakNr) {
    const id = taak.id;
    const model = bouwTaakModel(taak, blok);
    const [s1, s2, s3, s4] = model.stappen;
    const stapKop = (s) => h('h3', { id: `stapkop-${id}-${s.nr}`, tabindex: '-1' }, `${s.nr} · ${s.naam}`);
    const stap = (s, ...kinderen) => h('section', { class: 'stap', 'data-stap': s.nr, id: `stap-${id}-${s.nr}`, 'aria-labelledby': `stapkop-${id}-${s.nr}` },
      stapKop(s), kinderen);

    // stap 1: waarom, richttijd, klaar als (TK-2)
    const stap1 = stap(s1,
      h('p', { class: 'waarom' }, h('strong', {}, 'Waarom'), ' ', met(s1.waarom.tekst)),
      h('p', { class: 'klaar' }, h('strong', {}, 'Klaar als'), ' ', met(s1.klaarAls.tekst)));

    // stap 2: de stof
    const alineas = s2.stof.alineas.map((a) => h('p', {}, met(a)));
    const stof = h('div', { class: 'stof' },
      alineas,
      s2.stof.format ? h('p', { class: 'format' }, metInvulplekken(s2.stof.format)) : null);
    // Het format hoort bij de tweede alinea: zet het na de eerste alinea.
    if (s2.stof.format) stof.insertBefore(stof.lastChild, stof.children[1] ?? null);
    // Een figuur staat direct na de alinea die hem beschrijft: het A3-vel (taak 1.1) na alinea 1, de six capitals (taak 2.1) na alinea 2, het VPC (taak 6.1) na alinea 1.
    const figuur = FIGUREN[s2.stof.figuur];
    if (figuur) alineas[figuur.na].after(figuur.bouw({ met }));
    // De routekeuze tekst, video of spel staat in de stap stof van de taak waar de media bij horen (MD-2, ADR B79).
    const stap2 = stap(s2, stof, mediaPlek && blok.media.taak === id ? mediaPlek : null);

    // stap 3: de oefenversie (TK-3, TK-5, TK-6, TK-7)
    const bijOefening = () => { toonModel(sessie.zetOefening(id, oefVelden.lees())); tekenVoortgang(); };
    // Een oefening met component `verbanden` (taak 9.4) heeft een eigen kaart en toont het modelvoorbeeld pas na een getrokken lijn (VB-2).
    const oefVelden = taak.oefening.component === 'verbanden'
      ? lb4Ui.bouwVerbandenOefening({ taak, velden: s3.oefening.velden, waarden: sessie.oefening(id).invoer, bijWijziging: bijOefening })
      : bouwVelden(s3.oefening.velden, `oef-${id}`, sessie.oefening(id).invoer, bijOefening);
    const modelGebied = h('div', { class: 'model', 'aria-live': 'polite' });
    // Het modelantwoord als beloning na de eigen poging (TK-6, DESIGN §5.3): een uitklappaneel „Zo zou het kunnen”.
    let modelOpen = false;
    let modelNu = null;
    const toonModel = (m) => {
      modelNu = m;
      wis(modelGebied);
      if (m.modelZichtbaar) {
        tekenModelMelding();
        // modelExtra bestaat alleen bij 9.4 en kan null geven; native append zou dat als tekst tonen
        const paneel = h('details', { class: 'model-paneel', id: `model-${id}` },
          h('summary', {}, 'Zo zou het kunnen'),
          ...[modelantwoordEl(m.modelantwoord, m.velden), oefVelden.modelExtra && oefVelden.modelExtra(m.modelantwoord)].filter(Boolean));
        paneel.open = modelOpen;
        paneel.addEventListener('toggle', () => { modelOpen = paneel.open; tekenVoet(); });
        modelGebied.append(paneel);
      } else {
        modelOpen = false;
      }
      document.dispatchEvent(new CustomEvent('a3-oefening', { detail: { taak: id, modelZichtbaar: m.modelZichtbaar } })); // de mediasectie toont het model in de tekstroute pas dan (TK-6)
    };
    const modelMelding = h('p', { class: 'klein', role: 'status' });
    function tekenModelMelding(tekst = '') { modelMelding.textContent = tekst; }
    function openModel() {
      if (!modelNu?.modelZichtbaar) { tekenModelMelding('Vul eerst zelf iets in; daarna zie je hoe het zou kunnen.'); return false; }
      modelOpen = true;
      const paneel = modelGebied.querySelector('details');
      if (paneel) { paneel.open = true; paneel.querySelector('summary').focus(); }
      return true;
    }
    const veldGebied = h('div', { class: 'oef-velden' },
      oefVelden.element,
      h('div', { class: 'knoppen' },
        h('button', { type: 'button', class: 'knop', 'data-actie': 'opnieuw', onclick: () => {
          oefVelden.zet({});
          toonModel(sessie.herhaalOefening(id));
          tekenVoortgang();
        } }, 'Opnieuw oefenen'),
        h('button', { type: 'button', class: 'knop', 'data-actie': 'overslaan', onclick: () => tekenOverslaan(sessie.zetOverslaan(id, true)) }, 'Ik ken dit al')),
      modelMelding, modelGebied);
    const overslaanGebied = h('div', { class: 'overgeslagen', hidden: true },
      h('p', {}, 'Je hebt de oefening overgeslagen. Dat heeft geen gevolgen voor je bewijs.'),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'toch-oefenen', onclick: () => tekenOverslaan(sessie.zetOverslaan(id, false)) }, 'Toch oefenen'));
    function tekenOverslaan(m) {
      veldGebied.hidden = m.overgeslagen;
      overslaanGebied.hidden = !m.overgeslagen;
      if (!m.overgeslagen) toonModel(m);
      tekenVoortgang();
    }
    const oefening = h('div', { class: 'oefening', id: `oefening-${id}` },
      h('h4', {}, taak.bewijsonderdeel && blok.oefencasus ? `Oefencasus · ${blok.oefencasus}` : 'Oefenen'),
      s3.oefening.opdracht ? h('p', {}, met(s3.oefening.opdracht.tekst)) : null,
      // De figuur uit de stof nog eens bij de oefening (oefening.figuur) en de toepassing (toepassing.figuur), zodat de student niet terug hoeft te klikken (taak 6.1: het VPC).
      FIGUREN[s3.oefening.figuur]?.bouw({ met }) ?? null,
      veldGebied, overslaanGebied);
    const stap3 = stap(s3, oefening);

    // stap 4: toepassen op het eigen vraagstuk (bewijs), met live controles (BW-1, BW-2, BW-6, BW-7), de „klaar als" als
    // checklist (SX-5), en tot slot klaar en de volgende stap (TK-8, TK-9, TK-10)
    const uitkomst = h('div', { class: 'uitkomst', id: `uitkomst-${id}` });
    const voorbeeld = s4.livevoorbeeld ? h('p', { class: 'voorbeeld', id: `voorbeeld-${id}`, 'aria-label': 'Jouw vraag, live samengesteld' }) : null;
    const stapVeld = h('input', { type: 'text', id: `volgende-${id}`, autocomplete: 'off', placeholder: 'Ik ga nu …' });
    const klaarKnop = h('button', { type: 'button', class: 'knop knop-accent', id: `klaar-${id}`, hidden: true, onclick: () => {
      bewaarNu(id);
      if (sessie.markeerKlaar(id)) {
        tekenKlaar();
        bevestig(`Opgeslagen in je dossier ✓ Taak ${id} is klaar.`);
        // „Ga verder” wijst na klaar naar de volgende taak die nog open is, niet naar deze
        const volgendeOpen = blok.taken.map((t) => t.id).find((t) => !sessie.isKlaar(t));
        const t2 = blok.taken.find((t) => t.id === volgendeOpen);
        try { store.setMeta(`positie:${blok.leerblok}`, t2 ? { leerblok: blok.leerblok, taak: t2.id, stap: 1, titel: t2.titel, bijgewerkt: new Date().toISOString() } : null); } catch (e) { /* zonder opslag geen „ga verder” */ }
      }
    } }, 'Klaar');
    const klaarBericht = h('p', { class: 'klaar-bericht', role: 'status' });
    const verdiepingKop = h('section', { class: 'verdieping', id: `verdieping-sectie-${id}`, hidden: true });
    const checklist = h('ul', { class: 'klaar-lijst', id: `klaarlijst-${id}` });
    const zelfSleutel = `klaarals:${id}`;
    let laatsteUitkomsten = [];
    function tekenChecklist() {
      const zelf = store.getMeta(zelfSleutel) ?? [];
      wis(checklist);
      klaarAlsLijst(taak, laatsteUitkomsten, zelf).forEach((c, i) => {
        if (c.zelf) {
          const vak = h('input', { type: 'checkbox', id: `klaarals-${id}-${i}`, onchange: () => {
            const nu = new Set(store.getMeta(zelfSleutel) ?? []);
            if (vak.checked) nu.add(i); else nu.delete(i);
            store.setMeta(zelfSleutel, [...nu].sort());
          } });
          vak.checked = c.afgevinkt;
          checklist.append(h('li', { class: 'klaar-item klaar-zelf' }, vak, h('label', { for: `klaarals-${id}-${i}` }, c.tekst)));
        } else {
          checklist.append(h('li', { class: `klaar-item ${c.afgevinkt ? 'klaar-ja' : 'klaar-nee'}` },
            h('span', { class: 'vink', 'aria-hidden': 'true' }, c.afgevinkt ? '✓' : ''),
            h('span', {}, c.tekst), h('span', { class: 'sr-only' }, c.afgevinkt ? ' (gehaald)' : ' (nog niet gehaald)')));
        }
      });
    }

    const lees = () => {
      const inhoud = toe.lees();
      const volgende = stapVeld.value.trim();
      if (volgende !== '') inhoud.volgendeStap = stapVeld.value;
      return inhoud;
    };
    let checklistTimer;
    function toonResultaat() {
      const inhoud = lees();
      const b = sessie.beoordeel(id, inhoud);
      wis(uitkomst);
      if (b.heeftBewijs) uitkomst.append(h('p', { class: 'status-regel', role: 'status' }, 'Status: ', statusChip(b.status, b.statusTekst)));
      if (!isIngevuld(inhoud)) {
        uitkomst.append(h('p', { class: 'klein' }, 'Vul de velden in. Hier zie je meteen wat nog ontbreekt.'));
      } else {
        if (b.ontbreekt.length > 0) uitkomst.append(h('ul', { class: 'ontbreekt' }, b.ontbreekt.map((o) => h('li', {}, o.melding))));
        if (b.modelLink) uitkomst.append(h('p', {}, h('a', { href: b.modelLink }, 'Bekijk de oefening op de oefencasus'), ' (het modelantwoord verschijnt nadat je zelf een poging hebt gedaan).'));
        if (b.compleetMelding) uitkomst.append(h('p', { class: 'compleet' }, b.compleetMelding));
      }
      // SX-5: de checklist vinkt mee na 600 ms zonder typen
      clearTimeout(checklistTimer);
      checklistTimer = setTimeout(() => { laatsteUitkomsten = b.uitkomsten; tekenChecklist(); }, CHECKLIST_NA_MS);
      if (voorbeeld) {
        // de invulplekken en wat de student er al in zette, gemarkeerd (DESIGN §5.3)
        const eigen = Object.values(inhoud).filter((w) => typeof w === 'string').map((w) => w.trim().replace(/[?.!\s]+$/u, ''));
        wis(voorbeeld).append(...metInvulplekken(VOORBEELDEN[s4.livevoorbeeld](inhoud), eigen));
      }
      klaarKnop.hidden = !b.klaarMogelijk || sessie.isKlaar(id);
      opnieuwGebied.hidden = !sessie.kanOpnieuw(id);
      klaarWacht.hidden = b.klaarMogelijk;
      const zin = stapVeld.value.trim();
      stapHint.textContent = zin && !volgendeStapOk(zin) ? 'Schrijf minstens drie woorden.' : '';
      tekenVoortgang();
    }
    const bijToepassing = () => { toonResultaat(); plan(id); };
    // Een toepassing met component `feedbacklog` (EV-09) is de Wissel zelf; alles wat de Wissel wijzigt, bewaart hij direct.
    const feedbacklog = () => {
      const w = wisselPaneel(sessie, { metTeamactie: true, bijWijziging: bijToepassing });
      return { element: w.element, lees: () => w.wissel.leesInhoud(), zet: () => w.ververs() };
    };
    // Een taak met `toepassing.weergave` (leerblok 2: tabel, route, promptgenerator, bronlog) legt de velden anders neer.
    const gewoneVelden = () => (taak.toepassing.weergave
      ? bouwWeergave(s4.velden, `toe-${id}`, sessie.leesToepassing(id), bijToepassing, taak.toepassing.weergave,
        { taakId: id, store, leesToepassing: (t) => sessie.leesToepassing(t) })
      : bouwVelden(s4.velden, `toe-${id}`, sessie.leesToepassing(id), bijToepassing));
    // Leerblok 4: de verbanden-kaart (9.4) en het STARR-sjabloon (6.3) hebben een eigen scherm in lb4-ui.js.
    const lb4Scherm = (bouw) => bouw({ velden: s4.velden, waarden: sessie.leesToepassing(id), bijWijziging: bijToepassing, store, voorvoegsel: `toe-${id}` });
    const toe = { feedbacklog, verbanden: () => lb4Scherm(lb4Ui.bouwVerbandenToepassing), starr: () => lb4Scherm(lb4Ui.bouwStarr) }[taak.toepassing.component]?.() ?? gewoneVelden();
    stapVeld.addEventListener('input', bijToepassing);
    stapVeld.value = sessie.leesToepassing(id).volgendeStap ?? '';

    // Voorlopig vraagstuk (ST-3, ST-4): een voorlopig bewijsonderdeel kan met één klik opnieuw, de oude versie blijft in het dossier (ST-5).
    const opnieuwMelding = h('p', { class: 'klein', role: 'status' });
    const opnieuwGebied = h('div', { class: 'voorlopig-opnieuw', id: `opnieuw-${id}`, hidden: true },
      h('p', {}, 'Dit resultaat heeft het label voorlopig, omdat je vraagstuk nog niet scherp was. Is je vraagstuk nu afgebakend? Werk het dan eerst bij op de startpagina en doe dit onderdeel opnieuw. Het veld wordt leeg; je voorlopige versie blijft bewaard en staat naast de nieuwe in je dossier.'),
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
    const stapHint = h('p', { class: 'klein', role: 'status' });
    const klaarWacht = h('p', { class: 'klein' }, 'Zodra je „klaar als” is gehaald, kun je deze taak afronden. Je kunt ook gewoon doorgaan naar de volgende taak.');
    const stap4 = stap(s4,
      s4.opdracht ? h('p', {}, met(s4.opdracht.tekst)) : null,
      FIGUREN[s4.figuur]?.bouw({ met }) ?? null, // net als bij de oefening (toepassing.figuur)
      voorbeeld ? h('div', {}, h('p', { class: 'klein' }, 'Zo klinkt je vraag nu:'), voorbeeld) : null,
      toe.element,
      h('div', { class: 'klaar-blok' }, h('h4', {}, 'Klaar als'), checklist),
      uitkomst, opnieuwGebied,
      h('div', { class: 'klaar-voet' },
        h('div', { class: 'veld' }, h('label', { for: `volgende-${id}` }, 'Mijn volgende stap is …'), stapVeld, stapHint),
        klaarWacht, klaarKnop, klaarBericht),
      taak.bewijsonderdeel === blok.wissel?.zichtbaarNa ? wisselSectie : null);

    // na „klaar": optionele verdieping, geen stap (TK-13, TK-14, ST-7, ADR B76)
    verdiepingKop.append(h('h3', {}, 'Verdieping (optioneel)'));
    if (model.verdieping) {
      const v0 = sessie.leesVerdieping();
      const tekstVeld = h('textarea', { id: `verdieping-${id}`, rows: 3 });
      tekstVeld.value = v0.tekst;
      const gedaan = h('input', { type: 'checkbox', id: `verdieping-gedaan-${id}` });
      gedaan.checked = v0.gedaan;
      let vt;
      tekstVeld.addEventListener('input', () => { clearTimeout(vt); vt = setTimeout(() => sessie.zetVerdieping({ tekst: tekstVeld.value }), BEWAAR_NA_MS); });
      gedaan.addEventListener('change', () => sessie.zetVerdieping({ tekst: tekstVeld.value, gedaan: gedaan.checked }));
      verdiepingKop.append(
        h('p', {}, model.verdieping.tekst),
        h('p', { class: 'klein' }, 'Dit is optioneel. Het telt niet mee voor je status en niet voor de tijd.'),
        h('div', { class: 'veld' }, h('label', { for: `verdieping-${id}` }, 'Jouw antwoord (optioneel)'), tekstVeld),
        h('div', { class: 'optie' }, gedaan, h('label', { for: `verdieping-gedaan-${id}` }, 'Verdieping gedaan')));
    } else {
      verdiepingKop.classList.add('geen-verdieping'); // niets te tonen (DESIGN: geen lege blokken)
    }
    function tekenKlaar() {
      const klaar = sessie.isKlaar(id);
      klaarKnop.hidden = klaar;
      klaarBericht.textContent = klaar ? `Taak ${id} is klaar. Schrijf je volgende stap op en ga door.` : '';
      verdiepingKop.hidden = !klaar || !model.verdieping;
      tekenVoortgang();
    }

    // vaste kop: taaknummer in het leerblok, segmentbalk van de vier stappen en de stappenrij (SX-4)
    const segmenten = h('div', { class: 'segmenten', role: 'img' });
    const stappenRij = h('ol', { class: 'stappenrij' });
    function tekenVoortgang() {
      const o = sessie.oefening(id);
      stand = stapStand({
        gestart: isIngevuld(toe.lees()) || isIngevuld(o.invoer),
        geoefend: isIngevuld(o.invoer) || o.overgeslagen,
        oefeningAf: o.modelZichtbaar || o.overgeslagen,
        klaar: sessie.isKlaar(id),
      });
      segmenten.setAttribute('aria-label', segmentLabel(taakNr, blok.taken.length, stand));
      tekenVoet();
      wis(segmenten);
      // DESIGN §5.3: voltooid zwart, de stap waar je bent in accent, de rest grijs
      const hierStap = adres.soort === 'taak' && adres.taak === id ? adres.stap : stand.actief + 1;
      stand.stappen.forEach((st, i) => segmenten.append(h('span', { class: `segment segment-${i + 1 === hierStap ? 'actief' : st.stand === 'voltooid' ? 'voltooid' : 'open'}` })));
      wis(stappenRij);
      // onderstreept is de stap die de student nu ziet; de segmenten tonen de voortgang
      const hier = adres.soort === 'taak' && adres.taak === id ? adres.stap : stand.actief + 1;
      stand.stappen.forEach((st, i) => stappenRij.append(h('li', {},
        h('a', { href: maakAdres(id, i + 1), 'aria-current': i + 1 === hier ? 'step' : null, class: `stap-link stap-${st.stand}` }, st.naam))));
    }
    const tijd = taak.richttijd.minuten ? `± ${taak.richttijd.minuten} min` : taak.richttijd.tekst;
    // De balk is een direct kind van het artikel, zodat hij over de hele taak blijft staan (position: sticky).
    const kop = [
      h('div', { class: 'taakbalk' },
        h('p', { class: 'eyebrow' }, h('a', { href: '#', class: 'naar-overzicht' }, `← Leerblok ${blok.leerblok}`), ` · Taak ${taakNr} van ${blok.taken.length}`),
        segmenten,
        h('nav', { 'aria-label': `Stappen van taak ${id}` }, stappenRij)),
      h('h2', { id: `kop-${id}` }, h('span', { class: 'nr' }, id), ` ${taak.titel}`),
      h('p', { class: 'meta' }, h('span', { class: 'vorm' }, taak.vorm), ' · ', h('span', { class: 'tijd' }, tijd))];

    let stand = null;
    taken.set(id, {
      leesInhoud: lees, toon: toonResultaat,
      actieveStap: () => (stand ? stand.actief + 1 : 1),
      modelOpen: () => modelOpen || sessie.oefening(id).overgeslagen,
      openModel,
      klaarMogelijk: () => sessie.beoordeel(id, lees()).klaarMogelijk,
      isKlaar: () => sessie.isKlaar(id),
      klaar: () => klaarKnop.click(),
      tekenVoortgang: () => tekenVoortgang(),
    });
    const artikel = h('article', { class: 'taak', id: `taak-${id}`, 'aria-labelledby': `kop-${id}` },
      kop, stap1, stap2, stap3, stap4, verdiepingKop);
    const m0 = sessie.oefening(id);
    toonModel(m0);
    tekenOverslaan(m0);
    toonResultaat();
    tekenKlaar();
    laatsteUitkomsten = sessie.beoordeel(id, lees()).uitkomsten;
    tekenChecklist();
    return artikel;
  }

  // ---------------------------------------------------------------- afsluiten (TK-15, TK-16, TK-17)

  const volgendeBlok = overzicht.leerblokken.find((b) => b.nummer === blok.leerblok + 1);
  const volgende = volgendeBlok ? { href: volgendeBlok.pagina, titel: `Leerblok ${volgendeBlok.nummer} · ${volgendeBlok.titel}` } : { href: 'dossier.html', titel: 'Dossier' };
  const volgendeStapVeld = h('textarea', { id: 'afsluit-volgende-stap', rows: 2 });
  volgendeStapVeld.value = sessie.leesVolgendeStap();
  let vtimer;
  volgendeStapVeld.addEventListener('input', () => { clearTimeout(vtimer); vtimer = setTimeout(() => sessie.bewaarVolgendeStap(volgendeStapVeld.value), BEWAAR_NA_MS); });
  // A3-vak 1 in vier delen (SX-12): een deel is gevuld als dat leerblok is afgerond (TK-16).
  const alleOnderdelen = overzicht.leerblokken.flatMap((b) => b.bewijsonderdelen);
  const standPerBlok = () => {
    const recs = leesRecords(store, alleOnderdelen);
    const per = overzicht.leerblokken.map((b) => [b.nummer, isAfgerond(b.bewijsonderdelen, recs)]);
    return { afgerond: Object.fromEntries(per.map(([n, r]) => [n, r.afgerond])), bezig: Object.fromEntries(per.map(([n, r]) => [n, [r.onderdelen.filter((o) => o.telt).length, r.onderdelen.length]])) };
  };
  const afsluitKop = h('h2', { id: 'afsluiten-kop' });
  const afsluitA3 = h('div', { class: 'a3-vak' });
  const afsluitMelding = h('p', { role: 'status', class: 'klein', id: 'afsluit-kopieer-melding' });
  function tekenAfsluiten() {
    const m = sessie.afsluitModel(volgende);
    const pb = standPerBlok();
    const stand = a3Stand(pb.afgerond, m.afgerond ? blok.leerblok : null, pb.bezig);
    afsluitKop.textContent = m.afgerond
      ? (stand.aantal === 4 ? 'Je A3-vak 1 staat.' : `Deel ${blok.leerblok} van je A3-vak 1 staat.`)
      : 'Klaar met dit blok?';
    tekenA3Vak(afsluitA3, stand);
    wis(afsluitStatus);
    afsluitStatus.append(
      h('ul', { class: 'afsluit-onderdelen' }, m.onderdelen.map((o) => h('li', {},
        statusChip(o.status, o.statusTekst), ` ${o.titel}`, o.voorlopig ? ' (voorlopig)' : ''))),
      h('p', { class: 'afgerond-tekst', role: 'status' }, m.afgerondTekst));
  }
  // TK-11: „wat ik hiermee aan mijn A3 heb”, aan het eind van leerblok 4; de dossierpagina toont de zin naast de waarom-zin.
  const a3Vraag = blok.afsluiting?.a3Zin;
  const a3Veld = h('textarea', { id: 'afsluit-a3-zin', rows: 2 });
  a3Veld.value = sessie.leesA3Zin();
  let atimer;
  a3Veld.addEventListener('input', () => { clearTimeout(atimer); atimer = setTimeout(() => sessie.bewaarA3Zin(a3Veld.value), BEWAAR_NA_MS); });
  if (a3Vraag) window.addEventListener('pagehide', () => sessie.bewaarA3Zin(a3Veld.value));
  // „Kopieer naar mijn A3” (LB-16, LB-17): het tekstblok en het klembord laden pas na de klik (PF-4).
  const kopieerKnop = h('button', { type: 'button', class: 'knop knop-wit', id: 'afsluit-kopieer', onclick: async () => {
    try {
      // gewicht-alleen: naklik
      const [{ maakA3Tekst }, { logKopie }, { kopieer }] = await Promise.all([import('./a3tekst.js'), import('./a3log.js'), import('./klembord.js')]);
      await kopieer(maakA3Tekst({ records: leesRecords(store, ['EV-01', 'EV-02', 'EV-08', 'EV-11']), profiel: leesProfiel(store) }).tekst);
      logKopie(store);
      afsluitMelding.textContent = 'Gekopieerd. Plak het in vak 1 van de A3 van je team.';
    } catch (e) {
      afsluitMelding.textContent = 'Kopiëren lukte niet in deze browser. Op de dossierpagina staat het tekstblok om zelf te selecteren.';
    }
  } }, 'Kopieer naar mijn A3');
  const afsluiten = h('section', { class: 'afsluit-moment', id: 'afsluiten', 'aria-labelledby': 'afsluiten-kop' },
    h('p', { class: 'eyebrow' }, `Leerblok ${blok.leerblok}`),
    afsluitKop, afsluitA3,
    afsluitStatus,
    a3Vraag ? h('div', { class: 'veld' }, h('label', { for: 'afsluit-a3-zin' }, a3Vraag.vraag), h('p', { class: 'klein' }, a3Vraag.uitleg), a3Veld) : null,
    h('div', { class: 'veld' }, h('label', { for: 'afsluit-volgende-stap' }, m0Vraag()), volgendeStapVeld),
    h('div', { class: 'knoppen' }, kopieerKnop, h('a', { class: 'knop knop-omlijnd', id: 'door', href: volgende.href }, `Door naar ${volgende.titel}`)),
    afsluitMelding,
    h('p', { class: 'bewaarmelding' }, sessie.afsluitModel(volgende).bewaarmelding, ' ', h('a', { href: 'dossier.html' }, 'Naar het dossier')));
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

  // Media (fase 12): leerblok 2 en 4 bieden drie routes met dezelfde „klaar als”; leerblok 1 toont de kijktips als gewone links.
  const mediaPlek = blok.media ? h('div', { class: 'media-plek' }) : null;
  let mediaSectie = null;
  async function toonMedia() {
    if (mediaSectie || !mediaPlek) return;
    const { bouwMediaSectie } = await laadMedia();
    mediaSectie = bouwMediaSectie({ blok, store, met, modelZichtbaar: () => sessie.oefening(blok.media.taak).modelZichtbaar });
    mediaPlek.append(mediaSectie.element);
  }
  if (mediaPlek) document.addEventListener('a3-oefening', (e) => { if (e.detail.taak === blok.media.taak) mediaSectie?.ververs(); });
  const kijktips = blok.kijktips ? mediaDirect.bouwKijktips({ kijktips: blok.kijktips, met }) : null;

  const takenLijst = h('ol', {});
  const inhoud = h('nav', { 'aria-label': 'Taken in dit leerblok', class: 'taken-nav' }, takenLijst);
  function tekenTakenLijst() {
    wis(takenLijst);
    takenLijst.append(...blok.taken.map((t) => h('li', {}, h('a', { href: `#taak-${t.id}`, class: 'taak-link' },
      `${t.id} ${t.titel}`, sessie.isKlaar(t.id) ? h('span', { class: 'taak-klaar' }, ' ✓ klaar') : null))),
    h('li', {}, h('a', { href: '#afsluiten', class: 'taak-link' }, 'Klaar met dit blok')));
  }

  // ---------------------------------------------------------------- één taak per scherm (SX-6, fase 19)

  const artikelen = blok.taken.map((t, i) => taakArtikel(t, i + 1));
  const takenIds = blok.taken.map((t) => t.id);
  const overzichtSectie = h('div', { id: 'overzicht' },
    h('p', { class: 'meta' }, `± ${blok.richttijd} min · Na dit blok heb je: ${blok.eindigtMet.charAt(0).toLowerCase()}${blok.eindigtMet.slice(1)}.`),
    aanbevolen ? h('p', { class: 'meta', id: 'aanbevolen' }, `Aanbevolen: ${aanbevolen.week}, ${aanbevolen.dag}.`) : null,
    vorigeKeer, vraagstuk, kijktips, h('h2', {}, 'Taken in dit leerblok'), inhoud);
  const voetTerug = h('button', { type: 'button', class: 'knop', 'data-actie': 'terug' });
  const voetPrimair = h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'primair' });
  const voet = h('nav', { class: 'taakvoet', 'aria-label': 'Verder in deze taak' }, voetTerug, voetPrimair);
  const POSITIE = `positie:${blok.leerblok}`;
  const ga = (doel) => { if (doel === '#') history.pushState(null, '', location.pathname); else location.hash = doel; if (doel === '#') toonAdres(); };

  function tekenVoet() {
    if (!klaarVoorVoet) return;
    const t = adres.soort === 'taak' ? taken.get(adres.taak) : null;
    const positie = store.getMeta(POSITIE);
    const a = voetActies({
      soort: adres.soort, taken: takenIds, taak: adres.taak, stap: adres.stap,
      verder: positie?.taak ?? (takenIds.some((x) => sessie.isKlaar(x)) ? takenIds.find((x) => !sessie.isKlaar(x)) : undefined),
      modelOpen: t?.modelOpen(), klaarMogelijk: t?.klaarMogelijk(), klaar: t?.isKlaar(),
    });
    voet.hidden = !a.primair && !a.terug;
    voetPrimair.hidden = !a.primair;
    voetTerug.hidden = !a.terug;
    if (a.primair) { voetPrimair.textContent = a.primair.label; voetPrimair.onclick = () => voetActie(a.primair); }
    if (a.terug) { voetTerug.textContent = a.terug.label; voetTerug.onclick = () => ga(a.terug.doel); }
  }
  function voetActie(p) {
    const t = taken.get(adres.taak);
    if (p.actie === 'ga') ga(p.doel);
    else if (p.actie === 'model') { if (t.openModel()) tekenVoet(); }
    else if (p.actie === 'klaar') { t.klaar(); tekenVoet(); }
  }

  function toonAdres({ focus = true } = {}) {
    adres = leesAdres(location.hash, takenIds);
    if (adres.soort === 'taak' && adres.stap === null) {
      // zonder stap: de stap waar de student is (SX-6); het adres wordt vervangen, zodat terug niet in een lus loopt
      adres.stap = taken.get(adres.taak).actieveStap();
      history.replaceState(null, '', maakAdres(adres.taak, adres.stap));
    }
    overzichtSectie.hidden = adres.soort !== 'overzicht';
    afsluiten.hidden = adres.soort !== 'afsluiten';
    document.body.classList.toggle('in-taak', adres.soort === 'taak');
    artikelen.forEach((art, i) => {
      const deze = adres.soort === 'taak' && takenIds[i] === adres.taak;
      art.hidden = !deze;
      if (!deze) return;
      art.querySelectorAll(':scope > .stap').forEach((sec) => { sec.hidden = Number(sec.dataset.stap) !== adres.stap; });
      art.classList.toggle('op-toepassen', adres.stap === 4);
    });
    if (adres.soort === 'overzicht') tekenTakenLijst();
    if (adres.soort === 'taak') taken.get(adres.taak).tekenVoortgang();
    if (adres.soort === 'taak' && adres.stap === 2 && adres.taak === blok.media?.taak) toonMedia().catch(() => mediaPlek.append(h('p', { class: 'klein' }, 'De keuze tussen tekst, video en spel kon niet laden; de tekst hierboven is genoeg om verder te gaan (MD-12).')));
    if (adres.soort === 'taak') {
      const titel = blok.taken.find((t) => t.id === adres.taak)?.titel;
      try { store.setMeta(POSITIE, { leerblok: blok.leerblok, taak: adres.taak, stap: adres.stap, titel, bijgewerkt: new Date().toISOString() }); } catch (e) { /* zonder opslag geen „ga verder” */ }
    }
    tekenVoet();
    if (!focus) return;
    const doel = adres.soort === 'taak' ? document.getElementById(`stapkop-${adres.taak}-${adres.stap}`)
      : adres.soort === 'afsluiten' ? document.getElementById('afsluiten-kop') : h1;
    doel?.setAttribute('tabindex', '-1');
    doel?.focus();
    if (adres.soort === 'overzicht') window.scrollTo(0, 0);
  }

  document.body.classList.add('taakweergave');
  main.append(...[
    h1,
    geblokkeerd ? geblokkeerdMelding(store, config.versie) : null,
    foutGebied, bevestiging, herinneringGebied, overzichtSectie,
    ...artikelen, afsluiten, voet,
  ].filter(Boolean));
  tekenAfsluiten();
  tekenWissel();
  toonBewaarHerinnering(herinneringGebied, store, config.versie);
  klaarVoorVoet = true;
  window.addEventListener('hashchange', () => toonAdres());
  window.addEventListener('popstate', () => toonAdres());
  toonAdres({ focus: location.hash !== '' });
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
