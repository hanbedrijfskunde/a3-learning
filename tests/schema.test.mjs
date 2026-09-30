import test from 'node:test';
import assert from 'node:assert/strict';
import { VELDEN, valideer, maakRecord } from '../js/schema.js';

const taakdef = { id: 'EV-01', taak: '2.1', leerblok: 1, luk: [1], bc: ['BC1'] };

const geldigRecord = () => ({
  schema: '1.0',
  id: 'EV-01',
  taak: '2.1',
  leerblok: 1,
  luk: [1],
  bc: ['BC1'],
  inhoud: { gebruiker: 'planner', pain: 'wachttijd', waarde: 'sneller', kapitalen: ['sociaal'] },
  controles: [{ id: 'velden-gevuld', resultaat: 'ok' }, { id: 'niet-financieel-kapitaal', resultaat: 'ok' }],
  status: 'compleet',
  voorlopig: false,
  versie: 3,
  bijgewerkt: '2026-09-30T14:02:11+02:00',
  elearning: '0.1.0',
});

test('RC-1: het schema heeft 13 velden', () => {
  assert.equal(VELDEN.length, 13);
  assert.deepEqual(Object.keys(geldigRecord()), [...VELDEN]);
});

test('RC-1: een geldig record valideert', () => {
  assert.deepEqual(valideer(geldigRecord()), { geldig: true, fouten: [] });
  assert.equal(valideer(geldigRecord(), taakdef).geldig, true);
});

for (const veld of VELDEN) {
  test(`RC-1: record zonder ${veld} → foutmelding met het ontbrekende veld`, () => {
    const r = geldigRecord();
    delete r[veld];
    const uit = valideer(r);
    assert.equal(uit.geldig, false);
    assert.ok(uit.fouten.includes(`Veld ontbreekt: ${veld}.`), uit.fouten.join(' | '));
  });
}

test('RC-1: een veld te veel, of een verkeerd type, wordt afgewezen', () => {
  assert.equal(valideer({ ...geldigRecord(), extra: 1 }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), versie: 0 }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), status: 'goed' }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), voorlopig: 'nee' }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), bijgewerkt: '2026-09-30' }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), schema: '2.0' }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), controles: [{ id: 'a', resultaat: 'goed' }] }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), controles: [{ id: 'a', resultaat: 'ok', melding: 'x' }] }).geldig, false);
  assert.equal(valideer(null).geldig, false);
  assert.equal(valideer([]).geldig, false);
});

test('RC-2: luk en bc komen uit de taakdefinitie', () => {
  const r = maakRecord({
    taakdef, inhoud: { gebruiker: 'x' }, controles: [{ id: 'a', soort: 'A', resultaat: 'ok', melding: '' }],
    status: 'compleet', versie: 1, bijgewerkt: '2026-09-30T14:02:11+02:00', elearning: '0.1.0',
  });
  assert.deepEqual(r.luk, [1]);
  assert.deepEqual(r.bc, ['BC1']);
  assert.deepEqual(r.controles, [{ id: 'a', resultaat: 'ok' }]);
  assert.equal(valideer(r, taakdef).geldig, true);
  r.luk.push(9); // de kopie in het record mag de taakdefinitie niet raken
  assert.deepEqual(taakdef.luk, [1]);
});

test('RC-2: luk of bc als invoer wordt geweigerd; een record met afwijkende luk of bc valt door de mand', () => {
  const basis = { taakdef, inhoud: {}, controles: [], status: 'nog niet', versie: 1, bijgewerkt: '2026-09-30T14:02:11+02:00', elearning: '0.1.0' };
  assert.throws(() => maakRecord({ ...basis, luk: [1, 2] }), /taakdefinitie/);
  assert.throws(() => maakRecord({ ...basis, bc: ['BC9'] }), /taakdefinitie/);
  const uit = valideer({ ...geldigRecord(), luk: [2], bc: ['BC2'] }, taakdef);
  assert.equal(uit.geldig, false);
  assert.ok(uit.fouten.some((f) => f.includes('luk')) && uit.fouten.some((f) => f.includes('bc')));
});

test('RC-3: alias, naam of teamnummer in inhoud wordt geweigerd (ook genest)', () => {
  for (const sleutel of ['alias', 'naam', 'teamnummer', 'Alias']) {
    const uit = valideer({ ...geldigRecord(), inhoud: { gebruiker: 'x', [sleutel]: 'Jan' } });
    assert.equal(uit.geldig, false, sleutel);
  }
  assert.equal(valideer({ ...geldigRecord(), inhoud: { lijst: [{ naam: 'Jan' }] } }).geldig, false);
  assert.equal(valideer({ ...geldigRecord(), alias: 'Jan' }).geldig, false); // ook op recordniveau: onbekend veld
  assert.equal(valideer({ ...geldigRecord(), inhoud: { bedrijfsnaam: 'X' } }).geldig, true);
});

test('RC-4: controles binnen inhoud worden afgewezen', () => {
  const r = geldigRecord();
  r.inhoud.controles = [{ id: 'a', resultaat: 'ok' }];
  const uit = valideer(r);
  assert.equal(uit.geldig, false);
  assert.ok(uit.fouten.some((f) => f.includes('RC-4')));
});

test('RC-4: inhoud en controles zijn twee gescheiden velden in een gebouwd record', () => {
  const r = maakRecord({
    taakdef, inhoud: { gebruiker: 'x' }, controles: [{ id: 'a', soort: 'A', resultaat: 'ok' }],
    status: 'compleet', versie: 1, bijgewerkt: '2026-09-30T14:02:11+02:00', elearning: '0.1.0',
  });
  assert.ok('inhoud' in r && 'controles' in r);
  assert.equal('controles' in r.inhoud, false);
});
