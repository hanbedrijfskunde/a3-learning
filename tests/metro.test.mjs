// Metrokaart van het leerblok (SX-4, SX-18, SX-19; ADR B110; DESIGN §6 Metrokaart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleerFormaat, SPOOR_STAPPEN } from '../tools/content-check.mjs';
import { normaliseerBlok } from '../js/blok.js';
import { controleerContrast, tokensUit, contrast, LIJNEN, MINIMUM_GRAFISCH } from '../tools/contrast-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const ruw = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));
/** Zoals content-check het bestand leest: reeksen velden uitgeschreven. */
const blok = (n) => normaliseerBlok(ruw(n));

test('SX-19: taak 3.2 splitst in route A en B (oefenen en toepassen), taak 4.2 in artikel 1 en 2 (oefenen)', () => {
  const lb2 = ruw(2);
  const t32 = lb2.taken.find((t) => t.id === '3.2');
  assert.deepEqual(t32.spoor, { stappen: ['oefenen', 'toepassen'], veld: 'route',
    takken: [{ waarde: 'A · databank', kort: 'A' }, { waarde: 'B · AI-tool', kort: 'B' }] });
  const t42 = lb2.taken.find((t) => t.id === '4.2');
  assert.deepEqual(t42.spoor, { stappen: ['oefenen'], veld: 'artikel',
    takken: [{ waarde: 'Artikel 1 · Visser & El Amrani', kort: 'Art. 1' }, { waarde: 'Artikel 2 · Bakker & De Vries', kort: 'Art. 2' }] });
  assert.deepEqual(SPOOR_STAPPEN, ['waarom', 'stof', 'oefenen', 'toepassen']);
  for (const n of [1, 2, 3, 4]) assert.deepEqual(controleerFormaat(blok(n), `leerblok-${n}.json`).fouten, [], `leerblok ${n}`);
});

test('SX-19: content-check keurt een spoor met een onbekende stap, een onbekend veld of een tak buiten de opties af', () => {
  const zet = (spoor) => { const b = blok(2); b.taken.find((t) => t.id === '3.2').spoor = spoor; return controleerFormaat(b, 'leerblok-2.json').fouten; };
  const goed = ruw(2).taken.find((t) => t.id === '3.2').spoor;
  assert.match(zet({ ...goed, stappen: ['oefenen', 'pauze'] }).join('\n'), /taak 3\.2: spoor\.stappen/);
  assert.match(zet({ ...goed, veld: 'bestaatniet' }).join('\n'), /taak 3\.2: spoor\.veld bestaatniet bestaat niet/);
  assert.match(zet({ ...goed, takken: [goed.takken[0], { waarde: 'C · bibliotheek', kort: 'C' }] }).join('\n'), /staat niet in de opties van route/);
  assert.match(zet({ ...goed, takken: [goed.takken[0]] }).join('\n'), /spoor heeft 2 of 3 takken/);
  assert.match(zet({ ...goed, takken: [goed.takken[0], { waarde: 'B · AI-tool', kort: 'B-route-lang' }] }).join('\n'), /kort label van hoogstens 6 tekens/);
});

test('SX-18: vier lijnkleuren als token, elk minstens 3:1 tegen wit (WCAG 1.4.11), en in de contrastcontrole', () => {
  const tokens = tokensUit(lees('css/site.css'));
  assert.deepEqual(LIJNEN, ['--lijn-1', '--lijn-2', '--lijn-3', '--lijn-4']);
  assert.equal(MINIMUM_GRAFISCH, 3);
  assert.deepEqual(LIJNEN.map((t) => tokens[t]?.toUpperCase()), ['#E50056', '#0063B2', '#00804A', '#C2410C']);
  for (const t of LIJNEN) assert.ok(contrast(tokens[t], tokens['--wit']) >= 3, t);
  const { paren, fouten } = controleerContrast(root);
  assert.equal(paren.filter((p) => p.minimum === 3).length, 4, 'vier lijnparen met hun eigen minimum');
  assert.deepEqual(fouten, []);
});
