// Klok van de docentmodus (DM-4, DM-5, DM-6, DM-9). Geen DOM. De tijdbron is injecteerbaar (`nu` geeft milliseconden),
// zodat tests de tijd kunnen sturen. De klok telt verschillen tussen tijdstippen, niet ticks: gemiste of vertraagde
// timers geven dus geen afwijking. Tijden zijn richttijden: niets in deze module blokkeert een docent (DM-5).
const MIN = 60000;

/**
 * @param {object} o
 * @param {{id: string, minuten: number}[]} o.onderdelen in de volgorde van het draaiboek
 * @param {number} [o.duurMinuten] duur van het deel, voor de marge
 * @param {() => number} [o.nu] tijdbron in milliseconden
 */
export function maakKlok({ onderdelen, duurMinuten = 0, nu = () => Date.now() }) {
  const begin = () => onderdelen.map((o) => ({ id: o.id, minuten: o.minuten, status: 'gepland' }));
  let plan = begin();
  let staat = 'stil'; // 'stil' | 'loopt' | 'pauze'
  let opgebouwd = 0; // ms verstreken vóór het laatste start of hervatten
  let sinds = 0; // nu() bij het laatste start of hervatten
  let actiefId = null;
  let onderdeelStart = 0; // klokstand (ms) waarop het actieve onderdeel begon

  const verstreken = () => opgebouwd + (staat === 'loopt' ? nu() - sinds : 0);
  const zoek = (id) => plan.find((p) => p.id === id);
  const activeerVolgende = () => {
    const volgend = plan.find((p) => p.status === 'gepland');
    actiefId = volgend ? volgend.id : null;
    onderdeelStart = verstreken();
  };

  return {
    /** Start de klok, of hervat na een pauze. Het eerste onderdeel wordt actief. */
    start() {
      if (staat === 'loopt') return;
      if (staat === 'stil' && actiefId === null) activeerVolgende();
      sinds = nu();
      staat = 'loopt';
    },
    pauze() {
      if (staat !== 'loopt') return;
      opgebouwd += nu() - sinds;
      staat = 'pauze';
    },
    /** Alles terug naar 0:00, de volgorde en de tijden van het draaiboek. */
    reset() {
      plan = begin(); staat = 'stil'; opgebouwd = 0; sinds = 0; actiefId = null; onderdeelStart = 0;
    },
    /** Rondt het actieve onderdeel af en start het volgende. */
    volgende() {
      if (staat === 'stil' || actiefId === null) return;
      zoek(actiefId).status = 'gedaan';
      activeerVolgende();
    },
    /** Slaat een onderdeel over; het telt niet meer mee in de resterende tijd (DM-9). */
    overslaan(id) {
      const p = zoek(id);
      if (!p || (p.status !== 'gepland' && id !== actiefId)) return false;
      p.status = 'overgeslagen';
      if (id === actiefId) activeerVolgende();
      return true;
    },
    /** Verschuift een gepland onderdeel één plek (richting -1 eerder, +1 later) tussen de geplande onderdelen. */
    verschuif(id, richting) {
      const geplande = plan.filter((p) => p.status === 'gepland' && p.id !== actiefId);
      const i = geplande.findIndex((p) => p.id === id);
      const j = i + (richting < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= geplande.length) return false;
      const a = plan.indexOf(geplande[i]); const b = plan.indexOf(geplande[j]);
      [plan[a], plan[b]] = [plan[b], plan[a]];
      return true;
    },
    /** Zet de tijd van een onderdeel die nog niet klaar is (ook het actieve). */
    pasAan(id, minuten) {
      const p = zoek(id);
      if (!p || !(minuten > 0) || !Number.isFinite(minuten) || (p.status !== 'gepland' && id !== actiefId)) return false;
      p.minuten = minuten;
      return true;
    },
    /** Alles wat een scherm nodig heeft, op dit moment. Tijden in milliseconden. */
    toestand() {
      const v = verstreken();
      const lijst = plan.map((p) => {
        const actief = p.id === actiefId && p.status === 'gepland';
        const resterend = actief ? p.minuten * MIN - (v - onderdeelStart) : p.minuten * MIN;
        return { id: p.id, minuten: p.minuten, status: p.status, actief, resterend, overschreden: actief && resterend < 0 };
      });
      const telt = lijst.filter((p) => p.status === 'gepland');
      const resterend = telt.reduce((som, p) => som + (p.actief ? Math.max(0, p.resterend) : p.minuten * MIN), 0);
      const actief = lijst.find((p) => p.actief) ?? null;
      return {
        staat, verstreken: v, actiefId, actief, onderdelen: lijst, resterend,
        actiefVerstreken: actief ? v - onderdeelStart : 0,
        klaar: staat !== 'stil' && actief === null,
        // positief: ruimte over ten opzichte van de duur van het deel; negatief: het deel loopt uit
        marge: duurMinuten ? duurMinuten * MIN - (v + resterend) : null,
      };
    },
    /** Alles wat nodig is om de klok na het herladen van de pagina voort te zetten. */
    exporteer: () => ({ plan: plan.map((p) => ({ ...p })), staat, opgebouwd, sinds, actiefId, onderdeelStart }),
    herstel(s) {
      const ids = new Set(onderdelen.map((o) => o.id));
      if (!s || !Array.isArray(s.plan) || s.plan.length !== ids.size || !s.plan.every((p) => ids.has(p.id))) return false;
      plan = s.plan.map((p) => ({ id: p.id, minuten: p.minuten, status: p.status }));
      staat = s.staat; opgebouwd = s.opgebouwd; sinds = s.sinds; actiefId = s.actiefId; onderdeelStart = s.onderdeelStart;
      return true;
    },
  };
}

/** Klokvorm: 0:05 of 1:25:07 (uren alleen als nodig). Negatieve tijd krijgt een min. */
export function klokTekst(ms) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const [u, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const tail = String(sec).padStart(2, '0');
  return `${neg ? '−' : ''}${u ? `${u}:${String(m).padStart(2, '0')}` : m}:${tail}`;
}

/** De fasen van een gallery walk: twee rondes van 4 minuten en 2 minuten lezen (DM-6). */
export function rondeFasen({ rondes = 2, minutenPerRonde = 4, lezenMinuten = 2 } = {}) {
  return [
    ...Array.from({ length: rondes }, (_, i) => ({ naam: `Ronde ${i + 1}`, minuten: minutenPerRonde })),
    { naam: 'Lezen bij de eigen muur', minuten: lezenMinuten },
  ];
}

/** Waar de gallery walk staat na `ms` milliseconden: de fase en wat daarvan resteert. Na de laatste fase: klaar. */
export function rondeFase(fasen, ms) {
  let grens = 0;
  for (let i = 0; i < fasen.length; i++) {
    grens += fasen[i].minuten * MIN;
    if (ms < grens) return { index: i, naam: fasen[i].naam, resterend: grens - ms, klaar: false };
  }
  return { index: fasen.length - 1, naam: fasen[fasen.length - 1].naam, resterend: 0, klaar: true };
}
