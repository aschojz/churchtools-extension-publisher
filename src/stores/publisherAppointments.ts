import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { PublisherDataField } from '../domain/appointmentDataFields';

export const usePublisherAppointmentsStore = defineStore('publisherAppointments', () => {
    const selectedAppointmentKey = ref('');
    const appointmentSearch = ref('');
    const selectedCalendarFilter = ref('');
    const selectedAppointmentRange = ref('');
    const onlyAppointmentsWithDraft = ref(false);
    const appointmentDialogOpen = ref(false);
    const dataFields = ref<PublisherDataField[]>([]);
    const hasAppointmentFilters = computed(() => Boolean(
        appointmentSearch.value || selectedCalendarFilter.value || selectedAppointmentRange.value || onlyAppointmentsWithDraft.value,
    ));
    const resetAppointmentFilters = () => {
        appointmentSearch.value = '';
        selectedCalendarFilter.value = '';
        selectedAppointmentRange.value = '';
        onlyAppointmentsWithDraft.value = false;
    };

    return {
        appointmentDialogOpen,
        appointmentSearch,
        dataFields,
        hasAppointmentFilters,
        onlyAppointmentsWithDraft,
        resetAppointmentFilters,
        selectedAppointmentKey,
        selectedAppointmentRange,
        selectedCalendarFilter,
    };
});
