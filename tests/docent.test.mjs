// Docentmodus (fase 9): klok, kaarten, programma, draaiboek, data en de grenzen van PR-3 en PR-4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maakKlok, klokTekst, rondeFasen, rondeFase } from '../js/docent/klok.js';
import { stapkaartModel, docentkaartModel, modelantwoorden, programmaModel, draaiboekModel, terugblikKaarten, tijdBijBegin, klaarAlsVan } from '../js/docent/kaarten.js';
import { modusUitAdres, docentAdres } from '../js/docent/kies.js';
import { oefenModel } from '../js/weergave.js';
import { controleerDocent, controleerMap } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const deel = json('data/docent-deel1.json');
const blokken = { 1: json('data/leerblok-1.json'), 2: json('data/leerblok-2.json') };
const terugblik = json('data/terugblik.json');
const kopie = (x) => JSON.parse(JSON.stringify(x));
const SEC = 1000; const MIN = 60 * SEC;

/** Een klok met een tijdbron die de test zelf verzet. */
function testKlok(onderdelen = deel.onderdelen, duurMinuten = deel.duurMinuten) {
  let t = 1_700_000_000_000;
  const klok = maakKlok({ onderdelen, duurMinuten, nu: () => t });
  return { klok, loop: (ms) => { t += ms; }, tijd: () => t };
}
const som = (t) => t.onderdelen.filter((p) => p.status === 'gepland').reduce((s, p) => s + p.minuten * MIN, 0);

// ---------------------------------------------------------------- klok (DM-4, DM-5, DM-6, DM-9)

test('DM-4: de klok loopt vanaf 0:00 met start, pauze en reset; afwijking ≤ 1 s over 10 min, ook met onregelmatige en gemiste ticks', () => {
  const { klok, loop } = testKlok();
  assert.equal(klok.toestand().verstreken, 0);
  klok.start();
  let echt = 0;
  for (let i = 0; i < 240; i++) { const stap = 1000 + ((i * 37) % 900) - 300; loop(stap); echt += stap; klok.toestand(); }
  loop(10 * MIN - echt); // rest van precies 10 minuten
  assert.ok(Math.abs(klok.toestand().verstreken - 10 * MIN) <= SEC);
  klok.pauze();
  loop(5 * MIN);
  assert.equal(klok.toestand().staat, 'pauze');
  assert.ok(Math.abs(klok.toestand().verstreken - 10 * MIN) <= SEC, 'tijdens pauze loopt de klok niet');
  klok.start();
  loop(2 * MIN);
  assert.ok(Math.abs(klok.toestand().verstreken - 12 * MIN) <= SEC);
  klok.reset();
  const t = klok.toestand();
  assert.equal(t.verstreken, 0); assert.equal(t.staat, 'stil'); assert.equal(t.actiefId, null);
  assert.ok(t.onderdelen.every((p) => p.status === 'gepland'));
});

test('DM-4: het actieve onderdeel telt af vanaf zijn eigen tijd en "volgende" start het volgende onderdeel', () => {
  const { klok, loop } = testKlok();
  klok.start();
  assert.equal(klok.toestand().actiefId, 'd1-01');
  loop(2 * MIN);
  assert.equal(klok.toestand().actief.resterend, 3 * MIN);
  klok.volgende();
  const t = klok.toestand();
  assert.equal(t.actiefId, 'd1-02');
  assert.equal(t.actief.resterend, 15 * MIN);
  assert.equal(t.onderdelen[0].status, 'gedaan');
});

test('DM-5: de klok blokkeert niets bij overschrijding van 100 % (en ook niet bij 250 %) van de richttijd', () => {
  const { klok, loop } = testKlok();
  klok.start();
  loop(12.5 * MIN); // 250 % van de 5 minuten van onderdeel 1
  const t = klok.toestand();
  assert.equal(t.actief.overschreden, true);
  assert.equal(t.actief.resterend, -7.5 * MIN);
  assert.equal(t.resterend, som(t) - 5 * MIN + 0 + 5 * MIN - 5 * MIN + 0, 'resterend telt een overschreden onderdeel als 0, niet negatief');
  assert.doesNotThrow(() => { klok.pauze(); klok.start(); klok.volgende(); klok.overslaan('d1-03'); klok.pasAan('d1-02', 20); });
  assert.equal(klok.toestand().actiefId, 'd1-02');
  assert.equal(klokTekst(-7.5 * MIN), '−7:30');
});

test('DM-9: na overslaan van 2 onderdelen is de resterende tijd de som van de resterende onderdelen ± 1 s', () => {
  const { klok, loop } = testKlok();
  klok.start();
  loop(3 * MIN);
  klok.overslaan('d1-03'); // 10 min
  klok.overslaan('d1-05'); // 10 min
  const t = klok.toestand();
  const verwacht = t.actief.resterend + som({ onderdelen: t.onderdelen.filter((p) => !p.actief) });
  assert.ok(Math.abs(t.resterend - verwacht) <= SEC);
  assert.equal(t.resterend, (5 - 3) * MIN + (90 - 5 - 20) * MIN, 'de overgeslagen 20 minuten tellen niet mee');
  assert.equal(t.onderdelen.filter((p) => p.status === 'overgeslagen').length, 2);
});

test('DM-9: het actieve onderdeel overslaan start meteen het volgende; verschuiven en tijd aanpassen rekenen opnieuw', () => {
  const { klok, loop } = testKlok();
  klok.start();
  loop(MIN);
  assert.equal(klok.overslaan('d1-01'), true);
  assert.equal(klok.toestand().actiefId, 'd1-02');
  assert.equal(klok.toestand().actief.resterend, 15 * MIN);
  assert.equal(klok.verschuif('d1-04', 1), true);
  const ids = klok.toestand().onderdelen.map((p) => p.id);
  assert.ok(ids.indexOf('d1-05') < ids.indexOf('d1-04'));
  assert.equal(klok.verschuif('d1-02', 1), false, 'het actieve onderdeel schuift niet');
  const voor = klok.toestand().resterend;
  klok.pasAan('d1-08', 15);
  assert.equal(klok.toestand().resterend, voor + 5 * MIN);
  klok.pasAan('d1-02', 20);
  assert.equal(klok.toestand().actief.resterend, 20 * MIN);
  assert.equal(klok.pasAan('d1-02', 0), false);
  assert.equal(klok.pasAan('d1-01', 9), false, 'een overgeslagen onderdeel is niet meer aan te passen');
});

test('DM-9: na "volgende" en overslaan blijft de marge ten opzichte van de 90 minuten kloppen; het einde geeft "klaar"', () => {
  const { klok, loop } = testKlok();
  klok.start();
  loop(5 * MIN); klok.volgende();
  const t = klok.toestand();
  assert.equal(t.marge, 90 * MIN - (5 * MIN + t.resterend));
  for (let i = 0; i < 10; i++) klok.volgende();
  assert.equal(klok.toestand().klaar, true);
  assert.equal(klok.toestand().resterend, 0);
});

test('DM-4: de stand van de klok is te bewaren en te herstellen (herladen); een vreemde stand wordt geweigerd', () => {
  const a = testKlok(); a.klok.start(); a.loop(4 * MIN); a.klok.overslaan('d1-03');
  const stand = JSON.parse(JSON.stringify(a.klok.exporteer()));
  const b = maakKlok({ onderdelen: deel.onderdelen, duurMinuten: 90, nu: () => a.tijd() + MIN });
  assert.equal(b.herstel(stand), true);
  assert.equal(b.toestand().verstreken, 5 * MIN);
  assert.equal(b.toestand().onderdelen.find((p) => p.id === 'd1-03').status, 'overgeslagen');
  assert.equal(b.herstel({ plan: [] }), false);
  assert.equal(b.herstel(null), false);
});

test('DM-6: bij de gallery walk toont de klok twee rondes van 4 minuten en 2 minuten lezen (10 minuten)', () => {
  const fasen = rondeFasen();
  assert.deepEqual(fasen.map((f) => f.minuten), [4, 4, 2]);
  assert.equal(fasen.reduce((s, f) => s + f.minuten, 0), 10);
  assert.equal(rondeFase(fasen, 0).naam, 'Ronde 1');
  assert.equal(rondeFase(fasen, 4 * MIN).naam, 'Ronde 2');
  assert.equal(rondeFase(fasen, 3 * MIN).resterend, MIN);
  assert.match(rondeFase(fasen, 9 * MIN).naam, /Lezen/);
  assert.equal(rondeFase(fasen, 11 * MIN).klaar, true);
});

test('klokTekst: minuten en seconden, uren alleen als nodig', () => {
  assert.equal(klokTekst(0), '0:00');
  assert.equal(klokTekst(65 * SEC), '1:05');
  assert.equal(klokTekst(85 * MIN + 7 * SEC), '1:25:07');
});

// ---------------------------------------------------------------- data (DM-18, DM-2, DM-17)

test('DM-18 en 9.2: deel 1 heeft 11 onderdelen van samen 90 minuten in de volgorde van het programma (LRD 8.2)', () => {
  assert.equal(deel.onderdelen.length, 11);
  assert.equal(deel.onderdelen.reduce((s, o) => s + o.minuten, 0), 90);
  assert.deepEqual(deel.onderdelen.map((o) => o.taak), [null, '1.1', null, '2.1', '2.2', '2.2', '3.1', '3.2', '4.2', '4.1', null]);
});

test('data/docent-deel1.json valideert; een voorbeeldonderdeel zonder velden of met dubbele content wordt afgekeurd', () => {
  const lijst = Object.values(blokken);
  assert.deepEqual(controleerDocent(deel, lijst).fouten, []);
  const kapot = kopie(deel);
  delete kapot.onderdelen[3].kernboodschap;
  kapot.onderdelen[4].modelantwoord = { velden: {} };
  kapot.onderdelen[5].taak = '9.9';
  const f = controleerDocent(kapot, lijst).fouten.join('\n');
  assert.match(f, /d1-04.*kernboodschap/);
  assert.match(f, /d1-05.*modelantwoord hoort in het leerblokbestand/);
  assert.match(f, /d1-06.*taak 9\.9/);
});

test('DM-17: beoordelingsinformatie in de docentdata wordt afgekeurd; de echte data is er vrij van', () => {
  const kapot = kopie(deel);
  kapot.onderdelen[1].kernboodschap += ' Het beoordelingscriterium BC1 telt zwaar.';
  const f = controleerDocent(kapot, Object.values(blokken)).fouten.join('\n');
  assert.match(f, /DM-17/);
  const kapot2 = kopie(deel);
  kapot2.onderdelen[2].veelgemaakteFouten = ['Het antwoord op de toetsvraag verwisselen.'];
  assert.match(controleerDocent(kapot2, Object.values(blokken)).fouten.join('\n'), /DM-17/);
  for (const woord of ['cijfer', 'rubric', 'tentamen', 'BC2', 'beoordelingsformulier', 'slagingsdrempel']) {
    const k = kopie(deel); k.onderdelen[3].watDocentDoet += ` ${woord}`;
    assert.match(controleerDocent(k, Object.values(blokken)).fouten.join('\n'), /DM-17/, woord);
  }
  assert.deepEqual(controleerMap(resolve(root, 'data')).fouten, []);
});

test('DM-7: een onderdeel met taak zonder rondloopvraag wordt afgekeurd; een onderdeel zonder taak mag er geen hebben', () => {
  const k = kopie(deel);
  k.onderdelen[3].rondloopvragen = [];
  assert.match(controleerDocent(k, Object.values(blokken)).fouten.join('\n'), /d1-04.*rondloopvraag/);
  assert.deepEqual(deel.onderdelen[0].rondloopvragen, []);
});

test('DM-9: verschuiven stopt aan het begin en het einde van de geplande onderdelen', () => {
  const { klok } = testKlok();
  klok.start();
  assert.equal(klok.verschuif('d1-11', 1), false);
  assert.equal(klok.verschuif('d1-02', -1), false, 'het eerste geplande onderdeel gaat niet voor het actieve');
  klok.volgende();
  assert.equal(klok.verschuif('d1-03', -1), false);
  assert.equal(klok.verschuif('d1-11', -1), true);
});

// ---------------------------------------------------------------- kaarten (DM-2, DM-3, DM-7, DM-8)

test('DM-3: elke stapkaart heeft 7 elementen: taaknummer, opdracht, klaar als, tijd, materiaal, dia\'s, laptop', () => {
  for (const o of deel.onderdelen) {
    const m = stapkaartModel(o, blokken);
    assert.deepEqual(Object.keys(m), ['taaknummer', 'opdracht', 'klaarAls', 'tijd', 'materiaal', 'dia', 'laptop']);
    assert.ok(Object.values(m).every((v) => typeof v === 'string' && v.trim() !== ''), o.id);
    assert.match(m.laptop, /^Laptop (open|dicht)$/);
  }
  const m = stapkaartModel(deel.onderdelen.find((o) => o.taak === '4.2'), blokken);
  assert.equal(m.laptop, 'Laptop dicht'); assert.equal(m.taaknummer, 'Taak 4.2'); assert.equal(m.tijd, 'Richttijd 5 min');
  assert.equal(stapkaartModel(deel.onderdelen[1], blokken, { minuten: 12 }).tijd, 'Richttijd 12 min');
});

test('DM-7: elke docentkaart heeft 4 elementen (wat de docent doet, kernboodschap, rondloopvragen, als het anders loopt)', () => {
  for (const o of deel.onderdelen) {
    const k = docentkaartModel(o, blokken);
    assert.ok(k.watDocentDoet && k.kernboodschap && Array.isArray(k.rondloopvragen) && k.alsHetAndersLoopt.length > 0, o.id);
    if (o.taak) assert.ok(k.rondloopvragen.length > 0, `${o.id}: rondloopvraag`);
  }
  const wedstrijd = docentkaartModel(deel.onderdelen.find((o) => o.taak === '3.2'), blokken);
  assert.ok(wedstrijd.alsHetAndersLoopt.some((t) => /Perplexity/.test(t)));
});

test('DM-8: modelantwoorden en veelgemaakte fouten zitten pas in het model nadat de docent ze opent (0 vóór de klik)', () => {
  for (const o of deel.onderdelen) {
    const dicht = docentkaartModel(o, blokken);
    assert.equal(dicht.modelantwoorden, null, o.id);
    assert.equal(dicht.veelgemaakteFouten, null, o.id);
    const tekst = JSON.stringify(dicht);
    for (const a of modelantwoorden(o, blokken).filter((x) => x.antwoord.length >= 40)) assert.ok(!tekst.includes(a.antwoord), `${o.id}: modelantwoord lekt`);
    for (const f of o.veelgemaakteFouten) assert.ok(!tekst.includes(f), `${o.id}: fout lekt`);
  }
  const o = deel.onderdelen[1];
  const open = docentkaartModel(o, blokken, { geopend: true });
  assert.equal(open.modelantwoorden.length, 3);
  assert.match(open.modelantwoorden[0].label, /3xC/);
  assert.match(open.modelantwoorden[0].antwoord, /Concreet, compleet en consistent/);
  assert.ok(open.veelgemaakteFouten.length > 0);
  assert.equal(docentkaartModel(deel.onderdelen[0], blokken, { geopend: true }).heeftModel, false, 'geen taak, geen modelantwoord');
});

test('DM-2: één wijziging in een modelantwoord of klaar-als in het leerblokbestand verschijnt in de docent- én de studentweergave', () => {
  const gewijzigd = kopie(blokken);
  const taak = gewijzigd[1].taken.find((t) => t.id === '1.1');
  taak.modelantwoord.velden.drieC = 'NIEUW-MODELANTWOORD';
  taak.klaarAls.tekst = 'NIEUW-KLAARALS';
  const o = deel.onderdelen[1];
  assert.equal(modelantwoorden(o, gewijzigd)[0].antwoord, 'NIEUW-MODELANTWOORD');
  assert.equal(klaarAlsVan(o, gewijzigd), 'NIEUW-KLAARALS');
  assert.match(stapkaartModel(o, gewijzigd).klaarAls, /NIEUW-KLAARALS/);
  const student = oefenModel(taak, { invoer: { drieC: 'iets' } });
  assert.equal(student.modelantwoord.velden.drieC, 'NIEUW-MODELANTWOORD');
  assert.equal(taak.klaarAls.tekst, 'NIEUW-KLAARALS');
  // het docentbestand herhaalt geen modelantwoord en geen klaar-als bij onderdelen met taak: 0 gedupliceerde contentbestanden
  assert.ok(deel.onderdelen.filter((x) => x.taak).every((x) => !('modelantwoord' in x) && !('klaarAls' in x)));
  assert.deepEqual(readdirSync(resolve(root, 'data')).filter((n) => /^docent.*modelantwoord/i.test(n)), []);
});

// ---------------------------------------------------------------- programma, draaiboek, terugblik (DM-10, DM-11, DM-14)

test('DM-10: het programmaoverzicht toont klaar, nu en komt, met tijden in het deel en (na invullen) uit het rooster', () => {
  const { klok, loop } = testKlok();
  klok.start(); loop(5 * MIN); klok.volgende(); klok.overslaan('d1-03');
  const m = programmaModel(deel, klok.toestand(), '09:30');
  assert.deepEqual(m.slice(0, 4).map((r) => r.statusTekst), ['Klaar', 'Nu bezig', 'Overgeslagen', 'Komt']);
  assert.equal(m.length, 11);
  assert.equal(m[0].rooster, '09:30'); assert.equal(m[1].rooster, '09:35');
  assert.equal(m[3].inDeel, '0:20', 'een overgeslagen onderdeel schuift de rest naar voren');
  assert.equal(programmaModel(deel, klok.toestand(), '')[0].rooster, null);
  assert.equal(tijdBijBegin('23:30', 45), '00:15');
  assert.equal(tijdBijBegin('25:00', 5), null);
});

test('DM-11: de afdruk van deel 1 bevat 100 % van de onderdelen, tijden en rondloopvragen van het scherm', () => {
  const d = draaiboekModel(deel, blokken);
  assert.equal(d.rijen.length, deel.onderdelen.length);
  assert.deepEqual(d.rijen.map((r) => r.start), ['0:00', '0:05', '0:20', '0:30', '0:40', '0:50', '0:55', '1:00', '1:10', '1:15', '1:25']);
  for (const [i, o] of deel.onderdelen.entries()) {
    assert.equal(d.rijen[i].titel, o.titel);
    assert.equal(d.rijen[i].minuten, o.minuten);
    assert.deepEqual(d.rijen[i].kaart.rondloopvragen, docentkaartModel(o, blokken).rondloopvragen);
    assert.deepEqual(d.rijen[i].stapkaart, stapkaartModel(o, blokken));
  }
  assert.ok(d.rijen.every((r) => r.kaart.modelantwoorden === null), 'zonder verzoek geen modelantwoorden op papier (DM-8)');
  assert.ok(draaiboekModel(deel, blokken, { metModel: true }).rijen[1].kaart.modelantwoorden.length > 0);
  assert.match(d.afsluiting, /coaching/);
});

test('DM-14: 3 terugblik-kaarten (leerblok 2, 3 en 4) met de items en vragen uit data/terugblik.json', () => {
  const k = terugblikKaarten(terugblik);
  assert.deepEqual(k.map((x) => x.leerblok), [2, 3, 4]);
  for (const x of k) { assert.ok(x.items.length > 0); assert.equal(x.kennisvragen.length, 2); assert.ok(x.transfervraag); }
  assert.match(k[0].kennisvragen[0], /user-story-format/);
});

// ---------------------------------------------------------------- kiezen (DM-1), PR-3 en PR-4

test('DM-1: de docentmodus is te kiezen met één adres-toevoeging, zonder inloggen', () => {
  assert.equal(modusUitAdres('?modus=docent'), 'docent');
  assert.equal(modusUitAdres('?a=1&modus=docent'), 'docent');
  assert.equal(modusUitAdres('?modus=student'), null);
  assert.equal(modusUitAdres(''), null);
  assert.equal(docentAdres('docent.html'), 'docent.html?modus=docent');
  const html = readFileSync(resolve(root, 'docent.html'), 'utf8');
  assert.doesNotMatch(html, /type="password"|inloggen|login|account/i, '0 accounts');
});

const docentBronnen = () => readdirSync(resolve(root, 'js/docent')).map((n) => [n, readFileSync(resolve(root, 'js/docent', n), 'utf8').replace(/\/\/.*$/gm, '')]);

test('PR-3: de docentmodus leest of bewaart niets van studenten: geen studentopslag, alleen a3d:-sleutels van de docent', () => {
  for (const [naam, bron] of docentBronnen()) {
    assert.doesNotMatch(bron, /a3l:/, `${naam} raakt de studentopslag`);
    assert.doesNotMatch(bron, /from '\.\.\/(store|dossier|sessie|profiel|wissel|terugblik)(-|\.)/, `${naam} importeert studentcode`);
    for (const m of bron.matchAll(/(?:getItem|setItem|removeItem)\(`?'?([^`',)]*)/g)) assert.match(m[1], /^a3d:/, `${naam}: opslagsleutel ${m[1]}`);
  }
  assert.doesNotMatch(readFileSync(resolve(root, 'data/docent-deel1.json'), 'utf8'), /alias|teamnummer|vraagstuk van de student/i);
});

test('PR-4: de docentmodus heeft geen verbindingen: alleen fetch van eigen bestanden en een CSP die de rest weigert', () => {
  for (const [naam, bron] of docentBronnen()) {
    assert.doesNotMatch(bron, /WebSocket|RTCPeerConnection|EventSource|BroadcastChannel|sendBeacon|XMLHttpRequest|navigator\.(?:share|serviceWorker)|https?:\/\//, `${naam} maakt een verbinding`);
    for (const regel of bron.split('\n').filter((r) => r.includes('fetch('))) assert.match(regel, /fetch\(new URL\(`\.\.\/\.\.\/\$\{pad\}`, import\.meta\.url\)\)/, `${naam}: fetch buiten de eigen bestanden`);
  }
  const html = readFileSync(resolve(root, 'docent.html'), 'utf8');
  assert.match(html, /Content-Security-Policy[^>]*default-src 'none'[^>]*connect-src 'self'/);
});

// ---------------------------------------------------------------- DM-16

test('DM-16: alle tekst op de stapkaart is minstens 28 px (css/docent.css); contrast staat in de contrasttest', () => {
  const css = readFileSync(resolve(root, 'css/docent.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const regels = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] })).filter((r) => r.sel.split(',').some((s) => s.trim().startsWith('.stapkaart')));
  const groottes = regels.map((r) => ({ sel: r.sel, px: /(?<![\w-])font(?:-size)?\s*:([^;]*)/.exec(r.decl)?.[1].match(/(\d+(?:\.\d+)?)px/)?.[1] }));
  assert.ok(groottes.some((g) => g.sel === '.stapkaart' && Number(g.px) >= 28), 'de stapkaart zelf heeft een lettergrootte van minstens 28 px');
  for (const g of groottes.filter((x) => x.px !== undefined)) assert.ok(Number(g.px) >= 28, `${g.sel}: ${g.px}px`);
  assert.doesNotMatch(regels.map((r) => r.decl).join(';'), /font(?:-size)?\s*:[^;]*(?:rem|em|%|small|smaller)\b/, 'geen relatieve lettergrootte in de stapkaart');
});

test('QA-6 en TG-3: css/docent.css gebruikt alleen tokens (geen kleurcode, geen extern lettertype) en valt onder de contrastcontrole', async () => {
  const css = readFileSync(resolve(root, 'css/docent.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [], []);
  assert.doesNotMatch(css, /@import|@font-face|url\(/);
  assert.match(readFileSync(resolve(root, 'docent.html'), 'utf8'), /<link rel="stylesheet" href="css\/docent\.css">/);
  const { controleerContrast } = await import('../tools/contrast-check.mjs');
  const { paren: lijst, fouten } = controleerContrast(root);
  assert.deepEqual(fouten, []);
  assert.ok(lijst.some((p) => p.selector.startsWith('docent.css: .stapkaart')), 'de stapkaart zit in de gecontroleerde tekstparen');
});
