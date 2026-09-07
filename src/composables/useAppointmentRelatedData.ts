import type {
    AppointmentCalculatedWithIncludes,
    Event,
    EventMasterData,
    GetEventMasterdataResponse,
    GetEventsResponse,
    GetGroupsResponse,
    Group,
} from '@churchtools/api-types';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { getParams, GROUP_STATUS_ID } from '@churchtools/utils';
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';

import type { PublisherDataField } from '../domain/appointmentDataFields';
import {
    createAppointmentRelatedDataSources,
    createEventDataFields,
    createSignupGroupDataFields,
    type PublisherRelatedDataSource,
    type PublisherRelatedDataSourceKind,
} from '../domain/appointmentRelatedData';

const nextDate = (dateValue: string) => {
    const date = new Date(`${dateValue}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
};

const errorMessage = (error: unknown) => error instanceof Error && error.message
    ? error.message
    : 'Die verknüpften Daten konnten nicht geladen werden.';

export const useAppointmentRelatedData = (
    details: MaybeRefOrGetter<AppointmentCalculatedWithIncludes | null | undefined>,
    selectedAppointmentKey: MaybeRefOrGetter<string>,
    locale: string,
    timeZone?: string,
) => {
    const fieldsBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, PublisherDataField[]>>>({});
    const statusBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, PublisherRelatedDataSource['status']>>>({});
    const errorsBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, string>>>({});
    const eventMasterData = ref<EventMasterData>();
    let eventMasterDataRequest: Promise<EventMasterData | undefined> | undefined;
    const sourceDefinitions = computed(() => createAppointmentRelatedDataSources(toValue(details) ?? undefined));
    const sourceSignature = computed(() => `${toValue(selectedAppointmentKey)}:${sourceDefinitions.value
        .map(({ id, entityId }) => `${id}-${entityId}`).join(':')}`);

    watch(sourceSignature, () => {
        fieldsBySource.value = {};
        statusBySource.value = {};
        errorsBySource.value = {};
    });

    const relatedDataSources = computed(() => sourceDefinitions.value.map((source) => ({
        ...source,
        status: statusBySource.value[source.id] ?? 'available',
        fieldCount: fieldsBySource.value[source.id]?.length ?? 0,
        error: errorsBySource.value[source.id],
    })));
    const relatedDataFields = computed(() => sourceDefinitions.value.flatMap(
        ({ id }) => fieldsBySource.value[id] ?? [],
    ));

    const loadEventMasterData = () => {
        if (eventMasterData.value) return Promise.resolve(eventMasterData.value);
        eventMasterDataRequest ??= churchtoolsClient.get<GetEventMasterdataResponse['data']>('/event/masterdata')
            .then((data) => {
                eventMasterData.value = data;
                return data;
            })
            .catch(() => undefined)
            .finally(() => { eventMasterDataRequest = undefined; });
        return eventMasterDataRequest;
    };

    const loadEvent = async (source: PublisherRelatedDataSource) => {
        const appointment = toValue(details);
        if (!appointment) throw new Error('Der Termin ist nicht mehr verfügbar.');
        const from = appointment.appointment.calculated.startDate.slice(0, 10);
        const [events, masterData] = await Promise.all([
            churchtoolsClient.get<GetEventsResponse['data']>(`/events${getParams({
                from,
                to: nextDate(from),
                include: 'eventServices',
                limit: 99,
            })}`),
            loadEventMasterData(),
        ]);
        const event = events.find(({ id }) => id === source.entityId);
        if (!event) throw new Error('Das verknüpfte Event ist nicht verfügbar oder darf nicht angezeigt werden.');
        return createEventDataFields(event as Event, source, { locale, timeZone }, masterData);
    };

    const loadSignupGroup = async (source: PublisherRelatedDataSource) => {
        const groups = await churchtoolsClient.get<GetGroupsResponse['data']>(`/groups${getParams({
            ids: [source.entityId],
            include: ['memberStatistics', 'places', 'signupConditions'],
            group_status_ids: Object.values(GROUP_STATUS_ID),
            limit: 1,
        })}`);
        const group = groups.find(({ id }) => id === source.entityId);
        if (!group) throw new Error('Die verknüpfte Anmeldegruppe ist nicht verfügbar oder darf nicht angezeigt werden.');
        return createSignupGroupDataFields(group as Group, source, { locale, timeZone });
    };

    const loadRelatedDataSource = async (sourceId: PublisherRelatedDataSourceKind) => {
        const source = relatedDataSources.value.find(({ id }) => id === sourceId);
        if (!source || source.status === 'loading') return;
        const signature = sourceSignature.value;
        statusBySource.value = { ...statusBySource.value, [sourceId]: 'loading' };
        errorsBySource.value = { ...errorsBySource.value, [sourceId]: undefined };
        try {
            const fields = source.kind === 'event' ? await loadEvent(source) : await loadSignupGroup(source);
            if (signature !== sourceSignature.value) return;
            fieldsBySource.value = { ...fieldsBySource.value, [sourceId]: fields };
            statusBySource.value = { ...statusBySource.value, [sourceId]: 'loaded' };
        } catch (error) {
            if (signature !== sourceSignature.value) return;
            errorsBySource.value = { ...errorsBySource.value, [sourceId]: errorMessage(error) };
            statusBySource.value = { ...statusBySource.value, [sourceId]: 'error' };
        }
    };

    return { loadRelatedDataSource, relatedDataFields, relatedDataSources };
};
