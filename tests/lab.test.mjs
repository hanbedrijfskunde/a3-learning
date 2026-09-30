import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const lab = lees('controlelab.html');

test('1.9: controlelab.html bestaat, staat niet in index.html en wel in de sitemap van README.md', () => {
  assert.doesNotMatch(lees('index.html'), /controlelab/);
  assert.match(lees('README.md'), /controlelab\.html/);
  assert.match(lab, /<html lang="nl">/);
  assert.match(lab, /CC BY-SA 4\.0/);
});

test('1.10 (BW-3, BW-4): het lab toont statussen als tekst en kent geen score, percentage, punten of badge', () => {
  assert.match(lab, /STATUS_TEKST/);
  const zichtbaar = lab.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(zichtbaar, /score|percentage|punten|badge|ranglijst|%/i);
  assert.doesNotMatch(zichtbaar, /\d+\s*(van|\/)\s*\d+/); // geen „27 van 27"
});

test('1.9: het lab gebruikt alleen eigen modules en geen externe scripts of lettertypen (PR-1)', () => {
  assert.doesNotMatch(lab, /(src|href)="https?:\/\/(?!github\.com\/hanbedrijfskunde\/a3-learning)/);
  for (const m of ['./js/status.js', './js/schema.js', './js/checks/core.js']) assert.ok(lab.includes(m), m);
});

test('BW-8 / RC: schema, status en checks raken geen DOM, netwerk of opslag (werken in Node)', () => {
  for (const f of ['js/schema.js', 'js/status.js', 'js/checks/core.js']) {
    const bron = lees(f).replace(/^\s*\/\/.*$/gm, '');
    for (const v of ['document', 'window', 'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'navigator']) {
      assert.ok(!bron.includes(v), `${f} bevat ${v}`);
    }
  }
});
