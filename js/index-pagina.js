// Startpagina: startinvoer (ST-1), privacytekst (ST-2), de vier leerblokken (LB-1, TK-1) en „Wis alles" (ST-6).
// Alleen DOM; de regels zitten in profiel.js en weergave.js. Toont bewust niets van de Wissel, verdieping,
// „Mijn stand" of „kopieer naar A3" (ST-7).
import { h, wis, statusChip, maakWisAlles } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import { leesProfiel, bewaarProfiel, beoordeelProfiel, zichtbareMeldingen } from './profiel.js';
import { bouwIndexModel } from './weergave.js';
import { leesRecords } from './afgerond.js';

const laad = async (pad) => (await fetch(new URL(pad, import.meta.url))).json();

async function start() {
  const main = document.querySelector('#inhoud');
  const overzicht = await laad('../data/leerblokken.json');
  const { opslag, geblokkeerd } = kiesOpslag();
  const store = maakStore(opslag);
  const alleIds = overzicht.leerblokken.flatMap((b) => b.bewijsonderdelen);

  const blokken = h('section', { id: 'blokken', 'aria-labelledby': 'blokken-kop' });
  const teken = () => {
    wis(blokken);
    blokken.append(
      h('h2', { id: 'blokken-kop' }, 'De vier leerblokken'),
      h('p', {}, 'Een aanbevolen volgorde, zonder slot: je kunt elk leerblok direct openen.'),
    );
    const lijst = h('ol', { class: 'leerblokken' });
    for (const b of bouwIndexModel(overzicht, leesRecords(store, alleIds))) {
      lijst.append(h('li', { class: 'kaart leerblok' },
        h('h3', {}, h('a', { href: b.href }, `Leerblok ${b.nummer} · ${b.titel}`)),
        h('p', { class: 'meta' }, `Richttijd: ${b.richttijdTekst}`),
        b.aanbevolen ? h('p', { class: 'meta', 'data-aanbevolen': b.nummer }, `Aanbevolen: ${b.aanbevolen}`) : null,
        h('p', {}, `Eindigt met: ${b.afgerondBewijs}`),
        h('p', {}, statusChip(b.afgerond ? 'compleet' : 'nog niet', b.afgerondTekst),
          ' ', b.onderdelen.map((o) => h('span', { class: 'onderdeel' }, `${o.id}: ${o.statusTekst}${o.voorlopig ? ' (voorlopig)' : ''} `)))));
    }
    blokken.append(lijst);
  };

  // ---- startinvoer
  const vel = overzicht.start;
  const profiel = leesProfiel(store);
  const invoer = {};
  // SX-2: een melding bij een veld pas nadat de student het veld heeft verlaten; nooit bij het laden.
  const aangeraakt = new Set();
  const meldingen = {};
  const leesInvoer = () => ({
    alias: invoer.alias.value, teamnummer: invoer.teamnummer.value,
    vraagstuk: invoer.vraagstuk.value, waaromZin: invoer.waaromZin.value, voorlopig: invoer.voorlopig.checked,
  });
  const toonHints = () => {
    const zichtbaar = zichtbareMeldingen(beoordeelProfiel(leesInvoer()).hints, aangeraakt);
    for (const [id, el] of Object.entries(meldingen)) {
      const zin = zichtbaar[id];
      el.textContent = zin ?? '';
      el.hidden = !zin;
      if (zin) invoer[id].setAttribute('aria-invalid', 'true'); else invoer[id].removeAttribute('aria-invalid');
    }
  };
  /** Bij elke wijziging door de student: bewaren en de meldingen bijwerken. Bij het laden wordt niets geschreven. */
  const bijwerken = () => { bewaarProfiel(store, leesInvoer()); toonHints(); };
  const velden = vel.velden.map((v) => {
    meldingen[v.id] = h('p', { class: 'veld-fout', id: `start-${v.id}-fout`, hidden: true });
    invoer[v.id] = h('input', {
      type: 'text', id: `start-${v.id}`, value: profiel[v.id], oninput: bijwerken, autocomplete: 'off',
      'aria-describedby': `start-${v.id}-fout`, onblur: () => { aangeraakt.add(v.id); toonHints(); },
    });
    return h('div', { class: 'veld' }, h('label', { for: `start-${v.id}` }, v.label), invoer[v.id], meldingen[v.id]);
  });
  invoer.voorlopig = h('input', { type: 'checkbox', id: 'start-voorlopig', onchange: bijwerken });
  invoer.voorlopig.checked = profiel.voorlopig;

  const start1 = h('section', { id: 'start', 'aria-labelledby': 'start-kop' },
    h('h2', { id: 'start-kop' }, vel.titel),
    h('p', {}, vel.intro),
    h('p', { class: 'klein' }, 'Nieuw hier? Lees de ', h('a', { href: 'docs/studentintroductie.html' }, 'introductie van één pagina'), '.'),
    geblokkeerd ? h('p', { class: 'fout', role: 'alert' }, 'Je browser blokkeert opslag: wat je invult blijft alleen staan zolang deze pagina open is.') : null,
    h('form', { class: 'kaart', onsubmit: (e) => e.preventDefault() },
      velden,
      h('div', { class: 'optie' }, invoer.voorlopig, h('label', { for: 'start-voorlopig' }, vel.voorlopigLabel)),
      h('p', { class: 'klein' }, 'Je invoer wordt automatisch bewaard in deze browser.')),
    h('div', { class: 'kaart privacy', id: 'privacy' }, h('h3', {}, 'Privacy'), h('p', {}, vel.privacytekst)));

  const gegevens = h('section', { id: 'gegevens', 'aria-labelledby': 'gegevens-kop' },
    h('h2', { id: 'gegevens-kop' }, 'Jouw gegevens'),
    maakWisAlles(store, () => {
      Object.values(invoer).forEach((el) => { if (el.type === 'checkbox') el.checked = false; else el.value = ''; });
      aangeraakt.clear();
      teken();
      toonHints();
    }));

  const h1 = main.querySelector('h1');
  wis(main);
  main.append(h1, start1, blokken, gegevens);
  teken();
}

start().catch((e) => {
  document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`));
});
