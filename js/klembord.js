// Tekst naar het klembord (LB-16), met een terugval voor browsers zonder navigator.clipboard. Gedeeld door de dossierpagina
// en het afsluitscherm van een leerblok.
import { h } from './dom.js';

export async function kopieer(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);
  } catch (e) {
    const ta = h('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;left:-9999px' });
    ta.value = tekst;
    document.body.append(ta);
    ta.select();
    const gelukt = document.execCommand?.('copy');
    ta.remove();
    if (!gelukt) throw e;
  }
}
