// Het scherm „Vorige keer" (TP-11) aan het begin van leerblok 2 tot en met 4: 1 dossiercontrole met zo nodig een
// importaanbod (TP-9), 2 de terugblik met de meenemen-kaart (TP-2, TP-3, TP-7), 3 de transfervraag (TP-4).
// Alleen DOM; de regels zitten in terugblik.js. Niets hierin blokkeert het leerblok eronder (TP-10, TP-5).
import { h, wis, bestandKiezer } from './dom.js';
import { maakTerugblik, dossierControle } from './terugblik.js';
import { controleerDossier, importeerDossier, veldLabels } from './dossier.js';

const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();
const laadOptioneel = async (pad) => { try { const r = await fetch(new URL(pad, import.meta.url)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
const IMPORT_MELDING = 'terugblik:importmelding';

/**
 * @param {object} p
 * @param {ReturnType<import('./store.js').maakStore>} p.store
 * @param {object} p.opslag de browseropslag, voor het importeren van een dossier
 * @param {object} p.overzicht data/leerblokken.json
 * @param {number} p.leerblok 2, 3 of 4
 * @param {() => Date} [p.nu]
 * @param {() => void} [p.naImport] wordt na een geslaagde import aangeroepen (de pagina laadt dan opnieuw)
 * @returns {Promise<HTMLElement>}
 */
export async function vorigeKeerSectie({ store, opslag, overzicht, leerblok, nu = () => new Date(), naImport = () => location.reload() }) {
  let terugblik; let luk;
  try {
    [terugblik, luk] = await Promise.all([laad('../data/terugblik.json'), laad('../data/luk.json')]);
  } catch (e) {
    return h('section', { class: 'kaart', id: 'vorige-keer' }, h('p', { class: 'fout', role: 'alert' }, `De terugblik kon niet worden geladen (${e.message}). Je kunt gewoon doorwerken.`));
  }
  const titels = Object.fromEntries(luk.bewijsonderdelen.map((b) => [b.id, b.titel]));
  // Veldlabels alleen uit het vorige leerblok als de student daar records heeft; dat bestand bestaat dan (geen 404).
  const vorig = leerblok - 1;
  const richttijd = overzicht.leerblokken.find((b) => b.nummer === leerblok)?.richttijd; // B118: de som van de taken
  const heeftWerk = (overzicht.leerblokken.find((b) => b.nummer === vorig)?.bewijsonderdelen ?? []).some((id) => store.get(id));
  const labels = heeftWerk ? veldLabels([await laadOptioneel(`../data/leerblok-${vorig}.json`)]) : {};
  const tb = maakTerugblik({ store, terugblik, overzicht, leerblok, nu, titels, labels });

  const kop = h('p', { class: 'meta', id: 'tb-kop' });
  const statusRegel = h('p', { class: 'klein', role: 'status', id: 'tb-status' });

  // ------------------------------------------------------------ 1 · dossiercontrole (TP-9)
  const dossierGebied = h('section', { class: 'tb-onderdeel', 'data-onderdeel': 'dossiercontrole', 'aria-labelledby': 'tb-dossier-kop' });
  const importUitkomst = h('div', { id: 'tb-import-uitkomst', role: 'status' });
  async function neemOver(tekst, { toch = false } = {}) {
    wis(importUitkomst);
    const u = await controleerDossier(tekst);
    if (u.status === 'ongeldig') { importUitkomst.append(h('p', { class: 'fout', role: 'alert' }, `Importeren is niet gelukt: ${u.reden}`)); return; }
    if (u.recordFouten.length) {
      importUitkomst.append(h('p', { class: 'fout', role: 'alert' }, 'Dit dossier bevat ongeldige records en is niet ingelezen:'), h('ul', {}, u.recordFouten.map((f) => h('li', {}, f))));
      return;
    }
    if (u.status === 'gewijzigd' && !toch) {
      importUitkomst.append(h('p', { class: 'fout', role: 'alert' }, `Dit bestand is gewijzigd na export (${u.reden}) en is nog niet ingelezen.`),
        h('button', { type: 'button', class: 'knop', 'data-actie': 'toch-importeren', onclick: () => neemOver(tekst, { toch: true }) }, 'Toch importeren'));
      return;
    }
    const r = importeerDossier({ store, opslag }, u.dossier);
    store.setMeta(IMPORT_MELDING, `Ingelezen: ${r.overgenomen.length} resultaten overgenomen, ${r.gelijk.length} al gelijk, ${r.behouden.length} behouden omdat je huidige versie nieuwer is.`);
    naImport();
  }
  function tekenDossier() {
    const c = dossierControle({ store, overzicht, leerblok, titels });
    wis(dossierGebied);
    dossierGebied.append(h('h3', { id: 'tb-dossier-kop' }, '1 · Dossiercontrole'));
    const melding = store.getMeta(IMPORT_MELDING);
    if (melding) { dossierGebied.append(h('p', { class: 'compleet', role: 'status' }, melding)); store.verwijderMeta(IMPORT_MELDING); }
    if (!c.importAanbod) {
      dossierGebied.append(h('p', {}, `Je dossier is aanwezig: alle ${c.verwacht} resultaten van eerdere leerblokken staan in deze browser.`));
      return;
    }
    dossierGebied.append(
      h('p', { class: c.aanwezig ? '' : 'fout', role: c.aanwezig ? undefined : 'alert' },
        c.aanwezig ? 'In deze browser ontbreken resultaten van eerdere leerblokken:' : 'Er staat geen dossier in deze browser. Heb je eerder gewerkt en je dossier bewaard? Lees het hier weer in. Onderdelen die ontbreken:'),
      h('ul', { class: 'tb-ontbrekend' }, c.ontbrekend.map((o) => h('li', { 'data-ev': o.id }, `${o.titel} (leerblok ${o.leerblok})`))),
      bestandKiezer({ id: 'tb-import-bestand', titel: 'Kies je dossierbestand', bijKeuze: async ([b]) => neemOver(await b.text()) }),
      importUitkomst,
      h('p', { class: 'klein' }, 'Je kunt ook gewoon doorwerken; dit blokkeert niets. Zie ', h('a', { href: 'dossier.html' }, 'het dossier'), ' voor het terugzetten en bewaren.'));
  }

  // ------------------------------------------------------------ 2 · terugblik en kaart (TP-2, TP-3, TP-7)
  const m0 = tb.model();
  const puntenVeld = h('textarea', { id: 'tb-punten', rows: 4, oninput: () => bijOphalen() });
  puntenVeld.value = m0.ophalen.puntenTekst;
  const kvVelden = [0, 1].map((i) => h('input', { type: 'text', id: `tb-kv-${i}`, autocomplete: 'off', oninput: () => bijOphalen() }));
  kvVelden.forEach((v, i) => { v.value = m0.ophalen.kennisvragen[i]?.antwoord ?? ''; });
  const ophalenGebied = h('div', { id: 'tb-ophalen' });
  const hintGebied = h('p', { class: 'klein', role: 'status', id: 'tb-hint' });
  const kaartGebied = h('div', { id: 'tb-kaart', 'aria-live': 'polite' });
  const terugblikGebied = h('section', { class: 'tb-onderdeel', 'data-onderdeel': 'terugblik', 'aria-labelledby': 'tb-terugblik-kop' });

  // ------------------------------------------------------------ 3 · transfervraag (TP-4)
  const zinVelden = [0, 1].map((i) => h('input', { type: 'text', id: `tb-zin-${i}`, autocomplete: 'off', oninput: () => bijTransfer() }));
  const itemGebied = h('div', { id: 'tb-items' });
  const transferHint = h('p', { class: 'klein', role: 'status', id: 'tb-transfer-hint' });
  const transferInhoud = h('div', { id: 'tb-transfer-inhoud' });
  const transferGebied = h('section', { class: 'tb-onderdeel', 'data-onderdeel': 'transfer', 'aria-labelledby': 'tb-transfer-kop' });

  const leesItem = () => itemGebied.querySelector('input[name="tb-item"]:checked')?.value ?? '';
  const bijOphalen = () => { tb.zetOphalen({ punten: puntenVeld.value, antwoorden: kvVelden.map((v) => v.value) }); teken(); };
  const bijTransfer = () => { tb.zetTransfer({ item: leesItem(), zinnen: zinVelden.map((v) => v.value) }); teken(); };

  function tekenKaart(m) {
    wis(kaartGebied);
    if (!m.kaart) return;
    const k = m.kaart;
    kaartGebied.append(h('div', { class: 'kaart tb-kaart' },
      h('h4', {}, `Meenemen uit leerblok ${m.vorig}`),
      h('ul', { class: 'tb-items-lijst' }, k.items.map((i) => h('li', {}, i))),
      k.samenvatting ? h('div', { class: 'tb-samenvatting' }, h('h5', {}, `Samenvatting van leerblok ${m.vorig}`), h('p', {}, k.samenvatting)) : null,
      h('h5', {}, `Jouw bewijsstukken uit leerblok ${m.vorig}`),
      k.eigenBewijs.map((b) => h('div', { class: 'tb-bewijs', 'data-ev': b.id },
        h('strong', {}, b.titel),
        b.velden.length
          ? h('dl', { class: 'dos-velden' }, b.velden.flatMap((v) => [h('dt', {}, v.label), h('dd', {}, v.waarde)]))
          : h('p', { class: 'klein' }, b.heeftRecord ? 'Dit bewijsstuk is nog leeg.' : 'Hier heb je in deze browser nog niets van.')))));
  }

  function tekenTerugblik(m) {
    wis(terugblikGebied);
    terugblikGebied.append(h('h3', { id: 'tb-terugblik-kop' }, '2 · Terugblik'));
    const e = m.ophalen.eis;
    if (m.status === 'overgeslagen') {
      terugblikGebied.append(h('p', {}, 'Je hebt de terugblik overgeslagen met „ik weet het nog”. Dat heeft geen gevolgen voor je bewijs.'),
        h('button', { type: 'button', class: 'knop', id: 'tb-opnieuw', 'data-actie': 'toch-doen', onclick: () => { tb.opnieuw(); nogEens(); } }, 'Toch de terugblik doen'));
    } else {
      terugblikGebied.append(h('p', {}, m.omschrijving, ` ± ${m.minuten} min.`));
      if (e.punten === 0 && e.kennisvragen === 0) {
        terugblikGebied.append(h('p', {}, 'Bij zo’n korte pauze is er geen ophaalvraag. Ga door naar de transfervraag.'));
      } else {
        wis(ophalenGebied);
        ophalenGebied.append(h('p', {}, 'Schrijf eerst uit het hoofd op wat je nog weet van het vorige leerblok. De meenemen-kaart met de antwoorden staat hierna.'));
        if (e.punten > 0) ophalenGebied.append(h('div', { class: 'veld' }, h('label', { for: 'tb-punten' }, `Wat weet je nog? Minstens ${e.punten} punten, elk op een nieuwe regel`), puntenVeld));
        m.ophalen.kennisvragen.forEach((k, i) => ophalenGebied.append(h('div', { class: 'veld' }, h('label', { for: `tb-kv-${i}` }, `Kennisvraag ${i + 1}: ${k.vraag}`), kvVelden[i])));
        terugblikGebied.append(ophalenGebied, hintGebied);
      }
      if (m.status === 'gedaan') terugblikGebied.append(h('p', { class: 'compleet' }, 'Terugblik gedaan.'));
      terugblikGebied.append(h('div', { class: 'knoppen' },
        h('button', { type: 'button', class: 'knop', id: 'tb-weet-het-nog', 'data-actie': 'weet-het-nog', onclick: () => { tb.weetHetNog(); teken(); } }, 'Ik weet het nog'),
        m.status === 'gedaan' ? h('button', { type: 'button', class: 'knop', id: 'tb-opnieuw', 'data-actie': 'opnieuw', onclick: () => { tb.opnieuw(); nogEens(); } }, 'Terugblik opnieuw doen') : null));
    }
    terugblikGebied.append(kaartGebied);
  }

  function tekenTransfer(m) {
    wis(transferGebied);
    transferGebied.append(h('h3', { id: 'tb-transfer-kop' }, '3 · Waar gebruik je dit nu?'));
    const t = m.transfer;
    if (m.status === 'overgeslagen') { transferGebied.append(h('p', { class: 'klein' }, 'Overgeslagen met „ik weet het nog”.')); return; }
    if (!t.zichtbaar) {
      transferGebied.append(h('p', { class: 'klein' }, m.kaartZichtbaar || m.band === 'volledig' || m.band === 'lang'
        ? 'Eerst het ophalen, dan de kaart, dan deze vraag.' : 'Beantwoord eerst de kennisvraag hierboven.'));
      return;
    }
    if (itemGebied.childElementCount === 0) {
      itemGebied.append(h('fieldset', { class: 'veld' }, h('legend', {}, 'Kies één item als startpunt van dit leerblok'),
        t.items.map((it, i) => h('div', { class: 'optie' },
          h('input', { type: 'radio', name: 'tb-item', id: `tb-item-${i}`, value: it, checked: it === t.item, onchange: () => bijTransfer() }),
          h('label', { for: `tb-item-${i}` }, it)))));
    }
    zinVelden.forEach((v, i) => { if (document.activeElement !== v) v.value = t.zinnen[i]; });
    transferGebied.append(h('p', {}, t.vraag), itemGebied,
      h('div', { class: 'veld' }, h('label', { for: 'tb-zin-0' }, 'Zin 1'), zinVelden[0]),
      h('div', { class: 'veld' }, h('label', { for: 'tb-zin-1' }, 'Zin 2'), zinVelden[1]), transferHint);
    transferHint.textContent = t.geldig ? '' : 'Kies een item en schrijf twee zinnen van minstens drie woorden.';
  }

  function tekenKop(m) {
    kop.textContent = `${m.pauzeTekst} Terugblik: ongeveer ${m.minuten} min, bovenop de ${richttijd} min van het leerblok.`;
    statusRegel.textContent = { open: 'Terugblik: nog bezig.', gedaan: 'Terugblik: gedaan.', overgeslagen: 'Terugblik: overgeslagen.' }[m.status];
  }

  let vormen = {};
  /** Bouwt alleen opnieuw op wat van vorm verandert, zodat een invoerveld tijdens het typen de focus houdt. */
  function teken() {
    const m = tb.model();
    tekenKop(m);
    const nieuw = { terugblik: `${m.status}|${m.band}`, kaart: `${m.status}|${m.band}|${m.kaartZichtbaar}`, transfer: `${m.status === 'overgeslagen'}|${m.band}|${m.transfer.zichtbaar}` };
    if (nieuw.terugblik !== vormen.terugblik) tekenTerugblik(m);
    if (nieuw.terugblik !== vormen.terugblik || nieuw.kaart !== vormen.kaart) tekenKaart(m);
    if (nieuw.transfer !== vormen.transfer) tekenTransfer(m);
    vormen = nieuw;
    const n = m.ophalen.nog;
    hintGebied.textContent = m.status === 'open' && !m.ophalen.klaar
      ? [n.punten > 0 ? `Nog ${n.punten} ${n.punten === 1 ? 'punt' : 'punten'}` : '', n.kennisvragen > 0 ? `nog ${n.kennisvragen} ${n.kennisvragen === 1 ? 'kennisvraag' : 'kennisvragen'} te beantwoorden` : ''].filter(Boolean).join(', ') + '.'
      : '';
    transferHint.textContent = m.transfer.geldig ? '' : 'Kies een item en schrijf twee zinnen van minstens drie woorden.';
  }
  /** Na „opnieuw": velden leegmaken en alles opbouwen. */
  function nogEens() {
    puntenVeld.value = ''; kvVelden.forEach((v) => { v.value = ''; }); zinVelden.forEach((v) => { v.value = ''; }); wis(itemGebied);
    vormen = {};
    teken();
  }

  tekenDossier();
  teken();

  return h('section', { class: 'kaart vorige-keer', id: 'vorige-keer', 'aria-labelledby': 'vorige-keer-kop' },
    h('h2', { id: 'vorige-keer-kop' }, 'Vorige keer'), kop, statusRegel, dossierGebied, terugblikGebied, transferGebied);
}
