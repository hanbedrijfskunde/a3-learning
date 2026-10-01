// Verificatiepagina voor de docent: leest één of meer dossiers lokaal in, herberekent de controlesom (DS-8) en toont een
// tabel per student (DS-9). Deze pagina doet geen enkel verzoek met dossiergegevens (DS-10, PR-2): bestanden worden met
// file.text() in de browser gelezen en nergens naartoe gestuurd; de enige verzoeken zijn de GET's van data/luk.json.
import { h, wis, statusChip, bestandKiezer } from './dom.js';
import { controleerDossier, bouwVerificatie } from './dossier.js';

async function start() {
  const main = document.querySelector('#inhoud');
  const luk = await (await fetch(new URL('../data/luk.json', import.meta.url))).json();
  const h1 = main.querySelector('h1');
  wis(main);

  const uitkomsten = h('section', { id: 'ver-uitkomsten', 'aria-live': 'polite' });
  const tabelGebied = h('section', { id: 'ver-tabel-gebied' });
  const resultaten = [];

  const status = (c) => h('td', { class: `ver-cel ver-${c.status.replace(' ', '-')}` },
    statusChip(c.status, c.heeftRecord ? c.statusTekst : 'Ontbreekt'), c.voorlopig ? h('span', { class: 'klein' }, ' voorlopig') : null,
    // B107 (optie 4): een seintje voor de steekproef; de status van de student verandert er niet door.
    c.signalen?.length ? h('span', { class: 'klein ver-signaal', title: c.signalen.map((s) => `${s.veld}: ${s.reden}`).join('; ') },
      ` · ${c.signalen.length} ${c.signalen.length === 1 ? 'antwoord' : 'antwoorden'} kort of herhalend`) : null);

  function teken() {
    wis(uitkomsten); wis(tabelGebied);
    if (resultaten.length === 0) return;
    const m = bouwVerificatie(resultaten, luk);
    const gewijzigd = m.studenten.filter((s) => s.gewijzigd);

    uitkomsten.append(h('h2', {}, 'Uitkomst per bestand'),
      h('ul', { class: 'ver-bestanden' },
        ...resultaten.map(({ bestand, uitkomst }) => {
          const klasse = uitkomst.status === 'ongewijzigd' ? 'ver-ok' : uitkomst.status === 'gewijzigd' ? 'ver-gewijzigd' : 'ver-ongeldig';
          const tekst = uitkomst.status === 'ongewijzigd' ? 'geen wijziging na export gevonden'
            : uitkomst.status === 'gewijzigd' ? 'gewijzigd na export' : `geen dossier: ${uitkomst.reden}`;
          return h('li', { class: `ver-bestand ${klasse}`, 'data-status': uitkomst.status },
            h('strong', {}, bestand), ': ', h('span', { class: 'ver-melding' }, tekst),
            uitkomst.status === 'gewijzigd' ? h('span', { class: 'klein' }, ` (${uitkomst.reden})`) : null,
            uitkomst.recordFouten.length ? h('span', { class: 'fout' }, ` Ongeldige records: ${uitkomst.recordFouten.join(' ')}`) : null);
        })),
      gewijzigd.length ? h('p', { class: 'fout', role: 'alert' }, `${gewijzigd.length} van de ${resultaten.length} bestanden is gewijzigd na export. Neem de statussen daarvan niet zonder meer over.`) : "");

    if (m.studenten.length === 0) return;
    tabelGebied.append(h('h2', {}, `Status per student (${m.studenten.length})`),
      h('p', { class: 'klein' }, 'De studenten met de meeste ontbrekende bewijsonderdelen staan bovenaan. Ontbreekt: geen record of nog niet. Leeruitkomst: het slechtste van de bijbehorende bewijsonderdelen.'),
      h('div', { class: 'ver-tabelwrap' }, h('table', { class: 'ver-tabel', id: 'ver-tabel' },
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Student'), h('th', { scope: 'col' }, 'Team'), h('th', { scope: 'col' }, 'Ontbreekt'),
          m.bewijsonderdelen.map((id) => h('th', { scope: 'col', class: 'ver-ev' }, id)),
          m.studenten[0].leeruitkomsten.map((l) => h('th', { scope: 'col', class: 'ver-luk' }, `LUK ${l.luk}`)))),
        h('tbody', {}, m.studenten.map((s) => h('tr', { class: s.gewijzigd ? 'ver-rij-gewijzigd' : null, 'data-bestand': s.bestand },
          h('th', { scope: 'row' }, s.alias || '(geen alias)', s.gewijzigd ? h('span', { class: 'fout ver-gewijzigd-label' }, ' gewijzigd na export') : null),
          h('td', {}, s.teamnummer),
          h('td', { class: 'ver-ontbreekt' }, s.ontbreekt.length ? `${s.ontbreekt.length}: ${s.ontbreekt.join(', ')}` : 'niets'),
          s.cellen.map(status),
          s.leeruitkomsten.map((l) => h('td', { class: `ver-cel ver-${l.status.replace(' ', '-')}` }, statusChip(l.status, l.statusTekst), h('span', { class: 'klein' }, ` ${l.aantalCompleet}/${l.totaal}`)))))))));
  }

  async function lees(bestanden) {
    for (const bestand of bestanden) {
      const uitkomst = await controleerDossier(await bestand.text());
      resultaten.push({ bestand: bestand.name, uitkomst });
    }
    teken();
  }

  const veld = bestandKiezer({ id: 'ver-bestanden', titel: 'Kies één of meer dossierbestanden', meer: true, bijKeuze: async (bestanden) => {
    resultaten.length = 0;
    await lees(bestanden);
  } });

  main.append(h1,
    h('p', {}, 'Lees de dossiers (.json) van je studenten in. De controlesom wordt hier in je browser opnieuw uitgerekend; een bestand dat daarna is aangepast krijgt de melding „gewijzigd na export”.'),
    h('p', { class: 'klein' }, 'Deze pagina stuurt niets naar een server: de bestanden blijven op je eigen apparaat. De controlesom laat zien dat een bestand is aangepast; ze is geen handtekening. Wie de som zelf opnieuw uitrekent, kan een bestand ongemerkt aanpassen.'),
    veld,
    uitkomsten, tabelGebied);
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
