// Indeling van de metrokaart in pixels (SX-18, SX-19; DESIGN §6 Metrokaart; ADR B110). Puur: rekent uit het model van
// metro-model.js en een breedte waar elke halte, elk spoorstuk, elk label en elk tikvlak komt. Geen DOM.
//
// Elke kolom is even breed. Het tikvlak van een halte is een strook: de volle hoogte van de kaart en de breedte van de
// kolom; takken in één kolom delen de strook in de hoogte. Zo overlappen tikvlakken nooit (WCAG 2.5.8: ≥ 24 × 24 px).
export const HOOGTE = 96; // ≥ 44 px
export const Y_LIJN = 46;
export const RIJ = 18; // afstand van een tak tot de hoofdlijn
export const LABEL_BOVEN = 16; // labels van de overstappunten
export const LABEL_ONDER = 90; // taaknummers, stapletters en „hier”
export const SMAL = 28; // onder deze kolombreedte alleen de labels van „hier” en de overstappunten
export const TAK_LABEL = 56; // vanaf deze kolombreedte staan de korte labels van de takken naast hun halte
export const STRAAL = Object.freeze({ begin: 9, eind: 9, taak: 7, stap: 5, verdieping: 5 });

const yVan = (rij) => Y_LIJN + rij * RIJ;

/**
 * @param {ReturnType<import('./metro-model.js').metroModel>} model
 * @param {number} breedte in px
 */
export function metroIndeling(model, breedte) {
  const n = model.kolommen.length;
  const kol = breedte / n;
  const smal = kol < SMAL;
  const midden = (i) => kol * (i + 0.5);
  const haltes = [];
  const labels = [];
  const sporen = [];
  const lijn = (x1, y1, x2, y2, gestippeld, nr = model.leerblok) => sporen.push({ x1, y1, x2, y2, gestippeld: Boolean(gestippeld), lijn: nr });

  model.kolommen.forEach((k, i) => {
    const x = midden(i);
    const tikbaar = k.haltes.filter((h) => !h.doorgang).sort((a, b) => a.rij - b.rij);
    const hoogte = HOOGTE / tikbaar.length;
    tikbaar.forEach((h, j) => haltes.push({
      ...h, kolom: i, soort: k.soort, x, y: yVan(h.rij), r: STRAAL[k.soort] + (h.stand === 'hier' ? 2 : 0),
      tik: { x: kol * i, y: hoogte * j, b: kol, h: hoogte },
    }));
    if (k.soort === 'begin') labels.push({ tekst: k.label, x: 0, y: LABEL_BOVEN, anker: 'start', soort: 'overstap' });
    if (k.soort === 'eind') labels.push({ tekst: k.label, x: breedte, y: LABEL_BOVEN, anker: 'end', soort: 'overstap' });
    const hier = tikbaar.find((h) => h.stand === 'hier');
    if (hier) labels.push({ tekst: 'hier', x, y: LABEL_ONDER, anker: 'middle', soort: 'hier' });
    else if (!smal && k.label && k.soort !== 'begin' && k.soort !== 'eind') labels.push({ tekst: k.label, x, y: LABEL_ONDER, anker: 'middle', soort: 'kolom' });
    if (kol >= TAK_LABEL) {
      for (const h of tikbaar) {
        if (h.label) labels.push({ tekst: h.label, x: x + STRAAL[k.soort] + 4, y: yVan(h.rij) - STRAAL[k.soort] - 2, anker: 'start', soort: 'tak' });
      }
    }
  });

  const begin = model.kolommen[0];
  const eind = model.kolommen[n - 1];
  if (begin.overstap) lijn(0, Y_LIJN, midden(0), Y_LIJN, false, begin.overstap);
  for (let i = 0; i < n - 1; i += 1) {
    const a = model.kolommen[i];
    const b = model.kolommen[i + 1];
    const xa = midden(i);
    const xb = midden(i + 1);
    const xm = (xa + xb) / 2;
    if (a.spoor && a.spoor === b.spoor) {
      // dezelfde splitsing in twee opeenvolgende stappen: de takken lopen parallel door
      for (const h of a.haltes) {
        const g = b.haltes.find((x) => x.rij === h.rij);
        lijn(xa, yVan(h.rij), xb, yVan(g.rij), h.gestippeld || g.gestippeld);
      }
    } else {
      // splitsen en samenkomen halverwege twee kolommen
      for (const h of a.haltes) lijn(xa, yVan(h.rij), xm, Y_LIJN, h.gestippeld);
      for (const h of b.haltes) lijn(xm, Y_LIJN, xb, yVan(h.rij), h.gestippeld);
    }
  }
  if (eind.overstap) lijn(midden(n - 1), Y_LIJN, breedte, Y_LIJN, false, eind.overstap);
  return { breedte, hoogte: HOOGTE, kol, smal, haltes, labels, sporen };
}
