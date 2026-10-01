// Media (fase 12 en 13): de routekeuze (MD-1, MD-2), de uitleg (MD-3), de video's (MD-4…MD-7), de spellen (MD-8…MD-11, MD-13, MD-15),
// de kijktips (MD-14, MD-16) en de stapkaart van de docent (DM-13). Alles statisch of op de data: het gedrag in de browser
// (toetsenbord, netwerktrace, afspelen) staat in de testpoort van het bouwplan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leesRoute, bewaarRoute, ROUTES, uitlegWoorden, modelRegels, klaarAlsVan, transcriptVan, MAX_WOORDEN_UITLEG, MAX_VIDEO_SECONDEN, MAX_VIDEO_BYTES } from '../js/media.js';
import {
  tekstversie, beoordeelKaart, effectVan, vergelijkVoorspelling, voorspellingVolledig, KAPITALEN, geschatteSeconden, MAX_SECONDEN,
  beoordeelKeuze, stelVraagSamen, rasterVan, vakVoor,
} from '../js/spel-model.js';
import { maakStore, geheugenOpslag } from '../js/store.js';
import { controleerMedia, controleerMap, controleerVideo } from '../tools/content-check.mjs';
import { controleerSpel } from '../tools/spel-check.mjs';
import { ondertitelStukken, maakVtt } from '../tools/maak-video.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => readFileSync(resolve(root, p), 'utf8');
const json = (p) => JSON.parse(lees(p));
const blok = (n) => json(`data/leerblok-${n}.json`);
const MET_MEDIA = [1, 2, 3, 4].map(blok);
const spellen = () => MET_MEDIA.map((b) => json(b.media.spel.bestand));
const spel = (id) => json(`spellen/${id}.json`);
const bron = (p) => lees(p).replace(/(^|\s)\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const htmlPaginas = readdirSync(root).filter((n) => n.endsWith('.html'));
const heeftFfprobe = (() => { try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
const ffprobeDuur = (p) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).toString().trim());
const heeftFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();

// ---------------------------------------------------------------- MD-1, MD-2

test('MD-1: alle vier de leerblokken hebben elk drie routes (tekst, video, spel) met dezelfde oefentaak', () => {
  assert.deepEqual(ROUTES, ['tekst', 'video', 'spel']);
  for (const b of MET_MEDIA) {
    assert.ok(b.media.uitleg && b.media.video && b.media.spel, `leerblok ${b.leerblok}: uitleg, video en spel`);
    assert.ok(b.taken.some((t) => t.id === b.media.taak), 'de media horen bij een taak van het leerblok');
    assert.equal(klaarAlsVan(b), b.taken.find((t) => t.id === b.media.taak).klaarAls.tekst, 'elke route toont dezelfde „klaar als”');
    assert.equal(json(b.media.spel.bestand).taak, b.media.taak, 'het spel hoort bij dezelfde taak');
  }
});

test('MD-2: tekst is de standaard, de laatste keuze wordt onthouden als meta en nooit als bewijsrecord', () => {
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  assert.equal(leesRoute(store, 2), 'tekst');
  bewaarRoute(store, 2, 'spel');
  assert.equal(leesRoute(store, 2), 'spel');
  assert.equal(leesRoute(store, 4), 'tekst', 'per leerblok');
  assert.deepEqual(store.ids(), [], 'geen bewijsrecord');
  assert.equal(opslag.length, 1);
  assert.equal(opslag.key(0), 'a3l:meta:media:route:2');
  store.setMeta('media:route:2', 'iets-anders');
  assert.equal(leesRoute(store, 2), 'tekst', 'een onbekende waarde valt terug op tekst');
  assert.throws(() => bewaarRoute(store, 2, 'film'));
});

test('MD-2: de pagina toont drie knoppen en één „klaar als” buiten de route, met een link naar de oefening (statisch)', () => {
  const js = bron('js/media.js');
  assert.match(js, /for \(const r of ROUTES\) knoppen\.set/);
  assert.match(js, /md-klaar[\s\S]{0,400}klaarAlsVan\(blok\)/);
  assert.match(js, /href: `#oefening-\$\{taak\}`/);
  assert.match(bron('js/leerblok.js'), /mediaSectie = bouwMediaSectie\(\{ blok, store, met,/);
});

// ---------------------------------------------------------------- MD-3

test('MD-3: de uitleg heeft hoogstens 300 woorden, met een voorbeeld en het modelantwoord van de oefencasus uit de taak', () => {
  for (const b of MET_MEDIA) {
    const w = uitlegWoorden(b);
    assert.ok(w > 100 && w <= MAX_WOORDEN_UITLEG, `leerblok ${b.leerblok}: ${w} woorden`);
    assert.ok(b.media.uitleg.voorbeeld.length > 50);
    const taak = b.taken.find((t) => t.id === b.media.taak);
    const regels = modelRegels(b);
    assert.ok(regels.length >= 2);
    for (const r of regels) assert.equal(r.tekst, taak.modelantwoord.velden[r.id]);
  }
});

test('MD-3, BR-4: de uitleg noemt bronnen als (Auteur, jaar)', () => {
  for (const b of MET_MEDIA) assert.match(b.media.uitleg.alineas.join(' '), /\((?:[A-Z][^(),]+), \d{4}\)/);
});

// ---------------------------------------------------------------- MD-4, MD-5, MD-6, MD-7

// B105, B108, B109: V1, V2 en V3 zijn externe video's (een link naar YouTube); V4 is de enige eigen video.
const EIGEN = MET_MEDIA.filter((b) => !b.media.video.url);
test('MD-4: er is één eigen video (V4), hoogstens 3 minuten en hoogstens 20 MB (ffprobe, anders metadata)', () => {
  const meta = json('media/metadata.json');
  assert.deepEqual(MET_MEDIA.map((b) => b.media.video.id), ['V1', 'V2', 'V3', 'V4']);
  assert.deepEqual(EIGEN.map((b) => b.media.video.id), ['V4']);
  assert.equal(Object.keys(meta).length, 1, 'metadata voor precies één eigen video');
  for (const b of EIGEN) {
    assert.deepEqual(controleerVideo(resolve(root, b.media.video.bestand), meta[b.media.video.bestand], b.media.video.id).fouten, [], `controleerVideo ${b.media.video.id}`);
    const v = b.media.video;
    const pad = resolve(root, v.bestand);
    assert.ok(existsSync(pad), `${v.bestand} bestaat`);
    const bytes = statSync(pad).size;
    assert.ok(bytes <= MAX_VIDEO_BYTES, `${v.id}: ${bytes} bytes`);
    assert.ok(meta[v.bestand].bytes <= MAX_VIDEO_BYTES);
    const duur = heeftFfprobe ? ffprobeDuur(pad) : meta[v.bestand].duurSeconden;
    assert.ok(duur > 30 && duur <= MAX_VIDEO_SECONDS_OF(duur), `${v.id}: ${duur} s`);
    if (heeftFfprobe) {
      assert.ok(Math.abs(meta[v.bestand].duurSeconden - duur) < 1, `metadata klopt met ffprobe (${meta[v.bestand].duurSeconden} tegen ${duur})`);
      assert.equal(meta[v.bestand].bytes, bytes, 'metadata klopt met de bestandsgrootte');
    }
  }
});
const MAX_VIDEO_SECONDS_OF = () => MAX_VIDEO_SECONDEN;

test('MD-4: de videocontrole faalt bij een echte video van 4 minuten, een bestand van meer dan 20 MB en metadata die liegt', { skip: !heeftFfmpeg && 'ffmpeg ontbreekt' }, () => {
  const map = mkdtempSync(join(tmpdir(), 'md4-'));
  const lang = join(map, 'lang.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=64x64:r=1', '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '240', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', lang]);
  const echt = ffprobeDuur(lang);
  assert.ok(echt > MAX_VIDEO_SECONDEN, `testvideo duurt ${echt} s`);
  const eerlijk = { duurSeconden: echt, bytes: statSync(lang).size };
  assert.match(controleerVideo(lang, eerlijk, 'lang').fouten.join('\n'), /meer dan 180 s \(MD-4, ffprobe\)/, 'een echte video van 4 minuten faalt');
  const leugen = { duurSeconden: 100, bytes: statSync(lang).size };
  assert.match(controleerVideo(lang, leugen, 'lang').fouten.join('\n'), /ffprobe meldt 24\d/, 'metadata die te weinig zegt verbergt de echte duur niet');
  const groot = join(map, 'groot.mp4');
  writeFileSync(groot, Buffer.alloc(MAX_VIDEO_BYTES + 1));
  assert.match(controleerVideo(groot, { duurSeconden: 60, bytes: MAX_VIDEO_BYTES + 1 }, 'groot').fouten.join('\n'), /is meer dan 20 MB/);
  assert.match(controleerVideo(join(map, 'kort.mp4'), {}, 'kort').fouten.join('\n'), /bestaat niet/);
  const echteVideo = resolve(root, EIGEN[0].media.video.bestand);
  assert.match(controleerVideo(echteVideo, { duurSeconden: 200, bytes: statSync(echteVideo).size }, EIGEN[0].media.video.id).fouten.join('\n'), /metadata zegt 200 s/, 'metadata boven 3 minuten faalt ook');
});

test('MD-5: elke eigen video heeft WebVTT-ondertitels en een transcript dat uit dezelfde spreektekst komt', () => {
  const meta = json('media/metadata.json');
  for (const b of EIGEN) {
    const v = b.media.video;
    const vtt = lees(v.ondertitels);
    assert.match(vtt, /^WEBVTT\n\n/);
    const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})\n([^\n]+(?:\n[^\n]+)*)/g)];
    assert.ok(cues.length >= 20, `${v.id}: ${cues.length} cues`);
    const sec = (m, i) => Number(m[i]) * 3600 + Number(m[i + 1]) * 60 + Number(m[i + 2]) + Number(m[i + 3]) / 1000;
    let vorige = 0;
    for (const c of cues) { assert.ok(sec(c, 1) >= vorige - 0.001 && sec(c, 5) > sec(c, 1)); vorige = sec(c, 5); }
    assert.ok(vorige <= meta[v.bestand].duurSeconden + 0.5, 'de laatste ondertitel eindigt binnen de video');
    const cueWoorden = cues.map((c) => c[9]).join(' ').split(/\s+/).length;
    const transcriptWoorden = transcriptVan(v).join(' ').split(/\s+/).length;
    assert.equal(cueWoorden, transcriptWoorden, 'ondertitels en transcript hebben dezelfde woorden');
    assert.ok(transcriptVan(v).length >= 6);
  }
});

test('MD-5: het transcript en de uitleg horen bij elkaar (voorbeeld, modelantwoord, „klaar als” letterlijk erin)', () => {
  const r = controleerMedia(resolve(root, 'data'), MET_MEDIA);
  assert.deepEqual(r.fouten, []);
  const kapot = structuredClone(MET_MEDIA);
  const eigen = kapot.find((b) => !b.media.video.url).media.video;
  eigen.dias = eigen.dias.filter((d) => d.titel !== 'Voorbeeld');
  assert.match(controleerMedia(resolve(root, 'data'), kapot).fouten.join('\n'), /transcript bevat voorbeeld/);
});

test('MD-3: de contentcontrole faalt bij een uitleg van meer dan 300 woorden', () => {
  const kapot = structuredClone(MET_MEDIA);
  kapot[1].media.uitleg.alineas.push('woord '.repeat(120));
  assert.match(controleerMedia(resolve(root, 'data'), kapot).fouten.join('\n'), /hoogstens 300/);
});

test('MD-6: geen autoplay en geen video vóór de klik: geen <video> in een pagina, één h(\'video\') in de klikfunctie, preload="none"', () => {
  for (const n of htmlPaginas) assert.doesNotMatch(lees(n), /<video|<audio|<source/i, `${n} bevat een mediaelement`);
  for (const bestand of ['js/media.js', 'js/spel.js', 'js/docent/pagina.js', 'js/leerblok.js']) {
    assert.doesNotMatch(bron(bestand), /['"]?autoplay['"]?\s*[:=]|\.autoplay\b|<video[^>]*autoplay/i, `${bestand}: autoplay`);
    for (const m of bron(bestand).matchAll(/preload['"]?\s*[:=]\s*['"]?(\w+)/g)) assert.equal(m[1], 'none', `${bestand}: preload ${m[1]}`);
  }
  const media = bron('js/media.js');
  assert.equal(media.split("h('video'").length - 1, 1, 'precies één videoelement in de code');
  assert.ok(media.indexOf("h('video'") > media.indexOf('const start = () =>'), 'het element wordt pas in de klikfunctie gemaakt');
  assert.match(media, /preload: 'none'/);
  assert.doesNotMatch(media, /poster/i, 'geen poster: die zou een verzoek doen vóór de klik');
});

test('MD-7: video, ondertitels en spellen staan op dezelfde site (geen adres naar een ander domein in media.js, spel.js en de data)', () => {
  for (const bestand of ['js/media.js', 'js/spel.js', 'js/spel-model.js']) assert.doesNotMatch(bron(bestand), /https?:\/\/|\/\/[\w-]+\.\w{2,}/, bestand);
  for (const b of EIGEN) for (const p of [b.media.video.bestand, b.media.video.ondertitels]) assert.match(p, /^media\/[\w.-]+$/);
  for (const b of MET_MEDIA) assert.match(b.media.spel.bestand, /^spellen\/[\w.-]+$/);
  assert.match(lees('docent.html'), /media-src 'self'/);
  assert.doesNotMatch(lees('docent.html'), /media-src[^;]*https?:/);
});

test('MD-4: de ondertitelknip houdt regels kort en de VTT-tijden lopen op', () => {
  assert.ok(ondertitelStukken('Een zin. '.repeat(3) + 'lang '.repeat(40)).every((s) => s.length <= 100));
  const vtt = maakVtt([{ start: 1, spreekDuur: 4, tekst: 'Eén. Twee.' }]);
  assert.match(vtt, /00:00:01\.000 --> 00:00:02\.\d{3}\nEén\./);
});

// ---------------------------------------------------------------- spellen: MD-8, MD-9, MD-10, MD-11, MD-13, MD-15

test('MD-8, MD-10, MD-13, MD-15: alle vier de spellen voldoen aan de controle (duur, feedback per keuze, geen score, geen netwerk, fictief)', () => {
  assert.deepEqual(spellen().map((s) => s.id), ['vraagslijper', 'bronnen-detective', 'stakeholder-radar', 'waarde-simulator']);
  assert.deepEqual(spellen().map((s) => s.leerblok), [1, 2, 3, 4], 'één spel per leerblok');
  for (const s of spellen()) assert.deepEqual(controleerSpel(s), [], s.id);
  for (const s of spellen()) assert.ok(geschatteSeconden(s) <= MAX_SECONDEN, `${s.id}: geschat ${geschatteSeconden(s)} s`);
  const [detective, sim] = [spel('bronnen-detective'), spel('waarde-simulator')];
  assert.equal(detective.kaarten.length, 6);
  assert.ok(detective.kaarten.every((k) => k.fictief === true), '100 % van de kaarten is fictief');
  assert.equal(sim.beslissingen.length, 3);
  assert.ok(sim.fictief && sim.beslissingen.every((b) => b.fictief === true));
  for (const s of [detective, sim]) assert.ok(geschatteSeconden(s) <= MAX_SECONDEN);
});

test('MD-8, MD-10: de Vraagslijper heeft drie rondes met per veld drie opties, eigen feedback en één sterkste optie, en stelt de vraag samen in het format', () => {
  const v = spel('vraagslijper');
  assert.equal(v.rondes.length, 3);
  assert.deepEqual(v.velden.map((x) => x.id), ['gebruiker', 'pain', 'waarde']);
  for (const r of v.rondes) {
    assert.equal(r.fictief, true);
    for (const veld of v.velden) {
      assert.equal(r.keuzes[veld.id].length, 3);
      assert.equal(new Set(r.keuzes[veld.id].map((o) => beoordeelKeuze(r.keuzes[veld.id], o.id).feedback)).size, 3, 'eigen feedback per optie');
      assert.equal(r.keuzes[veld.id].filter((o) => beoordeelKeuze(r.keuzes[veld.id], o.id).passend).length, 1);
    }
  }
  const r = v.rondes[0];
  const sterkste = Object.fromEntries(v.velden.map((x) => [x.id, r.keuzes[x.id].find((o) => o.passend).id]));
  const vraag = stelVraagSamen(v, r, sterkste);
  assert.match(vraag, /^Wat is de beste oplossing voor klanten die .* om niet lang .*, zodat klanten de webshop weer vertrouwen/);
  assert.doesNotMatch(vraag, /[{}]/);
  assert.match(stelVraagSamen(v, r, { gebruiker: sterkste.gebruiker }), /om \{pain\}, zodat \{waarde\}/, 'een ontbrekende keuze blijft zichtbaar');
  assert.throws(() => beoordeelKeuze(r.keuzes.pain, 'z'));
});

test('MD-8, MD-10: de Stakeholder-radar heeft zes stakeholders met invloed en belang, vier vakken en twee slotvragen met feedback per keuze', () => {
  const r = spel('stakeholder-radar');
  assert.equal(r.rondes.length, 6);
  assert.deepEqual(r.vakken.map((v) => v.naam), ['Nauw betrekken', 'Tevreden houden', 'Op de hoogte houden', 'Volgen']);
  const plaatsing = {};
  for (const s of r.rondes) {
    assert.equal(s.fictief, true);
    plaatsing[s.id] = Object.fromEntries(s.velden.map((v) => [v.id, v.opties.find((o) => o.passend).id]));
  }
  const raster = rasterVan(r, plaatsing);
  assert.equal(raster.flatMap((v) => v.stakeholders).length, 6, 'elke stakeholder staat in precies één vak');
  assert.deepEqual(raster.find((v) => v.id === 'nauw').stakeholders, ['Directie van de webshop']);
  assert.equal(vakVoor(r, 'hoog', 'laag').id, 'tevreden');
  assert.deepEqual(rasterVan(r, { s1: { invloed: 'hoog' } }).flatMap((v) => v.stakeholders), [], 'een halve keuze telt niet');
  assert.deepEqual(r.slotVragen.map((q) => q.opties.find((o) => o.passend).id), ['s3', 's5']);
  for (const q of r.slotVragen) assert.equal(new Set(q.opties.map((o) => o.feedback)).size, 6);
});

test('MD-8, MD-10, MD-15: de controle faalt bij een Vraagslijper of Stakeholder-radar zonder sterkste optie, zonder feedback of zonder fictief', () => {
  const kapot = (id, f) => { const k = structuredClone(spel(id)); f(k); return controleerSpel(k).join('\n'); };
  assert.match(kapot('vraagslijper', (k) => { k.rondes[0].keuzes.pain[1].passend = false; }), /precies één optie past het best/);
  assert.match(kapot('vraagslijper', (k) => { k.rondes[1].keuzes.waarde[0].feedback = ''; }), /feedback/);
  assert.match(kapot('vraagslijper', (k) => { k.rondes[2].fictief = false; }), /fictief/);
  assert.match(kapot('vraagslijper', (k) => { k.rondes.pop(); }), /drie rondes/);
  assert.match(kapot('vraagslijper', (k) => { k.format = 'Wat is de beste oplossing?'; }), /format/);
  assert.match(kapot('stakeholder-radar', (k) => { k.rondes[3].velden[0].opties[1].feedback = k.rondes[3].velden[0].opties[0].feedback; }), /eigen feedback/);
  assert.match(kapot('stakeholder-radar', (k) => { k.rondes[0].velden[1].opties[0].passend = false; }), /precies één/);
  assert.match(kapot('stakeholder-radar', (k) => { k.slotVragen.pop(); }), /twee slotvragen/);
  assert.match(kapot('stakeholder-radar', (k) => { k.rondes[2].soort = 'ergens'; }), /intern of extern/);
  assert.match(kapot('stakeholder-radar', (k) => { k.rondes.push(...structuredClone(k.rondes)); }), /zes stakeholders|geschatte duur/);
  assert.match(kapot('stakeholder-radar', (k) => { k.intro += ' Je haalt zoveel punten als je kunt.'; }), /score of ranglijst/);
});

test('MD-10: de controle faalt bij een score, een ranglijst, een kaart zonder fictief of een optie zonder feedback', () => {
  const detective = spel('bronnen-detective');
  const met = (f) => { const k = structuredClone(detective); f(k); return controleerSpel(k).join('\n'); };
  assert.match(met((k) => { k.score = 0; }), /score/);
  assert.match(met((k) => { k.kaarten[0].fictief = false; }), /fictief/);
  assert.match(met((k) => { k.kaarten[2].opties[1].feedback = ''; }), /feedback/);
  assert.match(met((k) => { k.slot += ' Je staat op de ranglijst.'; }), /ranglijst/);
  assert.match(met((k) => { k.intro += ' Zie https://voorbeeld.nl'; }), /netwerkadres/);
  assert.match(met((k) => { k.kaarten.push({ ...k.kaarten[0], id: 'k7' }); k.kaarten.push({ ...k.kaarten[0], id: 'k8' }); }), /zes kaarten|geschatte duur/);
});

test('MD-9: elk spel heeft een tekstversie met alle kaarten of beslissingen, opties en feedback', () => {
  const [detective, sim] = [spel('bronnen-detective'), spel('waarde-simulator')];
  const t1 = tekstversie(detective);
  assert.equal(t1.length, 6);
  for (const [i, k] of detective.kaarten.entries()) {
    const tekst = t1[i].regels.join('\n');
    for (const o of k.opties) assert.ok(tekst.includes(o.feedback));
    for (const g of k.gegevens) assert.ok(tekst.includes(g.tekst));
    assert.match(t1[i].kop, /fictief/);
  }
  const vs = tekstversie(spel('vraagslijper'));
  assert.equal(vs.length, 3);
  for (const [i, r] of spel('vraagslijper').rondes.entries()) for (const veld of Object.values(r.keuzes)) for (const o of veld) assert.ok(vs[i].regels.join('\n').includes(o.feedback));
  const rs = tekstversie(spel('stakeholder-radar'));
  assert.equal(rs.length, 8, 'zes stakeholders en twee slotvragen');
  for (const [i, s] of spel('stakeholder-radar').rondes.entries()) for (const v of s.velden) for (const o of v.opties) assert.ok(rs[i].regels.join('\n').includes(o.feedback));
  for (const [i, q] of spel('stakeholder-radar').slotVragen.entries()) for (const o of q.opties) assert.ok(rs[6 + i].regels.join('\n').includes(o.feedback));
  const t2 = tekstversie(sim);
  assert.equal(t2.length, 3);
  for (const [i, b] of sim.beslissingen.entries()) for (const o of b.opties) assert.ok(t2[i].regels.join('\n').includes(o.feedback));
  assert.match(bron('js/spel.js'), /sp-tekstversie/);
});

test('MD-9: het spel is met alleen het toetsenbord te bedienen: alleen knoppen, keuzerondjes en keuzelijsten, geen muisgebeurtenissen', () => {
  const js = bron('js/spel.js');
  assert.doesNotMatch(js, /onmouse|onpointer|mouseover|mousedown|mouseup|dblclick|contextmenu|draggable|ondrag/i);
  assert.doesNotMatch(js, /h\('(?:div|span|li|td|p)',\s*\{[^}]*onclick/, 'een klik hoort op een knop');
  assert.match(js, /h\('button'/);
  assert.match(js, /type: 'radio'/);
  assert.match(js, /class: 'sp-keuzekaart'/, 'de simulatie: keuzes als tikbare kaarten, dus knoppen (DESIGN §7.4)');
});

test('MD-10: de feedback per keuze klopt: elke optie geeft eigen tekst en de simulator vergelijkt per kapitaal, zonder totaal', () => {
  const [detective, sim] = [spel('bronnen-detective'), spel('waarde-simulator')];
  for (const k of detective.kaarten) {
    assert.equal(new Set(k.opties.map((o) => beoordeelKaart(k, o.id).feedback)).size, 3);
    assert.equal(k.opties.filter((o) => beoordeelKaart(k, o.id).passend).length, 1);
  }
  const b = sim.beslissingen[1];
  const voorspelling = Object.fromEntries(KAPITALEN.map((k) => [k, 'plus']));
  assert.ok(voorspellingVolledig(voorspelling));
  assert.ok(!voorspellingVolledig({ financieel: 'plus' }));
  const r = vergelijkVoorspelling(b, 'a', voorspelling);
  assert.equal(r.length, 6);
  assert.deepEqual(Object.keys(r[0]).sort(), ['gelijk', 'kapitaal', 'termijn', 'toelichting', 'voorspeld', 'werkelijk']);
  assert.equal(r.find((x) => x.kapitaal === 'menselijk').gelijk, false);
  assert.equal(effectVan(b, 'a').find((e) => e.kapitaal === 'natuurlijk').termijn.join(), 'geen,geen,geen');
  assert.doesNotMatch(bron('js/spel.js'), /score|punten|ranglijst|percentage/i);
});

test('MD-11: een spel levert nooit een bewijsrecord: spel.js en spel-model.js raken de opslag niet, media.js schrijft alleen de routekeuze', () => {
  for (const bestand of ['js/spel.js', 'js/spel-model.js']) {
    const js = bron(bestand);
    assert.doesNotMatch(js, /from '\.\/(store|dossier|sessie|schema|profiel|context|wissel|terugblik)\.js'/, `${bestand} importeert de opslag`);
    assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|setMeta|getMeta|\.save\(|\.setItem\(|document\.cookie/, `${bestand} schrijft iets weg`);
    assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/, `${bestand} maakt een verbinding (MD-13)`);
  }
  const media = bron('js/media.js');
  assert.doesNotMatch(media, /\.save\(|localStorage|sessionStorage/);
  assert.equal(media.split('setMeta(').length - 1, 1, 'media.js schrijft één ding: de route');
  assert.match(media, /store\.setMeta\(routeSleutel\(leerblok\), route\)/);
  // een volledige spelrun op het model laat de opslag leeg
  const opslag = geheugenOpslag();
  const store = maakStore(opslag);
  const [detective, sim] = [spel('bronnen-detective'), spel('waarde-simulator')];
  for (const k of detective.kaarten) for (const o of k.opties) beoordeelKaart(k, o.id);
  for (const b of sim.beslissingen) for (const o of b.opties) vergelijkVoorspelling(b, o.id, {});
  const vsl = spel('vraagslijper');
  for (const r of vsl.rondes) for (const veld of vsl.velden) for (const o of r.keuzes[veld.id]) beoordeelKeuze(r.keuzes[veld.id], o.id);
  const rad = spel('stakeholder-radar');
  for (const q of rad.slotVragen) for (const o of q.opties) beoordeelKeuze(q.opties, o.id);
  assert.equal(opslag.length, 0);
  assert.deepEqual(store.ids(), []);
});

test('MD-13: de spelmodule laadt alleen eigen bestanden (spellen/) en pas na de klik', () => {
  const js = bron('js/media.js');
  assert.match(js, /fetch\(spel\.bestand\)/);
  assert.match(js, /import\('\.\/spel\.js'\)/);
  const laden = js.slice(js.indexOf('export async function laadSpel'), js.indexOf('/** Het spelpaneel'));
  assert.ok(laden.includes('fetch(spel.bestand)') && laden.includes("import('./spel.js')"));
  assert.match(js, /onclick: async \(\) => \{[\s\S]{0,80}knop\.disabled = true;[\s\S]{0,80}laadSpel/);
});

// ---------------------------------------------------------------- MD-14, MD-16

test('MD-16, MD-14: leerblok 1 toont twee kijktips als gewone link met bron, duur en taal, zonder inbedding', () => {
  const kt = blok(1).kijktips;
  assert.equal(kt.items.length, 2);
  assert.deepEqual(kt.items.map((k) => [k.rol, k.duur.split(' ')[0], k.taal]), [['Instap', '4:38', 'Nederlands'], ['Verdieping', '3:25', 'Engels']]);
  assert.match(kt.items[1].duur, /0:44 tot 4:09/);
  const links = json('data/bronnen-1.json').bronnen.map((b) => b.link);
  for (const k of kt.items) { assert.match(k.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+$/); assert.ok(links.includes(k.url), 'dezelfde URL als op de bronnenpagina'); assert.ok(k.verwijzing && k.duur && k.taal); }
  const js = bron('js/media.js');
  assert.match(js, /h\('a', \{ href: k\.url, target: '_blank', rel: 'noopener noreferrer' \}/);
  for (const n of htmlPaginas) assert.doesNotMatch(lees(n), /<iframe|<embed|<object/i, n);
  for (const bestand of readdirSync(resolve(root, 'js')).filter((n) => n.endsWith('.js'))) assert.doesNotMatch(bron(`js/${bestand}`), /['"`]iframe['"`]|['"`]embed['"`]|<iframe/i, `js/${bestand} maakt een iframe`);
});

// ---------------------------------------------------------------- MD-12

/** Een leerblok zonder de mediasleutels: wat een student met alleen tekst te zien krijgt. */
const alleenTekst = (b) => { const { media, kijktips, ...rest } = b; return rest; };
/** Woorden die een taak van video of spel afhankelijk maken. */
const MEDIA_AFHANKELIJK = /\b(bekijk de video|kijk de video|speel het spel|speel de simulatie|video \d|Vraagslijper|Bronnen-detective|Stakeholder-radar|Waarde-simulator)\b/i;

test('MD-12: elke taak van elk leerblok heeft alle inhoud die een student voor „klaar als” nodig heeft in de tekst, zonder video of spel', () => {
  for (const b of MET_MEDIA) {
    const tekst = alleenTekst(b);
    assert.equal(tekst.taken.length > 0, true, `leerblok ${b.leerblok}: taken`);
    for (const t of tekst.taken) {
      for (const veld of ['waarom', 'klaarAls', 'stof', 'oefening']) {
        const w = t[veld];
        const gevuld = typeof w === 'string' ? w.trim() : (w?.tekst ?? '').trim() || JSON.stringify(w ?? '').length > 4;
        assert.ok(gevuld, `leerblok ${b.leerblok} taak ${t.id}: ${veld} staat in de tekst`);
      }
    }
  }
});

test('MD-12: geen taak vraagt om een video of spel, en tekst is de standaardroute', () => {
  for (const b of MET_MEDIA) {
    assert.doesNotMatch(JSON.stringify(alleenTekst(b)), MEDIA_AFHANKELIJK, `leerblok ${b.leerblok}: een taak verwijst naar video of spel`);
    assert.equal(leesRoute(maakStore(geheugenOpslag()), b.leerblok), 'tekst', `leerblok ${b.leerblok}: standaardroute`);
  }
});

test('MD-12: de pagina van een leerblok bouwt de taken zonder de mediasectie (media wordt pas geladen als het leerblok media heeft)', () => {
  const pagina = bron('js/leerblok.js');
  assert.match(pagina, /const heeftKijktips = Boolean\(blok\.kijktips\)/);
  assert.match(pagina, /mediaPlek && blok\.media\.taak === id \? mediaPlek : null/, 'de mediasectie is optioneel en staat in de stap stof van haar taak (MD-2, ADR B79)');
  assert.match(pagina, /return mediaDirect \?\? import\('\.\/media\.js'\)/, 'media.js laadt pas als de stap stof opengaat');
  assert.match(pagina, /adres\.stap === 2 && adres\.taak === blok\.media\?\.taak\) toonMedia\(\)/);
});

test('MD-12: de controle vindt een taak die alleen via een video te doen is', () => {
  const b = alleenTekst(json('data/leerblok-2.json'));
  b.taken[0].oefening = `${typeof b.taken[0].oefening === 'string' ? b.taken[0].oefening : JSON.stringify(b.taken[0].oefening)} Bekijk de video V2 en beantwoord de vraag.`;
  assert.match(JSON.stringify(b), MEDIA_AFHANKELIJK, 'saboteer: de taak verwijst naar video V2');
  b.taken[1].klaarAls = '';
  assert.equal((b.taken[1].klaarAls ?? '').trim(), '', 'saboteer: een lege „klaar als” valt op');
});

// ---------------------------------------------------------------- DM-13 en de contentcontrole

test('DM-13: elke stapkaart van een onderdeel met media heeft video en spel (docent-data: media), zonder verzoeken naar andere domeinen', () => {
  const met = [1, 2].flatMap((n) => json(`data/docent-deel${n}.json`).onderdelen).filter((o) => o.media);
  assert.deepEqual(met.map((o) => o.id), ['d1-04', 'd1-10', 'd2-02', 'd2-10']);
  assert.deepEqual(met.map((o) => o.media.leerblok), [1, 2, 3, 4]);
  for (const o of met) assert.ok(blok(o.media.leerblok).media.video && blok(o.media.leerblok).media.spel);
  const pagina = bron('js/docent/pagina.js');
  assert.match(pagina, /from '\.\.\/media\.js'/);
  assert.match(pagina, /data-media': 'video'/);
  assert.match(pagina, /data-media': 'spel'/);
  assert.match(pagina, /if \(mediaVoor === o\.id\) return/, 'een afspelende video wordt niet opnieuw getekend');
});

test('BR-4, BR-5: de echte data voldoet aan de contentcontrole, ook de spellen en kijktips', () => {
  const r = controleerMap(resolve(root, 'data'));
  assert.deepEqual(r.fouten, []);
});

test('BR-5: een verwijzing in een spel zonder bronregel faalt', () => {
  const s = json('spellen/bronnen-detective.json');
  assert.match(s.intro, /\(American Psychological Association, 2020\)/);
  assert.match(json('spellen/waarde-simulator.json').intro, /\(International Integrated Reporting Council, 2021\)/);
});

// ---------------------------------------------------------------- B105, B108, B109: externe video's (V2, V1, V3)

test('B105: V2 is de kennisclip Betrouwbaarheid van de HAN Bibliotheek, als gewone link met afzender, duur, taal en bron', () => {
  const v = blok(2).media.video;
  assert.equal(v.url, 'https://www.youtube.com/watch?v=DS6ZHRWKQ00');
  assert.equal(v.kanaal, 'HAN Bibliotheek');
  assert.equal(v.verwijzing, '(HAN Bibliotheek, 2023)');
  for (const k of ['titel', 'duur', 'taal', 'waarom']) assert.ok(v[k], k);
  for (const k of ['bestand', 'ondertitels', 'dias']) assert.equal(v[k], undefined, `geen ${k}: geen eigen video meer`);
  assert.ok(!existsSync(resolve(root, 'media/v2-bronnen-beoordelen.mp4')), 'het oude bestand is weg');
});

test('B108: V1 is de kennisclip Zo formuleer je een onderzoeksvraag van de Universiteit Utrecht, met de ontwerpende vraag en een verwijzing naar de tekst', () => {
  const v = blok(1).media.video;
  assert.equal(v.url, 'https://www.youtube.com/watch?v=nfq6K9MWY3A');
  assert.equal(v.kanaal, 'Universiteit Utrecht');
  assert.equal(v.verwijzing, '(Universiteit Utrecht, 2023)');
  assert.match(v.waarom, /ontwerpende vraag/);
  assert.match(v.waarom, /staat in de tekst/, 'gebruiker, probleem en waarde staan niet in de clip');
  for (const k of ['bestand', 'ondertitels', 'dias']) assert.equal(v[k], undefined, `geen ${k}: geen eigen video meer`);
  assert.ok(!existsSync(resolve(root, 'media/v1-user-story.mp4')), 'het oude bestand is weg');
});

test('B109: V3 is de video over de stakeholderanalyse van Bureau Tromp (uitzondering op de afzendereis van MD-17), met afzender en kader genoemd', () => {
  const v = blok(3).media.video;
  assert.equal(v.url, 'https://www.youtube.com/watch?v=Bd2f0hzjfb8');
  assert.equal(v.kanaal, 'Bureau Tromp');
  assert.equal(v.verwijzing, '(Bureau Tromp, 2021)');
  assert.match(v.waarom, /opleidingsbureau/, 'de student ziet dat de afzender geen onderwijsinstelling is (AAOCC: Authority)');
  assert.match(v.waarom, /Lean Six Sigma/);
  assert.match(v.waarom, /TOM³ staan in de tekst/);
  for (const k of ['bestand', 'ondertitels', 'dias']) assert.equal(v[k], undefined, `geen ${k}: geen eigen video meer`);
  assert.ok(!existsSync(resolve(root, 'media/v3-vraagstuk-plaatsen.mp4')), 'het oude bestand is weg');
});

test('B105, MD-14: een externe video is een link in een nieuw tabblad, nooit een iframe of videoelement', () => {
  const media = bron('js/media.js');
  assert.match(media, /if \(video\.url\) return bouwExterneVideo\(\{ video, met \}\);/);
  assert.match(media, /h\('a', \{ href: video\.url, target: '_blank', rel: 'noopener noreferrer' \}/);
  assert.doesNotMatch(media, /iframe/i);
});

test('B105: de contentcontrole faalt bij een externe video zonder https-link of zonder verwijzing (Auteur, jaar)', () => {
  const kapot = structuredClone(MET_MEDIA);
  const v = kapot.find((b) => b.media.video.url).media.video;
  v.url = 'http://example.org/x';
  v.verwijzing = 'HAN';
  const f = controleerMedia(resolve(root, 'data'), kapot).fouten.join('\n');
  assert.match(f, /externe video: url moet een https-link naar YouTube zijn/);
  assert.match(f, /externe video: verwijzing heeft de vorm \(Auteur, jaar\)/);
});
