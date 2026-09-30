// Gewichtscontrole (PF-4): per pagina de bytes van de eerste lading zonder video: de pagina zelf, de stylesheets,
// alle scripts (ook de modules die ze importeren) en de JSON-bestanden die die scripts ophalen. Ongecomprimeerd, dus
// strenger dan wat GitHub Pages verstuurt. Grens: 300 kB (300.000 bytes). Tweede controle: 0 afbeeldingen, scripts,
// stylesheets of lettertypen van een ander domein.
// Gebruik: node tools/gewicht-check.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GRENS = 300_000;

const lees = (p) => readFileSync(p, 'utf8');
const externe = (u) => /^(https?:)?\/\//i.test(u);

/** Bestanden (absoluut pad) die de eerste lading van één pagina ophaalt. */
export function paginaBestanden(root, paginaNaam) {
  const html = lees(resolve(root, paginaNaam));
  const nummer = /data-leerblok="(\d+)"/.exec(html)?.[1];
  const set = new Set([resolve(root, paginaNaam)]);
  const wachtrij = [];
  for (const m of html.matchAll(/<(?:link[^>]*href|script[^>]*src)="([^"]+)"/g)) {
    if (!externe(m[1]) && !m[1].startsWith('data:')) wachtrij.push(resolve(root, m[1]));
  }
  const datamap = resolve(root, 'data');
  const eigenBlok = () => (nummer && existsSync(resolve(datamap, `leerblok-${nummer}.json`)) ? JSON.parse(lees(resolve(datamap, `leerblok-${nummer}.json`))) : {});
  // Voorwaarden voor `// gewicht-alleen:`; dezelfde als waarmee de pagina de module laadt (js/leerblok.js).
  const voldoet = (naam) => {
    if (naam === 'wissel') { const b = eigenBlok(); return Boolean(b.wissel) || (b.taken ?? []).some((t) => t.toepassing?.component === 'feedbacklog'); }
    throw new Error(`gewicht-check: onbekende voorwaarde ${naam}`);
  };
  const dataBestanden = (naam) => (existsSync(datamap) ? readdirSync(datamap) : []).filter((n) => n.endsWith('.json') && naam.test(n));
  while (wachtrij.length) {
    const f = wachtrij.pop();
    if (set.has(f) || !existsSync(f)) continue;
    set.add(f);
    if (!f.endsWith('.js')) continue;
    const bron = lees(f);
    for (const m of bron.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+\.js)['"]/g)) {
      // Een dynamische import met vlak erboven `// gewicht-alleen: <voorwaarde>` telt alleen mee voor pagina's die aan de
      // voorwaarde voldoen (PF-4); alle andere imports, ook dynamische, tellen altijd mee.
      const voorwaarde = /\/\/ gewicht-alleen: (\w+)\s*\n[^\n]*$/.exec(bron.slice(0, m.index + m[0].length))?.[1];
      if (voorwaarde && !voldoet(voorwaarde)) continue;
      wachtrij.push(resolve(dirname(f), m[1]));
    }
    for (const m of bron.matchAll(/data\/([\w-]*)(\$\{[^}]+\})?([\w-]*)\.json/g)) {
      const [, voor, sjabloon, na] = m;
      if (!sjabloon) { set.add(resolve(datamap, `${voor}.json`)); continue; }
      // ${nummer} is het leerblok van de pagina; ${vorig} het leerblok daarvoor; ${blok.wissel.leerblok} het leerblok dat de eigen data als wissel noemt;
      // elke andere variabele telt alle bestanden met dat patroon (bovengrens)
      if (sjabloon === '${nummer}' && nummer) set.add(resolve(datamap, `${voor}${nummer}${na}.json`));
      else if (sjabloon === '${vorig}') { if (Number(nummer) > 1) set.add(resolve(datamap, `${voor}${Number(nummer) - 1}${na}.json`)); } // het scherm „Vorige keer” leest alleen het vorige leerblok
      else if (sjabloon === '${blok.wissel.leerblok}') {
        const eigen = eigenBlok();
        if (eigen.wissel?.leerblok) set.add(resolve(datamap, `${voor}${eigen.wissel.leerblok}${na}.json`));
      } else dataBestanden(new RegExp(`^${voor}[\\w-]*${na}\\.json$`)).forEach((n) => set.add(resolve(datamap, n)));
    }
    if (/MANIFEST\s*=\s*'data\/bronnen\.json'/.test(bron) && existsSync(resolve(datamap, 'bronnen.json'))) {
      set.add(resolve(datamap, 'bronnen.json'));
      for (const n of JSON.parse(lees(resolve(datamap, 'bronnen.json'))).bestanden ?? []) set.add(resolve(datamap, n));
    }
  }
  return [...set].filter((f) => existsSync(f));
}

export function gewichten(root) {
  return readdirSync(root).filter((n) => n.endsWith('.html')).sort().map((pagina) => {
    const bestanden = paginaBestanden(root, pagina);
    return { pagina, bytes: bestanden.reduce((t, f) => t + statSync(f).size, 0), bestanden: bestanden.length };
  });
}

/** Verwijzingen naar een ander domein in pagina's en CSS (afbeeldingen, scripts, stylesheets, lettertypen). */
export function externeBronnen(root) {
  const gevonden = [];
  for (const n of readdirSync(root).filter((x) => x.endsWith('.html'))) {
    const html = lees(resolve(root, n));
    for (const m of html.matchAll(/<(?:img|script|link|source|video|audio|iframe)[^>]*\s(?:src|href)="([^"]+)"/g)) {
      if (externe(m[1]) && !/rel="(?:canonical|license)"/.test(m[0])) gevonden.push(`${n}: ${m[1]}`);
    }
  }
  for (const n of readdirSync(resolve(root, 'css'))) {
    for (const m of lees(resolve(root, 'css', n)).matchAll(/url\(\s*['"]?([^)'"]+)/g)) if (externe(m[1])) gevonden.push(`css/${n}: ${m[1]}`);
    for (const m of lees(resolve(root, 'css', n)).matchAll(/@import\s+['"]?(https?:[^'";)]+)/g)) gevonden.push(`css/${n}: ${m[1]}`);
  }
  return gevonden;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let fout = false;
  for (const g of gewichten(root)) {
    const te = g.bytes > GRENS;
    fout ||= te;
    console.log(`${te ? 'FOUT' : 'ok  '} ${g.pagina.padEnd(18)} ${(g.bytes / 1000).toFixed(1)} kB in ${g.bestanden} bestanden`);
  }
  for (const e of externeBronnen(root)) { fout = true; console.log(`FOUT extern: ${e}`); }
  process.exit(fout ? 1 : 0);
}
