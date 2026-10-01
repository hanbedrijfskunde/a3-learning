// Contrastcontrole (TG-3): leest de kleurtokens en de tekst-/achtergrondparen uit de CSS van de site en rekent per
// paar de contrastratio uit (WCAG 2.1). Geen afhankelijkheden; ook te draaien als `node tools/contrast-check.mjs`.
// Regels met alleen `color` gelden op de oppervlakken van de site (wit en grijs); regels met `color` en `background`
// gelden voor dat paar. Een regel met alleen `background` erft zijn tekstkleur en staat in EXTRA_PAREN.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MINIMUM = 4.5;
/** Oppervlakken waarop tekst zonder eigen achtergrond kan staan. */
export const OPPERVLAKKEN = ['--wit', '--grijs'];
/** Rijen met alleen een achtergrond waarvan de tekstkleur uit een andere regel komt (naam, voorgrond, achtergrond). */
export const EXTRA_PAREN = [['.knop-accent:hover (wit op donkere accent)', '--wit', '--accent-donker']];
/** Lijnen en haltes van de metrokaart zijn grafische elementen: minstens 3:1 tegen wit (WCAG 1.4.11; SX-18, ADR B110). */
export const MINIMUM_GRAFISCH = 3;
export const LIJNEN = Object.freeze(['--lijn-1', '--lijn-2', '--lijn-3', '--lijn-4']);

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function tokensUit(css) {
  const root = /:root\s*\{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const tokens = {};
  for (const m of (root?.[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,6})\s*;/gi)) tokens[m[1]] = m[2];
  return tokens;
}

export function kleurWaarde(waarde, tokens) {
  const v = String(waarde).trim();
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (m) return tokens[m[1]] ?? null;
  return HEX.test(v) ? v : null;
}

const kanaal = (h, i) => {
  const hex = h.length === 4 ? [...h.slice(1)].map((c) => c + c).join('') : h.slice(1);
  const c = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const helderheid = (h) => 0.2126 * kanaal(h, 0) + 0.7152 * kanaal(h, 1) + 0.0722 * kanaal(h, 2);
export function contrast(a, b) {
  const [x, y] = [helderheid(a), helderheid(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Alle tekst/achtergrond-paren van één stuk CSS. `tokens` komt uit site.css. */
export function paren(css, tokens) {
  const schoon = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const uit = [];
  for (const m of schoon.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith(':root') || selector.startsWith('@')) continue;
    const decl = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decl[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    const fg = decl.color ? kleurWaarde(decl.color, tokens) : null;
    const bgTekst = decl['background-color'] ?? decl.background;
    const bg = bgTekst ? kleurWaarde(bgTekst.split(/\s/)[0], tokens) : null;
    if (decl.color && !fg) { uit.push({ selector, fout: `kleur niet te herleiden: ${decl.color}` }); continue; }
    if (fg && bg) uit.push({ selector, fg, bg });
    else if (fg) for (const o of OPPERVLAKKEN) uit.push({ selector: `${selector} op ${o}`, fg, bg: tokens[o] });
  }
  return uit;
}

/** Controleert site.css en de <style>-blokken van de pagina's. Geeft { paren, fouten }. */
export function controleerContrast(root) {
  const css = readFileSync(resolve(root, 'css/site.css'), 'utf8');
  const tokens = tokensUit(css);
  let lijst = paren(css, tokens);
  // Overige stylesheets van de site die de tokens van site.css gebruiken (docentmodus, fase 9).
  if (existsSync(resolve(root, 'css/docent.css'))) lijst = lijst.concat(paren(readFileSync(resolve(root, 'css/docent.css'), 'utf8'), tokens).map((p) => ({ ...p, selector: `docent.css: ${p.selector}` })));
  for (const f of readdirSync(root).filter((n) => n.endsWith('.html'))) {
    for (const s of readFileSync(resolve(root, f), 'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      lijst = lijst.concat(paren(s[1], tokens).map((p) => ({ ...p, selector: `${f}: ${p.selector}` })));
    }
  }
  for (const [selector, fg, bg] of EXTRA_PAREN) lijst.push({ selector, fg: tokens[fg], bg: tokens[bg] });
  for (const t of LIJNEN) {
    lijst.push(tokens[t] ? { selector: `metrokaart ${t} op wit`, fg: tokens[t], bg: tokens['--wit'], minimum: MINIMUM_GRAFISCH }
      : { selector: `metrokaart ${t}`, fout: 'token ontbreekt in :root' });
  }
  const fouten = [];
  for (const p of lijst) {
    if (p.fout) { fouten.push(`${p.selector}: ${p.fout}`); continue; }
    p.ratio = contrast(p.fg, p.bg);
    const minimum = p.minimum ?? MINIMUM;
    if (p.ratio < minimum) fouten.push(`${p.selector}: ${p.fg} op ${p.bg} = ${p.ratio.toFixed(2)}:1 (minimaal ${minimum}:1)`);
  }
  return { paren: lijst, fouten };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { paren: l, fouten } = controleerContrast(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log(`${l.length} tekstparen gecontroleerd, ${fouten.length} onder ${MINIMUM}:1`);
  fouten.forEach((f) => console.log(`FOUT ${f}`));
  process.exit(fouten.length ? 1 : 0);
}
