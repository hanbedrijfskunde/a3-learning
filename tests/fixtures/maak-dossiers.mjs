// Maakt de vijf testdossiers in tests/fixtures/dossiers/ met de echte exportcode (dossier.js) en de echte opslag.
// Gebruik: node tests/fixtures/maak-dossiers.mjs   (schrijft de bestanden opnieuw; de tests lezen ze alleen)
// De dossiers bevatten verzonnen studenten en verzonnen inhoud; er staat geen echte persoon in.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maakStore, geheugenOpslag } from '../../js/store.js';
import { maakRecord } from '../../js/schema.js';
import { bewaarProfiel } from '../../js/profiel.js';
import { maakDossier, bestandsnaam } from '../../js/dossier.js';

const doel = resolve(dirname(fileURLToPath(import.meta.url)), 'dossiers');
mkdirSync(doel, { recursive: true });

const EV = {
  'EV-01': { taak: '2.1', leerblok: 1, luk: [1], bc: ['BC1'] },
  'EV-02': { taak: '2.2', leerblok: 1, luk: [1], bc: ['BC1'] },
  'EV-03': { taak: '3.1', leerblok: 2, luk: [1], bc: ['BC1'] },
  'EV-04': { taak: '4.1', leerblok: 2, luk: [1], bc: ['BC1'] },
  'EV-05': { taak: '4.3', leerblok: 2, luk: [1], bc: ['BC1'] },
  'EV-06': { taak: '5.1', leerblok: 3, luk: [1], bc: ['BC1'] },
  'EV-07': { taak: '6.1', leerblok: 3, luk: [1], bc: ['BC1'] },
  'EV-08': { taak: '9.1', leerblok: 3, luk: [1], bc: ['BC1'] },
  'EV-09': { taak: '6.2', leerblok: 4, luk: [5], bc: ['BC5'] },
  'EV-10': { taak: '9.3', leerblok: 4, luk: [5], bc: ['BC5'] },
  'EV-11': { taak: '9.4', leerblok: 4, luk: [1], bc: ['BC1'] },
  'EV-12': { taak: '4.2', leerblok: 2, luk: [1], bc: ['BC1'] },
};

/** Bewaart een record dat `versies` keer is aangepast (dus versie = versies). */
function bewaar(store, id, { status, voorlopig = false, versies = 1, inhoud }) {
  for (let v = 1; v <= versies; v += 1) {
    const def = EV[id];
    store.save(maakRecord({
      taakdef: { id, ...def },
      inhoud: v === versies ? inhoud : { ...inhoud, opmerking: `tussenversie ${v}` },
      controles: [{ id: 'velden-gevuld', resultaat: status === 'nog niet' ? 'mist' : 'ok' }],
      status, voorlopig, versie: 1,
      bijgewerkt: `2026-10-0${v}T10:00:00+02:00`,
      elearning: '0.1.0',
    }));
  }
}
const tekst = (id, naam) => ({ antwoord: `Antwoord van ${naam} bij ${id}: de planners van de afdeling willen sneller roosteren.` });

async function bouw(alias, teamnummer, records, { vraagstuk = 'Hoe maken we roosters sneller?', voorlopig = false } = {}) {
  const store = maakStore(geheugenOpslag());
  bewaarProfiel(store, { alias, teamnummer, vraagstuk, waaromZin: 'Medewerkers hebben last van late roosters.', voorlopig });
  for (const [id, r] of Object.entries(records)) bewaar(store, id, { ...r, inhoud: tekst(id, alias) });
  return maakDossier(store, { elearning: '0.1.0', nu: () => new Date('2026-10-05T12:00:00Z') });
}
const alle = (status, extra = {}) => Object.fromEntries(Object.keys(EV).map((id) => [id, { status, ...extra }]));

const dossiers = [
  await bouw('Anna', '3', { ...alle('compleet'), 'EV-01': { status: 'compleet', versies: 3 } }),
  await bouw('Bram', '3', { 'EV-01': { status: 'compleet' }, 'EV-02': { status: 'compleet' }, 'EV-03': { status: 'bijna' }, 'EV-04': { status: 'nog niet' } }),
  await bouw('Chris', '5', { 'EV-01': { status: 'nog niet', voorlopig: true } }, { vraagstuk: '', voorlopig: true }),
  await bouw('Eva', '5', {}),
];
// Het vijfde dossier is een volledig dossier van Dana waarin daarna één teken is veranderd: de controlesom klopt dan niet meer.
const dana = await bouw('Dana', '7', alle('compleet'));
const gewijzigd = JSON.parse(JSON.stringify(dana));
gewijzigd.records[5].record.inhoud.antwoord = gewijzigd.records[5].record.inhoud.antwoord.replace('roosteren', 'roosterem');
dossiers.push(gewijzigd);

const namen = ['anna-compleet', 'bram-gedeeltelijk', 'chris-voorlopig', 'eva-leeg', 'dana-gewijzigd'];
dossiers.forEach((d, i) => {
  writeFileSync(resolve(doel, `${namen[i]}.json`), `${JSON.stringify(d, null, 2)}\n`);
  console.log(`${namen[i]}.json (${bestandsnaam(d)})`);
});
