// De kleinste hulpen voor verbanden (EV-11): de lijst uit een ruwe invoer en één verband als tekstregel. Los van verbanden.js,
// zodat pagina's die alleen een verband als tekst tonen (dossier, wisselblok) niet de hele kaartlogica laden (PF-4).

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const plat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Verbanden uit de ruwe invoer: alleen objecten met van en naar (de invoer kan onvolledig zijn). */
export const verbandenUit = (invoer) => (Array.isArray(invoer?.verbanden) ? invoer.verbanden.filter(isObject) : []).filter((v) => v.van && v.naar);

/** Eén verband als tekst voor het wisselblok en het A3-tekstblok (WS-2, VB-8): `van type naar — zin`. */
export const verbandRegel = (v) => `${plat(v.vanTekst ?? v.van)} ${v.type} ${plat(v.naarTekst ?? v.naar)} — ${plat(v.zin)}${v.stakeholder ? ` (merkt: ${plat(v.stakeholder)})` : ''}`;
