// Register van controles: zet de controle-declaraties uit data/leerblok-N.json om in functies (QA-1).
// Een declaratie is { id, soort, type, veld?, velden?, label?, ...parameters }. `type` is de naam van een fabriek.
// PF-4 (ADR B69): dit bestand bevat alleen de kernfabrieken. De fabrieken van een leerblok staan in checks/lbN.js en worden
// per pagina geladen met `laadControles` (alleen wat die pagina nodig heeft). Tests en tools laden alles via checks/index.js.
import { veldGevuld, keuzeUitLijst, eindigtOp, minWoorden, minZinnen } from './core.js';

const FABRIEKEN = { veldGevuld, keuzeUitLijst, eindigtOp, minWoorden, minZinnen };
/** Bouwers voor het live voorbeeld van een toepassing (LB-2), op naam. */
const VOORBEELDEN = {};

/** Bekende fabrieken op naam (alleen lezen; voeg toe met `registreer`). */
export { FABRIEKEN, VOORBEELDEN };

/** Voegt de fabrieken (en live voorbeelden) van een leerblokmodule toe. */
export function registreer({ FABRIEKEN: fabrieken = {}, VOORBEELDEN: voorbeelden = {} }) {
  Object.assign(FABRIEKEN, fabrieken);
  Object.assign(VOORBEELDEN, voorbeelden);
}

/**
 * Welke controlemodules (lbN.js) de controles van een leerblok nodig hebben. Leerblok 2 en 3 gebruiken een paar algemene
 * fabrieken uit lb1.js (bijvoorbeeld precies1Keuze); een test (tests/lb4.test.mjs) vergelijkt dit met de controles in de data.
 */
export const MODULES_PER_LEERBLOK = Object.freeze({ 1: [1], 2: [1, 2], 3: [1, 3], 4: [4] });

/** De modules die nodig zijn voor deze leerblokken (het eigen leerblok en dat van de Wissel), zonder dubbelen. */
export const modulesVoor = (leerblokken) => [...new Set(leerblokken.filter(Boolean).flatMap((n) => MODULES_PER_LEERBLOK[n] ?? [n]))];

/**
 * Laadt de controlemodules van de opgegeven leerblokken (bijvoorbeeld [4] of [1, 4]) en registreert ze.
 * Een pagina laadt zo alleen wat haar eigen leerblok en de Wissel nodig hebben.
 */
export async function laadControles(leerblokken) {
  for (const n of modulesVoor(leerblokken)) registreer(await import(`./lb${n}.js`));
}

/**
 * Bouwt één controle uit een declaratie. Heeft de declaratie geen `toegestaan` maar wel een `veld` met `opties`
 * in `velden`, dan zijn die opties de toegestane keuzes: de lijst staat dan maar op één plek in het bestand.
 * De uitvoer wordt gecontroleerd op het contract: de soort in het resultaat moet de soort in de declaratie zijn.
 * @param {object} decl
 * @param {object[]} [velden] veldbeschrijvingen van de taak (toepassing.velden)
 * @returns {(invoer: object, context?: object) => {id: string, soort: string, resultaat: string, melding: string}}
 */
export function bouwControle(decl, velden = []) {
  const fabriek = FABRIEKEN[decl?.type];
  if (!fabriek) throw new Error(`Controle ${decl?.id ?? '(zonder id)'}: onbekend type ${decl?.type}`);
  const { type, ...params } = decl;
  const veld = velden.find((v) => v.id === decl.veld);
  if (params.toegestaan === undefined && Array.isArray(veld?.opties)) params.toegestaan = veld.opties;
  const controle = fabriek(params);
  return (invoer, context) => {
    const r = controle(invoer, context);
    if (r.id !== decl.id || r.soort !== decl.soort) {
      throw new Error(`Controle ${decl.id} geeft ${r.soort} terwijl de data ${decl.soort} zegt.`);
    }
    return r;
  };
}

export const bouwControles = (decls, velden = []) => decls.map((d) => bouwControle(d, velden));
