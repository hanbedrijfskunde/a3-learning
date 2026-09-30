// Controle van de spelbestanden (spellen/*.json), voor de bouwer en de tests; de site zelf heeft dit niet nodig en laadt het niet.
// Regels uit het blueprint: MD-8 (hoogstens 5 minuten, geschat), MD-10 (feedback per keuze, geen score), MD-13 (geen netwerkadressen),
// MD-15 (alles verzonnen is fictief en het spel zegt dat). De logica van het spel zelf staat in js/spel-model.js.
import { KAPITALEN, SOORTEN, AAOCC, EFFECT_TEKST, geschatteSeconden, MAX_SECONDEN } from '../js/spel-model.js';

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const gevuld = (t) => typeof t === 'string' && t.trim() !== '';
/** Sleutels die op een score, punten of ranglijst wijzen (MD-10); ze komen in geen enkel spel voor. */
const SCORE_SLEUTEL = /^(score|scores|punten|ranglijst|highscore|niveau|cijfer|goedAantal|aantalGoed)$/i;


/** Alle sleutels in de data, ook diep erin (voor de controle op scores en netwerkadressen). */
function sleutelsEnTeksten(x, uit = { sleutels: [], teksten: [] }) {
  if (typeof x === 'string') uit.teksten.push(x);
  else if (Array.isArray(x)) x.forEach((w) => sleutelsEnTeksten(w, uit));
  else if (isObject(x)) for (const [k, w] of Object.entries(x)) { uit.sleutels.push(k); sleutelsEnTeksten(w, uit); }
  return uit;
}

/**
 * Controleert een spel op de regels van het blueprint en geeft een lijst fouten.
 *   MD-8   hoogstens 5 minuten (geschat)
 *   MD-10  feedback bij elke keuze, geen score of ranglijst
 *   MD-13  werkt zonder netwerk: geen adressen in de data
 *   MD-15  elke kaart of beslissing is als fictief gemarkeerd, en het spel legt dat uit
 */
export function controleerSpel(spel, naam = spel?.id ?? 'spel') {
  const fouten = [];
  const fout = (t) => fouten.push(`${naam}: ${t}`);
  if (!isObject(spel)) return [`${naam}: geen object`];
  if (spel.formaat !== '1.0') fout('formaat moet "1.0" zijn');
  if (!gevuld(spel.id)) fout('mist een id');
  if (!SOORTEN.includes(spel.type)) fout(`type moet ${SOORTEN.join(', ')} zijn`);
  if (!gevuld(spel.titel)) fout('mist een titel');
  if (!gevuld(spel.intro)) fout('mist een introductie');
  if (!gevuld(spel.fictiefUitleg) || !/verzonnen/i.test(spel.fictiefUitleg)) fout('fictiefUitleg moet zeggen dat de voorbeelden verzonnen zijn (MD-15)');
  if (!gevuld(spel.geenBewijs)) fout('geenBewijs mist: het spel zegt dat het geen bewijs oplevert (MD-11)');
  if (geschatteSeconden(spel) > MAX_SECONDEN) fout(`geschatte duur ${geschatteSeconden(spel)} s is meer dan ${MAX_SECONDEN} s (MD-8)`);

  const { sleutels, teksten } = sleutelsEnTeksten(spel);
  for (const k of sleutels) if (SCORE_SLEUTEL.test(k)) fout(`sleutel ${k}: een spel toont geen score of ranglijst (MD-10)`);
  for (const t of teksten) {
    if (/https?:\/\/|\/\/[\w-]+\.\w/i.test(t)) fout(`tekst met een netwerkadres (${t.slice(0, 40)}…): een spel werkt zonder netwerk (MD-13)`);
    if (/\b(score|punten|ranglijst|highscore)\b/i.test(t) && !/geen (score|punten|ranglijst)/i.test(t)) fout(`tekst noemt een score of ranglijst (MD-10): ${t.slice(0, 50)}…`);
  }

  if (spel.type === 'kaarten') {
    if (!Array.isArray(spel.kaarten) || spel.kaarten.length !== 6) fout('een bronnen-detective heeft zes kaarten');
    for (const k of spel.kaarten ?? []) {
      const wie = `kaart ${k?.id ?? '(zonder id)'}: `;
      if (k?.fictief !== true) fout(`${wie}fictief moet true zijn (MD-15)`);
      for (const veld of ['titel', 'soort', 'auteur', 'jaar', 'uitgever', 'samenvatting', 'kernpunt']) if (!gevuld(k?.[veld])) fout(`${wie}mist ${veld}`);
      if (!Array.isArray(k?.gegevens) || k.gegevens.length < 3) fout(`${wie}minstens drie gegevens om te onderzoeken`);
      for (const c of AAOCC) if (!gevuld(k?.aaocc?.[c])) fout(`${wie}AAOCC mist ${c}`);
      if (!Array.isArray(k?.opties) || k.opties.length !== 3) fout(`${wie}drie opties`);
      for (const o of k?.opties ?? []) if (!gevuld(o?.id) || !gevuld(o?.tekst) || !gevuld(o?.feedback)) fout(`${wie}elke optie heeft id, tekst en feedback (MD-10)`);
      if ((k?.opties ?? []).filter((o) => o.passend).length !== 1) fout(`${wie}precies één optie past het best`);
    }
  }
  if (spel.type === 'simulatie') {
    if (!Array.isArray(spel.beslissingen) || spel.beslissingen.length !== 3) fout('een waarde-simulator heeft drie beslissingen');
    if (spel.fictief !== true) fout('fictief moet true zijn (MD-15)');
    if ((spel.voorspelOpties ?? []).map((o) => o.id).join() !== 'geen,input,plus,min') fout('voorspelOpties zijn geen, input, plus, min');
    for (const b of spel.beslissingen ?? []) {
      const wie = `beslissing ${b?.id ?? '(zonder id)'}: `;
      if (b?.fictief !== true) fout(`${wie}fictief moet true zijn (MD-15)`);
      for (const veld of ['titel', 'situatie']) if (!gevuld(b?.[veld])) fout(`${wie}mist ${veld}`);
      if (!Array.isArray(b?.opties) || b.opties.length < 2) fout(`${wie}minstens twee opties`);
      for (const o of b?.opties ?? []) {
        if (!gevuld(o?.id) || !gevuld(o?.tekst) || !gevuld(o?.feedback)) fout(`${wie}elke optie heeft id, tekst en feedback (MD-10)`);
        for (const [kap, e] of Object.entries(o?.effect ?? {})) {
          if (!KAPITALEN.includes(kap)) fout(`${wie}${kap} is geen van de zes kapitalen`);
          if (!Array.isArray(e?.termijn) || e.termijn.length !== 3 || e.termijn.some((t) => !(t in EFFECT_TEKST))) fout(`${wie}${kap} heeft drie termijnen uit geen, input, plus, min`);
          if (!gevuld(e?.toelichting)) fout(`${wie}${kap} mist een toelichting (MD-10)`);
        }
      }
    }
  }
  if (spel.type === 'rondes' || spel.type === 'radar') fouten.push(...controleerKeuzespel(spel, naam));
  return fouten;
}

/** Vraagslijper en Stakeholder-radar: rondes met velden vol opties, elke optie met feedback en per veld precies één sterkste optie. */
function controleerKeuzespel(spel, naam) {
  const fouten = [];
  const fout = (t) => fouten.push(`${naam}: ${t}`);
  const rondeAantal = spel.type === 'rondes' ? 3 : 6;
  if (!Array.isArray(spel.rondes) || spel.rondes.length !== rondeAantal) fout(spel.type === 'rondes' ? 'een vraagslijper heeft drie rondes' : 'een stakeholder-radar heeft zes stakeholders');
  const controleerVeld = (wie, veld, opties) => {
    if (!Array.isArray(opties) || opties.length < 2) { fout(`${wie}${veld}: minstens twee opties`); return; }
    for (const o of opties) if (!gevuld(o?.id) || !gevuld(o?.tekst) || !gevuld(o?.feedback)) fout(`${wie}${veld}: elke optie heeft id, tekst en feedback (MD-10)`);
    if (opties.filter((o) => o.passend === true).length !== 1) fout(`${wie}${veld}: precies één optie past het best`);
    if (new Set(opties.map((o) => o.feedback)).size !== opties.length) fout(`${wie}${veld}: elke optie heeft eigen feedback (MD-10)`);
  };
  if (spel.type === 'rondes') {
    if (!Array.isArray(spel.velden) || spel.velden.length !== 3 || spel.velden.some((v) => !gevuld(v?.id) || !gevuld(v?.label))) fout('drie velden met id en label (gebruiker, pain, waarde)');
    const ids = (spel.velden ?? []).map((v) => v?.id);
    if (!gevuld(spel.format) || ids.some((id) => !spel.format.includes(`{${id}}`))) fout('format noemt elk veld als {veld}');
  }
  for (const r of spel.rondes ?? []) {
    const wie = `ronde ${r?.id ?? '(zonder id)'}: `;
    if (r?.fictief !== true) fout(`${wie}fictief moet true zijn (MD-15)`);
    for (const veld of spel.type === 'rondes' ? ['titel', 'vageVraag', 'situatie'] : ['titel', 'soort', 'situatie']) if (!gevuld(r?.[veld])) fout(`${wie}mist ${veld}`);
    if (spel.type === 'rondes') for (const v of spel.velden ?? []) controleerVeld(wie, v.id, r?.keuzes?.[v.id]);
    else {
      if (!['intern', 'extern'].includes(r?.soort)) fout(`${wie}soort is intern of extern`);
      if ((r?.velden ?? []).map((v) => v.id).join() !== 'invloed,belang') fout(`${wie}velden zijn invloed en belang`);
      for (const v of r?.velden ?? []) {
        controleerVeld(wie, v.id, v.opties);
        if ((v.opties ?? []).map((o) => o.id).join() !== 'hoog,laag') fout(`${wie}${v.id}: opties zijn hoog en laag`);
      }
    }
  }
  if (spel.type === 'radar') {
    if ((spel.vakken ?? []).length !== 4) fout('vier vakken (nauw betrekken, tevreden houden, op de hoogte houden, volgen)');
    if (!Array.isArray(spel.slotVragen) || spel.slotVragen.length !== 2) fout('twee slotvragen (wie merkt het eerst, wie heeft belang bij de huidige situatie)');
    const ids = (spel.rondes ?? []).map((r) => r.id).join();
    for (const q of spel.slotVragen ?? []) {
      controleerVeld(`slotvraag ${q?.id}: `, 'opties', q?.opties);
      if ((q?.opties ?? []).map((o) => o.id).join() !== ids) fout(`slotvraag ${q?.id}: de opties zijn de stakeholders van de rondes`);
    }
  }
  return fouten;
}
