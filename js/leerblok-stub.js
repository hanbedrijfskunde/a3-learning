// Tijdelijke pagina voor een leerblok waarvan de inhoud nog niet is gebouwd (leerblok 3, tot fase 10): toont het
// scherm „Vorige keer" (TP-11) en de aanbevolen week en dag (TP-10). Fase 10 zet leerblok-3.html op leerblok.js.
import { h, wis } from './dom.js';
import { kiesOpslag, maakStore } from './store.js';
import { vorigeKeerSectie } from './terugblik-pagina.js';

async function start() {
  const nummer = Number(document.body.dataset.leerblok);
  const main = document.querySelector('#inhoud');
  const h1 = main.querySelector('h1');
  const overzicht = await (await fetch(new URL('../data/leerblokken.json', import.meta.url))).json();
  const { opslag } = kiesOpslag();
  const store = maakStore(opslag);
  const aanbevolen = overzicht.leerblokken.find((b) => b.nummer === nummer)?.aanbevolen;
  wis(main);
  main.append(h1,
    aanbevolen ? h('p', { class: 'meta', id: 'aanbevolen' }, `Aanbevolen: ${aanbevolen.week}, ${aanbevolen.dag}.`) : null,
    await vorigeKeerSectie({ store, opslag, overzicht, leerblok: nummer }),
    h('p', {}, 'De taken van dit leerblok worden in een latere fase gevuld.'));
}
start().catch((e) => document.querySelector('#inhoud').append(h('p', { class: 'fout', role: 'alert' }, `De pagina kon niet worden geladen (${e.message}).`)));
