<script setup lang="ts">
import { faCalendarDays, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { nextTick, ref, watch } from 'vue';

import { usePublisherAppointmentsStore } from '../stores/publisherAppointments';
import DesignButton from './design/DesignButton.vue';
import DesignIconButton from './design/DesignIconButton.vue';

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
const dialog = ref<HTMLDialogElement | null>(null);
const pendingAppointmentKey = ref('');

watch(
    appointmentDialogOpen,
    (open) => {
        if (!open && (dialog.value?.open || dialog.value?.hasAttribute('open'))) {
            if (typeof dialog.value.close === 'function') {
                dialog.value.close();
            }
            dialog.value.removeAttribute('open');
            return;
        }
        if (!open) return;
        pendingAppointmentKey.value = selectedAppointmentKey.value;
        void nextTick(() => {
            if (!appointmentDialogOpen.value || dialog.value?.open) return;
            if (typeof dialog.value?.showModal === 'function') dialog.value.showModal();
            else dialog.value?.setAttribute('open', '');
        });
    },
    { immediate: true },
);

const confirmSelection = () => {
    if (pendingAppointmentKey.value) {
        selectedAppointmentKey.value = pendingAppointmentKey.value;
        emit('close');
    }
};

const closeFromBackdrop = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
        emit('close');
    }
};
</script>

<template>
    <dialog
        ref="dialog"
        class="publisher-appointment-dialog"
        aria-labelledby="appointments-panel-title"
        @cancel.prevent="emit('close')"
        @click="closeFromBackdrop"
    >
        <section id="appointments-editor" class="publisher-appointment-panel">
            <header class="publisher-appointment-panel__header">
                <div class="publisher-appointment-panel__title">
                    <span class="publisher-appointment-panel__icon"><FontAwesomeIcon :icon="faCalendarDays" aria-hidden="true" /></span>
                    <h2 id="appointments-panel-title">Termin auswählen</h2>
                </div>
                <DesignIconButton class="publisher-appointment-panel__close" label="Dialog schließen" @click="emit('close')">
                    <FontAwesomeIcon :icon="faXmark" aria-hidden="true" />
                </DesignIconButton>
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
                            <input v-model="appointmentSearch" type="search" placeholder="Titel oder Kalender" autofocus />
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
                                Nur mit Entwurf
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
                        <option value="">Bitte Termin auswählen</option>
                        <option v-for="appointment in appointments" :key="appointment.key" :value="appointment.key">
                            {{ appointment.label }}
                        </option>
                    </select>
                </template>
            </div>
            <footer class="publisher-appointment-panel__footer">
                <DesignButton variant="secondary" @click="emit('close')">Abbrechen</DesignButton>
                <DesignButton :disabled="!pendingAppointmentKey" @click="confirmSelection">
                    <template #icon><FontAwesomeIcon :icon="faCalendarDays" aria-hidden="true" /></template>
                    Termin verwenden
                </DesignButton>
            </footer>
        </section>
    </dialog>
</template>

<style scoped>
.publisher-appointment-dialog {
    width: min(760px, calc(100vw - 32px));
    max-width: none;
    max-height: min(760px, calc(100dvh - 32px));
    box-sizing: border-box;
    margin: auto;
    padding: 0;
    overflow-y: auto;
    border: 1px solid var(--color-border-strong);
    border-radius: 14px;
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: 0 24px 70px rgb(0 0 0 / 28%);
}

.publisher-appointment-dialog::backdrop {
    background: rgb(11 18 28 / 58%);
    backdrop-filter: blur(2px);
}

.publisher-appointment-panel {
    padding: 24px;
    overflow-y: auto;
}

.publisher-appointment-panel__header {
    display: flex;
    margin-bottom: 22px;
    align-items: start;
    justify-content: space-between;
}

.publisher-appointment-panel__title {
    display: flex;
    gap: 12px;
    align-items: center;
}

.publisher-appointment-panel__icon {
    display: grid;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--color-surface-accent-strong);
    color: var(--color-accent-text);
    place-items: center;
}

.publisher-appointment-panel__header h2 {
    margin: 0;
    font-size: 24px;
}

.publisher-appointment-panel__close {
    display: grid;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--color-border-control);
    border-radius: 8px;
    background: var(--color-surface-subtle);
    color: var(--color-text);
    cursor: pointer;
    place-items: center;
}

.publisher-appointment-panel__close:hover {
    background: var(--color-surface-info);
}

.publisher-appointment-panel__close:focus-visible {
    outline: 3px solid var(--color-focus-ring-strong);
    outline-offset: 1px;
}

.publisher-appointment-panel__footer {
    display: flex;
    margin-top: 22px;
    gap: 10px;
    justify-content: flex-end;
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
    .publisher-appointment-dialog {
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
