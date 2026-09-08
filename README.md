# ChurchTools Publisher

Der ChurchTools Publisher ist ein browserbasierter Mehrseiten-Layouteditor für Terminmedien. Ein Dokument kann frei dimensionierte Seiten, Texte, Bilder, Formen, Icons, QR-Codes und verschachtelte Gruppen enthalten. ChurchTools-Termindaten werden als austauschbarer Datenkontext gebunden, sodass dasselbe Layout mit einem anderen Termin neu gerendert werden kann.

Eine vollständige Produktbeschreibung steht in [EXTENSION_STORE.md](EXTENSION_STORE.md), der technische Audit und priorisierte Backlog in [analyse.md](analyse.md).

## Technischer Aufbau

- Vue 3, TypeScript und Pinia
- Konva und `vue-konva` für Szenengraph, Interaktion und Export
- TanStack Vue Query und ChurchTools-Client für Termin- und CCM-Daten
- Vitest für Domain-, Store- und Komponententests
- Playwright für kritische Browser-Interaktionen

Der `PublisherDocumentStore` ist die kanonische Quelle für Seiten, Layoutzustände und Historien. Der `PublisherEditorStore` hält Werkzeug-, Zoom- und seitengebundene Auswahlzustände. Canvas-Gruppen werden rekursiv als echte Konva-Gruppen gerendert; persistierte Daten enthalten ausschließlich serialisierbare Domain-Werte und keine Konva-Nodes.

Dokumente und terminneutrale Vorlagen werden über ein `PublisherRepository` gespeichert. Der produktive Adapter nutzt zwei Custom-Data-Kategorien des Publisher-CCM-Moduls: `publisher_documents` und `publisher_templates`. Dokumente besitzen eine eigene UUID und können optional auf einen Termin verweisen; Vorlagen enthalten nie einen Terminbezug. `localStorage` hält nur den zuletzt bearbeiteten Stand als Recovery-Kopie und ist nicht mehr die Vorlagen- oder Dokumentquelle.

Eigene Bild-Uploads sind bis zu einem offiziellen ChurchTools-Speicherpfad bewusst deaktiviert. Die Einstiegspunkte bleiben sichtbar und erklären den kommenden Funktionsumfang per Toast. Bereits vorhandene ChurchTools-Terminbilder und Bildvariablen können weiterhin verwendet werden.

## Lokale Entwicklung

Das ChurchTools-Monorepo und dieses Repository müssen als Geschwisterverzeichnisse vorliegen, weil mehrere interne Pakete lokal eingebunden werden:

```text
git/
├── churchtools/
└── extension-publisher-gpt/
```

```bash
npm install
npm run dev
```

Die lokale Konfiguration basiert auf `.env-example`. Der Vite-Basispfad lautet `/ccm/<VITE_KEY>/`.

## Verifikation

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

Für den ersten Playwright-Lauf wird einmalig der Testbrowser benötigt:

```bash
npx playwright install chromium
```

## Wichtige Produktinvarianten

- Neue Dokumente und Seiten starten leer und transparent.
- Ein Terminwechsel ersetzt nur den Datenkontext und niemals das Layout.
- Seiten dürfen unterschiedliche Größen besitzen und liegen untereinander auf einer gemeinsamen zoombaren Arbeitsfläche.
- Die Arbeitsfläche lässt sich über das Handwerkzeug oder temporär mit der Leertaste verschieben; aktive Seite, Auswahl und 100-Prozent-Ansicht können direkt zentriert werden.
- Seiten besitzen echte Canvas-Vorschauen und können benannt, dupliziert sowie per Drag-and-drop sortiert werden.
- Bilder werden im Cover-Modus zugeschnitten; Icons und QR-Codes bleiben proportional.
- Vorlagen speichern das vollständige mehrseitige Dokument und behalten dynamische Daten- und Farbbindungen.
- Vorlagen sind terminneutral; nur gespeicherte Dokumente dürfen optional einen Terminbezug besitzen.
- ChurchTools ist die Quelle für Dokumente und Vorlagen, der Browser hält lediglich eine Recovery-Kopie.
- Gruppenhierarchie, Ebenen-Inspector und Canvas verwenden denselben rekursiven Szenengraphen.
- PNG- und JPEG-Ausgaben werden pro Seite konfiguriert und gemeinsam als ZIP exportiert.
