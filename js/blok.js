// Contentformaat: herhaalde velden kort schrijven (QA-1, PF-4). Een lijst `velden` in data/leerblok-N.json mag naast gewone
// velden een `reeks` bevatten, die hier wordt uitgeschreven tot losse velden, rij voor rij:
//   { "reeks": { "voor": "s", "aantal": 2, "velden": [ { "suffix": "naam", "label": "Stakeholder {n}", "type": "tekst" }, … ] } }
//   → s1naam, s1…, s2naam, s2…   ({n} in een label is het rijnummer; `type` en `opties` werken zoals bij een gewoon veld)
// Alles wat velden leest uit een leerblokbestand roept eerst `expandeerVelden` of `normaliseerBlok` aan.

/** Schrijft de reeksen in een lijst velden uit; gewone velden blijven staan. */
export function expandeerVelden(velden) {
  return (velden ?? []).flatMap((v) => {
    if (!v?.reeks) return [v];
    const { voor, aantal, velden: sjablonen } = v.reeks;
    return Array.from({ length: aantal }, (_, i) => sjablonen.map(({ suffix, label, ...rest }) => ({
      id: `${voor}${i + 1}${suffix}`, label: String(label).replaceAll('{n}', i + 1), ...rest,
    }))).flat();
  });
}

/** Schrijft alle reeksen van een leerblok uit (toepassing en oefening); geeft hetzelfde object terug. */
export function normaliseerBlok(blok) {
  for (const t of blok?.taken ?? []) {
    if (t.toepassing?.velden) t.toepassing.velden = expandeerVelden(t.toepassing.velden);
    if (t.oefening?.velden) t.oefening.velden = expandeerVelden(t.oefening.velden);
  }
  return blok;
}
