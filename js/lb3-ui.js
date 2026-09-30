// Weergave van leerblok 3 (LB-9, LB-12). Alleen DOM; de regels zitten in raster.js en checks/lb3.js.
// Wordt aangeroepen door lb2-ui.js (`bouwWeergave`) voor de groepen met `raster` en `zoekvragenHint`.
import { h, wis } from './dom.js';
import { bouwRaster, stakeholdersUit, rasterTekst } from './raster.js';

/**
 * Het invloed/belang-raster met een tekstweergave. De aanroeper roept `ververs` aan na elke wijziging (en één keer na het bouwen).
 * @param {string[][]} rijen per stakeholder de veld-id's [naam, soort, relatie, invloed, belang]
 * @param {() => object} lees de huidige invoer van de taak
 */
export function rasterEl(rijen, lees) {
  const samenvatting = h('p', { class: 'klein raster-samenvatting', role: 'status' });
  const vakken = new Map();
  const vak = (id, titel, invloed, belang) => {
    const lijst = h('ul', { class: 'raster-leden' });
    vakken.set(id, lijst);
    return h('div', { class: 'raster-vak', 'data-vak': id },
      h('h5', {}, titel), h('p', { class: 'klein' }, `Invloed ${invloed}, belang ${belang}`), lijst);
  };
  // Invloed loopt van laag naar hoog van onder naar boven, belang van laag naar hoog van links naar rechts.
  const raster = h('div', { class: 'raster', role: 'group', 'aria-label': 'Invloed/belang-raster met vier vakken' },
    vak('tevreden', 'Tevreden houden', 'hoog', 'laag'), vak('nauw', 'Nauw betrekken', 'hoog', 'hoog'),
    vak('volgen', 'Volgen', 'laag', 'laag'), vak('informeren', 'Op de hoogte houden', 'laag', 'hoog'));
  const ongeplaatst = h('ul', { class: 'raster-tekst', 'data-onderdeel': 'ongeplaatst' });
  const tekstLijst = h('ul', { class: 'raster-tekst', 'data-onderdeel': 'tekst' });
  const element = h('div', { class: 'raster-wrap' },
    h('p', { class: 'klein' }, 'Belang loopt van links (laag) naar rechts (hoog), invloed van onder (laag) naar boven (hoog).'),
    raster, samenvatting,
    h('h5', {}, 'Het raster in tekst'), tekstLijst, ongeplaatst);

  const ververs = () => {
    const r = bouwRaster(stakeholdersUit(lees(), rijen));
    for (const k of r.kwadranten) {
      const lijst = vakken.get(k.id);
      wis(lijst);
      if (k.leden.length === 0) lijst.append(h('li', { class: 'raster-leeg' }, '—'));
      for (const s of k.leden) lijst.append(h('li', {}, s.naam, s.soort ? ` (${s.soort})` : ''));
    }
    const totaal = r.getekend + r.ongeplaatst.length;
    samenvatting.textContent = totaal === 0 ? 'Er staan nog geen stakeholders in het raster.' : `${r.getekend} van ${totaal} ${totaal === 1 ? 'stakeholder' : 'stakeholders'} getekend.`;
    wis(tekstLijst);
    wis(ongeplaatst);
    for (const regel of rasterTekst(r)) (regel.includes('kies nog') ? ongeplaatst : tekstLijst).append(h('li', {}, regel));
  };
  return { element, ververs };
}

/** De zoekvragen uit EV-02 (leerblok 1), zodat de student bij een aanname weet wat „zoekvraag 1” is. */
export function zoekvragenEl(store) {
  const inhoud = store.get('EV-02')?.inhoud ?? {};
  const regels = [1, 2, 3].map((n) => [n, typeof inhoud[`zoekvraag${n}`] === 'string' ? inhoud[`zoekvraag${n}`].trim() : '']).filter(([, t]) => t !== '');
  return h('div', { class: 'zoekvragen-hint' },
    regels.length === 0
      ? h('p', { class: 'klein' }, 'Je hebt in leerblok 1 nog geen zoekvragen geschreven (EV-02). Kies bij een aanname toch alvast een zoekvraag; schrijf ze later in leerblok 1.')
      : [h('p', { class: 'klein' }, 'Jouw zoekvragen uit leerblok 1, om een aanname aan te koppelen:'),
        h('ul', { class: 'klein' }, regels.map(([n, t]) => h('li', {}, `zoekvraag ${n}: ${t}`)))]);
}
