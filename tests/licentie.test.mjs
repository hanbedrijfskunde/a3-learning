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
// Uitzondering (ADR B84): een figuur van derden als citaat, alleen in media/citaten/ en alleen als hij in het register staat.
const citaten = JSON.parse(readFileSync(resolve(root, 'media/citaten.json'), 'utf8')).citaten;
const isCitaat = (f) => f.startsWith('media/citaten/') && citaten.some((c) => c.bestand === f);
const VERBODEN_NAAM = /brightspace|phoneventure|\bcopy\b|\bkopie\b|slides?[-_ ]|\.pptx?$|\.docx?$|\.odt$|\.pdf$|\.zip$|\.(png|jpe?g|gif|webp|svg)$/i;

test('LI-1: de repository bevat alleen eigen bestandstypen (geen pdf, office-bestand, archief of afbeelding van derden)', () => {
  const lijst = bestanden();
  assert.ok(lijst.length > 50, 'er zijn bestanden gevonden');
  for (const f of lijst) {
    const ext = f.endsWith('LICENSE') ? '' : extname(f) || (f.split('/').pop().startsWith('.') ? f.split('/').pop() : '');
    if (isCitaat(f)) continue;
    assert.ok(TOEGESTAAN.has(ext), `${f}: bestandstype ${ext} is niet toegestaan`);
  }
});

test('LI-1: geen bestandsnaam wijst op Brightspace-materiaal, PhoneVentures, slides of een opgeslagen pagina van derden', () => {
  for (const f of bestanden()) if (!isCitaat(f)) assert.doesNotMatch(f.split('/').pop(), VERBODEN_NAAM, `${f}: verdachte naam`);
});

test('LI-1: elke video is een eigen video (metadata met stem en bron) en elk videobestand heeft ondertitels', () => {
  const meta = JSON.parse(readFileSync(resolve(root, 'media/metadata.json'), 'utf8'));
  const videos = bestanden().filter((f) => f.endsWith('.mp4'));
  assert.equal(videos.length, 0); // V1 tot en met V4 zijn links naar YouTube, geen bestand op de site (B105, B108, B109, B120)
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
  for (const naam of ['leerblok-1.json', 'v4-verbanden.mp4', 'docentgids.html']) assert.doesNotMatch(naam, VERBODEN_NAAM);
});

test('LI-1 en ADR B84: een citaat van derden staat in het register, verwijst naar een bron uit de bronnenlijst en bestaat; niets anders staat in media/citaten/', () => {
  const bronIds = new Set(readdirSync(resolve(root, 'data')).filter((n) => /^bronnen-\d\.json$/.test(n))
    .flatMap((n) => JSON.parse(readFileSync(resolve(root, 'data', n), 'utf8')).bronnen.map((b) => b.id)));
  assert.ok(citaten.length >= 1);
  for (const c of citaten) {
    assert.ok(bronIds.has(c.bron), `${c.bestand}: bron ${c.bron} staat in de bronnenlijst`);
    assert.ok(statSync(resolve(root, c.bestand)).size < 150_000, `${c.bestand}: klein genoeg`);
    assert.ok(c.vindplaats && c.gebruikt, `${c.bestand}: vindplaats en gebruik`);
  }
  for (const f of readdirSync(resolve(root, 'media/citaten'))) assert.ok(isCitaat(`media/citaten/${f}`), `media/citaten/${f} staat niet in het register`);
  assert.equal(isCitaat('media/citaten/logo.png'), false, 'sabotage: een onbekend beeld is geen citaat');
  assert.equal(isCitaat('img/schwagerman-ulmer-2013-figuur-1.png'), false, 'sabotage: buiten media/citaten telt niet');
});
