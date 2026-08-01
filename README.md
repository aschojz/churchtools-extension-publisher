# ChurchTools Publisher

Technischer Durchstich für einen späteren grafischen Publisher innerhalb einer ChurchTools-Extension.

Der aktuelle Stand umfasst Terminauswahl, Detailabruf, isoliertes Prop-Mapping, manuelle Inhaltsüberschreibungen, zwei auswählbare Konva-Templates, erste Auswahl- und Verschiebefunktionen, responsive Vorschau und PNG-Export in 1920 × 1080 Pixeln.

## Lokale Entwicklung

Vorausgesetzt werden das ChurchTools-Monorepo und dieses Repository als Geschwisterverzeichnisse:

```text
git/
├── churchtools/
└── extension-publisher-gpt/
```

Die internen Pakete werden lokal aus `../churchtools/frontend-packages/` eingebunden. Sie sind nicht in der öffentlichen npm Registry verfügbar. Nach Änderungen an diesen Paketen muss gegebenenfalls erneut `npm install` ausgeführt werden.

```bash
npm install
npm run dev
```

Die lokale Konfiguration liegt in `.env` und wird nicht versioniert. Grundlage ist `.env-example`:

```dotenv
VITE_KEY=publisher
VITE_BASE_URL=https://example.church.tools
VITE_USERNAME=...
VITE_PASSWORD=...
```

Der Vite-Basispfad ist `/ccm/<VITE_KEY>/`. Anmeldung, API-Basis-URL und Produktionseinbettung folgen dem offiziellen Boilerplate.

## Verifikation

```bash
npm run typecheck
npm test
npm run build
```

Der Boilerplate enthält keinen Lint-Runner. Für Mapper und Stage-Abmessungen ist Vitest eingerichtet.

## Untersuchte ChurchTools-Infrastruktur

Ausgangspunkt ist das offizielle Repository `churchtools/extension-boilerplate`, untersucht auf Stand `c723b0154f751412eced661e9c2384f4f5632775` vom 5. Dezember 2025.

Die Extension verwendet lokal:

- `@churchtools/churchtools-client` für Anmeldung und HTTP-Zugriff
- `@churchtools/api-types` für generierte OpenAPI-Typen
- `@churchtools/vue-query` für vorhandene TanStack-Query-Composables
- `@churchtools/utils` als transitive Voraussetzung der Query-Abstraktion
- `@tanstack/vue-query` und Vue 3 als Laufzeitbasis

### Terminauswahl

Die Seite lädt zunächst die sichtbaren Kalender mit `useCalendarsQuery()` aus `@churchtools/vue-query`. Anschließend ruft ein kleiner lokaler Query-Composable alle Termine dieser Kalender von heute bis zwölf Monate im Voraus ab:

```text
GET /calendars/appointments?calendar_ids[]=…&from=…&to=…
```

Die Antwort verwendet den generierten Typ `AppointmentCalculatedWithIncludes`. Die Optionen werden chronologisch sortiert und durch Termin-ID plus konkretem Startzeitpunkt eindeutig identifiziert. Datum und Uhrzeit im Select richten sich nach der Benutzersprache; Ganztagstermine zeigen keine Uhrzeit.

Das Monorepo exportiert außerdem `useAppointmentQuery()` aus `@churchtools/vue-query`. Der Hook verwendet:

```text
GET /calendars/appointments/{appointmentId}/{startDate}
```

und liefert ebenfalls `AppointmentCalculatedWithIncludes`. Er benötigt zwingend sowohl die Termin-ID als auch das Datum eines konkreten Vorkommens. Genau diese beiden Werte stehen nach der Auswahl einer Listenoption zur Verfügung und werden für den gezielten Detailabruf verwendet.

Für eine Terminserie existiert außerdem:

```text
GET /calendars/{calendarId}/appointments/{appointmentId}
```

mit dem Antworttyp `AppointmentCalculated`. Dieser enthält `appointment: AppointmentBase` und die berechneten Vorkommen in `calculatedDates`, wird für die Listenauswahl aber nicht benötigt.

### Relevante Felder

`AppointmentBase` enthält die für das spätere Prop-Mapping benötigten Werte:

- Titel: `title`
- Zeitraum: berechnetes `startDate` und `endDate`
- Ganztägig: `allDay`
- Ort: `address`, insbesondere `meetingAt`, Straße, PLZ und Ort
- Bild: `image?.imageUrl`

Das Bildmodell `Image` stellt zusätzlich `fileUrl`, `relativeUrl`, Crop-/Focus-Optionen und Metadaten bereit. Für das Testtemplate ist zunächst `imageUrl` vorgesehen.

### Sprache und Zeitzone

Innerhalb von ChurchTools steht die Benutzersprache über `window.settings.language` bereit. Lokal wird auf `navigator.language` zurückgefallen. Für Datum und Uhrzeit soll `Intl.DateTimeFormat` mit dieser Sprache verwendet werden. Die Instanz-Zeitzone kann über `window.settings.timezone` berücksichtigt werden; bis diese verfügbar ist, greift die Browser-Zeitzone als Fallback.

Die vorhandenen Formatierungshelfer aus `@churchtools/utils` hängen teilweise von globaler ChurchTools-Übersetzung und `date-fns`-Locale ab. Für das kleine darstellungsorientierte Prop-Modell wird deshalb die native `Intl`-API verwendet.

## Mapping und Template

`mapAppointmentToTemplateProps()` nimmt nur den benötigten Ausschnitt des generierten Appointment-Typs entgegen und erzeugt:

```ts
interface EventTemplateProps {
    title: string;
    date: string;
    time: string;
    location: string;
    imageUrl: string | null;
}
```

Das Konva-Template kennt weder Query-Zustand noch Appointment-ID oder ChurchTools-Response. Es rendert ausschließlich diese Props. Fehlende Uhrzeit und fehlender Ort erzeugen keine Leerzeilen; ohne Bild erscheint eine definierte Fallback-Fläche. Der Titel ist auf einen festen Bereich mit maximal drei sichtbaren Zeilen und Ellipsis begrenzt.

### Manuelle Überschreibungen

Titel, Datum, Uhrzeit und Ort können vor dem Export einzeln überschrieben werden. Die Änderungen liegen als separates `EventTemplateOverrides`-Objekt zwischen Mapper und Template und verändern weder den geladenen API-Response noch den ChurchTools-Termin:

```text
gemappte EventTemplateProps + EventTemplateOverrides → gerenderte EventTemplateProps
```

Ein leerer Wert ist eine gültige Überschreibung und blendet beispielsweise Uhrzeit oder Ort aus. Jeder Wert kann einzeln auf das gemappte Original zurückgesetzt werden; zusätzlich steht ein gemeinsamer Reset bereit. Beim Wechsel des Termins werden alle Überschreibungen verworfen.

Das Veranstaltungsbild kann für Vorschau und Export lokal durch eine JPEG-, PNG- oder WebP-Datei bis 20 MB ersetzt werden. Dafür wird ausschließlich eine temporäre Blob-URL im Browser erzeugt; es gibt keinen Upload und keine Änderung am ChurchTools-Termin. Beim Zurücksetzen, Terminwechsel oder Verlassen der Seite wird die URL wieder freigegeben.

Textüberschreibungen, Template-Auswahl, Layoutzustände beider Templates, Rastereinstellung und Vorschauzoom werden pro Termin als versionierter Entwurf im `localStorage` des Browsers gespeichert und beim erneuten Öffnen wiederhergestellt. Fehlerhafte oder inkompatible Einträge werden ignoriert. Über die Oberfläche kann der aktuelle lokale Entwurf vollständig gelöscht werden. Ersatzbilder sind nicht Bestandteil des dauerhaften Entwurfs, weil ihre temporären Blob-URLs einen Seitenneustart nicht überleben.

### Template-Auswahl

Die Oberfläche bietet zwei fest codierte 1920-×-1080-Templates: eine geteilte Fläche und ein vollflächiges Bildposter. Beide erhalten dasselbe `EventTemplateProps`-Objekt und verwenden dieselbe Exportlogik. Ein Template-Wechsel beeinflusst deshalb weder die geladenen Termindaten noch manuelle Inhaltsüberschreibungen.

### Erste Layoutbearbeitung

Titel, kombinierte Datums-/Uhrzeile und Ort können auf der Konva-Arbeitsfläche ausgewählt, verschoben, in Breite und Höhe verändert sowie frei gedreht werden. Der Konva-Transformer stellt dafür Größen- und Rotationsgriffe bereit. Zusätzlich erlaubt eine tastaturfähige Elementleiste dieselben Änderungen in festen Schritten und kann die drei Texte schrittweise nach vorne oder hinten anordnen. Auswahlrahmen und Transformer werden vor dem Export ausgeblendet. Positionen, Größen, normalisierte Winkel und Ebenenreihenfolge liegen als serialisierbare Werte im Vue-Zustand und nicht ausschließlich in den Konva-Nodes. Sie werden pro Template getrennt gehalten, bleiben innerhalb der Dokumentgrenzen und können auf die Ausgangswerte zurückgesetzt werden.

Für das ausgewählte Element stehen zusätzlich exakte Zahlenfelder für X, Y, Breite, Höhe und Drehung bereit. Eingaben werden auf gültige Dokumentgrenzen und Mindestgrößen begrenzt; auch diese Änderungen sind rückgängig machbar und Bestandteil des lokalen Entwurfs.

Bis zu 50 Layoutänderungen können pro Template rückgängig gemacht und wiederholt werden. Die Historie umfasst direkte Canvas-Interaktionen, die zugänglichen Steuerelemente, Ebenenänderungen und den vollständigen Layout-Reset; eine neue Änderung nach einem Rückgängig-Schritt verwirft den bisherigen Wiederholen-Zweig.

Ausgewählte Elemente lassen sich zusätzlich mit den Pfeiltasten verschieben; Umschalt erhöht den jeweiligen Schritt um den Faktor fünf. Escape hebt die Auswahl auf. Strg/Cmd+Z sowie Strg+Y beziehungsweise Strg/Cmd+Umschalt+Z bedienen die Layout-Historie. Während der Fokus in einem Eingabefeld, einer Textarea oder einer Auswahl liegt, greift der Editor nicht in die normalen Tastaturfunktionen ein.

Raster-Snapping kann im Editor ein- und ausgeschaltet werden. Aktiv rasten Positionen und Größen nach einer direkten Konva-Interaktion auf 20 Pixel und Drehungen auf 15° ein; die zugänglichen Steuerelemente verwenden dieselben Schritte. Bei deaktiviertem Raster arbeiten die Steuerelemente mit 5 Pixeln beziehungsweise 5°. Beim direkten Verschieben rasten Kanten und Mittellinien zusätzlich an den übrigen Textelementen sowie den Dokumentkanten und der Dokumentmitte ein. Pinke Hilfslinien zeigen die aktive Ausrichtung und verschwinden vor dem Export.

## Vorschau und Export

Die Dokumentgröße bleibt immer 1920 × 1080 Pixel. Ein `ResizeObserver` ermittelt ausschließlich die Vorschau-Skalierung. Für den Export wird die Stage kurz auf die unveränderte Dokumentgröße mit Skalierung 1 gesetzt und anschließend auf den Vorschauzustand zurückgestellt. Dadurch entstehen keine Rundungsfehler durch gebrochene Vorschaugrößen.

Der Vorschauzoom kann zwischen 50 und 200 Prozent der automatisch eingepassten Größe gewählt werden. Größere Stufen machen die Arbeitsfläche innerhalb ihres Containers scrollbar; Dokumentkoordinaten, Layoutzustand und Exportauflösung bleiben davon unabhängig.

Vor dem Download werden Schriftarten und ein vorhandenes Bild abgewartet. Das erzeugte PNG wird anschließend mit `createImageBitmap()` geprüft; nur ein tatsächliches Bild mit exakt 1920 × 1080 Pixeln wird heruntergeladen. Der Browser-Test gegen die konfigurierte Instanz bestätigt Auswahl, Detailabruf, Fallback-Rendering und die exakte Exportgröße.

## Konva-Bewertung

Empfehlung für den nächsten Ausbauschritt: **Konva weiterverwenden.**

- Die deklarative Vue-3-Integration ist für ein festes Template nachvollziehbar.
- Dokumentkoordinaten und responsive Vorschau lassen sich sauber trennen.
- Textumbruch, feste Textbereiche und Ellipsis reichen für den Durchstich aus.
- Bild-Cropping im Cover-Stil ist mit dem nativen Crop-Rechteck direkt abbildbar.
- Der PNG-Export ist deterministisch, sofern vorab auf Bilder und Fonts gewartet wird.
- Auswahl, Transformer, Raster-Snapping, Ebenenreihenfolge und visuelle Hilfslinien funktionieren auf demselben Szenengraph.

Der End-to-End-Test gegen `joschatest.church.tools` wurde mit einem eigens angelegten Termin inklusive hochgeladenem Bild durchgeführt. Das ChurchTools-Bild ließ sich mit der realen CORS-Konfiguration laden, im Cover-Stil zuschneiden und als Bestandteil eines verifizierten PNGs mit exakt 1920 × 1080 Pixeln exportieren. Ein Bildfehler ist weiterhin sichtbar behandelt und fällt für Vorschau und Export auf die definierte Farbfläche zurück. Aktuell gibt es keinen konkreten Grund für einen Alternativ-Spike mit Fabric.js oder DOM/SVG.
