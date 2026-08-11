# Publisher-Layout-Umbau

Diese Datei ist der Arbeitsplan für den schrittweisen Umbau des Publishers zu einer vollflächigen Design-Editor-Oberfläche. Sie wird während der Umsetzung aktualisiert und dient als gemeinsame, versionierte Referenz.

## Statuslegende

- `[ ]` Offen
- `[-]` In Arbeit
- `[x]` Abgeschlossen

## Leitlinien

- Der Umbau erfolgt in kleinen, einzeln test- und commitbaren Schritten.
- Bestehende Funktionen bleiben während des Umbaus funktionsfähig.
- Das Layout wird zunächst für Desktop und große Tablets optimiert.
- Das Theme folgt standardmäßig dem Betriebssystem und kann manuell auf Hell oder Dunkel gestellt werden.
- Theme-Auswahl, Panelzustände und später Panelbreiten werden lokal gespeichert.
- Neue Bedienelemente werden erst gezeigt, wenn die zugehörige Funktion vorhanden ist.

## Zielstruktur

```text
┌──────────────────────────────────────────────────────────────┐
│ Hauptleiste: Dokument · Modus · Undo/Redo · Export · Theme  │
├──────────────────────────────────────────────────────────────┤
│ Kontextleiste: Auswahl · Gruppen · Raster · Zoom             │
├───┬──────────────┬─────────────────────────┬─────────────────┤
│ W │ Termin/      │                         │ Eigenschaften   │
│ e │ Seiten/      │      Arbeitsfläche      │ Ebenen          │
│ r │ Templates    │      mit Canvas         │ Text            │
│ k │              │                         │ Transformieren   │
├───┴──────────────┴─────────────────────────┴─────────────────┤
│ Statusleiste: Auswahl · Dokumentgröße · Zoom · Hinweise      │
└──────────────────────────────────────────────────────────────┘
```

## 1. Technische und visuelle Grundlage

- [ ] Bestehende Editorbereiche und Funktionen den neuen Zielbereichen zuordnen.
- [x] Eine zentrale Layout-Komponente für den Editor-Shell anlegen.
- [x] Einheitliche CSS-Farbvariablen für Flächen, Texte, Rahmen, Akzente und Zustände definieren.
- [ ] CSS-Variablen für Abstände, Radien und Schatten vervollständigen.
- [x] Theme-Modi `system`, `light` und `dark` einführen.
- [x] Den Systemmodus über `prefers-color-scheme` aktuell halten.
- [x] Eine manuelle Theme-Auswahl lokal speichern.
- [ ] Konva-Arbeitsbereich, Auswahlrahmen und Hilfslinien an das Theme anbinden.

**Fertig, wenn:** Die bestehende Oberfläche funktioniert unverändert und verwendet vollständig das neue Theme-System.

## 2. Grundgerüst des Editors

- [x] Ein vollflächiges Desktop-Layout erstellen.
- [x] Bereiche für Hauptleiste, Kontextleiste, Werkzeugleiste, linkes Panel, Canvas, rechtes Panel und Statusleiste anlegen.
- [ ] Seitenleisten mit sinnvollen Mindest- und Maximalbreiten versehen.
- [x] Scrollverhalten pro Bereich trennen.
- [x] Dem Canvas-Bereich den gesamten verbleibenden Platz geben.
- [x] Bestehende Publisher-Inhalte zunächst verlustfrei in das Grundgerüst übernehmen.

**Fertig, wenn:** Die neue räumliche Aufteilung steht, ohne eine vorhandene Funktion zu verlieren.

## 3. Hauptleiste

- [ ] Publisher-Name und aktuell gewählten Termin anzeigen.
- [ ] Template- beziehungsweise Dokumentname darstellen.
- [ ] Undo und Redo in die Hauptleiste verschieben.
- [ ] PNG-Export prominent rechts platzieren.
- [ ] Import und seltene Dokumentaktionen in einem Menü bündeln.
- [ ] Theme-Auswahl `System / Hell / Dunkel` integrieren.
- [ ] Lade-, Speicher- und Exportzustände anzeigen.

**Fertig, wenn:** Alle globalen Aktionen dauerhaft und konsistent erreichbar sind.

## 4. Kontextabhängige Werkzeugleiste

- [ ] Auswahlmodus und aktuelle Auswahlart anzeigen.
- [ ] Gruppieren und „Gruppenebene aufheben“ integrieren.
- [ ] Rasterausrichtung ein- und ausschaltbar machen.
- [ ] Zoom-Steuerung integrieren.
- [ ] Aktionen abhängig von der aktuellen Auswahl aktivieren.
- [ ] Eine Struktur für spätere werkzeugspezifische Aktionen vorsehen.

**Fertig, wenn:** Die häufigsten Aktionen direkt oberhalb der Arbeitsfläche erreichbar sind.

## 5. Linke Werkzeugleiste

- [ ] Eine schmale vertikale Symbolleiste erstellen.
- [ ] Vorhandene Funktionen für Auswahl, Inhalte, Bild, Templates und Verschieben zuordnen.
- [ ] Das aktive Werkzeug deutlich hervorheben.
- [ ] Tooltips und vollständige Tastaturbedienung ergänzen.
- [ ] Noch nicht vorhandene Werkzeuge ausblenden statt funktionslose Schaltflächen zu zeigen.

**Fertig, wenn:** Die aktuelle Bearbeitungsart kompakt und dauerhaft auswählbar ist.

## 6. Linkes Termin- und Dokumentpanel

- [ ] Terminwahl in die linke Seitenleiste verschieben.
- [ ] Suche, Kalenderfilter und Zeitraum kompakt gestalten.
- [ ] Terminliste mit Titel, Datum und Entwurfsstatus darstellen.
- [ ] Einen Termin direkt in den zugehörigen Editorzustand öffnen.
- [ ] Template-Auswahl in das Panel integrieren.
- [ ] Lokalen Entwurf, Import, Download und Löschen als Dokumentaktionen anbieten.
- [ ] Das Panel ein- und ausklappbar machen.

**Fertig, wenn:** Termin- und Dokumentwahl wenig Arbeitsfläche beanspruchen und vollständig bedienbar bleiben.

## 7. Seiten- und Templateübersicht

- [ ] Vorschaubilder für Templates beziehungsweise Entwürfe anzeigen.
- [ ] Den aktiven Eintrag deutlich markieren.
- [ ] Template-Wechsel per Klick ermöglichen.
- [ ] Entwurfsstatus am Eintrag anzeigen.
- [ ] Passende Aktionen für Duplizieren, Zurücksetzen oder Löschen ergänzen.
- [ ] Fachlich festlegen, ob „Seiten“ Templates, Varianten oder mehrere Exportflächen darstellen sollen.

**Fertig, wenn:** Zwischen verfügbaren Gestaltungen visuell gewechselt werden kann.

## 8. Arbeitsfläche und Canvas-Viewport

- [ ] Einen themeabhängigen neutralen Arbeitsflächenhintergrund einsetzen.
- [ ] Dokumentfläche mit klarer Begrenzung und Schatten darstellen.
- [ ] Zoom auf den gesamten Viewport ausrichten.
- [ ] Verschieben per Hand-Werkzeug beziehungsweise Leertaste ermöglichen.
- [ ] „An Ansicht anpassen“ und „100 %“ anbieten.
- [ ] Horizontales und vertikales Scrollverhalten sauber umsetzen.
- [ ] Horizontale und vertikale Lineale ergänzen.
- [ ] Das Dokumentkoordinatensystem weiterhin auf 1920 × 1080 beziehen.

**Fertig, wenn:** Der Canvas sich wie eine eigenständige Design-Arbeitsfläche bedienen lässt.

## 9. Lineale, Raster und Orientierung

- [ ] Lineale passend zum Zoom berechnen.
- [ ] Den Nullpunkt an der Dokumentkante ausrichten.
- [ ] Raster und Hilfslinien themeabhängig darstellen.
- [ ] Bestehendes Einrasten an Raster und Winkeln übernehmen.
- [ ] Aktive Ausrichtungshilfen besser sichtbar machen.
- [ ] Zoom und Viewportverschiebung in allen Berechnungen berücksichtigen.

**Fertig, wenn:** Positionierung bei jeder Zoomstufe nachvollziehbar und präzise bleibt.

## 10. Rechte Panel-Infrastruktur

- [ ] Wiederverwendbare, einklappbare Inspector-Panels bauen.
- [ ] Panelzustände lokal speichern.
- [ ] Bereiche abhängig von der Auswahl zeigen oder ausblenden.
- [ ] Einen Zustand ohne Auswahl für Dokument- und Template-Einstellungen definieren.
- [ ] Gemischte Werte bei Mehrfachauswahl eindeutig darstellen.
- [ ] Änderungen weiterhin auf alle ausgewählten Elemente anwenden.

**Fertig, wenn:** Eigenschaften schrittweise in einen einheitlichen Inspector verschoben werden können.

## 11. Transformieren-Panel

- [ ] Position, Größe und Drehung in das rechte Panel verschieben.
- [ ] Mehrfachauswahl mit gemeinsamen Aktionen unterstützen.
- [ ] Canvas und Eingabefelder bidirektional synchronisieren.
- [ ] Ausrichtungsaktionen integrieren.
- [ ] Ebenenreihenfolge beziehungsweise Vorne/Hinten integrieren.
- [ ] Zurücksetzen für Element und Auswahl anbieten.
- [ ] Gesperrte Elemente berücksichtigen.

**Fertig, wenn:** Alle geometrischen Eigenschaften an einer konsistenten Stelle liegen.

## 12. Text- und Inhalts-Panel

- [ ] Titel, Datum, Uhrzeit und Ort in ein Inhalts-Panel verschieben.
- [ ] Inhalt und visuelle Gestaltung klar trennen.
- [ ] Typografie in ein Text-Panel verschieben.
- [ ] Schriftgröße, Textfarbe und Ausrichtung übernehmen.
- [ ] Struktur für Schriftart, Schriftschnitt und Zeilenabstand vorbereiten.
- [ ] Bei Mehrfachauswahl nur sinnvoll änderbare Werte zeigen.
- [ ] Sprachabhängige Beschriftungen beibehalten.

**Fertig, wenn:** Inhalt und Gestaltung getrennt, aber direkt erreichbar sind.

## 13. Farben- und Bild-Panel

- [ ] Farbauswahl als eigenes Panel gestalten.
- [ ] Aktuelle Farbe, Hex-Eingabe und zuletzt verwendete Farben anzeigen.
- [ ] Eine Farbpalette aus Template- beziehungsweise CSS-Werten ableiten.
- [ ] Veranstaltungsbild und Bildstatus in ein Bild-Panel verschieben.
- [ ] Bild ersetzen, entfernen und zurücksetzen ermöglichen.
- [ ] Template- beziehungsweise Dokumenthintergrund separat behandeln.

**Fertig, wenn:** Farb- und Bildbearbeitung dem Aufbau einer Designanwendung entsprechen.

## 14. Ebenen- und Gruppenbaum

- [ ] Verschachtelte Elemente und Gruppen als Baum darstellen.
- [ ] Elemente und Gruppen mit Namen und Typ-Symbol anzeigen.
- [ ] Canvas-Auswahl und Ebenenbaum bidirektional synchronisieren.
- [ ] Klick und Doppelklick entsprechend der bestehenden Gruppenlogik behandeln.
- [ ] Gruppen auf- und zuklappbar machen.
- [ ] Sichtbarkeit und Sperrung pro Ebene umsetzen.
- [ ] Reihenfolge per Drag-and-drop verändern.
- [ ] Gruppen und Elemente umbenennbar machen.
- [ ] Gruppieren und Aufheben direkt im Baum ermöglichen.
- [ ] Auswahl nach Undo, Redo und Gruppenänderungen konsistent halten.

**Fertig, wenn:** Verschachtelte Strukturen vollständig sichtbar und bedienbar sind.

## 15. Statusleiste

- [ ] Aktuelle Auswahl und Gruppenebene anzeigen.
- [ ] Dokumentgröße darstellen.
- [ ] Zoomwert und Zoomaktionen integrieren.
- [ ] Hinweise zum aktiven Werkzeug anzeigen.
- [ ] Speicherstatus des lokalen Entwurfs darstellen.
- [ ] Optional die Cursorposition im Dokument anzeigen.

**Fertig, wenn:** Zustandsinformationen keinen Platz mehr in den Eigenschaften-Panels belegen.

## 16. Responsive Verhalten

- [ ] Desktop und große Tablets zuerst optimieren.
- [ ] Seitenleisten bei kleinen Breiten als Drawer darstellen.
- [ ] Werkzeugleisten kompakter oder horizontal anordnen.
- [ ] Bedienbarkeit des Canvas erhalten.
- [ ] Bestehende mobile Termin- und Inhaltsbearbeitung bewahren.
- [ ] Touch-Doppeltipp und Auswahlgesten prüfen.

**Fertig, wenn:** Der Editor auch außerhalb großer Desktopfenster sinnvoll nutzbar ist.

## 17. Barrierefreiheit und Bedienkonsistenz

- [ ] Symbolbuttons mit zugänglichen Namen und Tooltips versehen.
- [ ] Sichtbare Fokuszustände für beide Themes definieren.
- [ ] Tastaturnavigation durch Werkzeugleisten und Panels ermöglichen.
- [ ] Bestehende Tastenkürzel erhalten und zentral dokumentieren.
- [ ] Farbkontraste in Hell und Dunkel prüfen.
- [ ] Auswahl nicht ausschließlich über Farbe kommunizieren.

**Fertig, wenn:** Die neue Oberfläche per Tastatur und mit assistiven Technologien bedienbar bleibt.

## 18. Abschluss und Bereinigung

- [ ] Alte Layoutcontainer und überflüssige Styles entfernen.
- [ ] Alle verbliebenen Funktionen einem endgültigen Panel zuordnen.
- [ ] Lokale Entwürfe auf Rückwärtskompatibilität prüfen.
- [ ] Theme, Panelzustände und Panelbreiten persistent speichern.
- [ ] Unit-Tests für UI-Zustand und Ebenenbaum ergänzen.
- [ ] Browser-Tests für Terminwahl, Template-Wechsel, Auswahl, Gruppen, Eigenschaften, Undo/Redo, Theme und Export durchführen.
- [ ] Beide Themes auf verschiedenen Fenstergrößen visuell prüfen.

**Fertig, wenn:** Die alte Formularansicht vollständig durch den neuen Editor ersetzt wurde und alle Prüfungen erfolgreich sind.

## Meilensteine

- [ ] M1: Theme und Editor-Grundgerüst
- [ ] M2: Haupt- und Kontextleiste
- [ ] M3: Linke Termin- und Template-Navigation
- [ ] M4: Neuer Canvas-Viewport
- [ ] M5: Rechte Inspector-Panels
- [ ] M6: Ebenen- und Gruppenbaum
- [ ] M7: Statusleiste und responsive Darstellung
- [ ] M8: Bereinigung, Tests und Feinschliff

## Offene Entscheidungen

- [ ] Bedeutung von „Seiten“ festlegen: Templates, Varianten oder mehrere Exportflächen.
- [ ] Festlegen, welche Werkzeuge neben Auswahl, Text und Bild tatsächlich benötigt werden.
- [ ] Entscheiden, ob Seitenleisten nur einklappbar oder zusätzlich frei skalierbar sein sollen.
- [ ] Entscheiden, ob Panels frei umsortierbar sein sollen oder eine feste Reihenfolge erhalten.

## Änderungsprotokoll

- 2026-08-11: Vollflächigen Editor-Shell mit festen Bereichen für Kopfzeile, optionale Werkzeug-/Seitenleisten, unabhängig scrollenden Arbeitsbereich und Statuszeile eingeführt.
- 2026-08-11: Theme-Grundlage umgesetzt: System/Hell/Dunkel, lokale Speicherung, semantische Farbvariablen und erste Auswahl in der bestehenden Kopfzeile.
- 2026-08-11: Initialen Detailplan angelegt; automatische sowie manuelle Hell-/Dunkelumschaltung aufgenommen.
