<script setup lang="ts">
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { ref, watch } from 'vue';

import { usePublisherAppointmentsStore } from '../stores/publisherAppointments';
import DesignButton from './design/DesignButton.vue';
import DesignDialog from './design/DesignDialog.vue';

export interface AppointmentPanelOption {
    key: string;
    label: string;
}

export interface AppointmentCalendarOption {
    id: string;
    label: string;
}

const props = defineProps<{
    appointments: AppointmentPanelOption[];
    calendars: AppointmentCalendarOption[];
    hasError: boolean;
    isLoading: boolean;
    totalCount: number;
}>();

const emit = defineEmits<{
    close: [];
}>();
const appointmentStore = usePublisherAppointmentsStore();
const {
    appointmentDialogOpen, appointmentSearch, hasAppointmentFilters, onlyAppointmentsWithDraft,
    selectedAppointmentKey, selectedAppointmentRange, selectedCalendarFilter,
} = storeToRefs(appointmentStore);
const pendingAppointmentKey = ref('');

watch(
    appointmentDialogOpen,
    (open) => {
        if (!open) return;
        pendingAppointmentKey.value = selectedAppointmentKey.value;
    },
    { immediate: true },
);

const confirmSelection = () => {
    selectedAppointmentKey.value = pendingAppointmentKey.value;
    emit('close');
};

</script>

<template>
    <DesignDialog
        :open="appointmentDialogOpen"
        title="Termin auswählen"
        description="Der Termin liefert Daten für Variablen, verändert aber das aktuelle Layout nicht."
        panel-class="publisher-appointment-dialog"
        @close="emit('close')"
    >
        <template #icon><FontAwesomeIcon :icon="faCalendarDays" /></template>
        <section id="appointments-editor" class="publisher-appointment-panel">
            <div class="appointment-picker">
                <p v-if="isLoading" class="status-message" role="status">Termine werden geladen …</p>

                <p v-else-if="hasError" class="status-message status-message--error" role="alert">
                    Die Kalendertermine konnten nicht geladen werden. Prüfe Anmeldung und Berechtigungen.
                </p>

                <p v-else-if="totalCount === 0" class="status-message" role="status">
                    In den nächsten zwölf Monaten wurden keine sichtbaren Termine gefunden.
                </p>

                <template v-else>
                    <div class="appointment-picker__filters">
                        <label>
                            Suche
                            <input v-model="appointmentSearch" data-dialog-initial-focus type="search" placeholder="Titel oder Kalender" />
                        </label>
                        <label>
                            Kalender
                            <select v-model="selectedCalendarFilter">
                                <option value="">Alle Kalender</option>
                                <option v-for="calendar in calendars" :key="calendar.id" :value="calendar.id">
                                    {{ calendar.label }}
                                </option>
                            </select>
                        </label>
                        <label>
                            Zeitraum
                            <select v-model="selectedAppointmentRange">
                                <option value="">Nächste 12 Monate</option>
                                <option value="30">Nächste 30 Tage</option>
                                <option value="90">Nächste 90 Tage</option>
                                <option value="365">Nächste 365 Tage</option>
                            </select>
                        </label>
                    </div>

                    <div class="appointment-picker__filter-summary">
                        <p class="appointment-picker__result-count" role="status">
                            {{ appointments.length }} von {{ totalCount }} Terminen
                        </p>
                        <div class="appointment-picker__filter-actions">
                            <label class="appointment-picker__draft-filter">
                                <input v-model="onlyAppointmentsWithDraft" type="checkbox" />
                                Nur mit Dokument
                            </label>
                            <DesignButton
                                v-if="hasAppointmentFilters"
                                class="appointment-picker__reset"
                                size="compact"
                                variant="ghost"
                                @click="appointmentStore.resetAppointmentFilters"
                            >
                                Filter zurücksetzen
                            </DesignButton>
                        </div>
                    </div>

                    <label for="appointment">Kalendertermin</label>
                    <select
                        id="appointment"
                        v-model="pendingAppointmentKey"
                        :disabled="appointments.length === 0"
                    >
                        <option value="">Ohne Termin</option>
                        <option v-for="appointment in appointments" :key="appointment.key" :value="appointment.key">
                            {{ appointment.label }}
                        </option>
                    </select>
                </template>
            </div>
        </section>
        <template #footer>
            <DesignButton variant="secondary" @click="emit('close')">Abbrechen</DesignButton>
            <DesignButton @click="confirmSelection">
                <template #icon><FontAwesomeIcon :icon="faCalendarDays" aria-hidden="true" /></template>
                Auswahl übernehmen
            </DesignButton>
        </template>
    </DesignDialog>
</template>

<style scoped>
:global(.publisher-appointment-dialog) {
    width: min(760px, calc(100vw - 32px));
}

.publisher-appointment-panel {
    padding: 24px;
    overflow-y: auto;
}

.appointment-picker__filters {
    grid-template-columns: minmax(0, 2fr) repeat(2, minmax(150px, 1fr));
}

.appointment-picker__filter-summary {
    gap: 8px;
}

.appointment-picker input,
.appointment-picker select {
    padding-right: 32px;
}

.status-message {
    font-size: 13px;
}

@media (max-width: 680px) {
    :global(.publisher-appointment-dialog) {
        width: calc(100vw - 20px);
        max-height: calc(100dvh - 20px);
    }

    .publisher-appointment-panel {
        padding: 18px;
    }

    .appointment-picker__filters {
        grid-template-columns: 1fr;
        gap: 11px;
    }

    .appointment-picker__filter-summary,
    .appointment-picker__filter-actions {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
