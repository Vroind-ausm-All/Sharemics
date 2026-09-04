# Sharemics

Website für ein Keramiklabel aus Leipzig-Plagwitz: Shop, Wochenendkurse mit
Terminkalender, Journal und Werkstattseiten.

Statisch erzeugt, ohne Framework und ohne eine einzige Abhängigkeit. Was am Ende
ausgeliefert wird, sind HTML-Dateien, ein Stylesheet, eine JavaScript-Datei und
ein paar Kilobyte SVG.

---

## Loslegen

```bash
node build.mjs            # baut nach dist/
node build.mjs --watch    # baut bei jeder Änderung in src/ neu
npx serve dist            # oder: python3 -m http.server -d dist 8000
node preview.mjs          # packt alles in sharemics-vorschau.html
```

`sharemics-vorschau.html` enthält die komplette Seite in einer einzigen Datei —
zum Doppelklicken, Verschicken oder Herumzeigen, ohne dass ein Server läuft.
Maßgeblich für den Betrieb bleibt `dist/`: dort liegen die Seiten einzeln, mit
eigenen URLs, eigenen Metadaten und eigener Sitemap.

Node 18 oder neuer genügt; `npm install` ist nicht nötig, weil es keine
Abhängigkeiten gibt.

## Aufbau

```
build.mjs                 Seitengenerator (~300 Zeilen, Node-Standardbibliothek)
tools/ornaments.py        erzeugt die vier griechischen Zierborten als SVG
src/
  data/                   Inhalte als JSON — hier wird gepflegt
    site.json             Kontakt, Navigation, Werte, Stimmen, Prozess
    products.json         Shop-Artikel
    courses.json          Kursformate und Termine
    journal.json          Journal-Übersicht
  layouts/base.html       Rahmen: <head>, Warenkorb, Dialog, Toast
  pages/*.html            je eine Seite, beginnend mit einem meta-Block
  assets/css/style.css    Design-System
  assets/js/app.js        Warenkorb, Kalender, Dialoge, Theme
  assets/img/             Ornamente, Gefäß-Illustrationen, Favicon
dist/                     Ergebnis des Builds (eingecheckt, damit Pages es findet)
```

### Eine Seite anlegen

Eine neue Datei in `src/pages/` beginnt mit einem `meta`-Kommentar und enthält
danach nur den Seiteninhalt — Kopf, Fuß, Warenkorb und Dialog kommen aus dem
Layout:

```html
<!-- meta
{ "title": "Gutscheine", "slug": "gutscheine", "nav": "", "priority": 0.5,
  "description": "Kursgutscheine für die Werkstatt." }
-->
<section class="page-header">…</section>
```

Verfügbare Platzhalter im Seiteninhalt: `{{ productsAll }}`,
`{{ productsFeatured }}`, `{{ courseCards }}`, `{{ courseIncludes }}`,
`{{ journalCards }}`, `{{ testimonials }}`, `{{ processSteps }}`,
`{{ valueCards }}`, `{{ contact.email }}` sowie `{{ svg_becher }}` und die
übrigen Gefäße.

### Inhalte pflegen

Produkte, Kurstermine und Journalbeiträge stehen ausschließlich in
`src/data/*.json`. Ein neues Produkt braucht `id`, `name`, `category`,
`vessel` (Dateiname unter `assets/img/vessels/`), `tone`, `meta`, `price`,
`stock` und `story` — danach erscheint es im Shop, in der Sortierung, im
strukturierten Datensatz und im Warenkorb.

## Gestaltung

**Farbe.** Zwei vollständige Paletten, „Sonnenaufgang" (hell) und „Abendbrand"
(dunkel), als CSS-Variablen unter `:root` bzw. `:root[data-theme="dark"]`. Die
Startansicht folgt `prefers-color-scheme`; die Auswahl über den Schalter im Kopf
bleibt gespeichert. Ein Inline-Skript im `<head>` setzt das Theme vor dem ersten
Frame, damit nichts aufblitzt.

**Ornamente.** Die vier Borten — Mäander, Anthemion, laufende Welle und
vitruvianische Welle — werden von `tools/ornaments.py` erzeugt: der Mäander als
exakte Rechteckspirale auf einem Zweierraster, die drei anderen aus
logarithmischen Spiralen. Jede Kachel wird dreimal gezeichnet (bei −P, 0 und +P)
und auf die Periode beschnitten, damit sie sich nahtlos wiederholt.

Im CSS liegen sie als `mask-image` und nicht als `background-image` — dadurch
nehmen sie ihre Farbe aus dem Theme:

```html
<div class="ornament-band" data-ornament="meander" aria-hidden="true"></div>
```

Steuerbar über `--ornament-size`, `--ornament-color` und `--ornament-opacity`.

**Illustrationen statt Fotos.** Die Gefäße in `assets/img/vessels/` sind
Inline-SVG und färben sich über `--vessel-body`, `--vessel-glaze` und
`--vessel-rim` — die Glasurtöne `tone-sand`, `tone-clay`, `tone-ember`,
`tone-mist` und `tone-sage` schalten sie um. Zusammen wiegen alle acht unter
4 kB.

Sobald echte Produktfotos vorliegen, ersetzt ein `<img>` in `.product-figure`
die Illustration; das Layout bleibt gleich. Bitte mit `loading="lazy"`,
`width`/`height` und beschreibendem `alt`.

## Formulare ohne Server

Die Seite hat kein Backend. Kontaktformular, Kursanfrage, Newsletter und
„Zur Kasse" prüfen die Eingaben und öffnen anschließend das E-Mail-Programm mit
einer fertig formulierten Nachricht an `hallo@sharemics.de`. Das funktioniert ab
dem ersten Tag, überträgt nichts an Dritte und braucht kein Cookie-Banner.

Wenn später ein Shop- oder Buchungssystem dazukommt, sind die Stellen in
`app.js` mit `location.href = mailto:` markiert — dort wird der Aufruf durch ein
`fetch` ersetzt. Die Datenschutzerklärung muss dann ergänzt werden.

## Barrierefreiheit

Sprungmarke zum Inhalt, sichtbare Fokusringe, Fokusfalle in Warenkorb und
Dialog, Schließen mit `Escape`, `aria-pressed` an Filtern, Theme-Schalter und
Kalendertagen, `aria-live` an Warenkorbzähler und Hinweisen, Pfeiltasten für den
Kurskalender, ausformulierte Fehlermeldungen an den Formularfeldern. Alle
Animationen halten sich an `prefers-reduced-motion`.

## Vor dem Livegang

- [ ] `impressum.html`, `datenschutz.html`, `agb.html` und `widerruf.html`
      vervollständigen und juristisch prüfen lassen — die Stellen in eckigen
      Klammern sind Platzhalter, der farbige Kasten oben auf jeder dieser Seiten
      weist darauf hin.
- [ ] Adresse, Telefonnummer, Öffnungszeiten und Gesellschafter in
      `src/data/site.json` gegen die echten Angaben tauschen.
- [ ] `domain` in `src/data/site.json` setzen — daraus entstehen Canonical-URLs,
      Open-Graph-URLs und `sitemap.xml`.
- [ ] Produktpreise, Bestände und Kurstermine prüfen.
- [ ] Ein Vorschaubild ergänzen und als `og:image` im Layout eintragen.
- [ ] Hosting mit deutschem Serverstandort wählen und einen
      Auftragsverarbeitungsvertrag abschließen.

## Veröffentlichen

`dist/` ist ein Ordner mit statischen Dateien und läuft überall. Der Workflow
unter `.github/workflows/pages.yml` baut bei jedem Push auf `main` und
veröffentlicht auf GitHub Pages; in den Repository-Einstellungen muss unter
*Pages → Source* „GitHub Actions" ausgewählt sein.

Alle Verweise sind relativ, deshalb funktioniert die Seite auch in einem
Unterverzeichnis — etwa unter `benutzername.github.io/Sharemics/`.
