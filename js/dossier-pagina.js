// Dossierpagina: Mijn stand (DS-11), dekking van de LUK (BW-13), export (DS-5, DS-6), afdrukbare pagina's (DS-7),
// import (DS-3, DS-4) en de melding bij geblokkeerde opslag (DS-12). Alleen DOM; de regels zitten in dossier.js.
import { h, wis, statusChip } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import {
  maakDossier, controleerDossier, importeerDossier, bouwMijnStand, bouwDekking, bouwLeeruitkomsten, bouwAfdruk, veldLabels, bouwFeedbackOverzicht,
  zwaksteOnderdeel, bouwTweeZinnen, bouwVersieVergelijking, leesVerdiepingGedaan,
} from './dossier.js';
import { leesProfiel } from './profiel.js';
import { waardeTekst } from './weergave.js';
import { maakA3Tekst } from './a3tekst.js';
import { leesKopieLog, logKopie } from './a3log.js';
import { leesRecords } from './afgerond.js';
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
    const stand = bouwMijnStand(luk, records());
    const zwakste = zwaksteOnderdeel(stand);
    standGebied.append(
      h('h2', { id: 'mijn-stand-kop' }, 'Mijn stand'),
      h('p', { class: 'klein' }, 'Per bewijsonderdeel alleen de status, zonder inhoud. Laat dit scherm gerust aan je coach zien.'),
      h('p', { class: 'zwakste', id: 'zwakste-onderdeel' }, h('strong', {}, 'Zwakste onderdeel: '),
        zwakste ? [`${zwakste.id} · ${zwakste.titel} (`, statusChip(zwakste.status, zwakste.heeftRecord ? zwakste.statusTekst : 'Nog niet'), ')'] : 'geen: alle bewijsonderdelen zijn compleet.'),
      h('ul', { class: 'dos-stand' }, stand.map((c) => h('li', { class: `dos-tegel dos-tegel-${c.status.replace(' ', '-')}` },
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

  // ---------------------------------------------------------------- twee zinnen naast elkaar (TK-11) en verdieping gedaan (TK-14)

  const zinnenGebied = h('section', { id: 'twee-zinnen', class: 'kaart', 'aria-labelledby': 'twee-zinnen-kop' });
  function tekenZinnen() {
    wis(zinnenGebied);
    const z = bouwTweeZinnen(store);
    const gedaan = leesVerdiepingGedaan(store);
    zinnenGebied.append(
      h('h2', { id: 'twee-zinnen-kop' }, 'Waarom je begon en wat het je opleverde'),
      h('div', { class: 'fb-kolommen' },
        h('div', { id: 'zin-waarom' }, h('h3', {}, 'Waarom (leerblok 1)'), h('p', {}, z.waarom || 'Je hebt nog geen waarom-zin ingevuld op de startpagina.')),
        h('div', { id: 'zin-nut' }, h('h3', {}, 'Wat ik hiermee aan mijn A3 heb (leerblok 4)'), h('p', {}, z.nut || 'Die zin schrijf je aan het eind van leerblok 4.'))),
      h('p', { class: 'klein', id: 'verdieping-gedaan' }, gedaan.length ? `Verdieping gedaan: leerblok ${gedaan.join(', ')}. Dat heeft geen invloed op je status.` : 'Je hebt nog geen verdieping als gedaan gemarkeerd. Verdieping is optioneel.'));
  }

  // ---------------------------------------------------------------- kopieer naar A3 vak 1 (LB-16, LB-17, VB-8)

  const a3Gebied = h('section', { id: 'a3-vak1', class: 'kaart', 'aria-labelledby': 'a3-kop' });
  const a3Melding = h('p', { role: 'status', class: 'klein', id: 'a3-melding' });
  const kopieer = async (tekst) => {
    try {
      await navigator.clipboard.writeText(tekst);
    } catch (e) {
      const ta = h('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;left:-9999px' });
      ta.value = tekst;
      document.body.append(ta);
      ta.select();
      const gelukt = document.execCommand?.('copy');
      ta.remove();
      if (!gelukt) throw e;
    }
  };
  function tekenA3() {
    wis(a3Gebied);
    const blok = maakA3Tekst({ records: leesRecords(store, ['EV-01', 'EV-02', 'EV-08', 'EV-11']), profiel: leesProfiel(store) });
    a3Gebied.append(
      h('h2', { id: 'a3-kop' }, 'Kopieer naar A3 vak 1'),
      h('p', {}, 'Eén klik zet je onderzoeksvraag, zoekvragen, de plaatsing van je vraagstuk en je waarom-zin (en de verbanden uit leerblok 4, als je ze hebt) als tekst op het klembord. Plak ze in vak 1 van de A3 van je team. Er gaat niets over het netwerk.'),
      h('pre', { class: 'a3-blok', id: 'a3-tekst', tabindex: '0', 'aria-label': 'Voorbeeld van het tekstblok voor vak 1' }, blok.tekst),
      h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'kopieer-a3', onclick: async () => {
        try {
          await kopieer(blok.tekst);
          logKopie(store);
          a3Melding.textContent = `Gekopieerd: ${blok.delen.length} onderdelen staan op je klembord.`;
        } catch (e) {
          a3Melding.textContent = 'Kopiëren is niet gelukt. Selecteer de tekst hierboven en kopieer hem zelf (Ctrl+C).';
        }
        tekenA3Log();
      } }, 'Kopieer naar A3 vak 1')),
      a3Melding,
      h('div', { id: 'a3-log' }));
    tekenA3Log();
  }
  function tekenA3Log() {
    const gebied = a3Gebied.querySelector('#a3-log');
    if (!gebied) return;
    wis(gebied);
    const log = leesKopieLog(store);
    gebied.append(h('h3', {}, 'Wanneer je kopieerde'),
      log.length ? h('ul', { class: 'dos-lijst' }, log.map((d) => h('li', {}, new Date(d).toLocaleString('nl-NL')))) : h('p', { class: 'klein' }, 'Je hebt nog niet gekopieerd.'));
  }

  // ---------------------------------------------------------------- voorlopig en opnieuw gedaan: oud en nieuw naast elkaar (ST-3, ST-5)

  const versieGebied = h('section', { id: 'versies' });
  async function tekenVersies() {
    const p = leesProfiel(store);
    const paren = bouwVersieVergelijking(store);
    const voorlopigeIds = alleIds.filter((id) => records()[id]?.voorlopig === true);
    wis(versieGebied);
    if (!p.voorlopig && paren.length === 0 && voorlopigeIds.length === 0) return;
    versieGebied.append(h('h2', { id: 'versies-kop' }, 'Voorlopig vraagstuk en opnieuw gedaan'));
    if (p.voorlopig || voorlopigeIds.length) {
      versieGebied.append(h('p', { id: 'voorlopig-label' }, `Je werkt met een voorlopig vraagstuk: je bewijs krijgt het label voorlopig${voorlopigeIds.length ? ` (nu: ${voorlopigeIds.join(', ')})` : ''}. Bij elk onderdeel in het leerblok staat een knop Opnieuw doen zodra je vraagstuk scherp is.`));
    }
    if (paren.length === 0) return;
    const nummers = [...new Set(paren.map((x) => x.nieuw.leerblok))];
    const labels = veldLabels(await Promise.all(nummers.map((n) => laadOptioneel(`../data/leerblok-${n}.json`))));
    const kolom = (titel, r) => h('div', { class: 'kaart', 'data-versie': r.versie },
      h('h4', {}, `${titel} (versie ${r.versie}${r.voorlopig ? ', voorlopig' : ''})`),
      h('p', { class: 'klein' }, `Bijgewerkt: ${new Date(r.bijgewerkt).toLocaleString('nl-NL')} · status ${STATUS_LABEL(r.status)}`),
      Object.keys(r.inhoud).length === 0 ? h('p', { class: 'klein' }, 'Leeg: dit onderdeel is opnieuw begonnen.')
        : h('dl', { class: 'dos-velden' }, Object.entries(r.inhoud).flatMap(([k, w]) => [h('dt', {}, labels[r.id]?.[k] ?? k), h('dd', {}, waardeTekst(w))])));
    for (const { id, oud, nieuw } of paren) {
      versieGebied.append(h('div', { class: 'versie-paar', 'data-ev': id }, h('h3', {}, id), h('div', { class: 'versie-kolommen' }, kolom('Oude versie', oud), kolom('Nieuwe versie', nieuw))));
    }
  }
  const STATUS_LABEL = (st) => ({ compleet: 'Compleet', bijna: 'Bijna', 'nog niet': 'Nog niet' })[st] ?? st;

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
    tekenStand(); tekenLuks(); tekenFeedback(); tekenDekking(); tekenZinnen(); tekenA3();
    tekenVersies();
    toonBewaarHerinnering(herinneringGebied, store, config.versie);
  }
  tekenAlles();

  main.append(...[
    h1,
    h('p', {}, 'Hier zie je waar je staat, bewaar je je werk en zet je het terug. Je dossier is wat je inlevert en wat je docent nakijkt.'),
    geblokkeerd ? geblokkeerdMelding(store, config.versie) : null,
    herinneringGebied, standGebied, luks, zinnenGebied, a3Gebied, versieGebied, feedbackGebied, dekkingGebied, exportGebied, importGebied, afdruk,
  ].filter(Boolean));
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
