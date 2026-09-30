// SI-2, SI-6: wat de workflow publiceert is wat de pagina's nodig hebben. Een map die de pagina's gebruiken maar de workflow niet
// kopieert, geeft op de live site een 404 terwijl alle controles slagen (gebeurde met docs/ in fase 14).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(resolve(root, '.github/workflows/pages.yml'), 'utf8');

/** De namen die de stap „Artefact samenstellen” naar _site kopieert: `*.html` en de genoemde mappen en bestanden. */
function gepubliceerd(yml) {
  const stap = yml.slice(yml.indexOf('Artefact samenstellen'));
  const uit = new Set();
  for (const regel of stap.split('\n')) {
    const m = regel.match(/cp -r (.+?) _site\/?/);
    if (m) m[1].split(/\s+/).forEach((n) => uit.add(n));
  }
  return uit;
}
const namen = gepubliceerd(workflow);
const isGepubliceerd = (pad) => {
  const eerste = pad.split(sep)[0];
  return namen.has(eerste) || (namen.has('*.html') && pad.split(sep).length === 1 && pad.endsWith('.html'));
};
const htmlBestanden = () => [
  ...readdirSync(root).filter((n) => n.endsWith('.html')),
  ...(existsSync(resolve(root, 'docs')) ? readdirSync(resolve(root, 'docs')).filter((n) => n.endsWith('.html')).map((n) => `docs/${n}`) : []),
];

test('SI-2: de workflow kopieert de mappen css, js, data, media, spellen en docs en de bestanden LICENSE en .nojekyll', () => {
  for (const n of ['*.html', 'css', 'js', 'data', 'LICENSE', '.nojekyll', 'media', 'spellen', 'docs']) assert.ok(namen.has(n), `${n} wordt niet gepubliceerd`);
});

test('SI-2: elk lokaal bestand waar een pagina naar verwijst (link, stijl, script, video, ondertitel) wordt gepubliceerd', () => {
  for (const f of htmlBestanden()) {
    const html = readFileSync(resolve(root, f), 'utf8');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|data:|mailto:|#)/.test(url)) continue;
      const pad = url.split(/[?#]/)[0];
      if (!pad) continue;
      const doel = relative(root, resolve(root, dirname(f), pad));
      assert.ok(existsSync(resolve(root, doel)), `${f}: ${url} bestaat niet`);
      assert.ok(isGepubliceerd(doel), `${f}: ${doel} bestaat maar wordt niet gepubliceerd (workflow kopieert het niet)`);
    }
  }
});

test('SI-2: de mappen die de code inlaadt (data, media, spellen) worden gepubliceerd', () => {
  const bron = readdirSync(resolve(root, 'js')).filter((n) => n.endsWith('.js')).map((n) => readFileSync(resolve(root, 'js', n), 'utf8')).join('\n');
  for (const map of ['data', 'media', 'spellen']) if (new RegExp(`['"\`]${map}/`).test(bron)) assert.ok(namen.has(map), `js gebruikt ${map}/ maar de workflow kopieert het niet`);
});

test('SI-2: de controle vindt een map die de workflow niet kopieert (sabotage op de ontleding)', () => {
  const zonderDocs = workflow.replace(/\n.*cp -r docs _site\/.*\n/, '\n');
  assert.ok(!gepubliceerd(zonderDocs).has('docs'), 'zonder de docs-regel is docs niet gepubliceerd');
  assert.ok(gepubliceerd(workflow).has('docs'));
});
