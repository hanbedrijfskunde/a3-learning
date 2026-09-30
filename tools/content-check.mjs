// Contentcontrole: valideert data/leerblok-*.json (QA-3, BW-12); bronnen (BR-5) volgen in fase 6.
//
// Gebruik: node tools/content-check.mjs [datamap]   (standaard: data/)
//
// Voorlopig formaat van data/leerblok-N.json; fase 2 legt het definitief vast:
//   { "leerblok": 1,
//     "taken": [ { "id": "2.1", "luk": [1], "bc": ["BC1"], "klaarAls": "…", "modelantwoord": "…",
//                  "controles": [ { "id": "…", "soort": "A" } ] } ],
//     "bewijsonderdelen": [ { "id": "EV-01", "taak": "2.1", "lukOnderdelen": ["LUK 1 · Formuleert een onderzoeksvraag"] } ] }
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const gevuld = (t) => typeof t === 'string' && t.trim() !== '';
const lijstGevuld = (l) => Array.isArray(l) && l.length > 0;

/**
 * Controleert één leerblokbestand en geeft een lijst foutmeldingen (leeg = in orde).
 * Elke ontbrekende eis van een taak levert één fout op, met het taaknummer in de melding (QA-3).
 * @param {object} inhoud geparste JSON
 * @param {string} bestand naam voor in de melding
 */
export function controleerLeerblok(inhoud, bestand) {
  const fouten = [];
  const taken = Array.isArray(inhoud?.taken) ? inhoud.taken : [];
  if (taken.length === 0) fouten.push(`${bestand}: geen taken gevonden`);

  for (const taak of taken) {
    const wie = `${bestand}: taak ${taak?.id ?? '(zonder id)'}`;
    if (!lijstGevuld(taak.luk) || !lijstGevuld(taak.bc)) fouten.push(`${wie} mist een LUK-koppeling (luk en bc)`);
    if (!gevuld(taak.klaarAls)) fouten.push(`${wie} mist een „klaar als"`);
    if (!lijstGevuld(taak.controles)) fouten.push(`${wie} mist een controle`);
    if (!gevuld(taak.modelantwoord)) fouten.push(`${wie} mist een modelantwoord`);
  }

  const onderdelen = Array.isArray(inhoud?.bewijsonderdelen) ? inhoud.bewijsonderdelen : [];
  for (const ev of onderdelen) {
    if (!lijstGevuld(ev.lukOnderdelen)) fouten.push(`${bestand}: bewijsonderdeel ${ev.id ?? '(zonder id)'} mist een LUK-onderdeel (BW-12)`);
    if (!taken.some((t) => t.id === ev.taak)) fouten.push(`${bestand}: bewijsonderdeel ${ev.id ?? '(zonder id)'} verwijst naar een onbekende taak ${ev.taak}`);
  }
  return fouten;
}

/** Controleert alle leerblokbestanden in een map. */
export function controleerMap(map) {
  const namen = existsSync(map) ? readdirSync(map).filter((n) => /^leerblok-\d\.json$/.test(n)).sort() : [];
  const fouten = [];
  for (const naam of namen) {
    let inhoud;
    try { inhoud = JSON.parse(readFileSync(resolve(map, naam), 'utf8')); }
    catch (e) { fouten.push(`${naam}: geen geldige JSON (${e.message})`); continue; }
    fouten.push(...controleerLeerblok(inhoud, naam));
  }
  return { bestanden: namen.length, fouten };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const map = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'data');
  const { bestanden, fouten } = controleerMap(map);
  if (fouten.length) {
    console.error('content-check faalt:\n' + fouten.join('\n'));
    process.exit(1);
  }
  console.log(`content-check: ok (${bestanden} leerblokbestanden)`);
}
