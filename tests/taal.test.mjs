// Taal (fase 14): alle teksten zijn Nederlands (QA-4) en Engelse vaktermen worden op de plek zelf in één zin uitgelegd (QA-5).
// Deze test pint de zorg, niet de huidige tekst: staat een term in een leerblok, dan moet daar een uitleg bij staan die de term
// beschrijft. Tekst wijzigen mag; de uitleg weghalen niet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const NIET_ZICHTBAAR = new Set(['bron', 'opmerking', 'id', 'soort', 'type', 'voor', 'suffix', 'formaat', 'bewijsonderdeel', 'bestand', 'minutenBron']);

/** Alle tekst die een student ziet, zonder metavelden, media en kijktips (die hebben eigen controles). */
function teksten(x, uit = []) {
  if (typeof x === 'string') uit.push(x);
  else if (Array.isArray(x)) x.forEach((v) => teksten(v, uit));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!NIET_ZICHTBAAR.has(k)) teksten(v, uit);
  return uit;
}
const zichtbaar = (b) => { const { media, kijktips, ...rest } = b; return teksten(rest); };
const BLOKKEN = [1, 2, 3, 4].map((n) => ({ n, data: json(`data/leerblok-${n}.json`) }));

/** term: waar de term staat; uitleg: één van deze aanwijzingen moet in hetzelfde leerblok staan (QA-5). */
const TERMEN = [
  { term: 'frame', gebruikt: /\bframes?\b/i, uitleg: /invalshoek/i },
  { term: 'user story', gebruikt: /user story/i, uitleg: /heet een user story|user story\s*(is|zegt|:)/i },
  { term: 'pain', gebruikt: /\bpains?\b/i, uitleg: /pains? \(wat|pain is een|wat (hem|haar|de klant) hindert|last of ergernis|wat in de weg zit/i },
  { term: 'gain', gebruikt: /\bgains?\b/i, uitleg: /gains? \(wat|gain is een|wat (hij|zij|de klant) (zoekt|bereikt)|graag bereikt|een winst/i },
  { term: 'fit', gebruikt: /\bfit\b/i, uitleg: /Er is een fit als/i },
  { term: 'pain reliever', gebruikt: /pain relievers?/i, uitleg: /pain relievers? \(|wat een pain wegneemt|pain relievers de belangrijkste pains wegnemen/i },
  { term: 'gain creator', gebruikt: /gain creators?/i, uitleg: /gain creators? \(|wat een gain oplevert|gain creators de belangrijkste gains opleveren/i },
  { term: 'six capitals', gebruikt: /six capitals/i, uitleg: /zes (soorten waarde|kapitalen)/i },
  { term: 'prompt', gebruikt: /\bprompt\b/i, uitleg: /prompt \(de opdracht|opdracht die je aan de/i },
];

test('QA-5: elke Engelse vakterm die een leerblok gebruikt wordt in datzelfde leerblok in één zin uitgelegd', () => {
  for (const { n, data } of BLOKKEN) {
    const alles = zichtbaar(data).join(' ¶ ');
    for (const t of TERMEN) if (t.gebruikt.test(alles)) assert.match(alles, t.uitleg, `leerblok ${n}: „${t.term}” staat er zonder uitleg`);
  }
});

test('QA-5: de uitleg staat bij de eerste taak die de term gebruikt, of in dezelfde taak', () => {
  for (const { n, data } of BLOKKEN) {
    for (const t of TERMEN) {
      const eerste = data.taken.findIndex((taak) => t.gebruikt.test(zichtbaar({ taken: [taak] }).join(' ')));
      if (eerste === -1) continue;
      const totEnMet = zichtbaar({ taken: data.taken.slice(0, eerste + 1) }).join(' ¶ ');
      assert.match(totEnMet, t.uitleg, `leerblok ${n}: de uitleg van „${t.term}” staat pas na de eerste taak die de term gebruikt (${data.taken[eerste].id})`);
    }
  }
});

test('QA-5: de controle vindt een term zonder uitleg', () => {
  const kaal = 'Vul de pains en gains van de klant in.';
  const t = TERMEN.find((x) => x.term === 'pain');
  assert.ok(t.gebruikt.test(kaal) && !t.uitleg.test(kaal), 'saboteer: zin met pain zonder uitleg wordt herkend');
});

// Kleine letters: AND en OR in een zoekstring zijn zoekoperatoren (LB-6) en horen Engels te blijven.
const ENGELS = /\b(the|The|and|with|that|this|This|from|which|for|are|was|were|have|has|you|You|your|Your)\b/g;

test('QA-4: geen zichtbare tekst in de leerblokken, terugblik of docentdata is Engels (hoogstens 1 Engels functiewoord per tekst)', () => {
  const bestanden = [...BLOKKEN.map((b) => b.data), json('data/terugblik.json'), json('data/leerblokken.json'), ...[1, 2].map((d) => json(`data/docent-deel${d}.json`))];
  for (const b of bestanden) {
    for (const s of (b.taken ? zichtbaar(b) : teksten(b))) {
      // Engelse citaten en titels staan tussen aanhalingstekens of in een bronvermelding; die hebben een eigen controle (BR-4).
      const zonderCitaat = s.replace(/[„"“][^”"“]*[”"]/g, ' ').replace(/\([^)]*\d{4}[^)]*\)/g, ' ');
      const hits = zonderCitaat.match(ENGELS) ?? [];
      assert.ok(hits.length <= 1, `Engelse tekst? „${s.slice(0, 80)}…” (${hits.join(', ')})`);
    }
  }
});

test('QA-4: de documentatiepagina’s zijn Nederlands (lang="nl") en de spelteksten ook', () => {
  for (const f of readdirSync(resolve(root, 'spellen')).filter((n) => n.endsWith('.json'))) {
    for (const s of teksten(json(`spellen/${f}`))) {
      const zonderCitaat = s.replace(/[„"“][^”"“]*[”"]/g, ' ').replace(/\([^)]*\d{4}[^)]*\)/g, ' ');
      assert.ok((zonderCitaat.match(ENGELS) ?? []).length <= 1, `${f}: Engelse tekst? „${s.slice(0, 80)}…”`);
    }
  }
});
