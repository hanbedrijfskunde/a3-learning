// Fase 4, subtask 4.7 (WS-6): op de dossierpagina staan de post-its van andere teams en de teamactie naast de individuele feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geheugenOpslag, maakStore } from '../js/store.js';
import { maakSessie } from '../js/sessie.js';
import { maakWissel, ROL_ANDER_TEAM } from '../js/wissel.js';
import { maakDossier, bouwFeedbackOverzicht, bouwAfdruk, veldLabels } from '../js/dossier.js';
import { waardeTekst } from '../js/weergave.js';
import '../js/checks/index.js'; // registreert alle controlefabrieken (PF-4: pagina's laden ze per leerblok)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const blok4 = lees('data/leerblok-4.json');
const luk = lees('data/luk.json');

function wisselMetFeedback() {
  const store = maakStore(geheugenOpslag());
  const sessie = maakSessie({ store, blok: blok4, elearning: '0.1.0' });
  const w = maakWissel({ store, sessie });
  w.voegRegelToe({ richting: 'ontvangen', rol: 'teamgenoot', zie: 'een heldere vraag', mis: 'een tweede frame', vraag: 'wat is het pain?', actie: 'tweede frame toevoegen', status: 'bezig' });
  w.voegRegelToe({ richting: 'gegeven', rol: 'medestudent', zie: 'drie zoekvragen' });
  w.voegRegelToe({ richting: 'ontvangen', rol: ROL_ANDER_TEAM, zie: 'veel tekst op het vel', mis: 'de kosten', vraag: 'wie betaalt dit?' });
  w.voegRegelToe({ richting: 'ontvangen', rol: ROL_ANDER_TEAM, zie: 'duidelijke kleuren' });
  w.zetTeamactie({ tekst: 'De kosten uitwerken op vel 2', status: 'open' });
  return { store, w };
}

test('WS-6/4.7: het dossier scheidt de individuele feedback (3 rollen) van de 2 post-its van andere teams en toont de teamactie', () => {
  const { store } = wisselMetFeedback();
  const f = bouwFeedbackOverzicht(store.get('EV-09'));
  assert.equal(f.heeftRecord, true);
  assert.equal(f.leeg, false);
  assert.deepEqual(f.individueel.ontvangen.map((r) => r.rol), ['teamgenoot']);
  assert.deepEqual(f.individueel.gegeven.map((r) => r.rol), ['medestudent']);
  assert.equal(f.anderTeam.length, 2);
  assert.ok(f.anderTeam.every((r) => r.rol === ROL_ANDER_TEAM));
  assert.equal(f.anderTeam[0].mis, 'de kosten');
  assert.equal(f.teamactie.tekst, 'De kosten uitwerken op vel 2');
  assert.equal(f.teamactie.status, 'open');
});

test('WS-6/4.7: zonder post-its of teamactie staan er 0 post-its en geen teamactie; zonder record is het overzicht leeg', () => {
  const store = maakStore(geheugenOpslag());
  const w = maakWissel({ store, sessie: maakSessie({ store, blok: blok4, elearning: '0.1.0' }) });
  w.voegRegelToe({ richting: 'gegeven', rol: 'coach', zie: 'een goed begin' });
  const f = bouwFeedbackOverzicht(store.get('EV-09'));
  assert.equal(f.anderTeam.length, 0);
  assert.equal(f.teamactie, null);
  assert.equal(f.individueel.gegeven.length, 1);
  const geen = bouwFeedbackOverzicht(undefined);
  assert.equal(geen.leeg, true);
  assert.equal(geen.heeftRecord, false);
  assert.equal(bouwFeedbackOverzicht({ inhoud: { regels: 'stuk', teamactie: 5 } }).leeg, true); // beschadigd record geeft geen fout
});

test('WS-6/4.7: een teamactie met alleen witruimte telt niet als teamactie', () => {
  assert.equal(bouwFeedbackOverzicht({ inhoud: { regels: [], teamactie: { tekst: '   ', status: 'open' } } }).teamactie, null);
});

test('WS-6/4.7: de dossierpagina laat de kolommen naast elkaar zien en de afdruk toont geen [object Object]', async () => {
  const pagina = readFileSync(resolve(root, 'js/dossier-pagina.js'), 'utf8');
  assert.match(pagina, /bouwFeedbackOverzicht\(records\(\)\['EV-09'\]\)/);
  assert.match(pagina, /Post-its van andere teams/);
  assert.match(pagina, /Individuele feedback/);
  assert.match(pagina, /tekenLuks\(\); tekenFeedback\(\)|tekenFeedback\(\); tekenDekking/);
  const { store } = wisselMetFeedback();
  const dossier = await maakDossier(store, { elearning: '0.1.0' });
  const ev09 = bouwAfdruk(dossier, luk, veldLabels([blok4])).flatMap((p) => p.onderdelen).find((o) => o.id === 'EV-09');
  const tekst = ev09.velden.map((v) => v.waarde).join('\n');
  assert.doesNotMatch(tekst, /\[object Object\]/);
  assert.match(tekst, /ander team/);
  assert.match(tekst, /De kosten uitwerken op vel 2/);
});

test('waardeTekst maakt van tekst, lijst en object leesbare tekst', () => {
  assert.equal(waardeTekst('a'), 'a');
  assert.equal(waardeTekst(['a', 'b']), 'a; b');
  assert.equal(waardeTekst([{ rol: 'x', zie: 'y', mis: '' }]), 'rol: x, zie: y');
  assert.equal(waardeTekst(undefined), '');
  assert.equal(waardeTekst(null), '');
});
