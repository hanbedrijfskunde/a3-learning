// Het scherm van een spel of simulatie (MD-9, MD-10, MD-13, MD-15). Alleen DOM; de regels zitten in spel-model.js.
// Toetsenbord: alles is een knop, een keuzerondje of een keuzelijst, dus Tab, pijltjes, Spatie en Enter volstaan (MD-9).
// Geen score, geen ranglijst. Dit bestand importeert de opslag niet en schrijft nergens iets weg: een spel levert geen bewijs (MD-11).
import { h, wis } from './dom.js';
import {
  AAOCC, KAPITALEN, TERMIJNEN, EFFECT_TEKST, beoordeelKaart, effectVan, vergelijkVoorspelling, voorspellingVolledig, spanningTekst, tekstversie,
} from './spel-model.js';

const fictiefBadge = () => h('span', { class: 'sp-fictief' }, 'Fictief');

/** Het spel als element. `met(tekst)` zet in-tekstverwijzingen om in links naar de bronnenpagina (BR-4). */
export function bouwSpel({ spel, met = (t) => t }) {
  const wortel = h('div', { class: 'spel', 'data-spel': spel.id });
  const veld = h('div', { class: 'sp-veld' });
  const opnieuw = () => start();
  const focusKop = () => veld.querySelector('.sp-kop')?.focus();

  const intro = h('div', { class: 'sp-intro' },
    h('p', { class: 'sp-fictief-uitleg' }, fictiefBadge(), ' ', spel.fictiefUitleg),
    h('p', {}, met(spel.intro)),
    h('p', { class: 'klein' }, spel.geenBewijs));

  const tekst = h('details', { class: 'sp-tekstversie' },
    h('summary', {}, 'Tekstversie: lees het hele spel zonder te spelen'),
    tekstversie(spel).map((s) => h('section', {}, h('h4', {}, s.kop), h('ul', {}, s.regels.map((r) => h('li', {}, r))))));

  // ---------------------------------------------------------------- kaarten

  function kaartenSpel() {
    let i = 0;
    const tekenKaart = () => {
      wis(veld);
      const k = spel.kaarten[i];
      const feedback = h('div', { class: 'sp-feedback', 'aria-live': 'polite' });
      const naKeuze = h('div', { class: 'sp-na', hidden: true });
      const gegevens = h('dl', { class: 'sp-gegevens', hidden: true }, k.gegevens.flatMap((g) => [h('dt', {}, g.label), h('dd', {}, g.tekst)]));
      const onderzoek = h('button', { type: 'button', class: 'knop', 'aria-expanded': 'false', onclick: () => {
        const open = gegevens.hidden;
        gegevens.hidden = !open;
        onderzoek.setAttribute('aria-expanded', String(open));
        onderzoek.textContent = open ? 'Verberg de gegevens' : 'Onderzoek de gegevens';
      } }, 'Onderzoek de gegevens');
      const knoppen = k.opties.map((o) => h('button', { type: 'button', class: 'knop', 'data-optie': o.id, 'aria-pressed': 'false', onclick: () => {
        const b = beoordeelKaart(k, o.id);
        knoppen.forEach((kn) => kn.setAttribute('aria-pressed', String(kn === kn0(o.id))));
        wis(feedback);
        feedback.append(h('p', {}, h('strong', {}, `Je koos: ${o.tekst}. `), b.feedback));
        wis(naKeuze);
        naKeuze.hidden = false;
        naKeuze.append(
          h('h5', {}, 'Zo beoordeelt AAOCC deze bron'),
          h('dl', { class: 'sp-aaocc' }, AAOCC.flatMap((c) => [h('dt', {}, c), h('dd', {}, b.aaocc[c])])),
          h('p', {}, h('strong', {}, 'Let op: '), b.kernpunt),
          h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'volgende', onclick: () => { i += 1; if (i < spel.kaarten.length) { tekenKaart(); focusKop(); } else eind(); } },
            i + 1 < spel.kaarten.length ? 'Volgende kaart' : 'Afronden'));
      } }, o.tekst));
      const kn0 = (id) => knoppen.find((kn) => kn.dataset.optie === id);
      veld.append(
        h('h3', { class: 'sp-kop', tabindex: '-1' }, `Kaart ${i + 1} van ${spel.kaarten.length}: ${k.titel} `, fictiefBadge()),
        h('dl', { class: 'sp-kaart' },
          h('dt', {}, 'Soort'), h('dd', {}, k.soort), h('dt', {}, 'Auteur'), h('dd', {}, k.auteur), h('dt', {}, 'Jaar'), h('dd', {}, k.jaar),
          h('dt', {}, 'Uitgever'), h('dd', {}, k.uitgever), h('dt', {}, 'Wat het zegt'), h('dd', {}, k.samenvatting)),
        onderzoek, gegevens,
        h('div', { role: 'group', 'aria-label': 'Wat doe je met deze bron?' }, h('p', { class: 'sp-vraag' }, 'Wat doe je met deze bron?'), h('div', { class: 'knoppen' }, knoppen)),
        feedback, naKeuze);
    };
    const eind = () => {
      wis(veld);
      veld.append(h('h3', { class: 'sp-kop', tabindex: '-1' }, 'Klaar met de zes kaarten'), h('p', {}, spel.slot),
        h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop', 'data-actie': 'opnieuw', onclick: opnieuw }, 'Nog een keer spelen')));
      focusKop();
    };
    tekenKaart();
  }

  // ---------------------------------------------------------------- simulatie

  function simulatie() {
    let i = 0;
    const tekenBeslissing = () => {
      wis(veld);
      const b = spel.beslissingen[i];
      let gekozen = null;
      const meldingKies = h('p', { class: 'fout', role: 'alert', hidden: true }, 'Kies eerst een optie.');
      const opties = h('fieldset', { class: 'sp-opties' }, h('legend', {}, 'Wat besluit je?'),
        b.opties.map((o) => h('div', { class: 'optie' },
          h('input', { type: 'radio', name: `sp-${b.id}`, id: `sp-${b.id}-${o.id}`, value: o.id, onchange: () => { gekozen = o.id; meldingKies.hidden = true; } }),
          h('label', { for: `sp-${b.id}-${o.id}` }, o.tekst))));
      veld.append(
        h('h3', { class: 'sp-kop', tabindex: '-1' }, `Beslissing ${i + 1} van ${spel.beslissingen.length}: ${b.titel} `, fictiefBadge()),
        h('p', {}, b.situatie), opties, meldingKies,
        h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'kies', onclick: () => {
          if (!gekozen) { meldingKies.hidden = false; return; }
          tekenVoorspelling(b, gekozen);
        } }, 'Kies deze optie')));
    };

    const tekenVoorspelling = (b, optieId) => {
      wis(veld);
      const optie = b.opties.find((o) => o.id === optieId);
      const voorspelling = {};
      const melding = h('p', { class: 'fout', role: 'alert', hidden: true }, 'Kies bij elk kapitaal een antwoord.');
      const rijen = KAPITALEN.map((kap) => {
        const sel = h('select', { id: `sp-v-${kap.replace(/\W+/g, '-')}`, onchange: () => { voorspelling[kap] = sel.value; melding.hidden = true; } },
          h('option', { value: '' }, 'Kies…'), spel.voorspelOpties.map((o) => h('option', { value: o.id }, o.tekst)));
        return h('div', { class: 'veld' }, h('label', { for: sel.id }, kap), sel);
      });
      veld.append(
        h('h3', { class: 'sp-kop', tabindex: '-1' }, `Voorspel eerst: ${optie.tekst}`),
        h('p', {}, `${spel.voorspelVraag} Kies voor elk van de zes kapitalen wat er volgens jou gebeurt. Daarna zie je het effect.`),
        h('div', { class: 'sp-voorspel' }, rijen), melding,
        h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'toon', onclick: () => {
          if (!voorspellingVolledig(voorspelling)) { melding.hidden = false; return; }
          tekenEffect(b, optieId, voorspelling);
        } }, 'Toon het effect')));
    };

    const tekenEffect = (b, optieId, voorspelling) => {
      wis(veld);
      const optie = b.opties.find((o) => o.id === optieId);
      const uitkomst = vergelijkVoorspelling(b, optieId, voorspelling);
      const tabel = h('table', { class: 'sp-tabel' },
        h('caption', {}, `Effect van: ${optie.tekst}`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Kapitaal'), TERMIJNEN.map((t) => h('th', { scope: 'col' }, t)), h('th', { scope: 'col' }, 'Jouw voorspelling voor de lange termijn'))),
        h('tbody', {}, uitkomst.map((r) => h('tr', {},
          h('th', { scope: 'row' }, r.kapitaal),
          r.termijn.map((t) => h('td', {}, EFFECT_TEKST[t])),
          h('td', {}, `${EFFECT_TEKST[r.voorspeld]}: ${r.gelijk ? 'komt overeen' : `het wordt ${EFFECT_TEKST[r.werkelijk]}`}`)))));
      const toelichting = h('ul', { class: 'sp-toelichting' }, uitkomst.filter((r) => r.toelichting).map((r) => h('li', {}, h('strong', {}, `${r.kapitaal}: `), r.toelichting)));
      veld.append(
        h('h3', { class: 'sp-kop', tabindex: '-1' }, 'Het effect van je keuze ', fictiefBadge()),
        h('div', { class: 'sp-tabelwrap' }, tabel),
        h('div', { 'aria-live': 'polite' }, h('p', {}, optie.feedback), toelichting, h('p', {}, h('strong', {}, 'Spanning: '), spanningTekst(effectVan(b, optieId)))),
        h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop knop-accent', 'data-actie': 'volgende', onclick: () => {
          i += 1;
          if (i < spel.beslissingen.length) { tekenBeslissing(); focusKop(); } else eind();
        } }, i + 1 < spel.beslissingen.length ? 'Volgende beslissing' : 'Afronden')));
      focusKop();
    };
    const eind = () => {
      wis(veld);
      veld.append(h('h3', { class: 'sp-kop', tabindex: '-1' }, 'Klaar met de drie beslissingen'), h('p', {}, spel.slot),
        h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop', 'data-actie': 'opnieuw', onclick: opnieuw }, 'Nog een keer spelen')));
      focusKop();
    };
    tekenBeslissing();
  }

  function start() {
    if (spel.type === 'kaarten') kaartenSpel(); else simulatie();
  }
  start();
  wortel.append(intro, veld, tekst);
  return { element: wortel, focus: focusKop };
}
