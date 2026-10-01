import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sorteerBronnen, eersteVolgordefout, apaDelen, vindCitaties, splitsMetVerwijzingen, maakIndex, bouwBronnenModel, laadBronnen, bronHref,
} from '../js/bronnen.js';
import { apaJaar } from '../js/checks/lb2.js';
import { controleerBronnen, controleerMap } from '../tools/content-check.mjs';
import { controleerLink, controleerExterneLinks, verzamelExterneLinks } from '../tools/link-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = resolve(root, 'data');
const lees = (n) => JSON.parse(readFileSync(resolve(data, n), 'utf8'));
const bestanden = readdirSync(data).filter((n) => /^bronnen-\d\.json$/.test(n)).map(lees);
const alleBronnen = bestanden.flatMap((b) => b.bronnen);

/** Een tijdelijke datamap: kopie van data/ waarin een test iets kapot kan maken. */
function kopieerData() {
  const map = mkdtempSync(join(tmpdir(), 'a3-data-'));
  cpSync(data, map, { recursive: true });
  return map;
}
const schrijf = (map, naam, inhoud) => writeFileSync(resolve(map, naam), JSON.stringify(inhoud, null, 2));

// ---------------------------------------------------------------- BR-1, BR-3: de bronnen zelf

test('BR-1: alle bronnen van de bestanden staan op de bronnenpagina, alfabetisch, zonder volgordefouten', () => {
  const model = bouwBronnenModel(bestanden);
  assert.equal(model.length, alleBronnen.length);
  assert.ok(model.length >= 5);
  const gesorteerd = sorteerBronnen(alleBronnen);
  assert.deepEqual(model.map((m) => m.id), gesorteerd.map((b) => b.id));
  assert.equal(eersteVolgordefout(gesorteerd), null);
  for (const b of bestanden) assert.equal(eersteVolgordefout(b.bronnen), null, `volgorde in leerblok ${b.leerblok}`);
});

test('BR-1: de sortering kan falen (verwisselde bronnen worden gezien)', () => {
  const [a, b] = sorteerBronnen(alleBronnen);
  assert.ok(eersteVolgordefout([b, a]));
});

test('BR-1: sorteren negeert hoofdletters, leestekens en sterretjes; MIT staat tussen Mislevy en Mohd', () => {
  const l = sorteerBronnen([{ apa: 'Mohd Saad, N. (2013).' }, { apa: 'MIT OpenCourseWare. (2014).' }, { apa: 'Mislevy, R. (2003).' }, { apa: '*Zzz*. (2000).' }, { apa: 'Anderson, L. (2001).' }]);
  assert.deepEqual(l.map((b) => b.apa.split('.')[0].replace(/\*/g, '')), ['Anderson, L', 'Mislevy, R', 'MIT OpenCourseWare', 'Mohd Saad, N', 'Zzz']);
});

test('BR-3: elke niet-openbare bron heet „ongepubliceerd document" met de organisatie (Inspectie in data)', () => {
  const alle = bestanden.flatMap((b) => [...b.bronnen, ...b.wachtOpCitatie]);
  const ongepubliceerd = alle.filter((b) => b.type === 'ongepubliceerd');
  assert.ok(ongepubliceerd.length >= 1);
  for (const b of ongepubliceerd) {
    assert.match(b.apa, /\[Ongepubliceerd document\]/);
    assert.ok(b.apa.includes(b.organisatie));
    assert.equal(b.link, undefined);
  }
});

test('elke bron heeft auteur, jaar en titel in de APA-regel; een link alleen als die bestaat', () => {
  for (const b of bestanden.flatMap((x) => [...x.bronnen, ...x.wachtOpCitatie, ...(x.fictief ?? [])])) {
    assert.match(b.apa, /^\S[^(]+\(/, `${b.id}: begint met de auteur`);
    assert.ok(apaJaar(b.apa), `${b.id}: jaar tussen haakjes`);
    assert.ok(b.apa.replace(/\*/g, '').length > 30, `${b.id}: titel`);
    if (b.link) assert.match(b.link, /^https:\/\//);
  }
});

test('BR-1, B111: een verzonnen bron staat in fictief, niet op de bronnenpagina, en de verwijzing ernaar is gewone tekst', () => {
  const verzonnen = bestanden.flatMap((b) => b.fictief ?? []);
  assert.deepEqual(verzonnen.map((b) => b.id).sort(), ['bakker-de-vries-2016', 'visser-el-amrani-2021']);
  const model = bouwBronnenModel(bestanden);
  for (const b of verzonnen) {
    assert.equal(b.link, undefined, `${b.id}: geen link`);
    assert.ok(!model.some((m) => m.citatie === b.citatie), `${b.id} staat op de bronnenpagina`);
    assert.ok(!alleBronnen.some((x) => 'fictief' in x), 'geen bron in bronnen draagt fictief');
    const delen = splitsMetVerwijzingen(`Bij webshop X vind je (${b.citatie}).`, maakIndex(alleBronnen));
    assert.equal(delen.filter((d) => d.href).length, 0, `(${b.citatie}) klikt naar de bronnenpagina`);
  }
});

// ---------------------------------------------------------------- BR-4: in-tekstverwijzingen

test('BR-4: vindCitaties herkent (Auteur, jaar) en (Auteur & Ander, jaar) en (Org, z.d.), maar geen gewone haakjes', () => {
  const t = 'Zie (Mayer, 2004), (Hattie & Timperley, 2007) en (Atlassian, z.d.); niet (bijvoorbeeld HANQuest) of (zie 2004) of (mayer, 2004).';
  assert.deepEqual(vindCitaties(t).map((c) => c.citatie), ['Mayer, 2004', 'Hattie & Timperley, 2007', 'Atlassian, z.d.']);
  assert.deepEqual(vindCitaties('Twee sjablonen (Strategyzer, z.d.-a) en (Strategyzer, z.d.-b).').map((c) => c.citatie), ['Strategyzer, z.d.-a', 'Strategyzer, z.d.-b'], 'APA: twee werken zonder datum van dezelfde auteur');
  assert.equal(apaJaar('Strategyzer AG. (z.d.-a). *Titel*.'), 'z.d.');
});

test('BR-4: 100 % van de verwijzingen naar een echte bron in leerblok 2 klikt naar een bronregel die op de bronnenpagina bestaat', () => {
  const model = bouwBronnenModel(bestanden);
  const ankers = new Set(model.map((m) => m.ankerId));
  const index = maakIndex(alleBronnen);
  const verzonnen = new Set(bestanden.flatMap((b) => (b.fictief ?? []).map((x) => x.citatie)));
  const blok = lees('leerblok-2.json');
  const teksten = [];
  const loop = (w) => { if (typeof w === 'string') teksten.push(w); else if (Array.isArray(w)) w.forEach(loop); else if (w && typeof w === 'object') Object.entries(w).forEach(([k, x]) => k !== 'opmerking' && loop(x)); };
  loop(blok);
  let verwijzingen = 0;
  for (const t of teksten) {
    for (const stuk of splitsMetVerwijzingen(t, index)) {
      if (!stuk.href) continue;
      verwijzingen += 1;
      assert.match(stuk.href, /^bronnen\.html#bron-/);
      assert.ok(ankers.has(stuk.href.split('#')[1]), `${stuk.href} heeft geen bronregel`);
    }
    const echt = vindCitaties(t).filter((c) => !verzonnen.has(c.citatie));
    assert.equal(echt.length, splitsMetVerwijzingen(t, index).filter((s) => s.href).length, `niet elke verwijzing in "${t.slice(0, 40)}…" is een link`);
  }
  assert.ok(verwijzingen >= 3, `slechts ${verwijzingen} verwijzingen`);
});

test('BR-4: splitsMetVerwijzingen bewaart de tekst rondom en laat onbekende verwijzingen gewone tekst', () => {
  const index = maakIndex([{ id: 'x-1', citatie: 'Mayer, 2004' }]);
  const delen = splitsMetVerwijzingen('Voor (Mayer, 2004) en (Onbekend, 1999) klaar.', index);
  assert.equal(delen.map((d) => d.tekst).join(''), 'Voor (Mayer, 2004) en (Onbekend, 1999) klaar.');
  assert.deepEqual(delen.filter((d) => d.href).map((d) => d.href), [bronHref('x-1')]);
});

test('apaDelen zet tekst tussen sterretjes cursief', () => {
  assert.deepEqual(apaDelen('A. (2020). *Titel, 12*(3), 4.'), [
    { tekst: 'A. (2020). ', cursief: false }, { tekst: 'Titel, 12', cursief: true }, { tekst: '(3), 4.', cursief: false }]);
});

test('laadBronnen leest het manifest en de daarin genoemde bestanden (en faalt hoorbaar bij een ontbrekend bestand)', async () => {
  const haal = async (u) => ({ ok: u !== 'data/bronnen-2.json', json: async () => (u === 'data/bronnen.json' ? { bestanden: ['bronnen-1.json', 'bronnen-2.json'] } : { bronnen: [] }) });
  await assert.rejects(laadBronnen(haal), /bronnen-2\.json/);
  const goed = await laadBronnen(async (u) => ({ ok: true, json: async () => (u === 'data/bronnen.json' ? { bestanden: ['bronnen-1.json'] } : { bronnen: [{ id: 'a' }] }) }));
  assert.deepEqual(goed, [{ bronnen: [{ id: 'a' }] }]);
});

// ---------------------------------------------------------------- BR-5: content-check

test('BR-5: de echte data heeft 0 verwijzingen zonder bronregel en 0 bronregels zonder citatie', () => {
  const r = controleerBronnen(data);
  assert.deepEqual(r.fouten, []);
  assert.ok(r.bestanden >= 2);
});

test('BR-5 sabotage: een verwijzing zonder bronregel laat content-check falen', () => {
  const map = kopieerData();
  const blok = lees('leerblok-2.json');
  blok.taken[0].waarom.tekst += ' Zie (Onbestaand, 1999).';
  schrijf(map, 'leerblok-2.json', blok);
  const r = controleerMap(map);
  assert.ok(r.fouten.some((f) => /\(Onbestaand, 1999\) heeft geen bronregel/.test(f)), r.fouten.join('\n'));
});

test('BR-5 sabotage: een bronregel zonder citatie laat content-check falen', () => {
  const map = kopieerData();
  const b2 = lees('bronnen-2.json');
  b2.bronnen.push({ id: 'zzz-2020', citatie: 'Zzz, 2020', type: 'boek', apa: 'Zzz, A. (2020). *Weesboek*.' });
  schrijf(map, 'bronnen-2.json', b2);
  const r = controleerBronnen(map);
  assert.ok(r.fouten.some((f) => /zzz-2020.*wordt nergens geciteerd/.test(f)), r.fouten.join('\n'));
});

test('BR-5: een geciteerde bron die nog in wachtOpCitatie staat is een fout; een wachtende bron alleen een waarschuwing', () => {
  const map = kopieerData();
  const blok = lees('leerblok-2.json');
  blok.taken[0].waarom.tekst += ' Zie (Cepeda e.a., 2006).';
  schrijf(map, 'leerblok-2.json', blok);
  const r = controleerBronnen(map);
  assert.ok(r.fouten.some((f) => /Cepeda e\.a\., 2006\) staat in wachtOpCitatie/.test(f)));
  assert.equal(controleerBronnen(data).waarschuwingen.length, 1);
});

test('BR-1/BR-3 in content-check: verkeerde volgorde, ontbrekend manifest en ongepubliceerd zonder organisatie falen', () => {
  const map = kopieerData();
  const b3 = lees('bronnen-3.json');
  const b2 = lees('bronnen-2.json');
  b2.bronnen.reverse();
  schrijf(map, 'bronnen-2.json', b2);
  assert.ok(controleerBronnen(map).fouten.some((f) => /niet alfabetisch/.test(f)));
  b2.bronnen.reverse();
  schrijf(map, 'bronnen-2.json', b2);
  b3.bronnen.find((b) => b.type === 'ongepubliceerd').apa = 'Westmoreland BV. (z.d.). *Titel*.';
  schrijf(map, 'bronnen-3.json', b3);
  assert.ok(controleerBronnen(map).fouten.some((f) => /ongepubliceerd document/.test(f)));
  const map3 = mkdtempSync(join(tmpdir(), 'a3-data-'));
  writeFileSync(resolve(map3, 'bronnen-1.json'), JSON.stringify({ formaat: '1.0', leerblok: 1, bronnen: [], wachtOpCitatie: [] }));
  assert.ok(controleerBronnen(map3).fouten.some((f) => /bronnen\.json ontbreekt/.test(f)));
});

test('B111 in content-check: een verzonnen bron in bronnen of met een link faalt; zonder de lijst fictief heeft de verwijzing geen bronregel', () => {
  assert.deepEqual(controleerBronnen(data).fouten, []);
  const terug = lees('bronnen-2.json');
  const [bakker] = terug.fictief.splice(0, 1);
  terug.bronnen = sorteerBronnen([...terug.bronnen, { ...bakker, fictief: true }]);
  const map = kopieerData();
  schrijf(map, 'bronnen-2.json', terug);
  assert.ok(controleerBronnen(map).fouten.some((f) => /bakker-de-vries-2016: een verzonnen bron hoort in fictief/.test(f)));
  const metLink = lees('bronnen-2.json');
  metLink.fictief[0].link = 'https://example.org/nep';
  const map2 = kopieerData();
  schrijf(map2, 'bronnen-2.json', metLink);
  assert.ok(controleerBronnen(map2).fouten.some((f) => /een verzonnen bron heeft geen link/.test(f)));
  const zonder = lees('bronnen-2.json');
  delete zonder.fictief;
  const map3 = kopieerData();
  schrijf(map3, 'bronnen-2.json', zonder);
  assert.ok(controleerBronnen(map3).fouten.some((f) => /\(Bakker & De Vries, 2016\) heeft geen bronregel/.test(f)));
});

// ---------------------------------------------------------------- BR-6: link-check met een dubbelganger voor fetch

const antwoord = (status, json) => ({ status, json: async () => json });
/** Een fetch die per URL-deel een antwoord geeft; alles wat niet genoemd is, geeft 200. */
const nepFetch = (regels) => async (url) => {
  for (const [deel, r] of Object.entries(regels)) if (url.includes(deel)) { if (r instanceof Error) throw r; return typeof r === 'function' ? r(url) : r; }
  return antwoord(200, { responseCode: 1 });
};

test('BR-6: een DOI die doi.org niet kent is dood; een bekende DOI is ok', async () => {
  const haal = nepFetch({ '10.9999/nep': antwoord(404, { responseCode: 100 }), 'api/handles': antwoord(200, { responseCode: 1 }) });
  assert.equal((await controleerLink('https://doi.org/10.1037/x', haal)).status, 'ok');
  assert.equal((await controleerLink('https://doi.org/10.9999/nep', haal)).status, 'dood');
  const r = await controleerLink('https://doi.org/10.1037/y', nepFetch({ 'api/handles': antwoord(200, { responseCode: 100 }) }));
  assert.equal(r.status, 'dood');
});

test('BR-6: 404 en 410 zijn dood, 403 en 429 en 503 zijn onzeker (waarschuwing), een onbekende host is dood', async () => {
  const url = 'https://voorbeeld.nl/x';
  assert.equal((await controleerLink(url, nepFetch({ voorbeeld: antwoord(404) }))).status, 'dood');
  assert.equal((await controleerLink(url, nepFetch({ voorbeeld: antwoord(410) }))).status, 'dood');
  for (const s of [403, 429, 503]) assert.equal((await controleerLink(url, nepFetch({ voorbeeld: antwoord(s) }))).status, 'onzeker', String(s));
  const dns = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  assert.equal((await controleerLink(url, nepFetch({ voorbeeld: dns }))).status, 'dood');
  const time = Object.assign(new Error('fetch failed'), { cause: { code: 'ETIMEDOUT' } });
  assert.equal((await controleerLink(url, nepFetch({ voorbeeld: time }))).status, 'onzeker');
  assert.equal((await controleerLink(url, nepFetch({ voorbeeld: antwoord(200) }))).status, 'ok');
});

test('BR-6: een server die HEAD weigert wordt met GET opnieuw geprobeerd', async () => {
  const methodes = [];
  const haal = async (u, o) => { methodes.push(o?.method); return antwoord(o?.method === 'HEAD' ? 405 : 200); };
  assert.equal((await controleerLink('https://voorbeeld.nl/', haal)).status, 'ok');
  assert.deepEqual(methodes, ['HEAD', 'GET']);
});

test('BR-6: een YouTube-video wordt via oEmbed gecontroleerd', async () => {
  assert.equal((await controleerLink('https://www.youtube.com/watch?v=abc123', nepFetch({ oembed: antwoord(404) }))).status, 'dood');
  assert.equal((await controleerLink('https://www.youtube.com/watch?v=abc123', nepFetch({ oembed: antwoord(200) }))).status, 'ok');
});

test('BR-6: controleerExterneLinks meldt elke dode link als fout en telt alle links (100 % gecontroleerd)', async () => {
  const links = new Map([['https://doi.org/10.1/goed', 'a: goed'], ['https://doi.org/10.9999/dood', 'a: dood'], ['https://voorbeeld.nl/403', 'a: onzeker']]);
  const haal = nepFetch({ '10.9999/dood': antwoord(404, { responseCode: 100 }), 'voorbeeld.nl/403': antwoord(403) });
  const r = await controleerExterneLinks(links, { haal });
  assert.equal(r.gecontroleerd, 3);
  assert.equal(r.fouten.length, 1);
  assert.match(r.fouten[0], /a: dood: dode link https:\/\/doi\.org\/10\.9999\/dood/);
  assert.equal(r.waarschuwingen.length, 1);
});

test('BR-6: --offline en het ontbreken van netwerk laten de check niet vals falen', async () => {
  const links = new Map([['https://doi.org/10.9999/dood', 'a']]);
  let aanroepen = 0;
  const teller = async () => { aanroepen += 1; return antwoord(200, { responseCode: 1 }); };
  const off = await controleerExterneLinks(links, { haal: teller, offline: true });
  assert.deepEqual([off.fouten.length, off.overgeslagen, aanroepen], [0, true, 0]);
  const geenNetwerk = async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); };
  const r = await controleerExterneLinks(links, { haal: geenNetwerk });
  assert.deepEqual([r.fouten.length, r.overgeslagen], [0, true]);
  assert.match(r.waarschuwingen[0], /geen netwerk/);
});

test('BR-6: alle DOI\'s en URL\'s uit de bronbestanden worden verzameld, fictieve bronnen niet', () => {
  const links = verzamelExterneLinks(root);
  const bronLinks = bestanden.flatMap((b) => [...b.bronnen, ...b.wachtOpCitatie]).filter((b) => b.link).map((b) => b.link);
  for (const l of bronLinks) assert.ok(links.has(l), `${l} ontbreekt`);
  assert.ok(bronLinks.length >= 10);
  assert.ok(bronLinks.some((l) => l.includes('doi.org')));
});
