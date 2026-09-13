# Changelog

## 0.1.0 – 2026-09-13

Erste öffentliche Vorschau des ChurchTools Publisher.

### Enthalten

- Mehrseitiger Layouteditor mit frei wählbaren Seitengrößen, transparenten Seiten und Seitenvorschauen.
- Texte, Bilder aus ChurchTools, Formen, Icons und QR-Codes sowie Ebenen, verschachtelte Gruppen und Auto-Layout.
- Dynamische Terminvariablen, optionale Event- und Gruppendaten, Formatierungsregeln und Repeat-Gruppen.
- Farben, Verläufe, Bildpaletten, Effekte und Filter.
- Mehrseitige Designvorlagen, Dokumentverwaltung, gemeinsame Undo-/Redo-Historie und lokale Recovery-Kopie.
- PNG- und JPEG-Export mit exakten Seitengrößen und gemeinsamem ZIP-Download.
- Tastaturbedienbare Inspector-Bereiche und Drawer für schmale Ansichten.
- Versioniertes Installationspaket über `npm run release`, ohne lokale Anmeldedaten oder Instanz-URL.

### Voraussetzungen und bekannte Einschränkungen

- Das Release-ZIP ist für den Extension-Key `publisher-26` gebaut und läuft unter `/ccm/publisher-26/`. Für einen anderen Key muss neu gebaut werden.
- Der Quellcode-Build benötigt weiterhin die lokalen ChurchTools-Pakete aus `../churchtools/frontend-packages/`.
- Remote-Speicherung benötigt ein verfügbares CCM-Modul mit passenden Rechten. Ohne dieses Modul bleibt eine lokale Recovery-Kopie verfügbar.
- Eigene Bild-Uploads sind noch deaktiviert.
- Bekannte Risiken bei dynamischem Auto-Layout, Terminfiltern, Recovery-/Speicherkonflikten und dem Export noch ladender Assets sind in [analyse.md](analyse.md) dokumentiert. Die erste Version wird deshalb als Vorschau veröffentlicht.
