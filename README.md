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

Losse controles die ook in `node --test` zitten: `node tools/contrast-check.mjs` (TG-3: tekstparen uit `css/site.css` en de `<style>`-blokken, minimaal 4,5:1) en `node tools/gewicht-check.mjs` (PF-4: de eerste lading per pagina, en 0 verwijzingen naar een ander domein). Sinds fase 11 (ADR B69) zijn er twee grenzen: 300 kB gecomprimeerd (gzip per bestand, zoals GitHub Pages levert) en 400 kB ongecomprimeerd. Het telt alle modules en databestanden die die pagina laadt; dynamische imports tellen alleen mee voor pagina's die ze echt laden (zie hieronder).

## Huisstijl, toegankelijkheid en offline (fase 8)

`css/site.css` begint met de tokens uit de zusterdocumenten (accent `#E50056`, zwart, wit, grijs, lettertypestapel Avenir Next met systeemlettertypen); buiten `:root` staan geen kleurcodes (`tests/toegankelijk.test.mjs`). Elke pagina heeft een sprongkoppeling „Naar de inhoud”, `header`, `nav`, `main` en `footer`. Statussen zijn tekst met kleur erbij (Compleet, Bijna, Nog niet). Offline: geen service worker; alles wordt bij het laden binnengehaald en daarna werkt de pagina lokaal (ADR B66).

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

## Terugblik en tussenpozen (fase 7)

`js/terugblik.js` (logica, geen DOM, injecteerbare klok) en `js/terugblik-pagina.js` (DOM, het scherm „Vorige keer”). `leerblok.js` toont het scherm bij leerblok 2 en hoger. Inhoud in `data/terugblik.json` (formaat 1.0: `bandbreedtes` met minuten, `kaarten` per leerblok 2, 3, 4 met `items`, twee `kennisvragen`, `transfervraag`, `samenvatting`); `tools/content-check.mjs` controleert dat (`controleerTerugblik`).

**Pauze en bandbreedte.** `pauzeInDagen(records, { leerblok, nu })` = nu min de laatste `bijgewerkt` van de records van het vorige leerblok (anders van een eerder leerblok; zonder werk `null`). `bandbreedte(dagen)`: < 2 uur `kort`, < 2 dagen `middel`, < 14 dagen `volledig`, daarna `lang`; een grens hoort bij de hogere band, `null` geeft `volledig` (ADR B65). **Opslag:** invoer in meta `terugblik:<leerblok>`, log in meta `terugblik:log` (`[{ leerblok, pauzeDagen, status: 'gedaan'|'overgeslagen' }]`); nooit een bewijsrecord (TP-5). Het log staat als `terugblik` in de export van het dossier (schema blijft 1.0; optioneel veld) en wordt bij import aangevuld waar de opslag niets heeft. `dossierControle` geeft `{ aanwezig, ontbrekend, importAanbod }`. Het aanbevolen week en dag per leerblok staat in `data/leerblokken.json` (`aanbevolen: { week, dag }`), alleen als tekst.

`dossier.js` exporteert daarnaast `bouwFeedbackOverzicht(record)` (EV-09 gesplitst in individueel, post-its van andere teams en teamactie) voor `dossier.html`; `weergave.js` exporteert `waardeTekst`.

## Docentmodus, deel 1 (fase 9)

`docent.html?modus=docent` (of de knop „Ik ben docent” op `docent.html`); geen account, niets van studenten bewaard (PR-3) en geen verbindingen (PR-4: CSP `connect-src 'self'`, geen WebSocket of BroadcastChannel; `tests/docent.test.mjs` controleert dat statisch). Bestanden: `js/docent/klok.js` (klok, herberekening, gallery-walkfasen; geen DOM, tijdbron `nu` injecteerbaar), `js/docent/kaarten.js` (stapkaart, docentkaart, programma, draaiboek, terugblik-kaarten; geen DOM), `js/docent/kies.js` (modus uit het adres), `js/docent/pagina.js` (DOM), `css/docent.css`. Bewaard wordt alleen `a3d:begintijden` (localStorage, rooster) en `a3d:klok:<deel>` (sessionStorage, zodat herladen de klok niet wist). De data laadt pas na de keuze: `docent-deel1.json`, de `leerblok-N.json` die de onderdelen noemen, en `terugblik.json`.

**Formaat `data/docent-deel1.json`** (formaat `"1.0"`, gevalideerd door `controleerDocent` in `tools/content-check.mjs`; `docent-deel2.json` in fase 10 gebruikt hetzelfde formaat en wordt in `DELEN` in `pagina.js` aangemeld):

```
{ "formaat": "1.0", "deel": 1, "titel", "duurMinuten": 90, "afsluiting", "bron",
  "onderdelen": [ { "id": "d1-01", "titel", "minuten": 5,       // som van de minuten = duurMinuten
      "soort"?: "pauze",                                          // een pauze heeft alleen id, titel en minuten
      "taak": "2.1" | null, "leerblok": 1 | null,                 // met taak: klaar-als en modelantwoord komen uit leerblok-N.json (DM-2)
      "opdracht": { "tekst", "bron" },                            // kort, projecteerbaar
      "klaarAls"?: { "tekst", "bron" },                           // alleen zonder taak
      "materiaal": [..], "laptop": "open" | "dicht", "dia": "17 (vóór 16)" | null,
      "watDocentDoet", "kernboodschap", "rondloopvragen": [..], "alsHetAndersLoopt": [..],   // docentkaart (DM-7)
      "veelgemaakteFouten": [..],                                 // verborgen tot de docent ze opent, net als het modelantwoord (DM-8)
      "ronde"?: { "rondes": 2, "minutenPerRonde": 4, "lezenMinuten": 2 },   // gallery walk (DM-6)
      "bron": "draaiboek" | "concept-auteur" | "lrd" | "werkboek" } ] }
```

Een onderdeel met taak heeft minstens één rondloopvraag. Elke tekst die op een beoordeling of toetsantwoord lijkt (`DOCENT_VERBODEN` in `content-check`) faalt (DM-17). Klok: `maakKlok({ onderdelen, duurMinuten, nu })` met `start`, `pauze`, `reset`, `volgende`, `overslaan(id)`, `verschuif(id, ±1)`, `pasAan(id, minuten)`, `toestand()`, `exporteer()`/`herstel()`. `resterend` is de som van de nog te doen onderdelen (het actieve telt nooit negatief); `marge` is de duur van het deel min verstreken min resterend. Stapkaart: alle tekst 28 px of groter bij 1280 × 720 (`tests/docent.test.mjs`, contrast in `tools/contrast-check.mjs`, dat nu ook `css/docent.css` leest).

## Leerblok 3 en docentmodus deel 2 (fase 10)

`data/leerblok-3.json` (taken 5.1, 6.1, 7.1, 8.1, 9.1, 9.2). Bewijs: EV-06 op 5.1, EV-07 op 8.1 (register van feit en aanname, TOM-model), EV-08 op 9.2 (de conclusies van 9.1 zitten er via `afgeleidVan` in). Een record hoort bij één taak, dus 6.1, 7.1 en 9.1 zijn taken zonder eigen bewijsonderdeel.

**Herhaalde velden (`js/blok.js`).** Een lijst `velden` mag `{ "reeks": { "voor": "s", "aantal": 7, "velden": [ { "suffix": "naam", "label": "Stakeholder {n}", "type": "tekst" } ] } }` bevatten; `expandeerVelden` / `normaliseerBlok` schrijft dat uit tot s1naam, s2naam, … Alles wat velden uit een leerblokbestand leest roept het aan (`leerblok.js`, `veldLabels` in `dossier.js`, `docent/kaarten.js`, `content-check`). Reden: PF-4.

**Weergavegroepen** (bovenop die van leerblok 2): `raster: { voor, aantal }` (invloed/belang-raster met tekstweergave, `js/raster.js` en `js/lb3-ui.js`), `zoekvragenHint` (toont de zoekvragen uit EV-02), `tabel.reeks: { voor, aantal, suffixen }`, `hint` bij `afgeleidVan`.

**Controles** (`js/checks/lb3.js`; parameters `voor` en `aantal` of `rijen`): `stakeholdersAantal`, `internEnExtern`, `stakeholderVelden`, `gebruikerInLijst` (EV-01 → EV-06, via `context.eigen`), `beweringenGelabeld`, `feitMetHerkomst`, `aannameMetZoekvraag` (EV-07 → EV-02, via `context.eigen`), `minGevuld`, `hardstBinnenGeraakt`, `noemtStakeholder` (EV-08 → EV-06, via `context.records`), `alleAangevinkt`. De naamvergelijking is een heuristiek: de helft van de woorden (stammen) van de kortste naam moet terugkomen.

**Docentmodus deel 2.** `data/docent-deel2.json` (8 onderdelen, 3 pauzes, 145 min), aangemeld in `DELEN`; `content-check` controleert 8 + 3 en samen met deel 1 19 onderdelen (DM-18).

**LI-3.** `node tools/overlap-check.mjs [bronbestand …]` zoekt reeksen van 8 woorden of meer die in de contentbestanden en in een bron uit `lits/` staan (standaard het TOM³-buildplan); de test slaat over zonder `lits/`.

**Gewicht (PF-4).** `leerblok.js` laadt `wissel-paneel.js` dynamisch, alleen bij leerblok 1 en 4 (`// gewicht-alleen: wissel`, gelezen door `tools/gewicht-check.mjs`), en de gewichtscontrole telt van `terugblik-pagina.js` alleen het vorige leerblok (`${vorig}`). Leerblok 3 weegt 297,7 kB van 300 kB: nieuwe code of data op de leerblokpagina's past er niet meer bij zonder een structurele ingreep (bijvoorbeeld de controlefabrieken per leerblok laden).

## Leerblok 4 en per leerblok laden (fase 11)

**Per leerblok laden (PF-4, ADR B69).** `js/checks/register.js` bevat alleen de kernfabrieken en `laadControles([leerblok, wisselleerblok])`, dat de modules `checks/lbN.js` uit `MODULES_PER_LEERBLOK` (leerblok 2 en 3 gebruiken ook lb1) dynamisch laadt. `checks/index.js` laadt alles en is voor tests en tools. In `leerblok.js` komen de Wissel (`// gewicht-alleen: wissel`), de weergavegroepen van leerblok 2 en 3 (`weergave`) en de schermen van leerblok 4 (`lb4ui`, `js/lb4-ui.js`) alleen binnen als de data van dat leerblok ze nodig heeft; `tools/gewicht-check.mjs` leest dezelfde voorwaarden en het sjabloon `import(`./lb${n}.js`)`. Een test vergelijkt elke controle in de data met wat de pagina laadt. `js/context.js` (wisselblokken en eigen records EV-01, 02, 06, 07, 11 voor controles van soort B) is los van `wissel.js`.

**Taak 9.4 (EV-11), taak 6.3 (EV-10).** `data/leerblok-4.json` heeft de taken 9.4, 6.2 en 6.3. Twee nieuwe toepassingscomponenten naast `feedbacklog`: `"component": "verbanden"` (kaart, markering van de kapitalen, synthese; bij de oefening ook `oefening.component` met `modelNa: "lijn"`, `oefening.kaarten` { us, vpc, gekozen, stakeholders } en `modelantwoord.verbanden`) en `"starr"`. `afsluiting.a3Zin` in het leerblokbestand is de zin „wat ik hiermee aan mijn A3 heb” (TK-11). Recordinhoud EV-11: `verbanden` [{ id, van, naar, vanTekst, naarTekst, type, zin, stakeholder?, vpcOnderdeel? }] (kaart-id's `us:gebruiker`, `vpc:b2`, `kap:financieel`), `markering` [{ kapitaal, waarde }], `synthese`, `syntheseKaarten` [{ id, tekst }] en `nietZien1…3`. Logica in `js/verbanden.js` (kaarten, verbanden, open plekken als vraag, markering) en `js/verbandregel.js`; het scherm in `js/lb4-ui.js` (elke kaart een knop, tekstweergave van alle verbanden, lijnen als inline SVG; geen afbeeldingen van Strategyzer of het IIRC, LI-2). Controles in `js/checks/lb4.js`; samenhang EV-11 → EV-01 en EV-11 → EV-06 via `context.eigen`.

**Dossier.** Nieuwe optionele velden in de export (schema blijft 1.0): `a3Zin`, `a3Kopieerlog` (datums van „kopieer naar A3 vak 1”, `js/a3log.js`) en `verdiepingGedaan` (alleen leerblokken, nooit de tekst). `js/a3tekst.js` bouwt het tekstblok (onderzoeksvraag, zoekvragen, plaatsing, waarom, plus verbanden). Het wisselblok bevat regels `Verband n: …` (WS-2). „Opnieuw doen” (`sessie.opnieuwDoen`, ST-4) zet meta `opnieuw`; het dossier toont oude en nieuwe versie naast elkaar (ST-5, alleen lokaal: de export bevat alleen de nieuwste versie).

## Media: routes, video's en spellen (fase 12)

**Formaat `media` in `data/leerblok-2.json` en `-4.json`** (gecontroleerd door `controleerMedia` in `tools/content-check.mjs`): `{ "taak": "4.1", "uitleg": { titel, bron, alineas[], voorbeeld, modelantwoord: { taak, velden: [veldId…] } }, "video": { id, titel, concept, bron, bestand, ondertitels, dias: [{ titel, punten[], spreektekst, pauzeNa? }] }, "spel": { id, titel, bestand, minuten } }`. De uitleg (alinea's, voorbeeld en modelantwoord samen) heeft hoogstens 300 woorden (MD-3); het modelantwoord komt uit `taak.modelantwoord.velden`, er is dus één bron. Het transcript is de `spreektekst` van de dia's en moet het voorbeeld, het modelantwoord, de „klaar als” en de eerste zin van elke alinea letterlijk bevatten: video en uitleg horen bij elkaar. `kijktips` in `data/leerblok-1.json`: twee gewone links (`url`, `verwijzing`, `duur`, `taal`), nooit een iframe (MD-14, MD-16). In `data/docent-deel*.json` start `"media": { "leerblok": N }` op een onderdeel video en spel vanaf de stapkaart (DM-13; d1-10 en d2-10).

**Routes (`js/media.js`).** Tekst is de standaard; drie knoppen (Tekst, Video, Spel); de keuze staat in meta `media:route:<leerblok>` (nooit een bewijsrecord). Elke route toont dezelfde „klaar als” en linkt naar de oefening van de taak. `leerblok.js` laadt `media.js` alleen bij een leerblok met `media` of `kijktips` (`// gewicht-alleen: media`). Het modelantwoord in de tekstroute verschijnt pas na een eigen poging (gebeurtenis `a3-oefening`, TK-6).

**Video (MD-5, MD-6, MD-7).** Geen `<video>` in een pagina en geen verzoek naar een videobestand vóór de klik: het element (`preload="none"`, geen autoplay, `<track>` met WebVTT) wordt in de klikfunctie gemaakt; transcript als tekst op de pagina. De video's zijn eerlijk gemarkeerd als conceptvideo (computerstem, tekstdia's). Bouw ze opnieuw met `node tools/maak-video.mjs [V2|V4]` (macOS: `say`, `ffmpeg`, Chrome; zie de kop van het script). Het schrijft `media/*.mp4`, `media/*.vtt` en `media/metadata.json` (duur en grootte; `tests/media.test.mjs` legt die naast ffprobe). De docent kan later een eigen opname met dezelfde bestandsnaam en bijpassende ondertitels neerzetten (ADR B70).

**Spellen (`js/spel-model.js`, `js/spel.js`, `spellen/*.json`).** Logica en scherm zijn gescheiden; geen van beide importeert of gebruikt de opslag of het netwerk (MD-11, MD-13; `tests/media.test.mjs` controleert dat). Een spel wordt pas na de klik geladen. Geen score of ranglijst; feedback per keuze; tekstversie in een `<details>`; alles verzonnen is `fictief: true` en zichtbaar „Fictief” (MD-15). Bronnen-detective: zes kaarten, drie opties per kaart, daarna het AAOCC-oordeel. Waarde-simulator: drie beslissingen, per beslissing kiezen, voorspellen (lange termijn, per kapitaal) en het effect op korte, middellange en lange termijn zien.
