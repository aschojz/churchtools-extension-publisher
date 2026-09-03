<script setup lang="ts">
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { nextTick, ref, watch } from 'vue';

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
    hasFilters: boolean;
    isLoading: boolean;
    open: boolean;
    totalCount: number;
}>();

const emit = defineEmits<{
    close: [];
    resetFilters: [];
}>();

const search = defineModel<string>('search', { required: true });
const selectedCalendar = defineModel<string>('selectedCalendar', { required: true });
const selectedRange = defineModel<string>('selectedRange', { required: true });
const onlyDrafts = defineModel<boolean>('onlyDrafts', { required: true });
const selectedAppointmentKey = defineModel<string>('selectedAppointmentKey', { required: true });
const dialog = ref<HTMLDialogElement | null>(null);

watch(
    () => props.open,
    async (open) => {
        await nextTick();
        if (open && !dialog.value?.open) {
            if (typeof dialog.value?.showModal === 'function') {
                dialog.value.showModal();
            } else {
                dialog.value?.setAttribute('open', '');
            }
        } else if (!open && dialog.value?.open) {
            if (typeof dialog.value.close === 'function') {
                dialog.value.close();
            } else {
                dialog.value.removeAttribute('open');
            }
        }
    },
    { immediate: true },
);

const closeAfterSelection = () => {
    if (selectedAppointmentKey.value) {
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
                <div>
                    <p>Dokumente</p>
                    <h2 id="appointments-panel-title">Termin auswählen</h2>
                </div>
                <button type="button" class="publisher-appointment-panel__close" aria-label="Dialog schließen" @click="emit('close')">
                    <FontAwesomeIcon :icon="faXmark" aria-hidden="true" />
                </button>
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
                            <input v-model="search" type="search" placeholder="Titel oder Kalender" autofocus />
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
                    <select
                        id="appointment"
                        v-model="selectedAppointmentKey"
                        :disabled="appointments.length === 0"
                        @change="closeAfterSelection"
                    >
                        <option value="">Bitte Termin auswählen</option>
                        <option v-for="appointment in appointments" :key="appointment.key" :value="appointment.key">
                            {{ appointment.label }}
                        </option>
                    </select>
                </template>
            </div>
        </section>
    </dialog>
</template>

<style scoped>
.publisher-appointment-dialog {
    width: min(760px, calc(100vw - 32px));
    max-width: none;
    max-height: min(760px, calc(100dvh - 32px));
    box-sizing: border-box;
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
