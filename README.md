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

## Sitemap

`index.html`, `leerblok-1.html` … `leerblok-4.html`, `dossier.html`, `verificatie.html`, `docent.html`. Testhulpmiddel, niet gelinkt vanaf de index: `controlelab.html` (recordvalidatie, statusregel en de 27 combinaties uit blueprint §5).
