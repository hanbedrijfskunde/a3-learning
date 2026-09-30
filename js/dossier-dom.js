// DOM-hulpen rond het dossier die op meer dan één pagina staan: downloaden (DS-5), de bewaarherinnering (DS-2)
// en de melding bij geblokkeerde opslag (DS-12). De regels zitten in dossier.js.
import { h, wis } from './dom.js';
import { maakDossier, bestandsnaam, registreerExport, herinnering, sluitHerinneringAf } from './dossier.js';

/** Laat de browser het dossier als JSON-bestand opslaan. Er gaat niets over het netwerk (PR-2). */
export function downloadDossier(dossier) {
  const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: bestandsnaam(dossier) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Knop die het dossier van deze opslag exporteert en de export onthoudt. `bijKlaar` krijgt het dossier. */
export function exportKnop(store, elearning, { tekst = 'Dossier exporteren (JSON)', bijKlaar } = {}) {
  const foutRegel = h('p', { class: 'fout', role: 'alert', hidden: true });
  const knop = h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'exporteer', onclick: async () => {
    try {
      const dossier = await maakDossier(store, { elearning });
      downloadDossier(dossier);
      registreerExport(store);
      foutRegel.hidden = true;
      if (bijKlaar) bijKlaar(dossier);
    } catch (e) {
      foutRegel.textContent = `Exporteren is niet gelukt (${e.message}).`;
      foutRegel.hidden = false;
    }
  } }, tekst);
  return h('div', {}, knop, foutRegel);
}

/** DS-12: melding dat de opslag is geblokkeerd, met direct een exportknop. */
export function geblokkeerdMelding(store, elearning) {
  return h('div', { class: 'dos-geblokkeerd kaart', id: 'opslag-geblokkeerd', role: 'alert' },
    h('p', { class: 'fout' }, 'Je browser blokkeert opslag (bijvoorbeeld in een privévenster). Wat je invult blijft alleen staan zolang deze pagina open is.'),
    h('p', {}, 'Exporteer je werk voordat je de pagina sluit of naar een andere pagina gaat. Dan kun je het later weer inlezen op de dossierpagina.'),
    exportKnop(store, elearning));
}

/** DS-2: toont in `gebied` de melding „bewaar je dossier" zodra er weer tien wijzigingen bij zijn (of niets). */
export function toonBewaarHerinnering(gebied, store, elearning) {
  wis(gebied);
  const r = herinnering(store);
  if (!r.tonen) return;
  gebied.append(h('div', { class: 'dos-herinnering kaart', role: 'status' },
    h('p', {}, h('strong', {}, 'Bewaar je dossier. '),
      `Je hebt ${r.ooitGeexporteerd ? `sinds je laatste export ${r.sindsExport}` : `al ${r.wijzigingen}`} wijzigingen gemaakt en je werk staat alleen in deze browser.`),
    h('div', { class: 'knoppen' },
      exportKnop(store, elearning, { bijKlaar: () => toonBewaarHerinnering(gebied, store, elearning) }),
      h('a', { class: 'knop', href: 'dossier.html' }, 'Naar het dossier'),
      h('button', { type: 'button', class: 'knop', 'data-actie': 'later', onclick: () => { sluitHerinneringAf(store); wis(gebied); } }, 'Later'))));
}
