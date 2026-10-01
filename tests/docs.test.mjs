// Documentatie (fase 14): docentgids (DL-1), studentintroductie (DL-2) en de beschrijving van schema 1.0 (DL-4).
// Structuur en omvang staan hier; of de pagina's echt op één of twee A4 passen, meet de afdruktest in de testpoort van het bouwplan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VELDEN } from '../js/schema.js';
import { totaleTijdTekst } from '../tools/content-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const PAGINAS = ['docs/docentgids.html', 'docs/studentintroductie.html', 'docs/dossierschema-1.0.html'];
const hoofdtekst = (html) => html.match(/<main[\s\S]*?<\/main>/)[0];
const koppen = (html, n) => [...hoofdtekst(html).matchAll(new RegExp(`<h${n}>(.*?)</h${n}>`, 'g'))].map((m) => m[1]);
const woorden = (html) => hoofdtekst(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
const MAX_WOORDEN = { 'docs/docentgids.html': 1100, 'docs/studentintroductie.html': 550 };

test('DL-1, DL-2, DL-4, QA-4: elke documentatiepagina is Nederlands, heeft een titel en één h1, en haalt niets van buiten (CSP en bronnen)', () => {
  for (const p of PAGINAS) {
    const html = lees(p);
    assert.match(html, /<html lang="nl">/, `${p}: lang nl`);
    assert.match(html, /<title>[^<]+· A3 e-learning<\/title>/, `${p}: titel`);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, `${p}: één h1`);
    assert.match(html, /Content-Security-Policy" content="default-src 'none'; style-src 'self'/, `${p}: CSP zonder script en zonder derden`);
    assert.doesNotMatch(html, /<script/i, `${p}: geen script`);
    assert.doesNotMatch(html, /(src|href)="https?:\/\/(?!github\.com\/hanbedrijfskunde\/)/, `${p}: alleen een link naar de eigen repository`);
  }
});

test('DL-1, DL-2, DL-4: elke lokale link in de documentatie wijst naar een bestaand bestand', () => {
  for (const p of PAGINAS) {
    for (const [, href] of lees(p).matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)) {
      if (/^(https?:|data:|mailto:)/.test(href)) continue;
      assert.ok(existsSync(resolve(root, dirname(p), href)), `${p}: ${href} bestaat niet`);
    }
  }
  for (const p of ['README.md']) for (const [, href] of lees(p).matchAll(/\]\((docs\/[^)#]+)\)/g)) assert.ok(existsSync(resolve(root, href)), `${p}: ${href}`);
});

test('DL-1: de docentgids heeft een inleiding en precies 5 onderwerpen (klok en stapkaart, bewijs, dossiers inlezen, steekproef, modelantwoord) en hoogstens 1100 woorden', () => {
  const html = lees('docs/docentgids.html');
  const intro = html.slice(html.indexOf('<section class="intro"'), html.indexOf('</section>'));
  for (const kop of ['Waar het over gaat', 'Plaats in het programma', 'Leeruitkomsten', 'Inrichting', 'Hoe studenten ermee werken', 'Wat je ontvangt', 'Waar je op let']) assert.match(intro, new RegExp(`<strong>${kop}\\.</strong>`), `inleiding noemt ${kop}`);
  const h2 = koppen(html, 2);
  assert.equal(h2.length, 5);
  assert.match(h2[0], /docentmodus/i);
  assert.match(h2[1], /bewijs/i);
  assert.match(h2[2], /dossiers inlezen/i);
  assert.match(h2[3], /steekproef/i);
  assert.match(h2[4], /modelantwoord/i);
  const eerste = html.slice(html.indexOf(h2[0]), html.indexOf(h2[1]));
  for (const woord of ['Klok', 'Stapkaart', 'verschuiven', 'Afdrukken']) assert.match(eerste, new RegExp(woord, 'i'), `onderwerp 1 noemt ${woord}`);
  assert.ok(woorden(html) <= MAX_WOORDEN['docs/docentgids.html'], `${woorden(html)} woorden`);
});

test('DL-2: de studentintroductie heeft 4 onderwerpen (wat je doet, tijd en planning, gegevens, exporteren en inleveren) en hoogstens 550 woorden', () => {
  const html = lees('docs/studentintroductie.html');
  const h2 = koppen(html, 2);
  assert.equal(h2.length, 4);
  assert.match(h2[0], /wat je doet/i);
  assert.match(h2[1], /tijd en planning/i);
  assert.match(h2[2], /gegevens/i);
  assert.match(h2[3], /exporteren en inleveren/i);
  assert.ok(woorden(html) <= MAX_WOORDEN['docs/studentintroductie.html'], `${woorden(html)} woorden`);
  assert.match(html, /Dossier exporteren \(JSON\)/, 'de knopnaam van de site staat er letterlijk in');
  assert.match(html, /Wis alles/);
});

test('DL-2: de studentintroductie heeft een knop Start naar de startpagina, en die staat niet op papier', () => {
  const html = lees('docs/studentintroductie.html');
  assert.match(hoofdtekst(html), /<a class="knop knop-accent" href="\.\.\/index\.html">Start<\/a>/);
  assert.match(lees('docs/gids.css'), /@media print \{[^}]*\.gids \.knop \{ display: none; \}/);
});

test('DL-2, B118: „Tijd en planning” noemt de richttijd van elk leerblok en de totale tijd uit de data', () => {
  const html = lees('docs/studentintroductie.html');
  const h2 = koppen(html, 2);
  const tijd = html.slice(html.indexOf(h2[1]), html.indexOf(h2[2]));
  const overzicht = JSON.parse(lees('data/leerblokken.json'));
  for (const b of overzicht.leerblokken) assert.match(tijd, new RegExp(`Leerblok ${b.nummer}: ± ${b.richttijd} min`), `leerblok ${b.nummer}`);
  assert.match(tijd, new RegExp(`ongeveer ${totaleTijdTekst(overzicht)}`));
});

test('DL-4: de beschrijving van schema 1.0 beschrijft alle 13 velden van js/schema.js, in dezelfde volgorde, en geen ander veld', () => {
  const html = lees('docs/dossierschema-1.0.html');
  const tabel = html.match(/<tbody>[\s\S]*?<\/tbody>/)[0];
  const rijen = [...tabel.matchAll(/<th scope="row"><code>([^<]+)<\/code><\/th>/g)].map((m) => m[1]);
  assert.equal(VELDEN.length, 13);
  assert.deepEqual(rijen, [...VELDEN]);
  for (const rij of tabel.split('</tr>').filter((r) => r.includes('<th'))) assert.equal((rij.match(/<td>/g) ?? []).length, 2, 'elke rij heeft waarde en betekenis');
  assert.match(html, /SHA-256/);
  assert.match(html, /geen handtekening/);
});

test('DL-4: de waarden die de beschrijving noemt komen overeen met wat js/schema.js toestaat (status, resultaat, leerblok, luk)', async () => {
  const { STATUSSEN, RESULTATEN } = await import('../js/schema.js');
  const html = lees('docs/dossierschema-1.0.html');
  for (const w of [...STATUSSEN, ...RESULTATEN]) assert.ok(html.includes(w), `${w} staat in de beschrijving`);
  assert.match(html, /1 tot en met 4/);
  assert.match(html, /1 tot en met 5/);
});

test('DL-1, DL-2, DL-4: menu, tekst en voettekst van elke documentatiepagina staan in één kolom (dezelfde breedte en binnenmarge als .gids)', () => {
  // De kolom van site.css geldt voor header, main en footer; op deze pagina's staat het menu los in body, zonder header.
  for (const p of PAGINAS) assert.match(lees(p), /<body>\s*<a class="skip"[^>]*>[^<]*<\/a>\s*<nav aria-label="Hoofdmenu">/, `${p}: het menu staat direct in body`);
  const css = lees('docs/gids.css').replace(/@media print\s*\{[\s\S]*?\n\}/, '');
  const regel = (sel) => css.match(new RegExp(`(?:^|\\n)([^{}\\n]*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{}\\n]*)\\{([^}]*)\\}`))?.[2] ?? '';
  const waarde = (blok, eig) => blok.match(new RegExp(`${eig}\\s*:\\s*([^;]+)`))?.[1].trim();
  const kolom = regel('.gids ');
  for (const sel of ['body > nav', 'body > footer']) {
    const blok = regel(sel);
    assert.equal(waarde(blok, 'max-width'), waarde(kolom, 'max-width'), `${sel}: dezelfde breedte als .gids`);
    assert.equal(waarde(blok, 'margin-left') ?? waarde(blok, 'margin')?.split(/\s+/).pop(), 'auto', `${sel}: gecentreerd`);
    assert.equal(waarde(blok, 'padding-left') ?? waarde(blok, 'padding')?.split(/\s+/).pop(), waarde(kolom, 'padding'), `${sel}: dezelfde binnenmarge links als .gids`);
  }
});
