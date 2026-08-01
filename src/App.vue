<script setup lang="ts">
import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { useAppointmentQuery, useCalendarsQuery } from '@churchtools/vue-query';
import { computed, ref, watch } from 'vue';

import EventTemplate from './components/EventTemplate.vue';
import { useAppointmentsQuery } from './composables/useAppointmentsQuery';
import { mapAppointmentToTemplateProps } from './domain/mapAppointmentToTemplateProps';

const userLanguage = window.settings?.language ?? navigator.language;
const userTimeZone = window.settings?.timezone;
const selectedAppointmentKey = ref('');
const templateRef = ref<InstanceType<typeof EventTemplate> | null>(null);
const imageStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');
const exportError = ref('');
const exportSuccess = ref('');

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

const templateProps = computed(() => {
    if (!appointmentDetails.value) {
        return null;
    }

    return mapAppointmentToTemplateProps(appointmentDetails.value.appointment, {
        locale: userLanguage,
        timeZone: userTimeZone,
    });
});

const isLoading = computed(() => calendarsPending.value || appointmentsPending.value);
const loadingError = computed(() => calendarsError.value ?? appointmentsError.value);

watch(selectedAppointmentKey, () => {
    exportError.value = '';
    exportSuccess.value = '';
    imageStatus.value = 'idle';
});

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
                <div class="template-section__header">
                    <div>
                        <p class="appointment-summary__label">Vorschau · 1920 × 1080 px</p>
                        <h2>{{ templateProps.title }}</h2>
                    </div>
                    <button type="button" :disabled="imageStatus === 'loading'" @click="exportPng">
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

                <EventTemplate ref="templateRef" :template="templateProps" @image-status="imageStatus = $event" />
            </section>

            <p class="publisher-card__meta">Aktive Sprache: {{ userLanguage }}</p>
        </section>
    </main>
</template>
