// Bronnenpagina (BR-1…BR-4): alle bronnen alfabetisch in APA met een werkende link. Alleen DOM; het model komt uit bronnen.js.
import { h } from './dom.js';
import { laadBronnen, bouwBronnenModel } from './bronnen.js';

async function start() {
  const lijst = document.querySelector('#bronnenlijst');
  const bestanden = await laadBronnen((u) => fetch(new URL(`../${u}`, import.meta.url)));
  const model = bouwBronnenModel(bestanden);
  for (const b of model) {
    lijst.append(h('li', { class: 'bron-regel', id: b.ankerId },
      b.delen.map((d) => (d.cursief ? h('i', {}, d.tekst) : d.tekst)),
      b.link ? [' ', h('a', { class: 'bron-link', href: b.link, rel: 'noopener' }, b.link)] : null,
      b.fictief ? [' ', h('span', { class: 'bron-fictief' }, 'fictief')] : null));
  }
  if (model.length === 0) lijst.append(h('li', {}, 'Er zijn nog geen bronnen.'));
  // een bezochte verwijzing (bronnen.html#bron-…) springt naar de regel; laadde de pagina later dan de sprong, doe dat nu
  const doel = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (doel) { doel.classList.add('bron-doel'); doel.scrollIntoView(); }
}

start().catch((e) => {
  document.querySelector('#bronnenlijst').append(h('li', { class: 'fout', role: 'alert' }, `De bronnen konden niet worden geladen (${e.message}).`));
});
