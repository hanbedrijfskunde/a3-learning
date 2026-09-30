# A3 e-learning (Praktijkopdracht 5, C-cluster)

Statische e-learning voor HBO Bedrijfskunde (HAN): vier leerblokken waarin studenten de A3 oefenen op het eigen vraagstuk en automatisch een bewijsdossier opbouwen. Geen backend: alles blijft in de browser van de student. Gepubliceerd op <https://hanbedrijfskunde.github.io/a3-learning/>.

Voor docenten: zie de **docentgids** (komt in `docent.html` en in dit bestand zodra fase 14 klaar is).

## Licentie

CC BY-SA 4.0, zie [LICENSE](LICENSE). Naamsvermelding: HAN Bedrijfskunde, C-cluster.

## Controles

```
node --test
node tools/content-check.mjs
node tools/link-check.mjs
```

De workflow `.github/workflows/pages.yml` draait deze drie bij elke push en publiceert alleen als alle drie slagen.

## Contract voor latere fasen (vastgelegd in fase 2)

**Contentformaat `data/leerblok-N.json`** (formaat `"1.0"`, gevalideerd door `tools/content-check.mjs`; een docent past teksten hier aan zonder code te bewerken, QA-1):

```
{ "formaat": "1.0", "leerblok": 1, "titel", "richttijd": 45, "eindigtMet", "oefencasus": "Webshop X",
  "taken": [ { "id": "2.1",                       // werkboeknummer
      "titel", "vorm": "Alleen" | "Team",
      "richttijd": { "tekst": "10 min", "minuten": 10, "bron": "werkboek" },
      "waarom":   { "tekst", "bron" },            // bron: werkboek | concept-auteur | draaiboek | lrd
      "klaarAls": { "tekst", "bron" },
      "stof":     { "bron", "alineas": [..], "format"? },
      "oefening": { "opdracht": { "tekst", "bron" }, "velden"? },   // zonder velden: dezelfde als toepassing.velden
      "modelantwoord": { "bron", "velden": { veldId: waarde } },    // pas zichtbaar na een eigen poging (TK-6)
      "toepassing": { "opdracht", "velden": [ { "id", "label", "type": "tekst|lang|lijst|keuze|meer", "opties"? } ], "livevoorbeeld"? },
      "controles": [ { "id", "soort": "A|B|C", "type": "<fabrieksnaam>", "veld"? | "velden"?, ...parameters } ],
      "bewijsonderdeel": "EV-01" | null, "luk": [1], "bc": ["BC1"] } ],
  "verdieping": { "tekst", "bron", "na": "2.2" },   // één per leerblok, zichtbaar na „klaar" van die taak
  "bewijsonderdelen": [ { "id": "EV-01", "taak": "2.1", "titel", "lukOnderdelen": [".."] } ] }
```

`data/leerblokken.json` bevat de startinvoer (velden, privacytekst) en de vier leerblokken voor `index.html` (richttijd, terugblik, afgerond bewijs, EV-id's). Een tekst met `"bron": "concept-auteur"` geeft een WAARSCHUWING in `content-check` (geen fout): de bouwer schreef hem en de auteur moet hem goedkeuren. Teksten met bron `werkboek` moeten letterlijk in `WK5/Werkboek_A3-start_week5.html` staan (`tests/werkboek.test.mjs`, overgeslagen als dat bestand niet naast deze map staat; ander pad via `WERKBOEK_PAD`).

**Controles.** Signatuur `(invoer, context) → { id, soort, resultaat, melding }`, met `context = { taak, records }`. Een controle in de data verwijst met `type` naar een fabriek in `js/checks/index.js` (`core.js` plus `lb1.js`; latere leerblokken voegen hun fabrieken daar toe). Staan `opties` bij het veld en geeft de controle geen `toegestaan`, dan zijn de opties de toegestane keuzes.

**Opslag `js/store.js`.** `maakStore(opslag)` met `save(record)` (valideert, zet `versie` op vorige + 1, bewaart alle versies), `get(id)`, `versions(id)` (oudste eerst), `ids()`, `clear()`; daarnaast `getMeta/setMeta/verwijderMeta` voor alles wat geen bewijs is (profiel, oefeninvoer, klaar, verdieping, volgende stap van het leerblok). `geheugenOpslag()` voor tests; `kiesOpslag()` valt terug op geheugen als de browser opslag blokkeert. Alle sleutels beginnen met `a3l:`.

**Logica zonder DOM:** `js/sessie.js` (beoordelen, bewaren, oefenen, klaar, verdieping, afsluiten), `js/weergave.js` (weergavemodellen), `js/afgerond.js` (TK-16), `js/profiel.js`. **DOM:** `js/dom.js` (`h`, `bouwVelden`, `maakWisAlles`), `js/leerblok.js` (pagina via `<body data-leerblok="N">`), `js/index-pagina.js`. Element-id's: `taak-<nr>`, `oefening-<nr>`, `uitkomst-<nr>`, `klaar-<nr>`, `afsluiten`; velden `oef-<nr>-<veld>` en `toe-<nr>-<veld>`.

## Sitemap

`index.html`, `leerblok-1.html` … `leerblok-4.html`, `dossier.html`, `verificatie.html`, `docent.html`. Testhulpmiddel, niet gelinkt vanaf de index: `controlelab.html` (recordvalidatie, statusregel en de 27 combinaties uit blueprint §5).
