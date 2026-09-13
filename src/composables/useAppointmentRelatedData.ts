import type {
    AppointmentCalculatedWithIncludes,
    Event,
    EventMasterData,
    GetEventMasterdataResponse,
    GetEventsIdResponse,
    GetGroupsResponse,
    Group,
} from '../utils/ct-types';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { getParams, GROUP_STATUS_ID } from '../utils/churchtoolsApi';
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';

import type { PublisherDataField } from '../domain/appointmentDataFields';
import {
    createAppointmentRelatedDataSources,
    createEventDataFields,
    createSignupGroupDataFields,
    type PublisherRelatedDataSource,
    type PublisherRelatedDataSourceKind,
} from '../domain/appointmentRelatedData';

const errorMessage = (error: unknown) => error instanceof Error && error.message
    ? error.message
    : 'Die verknüpften Daten konnten nicht geladen werden.';

interface EventMasterDataLoadResult {
    data?: EventMasterData;
    warning?: string;
}

interface RelatedDataLoadResult {
    fields: PublisherDataField[];
    warning?: string;
}

export const useAppointmentRelatedData = (
    details: MaybeRefOrGetter<AppointmentCalculatedWithIncludes | null | undefined>,
    selectedAppointmentKey: MaybeRefOrGetter<string>,
    locale: string,
    timeZone?: string,
) => {
    const fieldsBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, PublisherDataField[]>>>({});
    const statusBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, PublisherRelatedDataSource['status']>>>({});
    const errorsBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, string>>>({});
    const warningsBySource = ref<Partial<Record<PublisherRelatedDataSourceKind, string>>>({});
    const eventMasterData = ref<EventMasterData>();
    let eventMasterDataRequest: Promise<EventMasterDataLoadResult> | undefined;
    const sourceDefinitions = computed(() => createAppointmentRelatedDataSources(toValue(details) ?? undefined));
    const sourceSignature = computed(() => `${toValue(selectedAppointmentKey)}:${sourceDefinitions.value
        .map(({ id, entityId }) => `${id}-${entityId}`).join(':')}`);

    watch(sourceSignature, () => {
        fieldsBySource.value = {};
        statusBySource.value = {};
        errorsBySource.value = {};
        warningsBySource.value = {};
    });

    const relatedDataSources = computed(() => sourceDefinitions.value.map((source) => ({
        ...source,
        status: statusBySource.value[source.id] ?? 'available',
        fieldCount: fieldsBySource.value[source.id]?.length ?? 0,
        error: errorsBySource.value[source.id],
        warning: warningsBySource.value[source.id],
    })));
    const relatedDataFields = computed(() => sourceDefinitions.value.flatMap(
        ({ id }) => fieldsBySource.value[id] ?? [],
    ));

    const loadEventMasterData = (): Promise<EventMasterDataLoadResult> => {
        if (eventMasterData.value) return Promise.resolve({ data: eventMasterData.value });
        eventMasterDataRequest ??= churchtoolsClient.get<GetEventMasterdataResponse['data']>('/event/masterdata')
            .then((data) => {
                eventMasterData.value = data;
                return { data };
            })
            .catch(() => ({
                warning: 'Die Dienst-Stammdaten konnten nicht geladen werden. Dienstnamen werden soweit möglich aus dem Event übernommen.',
            }))
            .finally(() => { eventMasterDataRequest = undefined; });
        return eventMasterDataRequest;
    };

    const loadEvent = async (source: PublisherRelatedDataSource): Promise<RelatedDataLoadResult> => {
        if (!toValue(details)) throw new Error('Der Termin ist nicht mehr verfügbar.');
        const [event, masterData] = await Promise.all([
            churchtoolsClient.get<GetEventsIdResponse['data']>(`/events/${source.entityId}`),
            loadEventMasterData(),
        ]);
        if (!event) throw new Error('Das verknüpfte Event ist nicht verfügbar oder darf nicht angezeigt werden.');
        return {
            fields: createEventDataFields(event as Event, source, { locale, timeZone }, masterData.data),
            warning: masterData.warning,
        };
    };

    const loadSignupGroup = async (source: PublisherRelatedDataSource): Promise<RelatedDataLoadResult> => {
        const groups = await churchtoolsClient.get<GetGroupsResponse['data']>(`/groups${getParams({
            ids: [source.entityId],
            include: ['memberStatistics', 'places', 'signupConditions'],
            group_status_ids: Object.values(GROUP_STATUS_ID),
            limit: 1,
        })}`);
        const group = groups.find(({ id }) => id === source.entityId);
        if (!group) throw new Error('Die verknüpfte Anmeldegruppe ist nicht verfügbar oder darf nicht angezeigt werden.');
        return { fields: createSignupGroupDataFields(group as Group, source, { locale, timeZone }) };
    };

    const loadRelatedDataSource = async (sourceId: PublisherRelatedDataSourceKind) => {
        const source = relatedDataSources.value.find(({ id }) => id === sourceId);
        if (!source || source.status === 'loading') return;
        const signature = sourceSignature.value;
        statusBySource.value = { ...statusBySource.value, [sourceId]: 'loading' };
        errorsBySource.value = { ...errorsBySource.value, [sourceId]: undefined };
        warningsBySource.value = { ...warningsBySource.value, [sourceId]: undefined };
        try {
            const result = source.kind === 'event' ? await loadEvent(source) : await loadSignupGroup(source);
            if (signature !== sourceSignature.value) return;
            fieldsBySource.value = { ...fieldsBySource.value, [sourceId]: result.fields };
            warningsBySource.value = { ...warningsBySource.value, [sourceId]: result.warning };
            statusBySource.value = { ...statusBySource.value, [sourceId]: 'loaded' };
        } catch (error) {
            if (signature !== sourceSignature.value) return;
            errorsBySource.value = { ...errorsBySource.value, [sourceId]: errorMessage(error) };
            statusBySource.value = { ...statusBySource.value, [sourceId]: 'error' };
        }
    };

    return { loadRelatedDataSource, relatedDataFields, relatedDataSources };
};
