# ChurchTools Publisher

Der ChurchTools Publisher ist ein browserbasierter Mehrseiten-Layouteditor für Terminmedien. Ein Dokument kann frei dimensionierte Seiten, Texte, Bilder, Formen, Icons, QR-Codes und verschachtelte Gruppen enthalten. ChurchTools-Termindaten werden als austauschbarer Datenkontext gebunden, sodass dasselbe Layout mit einem anderen Termin neu gerendert werden kann.

Eine vollständige Produktbeschreibung steht in [EXTENSION_STORE.md](EXTENSION_STORE.md), der technische Audit und priorisierte Backlog in [analyse.md](analyse.md).

## Technischer Aufbau

- Vue 3, TypeScript und Pinia
- Konva und `vue-konva` für Szenengraph, Interaktion und Export
- TanStack Vue Query und ChurchTools-Client für Termindaten
- Vitest für Domain-, Store- und Komponententests
- Playwright für kritische Browser-Interaktionen

Der `PublisherDocumentStore` ist die kanonische Quelle für Seiten, Layoutzustände und Historien. Der `PublisherEditorStore` hält Werkzeug-, Zoom- und seitengebundene Auswahlzustände. Canvas-Gruppen werden rekursiv als echte Konva-Gruppen gerendert; persistierte Daten enthalten ausschließlich serialisierbare Domain-Werte und keine Konva-Nodes.

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
- Bilder werden im Cover-Modus zugeschnitten; Icons und QR-Codes bleiben proportional.
- Vorlagen speichern das vollständige mehrseitige Dokument und behalten dynamische Daten- und Farbbindungen.
- Gruppenhierarchie, Ebenen-Inspector und Canvas verwenden denselben rekursiven Szenengraphen.
- PNG- und JPEG-Ausgaben werden pro Seite konfiguriert und gemeinsam als ZIP exportiert.
