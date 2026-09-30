// LI-1: de site bevat alleen eigen tekst en eigen afbeeldingen plus links. Geen kopieën van Brightspace, PhoneVentures,
// slides of opgeslagen pagina's van derden. Wat het bestandstype en de naam kunnen laten zien, staat hier; de tekstovereenkomst
// met bronnen van derden bewaakt LI-3 (tests/lb3.test.mjs, tools/overlap-check.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Alle bestanden van de repository: die van git, anders een wandeling door de map (zonder .git en .claude). */
function bestanden() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root }).toString().split('\n').filter(Boolean);
  } catch (e) {
    const uit = [];
    const loop = (map) => { for (const naam of readdirSync(map)) {
      if (['.git', '.claude', 'node_modules'].includes(naam)) continue;
      const pad = join(map, naam);
      if (statSync(pad).isDirectory()) loop(pad); else uit.push(relative(root, pad));
    } };
    loop(root);
    return uit;
  }
}
const TOEGESTAAN = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.vtt', '.mp4', '.yml', '.nojekyll', '.gitignore', '']);
const VERBODEN_NAAM = /brightspace|phoneventure|\bcopy\b|\bkopie\b|slides?[-_ ]|\.pptx?$|\.docx?$|\.odt$|\.pdf$|\.zip$|\.(png|jpe?g|gif|webp|svg)$/i;

test('LI-1: de repository bevat alleen eigen bestandstypen (geen pdf, office-bestand, archief of afbeelding van derden)', () => {
  const lijst = bestanden();
  assert.ok(lijst.length > 50, 'er zijn bestanden gevonden');
  for (const f of lijst) {
    const ext = f.endsWith('LICENSE') ? '' : extname(f) || (f.split('/').pop().startsWith('.') ? f.split('/').pop() : '');
    assert.ok(TOEGESTAAN.has(ext), `${f}: bestandstype ${ext} is niet toegestaan`);
  }
});

test('LI-1: geen bestandsnaam wijst op Brightspace-materiaal, PhoneVentures, slides of een opgeslagen pagina van derden', () => {
  for (const f of bestanden()) assert.doesNotMatch(f.split('/').pop(), VERBODEN_NAAM, `${f}: verdachte naam`);
});

test('LI-1: elke video is een eigen video (metadata met stem en bron) en elk videobestand heeft ondertitels', () => {
  const meta = JSON.parse(readFileSync(resolve(root, 'media/metadata.json'), 'utf8'));
  const videos = bestanden().filter((f) => f.endsWith('.mp4'));
  assert.equal(videos.length, 4);
  for (const v of videos) {
    assert.ok(meta[v], `${v}: staat in media/metadata.json`);
    assert.ok(meta[v].stem, `${v}: metadata noemt hoe het is gemaakt`);
    assert.ok(bestanden().includes(v.replace(/\.mp4$/, '.vtt')), `${v}: heeft een .vtt`);
  }
});

test('LI-1: de site bevat geen ingebedde afbeeldingen van derden (data-URI’s alleen voor het lege icoon), en geen kopie van een pagina van derden', () => {
  for (const f of bestanden().filter((n) => n.endsWith('.html'))) {
    const html = readFileSync(resolve(root, f), 'utf8');
    assert.doesNotMatch(html, /<img\b[^>]*src="https?:/i, `${f}: geen extern beeld`);
    assert.doesNotMatch(html, /data:image\/(png|jpe?g|gif|webp)/i, `${f}: geen ingebed rasterbeeld`);
    assert.doesNotMatch(html, /saved from url=|<!-- saved from/i, `${f}: geen opgeslagen pagina van derden`);
  }
});

test('LI-1: de controle vindt een verboden bestand (sabotage op de patronen)', () => {
  for (const naam of ['Werkboek Copy.pdf', 'slides-week5.pptx', 'PhoneVentures-handleiding.md', 'brightspace-export.json', 'logo.png']) {
    assert.match(naam, VERBODEN_NAAM, `${naam} moet worden afgekeurd`);
  }
  for (const naam of ['leerblok-1.json', 'v1-user-story.mp4', 'docentgids.html']) assert.doesNotMatch(naam, VERBODEN_NAAM);
});
