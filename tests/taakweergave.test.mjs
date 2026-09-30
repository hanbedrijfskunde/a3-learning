// Fase 19: één taak per scherm (SX-6), leesbare verbanden-kaart (SX-10), routekeuze als tegels (MD-2) en één prompt (VB-4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leesAdres, maakAdres, voetActies, STAP_SLUGS } from '../js/taakweergave.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const TAKEN = ['1.1', '2.1', '2.2'];

test('SX-6: elke taak en stap heeft een eigen adres; de oude ankers blijven werken', () => {
  assert.deepEqual(STAP_SLUGS, ['waarom', 'stof', 'oefenen', 'toepassen']);
  assert.equal(maakAdres('2.1', 3), '#taak-2.1/oefenen');
  assert.deepEqual(leesAdres('#taak-2.1/oefenen', TAKEN), { soort: 'taak', taak: '2.1', stap: 3 });
  assert.deepEqual(leesAdres('#taak-2.1', TAKEN), { soort: 'taak', taak: '2.1', stap: null });
  assert.deepEqual(leesAdres('#oefening-2.2', TAKEN), { soort: 'taak', taak: '2.2', stap: 3 }, 'modelLink van BW-7');
  assert.deepEqual(leesAdres('#stap-1.1-4', TAKEN), { soort: 'taak', taak: '1.1', stap: 4 });
  assert.deepEqual(leesAdres('#afsluiten', TAKEN), { soort: 'afsluiten' });
  for (const h of ['', '#', '#media', '#taak-9.9/stof', '#wissel']) assert.deepEqual(leesAdres(h, TAKEN), { soort: 'overzicht' }, h);
  for (const t of TAKEN) for (let s = 1; s <= 4; s += 1) assert.deepEqual(leesAdres(maakAdres(t, s), TAKEN), { soort: 'taak', taak: t, stap: s });
});

test('SX-6: de vaste voet heeft per scherm hoogstens één hoofdknop, met de teksten uit DESIGN §5.3', () => {
  const v = (x) => voetActies({ soort: 'taak', taken: TAKEN, taak: '2.1', ...x });
  assert.equal(v({ stap: 1 }).primair.label, 'Verder');
  assert.equal(v({ stap: 2 }).primair.label, 'Naar oefenen');
  assert.equal(v({ stap: 3 }).primair.label, 'Check en zie modelantwoord');
  assert.equal(v({ stap: 3 }).primair.actie, 'model');
  assert.equal(v({ stap: 3, modelOpen: true }).primair.doel, '#taak-2.1/toepassen');
  assert.equal(v({ stap: 4, klaarMogelijk: true }).primair.label, 'Klaar: bewaar in dossier');
  assert.equal(v({ stap: 4, klaarMogelijk: true, klaar: true }).primair.doel, '#taak-2.2/waarom');
  assert.equal(v({ stap: 4 }).primair.label, 'Naar taak 2.2', 'TK-17: zonder klaar kun je toch door');
  assert.equal(voetActies({ soort: 'taak', taken: TAKEN, taak: '2.2', stap: 4, klaar: true }).primair.doel, '#afsluiten');
  assert.equal(v({ stap: 1 }).terug.doel, '#taak-1.1/toepassen');
  assert.equal(voetActies({ soort: 'taak', taken: TAKEN, taak: '1.1', stap: 1 }).terug.doel, '#');
  assert.equal(voetActies({ soort: 'overzicht', taken: TAKEN }).primair.label, 'Begin met taak 1.1');
  assert.equal(voetActies({ soort: 'overzicht', taken: TAKEN, verder: '2.2' }).primair.label, 'Ga verder met taak 2.2');
  assert.equal(voetActies({ soort: 'afsluiten', taken: TAKEN }).primair, null, 'het afsluitscherm heeft zijn eigen knoppen');
});

test('SX-6: de pagina toont één taak en één stap, zet de focus op de stapkop en houdt de positie bij; de voet is de enige hoofdknop', () => {
  const bron = lees('js/leerblok.js');
  assert.match(bron, /art\.hidden = !deze/);
  assert.match(bron, /sec\.hidden = Number\(sec\.dataset\.stap\) !== adres\.stap/);
  assert.match(bron, /document\.getElementById\(`stapkop-\$\{adres\.taak\}-\$\{adres\.stap\}`\)/);
  assert.match(bron, /doel\?\.focus\(\)/);
  assert.match(bron, /window\.addEventListener\('hashchange'/);
  assert.match(bron, /store\.setMeta\(POSITIE,/);
  assert.match(lees('css/site.css'), /\.taakweergave \.klaar-voet \.knop-accent \{ display:none; \}/, 'de klaarknop in de stap wijkt voor de voet');
});

test('TK-6: het modelantwoord is een uitklappaneel „Zo zou het kunnen”, pas na een eigen poging', () => {
  const bron = lees('js/leerblok.js');
  assert.match(bron, /h\('summary', \{\}, 'Zo zou het kunnen'\)/);
  assert.match(bron, /if \(m\.modelZichtbaar\) \{/);
  assert.match(bron, /if \(!modelNu\?\.modelZichtbaar\) \{ tekenModelMelding\(/);
});

test('SX-10: inhoudstekst is minstens 13 px; alleen labels mogen kleiner; kaartjes op de verbanden-kaart minstens 15 px, ook op 360 px', () => {
  const css = (lees('css/site.css') + lees('css/stakeholderbord.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  const LABELS = /eyebrow|vb-gekozen|lb2-cel-veld|lb2-tabel td::before|sb-as|sb-vaknaam|sb-baknaam|sb-soort/; // sb-: labels van het stakeholderbord (DESIGN §3, 12 px)
  const klein = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const f = /font-size:\s*([\d.]+)(rem|px)/.exec(m[2]);
    if (!f) continue;
    const px = f[2] === 'rem' ? Number(f[1]) * 16 : Number(f[1]);
    if (px < 13 && !LABELS.test(m[1])) klein.push(`${m[1].trim()}: ${px}px`);
    if (/\.vb-kaartje\b/.test(m[1]) && !/:hover|\[aria-pressed|vb-verbonden|:focus/.test(m[1])) assert.ok(px >= 15, `${m[1].trim()}: ${px}px`);
  }
  assert.deepEqual(klein, []);
});

test('VB-4: één open plek tegelijk als prompt boven de kaart; de volledige lijst en de tekst staan uitklapbaar', () => {
  const bron = lees('js/lb4-ui.js');
  assert.match(bron, /prompt\.textContent = open\.length \? `Volgende open plek: \$\{open\[0\]\.vraag\}`/);
  assert.match(bron, /h\('details', \{ class: 'vb-details' \}, openKop, openLijst\)/);
  assert.match(bron, /h\('details', \{ class: 'vb-details' \}, tekstKop, tekstLijst\)/);
});

test('MD-2: de routekeuze staat als drie grote tegels in de stap stof van de taak waar de media bij horen', () => {
  const css = lees('css/site.css');
  assert.match(css, /\.md-routes \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/);
  assert.match(css, /\.md-knop \{ font-size:1rem; min-height:4\.5rem;/);
  assert.match(lees('js/leerblok.js'), /stap\(s2, stof, mediaPlek && blok\.media\.taak === id \? mediaPlek : null\)/);
});
