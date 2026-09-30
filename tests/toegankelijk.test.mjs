import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensUit } from '../tools/contrast-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const paginas = readdirSync(root).filter((n) => n.endsWith('.html')).sort();
const css = lees('css/site.css') + lees('css/stakeholderbord.css'); // het stakeholderbord heeft een eigen stylesheet (PF-4)

test('QA-6: elke pagina gebruikt css/site.css; het accent is #E50056 en kleuren staan als token in :root', () => {
  assert.ok(paginas.length >= 10);
  for (const p of paginas) assert.match(lees(p), /<link rel="stylesheet" href="css\/site\.css">/, p);
  assert.equal(tokensUit(css)['--accent'].toUpperCase(), '#E50056');
  const buitenRoot = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:root\s*\{[^}]*\}/, '');
  assert.deepEqual(buitenRoot.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [], [], 'kleur buiten de tokens');
  assert.match(css, /--f:[^;]*"Avenir Next"/, 'lettertypestapel van de zusterdocumenten');
  assert.doesNotMatch(css, /@import|@font-face|url\(/, 'geen externe of ingesloten lettertypen');
});

for (const p of paginas) {
  test(`TG-1/TG-5: ${p} heeft taal, titel, sprongkoppeling, landmarks en één h1`, () => {
    const html = lees(p);
    assert.match(html, /<html lang="nl">/);
    assert.match(html, /<title>[^<]{3,}<\/title>/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<a class="skip" href="#inhoud">/);
    assert.match(html, /<main id="inhoud" tabindex="-1">/);
    assert.match(html, /<nav aria-label="Hoofdmenu">/);
    assert.match(html, /<header>/);
    assert.match(html, /<footer>/);
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  });
}

test('TG-2: focus blijft zichtbaar (geen outline:none op invoer) en elke besturing heeft een focusregel', () => {
  assert.match(css, /:focus-visible\s*\{\s*outline:\s*4px solid var\(--accent\)/);
  assert.doesNotMatch(css.replace(/main:focus\s*\{[^}]*\}/, ''), /outline\s*:\s*(none|0)\b/);
});

test('PF-3: geen service worker, geen cookies en geen netwerkverzoek buiten het eigen domein (ADR B66)', () => {
  const bronnen = readdirSync(resolve(root, 'js'), { recursive: true }).filter((n) => n.endsWith('.js')).map((n) => lees(`js/${n}`));
  for (const b of bronnen) {
    assert.doesNotMatch(b, /document\.cookie/);
    assert.doesNotMatch(b, /fetch\(\s*['"`]https?:/);
    assert.doesNotMatch(b, /\b(XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b/);
  }
  assert.ok(!existsSync(resolve(root, 'sw.js')), 'een service worker hoort niet bij SI-4/PR-1: zie ADR B66');
});

test('PF-5: elk leerblok toont zijn richttijd van 45 min (4 leerblokken); de tijden tellen op tot 45 zonder verdieping', () => {
  const overzicht = JSON.parse(lees('data/leerblokken.json'));
  assert.equal(overzicht.leerblokken.length, 4);
  for (const b of overzicht.leerblokken) assert.equal(b.richttijd, 45, `leerblok ${b.nummer}`);
  assert.match(lees('js/leerblok.js'), /± \$\{blok\.richttijd\} min/); // DESIGN §8: „± 45 min”, geen woord „richttijd”
  assert.ok(!existsSync(resolve(root, 'js/leerblok-stub.js')), 'leerblok 3 gebruikt sinds fase 10 leerblok.js');
});

test('SX-8: links gebruiken de linkkleur uit de tokens (geen browserblauw)', () => {
  const t = tokensUit(css);
  assert.ok(t['--link'] && t['--link-hover'] && t['--leeg'], 'tokens --link, --link-hover en --leeg in :root');
  assert.match(css, /(^|\n)a \{ color:var\(--link\);/, 'een algemene a-regel met var(--link)');
  assert.match(css, /a:hover \{ color:var\(--link-hover\); \}/);
});

test('B74: „Te doen" is neutraal; geen waarschuwingskleur op de lege staat', () => {
  assert.match(css, /\.status-nog-niet \{ background:var\(--leeg\); \}/);
  assert.match(css, /\.dos-tegel-nog-niet \{ background:var\(--leeg\); \}/);
  assert.doesNotMatch(css, /nog-niet[^{]*\{[^}]*var\(--accent\)/);
});
