// Gewichtscontrole (PF-4): per pagina de grootte van de eerste lading zonder video: de pagina zelf, de stylesheets, alle
// scripts (ook de modules die ze importeren) en de JSON-bestanden die die scripts ophalen.
// Twee grenzen (ADR B69):
//   GRENS       300 kB gecomprimeerd (gzip, elk bestand apart, zoals GitHub Pages ze levert): wat de student echt binnenhaalt
//   GRENS_BRON  400 kB ongecomprimeerd: begrenst het parseerwerk en voorkomt dat de gzip-marge wordt opgegeten door herhaling
// Tweede controle: 0 afbeeldingen, scripts, stylesheets of lettertypen van een ander domein.
//
// Dynamische imports tellen alleen mee voor de pagina's die ze echt laden (ADR B69):
//   // gewicht-alleen: <voorwaarde>   vlak boven de import: de import telt alleen mee als de eigen leerblokdata aan de voorwaarde
//                                     voldoet (wissel, weergave, lb4ui of media; dezelfde voorwaarden als in js/leerblok.js)
//   import(`./lb${n}.js`)             een sjabloon in het pad telt de modules van het eigen leerblok en van het leerblok van de
//                                     Wissel (modulesVoor in js/checks/register.js); een pagina zonder leerblok telt ze allemaal
// Gebruik: node tools/gewicht-check.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { modulesVoor } from '../js/checks/register.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GRENS = 300_000; // gzip
export const GRENS_BRON = 400_000; // ongecomprimeerd

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
    const b = eigenBlok();
    if (naam === 'wissel') return Boolean(b.wissel) || (b.taken ?? []).some((t) => t.toepassing?.component === 'feedbacklog');
    if (naam === 'weergave') return (b.taken ?? []).some((t) => t.toepassing?.weergave);
    if (naam === 'media') return Boolean(b.media || b.kijktips);
    if (naam === 'lb4ui') return (b.taken ?? []).some((t) => ['verbanden', 'starr'].includes(t.toepassing?.component));
    throw new Error(`gewicht-check: onbekende voorwaarde ${naam}`);
  };
  // Controlemodules die de pagina laadt: die van het eigen leerblok en van het leerblok van de Wissel (js/leerblok.js,
  // MODULES_PER_LEERBLOK in js/checks/register.js).
  const controleBlokken = () => (nummer ? modulesVoor([Number(nummer), eigenBlok().wissel?.leerblok]) : [1, 2, 3, 4]);
  const dataBestanden = (naam) => (existsSync(datamap) ? readdirSync(datamap) : []).filter((n) => n.endsWith('.json') && naam.test(n));
  while (wachtrij.length) {
    const f = wachtrij.pop();
    if (set.has(f) || !existsSync(f)) continue;
    set.add(f);
    if (!f.endsWith('.js')) continue;
    const bron = lees(f);
    for (const m of bron.matchAll(/\bimport\s*\(\s*`(\.[^`]*\$\{[^}]+\}[^`]*\.js)`/g)) {
      for (const n of controleBlokken()) wachtrij.push(resolve(dirname(f), m[1].replace(/\$\{[^}]+\}/g, String(n))));
    }
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
    return {
      pagina, bytes: bestanden.reduce((t, f) => t + statSync(f).size, 0), bestanden: bestanden.length,
      gzip: bestanden.reduce((t, f) => t + gzipSync(readFileSync(f)).length, 0),
    };
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
    const te = g.gzip > GRENS || g.bytes > GRENS_BRON;
    fout ||= te;
    console.log(`${te ? 'FOUT' : 'ok  '} ${g.pagina.padEnd(18)} gzip ${(g.gzip / 1000).toFixed(1)} kB (grens ${GRENS / 1000}), bron ${(g.bytes / 1000).toFixed(1)} kB (grens ${GRENS_BRON / 1000}), ${g.bestanden} bestanden`);
  }
  for (const e of externeBronnen(root)) { fout = true; console.log(`FOUT extern: ${e}`); }
  process.exit(fout ? 1 : 0);
}
