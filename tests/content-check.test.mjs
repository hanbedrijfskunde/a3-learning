import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleerLeerblok, controleerMap } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = (naam) => resolve(root, 'tests/fixtures', naam);
const draai = (map) => spawnSync(process.execPath, [resolve(root, 'tools/content-check.mjs'), ...(map ? [map] : [])], { encoding: 'utf8' });

test('QA-3: een volledige fixture geeft 0 fouten', () => {
  const { bestanden, fouten } = controleerMap(fixtures('content-goed'));
  assert.equal(bestanden, 1);
  assert.deepEqual(fouten, []);
});

test('QA-3: vier ontbrekende onderdelen (LUK, klaar als, controle, modelantwoord) geven vier fouten met het taaknummer', () => {
  const { fouten } = controleerMap(fixtures('content-vier-fouten'));
  assert.equal(fouten.length, 4, fouten.join('\n'));
});

test('QA-3: elke fout noemt de taak', () => {
  const { fouten } = controleerMap(fixtures('content-vier-fouten'));
  assert.ok(fouten.some((f) => f.includes('taak 2.1') && f.includes('LUK-koppeling')));
  assert.ok(fouten.some((f) => f.includes('taak 2.2') && f.includes('klaar als')));
  assert.ok(fouten.some((f) => f.includes('taak 3.1') && f.includes('controle')));
  assert.ok(fouten.some((f) => f.includes('taak 3.2') && f.includes('modelantwoord')));
});

test('QA-3: het commando faalt (exit 1) op de fixture met fouten en noemt de taken', () => {
  const r = draai(fixtures('content-vier-fouten'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /taak 2\.2 mist een „klaar als"/);
});

test('QA-3: het commando slaagt (exit 0) op de volledige fixture en op de lege data/', () => {
  assert.equal(draai(fixtures('content-goed')).status, 0);
  assert.equal(draai().status, 0);
});

test('BW-12: een bewijsonderdeel zonder LUK-onderdeel geeft een fout', () => {
  const inhoud = {
    taken: [{ id: '2.1', luk: [1], bc: ['BC1'], klaarAls: 'x', modelantwoord: 'y', controles: [{ id: 'a', soort: 'A' }] }],
    bewijsonderdelen: [{ id: 'EV-01', taak: '2.1', lukOnderdelen: [] }],
  };
  const fouten = controleerLeerblok(inhoud, 'leerblok-1.json');
  assert.equal(fouten.length, 1);
  assert.match(fouten[0], /EV-01 mist een LUK-onderdeel/);
});

test('BW-12: een bewijsonderdeel dat naar een onbekende taak verwijst geeft een fout', () => {
  const inhoud = {
    taken: [{ id: '2.1', luk: [1], bc: ['BC1'], klaarAls: 'x', modelantwoord: 'y', controles: [{ id: 'a', soort: 'A' }] }],
    bewijsonderdelen: [{ id: 'EV-01', taak: '9.9', lukOnderdelen: ['LUK 1'] }],
  };
  assert.match(controleerLeerblok(inhoud, 'b.json')[0], /onbekende taak 9\.9/);
});

test('QA-3: een bestand zonder taken of met kapotte JSON valt op', () => {
  assert.equal(controleerLeerblok({}, 'leerblok-2.json').length, 1);
});
