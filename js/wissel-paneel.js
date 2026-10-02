// Het paneel van de Wissel (WS-1, WS-3…WS-6, WS-10, WS-11, LB-14): alleen DOM. De regels zitten in wissel.js.
// Alles gaat via het klembord en de tekstvelden op deze pagina; er is geen verzoek naar een server (WS-9).
import { h, wis, statusChip } from './dom.js';
import { ROLLEN, ROL_ANDER_TEAM, ACTIE_STATUSSEN, herinneringTekst } from './wissel.js';

/** Kopieert tekst naar het klembord. Lukt dat niet, dan is de tekst geselecteerd zodat de student hem zelf kan kopiëren. */
async function naarKlembord(tekst, veld) {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch (e) {
    veld.focus();
    veld.select();
    try { return document.execCommand('copy'); } catch (e2) { return false; }
  }
}

const opties = (lijst) => lijst.map((r) => h('option', { value: r }, r));

/**
 * @param {object} p
 * @param {ReturnType<import('./wissel.js').maakWissel>} p.wissel
 * @param {string} [p.alias] alias van de student; wordt uit het wisselblok gehaald (WS-1)
 * @param {boolean} [p.metTeamactie] toon de teamactie bij de post-its van andere teams (WS-6, leerblok 4)
 * @param {() => void} [p.bijWijziging] na elke wijziging (opslaan gebeurt al in de Wissel zelf)
 * @param {() => {status: string, statusTekst: string}} [p.leesStatus] status van EV-09
 * @returns {{element: HTMLElement, ververs: () => void}}
 */
export function bouwWisselPaneel({ wissel, alias = '', metTeamactie = false, bijWijziging = () => {}, leesStatus = null }) {
  const melding = (id) => h('p', { class: 'klein wis-melding', id, role: 'status' });
  const klaar = (el, tekst, ok = true) => { el.textContent = tekst; el.classList.toggle('fout', !ok); };
  const na = () => { tekenHerinnering(); tekenStatus(); bijWijziging(); };

  // ---- 1. mijn wisselblok (WS-1)
  const eigen = h('textarea', { id: 'wis-eigen', rows: 5, readonly: true, 'aria-label': 'Jouw wisselblok' });
  const eigenMelding = melding('wis-eigen-melding');
  const kopieerKnop = h('button', { type: 'button', class: 'knop knop-accent', id: 'wis-kopieer', onclick: async () => {
    const w = wissel.mijnWisselblok(alias);
    if (w.leeg) { klaar(eigenMelding, 'Vul eerst je onderzoeksvraag en je zoekvragen in; dan is er iets om te delen.', false); return; }
    const ok = await naarKlembord(w.tekst, eigen);
    klaar(eigenMelding, ok ? 'Gekopieerd. Plak het in de app waarmee je je wisselpartner bereikt.' : 'Kopiëren is niet gelukt. De tekst is geselecteerd: kopieer hem zelf.', ok);
  } }, 'Kopieer mijn wisselblok');
  const tekenEigen = () => {
    const w = wissel.mijnWisselblok(alias);
    eigen.value = w.leeg ? '' : w.tekst;
  };

  // ---- 2. het wisselblok van een wisselpartner (WS-3) en feedback daarop geven (WS-4)
  const rolBlok = h('select', { id: 'wis-rol-blok' }, opties(ROLLEN));
  const plakBlok = h('textarea', { id: 'wis-plak-blok', rows: 4 });
  const blokMelding = melding('wis-blok-melding');
  const blokken = h('div', { id: 'wis-blokken' });
  const bewaarBlok = h('button', { type: 'button', class: 'knop', id: 'wis-bewaar-blok', onclick: () => {
    const r = wissel.plakWisselblok(plakBlok.value, rolBlok.value);
    if (!r.ok) { klaar(blokMelding, r.fout, false); return; }
    plakBlok.value = '';
    klaar(blokMelding, r.nieuw ? 'Wisselblok bewaard. Geef hieronder je feedback.' : 'Dit wisselblok had je al bewaard.');
    tekenBlokken();
    tekenEigen();
    na();
  } }, 'Bewaar dit wisselblok');

  function feedbackFormulier(b) {
    const veld = (naam, label) => {
      const id = `wis-fb-${b.id}-${naam}`;
      return h('div', { class: 'veld' }, h('label', { for: id }, label), h('textarea', { id, rows: 2 }));
    };
    const uitvoer = h('div', { class: 'wis-terug', hidden: true });
    const m = melding(`wis-fb-${b.id}-melding`);
    const bewaar = h('button', { type: 'button', class: 'knop', id: `wis-fb-${b.id}-bewaar`, onclick: () => {
      const lees = (n) => document.getElementById(`wis-fb-${b.id}-${n}`).value;
      const r = wissel.geefFeedback({ blokId: b.id, zie: lees('zie'), mis: lees('mis'), vraag: lees('vraag') });
      if (!r.ok) { klaar(m, r.fout, false); return; }
      klaar(m, 'Je feedback staat in je feedbacklog. Stuur hem terug aan je wisselpartner.');
      wis(uitvoer);
      const tekst = h('textarea', { id: `wis-fb-${b.id}-tekst`, rows: 4, readonly: true, 'aria-label': 'Feedback om terug te sturen' });
      tekst.value = r.tekst;
      const kopieer = h('button', { type: 'button', class: 'knop knop-accent', id: `wis-fb-${b.id}-kopieer`, onclick: async () => {
        const ok = await naarKlembord(r.tekst, tekst);
        klaar(m, ok ? 'Gekopieerd. Stuur het terug aan je wisselpartner.' : 'Kopiëren is niet gelukt. De tekst is geselecteerd: kopieer hem zelf.', ok);
      } }, 'Kopieer feedback om terug te sturen');
      uitvoer.append(tekst, kopieer);
      uitvoer.hidden = false;
      tekenLog();
      na();
    } }, 'Bewaar mijn feedback');
    return h('div', {}, veld('zie', 'Ik zie…'), veld('mis', 'Ik mis…'), veld('vraag', 'Ik vraag me af…'), bewaar, m, uitvoer);
  }
  function tekenBlokken() {
    wis(blokken);
    for (const b of wissel.blokken()) {
      blokken.append(h('div', { class: 'wis-blok', 'data-blok': b.id },
        h('h4', {}, `Wisselblok van je ${b.rol}`),
        h('pre', { class: 'wis-pre' }, b.tekst),
        feedbackFormulier(b)));
    }
  }

  // ---- 3. feedback die terugkomt (WS-5)
  const rolFb = h('select', { id: 'wis-rol-fb' }, opties(ROLLEN));
  const plakFb = h('textarea', { id: 'wis-plak-fb', rows: 4 });
  const fbMelding = melding('wis-fb-melding');
  const bewaarFb = h('button', { type: 'button', class: 'knop', id: 'wis-bewaar-fb', onclick: () => {
    const r = wissel.plakFeedback(plakFb.value, rolFb.value);
    if (!r.ok) { klaar(fbMelding, r.fout, false); return; }
    plakFb.value = '';
    klaar(fbMelding, 'Feedback bewaard in je feedbacklog. Schrijf hieronder wat je ermee doet.');
    tekenLog();
    na();
  } }, 'Bewaar deze feedback');

  // ---- de feedbacklog (LB-14, WS-4, WS-6, WS-11)
  const herinnering = h('div', { class: 'wis-herinnering', id: 'wis-herinnering', role: 'status', hidden: true });
  const statusRegel = h('p', { id: 'wis-status', role: 'status' });
  const log = h('ul', { class: 'wis-log', id: 'wis-log' });
  function tekenHerinnering() {
    const lijst = wissel.herinneringen();
    wis(herinnering);
    herinnering.hidden = lijst.length === 0;
    lijst.forEach((x) => herinnering.append(h('p', {}, herinneringTekst(x))));
  }
  function tekenStatus() {
    wis(statusRegel);
    if (leesStatus) { const s = leesStatus(); statusRegel.append('Status van je feedback: ', statusChip(s.status, s.statusTekst)); }
  }
  function regelEl(r) {
    const van = r.richting === 'ontvangen' ? `Ontvangen van je ${r.rol}` : `Gegeven aan je ${r.rol}`;
    const actie = h('input', { type: 'text', id: `wis-actie-${r.id}`, value: r.actie, autocomplete: 'off',
      onchange: (e) => { wissel.wijzigRegel(r.id, { actie: e.target.value }); na(); } });
    const status = h('select', { id: `wis-status-${r.id}`, onchange: (e) => { wissel.wijzigRegel(r.id, { status: e.target.value }); na(); } }, opties(ACTIE_STATUSSEN));
    status.value = r.status;
    return h('li', { class: 'wis-regel', 'data-regel': r.id },
      h('p', { class: 'wis-van' }, h('strong', {}, van)),
      h('dl', { class: 'wis-dl' },
        h('dt', {}, 'Ik zie'), h('dd', {}, r.zie || '–'),
        h('dt', {}, 'Ik mis'), h('dd', {}, r.mis || '–'),
        h('dt', {}, 'Ik vraag me af'), h('dd', {}, r.vraag || '–')),
      r.richting === 'ontvangen'
        ? h('div', { class: 'wis-actie' },
          h('div', { class: 'veld' }, h('label', { for: `wis-actie-${r.id}` }, 'Wat doe je hiermee? (actie)'), actie),
          h('div', { class: 'veld' }, h('label', { for: `wis-status-${r.id}` }, 'Status van de actie'), status))
        : null,
      h('button', { type: 'button', class: 'knop', 'data-actie': 'verwijder', 'aria-label': `Verwijder regel ${r.id}`, onclick: () => { wissel.verwijderRegel(r.id); tekenLog(); na(); } }, 'Verwijder deze regel'));
  }
  function tekenLog() {
    const { regels } = wissel.leesInhoud();
    wis(log);
    if (regels.length === 0) log.append(h('li', { class: 'klein' }, 'Nog geen regels. Geef feedback op een wisselblok of plak feedback die je terugkrijgt.'));
    regels.forEach((r) => log.append(regelEl(r)));
  }

  // ---- regel zelf toevoegen, ook voor de post-its van andere teams (WS-6)
  const nieuw = (id, label, el) => h('div', { class: 'veld' }, h('label', { for: id }, label), el);
  const nRichting = h('select', { id: 'wis-nieuw-richting' }, [h('option', { value: 'ontvangen' }, 'ontvangen'), h('option', { value: 'gegeven' }, 'gegeven')]);
  const nRol = h('select', { id: 'wis-nieuw-rol' }, opties([...ROLLEN, ROL_ANDER_TEAM]));
  const nZie = h('input', { type: 'text', id: 'wis-nieuw-zie', autocomplete: 'off' });
  const nMis = h('input', { type: 'text', id: 'wis-nieuw-mis', autocomplete: 'off' });
  const nVraag = h('input', { type: 'text', id: 'wis-nieuw-vraag', autocomplete: 'off' });
  const nActie = h('input', { type: 'text', id: 'wis-nieuw-actie', autocomplete: 'off' });
  const nStatus = h('select', { id: 'wis-nieuw-status' }, opties(ACTIE_STATUSSEN));
  const nMelding = melding('wis-nieuw-melding');
  const voegToe = h('button', { type: 'button', class: 'knop', id: 'wis-voeg-toe', onclick: () => {
    const r = wissel.voegRegelToe({ richting: nRichting.value, rol: nRol.value, zie: nZie.value, mis: nMis.value, vraag: nVraag.value, actie: nActie.value, status: nStatus.value });
    if (!r.ok) { klaar(nMelding, r.fout, false); return; }
    [nZie, nMis, nVraag, nActie].forEach((v) => { v.value = ''; });
    klaar(nMelding, 'Regel toegevoegd.');
    tekenLog();
    na();
  } }, 'Voeg deze regel toe');
  const handmatig = h('details', { class: 'wis-handmatig' },
    h('summary', {}, 'Een regel zelf toevoegen (bijvoorbeeld een post-it van een ander team)'),
    nieuw('wis-nieuw-richting', 'Ontvangen of gegeven', nRichting), nieuw('wis-nieuw-rol', 'Rol van de gever of ontvanger (post-it van een ander team: ander team)', nRol),
    nieuw('wis-nieuw-zie', 'Ik zie…', nZie), nieuw('wis-nieuw-mis', 'Ik mis…', nMis), nieuw('wis-nieuw-vraag', 'Ik vraag me af…', nVraag),
    nieuw('wis-nieuw-actie', 'Actie (wat doe je hiermee?)', nActie), nieuw('wis-nieuw-status', 'Status van de actie', nStatus),
    voegToe, nMelding);

  // ---- teamactie (WS-6)
  let teamactie = null;
  if (metTeamactie) {
    const t0 = wissel.leesInhoud().teamactie;
    const tekst = h('input', { type: 'text', id: 'wis-teamactie', value: t0?.tekst ?? '', autocomplete: 'off' });
    const status = h('select', { id: 'wis-teamactie-status' }, opties(ACTIE_STATUSSEN));
    status.value = t0?.status ?? 'open';
    const zet = () => { wissel.zetTeamactie({ tekst: tekst.value, status: status.value }); na(); };
    tekst.addEventListener('change', zet);
    status.addEventListener('change', zet);
    teamactie = h('div', { class: 'wis-teamactie' },
      h('h4', {}, 'Wat pakt ons team op uit de post-its van andere teams?'),
      h('div', { class: 'veld' }, h('label', { for: 'wis-teamactie' }, 'Teamactie (één)'), tekst),
      h('div', { class: 'veld' }, h('label', { for: 'wis-teamactie-status' }, 'Status van de teamactie'), status));
  }

  const element = h('div', { class: 'wis-paneel' },
    h('p', { class: 'wis-privacy' }, wissel.privacytekst),
    h('section', { class: 'wis-stap' }, h('h3', {}, '1 · Stuur je wisselblok'),
      h('p', { class: 'klein' }, 'Je wisselblok bevat je onderzoeksvraag en je zoekvragen, zonder alias.'), eigen, h('div', { class: 'knoppen' }, kopieerKnop), eigenMelding),
    h('section', { class: 'wis-stap' }, h('h3', {}, '2 · Plak het wisselblok van je wisselpartner en geef feedback'),
      h('div', { class: 'veld' }, h('label', { for: 'wis-rol-blok' }, 'Wie is je wisselpartner?'), rolBlok),
      h('div', { class: 'veld' }, h('label', { for: 'wis-plak-blok' }, 'Het wisselblok van je wisselpartner'), plakBlok),
      h('div', { class: 'knoppen' }, bewaarBlok), blokMelding, blokken),
    h('section', { class: 'wis-stap' }, h('h3', {}, '3 · Plak de feedback die je terugkrijgt'),
      h('div', { class: 'veld' }, h('label', { for: 'wis-rol-fb' }, 'Van wie komt de feedback?'), rolFb),
      h('div', { class: 'veld' }, h('label', { for: 'wis-plak-fb' }, 'De feedback van je wisselpartner'), plakFb),
      h('div', { class: 'knoppen' }, bewaarFb), fbMelding),
    h('section', { class: 'wis-stap' }, h('h3', {}, 'Je feedbacklog'), statusRegel, herinnering, log, handmatig, teamactie));

  function ververs() { tekenEigen(); tekenBlokken(); tekenLog(); tekenHerinnering(); tekenStatus(); }
  ververs();
  return { element, ververs };
}
