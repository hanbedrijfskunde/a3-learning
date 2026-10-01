// B-1 (ADR B107): onzin als „bla bla bla?” mag niet Compleet worden (optie 2), en de docent ziet korte of herhalende antwoorden
// op de verificatiepagina (optie 4). Tellen blijft tellen (BW-11): de site beoordeelt geen kwaliteit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../js/checks/index.js';
import { telVerschillendeWoorden, eigenWoorden, voerUit } from '../js/checks/core.js';
import { bouwControles } from '../js/checks/register.js';
import { bepaalStatus } from '../js/status.js';
import { signalenVan } from '../js/dossier.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const blok = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));
const taak = (n, id) => blok(n).taken.find((t) => t.id === id);
const status = (t, invoer) => bepaalStatus(voerUit(bouwControles(t.controles, t.toepassing.velden), invoer, { taak: t }));

test('B107: telVerschillendeWoorden telt verschillende woorden van minstens 3 letters, zonder hoofdletters', () => {
  assert.equal(telVerschillendeWoorden('bla bla bla?'), 1);
  assert.equal(telVerschillendeWoorden('ja nee misschien?'), 2);
  assert.equal(telVerschillendeWoorden('hoe dan?'), 2);
  assert.equal(telVerschillendeWoorden('Wat kost een retour bij ons?'), 6);
  assert.equal(telVerschillendeWoorden('Klanten klanten KLANTEN zijn tevreden'), 3);
  assert.equal(telVerschillendeWoorden('Één café, één éénheid'), 3);
  assert.equal(telVerschillendeWoorden(undefined), 0);
});

test('B107 (QA-2): eigenWoorden geeft let op bij te weinig verschillende woorden en ok bij een leeg of geen tekstveld', () => {
  const c = eigenWoorden({ id: 'ew', veld: 'v', label: 'je zoekvraag', min: 3 });
  for (const v of ['Welke factoren bepalen tevredenheid?', 'Wat kost een retour?', 'Hoe snel leveren webshops?']) assert.equal(c({ v }).resultaat, 'ok', v);
  for (const v of ['', undefined, ['lijst']]) assert.equal(c({ v }).resultaat, 'ok', 'leeg of geen tekst: andere controles gaan daarover');
  for (const v of ['bla bla bla?', 'ja nee misschien?', 'hoe dan?']) {
    const r = c({ v });
    assert.equal(r.resultaat, 'let op', v);
    assert.equal(r.soort, 'A');
    assert.match(r.melding, /je zoekvraag/);
    assert.match(r.melding, /eigen woorden/);
  }
});

test('B107: bouwControles voegt per veld met eigenWoorden een controle toe; de onzin uit de proefsessie wordt Bijna, niet Compleet', () => {
  const t = taak(1, '2.2');
  const ids = bouwControles(t.controles, t.toepassing.velden).length;
  assert.equal(ids, t.controles.length + t.toepassing.velden.filter((v) => v.eigenWoorden).length);
  const goed = {
    frame1: 'functioneel', zoekvraag1: 'Welke factoren spelen bij roosteren?',
    frame2: 'intern of extern', zoekvraag2: 'In hoeverre werkt het rooster intern?',
    frame3: 'theoretisch of empirisch', zoekvraag3: 'Wat zegt de literatuur over roosteren?',
    model: '7S', verantwoording: 'Het model past bij het vraagstuk.', mis: 'Je mist de kant van de klant.',
  };
  assert.equal(status(t, goed), 'compleet');
  assert.equal(status(t, { ...goed, zoekvraag1: 'bla bla bla?', zoekvraag2: 'ja nee misschien?', zoekvraag3: 'hoe dan?' }), 'bijna');
  assert.equal(status(t, { ...goed, mis: 'veel veel' }), 'bijna');
});

test('B107: eigenWoorden staat op de zoekvragen (3) en op lopende tekst (4), niet op lijsten, componenten of korte gegevens', () => {
  const met = [1, 2, 3, 4].flatMap((n) => blok(n).taken.flatMap((t) => t.toepassing.velden.filter((v) => v.eigenWoorden).map((v) => `${t.id}.${v.id}=${v.eigenWoorden}`)));
  for (const verwacht of ['2.2.zoekvraag1=3', '2.2.zoekvraag2=3', '2.2.zoekvraag3=3', '2.2.mis=4', '4.2.oogst=4', '4.3.argument=4', '6.3.reflectie=4']) assert.ok(met.includes(verwacht), verwacht);
  for (const nooit of ['nietNoemen', 'prompt', 'b1apa', 'verbanden', 'markering', 'regels', 'tomS1', 'jaar', 'gebruiker']) assert.ok(!met.some((m) => m.split('=')[0].endsWith(`.${nooit}`)), nooit);
});

test('B107 (optie 4): signalenVan meldt antwoorden die kort of herhalend zijn, uit het record zelf', () => {
  const rec = (inhoud, controles = []) => ({ id: 'EV-02', inhoud, controles });
  assert.deepEqual(signalenVan(rec({ zoekvraag1: 'Welke factoren spelen bij roosteren in de zorg?' })), []);
  assert.deepEqual(signalenVan(rec({ mis: 'klant klant klant klant klant' })), [{ veld: 'mis', reden: 'herhalend' }]);
  assert.deepEqual(signalenVan(rec({ zoekvraag1: 'hoe dan?' }, [{ id: 'eigen-woorden-zoekvraag1', resultaat: 'let op' }])), [{ veld: 'zoekvraag1', reden: 'te weinig eigen woorden' }]);
  assert.deepEqual(signalenVan(undefined), []);
});

test('B107 (optie 4): de verificatiepagina toont het signaal als tekst in de cel', () => {
  const bron = lees('js/verificatie-pagina.js');
  assert.match(bron, /c\.signalen\?\.length/);
  assert.match(bron, /kort of herhalend/);
});

test('B107: de melding is goed Nederlands bij één woord en bij meer woorden', () => {
  const c = eigenWoorden({ id: 'ew', veld: 'v', label: 'je zoekvraag', min: 3 });
  assert.match(c({ v: 'bla bla?' }).melding, /nu staat er 1 verschillend woord,/);
  assert.match(c({ v: 'hoe dan?' }).melding, /nu staan er 2 verschillende woorden,/);
});
