// Documentatie (fase 14): docentgids (DL-1), studentintroductie (DL-2) en de beschrijving van schema 1.0 (DL-4).
// Structuur en omvang staan hier; of de pagina's echt op één of twee A4 passen, meet de afdruktest in de testpoort van het bouwplan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VELDEN } from '../js/schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const PAGINAS = ['docs/docentgids.html', 'docs/studentintroductie.html', 'docs/dossierschema-1.0.html'];
const hoofdtekst = (html) => html.match(/<main[\s\S]*?<\/main>/)[0];
const koppen = (html, n) => [...hoofdtekst(html).matchAll(new RegExp(`<h${n}>(.*?)</h${n}>`, 'g'))].map((m) => m[1]);
const woorden = (html) => hoofdtekst(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
const MAX_WOORDEN = { 'docs/docentgids.html': 900, 'docs/studentintroductie.html': 450 };

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

test('DL-1: de docentgids heeft precies 5 onderwerpen (klok en stapkaart, bewijs, dossiers inlezen, steekproef, modelantwoord) en hoogstens 900 woorden', () => {
  const html = lees('docs/docentgids.html');
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

test('DL-2: de studentintroductie heeft precies 3 onderwerpen (wat je doet, waar je gegevens staan, exporteren en inleveren) en hoogstens 450 woorden', () => {
  const html = lees('docs/studentintroductie.html');
  const h2 = koppen(html, 2);
  assert.equal(h2.length, 3);
  assert.match(h2[0], /wat je doet/i);
  assert.match(h2[1], /gegevens/i);
  assert.match(h2[2], /exporteren en inleveren/i);
  assert.ok(woorden(html) <= MAX_WOORDEN['docs/studentintroductie.html'], `${woorden(html)} woorden`);
  assert.match(html, /Dossier exporteren \(JSON\)/, 'de knopnaam van de site staat er letterlijk in');
  assert.match(html, /Wis alles/);
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
