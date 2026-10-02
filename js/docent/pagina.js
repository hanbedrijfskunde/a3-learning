// De docentmodus (DM-1 t/m DM-17), alleen DOM. Regels zitten in klok.js en kaarten.js; de keuze in kies.js.
// Bewaard wordt alleen wat van de docent is: de begintijden van het rooster (localStorage) en de stand van de klok
// (sessionStorage, zodat herladen de klok niet wist). Nooit iets van studenten en nooit een verbinding (PR-3, PR-4):
// deze pagina laadt bij de keuze de eigen bestanden uit data/ en verder niets.
import { h, wis } from '../dom.js';
import { maakKlok, klokTekst, rondeFasen, rondeFase } from './klok.js';
import { stapkaartModel, docentkaartModel, programmaModel, draaiboekModel, terugblikKaarten } from './kaarten.js';
import { modusUitAdres, docentAdres } from './kies.js';
import { werkboekModel } from './werkboek.js';
import { bouwVideo, bouwSpelPaneel } from '../media.js'; // fase 12: video en spel vanaf de stapkaart (DM-13, alleen eigen bestanden)

/** De delen met docentvelden (zelfde formaat): deel 1 uit fase 9, deel 2 uit fase 10 (DM-18). */
const DELEN = { 1: 'data/docent-deel1.json', 2: 'data/docent-deel2.json' };
const laad = async (pad) => {
  const r = await fetch(new URL(`../../${pad}`, import.meta.url));
  if (!r.ok) throw new Error(`${pad}: ${r.status}`);
  return r.json();
};
const bewaarde = (opslagNaam) => { try { return globalThis[opslagNaam]; } catch (e) { return null; } };
const lees = (opslagNaam, sleutel) => { try { return JSON.parse(bewaarde(opslagNaam)?.getItem(`a3d:${sleutel}`) ?? 'null'); } catch (e) { return null; } };
const schrijf = (opslagNaam, sleutel, w) => { try { bewaarde(opslagNaam)?.setItem(`a3d:${sleutel}`, JSON.stringify(w)); } catch (e) { /* zonder opslag werkt alles, alleen niet na herladen */ } };

const lijst = (items, klasse) => h('ul', { class: klasse }, items.map((t) => h('li', {}, t)));

function draaiboekEl(m) {
  const kop = (t) => h('dt', {}, t);
  const rij = (r) => h('article', { class: 'db-onderdeel' },
    h('h3', {}, `${r.start} · ${r.minuten} min · ${r.titel}`),
    h('dl', {},
      kop('Taak'), h('dd', {}, r.stapkaart.taaknummer),
      kop('Opdracht'), h('dd', {}, r.stapkaart.opdracht),
      kop('Klaar als'), h('dd', {}, r.stapkaart.klaarAls),
      kop('Materiaal en dia’s'), h('dd', {}, `${r.stapkaart.materiaal}. ${r.stapkaart.dia}. ${r.stapkaart.laptop}.`),
      kop('Wat de docent doet'), h('dd', {}, r.kaart.watDocentDoet),
      kop('Kernboodschap'), h('dd', {}, r.kaart.kernboodschap),
      kop('Rondloopvragen'), h('dd', {}, r.kaart.rondloopvragen.length ? lijst(r.kaart.rondloopvragen) : 'Geen: dit is uitleg.'),
      kop('Als het anders loopt'), h('dd', {}, lijst(r.kaart.alsHetAndersLoopt)),
      r.kaart.modelantwoorden?.length ? [kop('Modelantwoord'), h('dd', {}, r.kaart.modelantwoorden.map((a) => h('p', {}, a.label ? `${a.label} ` : '', h('strong', {}, a.antwoord))))] : null,
      r.kaart.veelgemaakteFouten?.length ? [kop('Veelgemaakte fouten'), h('dd', {}, lijst(r.kaart.veelgemaakteFouten))] : null));
  return h('div', {}, h('h2', {}, `Draaiboek · ${m.titel} (${m.duurMinuten} min)`), m.rijen.map(rij), m.afsluiting ? h('p', {}, h('strong', {}, m.afsluiting)) : null);
}

function werkboekEl(m) {
  const taak = (t) => h('article', { class: 'wb-taak' },
    h('h3', {}, `Taak ${t.nummer} · ${t.titel}`),
    h('p', { class: 'meta' }, [t.vorm, t.tijd].filter(Boolean).join(' · ')),
    h('dl', {},
      t.waarom ? [h('dt', {}, 'Waarom'), h('dd', {}, t.waarom)] : null,
      t.opdracht ? [h('dt', {}, 'Opdracht'), h('dd', {}, t.opdracht)] : null,
      h('dt', {}, 'Klaar als'), h('dd', {}, t.klaarAls)),
    h('div', { class: 'wb-schrijfruimte', 'aria-hidden': 'true' }));
  return h('div', {}, h('h2', {}, `Werkboek · ${m.titel}`), m.taken.map(taak));
}

async function startDocentmodus(main) {
  wis(main);
  main.append(h('p', { role: 'status' }, 'De docentmodus wordt geladen…'));
  let delen; let blokken; let terugblik;
  try {
    const bestanden = await Promise.all(Object.values(DELEN).map(laad));
    const nrs = [...new Set(bestanden.flatMap((d) => d.onderdelen.flatMap((o) => [o.leerblok, o.media?.leerblok])).filter(Boolean))];
    const [blokLijst, tb] = await Promise.all([Promise.all(nrs.map((n) => laad(`data/leerblok-${n}.json`))), laad('data/terugblik.json')]);
    blokken = Object.fromEntries(nrs.map((n, i) => [n, blokLijst[i]]));
    terugblik = tb;
    delen = Object.fromEntries(Object.keys(DELEN).map((nr, i) => [nr, { deel: bestanden[i] }]));
  } catch (e) {
    wis(main);
    main.append(h('h1', {}, 'Docentmodus'), h('p', { class: 'fout', role: 'alert' }, `De docentmodus kon niet worden geladen (${e.message}).`));
    return;
  }

  for (const [nr, d] of Object.entries(delen)) {
    d.klok = maakKlok({ onderdelen: d.deel.onderdelen, duurMinuten: d.deel.duurMinuten });
    d.klok.herstel(lees('sessionStorage', `klok:${nr}`));
  }
  const bewaarKlok = () => schrijf('sessionStorage', `klok:${huidig}`, delen[huidig].klok.exporteer());
  const begintijden = lees('localStorage', 'begintijden') ?? {};

  let huidig = Object.keys(delen)[0];
  let weergave = 'stapkaart';
  let getoond = null; // id van het onderdeel dat de docent bekijkt; null = volg het actieve
  let modelOpen = new Set();
  let resetGewenst = false;
  const tik = [];

  const klok = () => delen[huidig].klok;
  const deel = () => delen[huidig].deel;
  const staat = () => klok().toestand();
  const getoondId = (t) => getoond ?? t.actiefId ?? t.onderdelen.find((p) => p.status === 'gepland')?.id ?? t.onderdelen[0].id;
  const actie = (fn) => () => { fn(); resetGewenst = false; bewaarKlok(); teken(); };
  const knop = (tekst, onclick, extra = {}) => h('button', { type: 'button', class: 'knop', onclick, ...extra }, tekst);

  const balk = h('section', { class: 'balk', 'aria-label': 'Klok' });
  const nav = h('nav', { class: 'weergaven', 'aria-label': 'Weergave' });
  const paneel = h('section', { id: 'paneel', 'aria-live': 'off' });
  const afdruk = h('section', { id: 'afdruk', 'aria-label': 'Draaiboek om af te drukken' });
  // Video en spel bij een onderdeel (DM-13): een eigen gebied naast de stapkaart, dat alleen opnieuw wordt getekend als het
  // onderdeel wisselt, zodat een afspelende video niet stopt als de klok een keer ververst of de docent pauze drukt.
  const mediaGebied = h('section', { class: 'sk-media', 'aria-label': 'Video en spel bij dit onderdeel', hidden: true });
  let mediaVoor = null;
  wis(main);
  main.append(h('h1', {}, 'Docentmodus'), balk, nav, paneel, mediaGebied, afdruk);

  function tekenBalk() {
    wis(balk); tik.length = 0;
    const t = staat();
    const tekstEl = (klasse, fn, label) => { const el = h('span', { class: klasse }); tik.push(() => { el.textContent = fn(staat()); }); return h('p', { class: 'balk-tijd' }, h('span', { class: 'meta' }, `${label} `), el); };
    balk.append(...[
      Object.keys(delen).length > 1 ? h('div', { class: 'knoppen' }, Object.keys(delen).map((nr) => knop(`Deel ${nr}`, () => { huidig = nr; getoond = null; teken(); }, { 'aria-pressed': String(nr === huidig) }))) : null,
      h('div', { class: 'balk-rij' },
        tekstEl('klok-groot', (s) => klokTekst(s.verstreken), `Deel ${huidig} (${deel().duurMinuten} min):`),
        tekstEl('klok-tekst', (s) => klokTekst(s.resterend), 'Nog te doen:'),
        tekstEl('klok-tekst', (s) => (s.marge === null ? '' : s.marge >= 0 ? `${klokTekst(s.marge)} ruimte` : `${klokTekst(-s.marge)} te laat`), 'Marge:'),
        h('p', { class: 'balk-tijd', role: 'status' }, h('span', { class: 'meta' }, 'Klok: '), t.staat === 'loopt' ? 'loopt' : t.staat === 'pauze' ? 'gepauzeerd' : t.klaar ? 'klaar' : 'gestopt')),
      h('div', { class: 'knoppen' },
        knop(t.staat === 'pauze' ? 'Hervat' : 'Start', actie(() => klok().start()), { disabled: t.staat === 'loopt' }),
        knop('Pauze', actie(() => klok().pauze()), { disabled: t.staat !== 'loopt' }),
        knop(resetGewenst ? 'Reset: klik nogmaals' : 'Reset', () => {
          if (resetGewenst) { klok().reset(); getoond = null; resetGewenst = false; bewaarKlok(); teken(); return; }
          resetGewenst = true; teken(); setTimeout(() => { if (resetGewenst) { resetGewenst = false; teken(); } }, 4000);
        }),
        knop('Volgende onderdeel', actie(() => { klok().volgende(); getoond = null; }), { class: 'knop knop-accent', disabled: t.staat === 'stil' || !t.actief }))].filter(Boolean));
  }

  function tekenNav() {
    wis(nav);
    for (const [id, tekst] of [['stapkaart', 'Stapkaart'], ['docentkaart', 'Docentkaart'], ['programma', 'Programma'], ['terugblik', 'Terugblik'], ['afdrukken', 'Afdrukken']]) {
      nav.append(knop(tekst, () => { weergave = id; teken(); }, { 'aria-pressed': String(id === weergave) }));
    }
  }

  const bladerKnoppen = (t) => {
    const ids = t.onderdelen.map((p) => p.id);
    const i = ids.indexOf(getoondId(t));
    return h('div', { class: 'knoppen' },
      knop('Vorig onderdeel', () => { getoond = ids[i - 1]; teken(); }, { disabled: i <= 0 }),
      knop('Volgend onderdeel', () => { getoond = ids[i + 1]; teken(); }, { disabled: i >= ids.length - 1 }),
      getoond && getoond !== t.actiefId ? knop('Naar het onderdeel van de klok', () => { getoond = null; teken(); }) : null);
  };

  function tekenStapkaart(t, o, p) {
    const m = stapkaartModel(o, blokken, { minuten: p.minuten });
    const label = p.actief ? 'Nu bezig' : { gedaan: 'Klaar', overgeslagen: 'Overgeslagen', gepland: t.staat === 'stil' ? 'Nog niet gestart' : 'Komt nog' }[p.status];
    const aftel = h('p', { class: 'sk-aftel' });
    if (p.actief) tik.push(() => { const a = staat().actief; aftel.textContent = a.resterend >= 0 ? `Nog ${klokTekst(a.resterend)}` : `Over de richttijd: ${klokTekst(-a.resterend)}`; aftel.classList.toggle('over', a.resterend < 0); });
    let ronde = null;
    if (o.ronde) {
      const fasen = rondeFasen(o.ronde);
      const el = h('p', { class: 'sk-ronde' }); ronde = el;
      tik.push(() => { const f = rondeFase(fasen, p.actief ? staat().actiefVerstreken : 0); el.textContent = `${f.naam}: nog ${klokTekst(f.resterend)}${f.klaar ? ' (klaar)' : ''}`; });
    }
    paneel.append(h('article', { class: 'stapkaart', 'aria-label': `Stapkaart ${o.titel}` },
      h('div', { class: 'sk-rij' }, h('p', { class: 'sk-taak' }, m.taaknummer), h('h2', { class: 'sk-titel' }, o.titel), h('p', { class: 'sk-tijd' }, m.tijd), h('p', { class: 'sk-status' }, label), aftel),
      ronde,
      h('p', { class: 'sk-opdracht' }, m.opdracht),
      h('p', { class: 'sk-klaar' }, m.klaarAls),
      h('p', { class: 'sk-materiaal' }, m.materiaal),
      h('div', { class: 'sk-onder' }, h('p', { class: 'sk-dia' }, m.dia), h('p', { class: `sk-laptop sk-laptop-${o.laptop}` }, m.laptop))), bladerKnoppen(t));
  }

  function tekenDocentkaart(t, o) {
    const k = docentkaartModel(o, blokken, { geopend: modelOpen.has(o.id) });
    const open = modelOpen.has(o.id);
    paneel.append(bladerKnoppen(t), h('article', { class: 'docentkaart' },
      h('p', { class: 'niet-projecteren' }, 'Alleen voor de docent: projecteer de stapkaart, niet deze kaart.'),
      h('h2', {}, o.titel),
      h('h3', {}, 'Wat je doet'), h('p', {}, k.watDocentDoet),
      h('h3', {}, 'Kernboodschap'), h('p', {}, k.kernboodschap),
      h('h3', {}, 'Rondloopvragen'), k.rondloopvragen.length ? lijst(k.rondloopvragen) : h('p', { class: 'meta' }, 'Geen: dit is uitleg.'),
      h('h3', {}, 'Als het anders loopt'), lijst(k.alsHetAndersLoopt),
      k.heeftModel ? knop(open ? 'Verberg modelantwoorden en veelgemaakte fouten' : 'Toon modelantwoorden en veelgemaakte fouten', () => { if (open) modelOpen.delete(o.id); else modelOpen.add(o.id); teken(); }, { 'aria-expanded': String(open) }) : h('p', { class: 'meta' }, 'Bij dit onderdeel horen geen modelantwoorden.'),
      k.modelantwoorden ? h('div', { class: 'model', role: 'region', 'aria-label': 'Modelantwoorden en veelgemaakte fouten' },
        k.modelantwoorden.length ? h('h3', {}, 'Modelantwoord (oefencasus)') : null,
        h('dl', { class: 'model-lijst' }, k.modelantwoorden.flatMap((a) => [h('dt', {}, a.label), h('dd', {}, a.antwoord)])),
        k.veelgemaakteFouten.length ? [h('h3', {}, 'Veelgemaakte fouten'), lijst(k.veelgemaakteFouten)] : null) : null));
  }

  function tekenProgramma(t) {
    const m = programmaModel(deel(), t, begintijden[huidig]);
    const veld = h('input', { type: 'time', id: 'begintijd', value: begintijden[huidig] ?? '', oninput: (e) => {
      begintijden[huidig] = e.target.value; schrijf('localStorage', 'begintijden', begintijden);
      programmaModel(deel(), staat(), e.target.value).forEach((r, i) => { const c = tabel.querySelectorAll('tbody tr')[i]?.children[1]; if (c) c.textContent = r.rooster ?? '–'; });
    } });
    const kanWijzigen = (r) => r.status === 'gepland' || r.status === 'actief';
    const kanVerschuiven = (r) => r.status === 'gepland';
    const tabel = h('table', { class: 'programma' },
      h('caption', {}, `Programma ${deel().titel}`),
      h('thead', {}, h('tr', {}, ['Tijd in deel', 'Rooster', 'Onderdeel', 'Duur', 'Status', 'Aanpassen'].map((k) => h('th', { scope: 'col' }, k)))),
      h('tbody', {}, m.map((r) => h('tr', { class: `rij-${r.status}` },
        h('td', {}, r.inDeel), h('td', {}, r.rooster ?? '–'), h('td', {}, r.titel), h('td', {}, `${r.minuten} min`), h('td', {}, h('strong', {}, r.statusTekst)),
        h('td', { class: 'aanpassen' },
          knop('Eerder', actie(() => klok().verschuif(r.id, -1)), { disabled: !kanVerschuiven(r), 'aria-label': `Zet ${r.titel} eerder` }),
          knop('Later', actie(() => klok().verschuif(r.id, 1)), { disabled: !kanVerschuiven(r), 'aria-label': `Zet ${r.titel} later` }),
          knop('−1 min', actie(() => klok().pasAan(r.id, r.minuten - 1)), { disabled: !kanWijzigen(r) || r.minuten <= 1, 'aria-label': `Eén minuut korter voor ${r.titel}` }),
          knop('+1 min', actie(() => klok().pasAan(r.id, r.minuten + 1)), { disabled: !kanWijzigen(r), 'aria-label': `Eén minuut langer voor ${r.titel}` }),
          knop('Sla over', actie(() => klok().overslaan(r.id)), { disabled: !kanWijzigen(r), 'aria-label': `Sla ${r.titel} over` }))))));
    paneel.append(h('h2', {}, `Programma van ${deel().titel}`),
      h('p', { class: 'meta' }, 'Tijden zijn richttijden. Vul de begintijd uit het rooster in om de tijden van de dag te zien; de klok blijft vanaf 0:00 lopen.'),
      h('label', { for: 'begintijd' }, `Begintijd deel ${huidig} volgens het rooster`), veld, tabel);
  }

  function tekenTerugblik() {
    paneel.append(h('h2', {}, 'Terugblik-kaarten'), h('p', { class: 'meta' }, 'Aan het begin van een leerblok halen studenten de punten eerst uit het hoofd op; daarna laat de kaart ze zien. Hoogstens 15 minuten.'));
    for (const k of terugblikKaarten(terugblik)) {
      paneel.append(h('article', { class: 'kaart terugblik-kaart' },
        h('h3', {}, `Begin van leerblok ${k.leerblok}: terugblik op leerblok ${k.vorig}`),
        h('h4', {}, 'Meenemen'), lijst(k.items),
        h('h4', {}, 'Twee kennisvragen uit het hoofd'), lijst(k.kennisvragen),
        h('h4', {}, 'Transfervraag'), h('p', {}, k.transfervraag)));
    }
  }

  let metModel = false;
  let afdrukSoort = 'draaiboek';
  function tekenAfdrukken() {
    paneel.append(h('h2', {}, 'Afdrukken'),
      h('p', { class: 'meta' }, 'Het draaiboek komt uit dezelfde bestanden als het scherm: alle onderdelen met tijden, opdrachten en rondloopvragen.'),
      h('div', { class: 'optie' }, h('input', { type: 'checkbox', id: 'met-model', checked: metModel, onchange: (e) => { metModel = e.target.checked; vulAfdruk(); } }), h('label', { for: 'met-model' }, 'Met modelantwoorden en veelgemaakte fouten')),
      h('p', { class: 'meta' }, 'Het werkboek heeft dezelfde taaknummers en „klaar als”-regels als de leerblokpagina’s en laat ruimte om op te schrijven.'),
      h('div', { class: 'knoppen' },
        knop(`Druk het draaiboek van deel ${huidig} af`, () => { afdrukSoort = 'draaiboek'; vulAfdruk(); window.print(); }, { class: 'knop knop-accent', 'data-afdruk': 'draaiboek' }),
        knop(`Druk het werkboek van deel ${huidig} af`, () => { afdrukSoort = 'werkboek'; vulAfdruk(); window.print(); }, { class: 'knop knop-accent', 'data-afdruk': 'werkboek' })));
  }
  function vulAfdruk() {
    wis(afdruk);
    afdruk.dataset.soort = afdrukSoort;
    afdruk.append(afdrukSoort === 'werkboek' ? werkboekEl(werkboekModel(deel(), blokken)) : draaiboekEl(draaiboekModel(deel(), blokken, { metModel })));
  }

  function tekenMedia(o) {
    if (weergave !== 'stapkaart' || !o.media) { mediaVoor = null; wis(mediaGebied); mediaGebied.hidden = true; return; }
    if (mediaVoor === o.id) return;
    mediaVoor = o.id; wis(mediaGebied); mediaGebied.hidden = false;
    const m = blokken[o.media.leerblok].media;
    const uitvoer = h('div', { class: 'sk-media-uitvoer' });
    const toon = (paneelEl, startActie) => { wis(uitvoer); uitvoer.append(paneelEl); uitvoer.querySelector(`[data-actie="${startActie}"]`).click(); };
    mediaGebied.append(
      h('div', { class: 'knoppen' },
        knop(`Video ${m.video.id} afspelen`, () => toon(bouwVideo({ video: m.video }), 'speel-video'), { 'data-media': 'video' }),
        knop(`Spel starten: ${m.spel.titel}`, () => toon(bouwSpelPaneel({ spel: m.spel }), 'start-spel'), { 'data-media': 'spel' })),
      uitvoer);
  }

  function teken() {
    const t = staat();
    tekenBalk(); tekenNav(); wis(paneel);
    document.body.dataset.weergave = weergave;
    const id = getoondId(t);
    const o = deel().onderdelen.find((x) => x.id === id);
    const p = t.onderdelen.find((x) => x.id === id);
    if (weergave === 'stapkaart') tekenStapkaart(t, o, p);
    else if (weergave === 'docentkaart') tekenDocentkaart(t, o);
    else if (weergave === 'programma') tekenProgramma(t);
    else if (weergave === 'terugblik') tekenTerugblik();
    else tekenAfdrukken();
    tekenMedia(o);
    vulAfdruk();
    tik.forEach((f) => f());
  }
  teken();
  const loop = () => tik.forEach((f) => f());
  setInterval(loop, 250);
  document.addEventListener('visibilitychange', loop);
  window.addEventListener('beforeprint', vulAfdruk);
}

const main = document.querySelector('#inhoud');
if (modusUitAdres(location.search)) startDocentmodus(main);
else {
  wis(main);
  main.append(h('h1', {}, 'Docentmodus'),
    h('p', {}, 'Kies hoe je deze site gebruikt. Je hebt geen account nodig en de site bewaart niets van studenten.'),
    h('div', { class: 'knoppen' },
      h('button', { type: 'button', class: 'knop knop-accent', onclick: () => { history.replaceState(null, '', docentAdres(location.pathname.split('/').pop() || 'docent.html')); startDocentmodus(main); } }, 'Ik ben docent: open de docentmodus'),
      h('a', { class: 'knop', href: 'index.html' }, 'Ik ben student: naar de start')),
    h('p', { class: 'meta' }, 'Direct naar de docentmodus: docent.html?modus=docent.'),
    h('p', {}, 'Voor het eerst? Lees de ', h('a', { href: 'docs/docentgids.html' }, 'docentgids van twee pagina’s'), '.'));
}
