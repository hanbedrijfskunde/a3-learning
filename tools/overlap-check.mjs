// Analyse voor LI-1…LI-3: staat er tekst uit een bron van derden in de contentbestanden? Zoekt reeksen van minstens
// 8 opeenvolgende woorden die in een contentbestand én in de bron staan (LI-3: 0 zinnen ≥ 8 woorden gelijk aan de bron).
// De bronnen (lits/ in de werkmap c-cluster-1) staan niet in deze repository; zonder bron is er niets te vergelijken.
// Bronvermeldingen (data/bronnen*.json) tellen niet mee: een titel in een APA-regel is geen overgenomen tekst.
//
// Gebruik: node tools/overlap-check.mjs [bronbestand …]   (standaard: het TOM³-buildplan in ../c-cluster-1/lits/)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MIN_WOORDEN = 8;

/** Woorden in kleine letters, zonder leestekens en opmaaktekens (markdown, HTML). */
export const woordenVan = (t) => String(t).toLowerCase().replace(/<[^>]+>/g, ' ').split(/[^\p{L}\p{N}³]+/u).filter(Boolean);

/** Reeksen van minstens `n` woorden die in `a` en in `b` staan (als tekst, zonder dubbelen). */
export function gedeeldeReeksen(a, b, n = MIN_WOORDEN) {
  const wa = woordenVan(a);
  const wb = woordenVan(b);
  const bron = new Set();
  for (let i = 0; i + n <= wb.length; i += 1) bron.add(wb.slice(i, i + n).join(' '));
  const gevonden = new Set();
  for (let i = 0; i + n <= wa.length; i += 1) {
    const reeks = wa.slice(i, i + n).join(' ');
    if (bron.has(reeks)) gevonden.add(reeks);
  }
  return [...gevonden];
}

/** Alle tekstwaarden van een JSON-waarde; `opmerking` (aantekening van de bouwer) telt niet mee. */
export function teksten(w, uit = []) {
  if (typeof w === 'string') uit.push(w);
  else if (Array.isArray(w)) w.forEach((x) => teksten(x, uit));
  else if (w && typeof w === 'object') for (const [k, x] of Object.entries(w)) if (k !== 'opmerking') teksten(x, uit);
  return uit;
}

/**
 * Vergelijkt alle contentbestanden in `map` (behalve de bronnenlijsten) met de brontekst.
 * @returns {{bestand: string, reeks: string}[]} de gedeelde reeksen per bestand; leeg = geen overname
 */
export function zoekOvername(map, bronTekst, n = MIN_WOORDEN) {
  const gevonden = [];
  for (const naam of readdirSync(map).filter((f) => f.endsWith('.json') && !/^bronnen/.test(f)).sort()) {
    const inhoud = JSON.parse(readFileSync(resolve(map, naam), 'utf8'));
    for (const t of teksten(inhoud)) for (const reeks of gedeeldeReeksen(t, bronTekst, n)) gevonden.push({ bestand: naam, reeks });
  }
  return gevonden;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const bronnen = process.argv.length > 2 ? process.argv.slice(2) : [resolve(root, '../c-cluster-1/lits/TOM³ Model Buildplan en Scoreformulier.md')];
  let fout = false;
  for (const pad of bronnen) {
    if (!existsSync(pad)) { console.log(`overlap-check: bron niet gevonden, overgeslagen (${pad})`); continue; }
    const r = zoekOvername(resolve(root, 'data'), readFileSync(pad, 'utf8'));
    for (const g of r) console.error(`GELIJK ${g.bestand}: "${g.reeks}"`);
    console.log(`overlap-check: ${r.length} gelijke reeksen van ${MIN_WOORDEN} woorden of meer met ${pad}`);
    if (r.length > 0) fout = true;
  }
  if (fout) process.exit(1);
}
