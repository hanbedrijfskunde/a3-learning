// TK-2: teksten met bron „werkboek" zijn letterlijk gelijk aan het werkboek van de auteur (0 tekens verschil).
// Het werkboek staat in de werkmap c-cluster-1, niet in deze repository. Bestaat het bestand niet (bijvoorbeeld in CI),
// dan wordt de test overgeslagen. Ander pad: zet WERKBOEK_PAD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pad = process.env.WERKBOEK_PAD ?? resolve(root, '../c-cluster-1/WK5/Werkboek_A3-start_week5.html');
const bestaat = existsSync(pad);
const blokken = [1, 3].map((n) => JSON.parse(readFileSync(resolve(root, `data/leerblok-${n}.json`), 'utf8')));

const ENTITEITEN = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&nbsp;': ' ', '&#39;': "'" };
const schoon = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, (e) => ENTITEITEN[e] ?? e).replace(/\s+/g, ' ').trim();

/** Leest de taken uit het werkboek: nummer, titel, vorm, tijd, waarom, klaar als, en de opdrachtregel (stappen). */
export function leesWerkboek(html) {
  const uit = {};
  for (const blokHtml of html.split('<div class="act">').slice(1)) {
    const nr = schoon(blokHtml.match(/<span class="nr">(.*?)<\/span>/s)?.[1] ?? '');
    if (!nr) continue;
    const veld = (klasse) => {
      const m = blokHtml.match(new RegExp(`<p class="${klasse}">(.*?)</p>`, 's'));
      return m ? schoon(m[1].replace(/^<b>.*?<\/b>/s, '')) : undefined;
    };
    const stappen = blokHtml.match(/<p class="stappen">(.*?)<\/p>/s);
    uit[nr] = {
      titel: schoon(blokHtml.match(/<h3>(.*?)<\/h3>/s)?.[1] ?? ''),
      vorm: schoon(blokHtml.match(/<span class="vorm[^"]*">(.*?)<\/span>/s)?.[1] ?? ''),
      tijd: schoon(blokHtml.match(/<span class="tijd">(.*?)<\/span>/s)?.[1] ?? ''),
      waarom: veld('waarom'),
      klaarAls: veld('klaar'),
      stappen: stappen ? schoon(stappen[1]) : undefined,
    };
  }
  return uit;
}

const opts = { skip: bestaat ? false : `werkboek niet gevonden op ${pad}` };

test('TK-2: elke taak in leerblok 1 en 3 bestaat in het werkboek met dezelfde titel en vorm', opts, () => {
  const wb = leesWerkboek(readFileSync(pad, 'utf8'));
  for (const t of blokken.flatMap((b) => b.taken)) {
    assert.ok(wb[t.id], `taak ${t.id} staat niet in het werkboek`);
    assert.equal(t.titel, wb[t.id].titel, `titel ${t.id}`);
    assert.equal(t.vorm, wb[t.id].vorm, `vorm ${t.id}`);
  }
});

test('TK-2: waarom, richttijd, klaar als en opdracht met bron werkboek zijn letterlijk gelijk aan het werkboek', opts, () => {
  const wb = leesWerkboek(readFileSync(pad, 'utf8'));
  let vergeleken = 0;
  for (const t of blokken.flatMap((b) => b.taken)) {
    const w = wb[t.id];
    if (t.waarom.bron === 'werkboek') { assert.equal(t.waarom.tekst, w.waarom, `waarom ${t.id}`); vergeleken += 1; }
    if (t.richttijd.bron === 'werkboek') { assert.equal(t.richttijd.tekst, w.tijd, `richttijd ${t.id}`); vergeleken += 1; }
    if (t.klaarAls.bron === 'werkboek') { assert.equal(t.klaarAls.tekst, w.klaarAls, `klaar als ${t.id}`); vergeleken += 1; }
    if (t.toepassing.opdracht.bron === 'werkboek') { assert.equal(t.toepassing.opdracht.tekst, w.stappen, `opdracht ${t.id}`); vergeleken += 1; }
    if (t.oefening.opdracht.bron === 'werkboek') { assert.equal(t.oefening.opdracht.tekst, w.stappen, `oefencasus ${t.id}`); vergeleken += 1; }
  }
  assert.ok(vergeleken >= 8, `slechts ${vergeleken} teksten vergeleken`);
});

test('TK-2: een tekst die de bouwer schreef (concept-auteur) staat niet al in het werkboek; anders wordt de auteur overschreven', opts, () => {
  const wb = leesWerkboek(readFileSync(pad, 'utf8'));
  for (const t of blokken.flatMap((b) => b.taken)) {
    if (t.klaarAls.bron === 'concept-auteur') assert.equal(wb[t.id].klaarAls, undefined, `klaar als ${t.id} staat wel in het werkboek`);
    if (t.waarom.bron === 'concept-auteur') assert.equal(wb[t.id].waarom, undefined, `waarom ${t.id} staat wel in het werkboek`);
  }
});

test('TK-2: de vergelijking kan falen (de leesfunctie ziet een gewijzigd woord)', () => {
  const html = '<div class="act"><div class="act-kop"><span class="nr">9.9</span><h3>Titel</h3><span class="vorm team">Team</span><span class="tijd">5 min</span></div>'
    + '<p class="waarom"><b>Waarom</b>Een &quot;test&quot; &amp; meer.</p><p class="klaar"><b>Klaar als</b>het klaar is.</p></div>';
  const w = leesWerkboek(html)['9.9'];
  assert.equal(w.waarom, 'Een "test" & meer.');
  assert.equal(w.klaarAls, 'het klaar is.');
  assert.notEqual(w.klaarAls, 'het klaar was.');
  assert.equal(w.tijd, '5 min');
});
