// Register van controles: zet de controle-declaraties uit data/leerblok-N.json om in functies (QA-1).
// Een declaratie is { id, soort, type, veld?, velden?, label?, ...parameters }. `type` is de naam van een fabriek.
// Nieuwe leerblokken (fase 6, 10, 11) voegen hun fabrieken toe in FABRIEKEN.
import { veldGevuld, keuzeUitLijst, eindigtOp, minWoorden, minZinnen } from './core.js';
import { FABRIEKEN as LB1, VOORBEELDEN as VOORBEELDEN_LB1 } from './lb1.js';

export const FABRIEKEN = Object.freeze({
  veldGevuld, keuzeUitLijst, eindigtOp, minWoorden, minZinnen,
  ...LB1,
});

/** Bouwers voor het live voorbeeld van een toepassing (LB-2), op naam. */
export const VOORBEELDEN = Object.freeze({ ...VOORBEELDEN_LB1 });

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
