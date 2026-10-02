// Bouwt de conceptvideo's van leerblok 1 tot en met 4 (fase 12 en 13, MD-4…MD-7): tekstdia's met een computerstem, ondertitels en metadata.
// Reproduceerbaar: de dia's en de spreektekst staan in `media.video.dias` van data/leerblok-N.json; dit script maakt er
//   media/<naam>.mp4   (H.264 + AAC, 1280 × 720, stilstaande dia's)
//   media/<naam>.vtt   (WebVTT-ondertitels, per zin verdeeld over de spreektijd van de dia)
//   media/metadata.json (duur in seconden en grootte in bytes per bestand; tests/media.test.mjs controleert die tegen ffprobe)
// Het is hulpmiddel voor de bouwer en geen onderdeel van de site: de resultaten staan in de repository, de site heeft dit script niet nodig.
//
// Vereist (macOS): `say` met een Nederlandse stem (standaard Xander), `ffmpeg` en `ffprobe`, en een Chrome of Chromium
// (env CHROME wijst het programma aan). De video's zijn eerlijk gemarkeerd als conceptvideo; de docent kan later een eigen opname
// met dezelfde bestandsnaam en ondertitels in media/ zetten.
//
// Gebruik: node tools/maak-video.mjs            alle eigen video's (nu geen: V1 tot en met V4 zijn extern, B105, B108, B109, B120)
//          node tools/maak-video.mjs <id>       alleen die video
//          STEM=Ellen node tools/maak-video.mjs  andere stem; TEMPO=170 (woorden per minuut, standaard 170)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STEM = process.env.STEM ?? 'Xander';
const TEMPO = process.env.TEMPO ?? '170';
const VOOR = 0.3; // stilte voor de spreektekst van een dia (s)
const NA = 0.7; // stilte na de spreektekst (s), plus `pauzeNa` van de dia
const MAX_TEKENS = 84; // een ondertitelregel is hoogstens ongeveer twee regels van 42 tekens
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => p && existsSync(p));

/** Hoe de stem sommige tekens en afkortingen moet uitspreken; de ondertitels en het transcript houden de geschreven tekst. */
const UITSPRAAK = [
  [/\(\+\)/g, ' plus'], [/\(−\)/g, ' min'], [/AAOCC/g, 'A A O C C'], [/\bAPA\b/g, 'A P A'], [/\bAI\b/g, 'A I'], [/\bVPC\b/g, 'V P C'],
  [/e\.a\./g, 'en anderen'], [/taak 4\.1/g, 'taak vier punt één'], [/taak 9\.4/g, 'taak negen punt vier'],
  [/taak 2\.1/g, 'taak twee punt één'], [/taak 5\.1/g, 'taak vijf punt één'], [/\bA3\b/g, 'A drie'], [/TOM³/g, 'T O M drie'], [/\bTOM\b/g, 'T O M'],
  [/\bBMC\b/g, 'B M C'], [/z\.d\./g, 'zonder datum'], [/ & /g, ' en '], [/Zo'n/g, 'Zo een'],
];
const uitspraak = (t) => UITSPRAAK.reduce((s, [re, v]) => s.replace(re, v), t);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
const duurVan = (bestand) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', bestand]).toString().trim());

/** Eén dia als HTML in de huisstijl (accent, zwart, wit, dikke rand met harde schaduw). */
function diaHtml({ dia, nr, totaal, video, leerblok }) {
  const punten = dia.punten.length
    ? `<ul>${dia.punten.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    : `<p class="tekst">${esc(dia.spreektekst.replace(/^Je bent klaar als /, 'Klaar als: '))}</p>`;
  return `<!doctype html><html lang="nl"><meta charset="utf-8"><style>
    html,body { margin:0; width:1280px; height:720px; background:#fff; color:#000; font-family:"Avenir Next","Avenir","Segoe UI",Helvetica,Arial,sans-serif; }
    .kader { box-sizing:border-box; position:absolute; inset:36px 52px 36px 36px; border:8px solid #000; box-shadow:12px 12px 0 #000; padding:36px 48px; background:#fff; }
    .kop { font-size:22px; font-weight:700; letter-spacing:.5px; }
    .concept { display:inline-block; border:4px solid #E50056; padding:0 12px; margin-right:12px; }
    h1 { font-size:58px; line-height:1.1; margin:20px 0 22px; padding-bottom:14px; border-bottom:8px solid #E50056; }
    ul { font-size:44px; line-height:1.3; margin:0; padding-left:42px; }
    li { margin:8px 0; }
    .tekst { font-size:42px; line-height:1.35; margin:0; }
    .voet { position:absolute; left:48px; right:48px; bottom:26px; font-size:20px; display:flex; justify-content:space-between; }
  </style><div class="kader">
    <div class="kop"><span class="concept">Conceptvideo</span>${esc(video.id)} · Leerblok ${leerblok} · computerstem</div>
    <h1>${esc(dia.titel)}</h1>${punten}
    <div class="voet"><span>A3 e-learning · HAN Bedrijfskunde, C-cluster · CC BY-SA 4.0</span><span>${nr} / ${totaal}</span></div>
  </div></html>`;
}

/** Splitst tekst in ondertitelregels: eerst per zin, daarna lange zinnen op woordgrenzen. */
export function ondertitelStukken(tekst, max = MAX_TEKENS) {
  const zinnen = tekst.split(/(?<=[.!?])\s+/).map((z) => z.trim()).filter(Boolean);
  return zinnen.flatMap((zin) => {
    if (zin.length <= max) return [zin];
    const woorden = zin.split(/\s+/);
    const delen = Math.ceil(zin.length / max);
    const per = Math.ceil(woorden.length / delen);
    return Array.from({ length: delen }, (_, i) => woorden.slice(i * per, (i + 1) * per).join(' ')).filter(Boolean);
  });
}

const vttTijd = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};

/** WebVTT uit de stukken en de tijd die elke dia spreekt: de tijd wordt naar tekenaantal over de stukken verdeeld. */
export function maakVtt(diaTijden) {
  const cues = [];
  for (const { start, spreekDuur, tekst } of diaTijden) {
    const stukken = ondertitelStukken(tekst);
    const tekens = stukken.reduce((t, s) => t + s.length, 0);
    let t = start;
    for (const s of stukken) {
      const d = (s.length / tekens) * spreekDuur;
      cues.push({ van: t, tot: t + d, s });
      t += d;
    }
  }
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${vttTijd(c.van)} --> ${vttTijd(c.tot)}\n${c.s}\n`).join('\n')}`;
}

function bouwVideo(leerblok, video, tmpMap) {
  const dias = video.dias;
  const werk = mkdtempSync(join(tmpMap, `${video.id}-`));
  const diaTijden = [];
  const audioLijst = [];
  const dialijst = [];
  let start = 0;
  dias.forEach((dia, i) => {
    const nr = String(i + 1).padStart(2, '0');
    writeFileSync(join(werk, `${nr}.html`), diaHtml({ dia, nr: i + 1, totaal: dias.length, video, leerblok }));
    run(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--screenshot=${join(werk, `${nr}.png`)}`, '--window-size=1280,720', `file://${join(werk, `${nr}.html`)}`]);
    run('say', ['-v', STEM, '-r', TEMPO, '-o', join(werk, `${nr}.aiff`), uitspraak(dia.spreektekst)]);
    const na = NA + (dia.pauzeNa ?? 0);
    run('ffmpeg', ['-y', '-i', join(werk, `${nr}.aiff`), '-ac', '1', '-ar', '44100', '-af', `adelay=${Math.round(VOOR * 1000)}:all=1,apad=pad_dur=${na}`, join(werk, `${nr}.wav`)]);
    const spreekDuur = duurVan(join(werk, `${nr}.aiff`));
    const totaal = duurVan(join(werk, `${nr}.wav`));
    diaTijden.push({ start: start + VOOR, spreekDuur, tekst: dia.spreektekst });
    audioLijst.push(`file '${join(werk, `${nr}.wav`)}'`);
    dialijst.push(`file '${join(werk, `${nr}.png`)}'`, `duration ${totaal.toFixed(3)}`);
    start += totaal;
  });
  dialijst.push(dialijst[dialijst.length - 2]); // de laatste dia moet nog een keer genoemd worden (eigenaardigheid van het concat-formaat)
  writeFileSync(join(werk, 'audio.txt'), audioLijst.join('\n'));
  writeFileSync(join(werk, 'dias.txt'), dialijst.join('\n'));
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', join(werk, 'audio.txt'), '-c', 'copy', join(werk, 'audio.wav')]);
  const uit = resolve(root, video.bestand);
  mkdirSync(dirname(uit), { recursive: true });
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', join(werk, 'dias.txt'), '-i', join(werk, 'audio.wav'),
    '-vf', 'fps=10,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '64k', '-ac', '1',
    '-movflags', '+faststart', '-shortest', uit]);
  writeFileSync(resolve(root, video.ondertitels), maakVtt(diaTijden));
  return { bestand: video.bestand, duurSeconden: Math.round(duurVan(uit) * 100) / 100, bytes: statSync(uit).size, ondertitels: video.ondertitels };
}

function main() {
  if (!CHROME) throw new Error('Geen Chrome of Chromium gevonden; zet CHROME op het programma.');
  const gevraagd = process.argv.slice(2).map((a) => a.toUpperCase());
  const tmpMap = mkdtempSync(join(tmpdir(), 'maak-video-'));
  const metaPad = resolve(root, 'media/metadata.json');
  const meta = existsSync(metaPad) ? JSON.parse(readFileSync(metaPad, 'utf8')) : {};
  for (const n of [1, 2, 3, 4]) {
    const pad = resolve(root, `data/leerblok-${n}.json`);
    if (!existsSync(pad)) continue;
    const video = JSON.parse(readFileSync(pad, 'utf8')).media?.video;
    if (!video || video.url || (gevraagd.length && !gevraagd.includes(video.id))) continue; // B105: een externe video bouwen we niet
    console.log(`${video.id}: bouwen…`);
    const r = bouwVideo(n, video, tmpMap);
    meta[r.bestand] = { duurSeconden: r.duurSeconden, bytes: r.bytes, ondertitels: r.ondertitels, stem: `${STEM} (macOS say, ${TEMPO} woorden per minuut)` };
    console.log(`${video.id}: ${r.duurSeconden} s, ${(r.bytes / 1048576).toFixed(2)} MB`);
  }
  mkdirSync(dirname(metaPad), { recursive: true });
  writeFileSync(metaPad, `${JSON.stringify(Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
