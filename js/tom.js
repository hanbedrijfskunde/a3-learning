// Het TOM-model van taak 8.1 (TOM³-indeling, Westmoreland BV, z.d.; LB-11, ADR B98). Puur: geen DOM, geen opslag.
//
// Twaalf cellen: laag S, T of O (strategisch, tactisch, operationeel) × kolom 1 tot en met 4 (Methode, Mens, Machine,
// Informatie & Rapportage). Een cel heeft een code („T2”), een label zoals in het bewijsrecord („Tactisch · Mens”) en een
// veld in de toepassing (tomT2). Geen score, geen index (X-13): het bord telt alleen wat de student ergens heeft neergezet.

const tekst = (w) => (typeof w === 'string' ? w.trim() : '');

export const LAGEN = Object.freeze([['S', 'Strategisch'], ['T', 'Tactisch'], ['O', 'Operationeel']]);
export const KOLOMMEN = Object.freeze([['1', 'Methode'], ['2', 'Mens'], ['3', 'Machine'], ['4', 'Informatie & Rapportage']]);

/** De twaalf cellen in leesvolgorde: laag voor laag, van boven naar beneden, en per laag van links naar rechts. */
export const CELLEN = Object.freeze(LAGEN.flatMap(([l, laag], r) => KOLOMMEN.map(([k, kolom], c) => Object.freeze({
  code: `${l}${k}`, laag, kolom, rij: r, kol: c, label: `${laag} · ${kolom}`, veld: `tom${l}${k}`,
}))));

const perCode = new Map(CELLEN.map((c) => [c.code, c]));
const perLabel = new Map(CELLEN.map((c) => [c.label.toLowerCase(), c]));

/** De cel bij een code („T2”) of een label („Tactisch · Mens”), of null. */
export const cel = (sleutel) => perCode.get(tekst(sleutel)) ?? perLabel.get(tekst(sleutel).toLowerCase()) ?? null;

/** De cel direct erboven (null in de bovenste laag) en de drie buren in dezelfde laag: de twee kijkrichtingen. */
export const boven = (c) => (c.rij === 0 ? null : CELLEN.find((x) => x.rij === c.rij - 1 && x.kol === c.kol));
export const buren = (c) => CELLEN.filter((x) => x.rij === c.rij && x !== c);

/** Welke cellen van de toepassing iets bevatten, in leesvolgorde. */
export const gevuldeCellen = (inhoud) => CELLEN.filter((c) => tekst(inhoud?.[c.veld]) !== '');

/** Per laag het aantal gevulde cellen: { Strategisch: 1, Tactisch: 3, Operationeel: 2 }. */
export function perLaag(inhoud) {
  const uit = Object.fromEntries(LAGEN.map(([, laag]) => [laag, 0]));
  for (const c of gevuldeCellen(inhoud)) uit[c.laag] += 1;
  return uit;
}

/**
 * Kijktips bij het ingevulde bord: de twee kijkrichtingen van de stof (omhoog en opzij) en de samenhang met het gekozen niveau.
 * Advies, geen controle: ze veranderen de status niet. Hoogstens twee tegelijk, de belangrijkste eerst.
 * @param {object} inhoud velden tomS1 … tomO4
 * @param {string} niveau strategisch, tactisch, operationeel of leeg
 * @returns {string[]}
 */
export function kijktips(inhoud, niveau = '') {
  const gevuld = gevuldeCellen(inhoud);
  const laag = perLaag(inhoud);
  const n = tekst(niveau).toLowerCase();
  const tips = [];
  if (gevuld.length === 0) return ['Begin bij de cel waar je het vraagstuk ziet gebeuren. Dat is vaak onderaan: op de werkvloer of in de cijfers.'];
  const gekozen = LAGEN.find(([, l]) => l.toLowerCase() === n)?.[1];
  if (gekozen && laag[gekozen] === 0) tips.push(`Je kiest ${n}, maar op die laag staat nog niets. Waar zie je het vraagstuk op die laag?`);
  if (laag.Strategisch + laag.Tactisch === 0) tips.push('Alles wat je noemt, gebeurt op de werkvloer. Kijk omhoog: welke afspraak, rol of keuze zit erachter?');
  if (gevuld.length >= 2 && !gevuld.some((c) => c.kolom === 'Informatie & Rapportage')) tips.push('De vierde kolom is nog leeg. Zie je het vraagstuk terug in de cijfers? Zo niet, dan is dat ook een bevinding.');
  if (gevuld.length >= 2 && new Set(gevuld.map((c) => c.kolom)).size === 1) tips.push(`Alles staat in de kolom ${gevuld[0].kolom}. Kijk opzij: wat merken de mensen, de systemen of de cijfers ervan?`);
  return tips.slice(0, 2);
}

/**
 * Een plaatsing van de student naast die van het modelantwoord (oefening van taak 8.1).
 * @returns {'goed'|'laag'|'kolom'|'anders'|'open'} zelfde cel, goede laag, goede kolom, ergens anders, nog niet geplaatst
 */
export function vergelijk(eigen, model) {
  const [a, b] = [cel(eigen), cel(model)];
  if (!a) return 'open';
  if (a === b) return 'goed';
  if (b && a.rij === b.rij) return 'laag';
  return b && a.kol === b.kol ? 'kolom' : 'anders';
}

/** De uitkomst van `vergelijk` in woorden, voor de lijst onder het modelbord. */
export const VERGELIJKING = Object.freeze({
  goed: 'zelfde cel',
  laag: 'goede laag, andere kolom',
  kolom: 'goede kolom, andere laag',
  anders: 'andere cel',
  open: 'nog niet geplaatst',
});

/** Het ingevulde bord in gewone zinnen, cel voor cel (tekstweergave naast de figuur, TG-4). */
export const tomTekst = (inhoud) => gevuldeCellen(inhoud).map((c) => `${c.label}: ${tekst(inhoud[c.veld])}`);
