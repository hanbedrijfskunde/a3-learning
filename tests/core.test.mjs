import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  telWoorden, telZinnen, tellers, resultaat, voerUit,
  veldGevuld, keuzeUitLijst, eindigtOp, minWoorden, minZinnen,
} from '../js/checks/core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Diep bevroren invoer: een controle die de invoer wijzigt, gooit een fout (BW-8: geen neveneffecten).
const bevries = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && bevries(v)); return Object.freeze(o); };

/**
 * QA-2: per helper 3 goede en 3 zwakke voorbeelden.
 * Elk voorbeeld: [invoer, verwacht resultaat, deel van de verwachte melding (bij niet-ok)].
 */
const HELPERS = {
  veldGevuld: {
    controle: veldGevuld({ id: 'gebruiker-gevuld', veld: 'gebruiker', label: 'de gebruiker' }),
    soort: 'A',
    goed: [
      [{ gebruiker: 'Een klantenservicemedewerker' }, 'ok'],
      [{ gebruiker: 'Studenten HBO-V' }, 'ok'],
      [{ gebruiker: '  planner  ' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Vul de gebruiker in.'],
      [{ gebruiker: '   ' }, 'mist', 'Vul de gebruiker in.'],
      [{ gebruiker: 'x' }, 'let op', 'De gebruiker is erg kort'],
    ],
  },
  keuzeUitLijst: {
    controle: keuzeUitLijst({ id: 'kapitaal-gekozen', veld: 'kapitalen', label: 'een kapitaal', toegestaan: ['financieel', 'sociaal', 'intellectueel'] }),
    soort: 'A',
    goed: [
      [{ kapitalen: ['sociaal'] }, 'ok'],
      [{ kapitalen: ['financieel', 'intellectueel'] }, 'ok'],
      [{ kapitalen: 'sociaal' }, 'ok'],
    ],
    zwak: [
      [{ kapitalen: [] }, 'mist', 'Kies een kapitaal uit de lijst: financieel, sociaal, intellectueel.'],
      [{ kapitalen: ['geluk'] }, 'mist', 'Kies een kapitaal uit de lijst'],
      [{ kapitalen: ['sociaal', 'geluk'] }, 'let op', 'Een deel van je keuze staat niet in de lijst'],
    ],
  },
  eindigtOp: {
    controle: eindigtOp({ id: 'vraagteken', veld: 'zoekvraag', label: 'de zoekvraag', tekens: ['?'] }),
    soort: 'A',
    goed: [
      [{ zoekvraag: 'Wat is de doorlooptijd van retouren?' }, 'ok'],
      [{ zoekvraag: 'Waarom bellen klanten opnieuw?  ' }, 'ok'],
      [{ zoekvraag: '?' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Vul de zoekvraag in.'],
      [{ zoekvraag: 'Doorlooptijd van retouren' }, 'let op', 'De zoekvraag moet eindigen op "?".'],
      [{ zoekvraag: 'Wat is dit? Ik weet het niet.' }, 'let op', 'De zoekvraag moet eindigen op "?".'],
    ],
  },
  minWoorden: {
    controle: minWoorden({ id: 'pain-woorden', veld: 'pain', label: 'het probleem', min: 4 }),
    soort: 'C',
    goed: [
      [{ pain: 'klanten wachten te lang' }, 'ok'],
      [{ pain: 'Retouren komen drie weken te laat aan.' }, 'ok'],
      [{ pain: 'a b c d' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Schrijf het probleem: minstens 4 woorden.'],
      [{ pain: '   ' }, 'mist', 'Schrijf het probleem: minstens 4 woorden.'],
      [{ pain: 'te laat' }, 'let op', 'Het probleem heeft minder dan 4 woorden'],
    ],
  },
  minZinnen: {
    controle: minZinnen({ id: 'argument-zinnen', veld: 'argument', label: 'het argument', min: 2 }),
    soort: 'C',
    goed: [
      [{ argument: 'Dit klopt. Want de bron is recent.' }, 'ok'],
      [{ argument: 'Waarom? Omdat de data uit 2025 komt!' }, 'ok'],
      [{ argument: 'Eén. Twee. Drie.' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Schrijf het argument: minstens 2 zinnen.'],
      [{ argument: '...' }, 'mist', 'Schrijf het argument: minstens 2 zinnen.'],
      [{ argument: 'Alleen deze ene zin met 3.5 procent erin' }, 'let op', 'Het argument heeft minder dan 2 zinnen'],
    ],
  },
};

for (const [naam, h] of Object.entries(HELPERS)) {
  h.goed.forEach(([invoer, verwacht], i) => test(`QA-2 ${naam}: goed voorbeeld ${i + 1} → ${verwacht}`, () => {
    const r = h.controle(bevries(structuredClone(invoer)), {});
    assert.equal(r.resultaat, verwacht);
    assert.equal(r.melding, '');
    assert.equal(r.soort, h.soort);
  }));
  h.zwak.forEach(([invoer, verwacht, melding], i) => test(`QA-2 ${naam}: zwak voorbeeld ${i + 1} → ${verwacht}`, () => {
    const r = h.controle(bevries(structuredClone(invoer)), {});
    assert.equal(r.resultaat, verwacht);
    assert.ok(r.melding.startsWith(melding.replace(/\.$/, '')), `melding „${r.melding}" begint niet met „${melding}"`);
    assert.equal(r.soort, h.soort);
  }));
  test(`QA-2 ${naam}: 3 goede en 3 zwakke voorbeelden aanwezig`, () => {
    assert.equal(h.goed.length, 3);
    assert.equal(h.zwak.length, 3);
  });
}

test('contract: elk resultaat heeft id, soort, resultaat en melding', () => {
  const r = HELPERS.veldGevuld.controle({ gebruiker: 'planner' }, {});
  assert.deepEqual(Object.keys(r).sort(), ['id', 'melding', 'resultaat', 'soort']);
  assert.equal(r.id, 'gebruiker-gevuld');
});

test('BW-9: bij let op of mist altijd één zin die zegt wat ontbreekt', () => {
  for (const h of Object.values(HELPERS)) for (const [invoer] of h.zwak) {
    const r = h.controle(invoer, {});
    assert.notEqual(r.resultaat, 'ok');
    assert.ok(r.melding.trim().length > 0, 'lege melding');
    assert.equal((r.melding.match(/[.!?](\s|$)/g) ?? []).length, 1, `geen enkele zin: „${r.melding}"`);
  }
});

test('BW-9: resultaat() weigert let op of mist zonder melding', () => {
  assert.throws(() => resultaat('x', 'A', 'mist'), /zonder melding/);
  assert.throws(() => resultaat('x', 'A', 'let op', '  '), /zonder melding/);
  assert.equal(resultaat('x', 'A', 'ok').melding, '');
  assert.throws(() => resultaat('x', 'D', 'ok'), RangeError);
  assert.throws(() => resultaat('x', 'A', 'goed'), RangeError);
});

test('BW-8: controles roepen geen netwerk aan (fetch geblokkeerd)', () => {
  const aanroepen = [];
  const echteFetch = globalThis.fetch;
  const echteXhr = globalThis.XMLHttpRequest;
  globalThis.fetch = (...a) => { aanroepen.push(a); throw new Error('netwerk geblokkeerd'); };
  globalThis.XMLHttpRequest = function () { aanroepen.push(['xhr']); throw new Error('netwerk geblokkeerd'); };
  try {
    for (const h of Object.values(HELPERS)) {
      for (const [invoer] of [...h.goed, ...h.zwak]) h.controle(bevries(structuredClone(invoer)), {});
    }
    telWoorden('een twee'); telZinnen('Een. Twee.');
  } finally {
    globalThis.fetch = echteFetch;
    globalThis.XMLHttpRequest = echteXhr;
  }
  assert.equal(aanroepen.length, 0);
});

test('BW-8: controles zijn deterministisch en veranderen de invoer niet', () => {
  for (const h of Object.values(HELPERS)) for (const [invoer] of [...h.goed, ...h.zwak]) {
    const kopie = structuredClone(invoer);
    const eerste = h.controle(bevries(invoer), {});
    assert.deepEqual(invoer, kopie);
    assert.deepEqual(h.controle(kopie, {}), eerste);
  }
});

test('BW-8: core.js bevat geen verwijzing naar netwerk, DOM of opslag', () => {
  const bron = readFileSync(resolve(root, 'js/checks/core.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const verboden of ['fetch', 'XMLHttpRequest', 'WebSocket', 'document', 'window', 'localStorage', 'sessionStorage', 'Math.random', 'Date.now', 'new Date']) {
    assert.ok(!bron.includes(verboden), `core.js bevat ${verboden}`);
  }
});

test('BW-11: soort C roept alleen telWoorden en telZinnen aan', () => {
  const gebruikt = [];
  const origineel = { ...tellers };
  for (const naam of Object.keys(tellers)) tellers[naam] = (...a) => { gebruikt.push(naam); return origineel[naam](...a); };
  try {
    for (const h of Object.values(HELPERS).filter((x) => x.soort === 'C')) {
      for (const [invoer] of [...h.goed, ...h.zwak]) h.controle(invoer, {});
    }
  } finally { Object.assign(tellers, origineel); }
  assert.deepEqual(Object.keys(tellers).sort(), ['telWoorden', 'telZinnen']);
  assert.ok(gebruikt.length > 0);
  assert.ok(gebruikt.every((n) => n === 'telWoorden' || n === 'telZinnen'));
});

test('BW-11: soort C oordeelt niet over inhoud; alleen het aantal telt', () => {
  const woorden = minWoorden({ id: 'w', veld: 't', label: 'tekst', min: 4 });
  const zinnen = minZinnen({ id: 'z', veld: 't', label: 'tekst', min: 2 });
  // Zelfde aantal woorden of zinnen, tegengestelde kwaliteit: zelfde uitkomst.
  const goed = 'Omdat klanten daardoor sneller geholpen worden.';
  const onzin = 'blabla lorem ipsum dolor sit amet foo.';
  assert.equal(telWoorden(goed) >= 4 && telWoorden(onzin) >= 4, true);
  assert.deepEqual(woorden({ t: goed }), woorden({ t: onzin }));
  assert.equal(zinnen({ t: 'Goed onderbouwd. Met bron.' }).resultaat, zinnen({ t: 'asdf. qwerty.' }).resultaat);
});

test('BW-11: soort C is vast; een ander soort of een eigen oordeel is niet mogelijk', () => {
  // minWoorden/minZinnen nemen geen soort en geen predicaat aan: extra opties hebben geen effect.
  const c = minWoorden({ id: 'w', veld: 't', label: 'tekst', min: 1, soort: 'A', oordeel: () => 'mist' });
  const r = c({ t: 'iets' });
  assert.equal(r.soort, 'C');
  assert.equal(r.resultaat, 'ok');
});

test('telWoorden en telZinnen: randgevallen', () => {
  assert.equal(telWoorden(''), 0);
  assert.equal(telWoorden(undefined), 0);
  assert.equal(telWoorden('  een   twee\ndrie '), 3);
  assert.equal(telWoorden('- — …'), 0);
  assert.equal(telWoorden('EV-01 telt 3,5 keer'), 4);
  assert.equal(telZinnen(''), 0);
  assert.equal(telZinnen('Eén zin zonder punt'), 1);
  assert.equal(telZinnen('Prijs is 3.5 euro. Dat is veel!'), 2);
  assert.equal(telZinnen('Echt?! Ja... Nee.'), 3);
});

test('voerUit: voert een lijst controles uit', () => {
  const uit = voerUit([HELPERS.veldGevuld.controle, HELPERS.minWoorden.controle], { gebruiker: 'planner', pain: 'te laat' }, {});
  assert.deepEqual(uit.map((r) => r.resultaat), ['ok', 'let op']);
});
