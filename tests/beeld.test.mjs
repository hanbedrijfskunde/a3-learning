// Het A3-vel als figuur in taak 1.1 en de hint bij elke oefenvraag (SX-13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleerFormaat } from '../tools/content-check.mjs';
import { bouwTaakModel } from '../js/weergave.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const blok = (n) => JSON.parse(lees(`data/leerblok-${n}.json`));

test('Figuur A3-vel: taak 1.1 toont figuur 1 van Schwagerman & Ulmer (2013) als citaat met bron, alt-tekst en de koppeling naar de acht vakken (ADR B84)', () => {
  const t = blok(1).taken.find((x) => x.id === '1.1');
  assert.equal(t.stof.figuur, 'a3-vel');
  assert.match(t.stof.alineas[0], /\(Schwagerman & Ulmer, 2013\)/);
  const dom = lees('js/dom.js');
  assert.match(dom, /src: 'media\/citaten\/schwagerman-ulmer-2013-figuur-1\.png'/);
  assert.match(dom, /loading: 'lazy'/, 'telt niet mee voor de eerste lading (PF-4)');
  assert.match(dom, /alt: 'Een A3-sjabloon\./);
  assert.match(dom, /met\('\(Schwagerman & Ulmer, 2013\)'\), ', figuur 1, via '/, 'bronvermelding in het bijschrift');
  for (const vak of ['1 · Aanleiding / achtergrond', '4 · Analyse', '7 · Borging en evaluatie', '8 · Next steps']) assert.ok(dom.includes(vak), vak);
});

test('Figuur six capitals: taak 2.1 toont het waardecreatieproces van het IIRC (2021) als citaat met bron, alt-tekst en de Nederlandse namen van de zes kapitalen (ADR B84)', () => {
  const t = blok(1).taken.find((x) => x.id === '2.1');
  assert.equal(t.stof.figuur, 'six-capitals');
  assert.match(t.stof.alineas[1], /six capitals/, 'de figuur staat na de alinea die de kapitalen noemt');
  const dom = lees('js/dom.js');
  assert.match(dom, /src: 'media\/citaten\/iirc-2021-waardecreatieproces\.webp'/);
  assert.match(dom, /alt: 'Het waardecreatieproces van het IIRC\./);
  assert.match(dom, /met\('\(International Integrated Reporting Council, 2021\)'\)/, 'bronvermelding in het bijschrift');
  for (const nl of ['Financieel', 'Productie', 'Intellectueel', 'Menselijk', 'Sociaal en relationeel', 'Natuurlijk']) assert.ok(dom.includes(`'${nl}'`), nl);
  assert.match(lees('js/leerblok.js'), /'six-capitals': \{ bouw: sixCapitalsFiguur, na: 1 \}/);
});

test('Figuur VPC: taak 6.1 toont het value proposition canvas van Strategyzer (z.d.-b) als citaat met bron, alt-tekst en de vakken van beide kanten (ADR B89)', () => {
  const t = blok(3).taken.find((x) => x.id === '6.1');
  assert.equal(t.stof.figuur, 'vpc');
  assert.match(t.stof.alineas[0], /klantprofiel.*waardekaart/s, 'de figuur staat na de alinea die de twee kanten beschrijft');
  const dom = lees('js/dom.js');
  assert.match(dom, /src: 'media\/citaten\/strategyzer-zd-value-proposition-canvas\.webp'/);
  assert.match(dom, /alt: 'Het value proposition canvas\./);
  assert.match(dom, /met\('\(Strategyzer, z\.d\.-b\)'\)/, 'bronvermelding in het bijschrift');
  for (const nl of ['Klanttaken', 'Pains', 'Gains', 'Producten en diensten', 'Pain relievers', 'Gain creators']) assert.ok(dom.includes(`'${nl}'`), nl);
  assert.match(lees('js/leerblok.js'), /vpc: \{ bouw: vpcFiguur, na: 0 \}/);
});

test('Figuur VPC ook bij de oefening van taak 6.1: de student hoeft niet terug naar de stof; een onbekende oefening.figuur wordt afgekeurd', () => {
  const b = blok(3);
  const t = b.taken.find((x) => x.id === '6.1');
  assert.equal(t.oefening.figuur, 'vpc');
  assert.equal(bouwTaakModel(t, b).stappen[2].oefening.figuur, 'vpc', 'het taakmodel geeft de figuur door aan stap 3');
  assert.match(lees('js/leerblok.js'), /FIGUREN\[s3\.oefening\.figuur\]\?\.bouw\(\{ met \}\)/);
  t.oefening.figuur = 'swot';
  assert.match(controleerFormaat(b, 'leerblok-3.json').fouten.join('\n'), /taak 6\.1: oefening\.figuur "swot" is onbekend/);
});

test('Figuur VPC ook bij de toepassing van taak 6.1; een onbekende toepassing.figuur wordt afgekeurd', () => {
  const b = blok(3);
  const t = b.taken.find((x) => x.id === '6.1');
  assert.equal(t.toepassing.figuur, 'vpc');
  assert.equal(bouwTaakModel(t, b).stappen[3].figuur, 'vpc', 'het taakmodel geeft de figuur door aan stap 4');
  assert.match(lees('js/leerblok.js'), /FIGUREN\[s4\.figuur\]\?\.bouw\(\{ met \}\)/);
  t.toepassing.figuur = 'swot';
  assert.match(controleerFormaat(b, 'leerblok-3.json').fouten.join('\n'), /taak 6\.1: toepassing\.figuur "swot" is onbekend/);
});

test('Figuur BMC: taak 7.1 toont het business model canvas van Strategyzer (z.d.-a, CC BY-SA 3.0) in stof, oefenen en toepassen; de stof licht toe en somt niet op (ADR B92)', () => {
  const b = blok(3);
  const t = b.taken.find((x) => x.id === '7.1');
  assert.equal(t.stof.figuur, 'bmc');
  assert.equal(t.oefening.figuur, 'bmc');
  assert.equal(t.toepassing.figuur, 'bmc');
  assert.equal(bouwTaakModel(t, b).stappen[2].oefening.figuur, 'bmc');
  assert.equal(bouwTaakModel(t, b).stappen[3].figuur, 'bmc');
  assert.match(t.stof.alineas[1], /midden.*[Rr]echts.*[Ll]inks.*[Oo]nderaan/s, 'de stof legt uit hoe je het canvas leest');
  assert.doesNotMatch(t.stof.alineas.join(' '), /kernpartners, kernactiviteiten/i, 'de figuur toont de bouwstenen; de stof somt ze niet op');
  const dom = lees('js/dom.js');
  assert.match(dom, /src: 'media\/citaten\/strategyzer-zd-business-model-canvas\.webp', width: 1200, height: 728/);
  assert.match(dom, /alt: 'Het business model canvas: /);
  assert.match(dom, /met\('\(Strategyzer, z\.d\.-a\)'\)/, 'bronvermelding in het bijschrift');
  assert.match(dom, /creativecommons\.org\/licenses\/by-sa\/3\.0\//, 'link naar de licentie van het sjabloon');
  const opties = t.toepassing.velden.find((v) => v.id === 'geraakt').opties;
  for (const nl of opties) assert.ok(dom.includes(`'${nl}'`), `de tabel onder de figuur noemt ${nl}`);
  assert.match(lees('js/leerblok.js'), /bmc: \{ bouw: bmcFiguur, na: 0 \}/);
});

test('SX-13: elke oefenvraag van de vier leerblokken heeft een hint; de hint staat achter een knop (details), niet op mouse-over', () => {
  let n = 0;
  for (const nr of [1, 2, 3, 4]) {
    for (const t of blok(nr).taken) {
      for (const v of t.oefening?.velden ?? t.toepassing.velden) { assert.ok(v.hint?.length > 10, `${t.id} ${v.id}`); n += 1; }
    }
  }
  assert.equal(n, 54);
  const dom = lees('js/dom.js');
  assert.match(dom, /h\('details', \{ class: 'hint' \}, h\('summary', \{\}, 'Hint'\)/);
  assert.doesNotMatch(dom, /onmouse|onpointerenter|interestfor/);
});

test('SX-13 (sabotage): een oefenvraag zonder hint of met een hint die het modelantwoord verklapt, is een fout', () => {
  const b = blok(1);
  const t = b.taken.find((x) => x.id === '1.1');
  delete t.oefening.velden[0].hint;
  t.oefening.velden[1].hint = `Het antwoord: ${t.modelantwoord.velden.pastNiet}`;
  const f = controleerFormaat(b, 'leerblok-1.json').fouten.join('\n');
  assert.match(f, /oefenvraag drieC heeft geen hint/);
  assert.match(f, /de hint bij pastNiet verklapt het modelantwoord/);
});

test('ADR B85: elke hint zegt waar het antwoord staat; een bron bestaat in de bronnenlijst en een stofverwijzing naar een bestaande taak', () => {
  const bronIds = new Set([1, 2, 3, 4].flatMap((n) => JSON.parse(lees(`data/bronnen-${n}.json`)).bronnen.map((b) => b.id)));
  const taken = new Map([1, 2, 3, 4].flatMap((n) => blok(n).taken.map((t) => [t.id, n])));
  let bronnen = 0;
  for (const nr of [1, 2, 3, 4]) {
    for (const t of blok(nr).taken) {
      for (const v of t.oefening?.velden ?? t.toepassing.velden) {
        assert.ok(v.hintBron?.length >= 1, `${t.id} ${v.id}`);
        for (const w of v.hintBron) {
          if (w.soort === 'bron') { assert.ok(bronIds.has(w.bron), `${t.id} ${v.id}: bron ${w.bron}`); bronnen += 1; }
          if (w.soort === 'stof') assert.equal(taken.get(w.taak), w.leerblok ?? nr, `${t.id} ${v.id}: taak ${w.taak}`);
          assert.doesNotMatch(JSON.stringify(w), /draaiboek/i, 'het draaiboek is een docentdocument');
        }
      }
    }
  }
  assert.ok(bronnen >= 8, 'waar een bron het antwoord aantoonbaar bevat, staat hij erbij');
  assert.match(lees('js/dom.js'), /h\('strong', \{\}, 'Waar staat het: '\)/);
});

test('ADR B85 (sabotage): een oefenvraag zonder vindplaats of met een onbekende taak is een fout', () => {
  const b = blok(1);
  const t = b.taken.find((x) => x.id === '1.1');
  delete t.oefening.velden[0].hintBron;
  t.oefening.velden[1].hintBron = [{ soort: 'stof', taak: '9.9' }];
  const f = controleerFormaat(b, 'leerblok-1.json').fouten.join('\n');
  assert.match(f, /oefenvraag drieC zegt niet waar het antwoord staat/);
  assert.match(f, /taak 9\.9 staat niet in dit leerblok/);
});

test('ADR B85 (sabotage): een hint mag niet vooruit verwijzen naar stof die de student nog niet heeft gezien', () => {
  const b = blok(1);
  b.taken.find((x) => x.id === '1.1').oefening.velden[0].hintBron = [{ soort: 'stof', taak: '2.1', vindplaats: 'alinea 1' }];
  assert.match(controleerFormaat(b, 'leerblok-1.json').fouten.join('\n'), /verwijst vooruit naar taak 2\.1/);
  const c = blok(1);
  c.taken[0].oefening.velden[0].hintBron = [{ soort: 'stof', taak: '5.1', leerblok: 3 }];
  assert.match(controleerFormaat(c, 'leerblok-1.json').fouten.join('\n'), /verwijst vooruit naar leerblok 3/);
});

test('TK-19: een vraag gaat altijd over stof die ervoor is behandeld; alleen een bron of het werkboek is niet genoeg (sabotage)', () => {
  for (const nr of [1, 2, 3, 4]) {
    for (const t of blok(nr).taken) {
      for (const v of t.oefening?.velden ?? t.toepassing.velden) {
        assert.ok(v.hintBron.some((w) => w.soort === 'stof' || w.soort === 'eigen werk'), `${t.id} ${v.id}`);
      }
    }
  }
  const b = blok(1);
  b.taken[0].oefening.velden[1].hintBron = [{ soort: 'bron', bron: 'mit-ocw-2014', citatie: 'MIT OpenCourseWare, 2014', vindplaats: '5:07' }];
  assert.match(controleerFormaat(b, 'leerblok-1.json').fouten.join('\n'), /gaat niet over stof die ervoor is behandeld \(TK-19\)/);
});
