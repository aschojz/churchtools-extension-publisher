# ChurchTools Publisher

Der ChurchTools Publisher ist ein browserbasierter Mehrseiten-Layouteditor für Terminmedien. Ein Dokument kann frei dimensionierte Seiten, Texte, Bilder, Formen, Icons, QR-Codes und verschachtelte Gruppen enthalten. ChurchTools-Termindaten werden als austauschbarer Datenkontext gebunden, sodass dasselbe Layout mit einem anderen Termin neu gerendert werden kann.

Eine vollständige Produktbeschreibung steht in [EXTENSION_STORE.md](EXTENSION_STORE.md), der technische Audit und priorisierte Backlog in [analyse.md](analyse.md).

## Erste Version

`v0.1.0` ist die erste öffentliche Vorschau. Funktionsumfang und bekannte Einschränkungen stehen im [Changelog](CHANGELOG.md). Die Releases enthalten neben dem Quellcode ein gebautes ZIP zur Installation als ChurchTools-Extension.

Das Installationspaket verwendet den Extension-Key `publisher-26` und den Pfad `/ccm/publisher-26/`. Der Key des Custom Modules muss dazu passen. Für einen anderen Key kann ein eigenes Paket gebaut werden. Dokumente und Vorlagen benötigen das CCM-Modul mit passenden Berechtigungen; ohne verfügbaren Remote-Speicher bleibt die lokale Recovery-Kopie nutzbar.

## Technischer Aufbau

- Vue 3, TypeScript und Pinia
- Konva und `vue-konva` für Szenengraph, Interaktion und Export
- TanStack Vue Query und ChurchTools-Client für Termin- und CCM-Daten
- Vitest für Domain-, Store- und Komponententests
- Playwright für kritische Browser-Interaktionen

Der `PublisherDocumentStore` ist die kanonische Quelle für Seiten, Layoutzustände und die gemeinsame Dokumenthistorie. Der `PublisherEditorStore` hält Werkzeug-, Zoom- und seitengebundene Auswahlzustände. Auswahlgesten, Transformer-Konfiguration, Transformationen, Gruppen/Auto-Layout, Elementstile und Datenfeld-Drops liegen in getrennten Canvas-Composables; `EventTemplate.vue` verbindet diese mit dem rekursiven Konva-Szenengraphen. Seine öffentliche Schnittstelle bündelt fachliche Befehle unter `commands` und hält technische Operationen wie Export und Thumbnail-Rendering separat. Persistierte Daten enthalten ausschließlich serialisierbare Domain-Werte und keine Konva-Nodes.

Dokumente und terminneutrale Vorlagen werden über ein `PublisherRepository` gespeichert. Der produktive Adapter nutzt zwei Custom-Data-Kategorien des Publisher-CCM-Moduls: `publisher_documents` und `publisher_templates`. Dokumente besitzen eine eigene UUID und können optional auf einen Termin verweisen; Vorlagen enthalten nie einen Terminbezug. `localStorage` hält nur den zuletzt bearbeiteten Stand als Recovery-Kopie und ist nicht mehr die Vorlagen- oder Dokumentquelle.

Ist das Publisher-CCM-Modul vorübergehend nicht verfügbar, wechselt der Editor in den Status „Lokal gesichert“ und hält Änderungen in dieser Recovery-Kopie. Automatische Remote-Versuche pausieren dann, bis bewusst erneut gespeichert wird oder ChurchTools wieder online ist. Konflikte, fehlende Rechte und ungültige Dokumente bleiben als echte Speicherfehler sichtbar.

Persistierte Dokumente, portable Dateien, Vorlagenbibliotheken und CCM-Envelopes sind getrennt versioniert. Unterstützte Vorgängerversionen werden beim Lesen explizit auf das aktuelle Schema migriert; neue Repeat-Bindungen sind Bestandteil dieses Vertrags.

Eigene Bild-Uploads sind bis zu einem offiziellen ChurchTools-Speicherpfad bewusst deaktiviert. Die Einstiegspunkte bleiben sichtbar und erklären den kommenden Funktionsumfang per Toast. Bereits vorhandene ChurchTools-Terminbilder und Bildvariablen können weiterhin verwendet werden.

## Lokale Entwicklung

Das ChurchTools-Monorepo und dieses Repository müssen als Geschwisterverzeichnisse vorliegen, weil mehrere interne Pakete lokal eingebunden werden:

```text
git/
├── churchtools/
└── extension-publisher-gpt/
```

```bash
cp .env-example .env
npm install
npm run dev
```

Die lokale Konfiguration basiert auf `.env-example`. Der Vite-Basispfad lautet `/ccm/<VITE_KEY>/`.

Der Quellcode ist derzeit nicht unabhängig vom ChurchTools-Monorepo baubar. Zum Installieren des fertigen Release-ZIPs werden die lokalen Entwicklungspakete nicht benötigt.

## Release erstellen

Nach erfolgreicher Verifikation erzeugt dieser Befehl den Produktionsbuild und das Installationspaket unter `releases/`:

```bash
npm run release
```

Das Paket heißt `churchtools-publisher-v<VERSION>-<COMMIT>.zip` und enthält ausschließlich `dist/`, ohne Source Maps. Der Release-Build setzt lokale Anmeldedaten, Instanz-URL und den E2E-Modus ausdrücklich zurück und verwendet die Anmeldung der ChurchTools-Hostseite. `.env`-Dateien werden nicht veröffentlicht.

Ein abweichender Extension-Key kann explizit angegeben werden:

```bash
VITE_KEY=mein-publisher npm run release
```

Für eine neue Version `package.json`, `package-lock.json` und `CHANGELOG.md` gemeinsam aktualisieren, die Prüfungen ausführen, den Release-Stand committen und erst dann das ZIP bauen. Den geprüften Commit mit `v<VERSION>` taggen und das ZIP als GitHub-Release-Asset anhängen. Solange die im Audit beschriebenen Risiken offen sind, Releases als Vorschau (Pre-release) kennzeichnen.

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
- Auf schmalen Desktop- und Tabletbreiten bleiben Seitenübersicht und Inspector als fokussierbare Drawer erreichbar.
- Die Arbeitsfläche lässt sich über das Handwerkzeug oder temporär mit der Leertaste verschieben; aktive Seite, Auswahl und 100-Prozent-Ansicht können direkt zentriert werden.
- Seiten besitzen echte Canvas-Vorschauen und können benannt, dupliziert sowie per Drag-and-drop sortiert werden.
- Bilder werden im Cover-Modus zugeschnitten und passend zur tatsächlichen Rahmen-, Fokus- und Anzeigegröße angefordert; Icons und QR-Codes bleiben proportional.
- Lineare und radiale Verläufe lassen sich über Start-, End-, Radius- und Farbstop-Griffe direkt auf dem Canvas bearbeiten.
- Ebenen und Gruppen unterstützen geordnete Filter für Helligkeit, Kontrast, HSL, Graustufen, Sepia, Invertieren, Pixelierung und Rauschen.
- Vorlagen speichern das vollständige mehrseitige Dokument und behalten dynamische Daten- und Farbbindungen.
- Vorlagen und gespeicherte Dokumente werden in einem eigenen Dialog verwaltet; der rechte Inspektor bleibt dadurch für Daten und Gestaltung verfügbar.
- Verknüpfte Events werden gezielt über ihre ID geladen; Fehler optionaler Dienst-Stammdaten bleiben als sichtbare Teilfehler erkennbar.
- Mehrfach besetzte Dienste können komma- oder zeilenweise, als Aufzählung, mit „und“ oder als erste Person ausgegeben werden.
- Eine sichere, versionierte Variablen-Pipeline formatiert Datum, Zeit, Listen und Zahlen, setzt Fallbacks und bildet vordefinierte Bedingungen ab – ohne frei ausführbaren Ausdruckscode.
- Gruppen können an ein Listenfeld gebunden werden. Der Canvas und der Export projizieren daraus bis zu 100 eigene Gruppeninstanzen; gespeichert bleibt nur der wiederverwendbare Prototyp.
- Zuletzt verwendete Farben und analysierte Bildpaletten werden als abgeleitete Werte versioniert in IndexedDB gecacht; Bilddaten und vollständige Quell-URLs werden dabei nicht gespeichert.
- Vorlagen sind terminneutral; nur gespeicherte Dokumente dürfen optional einen Terminbezug besitzen.
- ChurchTools ist die Quelle für Dokumente und Vorlagen, der Browser hält lediglich eine Recovery-Kopie.
- Gruppenhierarchie, Ebenen-Inspector und Canvas verwenden denselben rekursiven Szenengraphen.
- Der Ebenenbaum ist vollständig per Tastatur navigierbar; Ebenen lassen sich mit Alt/Wahltaste plus Pfeiltasten umordnen, verschachteln oder aus ihrer direkten Gruppe herausziehen.
- PNG- und JPEG-Ausgaben werden pro Seite konfiguriert und gemeinsam als ZIP exportiert.
- Canvas-Änderungen, Seitenoperationen und das Anwenden einer Vorlage werden chronologisch über dieselbe Undo-/Redo-Historie zurückgenommen; häufige Canvas-Änderungen speichern dabei nur die betroffene Seiten-Layoutspur, echte Dokumentoperationen einen vollständigen Snapshot. Einen separaten Layout-Reset gibt es nicht.
