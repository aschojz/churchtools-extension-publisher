import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { storeToRefs } from 'pinia';
import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue';

import { isAppointmentWithinDays, matchesAppointmentFilters } from '../domain/appointmentFilters';
import { mapAppointmentToTemplateProps } from '../domain/mapAppointmentToTemplateProps';
import { usePublisherAppointmentsStore } from '../stores/publisherAppointments';
import { useAppointmentQuery, useAppointmentsQuery, useCalendarsQuery } from './useAppointmentsQuery';

export const usePublisherAppointments = (
    appointmentDocumentKeys: MaybeRefOrGetter<ReadonlySet<string>>,
    locale: string,
    timeZone?: string,
) => {
    const appointmentStore = usePublisherAppointmentsStore();
    const {
        appointmentDialogOpen,
        appointmentSearch,
        hasAppointmentFilters,
        onlyAppointmentsWithDraft,
        selectedAppointmentKey,
        selectedAppointmentRange,
        selectedCalendarFilter,
    } = storeToRefs(appointmentStore);
    const filterReferenceDate = new Date();
    const { data: calendars, error: calendarsError, isPending: calendarsPending } = useCalendarsQuery();
    const calendarIds = computed(() => calendars.value?.map(({ id }) => id) ?? []);
    const { data: appointments, error: appointmentsError, isPending: appointmentsPending } = useAppointmentsQuery(calendarIds);
    const appointmentKey = ({ appointment }: AppointmentCalculatedWithIncludes) =>
        `${appointment.base.id}:${appointment.calculated.startDate}`;
    const sortedAppointments = computed(() => [...(appointments.value ?? [])].sort((left, right) =>
        left.appointment.calculated.startDate.localeCompare(right.appointment.calculated.startDate)));
    const sortedCalendars = computed(() => [...(calendars.value ?? [])].sort((left, right) =>
        left.nameTranslated.localeCompare(right.nameTranslated, locale)));
    const draftAppointmentKeys = computed(() => toValue(appointmentDocumentKeys));
    const filteredAppointments = computed(() => sortedAppointments.value.filter(({ appointment }) => {
        const matchesTextAndCalendar = matchesAppointmentFilters({
            title: appointment.base.title,
            calendarId: String(appointment.base.calendar.id),
            calendarName: appointment.base.calendar.nameTranslated,
        }, appointmentSearch.value, selectedCalendarFilter.value);
        const rangeDays = selectedAppointmentRange.value ? Number(selectedAppointmentRange.value) : null;
        const key = `${appointment.base.id}:${appointment.calculated.startDate}`;
        return (!onlyAppointmentsWithDraft.value || draftAppointmentKeys.value.has(key)) &&
            matchesTextAndCalendar && isAppointmentWithinDays(
                appointment.calculated.startDate, rangeDays, filterReferenceDate,
            );
    }));
    const selectedAppointment = computed(() => sortedAppointments.value.find(
        (appointment) => appointmentKey(appointment) === selectedAppointmentKey.value,
    ));
    const selectedAppointmentId = computed(() => selectedAppointment.value?.appointment.base.id);
    const selectedStartDate = computed(() => selectedAppointment.value?.appointment.calculated.startDate.slice(0, 10));
    const { data: appointmentDetails, error: appointmentDetailsError, isFetching: appointmentDetailsPending } =
        useAppointmentQuery(() => selectedAppointmentId.value, () => selectedStartDate.value);
    const appointmentDetailsArePending = computed(() => appointmentDetailsPending.value);
    const mappedTemplateProps = computed(() => appointmentDetails.value
        ? mapAppointmentToTemplateProps(appointmentDetails.value.appointment, { locale, timeZone })
        : null);
    const isLoading = computed(() => calendarsPending.value || appointmentsPending.value);
    const loadingError = computed(() => calendarsError.value ?? appointmentsError.value);
    const formatAppointmentDate = ({ appointment }: AppointmentCalculatedWithIncludes) => {
        const options: Intl.DateTimeFormatOptions = appointment.base.allDay
            ? { dateStyle: 'full' }
            : { dateStyle: 'medium', timeStyle: 'short' };
        if (timeZone) options.timeZone = timeZone;
        return new Intl.DateTimeFormat(locale, options).format(new Date(appointment.calculated.startDate));
    };
    const appointmentPanelOptions = computed(() => filteredAppointments.value.map((appointment) => {
        const { base } = appointment.appointment;
        const draftLabel = draftAppointmentKeys.value.has(appointmentKey(appointment)) ? ' — Dokument' : '';
        return {
            key: appointmentKey(appointment),
            label: `${base.title} — ${formatAppointmentDate(appointment)} — ${base.calendar.nameTranslated}${draftLabel}`,
        };
    }));
    const appointmentCalendarOptions = computed(() => sortedCalendars.value.map((calendar) => ({
        id: String(calendar.id), label: calendar.nameTranslated,
    })));

    watch(
        [appointmentSearch, selectedCalendarFilter, selectedAppointmentRange, onlyAppointmentsWithDraft, draftAppointmentKeys],
        () => {
            if (selectedAppointmentKey.value && !filteredAppointments.value.some(
                (appointment) => appointmentKey(appointment) === selectedAppointmentKey.value,
            )) selectedAppointmentKey.value = '';
        },
    );

    return {
        appointmentCalendarOptions, appointmentDetails, appointmentDetailsArePending, appointmentDetailsError,
        appointmentDialogOpen, appointmentPanelOptions, appointmentSearch, hasAppointmentFilters,
        isLoading, loadingError, mappedTemplateProps, onlyAppointmentsWithDraft,
        resetAppointmentFilters: appointmentStore.resetAppointmentFilters,
        selectedAppointment, selectedAppointmentId, selectedAppointmentKey, selectedAppointmentRange,
        selectedCalendarFilter, totalAppointmentCount: computed(() => sortedAppointments.value.length),
    };
};
