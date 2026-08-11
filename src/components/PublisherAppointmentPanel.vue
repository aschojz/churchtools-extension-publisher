<script setup lang="ts">
export interface AppointmentPanelOption {
    key: string;
    label: string;
}

export interface AppointmentCalendarOption {
    id: string;
    label: string;
}

defineProps<{
    appointments: AppointmentPanelOption[];
    calendars: AppointmentCalendarOption[];
    hasError: boolean;
    hasFilters: boolean;
    isLoading: boolean;
    totalCount: number;
}>();

const emit = defineEmits<{
    resetFilters: [];
}>();

const search = defineModel<string>('search', { required: true });
const selectedCalendar = defineModel<string>('selectedCalendar', { required: true });
const selectedRange = defineModel<string>('selectedRange', { required: true });
const onlyDrafts = defineModel<boolean>('onlyDrafts', { required: true });
const selectedAppointmentKey = defineModel<string>('selectedAppointmentKey', { required: true });
</script>

<template>
    <section id="appointments-editor" class="publisher-appointment-panel" aria-labelledby="appointments-panel-title">
        <header class="publisher-appointment-panel__header">
            <p>Dokumente</p>
            <h2 id="appointments-panel-title">Termine</h2>
        </header>

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
                        <input v-model="search" type="search" placeholder="Titel oder Kalender" />
                    </label>
                    <label>
                        Kalender
                        <select v-model="selectedCalendar">
                            <option value="">Alle Kalender</option>
                            <option v-for="calendar in calendars" :key="calendar.id" :value="calendar.id">
                                {{ calendar.label }}
                            </option>
                        </select>
                    </label>
                    <label>
                        Zeitraum
                        <select v-model="selectedRange">
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
                            <input v-model="onlyDrafts" type="checkbox" />
                            Nur mit Entwurf
                        </label>
                        <button
                            v-if="hasFilters"
                            type="button"
                            class="appointment-picker__reset"
                            @click="emit('resetFilters')"
                        >
                            Filter zurücksetzen
                        </button>
                    </div>
                </div>

                <label for="appointment">Kalendertermin</label>
                <select id="appointment" v-model="selectedAppointmentKey" :disabled="appointments.length === 0">
                    <option value="">Bitte Termin auswählen</option>
                    <option v-for="appointment in appointments" :key="appointment.key" :value="appointment.key">
                        {{ appointment.label }}
                    </option>
                </select>
            </template>
        </div>
    </section>
</template>

<style scoped>
.publisher-appointment-panel {
    width: clamp(240px, 24vw, 330px);
    height: 100%;
    padding: 18px 14px;
    overflow-y: auto;
}

.publisher-appointment-panel__header {
    margin-bottom: 18px;
}

.publisher-appointment-panel__header p {
    margin: 0 0 2px;
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.publisher-appointment-panel__header h2 {
    margin: 0;
    font-size: 20px;
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

.appointment-picker__filter-summary {
    gap: 8px;
}

.appointment-picker__filter-actions {
    gap: 7px;
}

.appointment-picker__draft-filter {
    white-space: normal;
}

.appointment-picker input,
.appointment-picker select {
    min-height: 40px;
    padding-right: 32px;
}

.status-message {
    font-size: 13px;
}
</style>
