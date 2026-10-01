import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maakStore, geheugenOpslag } from '../js/store.js';
import { maakRecord } from '../js/schema.js';
import { zetStellingOm } from '../js/migratie.js';

const config = JSON.parse(readFileSync(new URL('../data/config.json', import.meta.url), 'utf8'));
const ev5 = (taak) => maakRecord({
  taakdef: { id: 'EV-05', taak, leerblok: 2, luk: [1], bc: ['BC1'] },
  inhoud: { kant: 'voor', argument: 'Eén. Twee.' }, controles: [], status: 'compleet', versie: 1,
  bijgewerkt: '2026-10-01T10:00:00.000Z', elearning: config.versie,
});

function oudeOpslag() {
  const store = maakStore(geheugenOpslag());
  store.save(ev5('4.2'));
  store.setMeta('klaar:4.2', { op: 'x' });
  store.setMeta('oefening:4.2', { invoer: { kant: 'tegen' }, overgeslagen: false, pogingen: 0 });
  store.setMeta('klaarals:4.2', [0]);
  store.setMeta('positie:2', { leerblok: 2, taak: '4.2', stap: 4, titel: 'Stelling' });
  return store;
}

test('B102: de stelling verhuist van 4.2 naar 4.3: record, klaar, oefening, klaar-als en positie', () => {
  const store = oudeOpslag();
  assert.equal(zetStellingOm(store), true);
  assert.equal(store.get('EV-05').taak, '4.3');
  assert.deepEqual(store.get('EV-05').inhoud, { kant: 'voor', argument: 'Eén. Twee.' });
  assert.deepEqual(store.getMeta('klaar:4.3'), { op: 'x' });
  assert.equal(store.getMeta('klaar:4.2'), undefined, 'de nieuwe taak 4.2 is niet klaar');
  assert.equal(store.getMeta('oefening:4.3').invoer.kant, 'tegen');
  assert.equal(store.getMeta('oefening:4.2'), undefined);
  assert.deepEqual(store.getMeta('klaarals:4.3'), [0]);
  assert.equal(store.getMeta('positie:2').taak, '4.3');
});

test('B102: de omzetting is idempotent en raakt een nieuwe opslag niet', () => {
  const store = oudeOpslag();
  zetStellingOm(store);
  const versies = store.versions('EV-05').length;
  assert.equal(zetStellingOm(store), false);
  assert.equal(store.versions('EV-05').length, versies);
  assert.equal(zetStellingOm(maakStore(geheugenOpslag())), false);
  const nieuw = maakStore(geheugenOpslag());
  nieuw.save(ev5('4.3'));
  nieuw.setMeta('klaar:4.2', { op: 'y' });
  assert.equal(zetStellingOm(nieuw), false);
  assert.deepEqual(nieuw.getMeta('klaar:4.2'), { op: 'y' }, 'klaar van de nieuwe IMRAD-taak blijft staan');
});

test('B102: leerblok.js zet de stelling om voordat de sessie start', () => {
  const bron = readFileSync(new URL('../js/leerblok.js', import.meta.url), 'utf8');
  const om = bron.indexOf('zetStellingOm(store)');
  assert.ok(om > 0 && om < bron.indexOf('maakSessie('));
});
