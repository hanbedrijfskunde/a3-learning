// De figuren van leerblok 3 (het VPC, het BMC en het TOM-model), als citaat met bronvermelding (ADR B84). Alleen geladen op een pagina
// waarvan de data ze gebruikt (`// gewicht-alleen: figurenlb3` in leerblok.js, PF-4); FIGUREN zegt na welke alinea ze staan.
import { h } from './dom.js';

/** De zes vakken van het VPC uit de figuur van Strategyzer, met de naam uit de stof van taak 6.1. */
const VPC_VAKKEN = [
  ['Klantprofiel (cirkel)', 'Customer Jobs', 'Klanttaken'], ['Klantprofiel (cirkel)', 'Pains', 'Pains'], ['Klantprofiel (cirkel)', 'Gains', 'Gains'],
  ['Waardekaart (vierkant)', 'Products and Services', 'Producten en diensten'], ['Waardekaart (vierkant)', 'Pain Relievers', 'Pain relievers'],
  ['Waardekaart (vierkant)', 'Gain Creators', 'Gain creators'],
];

/**
 * Figuur: het value proposition canvas van Strategyzer (z.d.-b), alleen het canvas zelf (zonder kop, QR-code en logo), als citaat
 * met bronvermelding (media/citaten.json, ADR B84 en B89). Lui geladen zoals het A3-vel (PF-4). Onder de figuur staat welk vak bij welke kant hoort.
 */
export function vpcFiguur({ met = (t) => t } = {}) {
  return h('figure', { class: 'a3-vel citaat' },
    h('img', {
      src: 'media/citaten/strategyzer-zd-value-proposition-canvas.webp', width: 1200, height: 616, loading: 'lazy', decoding: 'async',
      alt: 'Het value proposition canvas. Links een vierkant met een cadeau in het midden: de waardekaart, met de vakken Products and Services, Gain Creators en Pain Relievers. Rechts een cirkel met een hoofd in het midden: het klantprofiel, met de vakken Customer Jobs, Gains en Pains. Een lijn met twee pijlen verbindt het cadeau en het hoofd: daar moeten ze op elkaar passen.',
    }),
    h('figcaption', {},
      h('p', {}, 'Figuur: rechts het klantprofiel, links de waardekaart. Er is een fit als de waardekaart past bij het klantprofiel. Overgenomen uit ', met('(Strategyzer, z.d.-b)'), ', het officiële sjabloon, via ', h('a', { href: 'https://www.strategyzer.com/library/the-value-proposition-canvas' }, 'Strategyzer'), '. De licentie van deze site geldt niet voor deze figuur.'),
      h('details', { class: 'a3-koppeling' }, h('summary', {}, 'De vakken van het canvas in de stof'),
        h('table', {}, h('thead', {}, h('tr', {}, ['Kant', 'In de figuur', 'In de stof'].map((k) => h('th', { scope: 'col' }, k)))),
          h('tbody', {}, VPC_VAKKEN.map(([kant, en, nl]) => h('tr', {}, h('td', {}, kant), h('td', { lang: 'en' }, en), h('td', {}, nl))))))));
}

/** De negen bouwstenen van het BMC uit de figuur van Strategyzer, met de naam uit de stof en de velden van taak 7.1. */
const BMC_BOUWSTENEN = [
  ['Links: wat ervoor nodig is', 'Key Partnerships', 'Kernpartners'], ['Links: wat ervoor nodig is', 'Key Activities', 'Kernactiviteiten'],
  ['Links: wat ervoor nodig is', 'Key Resources', 'Kernmiddelen'], ['Midden', 'Value Propositions', 'Waardepropositie'],
  ['Rechts: de markt', 'Customer Relationships', 'Klantrelaties'], ['Rechts: de markt', 'Channels', 'Kanalen'],
  ['Rechts: de markt', 'Customer Segments', 'Klantsegmenten'], ['Onderaan: het geld', 'Cost Structure', 'Kostenstructuur'],
  ['Onderaan: het geld', 'Revenue Streams', 'Inkomstenstromen'],
];

/**
 * Figuur: het business model canvas van Strategyzer (z.d.-a), alleen het canvas zelf (zonder kop, QR-code en logo). Strategyzer geeft het
 * sjabloon uit onder CC BY-SA 3.0; de uitsnede staat met naamsvermelding in het register (media/citaten.json, ADR B84 en B92).
 * Lui geladen zoals het A3-vel (PF-4). Onder de figuur staat welke bouwsteen waar staat en hoe hij in de stof heet.
 */
export function bmcFiguur({ met = (t) => t } = {}) {
  return h('figure', { class: 'a3-vel citaat' },
    h('img', {
      src: 'media/citaten/strategyzer-zd-business-model-canvas.webp', width: 1200, height: 728, loading: 'lazy', decoding: 'async',
      alt: 'Het business model canvas: een rechthoek met negen vakken. Bovenaan vijf kolommen. Van links naar rechts: Key Partnerships; Key Activities boven Key Resources; Value Propositions in het midden; Customer Relationships boven Channels; Customer Segments. Onderaan twee brede vakken: links Cost Structure, rechts Revenue Streams. Elk vak heeft een pictogram, zoals een cadeau bij Value Propositions en een hoofd bij Customer Segments.',
    }),
    h('figcaption', {},
      h('p', {}, 'Figuur: in het midden de waardepropositie, rechts de markt, links wat nodig is om die markt te bedienen, onderaan kosten en inkomsten. Uit ', met('(Strategyzer, z.d.-a)'), ', het officiële sjabloon, via ', h('a', { href: 'https://www.strategyzer.com/library/the-business-model-canvas' }, 'Strategyzer'), '. Alleen het canvas is overgenomen. Licentie: ', h('a', { href: 'https://creativecommons.org/licenses/by-sa/3.0/' }, 'CC BY-SA 3.0'), '.'),
      h('details', { class: 'a3-koppeling' }, h('summary', {}, 'De bouwstenen van het canvas in de stof'),
        h('table', {}, h('thead', {}, h('tr', {}, ['Plek', 'In de figuur', 'In de stof'].map((k) => h('th', { scope: 'col' }, k)))),
          h('tbody', {}, BMC_BOUWSTENEN.map(([plek, en, nl]) => h('tr', {}, h('td', {}, plek), h('td', { lang: 'en' }, en), h('td', {}, nl))))))));
}

/** De lagen en kolommen van de TOM³-indeling (Westmoreland BV, z.d.), met eigen korte uitleg (geen zinnen uit het ongepubliceerde document, LI-3). */
const TOM_LAGEN = [['Strategisch', 'koers en lange termijn'], ['Tactisch', 'afspraken, processen en rollen'], ['Operationeel', 'het dagelijkse werk']];
const TOM_KOLOMMEN = [['Methode', 'hoe het werk loopt'], ['Mens', 'wie het doet en wat ze kunnen'], ['Machine', 'systemen en gegevens'], ['Informatie & Rapportage', 'cijfers om mee te sturen']];

/**
 * Figuur: eigen weergave van de TOM³-indeling naar Westmoreland BV (z.d.), in HTML en CSS zodat hij meeschaalt en de labels tekst blijven.
 * Drie lagen × vier kolommen; de vierde kolom verbindt de lagen: cijfers gaan omhoog, doelen gaan omlaag (ADR B93). Er is geen gepubliceerd
 * beeld van het model om te citeren; de licentie van de site geldt voor deze weergave.
 */
export function tomFiguur({ met = (t) => t } = {}) {
  const kop = ([naam, uitleg], extra = '') => h('div', { class: `tom-kop ${extra}`.trim() }, h('strong', {}, naam), h('span', {}, uitleg));
  return h('figure', { class: 'a3-vel tom-figuur' },
    h('div', {
      class: 'tom-raster', role: 'img',
      'aria-label': 'Het TOM-model als raster van drie lagen en vier kolommen. De lagen van boven naar beneden: strategisch (koers en lange termijn), tactisch (afspraken, processen en rollen) en operationeel (het dagelijkse werk). De kolommen: Methode (hoe het werk loopt), Mens (wie het doet en wat ze kunnen), Machine (systemen en gegevens) en Informatie & Rapportage (cijfers om mee te sturen). De vierde kolom is gekleurd en loopt door alle lagen. Een pijl omhoog: cijfers van de werkvloer gaan naar boven. Een pijl omlaag: doelen gaan naar beneden. Samen twaalf cellen.',
    },
      h('div', { class: 'tom-hoek' }),
      TOM_KOLOMMEN.map((k, i) => kop(k, i === 3 ? 'tom-ir' : '')),
      TOM_LAGEN.flatMap((laag, i) => [kop(laag, 'tom-laag'), ...[0, 1, 2].map(() => h('div', { class: 'tom-cel' })), h('div', { class: `tom-cel tom-ir tom-rij-${i + 2}` })]),
      h('div', { class: 'tom-lus', 'aria-hidden': 'true' },
        h('span', { class: 'tom-pijl' }, '▲', h('span', { class: 'tom-lijn' }), h('small', {}, 'cijfers')),
        h('span', { class: 'tom-pijl' }, h('small', {}, 'doelen'), h('span', { class: 'tom-lijn' }), '▼'))),
    h('figcaption', {},
      h('p', {}, 'Figuur: twaalf cellen. De vierde kolom verbindt de lagen: cijfers gaan omhoog, doelen gaan omlaag. Eigen weergave van de TOM³-indeling naar ', met('(Westmoreland BV, z.d.)'), '.')));
}

/** Na welke alinea van de stof een figuur staat (0 = de eerste). */
export const FIGUREN = { vpc: { bouw: vpcFiguur, na: 0 }, bmc: { bouw: bmcFiguur, na: 0 }, tom: { bouw: tomFiguur, na: 0 } };
