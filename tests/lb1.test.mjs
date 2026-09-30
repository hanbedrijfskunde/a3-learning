import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  minWoordenAanwezig, kapitaalNietFinancieel, precies1Keuze, verschillendeFrames, verschiltVanCasus, stelVraagSamen,
} from '../js/checks/lb1.js';
import { voerUit } from '../js/checks/core.js';
import { bouwControles, bouwControle } from '../js/checks/index.js';
import { bepaalStatus } from '../js/status.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blok = JSON.parse(readFileSync(resolve(root, 'data/leerblok-1.json'), 'utf8'));
const taak = (id) => blok.taken.find((t) => t.id === id);

const bevries = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && bevries(v)); return Object.freeze(o); };
const KAPITALEN = ['financieel', 'productie', 'intellectueel', 'menselijk', 'sociaal en relationeel', 'natuurlijk'];
const FRAMES = ['functioneel', 'intern of extern', 'theoretisch of empirisch'];
const CONTEXT_211 = { taak: taak('2.1') };

/** QA-2: per controle 3 goede en 3 zwakke voorbeelden. [invoer, verwacht, deel van de melding] */
const CONTROLES = {
  minWoordenAanwezig: {
    controle: minWoordenAanwezig({ id: 'g', veld: 'gebruiker', label: 'de gebruiker', min: 4 }), soort: 'A',
    goed: [
      [{ gebruiker: 'terugkerende klanten van webshop X' }, 'ok'],
      [{ gebruiker: 'de controller en de afdelingshoofden' }, 'ok'],
      [{ gebruiker: '  vier woorden staan hier  ' }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Schrijf de gebruiker: minstens 4 woorden.'],
      [{ gebruiker: '   ' }, 'mist', 'minstens 4 woorden'],
      [{ gebruiker: 'klanten' }, 'let op', 'De gebruiker heeft minder dan 4 woorden'],
    ],
  },
  kapitaalNietFinancieel: {
    controle: kapitaalNietFinancieel({ id: 'k', veld: 'kapitalen', toegestaan: KAPITALEN }), soort: 'A',
    goed: [
      [{ kapitalen: ['sociaal en relationeel'] }, 'ok'],
      [{ kapitalen: ['financieel', 'menselijk'] }, 'ok'],
      [{ kapitalen: ['natuurlijk', 'financieel', 'productie'] }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Kies een kapitaal'],
      [{ kapitalen: [] }, 'mist', 'Kies een kapitaal'],
      [{ kapitalen: ['financieel'] }, 'let op', 'alleen het financiële kapitaal'],
    ],
  },
  precies1Keuze: {
    controle: precies1Keuze({ id: 'm', veld: 'model', label: 'model', toegestaan: ['7S', 'Strategy Map', 'Six Capitals', 'TOM-model'] }), soort: 'A',
    goed: [
      [{ model: '7S' }, 'ok'],
      [{ model: 'Strategy Map' }, 'ok'],
      [{ model: ['TOM-model'] }, 'ok'],
    ],
    zwak: [
      [{}, 'mist', 'Kies één model uit de lijst'],
      [{ model: 'PESTEL' }, 'mist', 'Kies één model uit de lijst'],
      [{ model: ['7S', 'Six Capitals'] }, 'let op', 'Kies precies één model, niet 2'],
    ],
  },
  verschillendeFrames: {
    controle: verschillendeFrames({ id: 'f', velden: ['frame1', 'frame2', 'frame3'] }), soort: 'B',
    goed: [
      [{ frame1: FRAMES[0], frame2: FRAMES[1], frame3: FRAMES[2] }, 'ok'],
      [{ frame1: FRAMES[2], frame2: FRAMES[0] }, 'ok'],
      [{}, 'ok'],
    ],
    zwak: [
      [{ frame1: FRAMES[0], frame2: FRAMES[0], frame3: FRAMES[2] }, 'let op', 'hetzelfde frame'],
      [{ frame1: FRAMES[1], frame2: FRAMES[2], frame3: FRAMES[1] }, 'let op', 'hetzelfde frame'],
      [{ frame1: FRAMES[2], frame2: FRAMES[2] }, 'let op', 'kies voor elke zoekvraag een ander frame'],
    ],
  },
  verschiltVanCasus: {
    controle: verschiltVanCasus({ id: 'c', velden: ['gebruiker', 'pain', 'waarde'] }), soort: 'B', context: CONTEXT_211,
    goed: [
      [{ gebruiker: 'studenten van HBO-V', pain: 'sneller een stageplek te vinden', waarde: 'het studiesucces stijgt' }, 'ok'],
      [{ gebruiker: 'terugkerende klanten van webshop Y', pain: 'weer een aankoopervaring te krijgen die ze minstens een 8 geven (nu een 6,3)', waarde: 'de klantrelatie herstelt (sociaal en relationeel kapitaal) en de omzet uit herhaalaankopen stijgt (financieel kapitaal)' }, 'ok'],
      [{}, 'ok'],
    ],
    zwak: [
      [{ gebruiker: 'terugkerende klanten van webshop X', pain: 'weer een aankoopervaring te krijgen die ze minstens een 8 geven (nu een 6,3)', waarde: 'de klantrelatie herstelt (sociaal en relationeel kapitaal) en de omzet uit herhaalaankopen stijgt (financieel kapitaal)' }, 'let op', 'precies die van de oefencasus'],
      [{ gebruiker: 'Terugkerende klanten van webshop X.', pain: 'Weer een aankoopervaring te krijgen die ze minstens een 8 geven (nu een 6,3)', waarde: 'De klantrelatie herstelt (sociaal en relationeel kapitaal) en de omzet uit herhaalaankopen stijgt (financieel kapitaal)?' }, 'let op', 'oefencasus'],
      [{ gebruiker: '  terugkerende   klanten van webshop X ', pain: 'weer een aankoopervaring te krijgen die ze minstens een 8 geven (nu een 6,3)', waarde: 'de klantrelatie herstelt (sociaal en relationeel kapitaal) en de omzet uit herhaalaankopen stijgt (financieel kapitaal)' }, 'let op', 'eigen vraagstuk'],
    ],
  },
};

for (const [naam, h] of Object.entries(CONTROLES)) {
  test(`QA-2: ${naam} heeft 3 goede en 3 zwakke voorbeelden`, () => {
    assert.equal(h.goed.length, 3);
    assert.equal(h.zwak.length, 3);
    for (const [invoer, verwacht] of h.goed) {
      const r = h.controle(bevries(structuredClone(invoer)), h.context ?? {});
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.equal(r.soort, h.soort);
      assert.equal(r.melding, '');
    }
    for (const [invoer, verwacht, deel] of h.zwak) {
      const r = h.controle(bevries(structuredClone(invoer)), h.context ?? {});
      assert.equal(r.resultaat, verwacht, JSON.stringify(invoer));
      assert.equal(r.soort, h.soort);
      assert.ok(r.melding.includes(deel), `melding "${r.melding}" mist "${deel}"`); // BW-9
      assert.ok(r.melding.endsWith('.'));
    }
  });
}

test('BW-8: de controles van leerblok 1 roepen geen netwerk aan en hebben geen neveneffecten', () => {
  const fetchOrigineel = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('netwerk aangeroepen'); };
  try {
    for (const t of blok.taken) {
      const invoer = bevries({ gebruiker: 'a b c d', pain: 'e f g h', waarde: 'i j k l', kapitalen: ['menselijk'], frame1: 'functioneel', zoekvraag1: 'x?', model: '7S' });
      const controles = bouwControles(t.controles, t.toepassing.velden);
      const a = voerUit(controles, invoer, { taak: t });
      const b = voerUit(controles, invoer, { taak: t });
      assert.deepEqual(a, b); // geen toeval, geen toestand
    }
  } finally { globalThis.fetch = fetchOrigineel; }
});

test('LB-2: het live voorbeeld stelt de vraag samen en houdt lege delen als plaatshouder', () => {
  assert.equal(stelVraagSamen({}), 'Wat is de beste oplossing voor <gebruiker> om <probleem / pain / gain>, zodat <waardecreatie>?');
  assert.equal(
    stelVraagSamen({ gebruiker: 'planners', pain: 'sneller te plannen.', waarde: 'de klant tevreden is?' }),
    'Wat is de beste oplossing voor planners om sneller te plannen, zodat de klant tevreden is?',
  );
  assert.equal(stelVraagSamen({ gebruiker: 'planners' }), 'Wat is de beste oplossing voor planners om <probleem / pain / gain>, zodat <waardecreatie>?');
});

test('bouwControle: onbekend type en een afwijkende soort in de data geven een fout', () => {
  assert.throws(() => bouwControle({ id: 'x', soort: 'A', type: 'bestaatNiet' }), /onbekend type/);
  // minWoorden is altijd soort C (BW-11); staat er in de data A, dan is het bestand fout.
  const verkeerd = bouwControle({ id: 'x', soort: 'A', type: 'minWoorden', veld: 'a', label: 'a', min: 1 });
  assert.throws(() => verkeerd({ a: 'iets' }), /terwijl de data A zegt/);
});

test('bouwControle: opties van het veld zijn de toegestane keuzes als de declaratie ze niet zelf noemt', () => {
  const velden = [{ id: 'model', type: 'keuze', opties: ['7S', 'Strategy Map'] }];
  const c = bouwControle({ id: 'm', soort: 'A', type: 'precies1Keuze', veld: 'model', label: 'model' }, velden);
  assert.equal(c({ model: '7S' }).resultaat, 'ok');
  assert.equal(c({ model: 'TOM-model' }).resultaat, 'mist');
});

// ------------------------------------------------------------ de controlesets van EV-01 en EV-02 als geheel

const evStatus = (id, invoer) => {
  const t = taak(id);
  return bepaalStatus(voerUit(bouwControles(t.controles, t.toepassing.velden), invoer, { taak: t }));
};
const EV01 = { gebruiker: 'de planners van de afdeling', pain: 'sneller de roosters te maken', waarde: 'medewerkers minder stress hebben', kapitalen: ['menselijk'] };
const EV02 = {
  frame1: 'functioneel', zoekvraag1: 'Welke factoren spelen bij roosteren?',
  frame2: 'intern of extern', zoekvraag2: 'In hoeverre werkt het rooster intern?',
  frame3: 'theoretisch of empirisch', zoekvraag3: 'Wat zegt de literatuur over roosteren?',
  model: '7S', verantwoording: 'Het model past bij het vraagstuk.', mis: 'Je mist de kant van de klant.',
};

test('EV-01: Compleet alleen als alle drie de velden ≥ 4 woorden hebben, een niet-financieel kapitaal is gekozen en de vraag afwijkt', () => {
  assert.equal(evStatus('2.1', EV01), 'compleet');
  assert.equal(evStatus('2.1', {}), 'nog niet');
  assert.equal(evStatus('2.1', { ...EV01, gebruiker: 'planners' }), 'bijna'); // 1 woord: let op
  assert.equal(evStatus('2.1', { ...EV01, pain: '' }), 'nog niet');
  assert.equal(evStatus('2.1', { ...EV01, kapitalen: ['financieel'] }), 'bijna');
  assert.equal(evStatus('2.1', { ...EV01, kapitalen: [] }), 'nog niet');
  assert.equal(evStatus('2.1', { ...EV01, ...taak('2.1').modelantwoord.velden }), 'bijna'); // letterlijk de casus
});

test('EV-02: Compleet alleen bij drie verschillende frames, vraagtekens, één model met verantwoording en het antwoord op wat je mist', () => {
  assert.equal(evStatus('2.2', EV02), 'compleet');
  assert.equal(evStatus('2.2', {}), 'nog niet');
  assert.equal(evStatus('2.2', { ...EV02, frame2: 'functioneel' }), 'bijna'); // twee keer hetzelfde frame
  assert.equal(evStatus('2.2', { ...EV02, zoekvraag3: 'Wat zegt de literatuur over roosteren' }), 'bijna'); // geen vraagteken
  assert.equal(evStatus('2.2', { ...EV02, model: undefined }), 'nog niet');
  assert.equal(evStatus('2.2', { ...EV02, verantwoording: '' }), 'bijna'); // soort C mist
  assert.equal(evStatus('2.2', { ...EV02, mis: '' }), 'nog niet');
  assert.equal(evStatus('2.2', { ...EV02, model: ['7S', 'Strategy Map'] }), 'bijna');
});

test('de controles in de data hebben elk drie goede en drie zwakke voorbeelden of een fabriek die die heeft', () => {
  // Elk type dat in leerblok 1 wordt gebruikt is hierboven of in core.test.mjs (QA-2) gedekt.
  const gebruikt = new Set(blok.taken.flatMap((t) => t.controles.map((c) => c.type)));
  const gedekt = new Set([...Object.keys(CONTROLES), 'veldGevuld', 'keuzeUitLijst', 'eindigtOp', 'minWoorden', 'minZinnen',
    'nietGelijkAanWissel']); // de laatste: QA-2-voorbeelden in wissel.test.mjs (fase 4)
  for (const type of gebruikt) assert.ok(gedekt.has(type), `${type} heeft geen QA-2-voorbeelden`);
});
