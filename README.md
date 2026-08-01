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

Ein leerer Wert ist eine gültige Überschreibung und blendet beispielsweise Uhrzeit oder Ort aus. Jeder Wert kann einzeln auf das gemappte Original zurückgesetzt werden; zusätzlich steht ein gemeinsamer Reset bereit. Beim Wechsel des Termins werden alle Überschreibungen verworfen. Bildersetzung bleibt bewusst außerhalb dieses Schritts.

### Template-Auswahl

Die Oberfläche bietet zwei fest codierte 1920-×-1080-Templates: eine geteilte Fläche und ein vollflächiges Bildposter. Beide erhalten dasselbe `EventTemplateProps`-Objekt und verwenden dieselbe Exportlogik. Ein Template-Wechsel beeinflusst deshalb weder die geladenen Termindaten noch manuelle Inhaltsüberschreibungen.

### Erste Layoutbearbeitung

Titel, kombinierte Datums-/Uhrzeile und Ort können auf der Konva-Arbeitsfläche ausgewählt und verschoben werden. Zusätzlich erlaubt eine tastaturfähige Elementleiste die eindeutige Auswahl und Bewegung in 20-Pixel-Schritten. Ein ausgewähltes Element erhält nur in der Vorschau einen gestrichelten Rahmen; Auswahlmarkierungen werden vor dem Export ausgeblendet. Die Positionen liegen als serialisierbare Offsets im Vue-Zustand und nicht ausschließlich in den Konva-Nodes. Sie werden pro Template getrennt gehalten, bleiben innerhalb der Dokumentgrenzen und können auf die Ausgangspositionen zurückgesetzt werden. Größenänderung, Rotation und Snapping sind noch nicht enthalten.

## Vorschau und Export

Die Dokumentgröße bleibt immer 1920 × 1080 Pixel. Ein `ResizeObserver` ermittelt ausschließlich die Vorschau-Skalierung. Für den Export wird die Stage kurz auf die unveränderte Dokumentgröße mit Skalierung 1 gesetzt und anschließend auf den Vorschauzustand zurückgestellt. Dadurch entstehen keine Rundungsfehler durch gebrochene Vorschaugrößen.

Vor dem Download werden Schriftarten und ein vorhandenes Bild abgewartet. Das erzeugte PNG wird anschließend mit `createImageBitmap()` geprüft; nur ein tatsächliches Bild mit exakt 1920 × 1080 Pixeln wird heruntergeladen. Der Browser-Test gegen die konfigurierte Instanz bestätigt Auswahl, Detailabruf, Fallback-Rendering und die exakte Exportgröße.

## Konva-Bewertung

Empfehlung für den nächsten Ausbauschritt: **Konva weiterverwenden.**

- Die deklarative Vue-3-Integration ist für ein festes Template nachvollziehbar.
- Dokumentkoordinaten und responsive Vorschau lassen sich sauber trennen.
- Textumbruch, feste Textbereiche und Ellipsis reichen für den Durchstich aus.
- Bild-Cropping im Cover-Stil ist mit dem nativen Crop-Rechteck direkt abbildbar.
- Der PNG-Export ist deterministisch, sofern vorab auf Bilder und Fonts gewartet wird.
- Auswahl, Transformer, Ebenen und Snapping können später auf demselben Szenengraph ergänzt werden.

Der End-to-End-Test gegen `joschatest.church.tools` wurde mit einem eigens angelegten Termin inklusive hochgeladenem Bild durchgeführt. Das ChurchTools-Bild ließ sich mit der realen CORS-Konfiguration laden, im Cover-Stil zuschneiden und als Bestandteil eines verifizierten PNGs mit exakt 1920 × 1080 Pixeln exportieren. Ein Bildfehler ist weiterhin sichtbar behandelt und fällt für Vorschau und Export auf die definierte Farbfläche zurück. Aktuell gibt es keinen konkreten Grund für einen Alternativ-Spike mit Fabric.js oder DOM/SVG.
