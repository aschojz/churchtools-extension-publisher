# AGENTS.md

Diese Datei gilt für das gesamte Repository. Sie beschreibt die Arbeitsregeln für Änderungen am ChurchTools Publisher. Der ausführliche Projekt-Audit und der priorisierte Backlog stehen in `analyse.md`.

## Produktziel

Der Publisher ist ein browserbasierter Layout-Editor innerhalb von ChurchTools. Ein Dokument besteht aus einer oder mehreren frei dimensionierbaren Seiten. Termindaten und optional nachgeladene verknüpfte Daten werden als Variablen in Text-, Bild- oder QR-Elemente eingesetzt. Das Layout bleibt beim Wechsel des Termins unverändert. Vorlagen speichern vollständige mehrseitige Dokumente, nicht nur eine aktive Seite.

## Stack und lokale Voraussetzungen

- Vue 3 mit `<script setup lang="ts">`
- Pinia für anwendungsweiten Zustand
- Konva und `vue-konva` für Canvas und Export
- TanStack Vue Query sowie ChurchTools-Clientpakete für API-Daten
- Vitest und Vue Test Utils für Tests
- Lokale ChurchTools-Pakete werden aus `../churchtools/frontend-packages/` bezogen. Dieses Geschwisterverzeichnis muss für Installation, Typecheck und Build vorhanden sein.
- Die Extension läuft unter `/ccm/<VITE_KEY>/`.

## Wichtige Befehle

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

Es gibt aktuell keinen Lint-, Format- oder Visual-Regression-Runner. Playwright deckt die kritischen Browserpfade ab. Bei größeren UI-Änderungen den lokalen Editor zusätzlich in mindestens einem normalen Desktop-Viewport und einem schmalen Viewport prüfen.

## Architekturregeln

### Eine Quelle der Wahrheit

- Dokument, Seiten, aktive Seite und persistierbarer Layoutzustand gehören in Pinia beziehungsweise in pure Domain-Modelle hinter Store-Actions.
- Neue Features dürfen keinen weiteren parallelen Zustand in `App.vue`, Inspector-Komponenten und `EventTemplate.vue` anlegen.
- Canvas-Nodes sind eine Projektion des serialisierbaren Zustands, nicht dessen Quelle der Wahrheit.
- Seiten-Thumbnails sind abgeleiteter UI-Zustand. Sie werden klein aus dem aktuellen Szenengraphen gerendert und weder in Dokumenten noch Vorlagen persistiert.
- Komponenten lesen gemeinsamen Zustand möglichst direkt aus Stores und rufen fachliche Actions auf. Props und Emits bleiben für lokale, wiederverwendbare UI-Komponenten und echte Komponenten-Grenzen reserviert.
- Direkte Mutationen wie `pages.value = ...` außerhalb des zuständigen Stores vermeiden. Dokumentoperationen als benannte Store-Actions implementieren.
- Auswahlzustand muss eindeutig einer Seite zugeordnet sein. Beim Seitenwechsel dürfen auf inaktiven Seiten weder Auswahlrahmen noch Handles zurückbleiben.

### Domain und Canvas trennen

- Geometrie, Reihenfolge, Gruppierung, Auto-Layout, Snapping, Textformatierung, Verläufe, Effekte und Persistenz bleiben in testbaren TypeScript-Modulen.
- `EventTemplate.vue` soll Render- und Interaktionsadapter sein. Neue größere Verhaltenseinheiten als Composables oder spezialisierte Canvas-Komponenten auslagern.
- Gruppenhierarchie und Ebenenbaum verwenden dasselbe Modell. Eine Änderung im Ebenen-Inspector muss unmittelbar den Canvas-Szenengraphen beziehungsweise dessen Renderreihenfolge ändern.
- Gruppeneffekte dürfen nicht stillschweigend als Einzeleffekte auf alle Kinder kopiert werden. Ein visueller Effekt auf eine Gruppe erfordert einen echten gemeinsamen Konva-Container oder eine zwischengerenderte Komposition.
- Transformer-Griffe und Auswahlkonturen bleiben unabhängig vom Dokumentzoom in einer konstanten, filigranen Bildschirmgröße. Randgriffe werden nach innen dargestellt und behalten eine ausreichend große unsichtbare Trefferfläche.

### Verbindliche Produktinvarianten

- Die erste Seite und neu angelegte Seiten sind leer und transparent. Eingebaute Layouts werden nur durch eine ausdrückliche Vorlagenaktion angewendet.
- Eine Terminauswahl ändert ausschließlich den Datenkontext. Sie ersetzt, löscht oder wechselt weder Seiten noch Layout noch Vorlage.
- Seiten dürfen unterschiedliche Größen zwischen 64 und 8192 Pixeln besitzen und werden auf der Arbeitsfläche untereinander dargestellt.
- Alle Seiten teilen eine Zoomstufe. Temporäres Verschieben per Leertaste und die Ansichten „Seite einpassen“, „Auswahl einpassen“ und „100 %“ dürfen weder Dokumentgeometrie noch Auswahl verändern.
- Bilder werden im Cover-Modus zugeschnitten und nicht verzerrt. QR-Codes und Icons behalten ihr Seitenverhältnis. Linien haben keine Füllung und werden nur über Länge, Konturstärke und Drehung verändert.
- Dynamische Text- und Farbbindungen speichern die Variable beziehungsweise das Farb-Token plus Fallback. Aufgelöste Terminwerte oder analysierte Farben werden nicht destruktiv in die Vorlage geschrieben.
- Vorlagen müssen alle Seiten, Seitengrößen, Ebenen, Gruppen, Bindungen, Effekte und Bildfokusse enthalten. Keine neuen Funktionen auf ein Einzelseiten-Vorlagenmodell zuschneiden.
- Sichtbarkeit und Sperren sind nicht destruktiv. Löschen muss über Undo rückgängig zu machen sein, sofern keine ausdrücklich bestätigte Dokumentlöschung vorliegt.
- Canvas-Änderungen, Seitenoperationen und das Anwenden einer Vorlage teilen eine chronologische Dokumenthistorie. Öffnen oder Erstellen eines eigenständigen Dokuments setzt diese Historie zurück; reine Seitennavigation erzeugt keinen Eintrag.
- Beim Export sind Auswahlrahmen, Handles, Hilfslinien und Editor-Chrome ausgeschlossen; die Ausgabedimension muss exakt der Seitengröße entsprechen.

## Persistenz und Migrationen

- Persistierte Strukturen sind externe Verträge. Bei Schemaänderungen die Versionsnummer erhöhen und eine explizite Migration ergänzen.
- Parser dürfen neue optionale Werte nicht versehentlich verwerfen. Besonders Gruppenrotation, verschachtelte Gruppen, Bindungen, Verläufe und Effekte in Roundtrip-Tests absichern.
- Einen beschädigten Eintrag isolieren; nicht wegen einer fehlerhaften Vorlage die gesamte Bibliothek unlesbar machen.
- Alle geladenen und gespeicherten Zustände tief kopieren. Keine Vue-Proxies oder Konva-Nodes persistieren.
- Große Bild-Data-URLs nicht in Dokumenten oder `localStorage` ablegen. Persistente Bilder benötigen künftig eine offizielle ChurchTools-Asset-ID beziehungsweise stabile Asset-Referenz.
- Dokumente und terminneutrale Vorlagen werden über `PublisherRepository` persistiert. ChurchTools/CCM-spezifische Endpunkte bleiben im Infrastrukturadapter und dürfen nicht in Store-, Canvas- oder Inspector-Komponenten durchsickern.
- `publisher_documents` speichert Dokumente mit optionaler Terminreferenz; `publisher_templates` speichert ausschließlich terminneutrale Vorlagen. `localStorage` ist nur für eine einzelne Recovery-Kopie vorgesehen.
- Abgeleitete Farbvoreinstellungen dürfen versioniert in IndexedDB gecacht werden. Dabei weder Bildbytes noch vollständige Bild-URLs speichern; Cache-Schlüssel aus einem stabilen Quellen-Hash ableiten, der die URL nicht im Klartext enthält.
- Ist das CCM-Modul nicht verfügbar, bleibt der Editor in einem lokalen Recovery-Status und pausiert automatische Remote-Wiederholungen. Explizites Speichern und ein erneutes Online-Ereignis dürfen den Remote-Speicher erneut prüfen; Konflikte, Rechte- und Validierungsfehler bleiben sichtbar.
- Eigene Bild-Uploads bleiben deaktiviert, bis ein offizieller ChurchTools-Assetpfad feststeht. Keine Wiki-Seite als versteckten Dateicontainer einführen, ohne diese Architekturentscheidung ausdrücklich neu zu bewerten.
- Limits zwischen Import, Upload und Speicherung müssen zueinander passen und in der UI erklärt werden.

## Daten und ChurchTools-API

- API-Antworten zuerst in kleine Publisher-Modelle mappen. Canvas und Inspectoren dürfen nicht von umfangreichen generierten ChurchTools-Typen abhängen.
- Verknüpfte Event- und Gruppendaten nur auf Nutzerwunsch nachladen. Lade-, Leer- und Fehlerzustände sichtbar halten.
- Keine stillen Teilfehler bei Stammdaten: Fallbacks sind erlaubt, ein fachlich relevanter Ladefehler muss aber diagnostizierbar bleiben.
- API-Paginierung und Limits immer berücksichtigen. Nicht darauf vertrauen, dass ein gesuchter Datensatz in einer begrenzten Tagesliste enthalten ist.
- Terminvariablen bleiben stabile IDs. Lesbare Bezeichnungen werden nur für die Oberfläche aus Stammdaten aufgelöst.
- Das Laden eines Termins oder verwandter Daten darf keine Schreiboperation an ChurchTools auslösen.

## UI- und Designregeln

- Der Dark Mode kommt vom ChurchTools-Host über die Klasse `.dark`. Keinen eigenen Theme-Select einführen.
- Wiederkehrende Buttons, Icon-Buttons, Tabs, Panel-Header, Farbwähler und Dialogmuster aus `src/components/design/` beziehungsweise gemeinsamen Publisher-Komponenten verwenden.
- Font-Awesome-Icons statt Textglyphen wie `×`, `＋`, `^` oder selbst gezeichneter Pfeile verwenden. Für aufklappbare Bereiche ist `angle-down` der Standard; Rotation zeigt den Zustand.
- Icon-only-Buttons benötigen immer einen zugänglichen Namen und einen Tooltip beziehungsweise `title`.
- Die rechte Seitenleiste besteht aus drei stabilen Bereichen: Farbe/Kontur, Text/Absatz/Ebenen sowie kompakt Transformieren. Tabwechsel sollen die Blockhöhen nicht springen lassen.
- Kontextabhängige Ausrichtung und Ebenenaktionen gehören in die obere Kontextleiste. Der Ebenen-Footer enthält Effekte, Filter, Sperren und Löschen als kompakte Icon-Aktionen.
- Farbeingaben öffnen den gemeinsamen, per `Teleport` außerhalb von Scrollcontainern gerenderten Farbwähler. Keine browsernativen Farbfelder oder parallelen Picker einführen.
- Modale Dialoge benötigen Escape, Fokusfalle, initialen Fokus, Fokus-Rückgabe und eine beschriftete Überschrift. Bevorzugt ein gemeinsames Dialog-Primitiv statt weiterer individueller Backdrops.
- Tabs müssen vollständig tastaturbedienbar sein (`aria-controls`, Panel-IDs, roving focus und Pfeiltasten).
- Seitenleiste und Inspector auf kleinen Viewports nicht ersatzlos ausblenden; für mobile/schmale Ansichten Drawer oder vergleichbare Zugänge vorsehen.
- Neue CSS-Werte nach Möglichkeit als semantische Tokens definieren. `src/styles.css` nicht weiter als unsortierten Sammelort vergrößern; Styles bei der zugehörigen Komponente oder in thematischen Dateien halten.

## Tests

- Jede Domainänderung erhält Unit-Tests für Normalfall, Grenzen und Persistenz-Roundtrip.
- Store-Actions werden mit einem frischen Pinia getestet.
- Kritische Canvas-Flows brauchen browserbasierte Integrationstests: Auswahl, Handles am Rand, Gruppentransform, Seitenwechsel, Zoom, Drag-and-drop im Ebenenbaum, dynamisches Auto-Layout und Export.
- Persistenztests müssen alte Versionen, beschädigte Einzeleinträge, große Dokumente und Schema-Migrationen abdecken.
- Änderungen am Export prüfen mindestens PNG und JPEG, Transparenz beziehungsweise JPEG-Hintergrund, Seitenauswahl und exakte Pixelmaße.
- Bei Bugfixes zuerst einen reproduzierenden Test ergänzen, soweit der Fehler ohne unverhältnismäßigen Aufwand automatisierbar ist.

## Arbeitsweise im Repository

- Der Worktree kann absichtlich fremde oder noch nicht committete Änderungen enthalten. Vor und nach Änderungen `git status --short` prüfen und nur die eigenen Dateien anfassen.
- Keine generierten Dateien wie `src/utils/ct-types.d.ts` manuell ändern.
- Keine destruktiven Git-Befehle zum Bereinigen fremder Änderungen verwenden.
- Größere Refactorings in kleine, fachlich geschlossene Schritte teilen. Verhalten zuerst durch Tests absichern.
- Neue Abhängigkeiten nur hinzufügen, wenn Browsergröße, Wartung, Lizenz, Sicherheit und ChurchTools-Laufzeit geklärt sind.
- Store- oder Persistenzmigrationen und sichtbare Produktänderungen in README/Store-Beschreibung und `analyse.md` nachführen.

## Orientierung im Code

- `src/App.vue`: derzeit noch zentraler Orchestrator; nicht weiter anwachsen lassen
- `src/components/EventTemplate.vue`: Canvas-Interaktion und Rendering; vorrangiger Refactoring-Kandidat
- `src/composables/useCanvasSelection.ts`, `useCanvasTransformer.ts`, `useCanvasTransforms.ts`: Auswahl-, Transformer- und Transformationsgesten; bestehende Grenzen erweitern statt Verhalten zurück nach `EventTemplate.vue` zu verschieben
- `src/stores/`: globaler Editor-, Dokument-, Termin- und Farbzustand
- `src/domain/`: pure Fachlogik, Parser, Typen und Serialisierung
- `src/components/publisher/inspectors/`: rechte Inspector-Bereiche
- `src/components/design/`: wiederverwendbare Design-Primitiven
- `src/styles.css`: gewachsener globaler Stilbestand; schrittweise zerlegen
- `docs/todos.md`: ungeordnete Produktwünsche
- `analyse.md`: bewerteter Ist-Zustand, Risiken und empfohlene Reihenfolge
