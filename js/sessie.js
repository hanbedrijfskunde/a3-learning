// De leerblok-sessie: alles wat een leerblokpagina doet met controles, opslag en voortgang, zonder DOM (BW-1…BW-7,
// TK-4…TK-10, TK-14, RC-5, DS-1). De pagina (leerblok.js) roept dit aan en tekent het resultaat.
//
// Opslagindeling (zie store.js):
//   bewijsrecords   store.save(...)            alleen de toepassing van taken met een bewijsonderdeel (TK-4)
//   toepassing zonder bewijsonderdeel          meta `invoer:<taak>`
//   oefening                                   meta `oefening:<taak>`   { invoer, overgeslagen, pogingen }; nooit in een record
//   klaar                                      meta `klaar:<taak>`      { op }
//   verdieping                                 meta `verdieping:<leerblok>` { tekst, gedaan }; geen invloed op de status (TK-14)
//   volgende stap van het leerblok             meta `afsluiting:<leerblok>` { volgendeStap }
import { voerUit, tellers } from './checks/core.js';
import { bouwControles } from './checks/index.js';
import { bepaalStatus, STATUS_TEKST } from './status.js';
import { maakRecord } from './schema.js';
import { isIngevuld, oefenModel, bouwAfsluitModel } from './weergave.js';
import { leesProfiel } from './profiel.js';

/** BW-6: melding bij status Compleet. */
export const COMPLEET_MELDING = 'Aanwezig en consistent. Of het goed is, bespreek je met je coach.';

/** Leest de nieuwste records van de gegeven id's (id → record of undefined). */
export function leesRecords(store, ids) {
  return Object.fromEntries(ids.map((id) => [id, store.get(id)]));
}

const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** TK-10: een volgende stap is minstens één zin van drie woorden. */
export const volgendeStapOk = (tekst) => tellers.telWoorden(tekst) >= 3;

/**
 * @param {object} p
 * @param {ReturnType<import('./store.js').maakStore>} p.store
 * @param {object} p.blok inhoud van data/leerblok-N.json
 * @param {string} p.elearning versienummer uit data/config.json
 * @param {() => Date} [p.nu]
 * @param {() => object} [p.context] extra context voor de controles (bijvoorbeeld de Wissel, fase 4); `taak` en `records` gaan voor
 */
export function maakSessie({ store, blok, elearning, nu = () => new Date(), context = () => ({}) }) {
  const taken = new Map(blok.taken.map((t) => [t.id, t]));
  const bewijs = new Map(blok.bewijsonderdelen.map((b) => [b.taak, b]));
  const taak = (id) => {
    const t = taken.get(id);
    if (!t) throw new Error(`Onbekende taak ${id}`);
    return t;
  };
  const controlesVan = new Map();
  const controles = (t) => {
    if (!controlesVan.has(t.id)) controlesVan.set(t.id, bouwControles(t.controles, t.toepassing.velden));
    return controlesVan.get(t.id);
  };
  const toegestaneSleutels = (t) => new Set([...t.toepassing.velden.map((v) => v.id), 'volgendeStap']);
  /** Alleen de velden van de toepassing (en de volgende stap) gaan de inhoud in; niets anders (TK-4, RC-3). */
  const schoon = (t, inhoud) => Object.fromEntries(Object.entries(inhoud ?? {}).filter(([k]) => toegestaneSleutels(t).has(k)));

  const leesToepassing = (taakId) => {
    const ev = bewijs.get(taakId);
    return ev ? (store.get(ev.id)?.inhoud ?? {}) : (store.getMeta(`invoer:${taakId}`) ?? {});
  };

  /** Voert de controles uit op de invoer en leidt de status af (BW-1, BW-2, BW-5, BW-6, BW-7). Schrijft niets weg. */
  function beoordeel(taakId, inhoud) {
    const t = taak(taakId);
    const records = Object.fromEntries([...bewijs.values()].map((b) => [b.id, store.get(b.id)]));
    const uitkomsten = voerUit(controles(t), inhoud ?? {}, { ...context(), taak: t, records });
    const status = bepaalStatus(uitkomsten);
    return {
      uitkomsten,
      status,
      statusTekst: STATUS_TEKST[status],
      heeftBewijs: Boolean(t.bewijsonderdeel),
      ontbreekt: uitkomsten.filter((u) => u.resultaat !== 'ok').map(({ id, soort, resultaat, melding }) => ({ id, soort, resultaat, melding })),
      compleetMelding: status === 'compleet' ? COMPLEET_MELDING : null,
      modelLink: status === 'nog niet' && t.modelantwoord ? `#oefening-${t.id}` : null,
      klaarMogelijk: status !== 'nog niet',
    };
  }

  /** Slaat de toepassing op. Alleen bij een verandering komt er een nieuwe versie (RC-5). */
  function bewaar(taakId, inhoud) {
    const t = taak(taakId);
    const schoonInhoud = schoon(t, inhoud);
    const ev = bewijs.get(taakId);
    if (!ev) {
      store.setMeta(`invoer:${taakId}`, schoonInhoud);
      return { opgeslagen: true, record: null };
    }
    const vorig = store.get(ev.id);
    if (!vorig && !isIngevuld(schoonInhoud)) return { opgeslagen: false, record: null };
    const b = beoordeel(taakId, schoonInhoud);
    const voorlopig = leesProfiel(store).voorlopig;
    if (vorig && gelijk(vorig.inhoud, schoonInhoud) && vorig.status === b.status && vorig.voorlopig === voorlopig
        && gelijk(vorig.controles, b.uitkomsten.map(({ id, resultaat }) => ({ id, resultaat })))) {
      return { opgeslagen: false, record: vorig };
    }
    const record = store.save(maakRecord({
      taakdef: { id: ev.id, taak: t.id, leerblok: blok.leerblok, luk: t.luk, bc: t.bc },
      inhoud: schoonInhoud,
      controles: b.uitkomsten,
      status: b.status,
      versie: 1,
      bijgewerkt: nu().toISOString(),
      elearning,
      voorlopig,
    }));
    return { opgeslagen: true, record };
  }

  // ---- oefenversie (TK-3…TK-7): nooit een record, altijd herhaalbaar

  const leesOefening = (taakId) => ({ invoer: {}, overgeslagen: false, pogingen: 0, ...(store.getMeta(`oefening:${taakId}`) ?? {}) });
  const bewaarOefening = (taakId, staat) => store.setMeta(`oefening:${taakId}`, staat);

  function zetOefening(taakId, invoer) {
    const t = taak(taakId);
    const staat = { ...leesOefening(taakId), invoer: { ...invoer } };
    bewaarOefening(taakId, staat);
    return oefenModel(t, staat);
  }
  function herhaalOefening(taakId) {
    const staat = leesOefening(taakId);
    const nieuw = { invoer: {}, overgeslagen: false, pogingen: staat.pogingen + 1 };
    bewaarOefening(taakId, nieuw);
    return oefenModel(taak(taakId), nieuw);
  }
  /** „Ik ken dit al" (TK-5): één klik, geen enkele wijziging in records of status. */
  function zetOverslaan(taakId, overgeslagen) {
    const staat = { ...leesOefening(taakId), overgeslagen: Boolean(overgeslagen) };
    bewaarOefening(taakId, staat);
    return oefenModel(taak(taakId), staat);
  }
  const oefening = (taakId) => oefenModel(taak(taakId), leesOefening(taakId));

  // ---- klaar (TK-8, TK-9)

  const isKlaar = (taakId) => Boolean(store.getMeta(`klaar:${taakId}`)?.op);
  /**
   * Zet de taak op „klaar" zodra de „klaar als"-regel is gehaald (geen controle van soort A of B staat op `mist`).
   * De klok speelt hier bewust geen rol: klaar kan bij 10 % van de richttijd en bij 150 % (TK-8, TK-9).
   */
  function markeerKlaar(taakId) {
    if (!beoordeel(taakId, leesToepassing(taakId)).klaarMogelijk) return false;
    store.setMeta(`klaar:${taakId}`, { op: nu().toISOString() });
    return true;
  }

  // ---- verdieping (TK-13, TK-14): buiten records en status

  const leesVerdieping = () => ({ tekst: '', gedaan: false, ...(store.getMeta(`verdieping:${blok.leerblok}`) ?? {}) });
  function zetVerdieping(deel) {
    const nieuw = { ...leesVerdieping(), ...deel };
    store.setMeta(`verdieping:${blok.leerblok}`, nieuw);
    return nieuw;
  }

  // ---- afsluiten (TK-15…TK-17)

  const evIds = blok.bewijsonderdelen.map((b) => b.id);
  const leesVolgendeStap = () => store.getMeta(`afsluiting:${blok.leerblok}`)?.volgendeStap ?? '';
  const bewaarVolgendeStap = (tekst) => store.setMeta(`afsluiting:${blok.leerblok}`, { volgendeStap: String(tekst ?? '') });
  const afsluitModel = (volgende) => ({ ...bouwAfsluitModel(blok, leesRecords(store, evIds), volgende), volgendeStap: leesVolgendeStap() });

  return {
    taak, leesToepassing, beoordeel, bewaar,
    oefening, zetOefening, herhaalOefening, zetOverslaan,
    isKlaar, markeerKlaar,
    leesVerdieping, zetVerdieping,
    leesVolgendeStap, bewaarVolgendeStap, afsluitModel,
  };
}
