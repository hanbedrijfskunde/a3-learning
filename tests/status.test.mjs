import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bepaalStatus, STATUS_TEKST } from '../js/status.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// De tabel uit §5 staat als data, los van de code die hij toetst.
const { regels } = JSON.parse(readFileSync(resolve(root, 'data/statustabel.json'), 'utf8'));
const UITKOMSTEN = ['ok', 'let op', 'mist'];

test('BW-5: de tabel bevat alle 27 combinaties, elk één keer', () => {
  assert.equal(regels.length, 27);
  const sleutels = new Set(regels.map((r) => `${r.A}|${r.B}|${r.C}`));
  assert.equal(sleutels.size, 27);
  for (const a of UITKOMSTEN) for (const b of UITKOMSTEN) for (const c of UITKOMSTEN) {
    assert.ok(sleutels.has(`${a}|${b}|${c}`), `combinatie ${a}|${b}|${c} ontbreekt`);
  }
  // Verdeling die volgt uit de regel: 15 nog niet (A of B mist), 2 compleet (A en B ok, C ok of let op), 10 bijna.
  const telling = (s) => regels.filter((r) => r.status === s).length;
  assert.deepEqual([telling('nog niet'), telling('bijna'), telling('compleet')], [15, 10, 2]);
});

for (const r of regels) {
  test(`BW-5: A ${r.A}, B ${r.B}, C ${r.C} → ${r.status}`, () => {
    const controles = [
      { id: 'a', soort: 'A', resultaat: r.A },
      { id: 'b', soort: 'B', resultaat: r.B },
      { id: 'c', soort: 'C', resultaat: r.C },
    ];
    assert.equal(bepaalStatus(controles), r.status);
  });
}

test('BW-5: meerdere controles per soort tellen mee (slechtste telt)', () => {
  const ok = (soort) => ({ id: 'x', soort, resultaat: 'ok' });
  assert.equal(bepaalStatus([ok('A'), ok('A'), { id: 'y', soort: 'A', resultaat: 'mist' }, ok('B'), ok('C')]), 'nog niet');
  assert.equal(bepaalStatus([ok('A'), ok('B'), ok('B'), { id: 'y', soort: 'C', resultaat: 'mist' }]), 'bijna');
  assert.equal(bepaalStatus([ok('A'), ok('B'), { id: 'y', soort: 'C', resultaat: 'let op' }, { id: 'z', soort: 'C', resultaat: 'let op' }]), 'compleet');
});

test('BW-5: voorrang „nog niet" boven „bijna" bij samenloop', () => {
  assert.equal(bepaalStatus([
    { id: 'a', soort: 'A', resultaat: 'let op' },
    { id: 'b', soort: 'B', resultaat: 'mist' },
    { id: 'c', soort: 'C', resultaat: 'mist' },
  ]), 'nog niet');
});

test('BW-5: zonder controles geen bewijs, dus „nog niet"', () => {
  assert.equal(bepaalStatus([]), 'nog niet');
});

test('BW-5: onbekende soort of onbekend resultaat wordt geweigerd', () => {
  assert.throws(() => bepaalStatus([{ id: 'x', soort: 'D', resultaat: 'ok' }]), RangeError);
  assert.throws(() => bepaalStatus([{ id: 'x', soort: 'A', resultaat: 'oke' }]), RangeError);
  assert.throws(() => bepaalStatus('ok'), TypeError);
});

test('BW-3: elke status heeft een zichtbare tekst', () => {
  assert.deepEqual(Object.values(STATUS_TEKST), ['Compleet', 'Bijna', 'Nog niet']);
});
