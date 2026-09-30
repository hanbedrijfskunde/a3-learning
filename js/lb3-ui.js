// Weergave van leerblok 3 (LB-12). Alleen DOM; de regels zitten in checks/lb3.js. Het invloed/belang-raster (LB-9) is het
// stakeholderbord in stakeholderbord.js.
// Wordt aangeroepen door lb2-ui.js (`bouwWeergave`) voor de groepen met `zoekvragenHint`.
import { h } from './dom.js';

/** De zoekvragen uit EV-02 (leerblok 1), zodat de student bij een aanname weet wat „zoekvraag 1” is. */
export function zoekvragenEl(store) {
  const inhoud = store.get('EV-02')?.inhoud ?? {};
  const regels = [1, 2, 3].map((n) => [n, typeof inhoud[`zoekvraag${n}`] === 'string' ? inhoud[`zoekvraag${n}`].trim() : '']).filter(([, t]) => t !== '');
  return h('div', { class: 'zoekvragen-hint' },
    regels.length === 0
      ? h('p', { class: 'klein' }, 'Je hebt in leerblok 1 nog geen zoekvragen geschreven. Kies bij een aanname toch alvast een zoekvraag; schrijf ze later in leerblok 1.')
      : [h('p', { class: 'klein' }, 'Jouw zoekvragen uit leerblok 1, om een aanname aan te koppelen:'),
        h('ul', { class: 'klein' }, regels.map(([n, t]) => h('li', {}, `zoekvraag ${n}: ${t}`)))]);
}
