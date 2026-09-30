// „Kopieer naar A3 vak 1” (LB-16, LB-17, VB-8): het tekstblok voor vak 1 van de A3 en het logboek van de kopieeracties.
// Geen DOM en geen netwerk: de records en de opslag worden meegegeven, zodat dit in Node te testen is. Het klembord zelf
// (navigator.clipboard) zit in dossier-pagina.js; het logboek van de kopieeracties staat in a3log.js.
import { stelVraagSamen } from './checks/lb1.js';
import { verbandenUit, verbandRegel } from './verbandregel.js';

const plat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const leeg = '(nog niet ingevuld)';

/**
 * Bouwt het tekstblok voor vak 1 van de A3: de onderzoeksvraag (EV-01), de zoekvragen (EV-02), de plaatsing van het vraagstuk
 * (EV-08) en de waarom-zin uit leerblok 1, plus, als EV-11 er is, de lijst van verbanden (VB-8). Een onderdeel dat nog leeg is
 * staat er wel in, als „(nog niet ingevuld)”, zodat het blok altijd dezelfde vorm heeft.
 * @param {{records: Object<string, object|undefined>, profiel: {waaromZin?: string}}} p
 * @returns {{tekst: string, delen: {sleutel: string, kop: string, regels: string[]}[]}}
 */
export function maakA3Tekst({ records = {}, profiel = {} }) {
  const e1 = records['EV-01']?.inhoud ?? {};
  const e2 = records['EV-02']?.inhoud ?? {};
  const e8 = records['EV-08']?.inhoud ?? {};
  const vraag = ['gebruiker', 'pain', 'waarde'].every((v) => plat(e1[v]) !== '') ? plat(stelVraagSamen(e1)) : '';
  const zoek = [1, 2, 3].map((n) => [plat(e2[`frame${n}`]), plat(e2[`zoekvraag${n}`])]).filter(([, t]) => t !== '')
    .map(([frame, t], i) => `${i + 1}. ${t}${frame ? ` (${frame})` : ''}`);
  const plaatsing = [['Stakeholders', 'conclStakeholders'], ['Klant', 'conclKlant'], ['Organisatie', 'conclOrganisatie'], ['Conclusie', 'conclusie']]
    .filter(([, k]) => plat(e8[k]) !== '').map(([kop, k]) => `${kop}: ${plat(e8[k])}`);
  const verbanden = verbandenUit(records['EV-11']?.inhoud).map((v, i) => `${i + 1}. ${verbandRegel(v)}`);
  const delen = [
    { sleutel: 'onderzoeksvraag', kop: 'Onderzoeksvraag', regels: vraag ? [vraag] : [leeg] },
    { sleutel: 'zoekvragen', kop: 'Zoekvragen', regels: zoek.length ? zoek : [leeg] },
    { sleutel: 'plaatsing', kop: 'Plaatsing van het vraagstuk', regels: plaatsing.length ? plaatsing : [leeg] },
    { sleutel: 'waarom', kop: 'Waarom', regels: [plat(profiel.waaromZin) || leeg] },
    ...(verbanden.length ? [{ sleutel: 'verbanden', kop: 'Verbanden tussen de modellen', regels: verbanden }] : []),
  ];
  const tekst = ['A3 VAK 1 · Aanleiding en onderzoeksvraag', '', ...delen.flatMap((d) => [`${d.kop}:`, ...d.regels, ''])].join('\n').trimEnd();
  return { tekst, delen };
}
