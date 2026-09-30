// Linkcontrole (SI-3, BR-2, BR-6).
//   1. Interne links: alle interne links resolven en er zijn geen absolute interne links.
//   2. Externe links (BR-6): elke DOI en URL uit data/bronnen-N.json en elke externe link in de pagina's bestaat.
//
// Gebruik: node tools/link-check.mjs [--offline]
//   --offline  slaat de externe controle over (lokaal of zonder netwerk). Zonder --offline en zonder bereikbaar netwerk
//              (een testverzoek naar doi.org mislukt) slaat de controle de externe links ook over, met een waarschuwing:
//              de check faalt dan niet vals. Met netwerk faalt hij op elke dode link.
// Een link is dood bij: een DOI die doi.org niet kent, HTTP 404 of 410, of een hostnaam die niet bestaat. Andere
// antwoorden (403, 429, 5xx, tijdsoverschrijding) betekenen dat de link niet te verifiëren is: waarschuwing, geen fout,
// omdat uitgevers robots weren.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ATTR = /\b(?:href|src)\s*=\s*"([^"]*)"/gi;
const isHttp = (u) => /^https?:\/\//i.test(u);

function htmlBestanden(dir) {
  return readdirSync(dir).flatMap((n) => {
    if (['.git', 'node_modules', 'tests', '.claude', '.playwright-mcp'].includes(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? htmlBestanden(p) : p.endsWith('.html') ? [p] : [];
  });
}

/** Controleert de interne links van alle pagina's onder `root`. Geeft een lijst fouten. */
export function controleerInterneLinks(root) {
  const fouten = [];
  for (const bestand of htmlBestanden(root)) {
    const html = readFileSync(bestand, 'utf8');
    for (const [, url] of html.matchAll(ATTR)) {
      const naam = bestand.slice(root.length + 1);
      if (url === '' || url.startsWith('#') || /^(mailto|tel|data|javascript):/i.test(url)) continue;
      if (/^https?:\/\/hanbedrijfskunde\.github\.io/i.test(url) || url.startsWith('/')) {
        fouten.push(`${naam}: absolute interne link ${url}`);
        continue;
      }
      if (isHttp(url) || url.startsWith('//')) continue;
      const pad = url.split('#')[0].split('?')[0];
      if (!existsSync(resolve(dirname(bestand), pad))) fouten.push(`${naam}: dode link ${url}`);
    }
  }
  return fouten;
}

/** Alle externe links: uit de bronbestanden (bronnen en wachtOpCitatie, zonder fictieve) en uit de pagina's. */
export function verzamelExterneLinks(root) {
  const uit = new Map(); // url → waar
  const dataMap = resolve(root, 'data');
  if (existsSync(dataMap)) {
    for (const n of readdirSync(dataMap).filter((x) => /^bronnen-\d\.json$/.test(x)).sort()) {
      const inhoud = JSON.parse(readFileSync(resolve(dataMap, n), 'utf8'));
      for (const b of [...(inhoud.bronnen ?? []), ...(inhoud.wachtOpCitatie ?? [])]) {
        if (b.link && b.fictief !== true && !uit.has(b.link)) uit.set(b.link, `${n}: ${b.id}`);
      }
    }
  }
  for (const bestand of htmlBestanden(root)) {
    for (const [, url] of readFileSync(bestand, 'utf8').matchAll(ATTR)) {
      if (isHttp(url) && !/^https?:\/\/hanbedrijfskunde\.github\.io/i.test(url) && !uit.has(url)) uit.set(url, bestand.slice(root.length + 1));
    }
  }
  return uit;
}

const DOI_RE = /^https?:\/\/(?:dx\.)?doi\.org\/(10\..+)$/i;
const YOUTUBE_RE = /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i;

/**
 * Controleert één link. Geeft { status: 'ok' | 'dood' | 'onzeker', reden }.
 * @param {string} url
 * @param {(url: string, opties?: object) => Promise<{status: number, json?: () => Promise<any>}>} haal `fetch` of een dubbelganger
 */
export async function controleerLink(url, haal) {
  const pogen = async (u, opties) => {
    try { return { r: await haal(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'a3-learning-linkcheck' }, ...opties }) }; }
    catch (e) { return { fout: e }; }
  };
  const netwerkFout = (e) => (/ENOTFOUND|EAI_AGAIN/.test(`${e?.cause?.code ?? ''}${e?.message ?? ''}`)
    ? { status: 'dood', reden: 'hostnaam bestaat niet' } : { status: 'onzeker', reden: `geen antwoord (${e?.cause?.code ?? e?.message ?? 'onbekend'})` });

  const doi = DOI_RE.exec(url);
  if (doi) {
    const { r, fout } = await pogen(`https://doi.org/api/handles/${doi[1]}`);
    if (fout) return netwerkFout(fout);
    if (r.status === 404) return { status: 'dood', reden: 'DOI onbekend bij doi.org' };
    if (r.status !== 200) return { status: 'onzeker', reden: `doi.org gaf ${r.status}` };
    const j = await r.json();
    return j.responseCode === 1 ? { status: 'ok', reden: '' } : { status: 'dood', reden: `DOI onbekend bij doi.org (code ${j.responseCode})` };
  }
  if (YOUTUBE_RE.test(url)) {
    const { r, fout } = await pogen(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (fout) return netwerkFout(fout);
    if ([400, 401, 404].includes(r.status)) return { status: 'dood', reden: `video niet beschikbaar (${r.status})` };
    return r.status === 200 ? { status: 'ok', reden: '' } : { status: 'onzeker', reden: `YouTube gaf ${r.status}` };
  }
  let { r, fout } = await pogen(url, { method: 'HEAD' });
  if (!fout && r.status >= 400) ({ r, fout } = await pogen(url, { method: 'GET' })); // sommige servers weigeren HEAD
  if (fout) return netwerkFout(fout);
  if (r.status === 404 || r.status === 410) return { status: 'dood', reden: `HTTP ${r.status}` };
  if (r.status >= 400) return { status: 'onzeker', reden: `HTTP ${r.status}` };
  return { status: 'ok', reden: '' };
}

/**
 * Controleert alle externe links. Geeft { fouten, waarschuwingen, gecontroleerd, overgeslagen }.
 * `offline` slaat alles over. Is er geen netwerk (testverzoek mislukt), dan wordt alles overgeslagen met een waarschuwing.
 */
export async function controleerExterneLinks(links, { haal = globalThis.fetch, offline = false } = {}) {
  const uit = { fouten: [], waarschuwingen: [], gecontroleerd: 0, overgeslagen: false };
  if (offline) { uit.overgeslagen = true; uit.waarschuwingen.push('externe links overgeslagen (--offline)'); return uit; }
  try {
    await haal('https://doi.org/api/handles/10.1000/1', { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    uit.overgeslagen = true;
    uit.waarschuwingen.push('geen netwerk: externe links niet gecontroleerd');
    return uit;
  }
  for (const [url, waar] of links) {
    const { status, reden } = await controleerLink(url, haal);
    uit.gecontroleerd += 1;
    if (status === 'dood') uit.fouten.push(`${waar}: dode link ${url} (${reden})`);
    else if (status === 'onzeker') uit.waarschuwingen.push(`${waar}: ${url} niet te verifiëren (${reden})`);
  }
  return uit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const fouten = controleerInterneLinks(root);
  const extern = await controleerExterneLinks(verzamelExterneLinks(root), { offline: process.argv.includes('--offline') });
  fouten.push(...extern.fouten);
  extern.waarschuwingen.forEach((w) => console.warn(`WAARSCHUWING ${w}`));
  if (fouten.length) {
    console.error('link-check faalt:\n' + fouten.join('\n'));
    process.exit(1);
  }
  console.log(`link-check: ok (${extern.gecontroleerd} externe links gecontroleerd${extern.overgeslagen ? ', externe controle overgeslagen' : ''})`);
}
