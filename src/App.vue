<script setup lang="ts">
import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { useAppointmentQuery, useCalendarsQuery } from '@churchtools/vue-query';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import EventTemplate from './components/EventTemplate.vue';
import { useAppointmentsQuery } from './composables/useAppointmentsQuery';
import { mapAppointmentToTemplateProps } from './domain/mapAppointmentToTemplateProps';
import type { LayoutElementId } from './domain/layoutEditing';
import { validateLocalImage } from './domain/localImageOverride';
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
const replacementImageUrl = ref<string | null>(null);
const replacementImageName = ref('');
const replacementImageError = ref('');
const selectedTemplateId = ref<TemplateId>('split');
const layoutChanged = ref(false);
const canUndoLayout = ref(false);
const canRedoLayout = ref(false);
const selectedLayoutElement = ref<LayoutElementId | null>(null);
const selectedLayerPosition = ref(0);
const selectedLayerTotal = ref(0);
const snapEnabled = ref(true);
const layoutStep = computed(() => (snapEnabled.value ? 20 : 5));
const rotationStep = computed(() => (snapEnabled.value ? 15 : 5));
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

const templateProps = computed(() => {
    if (!mappedTemplateProps.value) {
        return null;
    }

    const propsWithOverrides = applyTemplateOverrides(mappedTemplateProps.value, templateOverrides.value);
    return replacementImageUrl.value
        ? { ...propsWithOverrides, imageUrl: replacementImageUrl.value }
        : propsWithOverrides;
});
const hasTemplateOverrides = computed(
    () => Object.keys(templateOverrides.value).length > 0 || Boolean(replacementImageUrl.value),
);

const isLoading = computed(() => calendarsPending.value || appointmentsPending.value);
const loadingError = computed(() => calendarsError.value ?? appointmentsError.value);

const revokeReplacementImage = (defer = true) => {
    const previousUrl = replacementImageUrl.value;
    replacementImageUrl.value = null;
    replacementImageName.value = '';
    replacementImageError.value = '';

    if (previousUrl) {
        if (defer) {
            void nextTick(() => URL.revokeObjectURL(previousUrl));
        } else {
            URL.revokeObjectURL(previousUrl);
        }
    }
};

const updateReplacementImage = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
        return;
    }

    const validationError = validateLocalImage(file);
    if (validationError) {
        replacementImageError.value = validationError;
        return;
    }

    const previousUrl = replacementImageUrl.value;
    replacementImageUrl.value = URL.createObjectURL(file);
    replacementImageName.value = file.name;
    replacementImageError.value = '';
    exportError.value = '';
    exportSuccess.value = '';
    if (previousUrl) {
        void nextTick(() => URL.revokeObjectURL(previousUrl));
    }
};

watch(selectedAppointmentKey, () => {
    exportError.value = '';
    exportSuccess.value = '';
    imageStatus.value = 'idle';
    templateOverrides.value = {};
    revokeReplacementImage();
});

watch(selectedTemplateId, () => {
    exportError.value = '';
    exportSuccess.value = '';
});

onBeforeUnmount(() => revokeReplacementImage(false));

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
    revokeReplacementImage();
};

const resetLayout = () => {
    templateRef.value?.resetLayout();
};

const undoLayout = () => {
    templateRef.value?.undoLayout();
};

const redoLayout = () => {
    templateRef.value?.redoLayout();
};

const updateLayoutHistory = (canUndo: boolean, canRedo: boolean) => {
    canUndoLayout.value = canUndo;
    canRedoLayout.value = canRedo;
};

const selectLayoutElement = (elementId: LayoutElementId) => {
    templateRef.value?.selectElement(elementId);
};

const nudgeLayoutElement = (deltaX: number, deltaY: number) => {
    templateRef.value?.nudgeSelectedElement(deltaX, deltaY);
};

const resizeLayoutElement = (deltaWidth: number, deltaHeight: number) => {
    templateRef.value?.resizeSelectedElement(deltaWidth, deltaHeight);
};

const rotateLayoutElement = (deltaRotation: number) => {
    templateRef.value?.rotateSelectedElement(deltaRotation);
};

const changeSelectedLayer = (direction: -1 | 1) => {
    templateRef.value?.changeSelectedLayer(direction);
};

const updateLayerPosition = (position: number, total: number) => {
    selectedLayerPosition.value = position;
    selectedLayerTotal.value = total;
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

                        <div class="template-field template-field--wide local-image-override">
                            <label for="override-image">Veranstaltungsbild</label>
                            <input
                                id="override-image"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                @change="updateReplacementImage"
                            />
                            <p class="template-field__help">
                                JPEG, PNG oder WebP bis 20 MB. Das Bild bleibt lokal und wird nicht zu ChurchTools hochgeladen.
                            </p>
                            <p v-if="replacementImageName" class="local-image-override__selection" role="status">
                                Lokales Bild: {{ replacementImageName }}
                            </p>
                            <p v-if="replacementImageError" class="local-image-override__error" role="alert">
                                {{ replacementImageError }}
                            </p>
                            <button
                                v-if="replacementImageUrl"
                                type="button"
                                class="template-field__reset"
                                @click="revokeReplacementImage()"
                            >
                                Originalbild wiederherstellen
                            </button>
                        </div>
                    </div>
                </form>

                <div class="layout-controls">
                    <div>
                        <h2>Layout anpassen</h2>
                        <p>Wähle Titel, Datum/Uhrzeit oder Ort aus. Anschließend kannst du den Bereich verschieben, skalieren, drehen oder in der Ebenenreihenfolge ändern.</p>
                        <label class="layout-controls__snap">
                            <input v-model="snapEnabled" type="checkbox" />
                            Am 20-Pixel-Raster und an 15°-Winkeln ausrichten
                        </label>
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
                            <button type="button" aria-label="Nach links verschieben" @click="nudgeLayoutElement(-layoutStep, 0)">←</button>
                            <button type="button" aria-label="Nach oben verschieben" @click="nudgeLayoutElement(0, -layoutStep)">↑</button>
                            <button type="button" aria-label="Nach unten verschieben" @click="nudgeLayoutElement(0, layoutStep)">↓</button>
                            <button type="button" aria-label="Nach rechts verschieben" @click="nudgeLayoutElement(layoutStep, 0)">→</button>
                        </div>
                        <div v-if="selectedLayoutElement" class="layout-controls__sizes" aria-label="Elementgröße ändern">
                            <button type="button" @click="resizeLayoutElement(-layoutStep, 0)">Schmaler</button>
                            <button type="button" @click="resizeLayoutElement(layoutStep, 0)">Breiter</button>
                            <button type="button" @click="resizeLayoutElement(0, -layoutStep)">Flacher</button>
                            <button type="button" @click="resizeLayoutElement(0, layoutStep)">Höher</button>
                        </div>
                        <div v-if="selectedLayoutElement" class="layout-controls__rotations" aria-label="Element drehen">
                            <button type="button" @click="rotateLayoutElement(-rotationStep)">−{{ rotationStep }}° drehen</button>
                            <button type="button" @click="rotateLayoutElement(rotationStep)">+{{ rotationStep }}° drehen</button>
                        </div>
                        <div v-if="selectedLayoutElement" class="layout-controls__layers" aria-label="Ebenenreihenfolge ändern">
                            <span>Ebene {{ selectedLayerPosition }} von {{ selectedLayerTotal }}</span>
                            <button
                                type="button"
                                :disabled="selectedLayerPosition <= 1"
                                @click="changeSelectedLayer(-1)"
                            >
                                Nach hinten
                            </button>
                            <button
                                type="button"
                                :disabled="selectedLayerPosition >= selectedLayerTotal"
                                @click="changeSelectedLayer(1)"
                            >
                                Nach vorne
                            </button>
                        </div>
                    </div>
                    <div class="layout-controls__actions">
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!canUndoLayout"
                            @click="undoLayout"
                        >
                            Rückgängig
                        </button>
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!canRedoLayout"
                            @click="redoLayout"
                        >
                            Wiederholen
                        </button>
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!layoutChanged"
                            @click="resetLayout"
                        >
                            Layout zurücksetzen
                        </button>
                    </div>
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
                    :snap-enabled="snapEnabled"
                    @image-status="imageStatus = $event"
                    @history-change="updateLayoutHistory"
                    @layer-position-change="updateLayerPosition"
                    @layout-change="layoutChanged = $event"
                    @selection-change="selectedLayoutElement = $event"
                />
            </section>

            <p class="publisher-card__meta">Aktive Sprache: {{ userLanguage }}</p>
        </section>
    </main>
</template>
