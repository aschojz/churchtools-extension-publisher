# Technische und konzeptionelle Analyse des ChurchTools Publisher

Stand: 8. September 2026
Untersuchter Stand: Audit auf Basis von Commit `66affa4`, Fundament-Umsetzung auf Basis von `a02005c`, CCM-Persistenz auf Basis von `1bacd72`
Status: Audit plus Umsetzung der priorisierten Architektur- und Persistenzgrundlagen

## Kurzfazit

Der Publisher ist kein kleiner Prototyp mehr, auch wenn Teile des Datenmodells noch aus dieser Phase stammen. Er ist bereits ein umfangreicher Mehrseiten-Editor mit eigener Szenenlogik, Hierarchie, Auto-Layout, Datenbindungen, dynamischen Farben, Effekten, CCM-Persistenz und Export-Pipeline. Die fachliche Breite ist gut erkennbar und viele pure Domain-Funktionen sind ordentlich getestet.

Die zuvor größten strukturellen Risiken wurden mit den vier Fundamenten gezielt reduziert: Der persistierbare Dokumentzustand und die Auswahl besitzen nun kanonische Stores, Vorlagen bilden vollständige Mehrseitendokumente ab und Gruppen werden als echte Canvas-Knoten gerendert. Die verbleibenden Hauptrisiken liegen in der Größe des Canvas-Orchestrators, der Speicherung großer Bild-Assets, der Barrierefreiheit komplexer Interaktionen und der noch schmalen visuellen Regressionstest-Abdeckung.

Vor einem weiteren größeren Feature-Ausbau wurden vier Fundamente stabilisiert:

1. Pinia als kanonische Dokument- und Auswahlquelle, seitenbezogen und über Store-Actions verändert.
2. Ein einheitliches mehrseitiges Vorlagenmodell anstelle der parallelen Welt aus zwei eingebauten Templates und einseitigen Designvorlagen.
3. Ein echter Canvas-Szenengraph für Gruppen, damit Hierarchie, Transformation, Snapping und Gruppeneffekte dieselbe Semantik haben.
4. Browserbasierte Tests für die Interaktionen, die Unit- und jsdom-Komponententests nicht zuverlässig abdecken.

## Umsetzungsstand der vier Fundamente

1. **Kanonischer Pinia-Zustand:** Seiten, aktive Seite, serialisierbare Layouts und deren Undo-/Redo-Historien liegen nun im `PublisherDocumentStore`. Die Auswahl ist mit einer aktiven Seiten-ID im `PublisherEditorStore` gebunden. Gemountete Canvas-Seiten besitzen keine parallele persistierbare Layout- oder Auswahlkopie mehr.
2. **Mehrseitige Vorlagen:** Die Vorlagenbibliothek verwendet Schema-Version 2 und speichert vollständige Dokumente mit allen Seiten, Größen, Layouts, Gruppen, Bildfokussen und aktiver Seite. Alte einseitige Version-1-Vorlagen werden beim Lesen migriert; ein defekter Einzeleintrag blockiert nicht mehr die restliche Bibliothek.
3. **Rekursiver Canvas-Szenengraph:** `LayoutGroup` wird rekursiv als echter Konva-Gruppenknoten gerendert. Gruppendrag bewegt einen Container und schreibt erst am Ende die Kindgeometrie zurück. Gruppenrotation ist persistierbar. Schatten, Unschärfe, Deckkraft und Mischmodus können am kompositierten Gruppenknoten liegen, ohne die Effekte auf Kinder zu kopieren.
4. **Browser-Regressionstests:** Playwright mit Chromium ist eingerichtet. Die erste Suite prüft leeren Start, frei dimensionierte leere Seiten, seitengebundene Auswahl, Gruppenziel/-effekte und den Roundtrip einer mehrseitigen Dokumentvorlage.

Diese Umsetzung beseitigt nicht alle nachfolgenden Findings. Insbesondere ein offizieller ChurchTools-Assetpfad und weitere visuelle Regressionstests bleiben eigenständige Ausbauschritte.

## Bewertungsübersicht

| Bereich | Einschätzung | Begründung |
|---|---|---|
| Funktionsumfang | stark | Mehrere Seitengrößen, Canvas-Elemente, Termindaten, Bindungen, Gruppen, Auto-Layout, Farben, Effekte und Export sind vorhanden. |
| Domain-Modell | mittel bis gut | Seiten, Layouts und rekursive Gruppen besitzen gemeinsame serialisierbare Modelle; einige ältere Spezialpfade und der große Canvas-Orchestrator bleiben. |
| Zustandsmanagement | mittel bis gut | Pinia ist die kanonische Quelle für Dokument, Historie und seitengebundene Auswahl; lokale UI-Zustände bleiben bewusst in Komponenten. |
| Persistenz | mittel bis gut | Dokumente und terminneutrale Vorlagen verwenden eine austauschbare CCM-Repository-Schicht; `localStorage` enthält nur eine Recovery-Kopie. Der offizielle Assetpfad ist noch offen. |
| Canvas-Interaktion | mittel bis gut | Echte rekursive Gruppen, konstante Transformer-Griffe, Panning und Fit-Ansichten stabilisieren die Kernpfade; weitere komplexe Pointer- und DnD-Szenarien fehlen noch. |
| UI-Konsistenz | mittel | Design-Komponenten und ein konsistenter Grundaufbau existieren, einzelne Glyphen, Dialoge, Tabs und Responsive-Verhalten weichen ab. |
| Barrierefreiheit | ausbaufähig | Viele Beschriftungen sind vorhanden; Canvas, Drag-and-drop, Tabs und modale Fokusführung sind nicht vollständig zugänglich. |
| Testabdeckung | mittel bis gut | 38 Vitest-Dateien mit 199 Tests sowie sieben grüne Playwright-Kernflüsse; visuelle und breitere Interaktionsregressionen fehlen noch. |
| Build und Performance | mittel | Build funktioniert; der Hauptchunk und mehrere synchrone Vollzustandsoperationen werden bei größeren Dokumenten problematisch. |
| Sicherheit und Datenschutz | mittel | CCM-Schreibzugriffe liegen hinter einem Repository-Adapter; Rechte- und Konfliktverhalten müssen noch an einer echten ChurchTools-Instanz validiert werden. Abhängigkeitswarnungen bleiben offen. |
| Dokumentation und Release-Reife | mittel | README, `AGENTS.md`, Audit und Store-Beschreibung sind aktualisiert; Versionierung, Changelog und Releaseprozess bleiben prototypisch. |

## Untersuchungsumfang

Geprüft wurden:

- Projektstruktur, Abhängigkeiten, Build- und Packaging-Skripte
- Vue-Komponenten, Pinia-Stores und Prop-/Event-Grenzen
- Konva-Szenenaufbau, Auswahl, Transformer, Zoom, Snapping, Gruppen und Auto-Layout
- Seiten-, Entwurfs-, Vorlagen- und Import-/Exportmodelle
- Terminvariablen, nachgeladene Event-/Dienst-/Anmeldegruppendaten und Bildfarben
- Inspector-Aufbau, Kontextleiste, Seitenübersicht, Dialoge, responsive CSS und Tastaturpfade
- vorhandene Tests und ungetestete Risikoflächen
- `npm audit --omit=dev`, Typecheck, Tests und Produktionsbuild

Ein lokaler Smoke-Test wurde mit leerem Dokument und einer eingebauten Standardvorlage bei 1280 × 720 Pixeln durchgeführt. Aussagen, die nur aus Codepfaden abgeleitet und nicht interaktiv reproduziert wurden, sind unten ausdrücklich als Risiko oder Ableitung bezeichnet.

## Aktuell implementierter Funktionsumfang

### Dokument und Arbeitsfläche

- transparenter, karierter Initial-Canvas
- mehrere untereinander angeordnete Seiten
- je Seite eigene Größen von 64 bis 8192 Pixeln, einschließlich Presets und freier Eingabe
- gemeinsamer Zoom von 25 bis 400 Prozent, Range-Slider und Trackpad-Pinch über Ctrl/Meta-Wheel
- scrollbar bleibende große Arbeitsfläche
- Raster- und Objekt-Snapping mit Hilfslinien
- aktive Seite, Undo/Redo und Tastatur-Nudging

### Elemente

- Grafiktext und Rahmentext
- bildgebundene Terminfelder; eigene Upload-Einstiege sind bis zum ChurchTools-Assetpfad als „Kommt noch“ markiert
- Rechteck, Kreis, Dreieck und Linie
- Font-Awesome-Icons
- QR-Codes mit Datenbindung
- Auswahl, Mehrfachauswahl, Verschieben, Skalieren, Drehen, Ausrichten und Verteilen
- Ebenenreihenfolge, verschachtelte Gruppen, Ein-/Ausklappen, Sichtbarkeit und Sperren
- horizontales oder vertikales Gruppen-Auto-Layout mit Abstand und Ursprung

### Gestaltung

- Füll- und Konturfarben, auch für Text
- lineare und radiale Verläufe mit mehreren Stops, Transparenz und dynamischen Farbbindungen
- zuletzt verwendete Farben und Standardfarbfelder
- bis zu neun aus Bildern extrahierte Farben sowie Primär-, Vordergrund- und Hintergrundtoken
- Textattribute einschließlich Schriftschnitt, Größe, Laufweite, Zeilenhöhe, Ausrichtung, Listen, Großbuchstaben/Kapitälchen sowie Unter- und Durchstreichung
- Ebeneneffekte für Schatten, Weichzeichnung, Deckkraft und Mischmodus

### Daten und Vorlagen

- ChurchTools-Terminauswahl über sichtbare Kalender und Detailabruf eines Vorkommens
- kompakter Dateninspektor mit bearbeitbaren Terminwerten
- Platzhalter für Text, Datum und Zeit mit mehreren Ausgabeformaten
- Drag-and-drop von Text-, Bild- und Linkdaten auf den Canvas
- Linkwerte als QR-Code
- verknüpfte Events und Anmeldegruppen werden angezeigt und auf Wunsch nachgeladen
- Dienste eines Events werden über Stammdaten lesbar benannt und als Personenliste bereitgestellt
- zwei eingebaute Standardlayouts und terminneutrale, über CCM gespeicherte Designvorlagen
- über CCM gespeicherte Dokumente mit optionalem Terminbezug und lokaler Recovery-Kopie

### Ausgabe

- pro Seite wählbar: PNG oder JPEG
- JPEG-Qualität pro Seite
- Auswahl der zu exportierenden Seiten
- pixelgenaue Prüfung jeder gerenderten Seite
- gemeinsamer ZIP-Download
- flüchtige Success-Meldung als Toast

## Zielarchitektur

Der fachliche Datenfluss sollte mittelfristig so aussehen:

```text
ChurchTools API ──> Mapper/Query-Cache ──> Datenkontext
                                           │
persistierte Datei <── Migration <──> PublisherDocumentStore <──> Inspector/Toolbar
                                           │
                                           ├──> Canvas-Szenengraph
                                           └──> Export-Renderer
```

Dabei enthält ein `PublisherDocument` alle Seiten. Jede Seite enthält genau einen Szenengraphen mit echten Gruppen- und Elementknoten. Auswahl und Historie referenzieren Dokument-, Seiten- und Knoten-ID. Terminwerte und Bildpaletten sind ein separater Datenkontext, auf den Knoten über stabile Bindungen verweisen. Das Austauschen dieses Datenkontexts löst Auto-Layout und Rendering neu aus, verändert aber das Dokument nicht.

## Priorisierte Findings

### Behoben – Persistierte Gruppenrotation wurde verworfen

**Status:** behoben; Rotation wird validiert, normalisiert und per Roundtrip-Test abgesichert.
**Evidenz:** `LayoutGroup` besitzt `rotation` (`src/domain/layoutEditing.ts:335-340`) und `cloneLayoutState()` kopiert sie (`src/domain/layoutHistory.ts:39-44`). `parseLayoutGroups()` erzeugt die Gruppe jedoch nur mit `id`, `children` und optional `autoLayout` (`src/domain/publisherDraft.ts:293-344`).

**Auswirkung:** Eine im Transform-Inspector gedrehte Gruppe kann in der laufenden Sitzung korrekt wirken, verliert ihre Drehung aber beim Laden eines Entwurfs, beim JSON-Import und beim Laden einer gespeicherten Vorlage. Das ist stiller Datenverlust.

**Empfehlung:** `rotation` validieren, normalisieren und in `parseLayoutGroups()` übernehmen. Roundtrip-Tests für tief verschachtelte Gruppen mit Rotation in Draft und Designvorlage ergänzen. Da dies ein persistiertes Schema betrifft, Migration und Versionsstrategie festlegen.

### Vorläufig behoben – Große lokale Bilder passten nicht zum Persistenzmodell

**Status:** Neue eigene Bild-Uploads sind deaktiviert und durch einen erklärenden Toast ersetzt. Dokumente und Vorlagen werden über CCM gespeichert; `localStorage` enthält nur noch die letzte Recovery-Kopie. Ein offizieller ChurchTools-Assetpfad bleibt offen.
**Evidenz:** Werkzeugleiste und Termindaten behalten die sichtbaren Bildaktionen, senden aber keine Datei mehr an einen `FileReader`; beide zeigen denselben Hinweis auf den kommenden ChurchTools-Upload. Der produktive Speicherpfad liegt hinter `PublisherRepository`, während `publisherRecovery.ts` genau ein Dokument lokal vorhält.

**Auswirkung:** Neu erzeugte Dokumente enthalten keine lokalen Bild-Data-URLs mehr. Bis ein offizieller Assetpfad existiert, können nur bereits in ChurchTools verfügbare Terminbilder und Bildvariablen eingesetzt werden.

**Empfehlung:** Den Upload erst wieder aktivieren, wenn CCM beziehungsweise eine andere offizielle ChurchTools-Domain stabile Asset-IDs, Berechtigungen und abrufbare Export-URLs anbietet. Die Wiki-Files-API nicht ohne bewusste Entscheidung als technischen Container zweckentfremden.

### Stabilisiert – Pinia war nicht die kanonische Editorquelle

**Status:** der persistierbare Seiten-/Layoutzustand, Historien und die seitengebundene Auswahl sind in Pinia zentralisiert; weitere fachliche Canvas-Actions können schrittweise aus `EventTemplate.vue` herausgezogen werden.
**Evidenz:** `App.vue` umfasst 1.140 Zeilen und hält Dokumentworkflow, Persistenz, Daten, Vorlagen und Export. Jede `EventTemplate.vue`-Instanz umfasst 2.878 Zeilen und besitzt eigene Refs für Geometrie, Reihenfolge, Stile, Gruppen, Effekte, Sichtbarkeit, Sperren, Auswahl und Historie. `PublisherWorkspaceContent.vue` spiegelt nur Events der aktiven Instanz in den Editor-Store und steuert sie später wieder über `defineExpose()`-Methoden (`src/components/publisher/PublisherWorkspaceContent.vue:47-70, 83-114`; `src/App.vue:1099-1123`).

**Auswirkung:** Ein Zustand kann gleichzeitig in drei Varianten existieren. Fehler werden zeitabhängig und schwer reproduzierbar; Undo, Seitenwechsel, Inspector und Canvas können auseinanderlaufen. Weitere Props, Emits und Sonderfälle erhöhen die Kopplung exponentiell.

**Empfehlung:** Einen `PublisherDocumentStore` mit benannten, undo-fähigen Actions als alleinige Quelle einführen. Auswahl seitenbezogen im Editor-Store halten. `EventTemplate` liest die aktive Seite und dispatcht Gesten; Inspector und Toolbar rufen dieselben Actions auf. Imperative Canvas-Methoden auf rein technische Operationen wie `exportImage()` und Fokus beschränken.

### Behoben – Auswahl konnte auf inaktiven Seiten sichtbar bleiben

**Status:** behoben und im Browsertest mit zwei Seiten abgesichert.
**Evidenz:** Beim Seitenwechsel wird nur `editorStore.clearSelectionState()` aufgerufen (`src/components/publisher/PublisherWorkspaceContent.vue:55-60`, `src/components/publisher/PublisherPagesPanel.vue:22-25`). Die vorherige `EventTemplate`-Instanz bleibt gemountet und ihr lokaler Auswahlzustand wird nicht geleert. Events inaktiver Seiten werden lediglich ignoriert.

**Auswirkung:** Handles oder Auswahlrahmen können auf einer nicht aktiven Seite bleiben, während der Inspector keine Auswahl anzeigt. Tastatur- und Kontextaktionen beziehen sich dann auf eine andere Zustandsquelle als die sichtbare Markierung.

**Empfehlung:** Auswahl in den gemeinsamen, seitenbezogenen Store verschieben oder beim Aktivieren einer Seite explizit `clearSelection()` auf allen anderen Instanzen ausführen. Browser-Integrationstest mit zwei Seiten ergänzen.

### Behoben – Gruppen waren Hierarchiemetadaten statt Canvas-Gruppen

**Status:** behoben; Ebenenbaum und Canvas projizieren denselben rekursiven Gruppenbaum.
**Evidenz:** Die Elementhierarchie liegt in `LayoutGroups`, die sichtbaren Elemente werden jedoch einzeln in der flachen Konva-Layerreihenfolge gerendert. `<v-group>` wird nur für nicht interaktive Dekorationsblöcke verwendet (`src/components/EventTemplate.vue:2749-2775`). Gruppentransformation berechnet und schreibt die Frames sämtlicher Kinder einzeln.

**Auswirkung:** Ebenenbaum, Z-Order und Szenengraph haben unterschiedliche Strukturen. Gruppendrag kann zwischen Snap-Zielen flackern, verschachtelte Transformationen werden aufwendig, und ein Schatten auf der Gruppe lässt sich nicht als gemeinsamer Außenumriss darstellen. Das vom Nutzer beschriebene Problem überlagernder Schatten innerhalb einer Gruppe ist mit Einzeleffekten systembedingt.

**Empfehlung:** Szenengraph auf rekursive Knoten umstellen: `GroupNode` enthält Kindknoten und eine lokale Transformationsmatrix. Für Gruppeneffekte die Gruppe als Einheit cachen beziehungsweise offscreen kompositieren. Migration vorhandener globaler Child-Frames sorgfältig planen und mit visuellen Tests absichern.

### Behoben – Designvorlagen speicherten nur die aktive Seite

**Status:** behoben durch Vorlagenbibliothek Version 2 samt Migration von Version 1 und Browser-Roundtrip.
**Evidenz:** `PublisherDesignTemplate` enthält `baseTemplateId`, genau ein `layout` und einen `imageFocus` (`src/domain/publisherDesignTemplate.ts:17-25`). Beim Speichern wird nur `templateRef.getLayoutState()` der aktiven Seite verwendet (`src/App.vue:603-624`); beim Anwenden wird nur diese Seite aktualisiert (`src/App.vue:642-660`).

**Auswirkung:** Der zentrale Produktfall „ein mehrseitiges Layout einmal gestalten und jeden Termin damit exportieren“ ist nur teilweise erfüllt. Seitengrößen, Reihenfolge und weitere Seiten fehlen in der Vorlage.

**Empfehlung:** Ein gemeinsames `PublisherDocumentTemplate` einführen, das Seiten samt Szenengraph, Größe, Reihenfolge und Bildfokus speichert. Beim Anwenden exakt diese Seiten ersetzen, aber den aktuellen Datenkontext erhalten. Bestehende einseitige Vorlagen migrieren, indem sie zu einer einseitigen Dokumentvorlage werden.

### Stabilisiert – Zwei parallele Vorlagenkonzepte verursachten Reset- und Leerzustandsfehler

**Status:** Standardvorlagen und gespeicherte Dokumentvorlagen bleiben zwei Katalogquellen, erzeugen aber denselben serialisierbaren Seiten-/Layoutzustand. Neue und zurückgesetzte Seiten verwenden eine eigene Blank-Factory.
**Evidenz:** `TemplateId` ist weiterhin auf `split | poster` beschränkt. Selbst eine leere Seite erzeugt den vollständigen Zustand eines eingebauten Templates und markiert dessen Elemente als gelöscht (`src/stores/publisherDocument.ts:17-33`). Daneben existiert die separate Bibliothek benutzerdefinierter Designvorlagen. `applyStandardTemplate()` leert den Seitenzustand und lässt ihn aus der eingebauten Definition neu entstehen (`src/App.vue:589-600`).

**Auswirkung:** „Leere Seite“, „Standardvorlage“, „Basistemplate“ und „gespeicherte Vorlage“ sind technisch verschiedene Sonderfälle. Das erklärt wiederkehrende Regressionen, bei denen eine Terminauswahl oder neue Seite versehentlich ein Standardlayout einsetzt.

**Empfehlung:** Eingebaute Layouts als Seed-Einträge desselben Dokumentvorlagenmodells behandeln. Eine leere Seite besitzt einen leeren Root-Szenengraphen, keine gelöschten unsichtbaren Standardknoten.

### Behoben – Entwurfsmodell widersprach der terminunabhängigen Arbeitsweise

**Status:** Dokumente besitzen eine eigene UUID, werden auch ohne Termin gespeichert und referenzieren einen Termin nur optional. Das Öffnen eines Dokuments ist eine eigene, explizite Aktion.
**Evidenz:** `PublisherDocumentRecord` enthält eine eigene UUID und eine nullable `PublisherAppointmentReference`. Der CCM-Adapter speichert Dokumente in `publisher_documents`, Vorlagen separat in `publisher_templates`; die Oberfläche bietet explizites Öffnen und einen Termin kann sie wieder lösen.

**Auswirkung:** Freie und terminbezogene Dokumente folgen demselben Speicherpfad. Ein Terminwechsel aktualisiert weiterhin nur den Datenkontext und öffnet kein anderes Dokument.

**Empfehlung:** Bei der kommenden CCM-API besonders Einzelabruf, serverseitige Filter, Eigentümer/Berechtigungen und atomare Revisionsprüfung ergänzen; der Repository-Vertrag kann diese Fähigkeiten später aufnehmen.

### Behoben – Entwurf löschen erzeugte ein implizites Standardlayout

**Status:** behoben; Zurücksetzen verwendet die zentrale Factory für eine leere transparente Seite.
**Evidenz:** `deleteLocalDraft()` erzeugt mit `createPublisherPage()` eine Seite ohne expliziten Blank-State (`src/App.vue:676-695`). Der Store verwendet dagegen `createBlankPage()` und löscht alle eingebauten Elemente (`src/stores/publisherDocument.ts:17-38`).

**Auswirkung:** Nach dem Löschen eines Entwurfs kann das eingebaute Layout wieder erscheinen. Das widerspricht dem transparenten Initialzustand und der Regel, dass Standardlayouts nur bewusst angewendet werden.

**Empfehlung:** ausschließlich eine zentrale `createBlankPage()`-Action verwenden. Löschen bestätigen, vom Zurücksetzen des aktuellen Dokuments trennen und idealerweise über Papierkorb/Undo wiederherstellbar machen.

### Behoben – Seitenvorschauen waren keine Vorschauen

**Status:** behoben; jede gemountete Canvas-Seite erzeugt verzögert eine kleine, nicht interaktive PNG-Vorschau ohne Auswahlrahmen oder Handles.
**Evidenz:** `EventTemplate.renderThumbnail()` rastert den aktuellen Szenengraphen unabhängig von der Zoomstufe. `PublisherWorkspaceContent` aktualisiert die abgeleiteten Vorschauen seitenbezogen nach Layout-, Daten- und Bildänderungen. `PublisherPagesPanel` zeigt diese Vorschau auf dem transparenten Karomuster.

**Auswirkung:** Seiten mit unterschiedlichen Inhalten und Formaten sind in der Übersicht direkt unterscheidbar. Die Data-URLs bleiben abgeleiteter UI-Zustand und werden nicht mit dem Dokument persistiert.

**Umsetzung:** Seitennamen, tiefes Duplizieren und Reihenfolge sind Store-Actions. Die Sortierung funktioniert per Drag-and-drop sowie über Pfeiltasten am Drag-Handle; Namen, Reihenfolge und Duplikate werden mit Dokumenten und Vorlagen gespeichert.

### Stabilisiert – Kritische Canvas-Flows hatten keine Browserabdeckung

**Status:** Playwright und eine erste kritische Chromium-Suite sind eingerichtet; reine Zoomberechnung und Statusleisten-Steuerung besitzen Komponententests. Pointer-Gesten für Randhandles, Panning, Export und visuelle Regressionen sollten noch ergänzt werden.
**Evidenz:** `PublisherZoomControls` und die Fit-Berechnung sind isoliert testbar. Sieben Playwright-Flows sind vorhanden. Für `EventTemplate.vue`, `App.vue`, `PublisherWorkspaceContent.vue`, `TemplateInspector.vue`, `LayoutEffectsDialog.vue` und die editierbaren Canvas-Elemente fehlen weiterhin gezielte isolierte beziehungsweise visuelle Tests.

**Auswirkung:** Genau die gemeldeten Fehler – Handles am Rand, Gruppendrag und Snapping, Trackpad-Zoom, Seitenwechsel, Canvas-/Ebenenhierarchie, Export mit realen Bildern – liegen außerhalb der verlässlichen Tests. jsdom simuliert Konva-Geometrie und Pointergesten nicht ausreichend.

**Empfehlung:** Playwright oder vergleichbaren Browserrunner einführen. Eine kleine risikobasierte Suite ist wertvoller als weitere flache Mount-Tests: leerer Start, Seite hinzufügen, Elementtransform am Rand, Gruppe verschieben/nesten, Seite wechseln, Termindaten austauschen, dynamisches Auto-Layout, PNG/JPEG-Export.

### Teilweise behoben – Persistenzversion blieb trotz Schemaänderungen auf 1

**Status:** Die Vorlagenbibliothek verwendet Version 2 mit expliziter V1-Migration. Das allgemeine Entwurfsformat ist weiterhin Version 1 und bleibt ein offener Migrationspunkt.
**Evidenz:** `src/domain/publisherDesignTemplate.ts` enthält die V1-zu-V2-Migration; `src/domain/publisherDraft.ts` verwendet noch Version 1.

**Auswirkung:** Kompatibilität beruht auf verteilten optionalen Defaults statt nachvollziehbaren Migrationen. Ein Parserfehler kann als „ungültig“ erscheinen, ohne klarzumachen, von welchem Schema migriert werden müsste.

**Empfehlung:** Zentrale, sequentielle Migrationen `v1 -> v2 -> ...`, Fixture-Dateien alter Versionen und Roundtrip-Tests. Version des Dokuments und Version der Vorlagenbibliothek getrennt halten.

### Behoben – Ein defekter Vorlageneintrag blockierte die gesamte Bibliothek

**Status:** behoben; Einträge werden einzeln gelesen und ungültige beziehungsweise doppelte Einträge isoliert.
**Evidenz:** `parsePublisherDesignTemplateLibrary()` gibt `null` zurück, sobald eine Vorlage ungültig ist oder eine ID doppelt vorkommt (`src/domain/publisherDesignTemplate.ts:63-88`). Danach verweigern Speichern und Löschen jede weitere Änderung (`src/domain/publisherDesignTemplate.ts:105-135`).

**Auswirkung:** Ein einziger alter oder beschädigter Eintrag kann alle Vorlagen aus der UI verschwinden lassen und neue Speicherungen verhindern. Dies ist ein plausibler Grund für den zuvor beobachteten UI-Fehler beim Vorlagenspeichern.

**Empfehlung:** Bibliothekscontainer validieren, Einträge einzeln parsen und ungültige Einträge quarantänisieren. Gültige Vorlagen weiter anbieten, Rohdaten als Backup erhalten und eine verständliche Reparaturmeldung zeigen.

### P1 – Verknüpftes Event kann durch das Listenlimit fehlen

**Status:** aus dem API-Zugriff abgeleitet.  
**Evidenz:** Zum Laden eines bekannten Event-IDs wird eine Tagesliste mit `limit: 99` geladen und anschließend clientseitig gesucht (`src/composables/useAppointmentRelatedData.ts:76-91`).

**Auswirkung:** Existieren mehr als 99 sichtbare Events an diesem Tag und liegt das verknüpfte Event außerhalb der ersten Seite, meldet die UI fälschlich „nicht verfügbar“. Eine Sortierung oder Pagination ist nicht berücksichtigt.

**Empfehlung:** bevorzugt einen direkten Event-Endpunkt oder API-Filter nach ID verwenden. Falls nicht verfügbar, paginieren, bis die ID gefunden oder die Liste erschöpft ist. Das Limit unter 100 beibehalten.

### P2 – `templateProps` ist immer vorhanden, mehrere Leerzustände sind tot

**Status:** im Code bestätigt.  
**Evidenz:** Der Computed-Wert liefert auch ohne Termin stets ein leeres Props-Objekt (`src/App.vue:230-237`). Dennoch prüfen Toolrail, Topbar, Kontextleiste und mehrere Actions `!templateProps`; `PublisherWorkspaceContent` enthält einen nicht erreichbaren Termin-Leerzustand (`src/components/publisher/PublisherWorkspaceContent.vue:73-80`).

**Auswirkung:** Der Code kommuniziert zwei widersprüchliche Zustandsmodelle. Deaktivierungslogik wird niemals aktiv und spätere Änderungen können den unerreichbaren, inhaltlich veralteten Zustand versehentlich wieder sichtbar machen.

**Empfehlung:** Props als nicht-nullbaren `PublisherDataContext` modellieren und tote `hasTemplate`-/`!template`-Zweige entfernen. Lade- und Fehlerzustände nur an einen tatsächlich ausgewählten Termin koppeln, ohne den freien Canvas zu blockieren.

### P2 – Bildabruf ist fest auf 1920 × 1080 zugeschnitten

**Status:** im Code bestätigt.  
**Evidenz:** `createPublisherImageUrl()` setzt immer `w=1920`, `h=1080`, `q=100` (`src/domain/mapAppointmentToTemplateProps.ts:24-40`), obwohl Seiten frei bis 8192 Pixel und in beliebigen Seitenverhältnissen angelegt werden können.

**Auswirkung:** Große Exporte können sichtbar unscharf werden. Quadratische oder extrem breite Seiten erhalten unter Umständen eine ungünstig vorbeschnittene Ressource, obwohl das Element später einen eigenen Cover-Zuschnitt berechnet.

**Empfehlung:** Asset-URL getrennt vom Datenmapping erzeugen und anhand des größten tatsächlichen Renderziels anfordern. Wenn die ChurchTools-Bild-API Seitenverhältnisse vorbeschneidet, nur eine ausreichend große Quelle oder passende Zielmaße pro Element laden und cachen.

### P2 – Verlaufshistorie und Autosave skalieren schlecht

**Status:** aus Implementierung abgeleitet.  
**Evidenz:** Bis zu 50 vollständige Layoutzustände werden tief kopiert. Gleichheit wird synchron über `JSON.stringify` geprüft (`src/domain/layoutHistory.ts:79-94`). Autosave ist zwar auf 800 ms entprellt und asynchron, sendet aber weiterhin das vollständige mehrseitige Dokument an CCM und schreibt eine vollständige Recovery-Kopie.

**Auswirkung:** Viele Elemente und verschachtelte Gruppen verursachen weiterhin unnötige Serialisierung, Netzwerkvolumen und Speicherverbrauch. Data-URL-Bilder werden nicht mehr neu erzeugt.

**Empfehlung:** Commands oder strukturell geteilte Patches für Undo verwenden und serverseitig Patch-/Revisionsoperationen vorsehen. Performancebudgets mit großen Testdokumenten messen.

### P2 – Weitere destruktive Aktionen umgehen Undo und Bestätigung

**Status:** im Code bestätigt.  
**Evidenz:** Seite entfernen (`src/App.vue:218-227`), Standardvorlage anwenden (`src/App.vue:589-600`), Designvorlage löschen (`src/App.vue:663-674`) und Entwurf löschen (`src/App.vue:676-701`) verändern Dokument oder Persistenz direkt. Eine Bestätigung oder Dokument-Undo ist nicht vorhanden.

**Auswirkung:** Nutzer können größere Arbeitsschritte nicht zuverlässig zurückholen. Die Canvas-Historie deckt nur Layoutänderungen innerhalb einer Template-Instanz ab.

**Empfehlung:** Dokumentweite Historie einführen. Persistente Löschungen bestätigen oder zunächst in einen wiederherstellbaren Papierkorb verschieben. Vorlagenanwendung als eine atomare Undo-Transaktion behandeln.

### P2 – Farbverlauf und „zuletzt benutzt“ sind nur Sitzungsspeicher

**Status:** im Code bestätigt.  
**Evidenz:** `publisherColors` hält die letzten zwölf Farben ausschließlich in einem Pinia-Ref (`src/stores/publisherColors.ts:4-23`). Analysierte Bildpaletten und Status sind ebenfalls nur Laufzeitzustand (`src/stores/publisherImagePalettes.ts:15-77`).

**Auswirkung:** „Zuletzt benutzt“ ist nach Reload leer. Paletten müssen neu analysiert werden; Vorlagen mit Bindung funktionieren über Fallback und automatische Analyse, wirken bis dahin aber potenziell anders.

**Empfehlung:** Letzte Farben klein und versioniert lokal persistieren. Extraktionsresultate über einen stabilen Hash von Bildquelle/Algorithmus cachen, während dynamische Bindungen weiterhin nur Token plus Fallback speichern.

### P2 – Datenformatierung ist für Template-Automation noch zu begrenzt

**Status:** Funktionslücke.  
**Beobachtung:** Datum und Zeit besitzen visuelle Formate. Skalarwerte können als Text, Bild oder QR eingesetzt werden. Es fehlen jedoch robuste Fallbacks, Bedingungen, Zahlen-/Währungsformate, Listen-/Repeater, Auswahl einzelner Dienste/Personen und kontrollierte Verkettungen.

**Auswirkung:** Für viele reale Folien muss der Nutzer Werte vorher in ChurchTools passend vorbereiten oder mehrere Sondervariablen anlegen. Wiederholte Inhalte wie mehrere Dienstpersonen lassen sich nicht als gestaltete Liste mit einem Element pro Person ausgeben.

**Empfehlung:** Kleine, versionierte Ausdruckssyntax statt immer neuer Sonderfelder: `{{date | date:'dd.MM.'}}`, `{{location | default:'Ort folgt'}}`, sichere Listen-Pipelines und ein Repeat-Container. Keine freie JavaScript-Auswertung.

### P2 – Stammdatenfehler werden still verschluckt

**Status:** im Code bestätigt.  
**Evidenz:** Fehler beim Laden von `/event/masterdata` werden in `useAppointmentRelatedData` zu `undefined` konvertiert (`src/composables/useAppointmentRelatedData.ts:64-73`). Danach erscheinen generische Dienstnamen als Fallback, ohne Hinweis, dass die lesbare Auflösung fehlgeschlagen ist.

**Auswirkung:** Daten sehen vollständig geladen aus, können aber unverständlich oder falsch gruppiert sein. Diagnose in Supportfällen ist schwierig.

**Empfehlung:** Teilfehler separat im Datenquellenstatus ausweisen und Retry anbieten. Fallbackwerte weiter rendern, aber nicht als vollständig erfolgreichen Zustand kennzeichnen.

### P2 – HTML-zu-Text-Konvertierung ist unvollständig

**Status:** im Code bestätigt.  
**Evidenz:** Notizen werden per Regex von Tags bereinigt; nur `&nbsp;` und `&amp;` werden dekodiert (`src/domain/appointmentRelatedData.ts:35-43`).

**Auswirkung:** Entitäten wie `&quot;`, `&lt;` oder numerische Entities können sichtbar bleiben. Blockelemente können ohne sinnvolle Absatzgrenzen zusammenfallen.

**Empfehlung:** Im Browser einen sicheren HTML-Parser verwenden, blockbezogene Zeilenumbrüche kontrolliert übernehmen und Tests für Entities, Listen und verschachtelte Tags ergänzen.

### P2 – Responsive Layout blendet zentrale Bedienung ersatzlos aus

**Status:** CSS bestätigt.  
**Evidenz:** Unter 681 Pixeln werden linke Seitenübersicht und rechter Inspector mit `display: none` entfernt; sichtbar bleiben nur Werkzeugleiste und Arbeitsfläche (`src/components/PublisherEditorShell.vue:115-128`). Zwischen 681 und 1100 Pixeln bleiben feste 54 + 160 + 310 Pixel Seitenbereiche, bevor mindestens 320 Pixel Arbeitsfläche folgen (`src/components/PublisherEditorShell.vue:131-135`).

**Auswirkung:** Auf kleinen Displays sind Seitenwahl und Eigenschaften nicht erreichbar. Auf Tablets ist die Arbeitsfläche sehr schmal. Die Anwendung ist dort zwar gerendert, aber nicht funktional responsiv.

**Empfehlung:** Seiten und Inspector als Drawer/Sheets zugänglich machen, Toolrail einklappbar gestalten und Breakpoints anhand echter Mindestbreiten testen.

### P2 – Modale Komponenten und Tabs sind nicht vollständig zugänglich

**Status:** Code-Audit.  
**Evidenz:** Terminauswahl verwendet ein natives `<dialog>`, Seiten-, Export-, Daten- und Effektdialoge verwenden dagegen individuelle `div`-Backdrops mit `role="dialog"`. Fokusfalle, initialer Fokus und Rückgabe an den Auslöser sind nicht zentral implementiert. `DesignTabs` setzt `role="tab"` und `aria-selected`, aber keine `aria-controls`, Panel-Verknüpfung, roving `tabindex` oder Pfeiltasten (`src/components/design/DesignTabs.vue:11-22`).

**Auswirkung:** Tastatur- und Screenreader-Nutzung ist inkonsistent; Fokus kann hinter einen offenen Dialog geraten oder nach Schließen verloren gehen.

**Empfehlung:** Gemeinsames Dialog-Primitiv und vollständiges Tabs-Primitiv bauen. Mit axe-core und echter Tastaturnavigation testen.

### P2 – Ebenen-Drag-and-drop ist nicht tastaturbedienbar

**Status:** UI-Lücke.  
**Beobachtung:** Sortieren und Verschachteln erfolgen über HTML5-Drag-and-drop und ein sichtbares Handle. Es gibt keine äquivalenten Tastaturaktionen zum Verschieben vor/nach/in eine Gruppe.

**Auswirkung:** Die zentrale Hierarchiebearbeitung bleibt Nutzern ohne präzise Zeigerbedienung verschlossen.

**Empfehlung:** Aktionen „nach oben“, „nach unten“, „in Gruppe“, „aus Gruppe“ im Ebenen-Popover anbieten und Live-Region-Feedback ergänzen.

### P2 – Canvas-Inhalte besitzen keine semantische Alternative

**Status:** konzeptionelle Lücke.  
**Beobachtung:** Konva rendert in ein Canvas; Elemente und Auswahl sind für Screenreader nicht als bearbeitbare Objekte vorhanden. Der Ebenenbaum könnte diese Rolle übernehmen, bietet aber noch keine vollständige Tastaturbearbeitung.

**Empfehlung:** Ebenenbaum als zugängliche strukturelle Repräsentation ausbauen: Name/Wert, Typ per Icon plus zugänglichem Label, Zustand, Position, Auswahl, Umordnung und Inspector-Verknüpfung.

### P2 – Monolithische Dateien bremsen Änderungen

**Status:** Metrik bestätigt.  
**Evidenz:** `EventTemplate.vue` 2.878 Zeilen, `styles.css` 3.835, `App.vue` 1.140, `layoutEditing.ts` 1.143, `publisherDraft.ts` 651 und `LayoutInspector.vue` 489. In den UI-/Domain-Dateien existieren rund 245 direkte Hex-Farbwerte; Design-Tokens decken Abstände, Radien und Typografie nur teilweise ab.

**Auswirkung:** Fachgrenzen verschwimmen, Merge-Konflikte nehmen zu, Tests erfordern große Setups und kleine UI-Abweichungen entstehen leicht.

**Empfehlung:** nicht rein nach Dateilänge schneiden, sondern nach Verantwortungen:

- `App.vue`: Dokumentcontroller, Datenkontext, Persistenzservice und Exportservice trennen
- `EventTemplate.vue`: Selection, Gestures, Transform, Groups, Assets, Export und rekursive Renderer
- `layoutEditing.ts`: Knotenmodell, Geometrie/Snapping, Layerbaum, Gruppen/Auto-Layout und Elementfactory
- `publisherDraft.ts`: Schemas und Migrationen je Version
- `styles.css`: Tokens, Shell, Canvas, Inspectoren, Dialoge und einzelne Komponenten

### P2 – README und Plan beschreiben einen früheren Prototyp

**Status:** bestätigt.  
**Evidenz:** README nennt zwei feste 1920-×-1080-Templates, maximal drei Textfelder und PNG-Einzelexport. Heute existieren freie Mehrseitenformate, zahlreiche Elemente, Variablen, Gruppen, dynamische Farben, Effekte und ZIP-Export. `PUBLISHER_LAYOUT_PLAN.md` enthält viele offene Checkboxen für längst umgesetzte Funktionen und ein veraltetes Zielbild.

**Auswirkung:** Neue Entwickler treffen falsche Annahmen und können alte Architekturentscheidungen versehentlich reaktivieren.

**Empfehlung:** README auf Setup und aktuelle Architektur reduzieren, Historie in Changelog/ADR verschieben und den alten Plan archivieren oder als „historisch“ markieren. `docs/todos.md` in priorisierten Produktbacklog überführen.

### P2 – Produktionsreife des Extension-Pakets ist nicht dokumentiert

**Status:** Repository-Audit.  
**Evidenz:** Paketversion ist `0.0.1`; es fehlen Changelog, Lizenzdatei, Store-Metadaten und ein dokumentierter Release-/Rollback-Prozess. `scripts/package.js` nutzt das Systemkommando `zip` und paketiert nur `dist/` (`package.json:1-12`, `scripts/package.js:26-67`).

**Auswirkung:** Veröffentlichungen sind schwer reproduzierbar, Plattformabhängigkeit bleibt unbemerkt und Store-Angaben können vom Produkt abweichen.

**Empfehlung:** SemVer, Changelog, Lizenz, reproduzierbares Node-basiertes Packaging, Release-Checkliste und automatisierte Artefaktprüfung ergänzen. Die neue Datei `EXTENSION_STORE.md` dient als inhaltliche Basis.

### P2 – Abhängigkeitswarnungen müssen vor Veröffentlichung geklärt werden

**Status:** `npm audit --omit=dev` am 7. September 2026.  
**Ergebnis:** sechs bekannte Schwachstellen, davon eine hohe und fünf mittlere. Die hohe Meldung betrifft `nanoid@3.3.16` über PostCSS/Vue/Vite. Die mittleren Meldungen betreffen `file-type@16.5.4` über `@jimp/core` und `node-vibrant`.

**Auswirkung:** Der konkret ausnutzbare Pfad im reinen Browserbundle wurde in diesem Audit nicht bewiesen, aber ein Store-Release sollte keine ungeprüften High-Severity-Warnungen enthalten.

**Empfehlung:** reguläres `npm audit fix` für kompatible Updates prüfen. Kein blindes `--force`: npm schlägt für den Vibrant-Pfad eine potenziell brechende Änderung vor. Da `node-vibrant/browser` verwendet wird, Browserbundle und transitive Node-Bilddecoder getrennt bewerten oder eine browserfokussierte Alternative wählen.

### P2 – Entwicklungszugangsdaten verwenden clientseitig sichtbare `VITE_*`-Variablen

**Status:** im Code bestätigt.  
**Evidenz:** `VITE_USERNAME` und `VITE_PASSWORD` werden in `src/main.ts` gelesen und im Development-Modus an `/login` gesendet (`src/main.ts:20-25`). Vite exponiert `VITE_*` grundsätzlich an Clientcode.

**Auswirkung:** Bei falsch konfiguriertem Build oder geteiltem Dev-Bundle können Zugangsdaten aus dem JavaScript beziehungsweise den Devtools gelesen werden. `.env` ist zwar ignoriert, das löst das Auslieferungsrisiko nicht.

**Empfehlung:** lokale Session manuell aufbauen oder einen serverseitigen Dev-Proxy verwenden. Mindestens Buildcheck ergänzen, der gesetzte Zugangsdaten außerhalb eines eindeutig lokalen Modus ablehnt.

### P3 – Export ist funktional, aber noch kein wiederverwendbarer Export-Workflow

**Status:** Funktionslücke.  
**Evidenz:** Unterstützt werden nur PNG/JPEG (`src/domain/publisherExport.ts:1-15`), immer gesammelt als ZIP (`src/App.vue:915-955`). Exportprofile, Dateinamen, PDF/SVG, Fortschrittswert und Abbruch fehlen.

**Empfehlung:** zuerst Exportpresets mit Seitenwahl, Format, Qualität und Namensschema speichern. PDF eignet sich für mehrseitige Dokumente, benötigt aber Tests für Fonts, Transparenz, Beschnitt und Rasterbilder. SVG ist bei Canvas-Filtern, QR, Bildern und Texteffekten kein verlustfreier Selbstläufer und sollte nicht ohne klar definierte Raster-Fallbacks beworben werden.

### Teilweise behoben – Seitenverwaltung

**Status:** Namen, echte Thumbnails, Duplizieren und Sortieren sind umgesetzt.
**Beobachtung:** Seiten können angelegt, aktiviert, inline benannt, tief dupliziert, gelöscht und per Drag-and-drop oder Tastatur sortiert werden. Aktionen verwenden Font-Awesome-Icons. Mehrfachauswahl und eine nachträgliche Größenänderung fehlen weiterhin.

**Empfehlung:** Für die nachträgliche Größenänderung zuerst ausdrücklich zwischen „Inhalt beibehalten“, „proportional skalieren“ und „an neue Seite anpassen“ unterscheiden. Mehrfachauswahl erst mit einem konkreten seitenübergreifenden Anwendungsfall ergänzen.

### P3 – Canvas-Navigation ist teilweise ausgebaut

**Status:** Kernnavigation umgesetzt, Komfortfunktionen offen.
**Beobachtung:** Zoom und Scrollen werden jetzt durch ein dauerhaftes Handwerkzeug, temporäres Panning per Leertaste, „Seite einpassen“, „Auswahl einpassen“ und einen 100-Prozent-Sprung ergänzt. Die Befehle zentrieren den relevanten Dokumentpunkt, ohne Dokumentgeometrie zu verändern. Transformer-Griffe und -Konturen bleiben in Bildschirmkoordinaten konstant; Griffe an geraden Seitenrändern werden nach innen gesetzt und besitzen eine größere Trefferfläche. Mini-Navigator, Lineale und Hilfslinien fehlen weiterhin. Verlaufsausrichtung besitzt nur Zahlenfelder, keine Handles auf dem Canvas.

**Empfehlung:** Als nächsten direkten Canvas-Ausbau Gradientenhandles umsetzen. Mini-Navigator, Lineale und Hilfslinien erst nach einem konkreten Arbeitsablauf priorisieren.

### P3 – Effekte decken Konva-Filter noch nicht ab

**Status:** gewünschter Backlog.  
**Beobachtung:** Schatten, Blur, Deckkraft und Blendmodus sind vorhanden. Anpassungs-/Filterebenen für Helligkeit, Kontrast, HSL, Entsättigung, Invertieren, Pixelate oder Noise fehlen. Der Nutzer wünscht dafür einen separaten Footer-Einstieg.

**Empfehlung:** Filter nicht als beliebige Kindeffekte modellieren. Erst Szenengraph und Caching klären, dann einen typisierten Filterstack pro Knoten oder echter Filterebene mit stabiler Reihenfolge einführen.

### P3 – Visuelle Details sind noch uneinheitlich

**Status:** lokaler UI- und Code-Audit.  
**Beobachtungen:**

- Seiten hinzufügen/löschen und Dialog schließen nutzen teilweise `＋`/`×` statt Font Awesome.
- Native `<details>`-Popover für Ebenen und Ausrichtung haben keine gemeinsame Outside-click- und Fokuslogik.
- „Zurücksetzen“ und „Einrasten“ bleiben in der zweiten Leiste, obwohl Zurücksetzen laut Backlog entfernt werden soll und die Bedeutung von Einrasten nicht erklärt wird.
- Transformieren bleibt korrekt sichtbar und deaktiviert, könnte aber noch dichter sein.
- Der Hauptcanvas ist bei festen Seitenleisten auf kleinen Desktopbreiten schnell stark beschnitten.
- `index.html` deklariert `lang="en"`, obwohl die Oberfläche deutsch ist, und setzt für den Standalone-Entwicklungsfall `body class="dark"` fest.

**Empfehlung:** Glyphen durch gemeinsame Icon-Buttons ersetzen, Popover-Primitiv einführen, Snapping per Tooltip erläutern, überflüssigen Reset entfernen, `lang="de"` setzen und Dark Mode ausschließlich aus der Hostumgebung beziehungsweise einer klaren lokalen Simulation beziehen.

## Bereits gute Entscheidungen

Die Analyse soll nicht nur Defizite festhalten. Mehrere Grundlagen sind solide und sollten erhalten werden:

- TypeScript läuft mit `strict`, `noUnusedLocals`, `noUnusedParameters` und `noFallthroughCasesInSwitch`.
- Pure Domainmodule besitzen meist gezielte Grenz- und Parser-Tests.
- API-Daten werden vor dem Canvas in kleinere Publisher-Modelle übersetzt.
- Dokumentkoordinaten bleiben unabhängig von der Vorschau-Skalierung.
- Bilder werden proportional im Cover-Modus zugeschnitten; QR-Codes und Icons werden gegen Verzerrung geschützt.
- Dynamische Farbbindungen speichern Token plus Fallback und werden erst beim Rendern aufgelöst. Das ist die richtige Grundlage für datenabhängige Vorlagen.
- Bildpaletten werden entfernt, sobald die Bildquelle nicht mehr existiert; ein Quellenwechsel invalidiert das alte Ergebnis.
- JSZip wird erst beim Export dynamisch geladen.
- Export prüft die tatsächliche Pixelgröße jeder Seite.
- Object-URLs für lokale Ersatzbilder werden wieder freigegeben.
- Der Farbwähler wird per `Teleport` außerhalb der scrollenden Inspectoren gerendert.
- Design-Buttons, Icon-Buttons, Tabs und Panel-Header wurden bereits als gemeinsame Komponenten begonnen.
- Terminwechsel überschreibt das aktuelle Layout inzwischen ausdrücklich nicht mehr.
- Verknüpfte Daten werden datensparsam erst auf Nutzeraktion geladen.

## Empfohlene Umsetzungsreihenfolge

### Phase 1 – Datenverlust und Regressionen verhindern

1. Gruppenrotation im Parser korrigieren und Roundtrip-Test ergänzen.
2. Auswahl beim Seitenwechsel vollständig bereinigen.
3. Blank-Page-Erzeugung zentralisieren; Entwurf löschen darf kein Standardlayout einsetzen.
4. Vorlagenbibliothek fehlertolerant laden und konkrete Quota-/Parserfehler anzeigen.
5. Browser-Smoke-Suite für diese vier Fehler ergänzen.

### Phase 2 – Dokumentmodell konsolidieren

1. `PublisherDocument` und rekursiven `SceneNode` definieren.
2. Dokumentoperationen in Store-Actions verschieben.
3. Auswahl, aktive Gruppe und Historie seitenbezogen im Store ablegen.
4. `EventTemplate` schrittweise auf Storeprojektion und Gestenadapter reduzieren.
5. Explizite Persistenzmigrationen einführen.

### Phase 3 – Vorlagen und Assets produktionsfähig machen

1. Mehrseitige Dokumentvorlagen einführen und alte Vorlagen migrieren.
2. Eingebaute Vorlagen in dasselbe Modell überführen.
3. Bilder in IndexedDB/Asset-Store verschieben.
4. Dokumentautosave ohne Termin und explizites Öffnen terminbezogener Entwürfe anbieten.
5. ~~Echte Seiten-Thumbnails generieren.~~ Umgesetzt, einschließlich Benennen, Duplizieren und Sortieren.

### Phase 4 – Gruppen, Effekte und Automation

1. Rekursive Konva-Gruppen mit lokalen Koordinaten und Transformmatrizen rendern.
2. Gruppensnapping und Gruppentransform stabilisieren.
3. gemeinsame Gruppeneffekte über Cache/Offscreen-Komposition implementieren.
4. Filterstack und Anpassungsebenen ergänzen.
5. Variablensyntax um sichere Fallback-, Listen- und Repeaterfunktionen erweitern.

### Phase 5 – Store- und Release-Reife

1. Responsive Drawer und vollständige Tastaturbedienung.
2. Dialog-/Popover-/Tabs-Primitiven plus Accessibility-Audit.
3. Exportpresets, PDF-Evaluierung und Fortschritt/Abbruch.
4. Abhängigkeitswarnungen, Lizenz, Versionierung, Changelog und reproduzierbares Packaging klären.
5. README und Screenshots aktualisieren; Store-Text aus `EXTENSION_STORE.md` final redaktionell prüfen.

## Vorgeschlagene Qualitätskriterien für eine erste Store-Version

- keine bekannten stillen Datenverluste in Draft-/Template-Roundtrips
- mehrseitige Vorlagen oder eine klar kommunizierte Einseitenbeschränkung
- Autosave/Recovery auch ohne ausgewählten Termin
- reproduzierbare Canvas-Flows für Gruppen, Randhandles, Seitenwechsel und Zoom
- mindestens ein echter Browser-E2E-Test je kritischem Workflow
- vollständige Tastaturbedienung außerhalb der direkten Canvasmanipulation; Ebenenbaum als Alternative
- verständliche Fehler für API, Bildladen, Palette, Speicherquota und Export
- keine ungeklärte High-Severity-Abhängigkeitswarnung
- aktuelle README, Changelog, Lizenz und belastbare Store-Metadaten

## Verifikation dieses Audits

Am untersuchten Stand:

- `npm test`: 38 Dateien, 199 Tests erfolgreich
- `npm run test:e2e`: 7 Browsertests erfolgreich
- `npm run typecheck`: erfolgreich
- `npm run build`: erfolgreich
- Vite meldet einen Hauptchunk von ungefähr 538 KB minifiziert beziehungsweise 166 KB gzip; Konva, ChurchTools, Vue und JSZip liegen in eigenen Chunks
- `npm audit --omit=dev`: 6 Meldungen, davon 1 hoch und 5 mittel

Die Metriken sind Momentaufnahmen. Nach Änderungen an Abhängigkeiten oder Build-Splitting müssen sie neu erhoben werden.
