import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrast, controleerContrast, kleurWaarde, paren, tokensUit, MINIMUM } from '../tools/contrast-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('TG-3: contrastratio volgens WCAG 2.1 (zwart op wit 21:1, wit op wit 1:1)', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(contrast('#ffffff', '#FFFFFF'), 1);
  assert.ok(Math.abs(contrast('#767676', '#ffffff') - 4.54) < 0.01);
});

test('TG-3: alle tekstkleuren van de site halen 4,5:1 op de oppervlakken waarop ze staan (100 % van de tekstparen)', () => {
  const { paren: lijst, fouten } = controleerContrast(root);
  assert.ok(lijst.length >= 20, `te weinig tekstparen gevonden (${lijst.length}); leest de controle de CSS nog?`);
  assert.deepEqual(fouten, []);
});

test('TG-3 (sabotage): tekst met te weinig contrast wordt als fout gemeld', () => {
  const css = ':root{--wit:#FFFFFF;--grijs:#F2F2F0;--zwart:#000000;--zwakgrijs:#999999;} .meta{color:var(--zwakgrijs);} .goed{color:var(--zwart);background:var(--wit);}';
  const tokens = tokensUit(css);
  const uit = paren(css, tokens).map((p) => ({ ...p, ratio: contrast(p.fg, p.bg) }));
  assert.ok(uit.some((p) => p.selector.startsWith('.meta') && p.ratio < MINIMUM));
  assert.ok(uit.filter((p) => p.selector === '.goed').every((p) => p.ratio >= MINIMUM));
});

test('TG-3: een kleur die niet te herleiden is (onbekend token) telt als fout, niet als geslaagd', () => {
  const tokens = { '--wit': '#ffffff' };
  assert.equal(kleurWaarde('var(--bestaat-niet)', tokens), null);
  assert.ok(paren('.x{color:var(--bestaat-niet);}', tokens)[0].fout);
});

test('TG-4: de drie statussen hebben elk een eigen tekst naast de kleur', async () => {
  const { STATUS_TEKST } = await import('../js/status.js');
  const teksten = ['compleet', 'bijna', 'nog niet'].map((s) => STATUS_TEKST[s]);
  assert.ok(teksten.every((t) => typeof t === 'string' && t.trim().length > 0));
  assert.equal(new Set(teksten).size, 3);
});
