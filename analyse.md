# Technische und konzeptionelle Analyse des ChurchTools Publisher

Stand: 9. September 2026
Untersuchter Stand: fortgeschriebener Arbeitsstand einschließlich Canvas-Refactoring, Datenautomation und UI-Grundlagen
Status: Audit plus Umsetzung der priorisierten Architektur-, Persistenz-, Automations- und Bediengrundlagen

## Kurzfazit

Der Publisher ist kein kleiner Prototyp mehr, auch wenn Teile des Datenmodells noch aus dieser Phase stammen. Er ist bereits ein umfangreicher Mehrseiten-Editor mit eigener Szenenlogik, Hierarchie, Auto-Layout, Datenbindungen, dynamischen Farben, Effekten, CCM-Persistenz und Export-Pipeline. Die fachliche Breite ist gut erkennbar und viele pure Domain-Funktionen sind ordentlich getestet.

Die zuvor größten strukturellen Risiken wurden gezielt reduziert: Der persistierbare Dokumentzustand und die Auswahl besitzen kanonische Stores, Vorlagen bilden vollständige Mehrseitendokumente ab, Gruppen werden als echte Canvas-Knoten gerendert und persistierte Formate besitzen explizite Migrationen. Sichere Variablen-Pipelines und Repeat-Gruppen decken die erste Template-Automation ab; gemeinsame Popover/Tabs, Ebenentastatur und responsive Drawer stabilisieren die Bedienung. Die verbleibenden Hauptrisiken liegen in der Größe des Canvas-Orchestrators, der Speicherung großer Bild-Assets, der Performance vollständiger Dokument-Snapshots und der noch schmalen visuellen Regressionstest-Abdeckung.

Vor einem weiteren größeren Feature-Ausbau wurden vier Fundamente stabilisiert:

1. Pinia als kanonische Dokument- und Auswahlquelle, seitenbezogen und über Store-Actions verändert.
2. Ein einheitliches mehrseitiges Vorlagenmodell anstelle der parallelen Welt aus zwei eingebauten Templates und einseitigen Designvorlagen.
3. Ein echter Canvas-Szenengraph für Gruppen, damit Hierarchie, Transformation, Snapping und Gruppeneffekte dieselbe Semantik haben.
4. Browserbasierte Tests für die Interaktionen, die Unit- und jsdom-Komponententests nicht zuverlässig abdecken.

## Umsetzungsstand der vier Fundamente

1. **Kanonischer Pinia-Zustand:** Seiten, aktive Seite, serialisierbare Layouts und eine chronologische Dokumenthistorie liegen nun im `PublisherDocumentStore`. Die Historie umfasst Canvas-Änderungen, Seitenoperationen und atomare Vorlagenanwendungen; Öffnen und Neuanlegen setzen sie zurück. Die Auswahl ist mit einer aktiven Seiten-ID im `PublisherEditorStore` gebunden. Gemountete Canvas-Seiten besitzen keine parallele persistierbare Layout- oder Auswahlkopie mehr.
2. **Mehrseitige Vorlagen:** Die Vorlagenbibliothek verwendet Schema-Version 4 und speichert vollständige Dokumente mit allen Seiten, Größen, Layouts, Gruppen, Repeat-Bindungen, Bildfokussen und aktiver Seite. Alte Bibliotheken und einseitige Version-1-Vorlagen werden beim Lesen migriert; ein defekter Einzeleintrag blockiert nicht mehr die restliche Bibliothek.
3. **Rekursiver Canvas-Szenengraph:** `LayoutGroup` wird rekursiv als echter Konva-Gruppenknoten gerendert. Gruppendrag bewegt einen Container und schreibt erst am Ende die Kindgeometrie zurück. Gruppenrotation ist persistierbar. Schatten, Unschärfe, Deckkraft und Mischmodus können am kompositierten Gruppenknoten liegen, ohne die Effekte auf Kinder zu kopieren.
4. **Browser-Regressionstests:** Playwright mit Chromium ist eingerichtet. Die Suite prüft leeren Start, frei dimensionierte leere Seiten, seitengebundene Auswahl, Gruppenziel/-effekte, den Roundtrip einer mehrseitigen Dokumentvorlage, Upload-Platzhalter, terminunabhängiges Speichern und responsive Drawer.

Diese Umsetzung beseitigt nicht alle nachfolgenden Findings. Insbesondere ein offizieller ChurchTools-Assetpfad und weitere visuelle Regressionstests bleiben eigenständige Ausbauschritte.

## Bewertungsübersicht

| Bereich | Einschätzung | Begründung |
|---|---|---|
| Funktionsumfang | stark | Mehrere Seitengrößen, Canvas-Elemente, Termindaten, Bindungen, Gruppen, Auto-Layout, Farben, Effekte und Export sind vorhanden. |
| Domain-Modell | mittel bis gut | Seiten, Layouts und rekursive Gruppen besitzen gemeinsame serialisierbare Modelle; einige ältere Spezialpfade und der große Canvas-Orchestrator bleiben. |
| Zustandsmanagement | mittel bis gut | Pinia ist die kanonische Quelle für Dokument, Historie und seitengebundene Auswahl; lokale UI-Zustände bleiben bewusst in Komponenten. |
| Persistenz | mittel bis gut | Dokumente und terminneutrale Vorlagen verwenden eine austauschbare CCM-Repository-Schicht; `localStorage` enthält nur eine Recovery-Kopie. Der offizielle Assetpfad ist noch offen. |
| Canvas-Interaktion | mittel bis gut | Echte rekursive Gruppen, konstante Transformer-Griffe, Panning und Fit-Ansichten stabilisieren die Kernpfade; weitere komplexe Pointer- und DnD-Szenarien fehlen noch. |
| UI-Konsistenz | mittel bis gut | Design-Komponenten, gemeinsame Popover/Tabs und responsive Drawer vereinheitlichen den Grundaufbau; ältere Spezialdialoge und der große globale Stilbestand bleiben. |
| Barrierefreiheit | mittel | Beschriftungen, Fokusführung, Tabs, Drawer und Ebenentastatur sind vorhanden; der Canvas selbst besitzt noch keine vollständige semantische Alternative. |
| Testabdeckung | mittel bis gut | 59 Vitest-Dateien mit 276 Tests sowie acht grüne Playwright-Kernflüsse; visuelle und breitere Interaktionsregressionen fehlen noch. |
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
- aktive Seite, dokumentweites Undo/Redo und Tastatur-Nudging

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
**Evidenz:** `parseLayoutGroups()` akzeptiert nur endliche Rotationswerte und normalisiert sie beim Einlesen. `cloneLayoutState()` übernimmt die Rotation; Draft-, Vorlagen- und Dokument-Migrationstests decken den Roundtrip einschließlich verschachtelter Gruppen ab.

**Auswirkung:** Gedrehte Gruppen behalten ihre Rotation beim Recovery-Laden, JSON-Import und Vorlagen-Roundtrip. Nicht endliche Werte werden als beschädigte Persistenzdaten abgewiesen.

**Empfehlung:** Bei weiteren Gruppentransformationen denselben versionierten Parser- und Roundtrip-Pfad verwenden; keine Canvas-Transformwerte außerhalb des serialisierbaren Gruppenmodells ergänzen.

### Vorläufig behoben – Große lokale Bilder passten nicht zum Persistenzmodell

**Status:** Neue eigene Bild-Uploads sind deaktiviert und durch einen erklärenden Toast ersetzt. Dokumente und Vorlagen werden über CCM gespeichert; `localStorage` enthält nur noch die letzte Recovery-Kopie. Ein offizieller ChurchTools-Assetpfad bleibt offen.
**Evidenz:** Werkzeugleiste und Termindaten behalten die sichtbaren Bildaktionen, senden aber keine Datei mehr an einen `FileReader`; beide zeigen denselben Hinweis auf den kommenden ChurchTools-Upload. Der produktive Speicherpfad liegt hinter `PublisherRepository`, während `publisherRecovery.ts` genau ein Dokument lokal vorhält.

**Auswirkung:** Neu erzeugte Dokumente enthalten keine lokalen Bild-Data-URLs mehr. Bis ein offizieller Assetpfad existiert, können nur bereits in ChurchTools verfügbare Terminbilder und Bildvariablen eingesetzt werden.

**Empfehlung:** Den Upload erst wieder aktivieren, wenn CCM beziehungsweise eine andere offizielle ChurchTools-Domain stabile Asset-IDs, Berechtigungen und abrufbare Export-URLs anbietet. Die Wiki-Files-API nicht ohne bewusste Entscheidung als technischen Container zweckentfremden.

### Stabilisiert – Pinia war nicht die kanonische Editorquelle

**Status:** der persistierbare Seiten-/Layoutzustand, Historien und die seitengebundene Auswahl sind in Pinia zentralisiert. Auswahl, Transformer, Transformationen, Gruppen/Auto-Layout und Elementstile sind aus `EventTemplate.vue` in getestete Composables verschoben.
**Evidenz:** `App.vue` umfasst weiterhin mehr als 1.200 Zeilen und hält Dokumentworkflow, Persistenz, Daten, Vorlagen und Export. `EventTemplate.vue` ist von 3.024 auf ungefähr 1.870 Zeilen gesunken, liest den serialisierbaren Layoutzustand über Store-Proxies und bindet die Auswahl an den Editor-Store. Die öffentliche Komponentenoberfläche besteht nur noch aus dem gebündelten `commands`-Adapter sowie `exportImage()` und `renderThumbnail()`.

**Auswirkung:** Die widersprüchlichen persistierbaren Zustandskopien sind beseitigt und zentrale Canvas-Verhalten sind isoliert testbar. `App.vue` benötigt den imperativen Befehlsadapter für die gemountete Seitendarstellung aber weiterhin.

**Empfehlung:** Neue fachliche Operationen zuerst als pure Domainfunktion beziehungsweise Store-Action implementieren. Den verbleibenden `commands`-Adapter schrittweise auf Operationen reduzieren, die tatsächlich eine gemountete Konva-Instanz benötigen.

### Behoben – Auswahl konnte auf inaktiven Seiten sichtbar bleiben

**Status:** behoben und im Browsertest mit zwei Seiten abgesichert.
**Evidenz:** Der Editor-Store ordnet die Canvas-Auswahl einer `activeCanvasPageId` zu und leert sie atomar beim Seitenwechsel. Jede `EventTemplate`-Instanz projiziert Auswahl und Gruppenauswahl nur, wenn ihre eigene Seiten-ID aktiv ist. Der Playwright-Flow „keeps canvas selection scoped to the active page“ prüft Inspector und sichtbaren Zustand über zwei Seiten.

**Auswirkung:** Inaktive Seiten rendern keine veralteten Handles oder Auswahlrahmen; Inspector, Tastaturaktionen und Canvas beziehen sich auf dieselbe aktive Seite.

**Empfehlung:** Künftige Auswahlzustände wie Hilfslinien oder Unterauswahl ebenfalls explizit an eine Seiten-ID binden und den vorhandenen Browsertest erweitern.

### Behoben – Gruppen waren Hierarchiemetadaten statt Canvas-Gruppen

**Status:** behoben; Ebenenbaum und Canvas projizieren denselben rekursiven Gruppenbaum.
**Evidenz:** `CanvasSceneTree.vue` rendert den von `buildLayoutLayerTree()` abgeleiteten Baum rekursiv. `EditableLayoutGroup.vue` stellt jede Gruppe als echten Konva-Container dar; verschachtelte Gruppen, Repeat-Instanzen, Rotation, Sperren, Effekte und Filter folgen demselben Szenengraphen. Der Ebenenbaum verändert dieses gemeinsame Gruppenmodell.

**Auswirkung:** Ebenenbaum, Z-Order und Canvas besitzen dieselbe Hierarchie. Gruppen werden gemeinsam bewegt und für Effekte beziehungsweise Filter als eine Einheit kompositiert, sodass überlappende Kinder keinen separaten Innenschatten erhalten.

**Empfehlung:** Die globale persistierte Kindgeometrie und lokale Konva-Projektion bei weiteren Transformationsarten nicht vermischen. Komposition und Cache-Verhalten großer, tief verschachtelter Effektgruppen gezielt messen.

### Behoben – Designvorlagen speicherten nur die aktive Seite

**Status:** behoben durch Vorlagenbibliothek Version 4 samt Migration der unterstützten Vorgängerversionen und Browser-Roundtrip.
**Evidenz:** `PublisherDesignTemplate` enthält alle `pages` und die `activePageId`. Jede Seite wird tief mit Größe, Name, Layouts, Szenengraph und Bildfokus gespeichert. Beim Anwenden ersetzt der Dokument-Store alle Vorlagenseiten in einem undo-fähigen Schritt, während der Termin-Datenkontext unverändert bleibt.

**Auswirkung:** Der zentrale Produktfall „ein mehrseitiges Layout einmal gestalten und jeden Termin damit exportieren“ umfasst unterschiedliche Seitengrößen, Reihenfolge, Gruppen, Bindungen, Effekte und Bildfokusse.

**Empfehlung:** Weitere Vorlagenmerkmale ausschließlich am mehrseitigen Dokumentmodell ergänzen. Die terminneutrale Speicherung und die Migration einseitiger Altvorlagen beibehalten.

### Stabilisiert – Zwei parallele Vorlagenkonzepte verursachten Reset- und Leerzustandsfehler

**Status:** Standardvorlagen und gespeicherte Dokumentvorlagen bleiben zwei Katalogquellen, erzeugen aber denselben serialisierbaren Seiten-/Layoutzustand. Neue und zurückgesetzte Seiten verwenden eine eigene Blank-Factory.
**Evidenz:** `createBlankPublisherPage()` und `addPage()` erzeugen ausdrücklich einen leeren transparenten Layoutzustand. Eingebaute Standardvorlagen und gespeicherte Dokumentvorlagen werden beide nur durch explizite Aktionen angewendet und landen anschließend im selben `PublisherPage`-/`SerializableLayoutState`-Modell. Der Playwright-Test für frei dimensionierte Seiten prüft, dass keine Standardelemente injiziert werden.

**Auswirkung:** Leerer Start, neue Seiten und Terminwechsel sind von Vorlagenaktionen getrennt. Der verbleibende Unterschied betrifft den Katalog und die Herkunft der Vorlagen, nicht den resultierenden Canvas-Zustand.

**Empfehlung:** Eingebaute Layouts langfristig als schreibgeschützte Seed-Einträge desselben Vorlagenkatalogs anbieten. Die Blank-Factory als einzige Quelle für leere Seiten beibehalten.

### Behoben – Entwurfsmodell widersprach der terminunabhängigen Arbeitsweise

**Status:** Dokumente besitzen eine eigene UUID, werden auch ohne Termin gespeichert und referenzieren einen Termin nur optional. Das Öffnen eines Dokuments ist eine eigene, explizite Aktion.
**Evidenz:** `PublisherDocumentRecord` enthält eine eigene UUID und eine nullable `PublisherAppointmentReference`. Der CCM-Adapter speichert Dokumente in `publisher_documents`, Vorlagen separat in `publisher_templates`; die Oberfläche bietet explizites Öffnen und einen Termin kann sie wieder lösen.

**Auswirkung:** Freie und terminbezogene Dokumente folgen demselben Speicherpfad. Ein Terminwechsel aktualisiert weiterhin nur den Datenkontext und öffnet kein anderes Dokument.

**Empfehlung:** Bei der kommenden CCM-API besonders Einzelabruf, serverseitige Filter, Eigentümer/Berechtigungen und atomare Revisionsprüfung ergänzen; der Repository-Vertrag kann diese Fähigkeiten später aufnehmen.

### Stabilisiert – Fehlendes CCM-Modul erzeugte bei jeder Änderung einen Speicherfehler

**Status:** Ein nicht verfügbarer ChurchTools-Speicher wird als stabiler lokaler Recovery-Modus dargestellt; automatische Remote-Wiederholungen pausieren nach dem ersten Fehler.
**Evidenz:** Die Speicherstatuslogik unterscheidet nun `local` und `offline` von Konflikten, Berechtigungs- und Validierungsfehlern. Wartende oder während eines laufenden Speichervorgangs vorgemerkte Autosaves prüfen den Status erneut, bevor sie einen weiteren Request auslösen (`src/domain/publisherStorageState.ts`; `src/App.vue`).

**Auswirkung:** Fehlt lokal beispielsweise das Custom Module `publisher-26`, bleibt die untere Leiste nach Änderungen bei „Lokal gesichert“, statt nach jedem Autosave erneut „Speicherfehler“ zu melden. Die aktuelle Arbeit bleibt als einzelne Recovery-Kopie erhalten.

**Empfehlung:** Das endgültige Verhalten mit der kommenden offiziellen CCM-API beibehalten: automatische Retries begrenzen, explizites Speichern und ein erneutes Online-Ereignis aber weiterhin als bewusste Wiederholungswege anbieten.

### Behoben – Entwurf löschen erzeugte ein implizites Standardlayout

**Status:** behoben; Zurücksetzen verwendet die zentrale Factory für eine leere transparente Seite.
**Evidenz:** `createNewDocument()` und der Dokument-Store verwenden `createBlankPublisherPage()`. Die Factory initialisiert den aktiven Layoutzustand ohne sichtbare Elemente; neue Seiten verwenden denselben Pfad. Das frühere UI-„Zurücksetzen“ wurde entfernt, sodass eine Standardvorlage nur noch ausdrücklich angewendet wird.

**Auswirkung:** Ein neues oder geleertes Dokument startet reproduzierbar transparent und leer. Es gibt keinen impliziten Weg mehr vom Termin- oder Dokumentwechsel zu einem Standardlayout.

**Empfehlung:** Zusätzliche „Neu“- oder Importpfade weiterhin auf die zentrale Blank-Factory beziehungsweise explizit importierte Seitenzustände beschränken.

### Behoben – Seitenvorschauen waren keine Vorschauen

**Status:** behoben; jede gemountete Canvas-Seite erzeugt verzögert eine kleine, nicht interaktive PNG-Vorschau ohne Auswahlrahmen oder Handles.
**Evidenz:** `EventTemplate.renderThumbnail()` rastert den aktuellen Szenengraphen unabhängig von der Zoomstufe. `PublisherWorkspaceContent` aktualisiert die abgeleiteten Vorschauen seitenbezogen nach Layout-, Daten- und Bildänderungen. `PublisherPagesPanel` zeigt diese Vorschau auf dem transparenten Karomuster.

**Auswirkung:** Seiten mit unterschiedlichen Inhalten und Formaten sind in der Übersicht direkt unterscheidbar. Die Data-URLs bleiben abgeleiteter UI-Zustand und werden nicht mit dem Dokument persistiert.

**Umsetzung:** Seitennamen, tiefes Duplizieren und Reihenfolge sind Store-Actions. Die Sortierung funktioniert per Drag-and-drop sowie über Pfeiltasten am Drag-Handle; Namen, Reihenfolge und Duplikate werden mit Dokumenten und Vorlagen gespeichert.

### Stabilisiert – Kritische Canvas-Flows hatten keine Browserabdeckung

**Status:** Playwright und eine erste kritische Chromium-Suite sind eingerichtet; reine Zoomberechnung und Statusleisten-Steuerung besitzen Komponententests. Pointer-Gesten für Randhandles, Panning, Export und visuelle Regressionen sollten noch ergänzt werden.
**Evidenz:** `PublisherZoomControls` und die Fit-Berechnung sind isoliert testbar. Acht Playwright-Flows prüfen leeren Start, leere Seiten, Seitenauswahl, echte Gruppen samt Effekten, mehrseitige Vorlagen, Upload-Platzhalter, terminunabhängiges Speichern und responsive Drawer. Für Pointer-Gesten und visuelle Ausgabe fehlen weiterhin gezielte Browserfälle.

**Auswirkung:** Die wichtigsten Zustands- und Workflowregressionen sind abgedeckt. Handles am Rand, Gruppendrag und Snapping, Trackpad-Zoom, Export mit realen Bildern und visuelle Regressionen liegen weiterhin außerhalb der verlässlichen Suite; jsdom simuliert Konva-Geometrie und Pointergesten nicht ausreichend.

**Empfehlung:** Die bestehende Playwright-Suite risikobasiert um Elementtransformation am Rand, Gruppendrag/Snapping, Trackpad-Zoom, Termindatenwechsel, dynamisches Auto-Layout und PNG/JPEG-Export erweitern.

### Behoben – Persistenzversion blieb trotz Schemaänderungen zurück

**Status:** Entwurf, Dokumentrecord, portable Datei, Vorlagenbibliothek und CCM-Envelope besitzen getrennte aktuelle Versionen und akzeptieren ihre unterstützten Vorgänger explizit.
**Evidenz:** Das Entwurfsformat migriert V1/V2 auf V3, Dokumentrecords V1/V2 auf V3, portable Dateien V1 auf V2 und die Vorlagenbibliothek V1–V3 auf V4. Neue CCM-Schreibvorgänge verwenden Envelope V2, der Leser akzeptiert weiterhin V1. Roundtrip- und Migrationsfälle sind für alle Pfade getestet.

**Auswirkung:** Die neue Repeat-Konfiguration kann nicht unbemerkt von älteren lokalen Formaten überschrieben werden. Bestehende Records bleiben lesbar und werden beim nächsten Speichern im aktuellen Format geschrieben.

**Empfehlung:** Bei jeder weiteren persistierten Eigenschaft die betroffene Version erneut erhöhen und die Vorgängerversion als eigenen Migrationstest behalten. Für komplexere künftige Umbauten echte Fixture-Dateien ergänzen.

### Behoben – Ein defekter Vorlageneintrag blockierte die gesamte Bibliothek

**Status:** behoben; Einträge werden einzeln gelesen und ungültige beziehungsweise doppelte Einträge isoliert.
**Evidenz:** `parsePublisherDesignTemplateLibrary()` validiert zunächst nur den Bibliothekscontainer und parst danach jeden Eintrag separat. Ungültige sowie doppelte Einträge werden übersprungen; gültige Vorlagen bleiben ladbar und die Bibliothek kann wieder geschrieben werden.

**Auswirkung:** Ein einzelner beschädigter Altbestand blockiert weder die übrige Vorlagenbibliothek noch neue Speicherungen. Ein vollständig beschädigter Container bleibt als diagnostizierbarer Fehler erhalten.

**Empfehlung:** Für eine spätere serverseitige Bibliothek zusätzlich Quarantäne-/Diagnosemetadaten vorsehen, damit übersprungene Einträge in der Oberfläche nachvollziehbar bleiben.

### Behoben – Verknüpftes Event konnte durch das Listenlimit fehlen

**Status:** behoben; bekannte Event-IDs werden direkt geladen.
**Evidenz:** `useAppointmentRelatedData` verwendet für die Relation den Einzelabruf `/events/{eventId}`. Der Endpunkt liefert die Event-Dienste mit und benötigt weder Tagesfenster noch Listenlimit oder Pagination.

**Auswirkung:** Die Anzahl anderer Events am selben Tag beeinflusst das Nachladen nicht mehr. Berechtigungs- oder Nicht-gefunden-Fehler beziehen sich tatsächlich auf das verknüpfte Event.

**Empfehlung:** Den direkten Einzelabruf beibehalten und bei künftigen API-Änderungen nicht wieder durch eine begrenzte Tagesliste ersetzen.

### Behoben – `templateProps` war immer vorhanden, mehrere Leerzustände waren tot

**Status:** behoben; der Publisher-Datenkontext ist im Editorfluss nicht-nullbar.
**Evidenz:** Toolrail, Topbar, Kontextleiste und Element-Actions besitzen keine unerreichbaren `hasTemplate`-Sperren mehr. `PublisherWorkspaceContent` rendert die Arbeitsfläche auch während Termin-Lade- und Fehlerzuständen weiter und zeigt diese nur als Statusmeldung.

**Auswirkung:** Ein terminunabhängiges Dokument bleibt stets bearbeitbar; ein Datenfehler kann weder Header noch Canvas verdrängen.

**Empfehlung:** Künftige Datenquellen ebenfalls als austauschbaren Kontext behandeln und Layoutverfügbarkeit nicht an deren Ladezustand koppeln.

### Behoben – Bildabruf war fest auf 1920 × 1080 zugeschnitten

**Status:** behoben; Datenmapping und Renderanforderung sind getrennt.
**Evidenz:** Termindaten behalten die stabile ursprüngliche Asset-URL. `EventTemplate` erzeugt daraus erst beim Laden eine Ziel-URL anhand des tatsächlichen Elementrahmens, des Bildfokus und der benötigten Anzeigedichte. Bestehende Queryparameter und Hashes bleiben erhalten, Bildparameter werden ersetzt und auf 8192 Pixel begrenzt.

**Auswirkung:** Quadratische, breite und große Bildrahmen fordern eine passende Ressource an. Ein Fokus-Zoom lädt genügend Quelldetails nach; Data- und Blob-URLs bleiben unverändert. Größenänderungen sowie Zoomwechsel aktualisieren die Anforderung, ohne die gespeicherte Bindung umzuschreiben.

**Empfehlung:** Vor Freigabe mit der produktiven ChurchTools-Bild-API prüfen, ob gleichzeitige `w`-/`h`-Parameter nur skalieren oder serverseitig beschneiden. Der Canvas-Cover-Zuschnitt bleibt in jedem Fall die visuelle Quelle der Wahrheit.

### P2 – Dokumenthistorie und Autosave skalieren schlecht

**Status:** aus Implementierung abgeleitet.  
**Evidenz:** Die dokumentweite Historie hält bis zu 50 vollständige Mehrseiten-Snapshots und prüft Gleichheit synchron über `JSON.stringify` (`src/domain/publisherDocumentHistory.ts`). Autosave ist zwar auf 800 ms entprellt und asynchron, sendet aber weiterhin das vollständige mehrseitige Dokument an CCM und schreibt eine vollständige Recovery-Kopie.

**Auswirkung:** Viele Elemente und verschachtelte Gruppen verursachen weiterhin unnötige Serialisierung, Netzwerkvolumen und Speicherverbrauch. Data-URL-Bilder werden nicht mehr neu erzeugt.

**Empfehlung:** Commands oder strukturell geteilte Patches für Undo verwenden und serverseitig Patch-/Revisionsoperationen vorsehen. Performancebudgets mit großen Testdokumenten messen.

### Behoben – Destruktive Aktionen, Undo und Bestätigung

**Status:** Dokumentänderungen sind undo-fähig; persistente Löschungen verlangen eine explizite Bestätigung.
**Evidenz:** Elementänderungen, Seitenoperationen und Vorlagenanwendung liegen in der gemeinsamen Dokumenthistorie. Gespeicherte Vorlagen und Dokumente öffnen vor dem Repository-Aufruf einen fokussierten Bestätigungsdialog, der die fehlende Undo-Möglichkeit ausdrücklich nennt.

**Auswirkung:** Änderungen am geöffneten Dokument lassen sich in ihrer tatsächlichen Reihenfolge zurückholen. Dauerhafte Bibliothekslöschungen können nicht mehr durch einen einzelnen unbeabsichtigten Klick ausgelöst werden.

**Empfehlung:** Einen serverseitigen Papierkorb erst ergänzen, wenn die CCM-API dafür eine belastbare Semantik anbietet. Bei großen Dokumenten die Snapshot-Historie später durch Commands oder strukturell geteilte Patches ersetzen.

### Behoben – Farbpaletten und „zuletzt benutzt“ waren nur Sitzungsspeicher

**Status:** behoben durch einen versionierten, datensparsamen IndexedDB-Cache.
**Evidenz:** `publisherColors` lädt und speichert die letzten zwölf Farben über `publisherBrowserCache`. Analysierte Paletten werden unter einem Hash der Bildquelle gecacht; weder Bildbytes noch die vollständige URL liegen im Schlüssel oder Wert. Eine manuelle Neuanalyse umgeht den Cache.

**Auswirkung:** Zuletzt verwendete Farben und bereits analysierte Paletten stehen nach einem Reload schneller wieder zur Verfügung. Dynamische Bindungen behalten weiterhin ihren persistierten Fallback.

**Empfehlung:** Cache-Version bei Änderungen am Extraktionsalgorithmus erhöhen und langfristig eine Obergrenze beziehungsweise zeitbasierte Bereinigung ergänzen.

**UI-Stand:** Die drei semantischen Bildfarben werden nicht mehr als zweite Palette dupliziert. Primär-, Hintergrund- und Vordergrundrolle sind direkt innerhalb der neun extrahierten Farbfelder markiert und können über einen Rollenmodus manuell einem anderen Farbfeld zugewiesen werden. Die Standardpalette deckt zusätzlich abgestufte Neutral-, Blau-, Türkis-, Grün-, Gelb-, Rot- und Violetttöne ab.

### Behoben – Datenformatierung und Wiederholungen waren für Template-Automation zu begrenzt

**Status:** sichere Ausdrücke und persistente Repeat-Gruppen sind umgesetzt.
**Beobachtung:** Bestehende Platzhalter bleiben kompatibel. Neue `v1`-Pipelines unterstützen Datum, Zeit, Listen, Zahlen, Währungen, Groß-/Kleinschreibung, Fallbacks und vordefinierte Vergleiche ohne `eval` oder freie JavaScript-Auswertung. Ein gemeinsamer Dialog erzeugt diese Ausdrücke visuell; Zahlenfelder aus Anmeldegruppen werden entsprechend typisiert. Eine Gruppe kann außerdem an ein Listenfeld gebunden und horizontal oder vertikal mit festem Abstand wiederholt werden. Pro Eintrag entsteht ein eigener gerenderter Gruppenbaum mit lokalem Wert und Index, während nur der Prototyp persistiert wird.

**Auswirkung:** Terminabhängige Leerwerte, Statushinweise, lokalisierte Zahlen und individuell gestaltete Dienstlisten lassen sich terminneutral in Vorlagen behandeln. Ein Datenwechsel verändert nur die Renderprojektion und vervielfältigt keine persistenten Ebenen.

**Empfehlung:** Die `v1`-Syntax und Repeat-Konfiguration bei zukünftigen Semantikänderungen migrieren statt still umzudeuten. Die feste Obergrenze von 100 Instanzen bei weiteren Datenquellen beibehalten beziehungsweise bewusst anpassen.

### Behoben – Stammdatenfehler wurden still verschluckt

**Status:** behoben; Eventdaten und Stammdaten besitzen getrennte Ergebniszustände.
**Evidenz:** Scheitert `/event/masterdata`, bleiben Event und Dienstpersonen geladen. Die Datenquelle erhält eine sichtbare Warnung und verwendet vorhandene Dienstnamen aus dem Event als Fallback; ein erneutes Laden versucht auch die Stammdaten erneut.

**Auswirkung:** Nutzer erkennen unvollständig aufgelöste Dienstbezeichnungen, ohne bereits geladene Personen und Eventfelder zu verlieren.

**Empfehlung:** Dieselbe Teilfehler-Semantik bei weiteren optionalen Stammdatenquellen verwenden.

### P2 – HTML-zu-Text-Konvertierung ist unvollständig

**Status:** im Code bestätigt.  
**Evidenz:** Notizen werden per Regex von Tags bereinigt; nur `&nbsp;` und `&amp;` werden dekodiert (`src/domain/appointmentRelatedData.ts:35-43`).

**Auswirkung:** Entitäten wie `&quot;`, `&lt;` oder numerische Entities können sichtbar bleiben. Blockelemente können ohne sinnvolle Absatzgrenzen zusammenfallen.

**Empfehlung:** Im Browser einen sicheren HTML-Parser verwenden, blockbezogene Zeilenumbrüche kontrolliert übernehmen und Tests für Entities, Listen und verschachtelte Tags ergänzen.

### Behoben – Responsive Layout blendete zentrale Bedienung ersatzlos aus

**Status:** Seitenübersicht und Inspector bleiben bis 1100 Pixel erreichbar.
**Evidenz:** `PublisherEditorShell` rendert beide Bereiche an Tablet- und Mobilbreiten als seitliche Drawer über der unbeschnittenen Arbeitsfläche. Eine kompakte schwebende Leiste öffnet die Bereiche; Backdrop, Escape, Fokus-Rückgabe sowie `inert`/`aria-hidden` für geschlossene Drawer sind umgesetzt.

**Auswirkung:** Seitenwahl und sämtliche Eigenschaften bleiben erreichbar, während der Canvas die verbleibende Breite erhält. Die Desktopdarstellung oberhalb des Breakpoints bleibt unverändert.

**Empfehlung:** Für echte Smartphone-Optimierung zusätzlich die Toolrail einklappbar machen und Touch-Ziele sowie komplexe Canvas-Gesten auf realen Geräten prüfen.

### P2 – Modale Komponenten und Tabs sind nicht vollständig zugänglich

**Status:** teilweise behoben.
**Evidenz:** `DesignTabs` verknüpft Tabs und Panels, verwendet roving `tabindex` und unterstützt Pfeiltasten sowie Home/End. Neue und bereits umgestellte Modale verwenden `DesignDialog` mit Fokusfalle, initialem Fokus, Escape und Fokus-Rückgabe. Die Terminauswahl und einzelne ältere Spezialdialoge verwenden noch eigene Implementierungen.

**Auswirkung:** Tastatur- und Screenreader-Nutzung ist inkonsistent; Fokus kann hinter einen offenen Dialog geraten oder nach Schließen verloren gehen.

**Empfehlung:** Verbliebene Spezialdialoge auf `DesignDialog` umstellen und anschließend mit axe-core sowie echter Tastaturnavigation testen.

### Teilweise behoben – Ebenen-Drag-and-drop war nicht tastaturbedienbar

**Status:** die Kernaktionen sind tastaturbedienbar.
**Beobachtung:** Pfeiltasten navigieren durch den sichtbaren Baum und öffnen oder schließen Gruppen. Auf dem Verschiebegriff ordnet Option/Alt + Pfeil oben/unten die Ebene um; Option/Alt + Pfeil rechts verschachtelt sie in die vorherige Gruppe. Das Lösen einer Gruppe ist über das tastaturbedienbare Ebenen-Popover erreichbar.

**Auswirkung:** Navigation, Sortierung, Verschachtelung und das Lösen von Gruppen sind ohne präzise Zeigerbedienung erreichbar. Eine direkte Tastaturaktion „aus Untergruppe herausziehen“ und eine gesprochene Erfolgsmeldung fehlen noch.

**Empfehlung:** Nach einer Tastaturverschiebung zusätzlich eine kurze Live-Region-Rückmeldung ausgeben und das direkte Herausziehen aus einer Untergruppe als eigenen Befehl ergänzen.

### P2 – Canvas-Inhalte besitzen keine semantische Alternative

**Status:** konzeptionelle Lücke.  
**Beobachtung:** Konva rendert in ein Canvas; Elemente und Auswahl sind dort für Screenreader nicht als bearbeitbare Objekte vorhanden. Der Ebenenbaum stellt Typ, sichtbaren Wert, Hierarchie, Auswahl, Sichtbarkeit und Sperrung semantisch dar und unterstützt Navigation sowie Kernaktionen per Tastatur, bildet Geometrie und alle Canvas-Gesten aber noch nicht vollständig ab.

**Empfehlung:** Ebenenbaum als zugängliche strukturelle Repräsentation ausbauen: Name/Wert, Typ per Icon plus zugänglichem Label, Zustand, Position, Auswahl, Umordnung und Inspector-Verknüpfung.

### P2 – Monolithische Dateien bremsen Änderungen

**Status:** weiterhin relevant; die Canvas-Auswahl-, Transformations-, Gruppen- und Stilpfade sind inzwischen fachlich getrennt.
**Evidenz:** `EventTemplate.vue` 1.872 Zeilen, `styles.css` 4.149, `App.vue` 1.278, `layoutEditing.ts` 1.114, `publisherDraft.ts` 715 und `LayoutInspector.vue` 509. In den UI-/Domain-Dateien existieren weiterhin zahlreiche direkte Hex-Farbwerte; Design-Tokens decken Abstände, Radien und Typografie nur teilweise ab.

**Auswirkung:** Fachgrenzen verschwimmen, Merge-Konflikte nehmen zu, Tests erfordern große Setups und kleine UI-Abweichungen entstehen leicht.

**Empfehlung:** nicht rein nach Dateilänge schneiden, sondern nach Verantwortungen:

- `App.vue`: Dokumentcontroller, Datenkontext, Persistenzservice und Exportservice trennen
- `EventTemplate.vue`: Asset-Laden, Konva-Konfiguration, Export und rekursive Renderer
- `layoutEditing.ts`: Knotenmodell, Geometrie/Snapping, Layerbaum, Gruppen/Auto-Layout und Elementfactory
- `publisherDraft.ts`: Schemas und Migrationen je Version
- `styles.css`: Tokens, Shell, Canvas, Inspectoren, Dialoge und einzelne Komponenten

**Umsetzungsstand:** Datenfeld-Drops liegen in `useCanvasDataFieldDrop`, Auswahlrechteck, Gruppendrilldown und Auswahlsynchronisierung in `useCanvasSelection`, die Konva-Transformer-Konfiguration in `useCanvasTransformer`, Drag-/Resize-/Rotate-Gesten in `useCanvasTransforms`, Gruppen und Auto-Layout in `useCanvasGroups` und Formatierungen in `useCanvasElementStyles`. Diese Grenzen besitzen isolierte Tests. Als nächste Schnitte bieten sich Asset-Laden, Konva-Konfiguration und Export an; parallel sollte `App.vue` nach Dokumentworkflow, Datenkontext, Persistenz und Export zerlegt werden.

### Behoben – README und Plan beschrieben einen früheren Prototyp

**Status:** aktuelle Architektur, Produktinvarianten und Store-Umfang sind dokumentiert.
**Evidenz:** README beschreibt den Mehrseiteneditor, Stores, Szenengraph, Repository, Migrationen, Automationsfunktionen und die aktuellen Prüfkommandos. `EXTENSION_STORE.md` enthält eine redaktionelle Funktionsbeschreibung. Der frühere `PUBLISHER_LAYOUT_PLAN.md` ist ausdrücklich als historisches Konzept gekennzeichnet; der bewertete Restbacklog steht hier und in `docs/todos.md`.

**Auswirkung:** Neue Entwickler treffen falsche Annahmen und können alte Architekturentscheidungen versehentlich reaktivieren.

**Empfehlung:** Sichtbare Produktänderungen weiterhin zeitgleich in README, Store-Text und diesem Audit nachführen.

### Teilweise behoben – Produktionsreife des Extension-Pakets war nicht dokumentiert

**Status:** Store-Inhalt und Beta-Grenzen sind dokumentiert; der technische Releaseprozess bleibt offen.
**Evidenz:** `EXTENSION_STORE.md` enthält Beschreibung, Voraussetzungen, Datenschutz, Beta-Grenzen, Suchbegriffe und Screenshotplan. Paketversion ist weiterhin `0.0.1`; Changelog, Lizenzdatei und ein dokumentierter Release-/Rollback-Prozess fehlen. `scripts/package.js` nutzt das Systemkommando `zip` und paketiert nur `dist/`.

**Auswirkung:** Veröffentlichungen sind schwer reproduzierbar, Plattformabhängigkeit bleibt unbemerkt und Store-Angaben können vom Produkt abweichen.

**Empfehlung:** SemVer, Changelog, Lizenz, reproduzierbares Node-basiertes Packaging, Release-Checkliste und automatisierte Artefaktprüfung ergänzen. Die neue Datei `EXTENSION_STORE.md` dient als inhaltliche Basis.

### P2 – Abhängigkeitswarnungen müssen vor Veröffentlichung geklärt werden

**Status:** `npm audit --omit=dev` am 9. September 2026.
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
**Beobachtung:** Zoom und Scrollen werden jetzt durch ein dauerhaftes Handwerkzeug, temporäres Panning per Leertaste, „Seite einpassen“, „Auswahl einpassen“ und einen 100-Prozent-Sprung ergänzt. Die Befehle zentrieren den relevanten Dokumentpunkt, ohne Dokumentgeometrie zu verändern. Transformer-Griffe und -Konturen bleiben in Bildschirmkoordinaten konstant; Griffe an geraden Seitenrändern werden nach innen gesetzt und besitzen eine größere Trefferfläche. Lineare und radiale Verläufe besitzen direkte Canvas-Griffe für Geometrie, Radien und Farbstopps. Mini-Navigator, Lineale und Hilfslinien fehlen weiterhin.

**Empfehlung:** Mini-Navigator, Lineale und Hilfslinien erst nach einem konkreten Arbeitsablauf priorisieren.

### Umgesetzt – Typisierte Filter für Ebenen und Gruppen

**Status:** Filterstack, Oberfläche, Persistenz und Rendering umgesetzt.
**Beobachtung:** Helligkeit, Kontrast, HSL, Graustufen, Sepia, Invertieren, Pixelierung und Rauschen können in stabiler Reihenfolge aktiviert und umsortiert werden. Der Ebenen-Footer öffnet einen eigenen Filterdialog; gesetzte Filter werden an der jeweiligen Ebene oder Gruppe markiert. Gruppenfilter wirken auf die gemeinsam zwischengerenderte Gruppe und werden nicht auf Kinder kopiert.

**Empfehlung:** Bei großen Seiten und tief verschachtelten, mehrfach gefilterten Gruppen das Cache-Verhalten weiter beobachten und später mit definierten Performancebudgets absichern. Anpassungsebenen, die darunterliegende Ebenen beeinflussen, sind ausdrücklich nicht Teil dieses Modells.

### P3 – Visuelle Details sind noch uneinheitlich

**Status:** lokaler UI- und Code-Audit.  
**Beobachtungen:**

- Der Dialog „Neue Seite“ verwendet beim Schließen noch ein Textglyph statt des gemeinsamen Font-Awesome-Icon-Buttons.
- Ebenen und Ausrichtung verwenden nun ein gemeinsames, teleportiertes Popover mit Outside-click, Escape, Fokus-Rückgabe und Viewport-Positionierung.
- „Einrasten“ erklärt seine Wirkung per Tooltip. Der redundante Layout-Reset wurde zugunsten von Undo/Redo und erneutem Anwenden einer Vorlage entfernt.
- Transformieren bleibt korrekt sichtbar und deaktiviert, könnte aber noch dichter sein.
- Der Hauptcanvas ist bei festen Seitenleisten auf kleinen Desktopbreiten schnell stark beschnitten.
- `index.html` deklariert die deutsche Dokumentsprache und überlässt den Dark Mode vollständig der Hostklasse `.dark`.

**Empfehlung:** Den verbliebenen Dialog-Glyph ersetzen, den Transform-Inspector weiter verdichten und schmale Desktop- beziehungsweise Touch-Viewports auf realen Geräten prüfen. Die bereits gemeinsamen Popover-, Snapping-, Sprach- und Dark-Mode-Lösungen beibehalten.

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
- Die Vorlagen- und Dokumentverwaltung liegt in einem breiten Dialog mit Fokusfalle statt im rechten Inspector; die Header-Aktionen sind in Undo/Redo, Daten/Layout und Export gruppiert.
- Design-Buttons, Icon-Buttons, Tabs und Panel-Header wurden bereits als gemeinsame Komponenten begonnen.
- Terminwechsel überschreibt das aktuelle Layout inzwischen ausdrücklich nicht mehr.
- Verknüpfte Daten werden datensparsam erst auf Nutzeraktion geladen.

## Umgesetztes Programm und nächste Reihenfolge

Abgeschlossen sind die priorisierten Grundlagen gegen Datenverlust, der kanonische Dokument-/Auswahlzustand, mehrseitige Vorlagen, rekursive Canvas-Gruppen, Gruppeneffekte und Filter, explizite Persistenzmigrationen, sichere Variablen-Pipelines, Repeat-Gruppen, zielgrößenabhängiger Bildabruf, gemeinsame Popover/Tabs, Ebenentastatur und responsive Seitenbereiche.

Als nächste eigenständige Ausbauschritte bleiben in sinnvoller Reihenfolge:

1. offiziellen ChurchTools-Assetpfad festlegen und erst danach eigene Bild-Uploads wieder aktivieren;
2. Snapshot-Historie und vollständiges Autosave mit großen Mehrseitendokumenten messen und bei Bedarf auf Patches umstellen;
3. verbleibende Spezialdialoge sowie den Ebenenbaum vollständig auditieren und eine weitergehende semantische Canvas-Alternative definieren;
4. Exportpresets und Namensschema umsetzen, anschließend PDF separat evaluieren;
5. Abhängigkeitswarnungen, Dev-Zugangsdaten, Lizenz, SemVer, Changelog und reproduzierbares Packaging vor einem Store-Release klären.

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

Am aktuellen Stand:

- `npm test`: 59 Dateien, 276 Tests erfolgreich
- `npm run test:e2e`: 8 Browsertests erfolgreich
- `npm run typecheck`: erfolgreich
- `npm run build`: erfolgreich
- Vite meldet einen Hauptchunk von ungefähr 619 KB minifiziert beziehungsweise 189 KB gzip; Konva, ChurchTools, Vue und JSZip liegen in eigenen Chunks
- `npm audit --omit=dev`: 6 Meldungen, davon 1 hoch und 5 mittel

Die Metriken sind Momentaufnahmen. Nach Änderungen an Abhängigkeiten oder Build-Splitting müssen sie neu erhoben werden.
