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

## Dossier, import en verificatie (fase 3)

**Export.** `dossier.html` bewaart het dossier als `bewijsdossier-<alias>-<datum>.json` (`js/dossier.js`, `maakDossier`):

```
{ "formaat": "a3-bewijsdossier", "schema": "1.0", "elearning", "geexporteerd", "alias", "teamnummer", "vraagstuk", "waaromZin", "voorlopig",
  "records": [ { "record": <nieuwste versie, schema 1.0>, "eerdereVersies": <aantal> } ],
  "controlesom": { "algoritme": "SHA-256", "waarde": <64 hex>, "over": "…" } }
```

De controlesom loopt over alle velden behalve `controlesom`, in canonieke vorm (gesorteerde sleutels, dus onafhankelijk van witruimte en volgorde). Ze laat zien dat een bestand na export is gewijzigd (`verificatie.html`: „gewijzigd na export”); ze is geen handtekening, want wie de som opnieuw uitrekent kan een bestand ongemerkt aanpassen. Oefeninvoer, klaar-markeringen en verdieping zitten niet in het dossier (TK-4).

**Import.** Schema 1.x tot en met de huidige versie wordt gelezen (`schemaAccepteerbaar`); een andere hoofdversie of een nieuwere minor geeft een melding. Een bestand met een verkeerde controlesom wordt pas ingelezen na „Toch importeren”. Bij een bestaand bewijsonderdeel wint het record met de laatste `bijgewerkt`; het profiel wordt alleen aangevuld waar het leeg is. `importeerDossier` schrijft het versienummer rechtstreeks terug in de recordlijst `a3l:rec:<id>` van `store.js`, omdat `store.save` altijd doortelt; de eerdere versies zelf zitten niet in het bestand en komen dus niet terug.

**Verificatie.** `verificatie.html` leest één of meer bestanden met `file.text()`, rekent de controlesom opnieuw uit en toont per student de 11 bewijsonderdelen en 3 leeruitkomsten, met de meeste ontbrekende onderdelen bovenaan. De pagina en `dossier.html` hebben een `Content-Security-Policy` met `connect-src 'self'`; er gaat geen dossierinhoud over het netwerk.

**Meldingen.** Na elk leerblok staat de bewaarmelding op het afsluitscherm; daarnaast toont elk leerblok na elke 10 wijzigingen (opgeslagen versies) „Bewaar je dossier”, tot de student exporteert of de melding wegklikt. Bij geblokkeerde opslag staat op de leerblokpagina's en op `dossier.html` een melding met een exportknop.

**Data en tests.** `data/luk.json` is de dekkingstabel van blueprint §4.3 (13 onderdelen, 11 bewijsonderdelen); `tools/content-check.mjs` controleert hem en legt hem naast de leerblokbestanden. Vijf testdossiers staan in `tests/fixtures/dossiers/` (opnieuw te maken met `node tests/fixtures/maak-dossiers.mjs`), de tests in `tests/dossier.test.mjs`. Bestanden: `js/dossier.js` (logica), `js/dossier-dom.js` (download, meldingen), `js/dossier-pagina.js`, `js/verificatie-pagina.js`.

## Sitemap

`index.html`, `leerblok-1.html` … `leerblok-4.html`, `dossier.html`, `verificatie.html`, `docent.html`. `dossier.html` toont Mijn stand, de dekking van de leeruitkomsten, export, afdrukbare pagina's en import; `verificatie.html` is voor de docent. Testhulpmiddel, niet gelinkt vanaf de index: `controlelab.html` (recordvalidatie, statusregel en de 27 combinaties uit blueprint §5).

## De Wissel (fase 4)

`js/wissel.js` (logica, geen DOM) en `js/wissel-paneel.js` (DOM). Klembordtekst is gewone tekst met een kopregel: `A3-WISSELBLOK` (onderzoeksvraag en zoekvragen, zonder alias) en `A3-FEEDBACK` (ik zie, ik mis, ik vraag me af). Ontvangen wisselblokken staan in meta `wissel:blokken` (nooit in een record); de feedbacklog en de teamactie staan in het bewijsrecord EV-09 (`inhoud: { regels: [{ id, richting, rol, zie, mis, vraag, actie, status, statusOp }], teamactie }`, taak 6.2 in `data/leerblok-4.json`). `maakSessie` accepteert `context: () => object` voor extra controlecontext (`wisselContext(store)` levert `wissel.ontvangen` en `eigen`). Een toepassing met `"component": "feedbacklog"` laat `leerblok.js` de Wissel tonen in plaats van gewone velden; `"wissel": { "zichtbaarNa": "EV-02", ... }` in `leerblok-1.json` toont de Wissel pas na de eerste versie van dat onderdeel (ST-7). `herinneringenUitStore(store, nu)` geeft de acties die ≥ 7 dagen dezelfde status hebben (WS-11); de klok is overal injecteerbaar.
