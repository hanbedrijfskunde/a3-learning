// SX-15 (een model in beeld én in tekst, ADR B92 en B95) en SX-16 (het stakeholderbord van taak 5.1, ADR B96).
// Het gedrag in de browser (slepen, tikken, pijltjes, paneel, 2 × 2 op 360 px) is met Playwright gecontroleerd; hier staan
// de regels, de data en de bedrading.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schuif, vakVan, stakeholdersUit, stakeholderRijen } from '../js/raster.js';
import { MODELLEN, FIGUUR_NAMEN, modellenZonderFiguur } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const blok = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));
const taak51 = () => blok(3).taken.find((t) => t.id === '5.1');

test('SX-16: pijltjes verschuiven een kaart één vak: ↑ meer invloed, → meer belang; uit de bak begint hij bij laag/laag', () => {
  assert.deepEqual(schuif({}, 'ArrowUp'), { invloed: 'hoog', belang: 'laag' });
  assert.deepEqual(schuif({}, 'ArrowRight'), { invloed: 'laag', belang: 'hoog' });
  assert.deepEqual(schuif({ invloed: 'hoog', belang: 'laag' }, 'ArrowRight'), { invloed: 'hoog', belang: 'hoog' });
  assert.deepEqual(schuif({ invloed: 'hoog', belang: 'hoog' }, 'ArrowDown'), { invloed: 'laag', belang: 'hoog' });
  assert.equal(schuif({}, 'Enter'), null);
  assert.equal(vakVan({ invloed: 'hoog', belang: 'hoog' }).titel, 'Nauw betrekken');
  assert.equal(vakVan({ invloed: 'hoog', belang: '' }), null, 'zonder belang ligt de kaart in de bak');
});

test('SX-16: oefenen en toepassen van taak 5.1 gebruiken het bord; de toepassing heeft het vraagstuk in het midden en de gebruiker uit EV-01 als voorstel', () => {
  const t = taak51();
  const bordVan = (deel) => t[deel].weergave.groepen.find((g) => g.bord)?.bord;
  assert.deepEqual(bordVan('toepassing'), { voor: 's', aantal: 7, vraagstuk: 'vraagstuk', voorstel: 'EV-01' });
  assert.equal(bordVan('oefening').vraagstukTekst, 'Terugkerende klanten geven webshop X lagere waarderingen');
  assert.ok(!t.toepassing.weergave.groepen.some((g) => g.tabel), 'geen tabel van 35 velden meer naast het bord');
});

test('SX-15, SX-16: het modelantwoord staat op het bord: zes stakeholders, elk met intern of extern en een vak', () => {
  const t = taak51();
  const s = stakeholdersUit(t.modelantwoord.velden, stakeholderRijen({ voor: 's', aantal: 7 }));
  assert.equal(s.length, 6);
  for (const x of s) {
    assert.ok(['intern', 'extern'].includes(x.soort), x.naam);
    assert.ok(vakVan(x), `${x.naam} staat in een vak`);
    assert.ok(x.raakt.length > 10, `${x.naam} heeft een relatie met het vraagstuk`);
  }
  assert.deepEqual(blok(3).media.uitleg.modelantwoord, { taak: '5.1', bord: true, velden: ['merktEerst', 'belangHuidig'] });
});

test('SX-15: het voorbeeld uit de tekstroute (controller en accountant) staat in de figuur, in de vakken die de tekst noemt', () => {
  const u = blok(3).media.uitleg;
  assert.match(u.voorbeeld, /controller intern, met hoge invloed en hoog belang.*accountant is extern, met hoge invloed en laag belang/s);
  const vak = Object.fromEntries(u.voorbeeldBord.stakeholders.map((s) => [s.naam, [s.soort, vakVan(s).titel]]));
  assert.deepEqual(vak, { Controller: ['intern', 'Nauw betrekken'], Accountant: ['extern', 'Tevreden houden'] });
  assert.equal(taak51().stof.figuur, 'invloed-belang', 'het lege raster staat als model in de stof');
});

test('SX-15: een model zonder figuur geeft een waarschuwing; alleen BMC en TOM³ mogen die nog hebben (hun figuren komen met B92 en B93)', () => {
  const zonder = new Set([1, 2, 3, 4].flatMap((n) => modellenZonderFiguur(blok(n))));
  for (const m of zonder) assert.ok(['business model canvas', 'TOM³-model'].includes(m), `${m} heeft geen figuur`);
  const figuren = new Set([1, 2, 3, 4].flatMap((n) => blok(n).taken.map((t) => t.stof?.figuur).filter(Boolean)));
  for (const m of MODELLEN.filter((x) => FIGUUR_NAMEN.includes(x.figuur))) assert.ok(figuren.has(m.figuur), `${m.naam}: figuur ${m.figuur} staat in een taak`);
  // Sabotage: een model zonder bekende figuur geeft een waarschuwing; met figuur niet.
  const stof = (t) => ({ taken: [{ stof: { alineas: [t] } }] });
  assert.deepEqual(modellenZonderFiguur(stof('Leg het TOM³-model uit.'), []), ['TOM³-model']);
  assert.deepEqual(modellenZonderFiguur(stof('Leg het TOM³-model uit.'), ['tom']), []);
});

test('SX-16, PF-4: het bord laadt alleen op een leerblok met een bord; de pagina en de gewichtcontrole gebruiken dezelfde voorwaarde', () => {
  const pagina = lees('js/leerblok.js');
  assert.match(pagina, /\/\/ gewicht-alleen: bord\n\s+const bord = heeftBord \? await import\('\.\/stakeholderbord\.js'\) : null;/);
  assert.match(lees('tools/gewicht-check.mjs'), /if \(naam === 'bord'\)/);
  assert.doesNotMatch(lees('js/lb2-ui.js'), /import .* from '\.\/stakeholderbord\.js'/, 'lb2-ui krijgt het bord via ctx, zodat leerblok 2 het niet laadt');
});

test('SX-16: drie manieren om te plaatsen (slepen, tikken, pijltjes), een tekstweergave, en het raster blijft 2 × 2 op een telefoon', () => {
  const js = lees('js/stakeholderbord.js');
  for (const [wat, patroon] of [['slepen', /onpointerdown: \(e\) => sleepStart/], ['tikken', /onclick: \(\) => \{ if \(!negeerKlik\) pak\(s\.nr\); \}/],
    ['pijltjes', /const pos = schuif\(s, e\.key\)/], ['Zet hier', /'Zet hier'/], ['tekstweergave', /'Het bord in tekst'/], ['status', /role: 'status'/]]) assert.match(js, patroon, wat);
  const css = lees('css/stakeholderbord.css');
  assert.match(css, /\.sb-raster \{ position:relative; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;/);
  assert.doesNotMatch(css, /\.sb-raster \{[^}]*grid-template-columns:1fr;/, 'geen enkele kolom op een telefoon');
  assert.match(css, /button\.sb-kaart \{[^}]*touch-action:none/, 'slepen werkt ook met een vinger');
});
