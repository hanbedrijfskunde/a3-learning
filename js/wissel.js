// De Wissel (WS-1, WS-3…WS-11, LB-14, EV-09): feedback geven en ontvangen zonder server, via het klembord.
// Geen DOM en geen netwerk: de opslag, de sessie en de klok worden meegegeven, zodat dit in Node te testen is (WS-9).
//
// Opslag (zie store.js en sessie.js):
//   ontvangen wisselblokken      meta `wissel:blokken`   [{ id, rol, ontvangenOp, tekst, blok: { vraag, zoekvragen } }]
//                                Tekst van een ander: hij komt nooit in een bewijsrecord of dossier.
//   feedbacklog en teamactie     het bewijsrecord EV-09 (taak 6.2), inhoud { regels: [..], teamactie }
//   regel                        { id, richting: 'ontvangen'|'gegeven', rol, zie, mis, vraag, actie, status, statusOp }
//
// Klembordtekst is gewone tekst, leesbaar in elke chat:
//   A3-WISSELBLOK                A3-FEEDBACK
//   Onderzoeksvraag: …           Ik zie: …
//   Zoekvraag 1 (frame): …       Ik mis: …
//   Verband 1: … — …             Ik vraag me af: …      (Verband: alleen als EV-11 er is, WS-2)
import { stelVraagSamen } from './checks/lb1.js';
import { verbandenUit, verbandRegel } from './verbandregel.js';
import { wisselContext, META_BLOKKEN, ROL_ANDER_TEAM } from './context.js';

export const ROLLEN = Object.freeze(['teamgenoot', 'medestudent', 'coach']); // WS-3
export { ROL_ANDER_TEAM };
export const ACTIE_STATUSSEN = Object.freeze(['open', 'bezig', 'gedaan']);
export const HERINNER_NA_DAGEN = 7; // WS-11
export const EV09_TAAK = '6.2';
export const WISSELBLOK_KOP = 'A3-WISSELBLOK';
export const FEEDBACK_KOP = 'A3-FEEDBACK';
const DAG_MS = 24 * 60 * 60 * 1000;

/** WS-10: de privacytekst bij de Wissel noemt het klembord als kanaal (≤ 60 woorden). */
export const PRIVACYTEKST = 'De Wissel gebruikt het klembord van je apparaat en de app waarmee je het wisselblok verstuurt, '
  + 'bijvoorbeeld Teams of WhatsApp. Via die weg verlaat je tekst deze browser; de site zelf verstuurt niets. '
  + 'Zet er geen alias, naam of vertrouwelijke gegevens van een opdrachtgever in.';

/** Eén regel tekst: witruimte samengevouwen en getrimd. Zo is een vergelijking niet gevoelig voor regeleinden. */
export const plat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const gevuld = (t) => plat(t) !== '';
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Vervangt een alias in een tekst (hele woorden, hoofdletterongevoelig), zodat het wisselblok geen alias bevat (WS-1). */
function verberg(tekst, alias) {
  const a = plat(alias);
  if (a.length < 2) return tekst;
  const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tekst.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu'), '[alias]');
}

// ---------------------------------------------------------------- wisselblok (WS-1, WS-3)

/**
 * Bouwt het wisselblok uit EV-01, EV-02 en EV-11: de onderzoeksvraag, de zoekvragen en (in leerblok 4) de lijst van verbanden,
 * zonder alias (WS-1, WS-2). De vraag staat er alleen in als alle drie de delen zijn ingevuld.
 * @param {{'EV-01'?: object, 'EV-02'?: object, 'EV-11'?: object}} records nieuwste records
 * @param {{alias?: string}} [opties]
 * @returns {{tekst: string, vraag: string, zoekvragen: {frame: string, tekst: string}[], verbanden: string[], leeg: boolean}}
 */
export function maakWisselblok(records = {}, { alias = '' } = {}) {
  const e1 = records['EV-01']?.inhoud ?? {};
  const e2 = records['EV-02']?.inhoud ?? {};
  const vraag = ['gebruiker', 'pain', 'waarde'].every((v) => gevuld(e1[v])) ? plat(stelVraagSamen(e1)) : '';
  const zoekvragen = [1, 2, 3]
    .map((n) => ({ frame: plat(e2[`frame${n}`]), tekst: plat(e2[`zoekvraag${n}`]) }))
    .filter((z) => z.tekst !== '');
  const verbanden = verbandenUit(records['EV-11']?.inhoud).map(verbandRegel).filter(gevuld);
  const regels = [WISSELBLOK_KOP];
  if (vraag) regels.push(`Onderzoeksvraag: ${vraag}`);
  zoekvragen.forEach((z, i) => regels.push(`Zoekvraag ${i + 1}${z.frame ? ` (${z.frame})` : ''}: ${z.tekst}`));
  verbanden.forEach((v, i) => regels.push(`Verband ${i + 1}: ${v}`));
  const tekst = verberg(regels.join('\n'), alias);
  return {
    tekst,
    vraag: verberg(vraag, alias),
    zoekvragen: zoekvragen.map((z) => ({ frame: z.frame, tekst: verberg(z.tekst, alias) })),
    verbanden: verbanden.map((v) => verberg(v, alias)),
    leeg: !vraag && zoekvragen.length === 0 && verbanden.length === 0,
  };
}

/** Leest een geplakt wisselblok. Geeft { geldig, blok?, fout? }; `blok` is { vraag, zoekvragen: [{frame, tekst}], verbanden?: [regel] }. */
export function leesWisselblok(tekst) {
  const regels = String(tekst ?? '').split(/\r?\n/).map(plat);
  const kop = regels.findIndex((r) => r.toUpperCase().startsWith(WISSELBLOK_KOP));
  if (kop === -1) return { geldig: false, fout: `Dit lijkt geen wisselblok: de tekst begint niet met ${WISSELBLOK_KOP}. Plak de hele tekst zoals je wisselpartner hem kopieerde.` };
  let vraag = '';
  const zoekvragen = [];
  const verbanden = [];
  for (const r of regels.slice(kop + 1)) {
    const v = r.match(/^Onderzoeksvraag\s*:\s*(.+)$/i);
    if (v) { vraag = v[1]; continue; }
    const vb = r.match(/^Verband\s*\d*\s*:\s*(.+)$/i);
    if (vb) { verbanden.push(plat(vb[1])); continue; }
    const z = r.match(/^Zoekvraag\s*\d*\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/i);
    if (z) zoekvragen.push({ frame: plat(z[1]), tekst: plat(z[2]) });
  }
  if (!vraag && zoekvragen.length === 0 && verbanden.length === 0) return { geldig: false, fout: 'In dit wisselblok staat geen onderzoeksvraag, geen zoekvraag en geen verband.' };
  return { geldig: true, blok: verbanden.length ? { vraag, zoekvragen, verbanden } : { vraag, zoekvragen } };
}

/**
 * Welke delen van de eigen tekst zijn letterlijk gelijk aan een ontvangen wisselblok (WS-7)? 0 tekens verschil.
 * Alleen witruimte telt niet mee. Zoekvragen tellen als gelijk als alle eigen zoekvragen, in willekeurige volgorde,
 * dezelfde zijn als die in het wisselblok.
 * @param {{blok: {vraag: string, zoekvragen: {tekst: string}[]}}[]} ontvangen
 * De verbanden (EV-11) tellen als gelijk als alle eigen verbandregels, in willekeurige volgorde, dezelfde zijn als die in het wisselblok.
 * @param {{vraag?: string, zoekvragen?: string[], verbanden?: string[]}} eigen
 * @returns {('onderzoeksvraag'|'zoekvragen'|'verbanden')[]}
 */
export function gelijkAanWissel(ontvangen, { vraag = '', zoekvragen = [], verbanden = [] } = {}) {
  const uit = [];
  const blokken = (ontvangen ?? []).map((o) => o?.blok).filter(isObject);
  const eigenVraag = plat(vraag);
  if (eigenVraag && blokken.some((b) => plat(b.vraag) === eigenVraag)) uit.push('onderzoeksvraag');
  const eigen = zoekvragen.map(plat).filter(Boolean);
  const gelijk = (b) => {
    const hunne = (b.zoekvragen ?? []).map((z) => plat(z.tekst));
    return hunne.length === eigen.length && eigen.every((z) => hunne.includes(z));
  };
  if (eigen.length > 0 && blokken.some(gelijk)) uit.push('zoekvragen');
  const eigenVerbanden = verbanden.map(plat).filter(Boolean);
  const gelijkVerbanden = (b) => {
    const hunne = (b.verbanden ?? []).map(plat);
    return hunne.length === eigenVerbanden.length && eigenVerbanden.every((v) => hunne.includes(v));
  };
  if (eigenVerbanden.length > 0 && blokken.some(gelijkVerbanden)) uit.push('verbanden');
  return uit;
}

// ---------------------------------------------------------------- feedbacktekst (WS-5)

/** De tekst die je aan je wisselpartner terugstuurt. */
export const maakFeedbackTekst = ({ zie, mis, vraag }) => [
  FEEDBACK_KOP, `Ik zie: ${plat(zie)}`, `Ik mis: ${plat(mis)}`, `Ik vraag me af: ${plat(vraag)}`,
].join('\n');

/** Leest geplakte feedback. Geeft { geldig, feedback?: {zie, mis, vraag}, fout? }. */
export function leesFeedbackTekst(tekst) {
  const regels = String(tekst ?? '').split(/\r?\n/).map(plat);
  const kop = regels.findIndex((r) => r.toUpperCase().startsWith(FEEDBACK_KOP));
  if (kop === -1) return { geldig: false, fout: `Dit lijkt geen feedback: de tekst begint niet met ${FEEDBACK_KOP}. Plak de hele tekst zoals je wisselpartner hem kopieerde.` };
  const feedback = { zie: '', mis: '', vraag: '' };
  for (const r of regels.slice(kop + 1)) {
    const m = r.match(/^Ik\s+(zie|mis|vraag me af)\s*:\s*(.*)$/i);
    if (m) feedback[{ zie: 'zie', mis: 'mis', 'vraag me af': 'vraag' }[m[1].toLowerCase()]] = m[2];
  }
  if (!gevuld(feedback.zie) && !gevuld(feedback.mis) && !gevuld(feedback.vraag)) return { geldig: false, fout: 'In deze feedback is niets ingevuld.' };
  return { geldig: true, feedback };
}

// ---------------------------------------------------------------- herinnering (WS-11)

/**
 * Acties die al minstens `drempel` dagen dezelfde status hebben en nog niet „gedaan" zijn (WS-11).
 * @param {{regels?: object[], teamactie?: object|null}} inhoud inhoud van EV-09
 * @param {Date} nu
 */
export function herinneringen(inhoud, nu, drempel = HERINNER_NA_DAGEN) {
  const kandidaten = [
    ...(inhoud?.regels ?? []).filter(isObject).map((r) => ({ id: r.id, soort: 'regel', actie: r.actie, status: r.status, statusOp: r.statusOp })),
    ...(isObject(inhoud?.teamactie) ? [{ id: 'teamactie', soort: 'teamactie', actie: inhoud.teamactie.tekst, status: inhoud.teamactie.status, statusOp: inhoud.teamactie.statusOp }] : []),
  ];
  return kandidaten
    .filter((k) => gevuld(k.actie) && k.status !== 'gedaan' && k.statusOp)
    .map((k) => ({ ...k, dagen: Math.floor((nu.getTime() - Date.parse(k.statusOp)) / DAG_MS) }))
    .filter((k) => k.dagen >= drempel);
}

export const herinneringTekst = (h) => `Je actie „${plat(h.actie)}” staat al ${h.dagen} dagen op „${h.status}”. Zet de status als er iets is veranderd.`;

/** Herinneringen uit de opslag, voor pagina's die de Wissel zelf niet tonen. */
export const herinneringenUitStore = (store, nu = () => new Date()) => herinneringen(store.get('EV-09')?.inhoud, nu());

export { wisselContext };

// ---------------------------------------------------------------- de Wissel

/**
 * @param {object} p
 * @param {ReturnType<import('./store.js').maakStore>} p.store
 * @param {ReturnType<import('./sessie.js').maakSessie>} p.sessie sessie van het leerblok met taak 6.2 (leerblok 4)
 * @param {() => Date} [p.nu] injecteerbare klok (WS-8, WS-11)
 */
export function maakWissel({ store, sessie, nu = () => new Date() }) {
  const leesInhoud = () => {
    const i = sessie.leesToepassing(EV09_TAAK);
    return { regels: Array.isArray(i.regels) ? i.regels.filter(isObject) : [], teamactie: isObject(i.teamactie) ? i.teamactie : null };
  };
  /** Bewaart de log en houdt de „volgende stap" van de taak vast, die de pagina in dezelfde inhoud bewaart. */
  const schrijf = (inhoud) => {
    const { volgendeStap } = sessie.leesToepassing(EV09_TAAK);
    return sessie.bewaar(EV09_TAAK, volgendeStap ? { ...inhoud, volgendeStap } : inhoud);
  };
  const tijd = () => nu().toISOString();
  const volgendId = (regels) => `r${1 + Math.max(0, ...regels.map((r) => Number(String(r.id).slice(1)) || 0))}`;

  const blokken = () => store.getMeta(META_BLOKKEN) ?? [];
  const mijnWisselblok = (alias = '') => maakWisselblok({ 'EV-01': store.get('EV-01'), 'EV-02': store.get('EV-02'), 'EV-11': store.get('EV-11') }, { alias });

  /** WS-3: het wisselblok van een wisselpartner met een van de drie rollen. */
  function plakWisselblok(tekst, rol) {
    if (!ROLLEN.includes(rol)) return { ok: false, fout: `Kies de rol van je wisselpartner: ${ROLLEN.join(', ')}.` };
    const gelezen = leesWisselblok(tekst);
    if (!gelezen.geldig) return { ok: false, fout: gelezen.fout };
    const lijst = blokken();
    const bestaand = lijst.find((b) => JSON.stringify(b.blok) === JSON.stringify(gelezen.blok) && b.rol === rol);
    if (bestaand) return { ok: true, blok: bestaand, nieuw: false };
    const blok = { id: `w${1 + Math.max(0, ...lijst.map((b) => Number(b.id.slice(1)) || 0))}`, rol, ontvangenOp: tijd(), tekst: String(tekst).trim(), blok: gelezen.blok };
    store.setMeta(META_BLOKKEN, [...lijst, blok]);
    return { ok: true, blok, nieuw: true };
  }

  function voegRegelToe({ richting, rol, zie = '', mis = '', vraag = '', actie = '', status = 'open' }) {
    if (!['ontvangen', 'gegeven'].includes(richting)) return { ok: false, fout: 'Kies of de feedback ontvangen of gegeven is.' };
    if (![...ROLLEN, ROL_ANDER_TEAM].includes(rol)) return { ok: false, fout: `Kies een rol: ${[...ROLLEN, ROL_ANDER_TEAM].join(', ')}.` };
    if (!gevuld(zie) && !gevuld(mis) && !gevuld(vraag)) return { ok: false, fout: 'Vul minstens één van „ik zie”, „ik mis” en „ik vraag me af” in.' };
    if (!ACTIE_STATUSSEN.includes(status)) return { ok: false, fout: `Kies een status: ${ACTIE_STATUSSEN.join(', ')}.` };
    const inhoud = leesInhoud();
    const regel = { id: volgendId(inhoud.regels), richting, rol, zie: plat(zie), mis: plat(mis), vraag: plat(vraag), actie: plat(actie), status, statusOp: tijd() };
    schrijf({ ...inhoud, regels: [...inhoud.regels, regel] });
    return { ok: true, regel };
  }

  /** WS-4 en WS-5: feedback op het wisselblok van een partner. Geeft ook de tekst om terug te sturen. */
  function geefFeedback({ blokId, zie, mis, vraag }) {
    const blok = blokken().find((b) => b.id === blokId);
    if (!blok) return { ok: false, fout: 'Plak eerst het wisselblok van je wisselpartner.' };
    const r = voegRegelToe({ richting: 'gegeven', rol: blok.rol, zie, mis, vraag });
    return r.ok ? { ...r, tekst: maakFeedbackTekst(r.regel) } : r;
  }

  /** WS-5: feedback die via het klembord terugkomt, wordt een ontvangen regel in EV-09. */
  function plakFeedback(tekst, rol) {
    const gelezen = leesFeedbackTekst(tekst);
    if (!gelezen.geldig) return { ok: false, fout: gelezen.fout };
    return voegRegelToe({ richting: 'ontvangen', rol, ...gelezen.feedback });
  }

  /** Wijzigt een regel. De status-tijd wordt opnieuw gezet als de status verandert of de actie voor het eerst wordt ingevuld (WS-11). */
  function wijzigRegel(id, deel) {
    const inhoud = leesInhoud();
    const oud = inhoud.regels.find((r) => r.id === id);
    if (!oud) return { ok: false, fout: `Onbekende regel ${id}.` };
    const nieuw = { ...oud };
    for (const k of ['zie', 'mis', 'vraag', 'actie']) if (deel[k] !== undefined) nieuw[k] = plat(deel[k]);
    if (deel.rol !== undefined && [...ROLLEN, ROL_ANDER_TEAM].includes(deel.rol)) nieuw.rol = deel.rol;
    if (deel.status !== undefined && ACTIE_STATUSSEN.includes(deel.status)) nieuw.status = deel.status;
    if (nieuw.status !== oud.status || (!gevuld(oud.actie) && gevuld(nieuw.actie))) nieuw.statusOp = tijd();
    schrijf({ ...inhoud, regels: inhoud.regels.map((r) => (r.id === id ? nieuw : r)) });
    return { ok: true, regel: nieuw };
  }

  function verwijderRegel(id) {
    const inhoud = leesInhoud();
    schrijf({ ...inhoud, regels: inhoud.regels.filter((r) => r.id !== id) });
  }

  /** WS-6: één teamactie na de post-its van andere teams. */
  function zetTeamactie({ tekst, status = 'open' }) {
    const inhoud = leesInhoud();
    const oud = inhoud.teamactie;
    if (!ACTIE_STATUSSEN.includes(status)) return { ok: false, fout: `Kies een status: ${ACTIE_STATUSSEN.join(', ')}.` };
    const nieuw = { tekst: plat(tekst), status, statusOp: oud && oud.status === status && gevuld(oud.tekst) ? oud.statusOp : tijd() };
    schrijf({ ...inhoud, teamactie: gevuld(nieuw.tekst) ? nieuw : null });
    return { ok: true, teamactie: nieuw };
  }

  return {
    leesInhoud, blokken, mijnWisselblok, plakWisselblok, geefFeedback, plakFeedback,
    voegRegelToe, wijzigRegel, verwijderRegel, zetTeamactie,
    herinneringen: () => herinneringen(leesInhoud(), nu()),
    privacytekst: PRIVACYTEKST,
  };
}
