// Het dossier: export, controlesom, import, verificatie en de weergavemodellen van de dossierpagina (DS-2…DS-12, BW-13).
// Geen DOM en geen netwerk: alles werkt op de opslag die wordt meegegeven, zodat het in Node te testen is.
// De pagina's zitten in dossier-pagina.js, verificatie-pagina.js en dossier-dom.js.
//
// Bestandsvorm van een export (bewijsdossier-<alias>-<datum>.json):
//   { formaat: 'a3-bewijsdossier', schema: '1.0', elearning, geexporteerd, alias, teamnummer, vraagstuk, waaromZin, voorlopig,
//     records: [ { record: <nieuwste versie>, eerdereVersies: <aantal> } ],
//     terugblik: [ { leerblok, pauzeDagen, status: 'gedaan'|'overgeslagen' } ]   (TP-8; geen bewijs, geen record)
//     a3Zin: „wat ik hiermee aan mijn A3 heb” (TK-11); a3Kopieerlog: [ISO-datum] (LB-17);
//     verdiepingGedaan: [leerblok] (TK-14: alleen dát een verdieping is gedaan, nooit de tekst)   (alle drie optioneel, geen bewijs)
//     controlesom: { algoritme: 'SHA-256', waarde: <64 hex>, over: <uitleg> } }
// De controlesom loopt over alle velden behalve `controlesom` zelf, in canonieke vorm (gesorteerde sleutels).
// Hij laat zien dat een bestand na export is gewijzigd; hij is geen handtekening: wie de som opnieuw uitrekent
// kan een bestand wél ongemerkt aanpassen. Dat is een bewuste keuze zonder server (blueprint X-14).
import { PREFIX } from './store.js';
import { SCHEMA_VERSIE, valideer } from './schema.js';
import { STATUS_TEKST } from './status.js';
import { leesProfiel, bewaarProfiel, PROFIEL_VELDEN } from './profiel.js';
import { ROL_ANDER_TEAM } from './context.js';
import { waardeTekst } from './weergave.js';
import { leesTerugblikLog, importeerTerugblikLog } from './terugblik.js';
import { expandeerVelden } from './blok.js';
import { META_KOPIEER_LOG, leesKopieLog } from './a3log.js';

export const FORMAAT = 'a3-bewijsdossier';
export const ALGORITME = 'SHA-256';
export const WIJZIGINGEN_PER_HERINNERING = 10;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// ------------------------------------------------------------------ hulp voor de afsluiting van leerblok 4 (TK-11, TK-14)

/** De zin „wat ik hiermee aan mijn A3 heb” uit het afsluitscherm van leerblok 4 (TK-11). */
export const leesA3Zin = (store) => String(store.getMeta('afsluiting:4')?.a3Zin ?? '');
/** Leerblokken waarvan de student „verdieping gedaan” aanvinkte (TK-14: alleen dat, niet de tekst en zonder invloed op de status). */
export const leesVerdiepingGedaan = (store) => [1, 2, 3, 4].filter((n) => store.getMeta(`verdieping:${n}`)?.gedaan === true);

// ------------------------------------------------------------------ controlesom (DS-6)

/** Canonieke tekst van een waarde: sleutels gesorteerd, geen witruimte. Dezelfde inhoud geeft altijd dezelfde tekst. */
export function canoniek(w) {
  if (Array.isArray(w)) return `[${w.map(canoniek).join(',')}]`;
  if (isObject(w)) {
    return `{${Object.keys(w).filter((k) => w[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canoniek(w[k])}`).join(',')}}`;
  }
  return JSON.stringify(w);
}

/** SHA-256 van een tekst (UTF-8) als 64 hexadecimale tekens. Werkt in de browser en in Node via crypto.subtle. */
export async function sha256Hex(tekst) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Deze browser kan de controlesom niet berekenen (crypto.subtle ontbreekt; open de site via https).');
  const bytes = await subtle.digest('SHA-256', new TextEncoder().encode(tekst));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const zonderSom = (dossier) => Object.fromEntries(Object.entries(dossier).filter(([k]) => k !== 'controlesom'));

/** Controlesom over de inhoud van een dossier (alles behalve het veld `controlesom`). */
export const berekenControlesom = (dossier) => sha256Hex(canoniek(zonderSom(dossier)));

// ------------------------------------------------------------------ export (DS-5)

/** Bouwt het dossier uit de opslag: nieuwste versie en het aantal eerdere versies per bewijsonderdeel, plus de controlesom. */
export async function maakDossier(store, { elearning, nu = () => new Date() }) {
  const p = leesProfiel(store);
  const dossier = {
    formaat: FORMAAT,
    schema: SCHEMA_VERSIE,
    elearning,
    geexporteerd: nu().toISOString(),
    alias: p.alias,
    teamnummer: p.teamnummer,
    vraagstuk: p.vraagstuk,
    waaromZin: p.waaromZin,
    voorlopig: p.voorlopig,
    records: store.ids().map((id) => {
      const record = store.get(id);
      return { record, eerdereVersies: record.versie - 1 };
    }),
    terugblik: leesTerugblikLog(store),
    a3Zin: leesA3Zin(store),
    a3Kopieerlog: leesKopieLog(store),
    verdiepingGedaan: leesVerdiepingGedaan(store),
  };
  dossier.controlesom = {
    algoritme: ALGORITME,
    waarde: await berekenControlesom(dossier),
    over: 'alle velden behalve controlesom, met gesorteerde sleutels',
  };
  return dossier;
}

/** bewijsdossier-<alias>-<datum>.json, met een alias die als bestandsnaam bruikbaar is. */
export function bestandsnaam(dossier) {
  const alias = String(dossier.alias ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  return `bewijsdossier-${alias}-${String(dossier.geexporteerd).slice(0, 10)}.json`;
}

// ------------------------------------------------------------------ inlezen en controleren (DS-3, DS-4, DS-8)

/**
 * Kan deze site een dossier van deze schemaversie lezen? Elke 1.x tot en met de huidige versie (DS-4);
 * een nieuwere versie niet, want die kan velden hebben die deze site niet kent.
 */
export function schemaAccepteerbaar(versie, huidig = SCHEMA_VERSIE) {
  const lees = (v) => { const m = /^(\d+)\.(\d+)$/.exec(String(v)); return m ? [Number(m[1]), Number(m[2])] : null; };
  const v = lees(versie);
  const h = lees(huidig);
  if (!v || !h) return { ok: false, reden: `Onbekende schemaversie ${JSON.stringify(versie)}.` };
  if (v[0] !== h[0]) return { ok: false, reden: `Dit dossier heeft schema ${versie}; deze site leest alleen ${h[0]}.x.` };
  if (v[1] > h[1]) return { ok: false, reden: `Dit dossier heeft schema ${versie}, nieuwer dan deze site (${huidig}). Open de nieuwste versie van de site.` };
  return { ok: true };
}

/**
 * Leest een dossier (tekst of object) en controleert het.
 * @returns {Promise<{status: 'ongewijzigd'|'gewijzigd'|'ongeldig', reden: string, dossier?: object, recordFouten: string[]}>}
 *   `gewijzigd` = de controlesom klopt niet meer: „gewijzigd na export" (DS-8).
 */
export async function controleerDossier(invoer) {
  let dossier = invoer;
  if (typeof invoer === 'string') {
    try { dossier = JSON.parse(invoer); } catch (e) { return { status: 'ongeldig', reden: 'Geen geldig JSON-bestand.', recordFouten: [] }; }
  }
  if (!isObject(dossier) || dossier.formaat !== FORMAAT) {
    return { status: 'ongeldig', reden: 'Dit is geen bewijsdossier van de A3 e-learning.', recordFouten: [] };
  }
  const schema = schemaAccepteerbaar(dossier.schema);
  if (!schema.ok) return { status: 'ongeldig', reden: schema.reden, recordFouten: [] };
  if (!Array.isArray(dossier.records)) return { status: 'ongeldig', reden: 'Het dossier heeft geen lijst records.', recordFouten: [] };

  const recordFouten = [];
  const gezien = new Set();
  dossier.records.forEach((r, i) => {
    if (!isObject(r) || !isObject(r.record) || !Number.isInteger(r.eerdereVersies) || r.eerdereVersies < 0) {
      recordFouten.push(`Item ${i + 1} heeft niet de vorm { record, eerdereVersies }.`);
      return;
    }
    const { geldig, fouten } = valideer(r.record);
    if (!geldig) recordFouten.push(`${r.record.id ?? `Item ${i + 1}`}: ${fouten.join(' ')}`);
    if (gezien.has(r.record.id)) recordFouten.push(`${r.record.id} komt twee keer voor.`);
    gezien.add(r.record.id);
  });

  const som = dossier.controlesom;
  if (!isObject(som) || typeof som.waarde !== 'string' || som.algoritme !== ALGORITME) {
    return { status: 'gewijzigd', reden: 'De controlesom ontbreekt of is onleesbaar: gewijzigd na export.', dossier, recordFouten };
  }
  const berekend = await berekenControlesom(dossier);
  if (berekend !== som.waarde.toLowerCase()) {
    return { status: 'gewijzigd', reden: 'De controlesom klopt niet meer: gewijzigd na export.', dossier, recordFouten };
  }
  return { status: 'ongewijzigd', reden: 'De controlesom klopt.', dossier, recordFouten };
}

// ------------------------------------------------------------------ import (DS-3)

const sleutelVan = (id) => `${PREFIX}rec:${id}`;
const leesLijst = (opslag, id) => {
  try { const l = JSON.parse(opslag.getItem(sleutelVan(id)) ?? '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
};
const gelijk = (a, b) => canoniek(a) === canoniek(b);

/**
 * Zet een gecontroleerd dossier terug in de opslag (DS-3).
 *
 * Het record komt onveranderd terug, ook het versienummer: store.save telt altijd door vanaf de vorige versie en
 * kan dat dus niet. Daarom schrijft dit direct in de recordlijst van store.js (`a3l:rec:<id>`, een JSON-lijst met
 * versies). Een volgende store.save telt door vanaf het teruggezette versienummer. De eerdere versies zelf zitten
 * niet in het bestand (DS-5) en komen dus niet terug.
 *
 * Bij een bestaand record wint het nieuwste (`bijgewerkt`); het andere blijft staan of wordt behouden.
 * De profielvelden (alias, teamnummer, vraagstuk, waarom-zin) worden alleen ingevuld als ze nog leeg zijn.
 * Het terugblik-log (TP-8) wordt aangevuld waar de opslag voor een leerblok nog niets heeft.
 * @returns {{overgenomen: string[], gelijk: string[], behouden: string[], profiel: string[], terugblik: number[]}}
 */
export function importeerDossier({ store, opslag }, dossier) {
  const uit = { overgenomen: [], gelijk: [], behouden: [], profiel: [], terugblik: [] };
  for (const { record } of dossier.records) {
    const lijst = leesLijst(opslag, record.id);
    const laatste = lijst[lijst.length - 1];
    if (!laatste) {
      opslag.setItem(sleutelVan(record.id), JSON.stringify([record]));
      uit.overgenomen.push(record.id);
    } else if (gelijk(laatste, record)) {
      uit.gelijk.push(record.id);
    } else if (Date.parse(record.bijgewerkt) > Date.parse(laatste.bijgewerkt)) {
      lijst.push({ ...record, versie: Math.max(record.versie, laatste.versie + 1) });
      opslag.setItem(sleutelVan(record.id), JSON.stringify(lijst));
      uit.overgenomen.push(record.id);
    } else {
      uit.behouden.push(record.id);
    }
  }
  const huidig = leesProfiel(store);
  const nieuw = { ...huidig };
  for (const v of PROFIEL_VELDEN) {
    if (huidig[v] === '' && typeof dossier[v] === 'string' && dossier[v].trim() !== '') { nieuw[v] = dossier[v]; uit.profiel.push(v); }
  }
  if (PROFIEL_VELDEN.every((v) => huidig[v] === '') && dossier.voorlopig === true) nieuw.voorlopig = true;
  bewaarProfiel(store, nieuw);
  uit.terugblik = importeerTerugblikLog(store, dossier.terugblik);
  // Optionele velden van fase 11: alleen aanvullen, nooit iets van de huidige opslag overschrijven.
  if (typeof dossier.a3Zin === 'string' && dossier.a3Zin.trim() !== '' && leesA3Zin(store) === '') {
    store.setMeta('afsluiting:4', { ...(store.getMeta('afsluiting:4') ?? {}), a3Zin: dossier.a3Zin.trim() });
    uit.profiel.push('a3Zin');
  }
  const log = leesKopieLog(store);
  const extra = (Array.isArray(dossier.a3Kopieerlog) ? dossier.a3Kopieerlog : []).filter((d) => typeof d === 'string' && !Number.isNaN(Date.parse(d)) && !log.includes(d));
  if (extra.length) store.setMeta(META_KOPIEER_LOG, [...log, ...extra].sort());
  for (const n of Array.isArray(dossier.verdiepingGedaan) ? dossier.verdiepingGedaan : []) {
    if ([1, 2, 3, 4].includes(n) && store.getMeta(`verdieping:${n}`)?.gedaan !== true) store.setMeta(`verdieping:${n}`, { tekst: '', ...(store.getMeta(`verdieping:${n}`) ?? {}), gedaan: true });
  }
  sluitHerinneringAf(store);
  return uit;
}

// ------------------------------------------------------------------ bewaarherinnering (DS-2)

/** Aantal wijzigingen tot nu: elke opgeslagen versie van een bewijsrecord is één wijziging (RC-5). */
export const telWijzigingen = (store) => store.ids().reduce((n, id) => n + store.get(id).versie, 0);

/**
 * De melding „bewaar je dossier" na elke 10 wijzigingen (DS-2): er hoort één melding bij elke volle tien.
 * Ze blijft staan tot de student exporteert of ze wegklikt; daarna komt de volgende pas bij de volgende tien.
 * (De melding na elk leerblok is de bewaarmelding op het afsluitscherm, weergave.js.)
 */
export function herinnering(store) {
  const wijzigingen = telWijzigingen(store);
  const mijlpaal = Math.floor(wijzigingen / WIJZIGINGEN_PER_HERINNERING);
  const laatste = store.getMeta('dossier:export');
  return {
    wijzigingen,
    mijlpaal,
    tonen: mijlpaal > (store.getMeta('dossier:herinnerd') ?? 0),
    sindsExport: wijzigingen - (laatste?.wijzigingen ?? 0),
    ooitGeexporteerd: Boolean(laatste),
  };
}

/** De student klikt de melding weg: de volgende komt pas na nog eens tien wijzigingen. */
export const sluitHerinneringAf = (store) => store.setMeta('dossier:herinnerd', herinnering(store).mijlpaal);

/** Onthoudt dat het dossier net is bewaard (geëxporteerd). */
export function registreerExport(store, nu = new Date()) {
  store.setMeta('dossier:export', { op: nu.toISOString(), wijzigingen: telWijzigingen(store) });
  sluitHerinneringAf(store);
}

// ------------------------------------------------------------------ weergavemodellen (BW-13, DS-7, DS-9, DS-11)

const statusVan = (record) => record?.status ?? 'nog niet';
/** Eén bewijsonderdeel als status, zonder inhoud. Geen record is „ontbreekt". */
function statusCel(id, titel, record) {
  const status = statusVan(record);
  return {
    id, titel, status,
    statusTekst: STATUS_TEKST[status],
    voorlopig: record?.voorlopig === true,
    heeftRecord: Boolean(record),
    ontbreekt: !record || status === 'nog niet',
  };
}

/** Het slechtste van een aantal statussen: „nog niet" gaat voor „bijna", „bijna" voor „compleet" (BW-5). */
export function slechtsteStatus(statussen) {
  if (statussen.length === 0 || statussen.includes('nog niet')) return 'nog niet';
  return statussen.includes('bijna') ? 'bijna' : 'compleet';
}

/** Titel per bewijsonderdeel uit luk.json. */
const titelVan = (luk, id) => luk.bewijsonderdelen.find((b) => b.id === id)?.titel ?? id;

/** „Mijn stand" (DS-11): per bewijsonderdeel alleen de status. Bevat bewust geen inhoud. */
export function bouwMijnStand(luk, records) {
  return luk.bewijsonderdelen.map((b) => statusCel(b.id, b.titel, records[b.id]));
}

/** De 13 rijen van de dekkingstabel met de eigen status per bewijsonderdeel (BW-13). */
export function bouwDekking(luk, records) {
  return luk.onderdelen.map((o) => ({
    label: o.label, luk: o.luk, dekking: o.dekking, toelichting: o.toelichting,
    bewijs: o.bewijs.map((id) => statusCel(id, titelVan(luk, id), records[id])),
  }));
}

/** De leeruitkomsten met bewijs (nu 1, 2 en 5), elk met de bewijsonderdelen die eraan bijdragen. */
export function bouwLeeruitkomsten(luk, records) {
  const nummers = [...new Set(luk.onderdelen.filter((o) => o.luk !== null && o.bewijs.length > 0).map((o) => o.luk))].sort((a, b) => a - b);
  return nummers.map((nr) => {
    const ids = luk.bewijsonderdelen.map((b) => b.id)
      .filter((id) => luk.onderdelen.some((o) => o.luk === nr && o.bewijs.includes(id)));
    const cellen = ids.map((id) => statusCel(id, titelVan(luk, id), records[id]));
    const status = slechtsteStatus(cellen.map((c) => c.status));
    return {
      luk: nr, ids, cellen, status, statusTekst: STATUS_TEKST[status],
      aantalCompleet: cellen.filter((c) => c.status === 'compleet').length,
      totaal: cellen.length,
      ontbreekt: cellen.filter((c) => c.ontbreekt).map((c) => c.id),
    };
  });
}

/** Tekst van een veldwaarde voor de afdrukpagina. */
const toonWaarde = waardeTekst;

/**
 * De afdrukbare pagina's per leeruitkomst (DS-7): per bewijsonderdeel de status, de ingevulde inhoud en onderaan de
 * controlesom van hetzelfde dossier.
 * @param {object} dossier resultaat van maakDossier
 * @param {object} luk data/luk.json
 * @param {Object<string, Object<string, string>>} [labels] veldlabels per bewijsonderdeel (id → { veld → label })
 */
export function bouwAfdruk(dossier, luk, labels = {}) {
  const records = Object.fromEntries(dossier.records.map((r) => [r.record.id, r.record]));
  return bouwLeeruitkomsten(luk, records).map((lu) => ({
    luk: lu.luk,
    titel: `Leeruitkomst ${lu.luk}`,
    alias: dossier.alias, teamnummer: dossier.teamnummer, geexporteerd: dossier.geexporteerd, elearning: dossier.elearning,
    onderdelen: lu.cellen.map((c) => {
      const r = records[c.id];
      return {
        ...c,
        versie: r?.versie ?? null,
        bijgewerkt: r?.bijgewerkt ?? null,
        velden: r ? Object.entries(r.inhoud).map(([veld, w]) => ({ label: labels[c.id]?.[veld] ?? veld, waarde: toonWaarde(w) })) : [],
      };
    }),
    controlesom: dossier.controlesom.waarde,
  }));
}

/**
 * De tabel van de verificatiepagina (DS-9): één rij per student, 11 bewijsonderdelen en 3 leeruitkomsten, met de
 * studenten met de meeste ontbrekende onderdelen bovenaan. Bestanden die geen dossier zijn staan in `afgekeurd`.
 * @param {{bestand: string, uitkomst: object}[]} resultaten uitkomsten van controleerDossier
 */
/**
 * B107 (optie 4): antwoorden in een record die de docent even moet bekijken, zonder dat de status van de student verandert:
 * een veld waarop de controle eigen woorden „let op” gaf, of een tekst van minstens 4 woorden waarvan minder dan de helft verschilt.
 * @returns {{veld: string, reden: string}[]}
 */
export function signalenVan(record) {
  if (!isObject(record)) return [];
  const uit = [];
  for (const c of Array.isArray(record.controles) ? record.controles : []) {
    if (typeof c?.id === 'string' && c.id.startsWith('eigen-woorden-') && c.resultaat === 'let op') uit.push({ veld: c.id.slice('eigen-woorden-'.length), reden: 'te weinig eigen woorden' });
  }
  for (const [veld, w] of Object.entries(isObject(record.inhoud) ? record.inhoud : {})) {
    if (typeof w !== 'string' || uit.some((s) => s.veld === veld)) continue;
    const woorden = (w.match(/\p{L}{3,}/gu) ?? []).map((x) => x.toLocaleLowerCase('nl'));
    if (woorden.length >= 4 && new Set(woorden).size / woorden.length < 0.5) uit.push({ veld, reden: 'herhalend' });
  }
  return uit;
}

export function bouwVerificatie(resultaten, luk) {
  const studenten = [];
  const afgekeurd = [];
  for (const { bestand, uitkomst } of resultaten) {
    if (uitkomst.status === 'ongeldig' || !uitkomst.dossier) { afgekeurd.push({ bestand, reden: uitkomst.reden }); continue; }
    const d = uitkomst.dossier;
    const records = Object.fromEntries((Array.isArray(d.records) ? d.records : [])
      .filter((r) => isObject(r?.record)).map((r) => [r.record.id, r.record]));
    const cellen = bouwMijnStand(luk, records).map((c) => ({ ...c, signalen: signalenVan(records[c.id]) }));
    studenten.push({
      bestand,
      alias: d.alias ?? '', teamnummer: d.teamnummer ?? '', elearning: d.elearning ?? '', geexporteerd: d.geexporteerd ?? '',
      gewijzigd: uitkomst.status === 'gewijzigd',
      reden: uitkomst.reden,
      recordFouten: uitkomst.recordFouten,
      cellen,
      leeruitkomsten: bouwLeeruitkomsten(luk, records),
      ontbreekt: cellen.filter((c) => c.ontbreekt).map((c) => c.id),
    });
  }
  studenten.sort((a, b) => b.ontbreekt.length - a.ontbreekt.length || a.alias.localeCompare(b.alias, 'nl') || a.bestand.localeCompare(b.bestand, 'nl'));
  return { studenten, afgekeurd, bewijsonderdelen: luk.bewijsonderdelen.map((b) => b.id) };
}

/** Veldlabels per bewijsonderdeel, uit de leerblokbestanden die beschikbaar zijn. */
export function veldLabels(blokken) {
  const uit = {};
  for (const blok of blokken.filter(Boolean)) {
    for (const ev of blok.bewijsonderdelen ?? []) {
      const taak = blok.taken.find((t) => t.id === ev.taak);
      uit[ev.id] = { ...Object.fromEntries(expandeerVelden(taak?.toepassing?.velden).map((v) => [v.id, v.label])), volgendeStap: 'Mijn volgende stap' };
    }
  }
  return uit;
}

// ------------------------------------------------------------------ feedback naast elkaar (WS-6, fase 4.7)

/**
 * Het record EV-09 als twee kolommen voor de dossierpagina: de individuele feedback (teamgenoot, medestudent, coach)
 * naast de post-its van andere teams (rol „ander team") en de ene teamactie.
 * @param {object|undefined} record nieuwste record van EV-09
 */
export function bouwFeedbackOverzicht(record) {
  const inhoud = isObject(record?.inhoud) ? record.inhoud : {};
  const regels = Array.isArray(inhoud.regels) ? inhoud.regels.filter(isObject) : [];
  const anderTeam = regels.filter((r) => r.rol === ROL_ANDER_TEAM);
  const individueel = regels.filter((r) => r.rol !== ROL_ANDER_TEAM);
  const actie = isObject(inhoud.teamactie) && typeof inhoud.teamactie.tekst === 'string' && inhoud.teamactie.tekst.trim() !== '' ? inhoud.teamactie : null;
  return {
    heeftRecord: Boolean(record),
    individueel: { ontvangen: individueel.filter((r) => r.richting === 'ontvangen'), gegeven: individueel.filter((r) => r.richting === 'gegeven') },
    anderTeam,
    teamactie: actie,
    leeg: regels.length === 0 && !actie,
  };
}

// ------------------------------------------------------------------ zwakste onderdeel, twee zinnen, oude en nieuwe versie (TK-11, TK-12, ST-5)

const RANG = { 'nog niet': 0, bijna: 1, compleet: 2 };

/**
 * Het zwakste bewijsonderdeel van „Mijn stand” (TK-12): het onderdeel met de laagste status; bij gelijke status eerst een
 * onderdeel zonder record, dan de volgorde van luk.json. Is alles Compleet, dan is er geen zwakste onderdeel (`null`).
 * @param {{id: string, titel: string, status: string, statusTekst: string, heeftRecord: boolean}[]} mijnStand resultaat van bouwMijnStand
 */
export function zwaksteOnderdeel(mijnStand) {
  const kandidaten = mijnStand.map((c, i) => ({ c, i })).filter(({ c }) => c.status !== 'compleet');
  if (kandidaten.length === 0) return null;
  const { c } = kandidaten.sort((a, b) => RANG[a.c.status] - RANG[b.c.status] || Number(a.c.heeftRecord) - Number(b.c.heeftRecord) || a.i - b.i)[0];
  return { id: c.id, titel: c.titel, status: c.status, statusTekst: c.statusTekst, heeftRecord: c.heeftRecord };
}

/**
 * De twee zinnen naast elkaar (TK-11): de waarom-zin uit leerblok 1 en „wat ik hiermee aan mijn A3 heb” uit leerblok 4.
 * Een zin die er nog niet is, is een lege tekst.
 */
export function bouwTweeZinnen(store) {
  return { waarom: leesProfiel(store).waaromZin, nut: leesA3Zin(store) };
}

/**
 * De onderdelen die opnieuw zijn gedaan, met de voorlopige versie naast de nieuwe (ST-5). Leest de markering die
 * `opnieuwDoen` in de sessie zet en de versies uit de opslag.
 * @returns {{id: string, oud: object, nieuw: object}[]}
 */
export function bouwVersieVergelijking(store) {
  const markeringen = store.getMeta('opnieuw') ?? {};
  return Object.keys(markeringen).sort().map((id) => {
    const versies = store.versions(id);
    const oud = versies.find((r) => r.versie === markeringen[id].oudeVersie);
    const nieuw = versies[versies.length - 1];
    return oud && nieuw && nieuw.versie > oud.versie ? { id, oud, nieuw } : null;
  }).filter(Boolean);
}
