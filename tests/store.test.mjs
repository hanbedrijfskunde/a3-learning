import test from 'node:test';
import assert from 'node:assert/strict';
import { maakStore, geheugenOpslag, kiesOpslag, PREFIX } from '../js/store.js';
import { maakRecord } from '../js/schema.js';

const taakdef = { id: 'EV-01', taak: '2.1', leerblok: 1, luk: [1], bc: ['BC1'] };
const record = (inhoud, extra = {}) => maakRecord({
  taakdef, inhoud, controles: [{ id: 'gebruiker-woorden', resultaat: 'ok' }], status: 'compleet',
  versie: 1, bijgewerkt: '2026-09-30T14:02:11+02:00', elearning: '0.1.0', ...extra,
});

test('RC-5: na 5 opslagen zijn er 5 versies en loopt versie 1…5', () => {
  const store = maakStore(geheugenOpslag());
  for (let i = 1; i <= 5; i += 1) store.save(record({ gebruiker: `versie ${i}` }));
  const versies = store.versions('EV-01');
  assert.equal(versies.length, 5);
  assert.deepEqual(versies.map((v) => v.versie), [1, 2, 3, 4, 5]);
  assert.deepEqual(versies.map((v) => v.inhoud.gebruiker), ['versie 1', 'versie 2', 'versie 3', 'versie 4', 'versie 5']);
});

test('RC-5: de store bepaalt versie zelf; een meegegeven versie wordt genegeerd', () => {
  const store = maakStore(geheugenOpslag());
  const eerste = store.save(record({ gebruiker: 'a' }, { versie: 42 }));
  assert.equal(eerste.versie, 1);
  assert.equal(store.save(record({ gebruiker: 'b' }, { versie: 1 })).versie, 2);
});

test('RC-6: alle versies zijn raadpleegbaar en get geeft de nieuwste', () => {
  const store = maakStore(geheugenOpslag());
  assert.equal(store.get('EV-01'), undefined);
  assert.deepEqual(store.versions('EV-01'), []);
  for (let i = 1; i <= 5; i += 1) store.save(record({ gebruiker: `v${i}` }));
  assert.equal(store.get('EV-01').inhoud.gebruiker, 'v5');
  assert.equal(store.versions('EV-01')[0].inhoud.gebruiker, 'v1');
});

test('store: wat je teruggeeft is een kopie; wijzigen ervan verandert de opslag niet', () => {
  const store = maakStore(geheugenOpslag());
  store.save(record({ gebruiker: 'origineel' }));
  store.get('EV-01').inhoud.gebruiker = 'gewijzigd';
  store.versions('EV-01')[0].inhoud.gebruiker = 'gewijzigd';
  assert.equal(store.get('EV-01').inhoud.gebruiker, 'origineel');
});

test('RC-1/RC-3: een ongeldig record of een record met alias wordt geweigerd en niet bewaard', () => {
  const store = maakStore(geheugenOpslag());
  assert.throws(() => store.save(record({ gebruiker: 'x', alias: 'Kim' })), /alias/);
  assert.throws(() => store.save({ id: 'EV-01' }), /ongeldig/);
  assert.equal(store.get('EV-01'), undefined);
});

test('store: id\'s en versies per bewijsonderdeel staan los van elkaar', () => {
  const store = maakStore(geheugenOpslag());
  store.save(record({ gebruiker: 'a' }));
  store.save(maakRecord({ taakdef: { id: 'EV-02', taak: '2.2', leerblok: 1, luk: [1], bc: ['BC1'] }, inhoud: { mis: 'x' },
    controles: [], status: 'nog niet', versie: 1, bijgewerkt: '2026-09-30T14:02:11Z', elearning: '0.1.0' }));
  assert.deepEqual(store.ids(), ['EV-01', 'EV-02']);
  assert.equal(store.versions('EV-02').length, 1);
});

test('ST-6: clear verwijdert alles van de site (records en meta) en laat andere sleutels staan', () => {
  const opslag = geheugenOpslag();
  opslag.setItem('andere-site', 'blijft');
  const store = maakStore(opslag);
  store.save(record({ gebruiker: 'a' }));
  store.setMeta('profiel', { alias: 'Kim' });
  store.setMeta('oefening:2.1', { invoer: { gebruiker: 'x' } });
  assert.equal(store.clear(), 3);
  assert.equal(opslag.length, 1);
  assert.equal(opslag.getItem('andere-site'), 'blijft');
  assert.equal(store.get('EV-01'), undefined);
  assert.equal(store.getMeta('profiel'), undefined);
  assert.deepEqual(store.ids(), []);
});

test('store: alle sleutels van de site beginnen met het voorvoegsel', () => {
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  store.save(record({ gebruiker: 'a' }));
  store.setMeta('x', 1);
  for (let i = 0; i < opslag.length; i += 1) assert.ok(opslag.key(i).startsWith(PREFIX));
});

test('DS-1: een tweede store op dezelfde opslag ziet alles terug (herladen)', () => {
  const opslag = geheugenOpslag();
  maakStore(opslag).save(record({ gebruiker: 'blijft' }));
  maakStore(opslag).setMeta('profiel', { alias: 'Kim' });
  const na = maakStore(opslag);
  assert.equal(na.get('EV-01').inhoud.gebruiker, 'blijft');
  assert.equal(na.getMeta('profiel').alias, 'Kim');
});

test('store: kapotte JSON in de opslag geeft een lege uitkomst en geen fout', () => {
  const opslag = geheugenOpslag();
  opslag.setItem(`${PREFIX}rec:EV-01`, '{kapot');
  opslag.setItem(`${PREFIX}meta:profiel`, '{kapot');
  const store = maakStore(opslag);
  assert.equal(store.get('EV-01'), undefined);
  assert.equal(store.getMeta('profiel'), undefined);
});

test('kiesOpslag: bruikbare opslag wordt gebruikt; geblokkeerde opslag valt terug op geheugen', () => {
  const echt = geheugenOpslag();
  assert.deepEqual({ ...kiesOpslag({ localStorage: echt }), opslag: undefined }, { opslag: undefined, geblokkeerd: false });
  const geblokkeerd = { get localStorage() { throw new Error('SecurityError'); } };
  const r = kiesOpslag(geblokkeerd);
  assert.equal(r.geblokkeerd, true);
  r.opslag.setItem('a', '1');
  assert.equal(r.opslag.getItem('a'), '1');
});
