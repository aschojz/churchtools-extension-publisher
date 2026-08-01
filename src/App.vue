<script setup lang="ts">
import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { useAppointmentQuery, useCalendarsQuery } from '@churchtools/vue-query';
import { computed, ref, watch } from 'vue';

import EventTemplate from './components/EventTemplate.vue';
import { useAppointmentsQuery } from './composables/useAppointmentsQuery';
import { mapAppointmentToTemplateProps } from './domain/mapAppointmentToTemplateProps';
import type { LayoutElementId } from './domain/layoutEditing';
import {
    applyTemplateOverrides,
    type EditableTemplateField,
    type EventTemplateOverrides,
    withTemplateOverride,
} from './domain/templateOverrides';
import { TEMPLATE_OPTIONS, type TemplateId } from './domain/templates';

const userLanguage = window.settings?.language ?? navigator.language;
const userTimeZone = window.settings?.timezone;
const selectedAppointmentKey = ref('');
const templateRef = ref<InstanceType<typeof EventTemplate> | null>(null);
const imageStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');
const exportError = ref('');
const exportSuccess = ref('');
const templateOverrides = ref<EventTemplateOverrides>({});
const selectedTemplateId = ref<TemplateId>('split');
const layoutChanged = ref(false);
const selectedLayoutElement = ref<LayoutElementId | null>(null);
const layoutElementLabels: Record<LayoutElementId, string> = {
    title: 'Titel',
    dateTime: 'Datum/Uhrzeit',
    location: 'Ort',
};

const { data: calendars, error: calendarsError, isPending: calendarsPending } = useCalendarsQuery();
const calendarIds = computed(() => calendars.value?.map(({ id }) => id) ?? []);
const {
    data: appointments,
    error: appointmentsError,
    isPending: appointmentsPending,
} = useAppointmentsQuery(calendarIds);

const appointmentKey = ({ appointment }: AppointmentCalculatedWithIncludes) =>
    `${appointment.base.id}:${appointment.calculated.startDate}`;

const sortedAppointments = computed(() =>
    [...(appointments.value ?? [])].sort((left, right) =>
        left.appointment.calculated.startDate.localeCompare(right.appointment.calculated.startDate),
    ),
);

const selectedAppointment = computed(
    () => sortedAppointments.value.find((appointment) => appointmentKey(appointment) === selectedAppointmentKey.value),
);
const selectedAppointmentId = computed(() => selectedAppointment.value?.appointment.base.id);
const selectedStartDate = computed(() => selectedAppointment.value?.appointment.calculated.startDate.slice(0, 10));
const {
    data: appointmentDetails,
    error: appointmentDetailsError,
    isFetching: appointmentDetailsPending,
} = useAppointmentQuery(
    () => selectedAppointmentId.value,
    () => selectedStartDate.value,
);

const mappedTemplateProps = computed(() => {
    if (!appointmentDetails.value) {
        return null;
    }

    return mapAppointmentToTemplateProps(appointmentDetails.value.appointment, {
        locale: userLanguage,
        timeZone: userTimeZone,
    });
});

const templateProps = computed(() =>
    mappedTemplateProps.value
        ? applyTemplateOverrides(mappedTemplateProps.value, templateOverrides.value)
        : null,
);
const hasTemplateOverrides = computed(() => Object.keys(templateOverrides.value).length > 0);

const isLoading = computed(() => calendarsPending.value || appointmentsPending.value);
const loadingError = computed(() => calendarsError.value ?? appointmentsError.value);

watch(selectedAppointmentKey, () => {
    exportError.value = '';
    exportSuccess.value = '';
    imageStatus.value = 'idle';
    templateOverrides.value = {};
});

watch(selectedTemplateId, () => {
    exportError.value = '';
    exportSuccess.value = '';
});

const templateFieldValue = (field: EditableTemplateField) =>
    templateOverrides.value[field] ?? mappedTemplateProps.value?.[field] ?? '';

const updateTemplateOverride = (field: EditableTemplateField, event: Event) => {
    if (!mappedTemplateProps.value) {
        return;
    }

    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    templateOverrides.value = withTemplateOverride(
        mappedTemplateProps.value,
        templateOverrides.value,
        field,
        value,
    );
    exportError.value = '';
    exportSuccess.value = '';
};

const resetTemplateOverride = (field: EditableTemplateField) => {
    const nextOverrides = { ...templateOverrides.value };
    delete nextOverrides[field];
    templateOverrides.value = nextOverrides;
};

const resetTemplateOverrides = () => {
    templateOverrides.value = {};
};

const resetLayout = () => {
    templateRef.value?.resetLayout();
};

const selectLayoutElement = (elementId: LayoutElementId) => {
    templateRef.value?.selectElement(elementId);
};

const nudgeLayoutElement = (deltaX: number, deltaY: number) => {
    templateRef.value?.nudgeSelectedElement(deltaX, deltaY);
};

const formatAppointmentDate = ({ appointment }: AppointmentCalculatedWithIncludes) => {
    const { base, calculated } = appointment;
    const options: Intl.DateTimeFormatOptions = base.allDay
        ? { dateStyle: 'full' }
        : { dateStyle: 'medium', timeStyle: 'short' };

    if (userTimeZone) {
        options.timeZone = userTimeZone;
    }

    return new Intl.DateTimeFormat(userLanguage, options).format(new Date(calculated.startDate));
};

const appointmentLabel = (appointment: AppointmentCalculatedWithIncludes) => {
    const { base } = appointment.appointment;
    return `${base.title} — ${formatAppointmentDate(appointment)} — ${base.calendar.nameTranslated}`;
};

const slugify = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

const exportPng = async () => {
    exportError.value = '';
    exportSuccess.value = '';

    try {
        const dataUrl = await templateRef.value?.exportPng();
        if (!dataUrl || !templateProps.value || !selectedAppointmentId.value) {
            throw new Error('Die Vorschau ist noch nicht bereit.');
        }

        const pngBlob = await (await fetch(dataUrl)).blob();
        const exportedImage = await createImageBitmap(pngBlob);
        const exportedSize = { width: exportedImage.width, height: exportedImage.height };
        exportedImage.close();

        if (exportedSize.width !== 1920 || exportedSize.height !== 1080) {
            throw new Error(`Unerwartete Exportgröße: ${exportedSize.width} × ${exportedSize.height} Pixel.`);
        }

        const downloadUrl = URL.createObjectURL(pngBlob);
        const download = document.createElement('a');
        download.href = downloadUrl;
        download.download = `veranstaltung-${selectedAppointmentId.value}-${slugify(templateProps.value.title) || 'termin'}.png`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
        exportSuccess.value = 'PNG mit 1920 × 1080 Pixeln wurde erstellt.';
    } catch (error) {
        exportError.value = error instanceof Error ? error.message : 'Der PNG-Export ist fehlgeschlagen.';
    }
};
</script>

<template>
    <main class="publisher-page">
        <section class="publisher-card">
            <header class="publisher-card__header">
                <p class="publisher-card__eyebrow">ChurchTools Publisher</p>
                <h1>Publisher</h1>
                <p>Wähle einen Kalendertermin für das spätere Testlayout aus.</p>
            </header>

            <div class="appointment-picker">
                <label for="appointment">Kalendertermin</label>

                <p v-if="isLoading" class="status-message" role="status">Termine werden geladen …</p>

                <p v-else-if="loadingError" class="status-message status-message--error" role="alert">
                    Die Kalendertermine konnten nicht geladen werden. Prüfe Anmeldung und Berechtigungen.
                </p>

                <p v-else-if="sortedAppointments.length === 0" class="status-message" role="status">
                    In den nächsten zwölf Monaten wurden keine sichtbaren Termine gefunden.
                </p>

                <select v-else id="appointment" v-model="selectedAppointmentKey">
                    <option value="">Bitte Termin auswählen</option>
                    <option
                        v-for="appointment in sortedAppointments"
                        :key="appointmentKey(appointment)"
                        :value="appointmentKey(appointment)"
                    >
                        {{ appointmentLabel(appointment) }}
                    </option>
                </select>
            </div>

            <p v-if="appointmentDetailsPending" class="status-message template-status" role="status">
                Termindetails werden geladen …
            </p>

            <p v-else-if="appointmentDetailsError" class="status-message status-message--error template-status" role="alert">
                Die Termindetails konnten nicht geladen werden.
            </p>

            <section v-else-if="templateProps" class="template-section" aria-live="polite">
                <div class="template-picker">
                    <div>
                        <label for="template">Template</label>
                        <p>Das Template ändert nur die Gestaltung; Termin und Inhaltsanpassungen bleiben erhalten.</p>
                    </div>
                    <select id="template" v-model="selectedTemplateId">
                        <option v-for="option in TEMPLATE_OPTIONS" :key="option.id" :value="option.id">
                            {{ option.label }}
                        </option>
                    </select>
                </div>

                <form class="template-overrides" @submit.prevent>
                    <div class="template-overrides__header">
                        <div>
                            <h2>Inhalte anpassen</h2>
                            <p>Änderungen gelten nur für diesen Export und verändern den ChurchTools-Termin nicht.</p>
                        </div>
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!hasTemplateOverrides"
                            @click="resetTemplateOverrides"
                        >
                            Alle zurücksetzen
                        </button>
                    </div>

                    <div class="template-overrides__grid">
                        <div class="template-field template-field--wide">
                            <label for="override-title">Titel</label>
                            <textarea
                                id="override-title"
                                rows="2"
                                :value="templateFieldValue('title')"
                                @input="updateTemplateOverride('title', $event)"
                            />
                            <button
                                v-if="templateOverrides.title !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('title')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field">
                            <label for="override-date">Datum</label>
                            <input
                                id="override-date"
                                :value="templateFieldValue('date')"
                                @input="updateTemplateOverride('date', $event)"
                            />
                            <button
                                v-if="templateOverrides.date !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('date')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field">
                            <label for="override-time">Uhrzeit</label>
                            <input
                                id="override-time"
                                :value="templateFieldValue('time')"
                                @input="updateTemplateOverride('time', $event)"
                            />
                            <button
                                v-if="templateOverrides.time !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('time')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field template-field--wide">
                            <label for="override-location">Ort</label>
                            <input
                                id="override-location"
                                :value="templateFieldValue('location')"
                                @input="updateTemplateOverride('location', $event)"
                            />
                            <button
                                v-if="templateOverrides.location !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('location')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>
                    </div>
                </form>

                <div class="layout-controls">
                    <div>
                        <h2>Layout anpassen</h2>
                        <p>Wähle Titel, Datum/Uhrzeit oder Ort direkt in der Vorschau aus und ziehe das Element an eine neue Position.</p>
                        <p v-if="selectedLayoutElement" class="layout-controls__selection" role="status">
                            Ausgewählt: {{ layoutElementLabels[selectedLayoutElement] }}
                        </p>
                        <div class="layout-controls__elements" aria-label="Layoutelement auswählen">
                            <button
                                v-for="(label, elementId) in layoutElementLabels"
                                :key="elementId"
                                type="button"
                                :class="{ 'is-selected': selectedLayoutElement === elementId }"
                                @click="selectLayoutElement(elementId)"
                            >
                                {{ label }}
                            </button>
                        </div>
                        <div v-if="selectedLayoutElement" class="layout-controls__directions" aria-label="Element verschieben">
                            <button type="button" aria-label="Nach links verschieben" @click="nudgeLayoutElement(-20, 0)">←</button>
                            <button type="button" aria-label="Nach oben verschieben" @click="nudgeLayoutElement(0, -20)">↑</button>
                            <button type="button" aria-label="Nach unten verschieben" @click="nudgeLayoutElement(0, 20)">↓</button>
                            <button type="button" aria-label="Nach rechts verschieben" @click="nudgeLayoutElement(20, 0)">→</button>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="button button--secondary"
                        :disabled="!layoutChanged"
                        @click="resetLayout"
                    >
                        Layout zurücksetzen
                    </button>
                </div>

                <div class="template-section__header">
                    <div>
                        <p class="appointment-summary__label">Vorschau · 1920 × 1080 px</p>
                        <h2>{{ templateProps.title }}</h2>
                    </div>
                    <button class="button" type="button" :disabled="imageStatus === 'loading'" @click="exportPng">
                        {{ imageStatus === 'loading' ? 'Bild wird geladen …' : 'PNG exportieren' }}
                    </button>
                </div>

                <p v-if="imageStatus === 'error'" class="status-message status-message--warning" role="status">
                    Das Veranstaltungsbild konnte nicht geladen werden. Für Vorschau und Export wird die Fallback-Fläche verwendet.
                </p>
                <p v-if="exportError" class="status-message status-message--error" role="alert">{{ exportError }}</p>
                <p v-if="exportSuccess" class="status-message status-message--success" role="status">
                    {{ exportSuccess }}
                </p>

                <EventTemplate
                    ref="templateRef"
                    :template="templateProps"
                    :template-id="selectedTemplateId"
                    @image-status="imageStatus = $event"
                    @layout-change="layoutChanged = $event"
                    @selection-change="selectedLayoutElement = $event"
                />
            </section>

            <p class="publisher-card__meta">Aktive Sprache: {{ userLanguage }}</p>
        </section>
    </main>
</template>
