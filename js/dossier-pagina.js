// Dossierpagina: Mijn stand (DS-11), dekking van de LUK (BW-13), export (DS-5, DS-6), afdrukbare pagina's (DS-7),
// import (DS-3, DS-4) en de melding bij geblokkeerde opslag (DS-12). Alleen DOM; de regels zitten in dossier.js.
import { h, wis, statusChip } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import {
  maakDossier, controleerDossier, importeerDossier, bouwMijnStand, bouwDekking, bouwLeeruitkomsten, bouwAfdruk, veldLabels, bouwFeedbackOverzicht,
} from './dossier.js';
import { leesRecords } from './sessie.js';
import { exportKnop, geblokkeerdMelding, toonBewaarHerinnering } from './dossier-dom.js';

const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();
const laadOptioneel = async (pad) => { try { const r = await fetch(new URL(pad, import.meta.url)); return r.ok ? await r.json() : null; } catch (e) { return null; } };

const cel = (c) => h('span', { class: 'dos-cel' }, statusChip(c.status, c.ontbreekt && !c.heeftRecord ? 'Ontbreekt' : c.statusTekst), c.voorlopig ? ' (voorlopig)' : '');

async function start() {
  const main = document.querySelector('#inhoud');
  const h1 = main.querySelector('h1');
  const [luk, config] = await Promise.all([laad('../data/luk.json'), laad('../data/config.json')]);
  const { opslag, geblokkeerd } = kiesOpslag();
  const store = maakStore(opslag);
  const alleIds = luk.bewijsonderdelen.map((b) => b.id);
  const records = () => leesRecords(store, alleIds);

  const herinneringGebied = h('div', { id: 'bewaarherinnering' });
  const standGebied = h('section', { id: 'mijn-stand', class: 'kaart', 'aria-labelledby': 'mijn-stand-kop' });
  const dekkingGebied = h('section', { id: 'dekking', 'aria-labelledby': 'dekking-kop' });
  const importUitkomst = h('div', { id: 'import-uitkomst', role: 'status' });
  const afdruk = h('section', { id: 'dos-afdruk', 'aria-label': 'Afdrukbaar dossier per leeruitkomst' });
  let laatsteDossier = null;

  // ---------------------------------------------------------------- Mijn stand (DS-11): alleen de status, groot

  function tekenStand() {
    wis(standGebied);
    standGebied.append(
      h('h2', { id: 'mijn-stand-kop' }, 'Mijn stand'),
      h('p', { class: 'klein' }, 'Per bewijsonderdeel alleen de status, zonder inhoud. Laat dit scherm gerust aan je coach zien.'),
      h('ul', { class: 'dos-stand' }, bouwMijnStand(luk, records()).map((c) => h('li', { class: `dos-tegel dos-tegel-${c.status.replace(' ', '-')}` },
        h('span', { class: 'dos-tegel-id' }, c.id),
        h('span', { class: 'dos-tegel-titel' }, c.titel),
        h('span', { class: 'dos-tegel-status' }, c.heeftRecord ? c.statusTekst : 'Nog niet', c.voorlopig ? ' (voorlopig)' : '')))));
  }

  // ---------------------------------------------------------------- dekking van de LUK (BW-13)

  function tekenDekking() {
    wis(dekkingGebied);
    const rijen = bouwDekking(luk, records());
    dekkingGebied.append(
      h('h2', { id: 'dekking-kop' }, 'Wat de e-learning van de leeruitkomsten dekt'),
      h('p', {}, 'Gedekt: er is een bewijsonderdeel voor. Deels: de e-learning oefent een stap ervan. Buiten scope: valt niet in deze e-learning. De status is de jouwe; er is geen score.'),
      h('div', { class: 'dos-tabelwrap' }, h('table', { class: 'dos-tabel', id: 'dekkingstabel' },
        h('caption', { class: 'dos-caption' }, `${rijen.length} onderdelen van de leeruitkomsten`),
        h('thead', {}, h('tr', {}, ['Onderdeel van de leeruitkomst', 'Dekking', 'Bewijs en jouw status'].map((k) => h('th', { scope: 'col' }, k)))),
        h('tbody', {}, rijen.map((r) => h('tr', { 'data-dekking': r.dekking },
          h('th', { scope: 'row' }, r.label),
          h('td', {}, r.dekking, r.toelichting ? h('span', { class: 'klein' }, ` (${r.toelichting})`) : null),
          h('td', {}, r.bewijs.length === 0 ? '–' : h('ul', { class: 'dos-lijst' }, r.bewijs.map((c) => h('li', {}, `${c.id} · `, cel(c)))))))))));
  }

  // ---------------------------------------------------------------- feedback uit de Wissel (WS-6): individueel naast andere teams

  const regelEl = (r) => h('li', { class: 'fb-regel', 'data-rol': r.rol },
    h('strong', {}, r.rol), ': ',
    [['Ik zie', r.zie], ['Ik mis', r.mis], ['Ik vraag me af', r.vraag]].filter(([, t]) => t).map(([k, t]) => h('span', { class: 'fb-deel' }, `${k}: ${t}. `)),
    r.actie ? h('span', { class: 'klein' }, ` Actie: ${r.actie} (${r.status})`) : null);
  const feedbackGebied = h('section', { id: 'feedback', 'aria-labelledby': 'feedback-kop' });
  function tekenFeedback() {
    wis(feedbackGebied);
    const f = bouwFeedbackOverzicht(records()['EV-09']);
    const lijst = (regels, leegTekst) => (regels.length ? h('ul', { class: 'fb-lijst' }, regels.map(regelEl)) : h('p', { class: 'klein' }, leegTekst));
    feedbackGebied.append(h('h2', { id: 'feedback-kop' }, 'Feedback uit de Wissel (EV-09)'));
    if (f.leeg) { feedbackGebied.append(h('p', { class: 'klein' }, 'Nog geen feedback vastgelegd. Dat doe je in leerblok 4.')); return; }
    feedbackGebied.append(h('div', { class: 'fb-kolommen' },
      h('div', { class: 'kaart', id: 'fb-individueel' },
        h('h3', {}, 'Individuele feedback'),
        h('h4', {}, 'Ontvangen'), lijst(f.individueel.ontvangen, 'Nog niets ontvangen.'),
        h('h4', {}, 'Gegeven'), lijst(f.individueel.gegeven, 'Nog niets gegeven.')),
      h('div', { class: 'kaart', id: 'fb-ander-team' },
        h('h3', {}, 'Post-its van andere teams'),
        lijst(f.anderTeam, 'Nog geen post-its van andere teams.'),
        h('h4', {}, 'Teamactie'),
        f.teamactie ? h('p', { id: 'fb-teamactie' }, `${f.teamactie.tekst} (${f.teamactie.status})`) : h('p', { class: 'klein' }, 'Nog geen teamactie.'))));
  }

  // ---------------------------------------------------------------- export (DS-5, DS-6) en afdrukbaar (DS-7)

  async function maakAfdruk() {
    laatsteDossier = await maakDossier(store, { elearning: config.versie });
    // Veldlabels alleen uit leerblokken waarin de student records heeft; die bestaan dus (geen 404 in de console).
    const nummers = [...new Set(laatsteDossier.records.map((r) => r.record.leerblok))];
    const labels = veldLabels(await Promise.all(nummers.map((n) => laadOptioneel(`../data/leerblok-${n}.json`))));
    wis(afdruk);
    afdruk.append(h('div', { class: 'knoppen dos-werkbalk' },
      h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'afdrukken', onclick: () => window.print() }, 'Afdrukken'),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'terug', onclick: () => toonAfdruk(false) }, 'Terug naar het dossier')));
    for (const p of bouwAfdruk(laatsteDossier, luk, labels)) {
      afdruk.append(h('article', { class: 'dos-pagina', 'data-luk': p.luk },
        h('h2', {}, `Bewijsdossier ${p.titel}`),
        h('p', { class: 'meta' }, `Student: ${p.alias || '(geen alias)'} · Team: ${p.teamnummer || '(geen teamnummer)'} · Geëxporteerd: ${p.geexporteerd} · E-learning ${p.elearning}`),
        p.onderdelen.map((o) => h('section', { class: 'dos-onderdeel', 'data-ev': o.id },
          h('h3', {}, `${o.id} · ${o.titel}`),
          h('p', {}, 'Status: ', statusChip(o.status, o.heeftRecord ? o.statusTekst : 'Nog niet'), o.voorlopig ? ' (voorlopig)' : '',
            o.versie ? ` · versie ${o.versie}, bijgewerkt ${o.bijgewerkt}` : ' · nog geen inhoud'),
          o.velden.length ? h('dl', { class: 'dos-velden' }, o.velden.flatMap((v) => [h('dt', {}, v.label), h('dd', {}, v.waarde)])) : null)),
        h('p', { class: 'dos-controlesom' }, h('strong', {}, 'Controlesom (SHA-256): '), h('code', {}, p.controlesom))));
    }
  }
  const toonAfdruk = async (aan) => {
    if (aan) await maakAfdruk();
    document.body.classList.toggle('dos-afdrukmodus', aan);
    if (aan) window.scrollTo(0, 0);
  };

  const exportGebied = h('section', { id: 'exporteren', class: 'kaart', 'aria-labelledby': 'export-kop' },
    h('h2', { id: 'export-kop' }, 'Dossier bewaren'),
    h('p', {}, 'Het bestand bevat je bewijsonderdelen (de nieuwste versie en hoeveel eerdere versies er waren), je alias, je teamnummer en de versie van de e-learning, met een controlesom. Het gaat nergens naartoe: de browser slaat het op je eigen apparaat op.'),
    h('div', { class: 'knoppen' }, exportKnop(store, config.versie),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'afdruk-tonen', onclick: () => toonAfdruk(true) }, 'Afdrukbare pagina’s per leeruitkomst')));

  // ---------------------------------------------------------------- import (DS-3, DS-4)

  async function neemOver(tekst, { toch = false } = {}) {
    wis(importUitkomst);
    const u = await controleerDossier(tekst);
    if (u.status === 'ongeldig') {
      importUitkomst.append(h('p', { class: 'fout', role: 'alert' }, `Importeren is niet gelukt: ${u.reden}`));
      return;
    }
    if (u.recordFouten.length) {
      importUitkomst.append(h('p', { class: 'fout', role: 'alert' }, 'Dit dossier bevat ongeldige records en is niet ingelezen:'),
        h('ul', {}, u.recordFouten.map((f) => h('li', {}, f))));
      return;
    }
    if (u.status === 'gewijzigd' && !toch) {
      importUitkomst.append(h('p', { class: 'fout', role: 'alert' }, `Dit bestand is gewijzigd na export (${u.reden}) en is nog niet ingelezen.`),
        h('button', { type: 'button', class: 'knop', 'data-actie': 'toch-importeren', onclick: () => neemOver(tekst, { toch: true }) }, 'Toch importeren'));
      return;
    }
    const r = importeerDossier({ store, opslag }, u.dossier);
    importUitkomst.append(h('p', { class: 'compleet' }, `Ingelezen: ${r.overgenomen.length} bewijsonderdelen overgenomen, ${r.gelijk.length} al gelijk, ${r.behouden.length} behouden omdat je huidige versie nieuwer is.`),
      r.profiel.length ? h('p', { class: 'klein' }, 'Ook overgenomen uit je profiel: alias, teamnummer of vraagstuk waar je nog niets had ingevuld.') : "");
    tekenAlles();
  }
  const bestandVeld = h('input', { type: 'file', id: 'import-bestand', accept: '.json,application/json', onchange: async (e) => {
    const bestand = e.target.files[0];
    if (bestand) await neemOver(await bestand.text());
    e.target.value = '';
  } });
  const importGebied = h('section', { id: 'importeren', class: 'kaart', 'aria-labelledby': 'import-kop' },
    h('h2', { id: 'import-kop' }, 'Dossier terugzetten'),
    h('p', {}, 'Een eerder geëxporteerd dossier lees je hier weer in, bijvoorbeeld in een andere browser. Bij een bewijsonderdeel dat je hier al hebt, wint de nieuwste versie. Wat je in een oefening of als „klaar” hebt ingevuld zit niet in het dossier en komt niet terug.'),
    h('label', { for: 'import-bestand' }, 'Kies je dossierbestand (.json)'), bestandVeld, importUitkomst);

  // ---------------------------------------------------------------- pagina

  const luks = h('section', { id: 'leeruitkomsten', 'aria-labelledby': 'luks-kop' });
  function tekenLuks() {
    wis(luks);
    luks.append(h('h2', { id: 'luks-kop' }, 'Per leeruitkomst'),
      h('ul', { class: 'dos-lijst' }, bouwLeeruitkomsten(luk, records()).map((l) => h('li', { 'data-luk': l.luk },
        `Leeruitkomst ${l.luk}: `, statusChip(l.status, l.statusTekst), ` (${l.aantalCompleet} van ${l.totaal} bewijsonderdelen compleet${l.ontbreekt.length ? `; ontbreekt: ${l.ontbreekt.join(', ')}` : ''})`))));
  }

  function tekenAlles() {
    tekenStand(); tekenLuks(); tekenFeedback(); tekenDekking();
    toonBewaarHerinnering(herinneringGebied, store, config.versie);
  }
  tekenAlles();

  main.append(...[
    h1,
    h('p', {}, 'Hier zie je waar je staat, bewaar je je werk en zet je het terug. Je dossier is wat je inlevert en wat je docent nakijkt.'),
    geblokkeerd ? geblokkeerdMelding(store, config.versie) : null,
    herinneringGebied, standGebied, luks, feedbackGebied, dekkingGebied, exportGebied, importGebied, afdruk,
  ].filter(Boolean));
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
