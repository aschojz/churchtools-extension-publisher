import type {
    AppointmentCalculatedWithIncludes,
    DomainObjectEvent,
    DomainObjectGroup,
    Event,
    EventMasterData,
    EventService,
    Group,
} from '@churchtools/api-types';

import type { PublisherDataField } from './appointmentDataFields';
import type { AppointmentMappingOptions } from './mapAppointmentToTemplateProps';

export type PublisherRelatedDataSourceKind = 'event' | 'signupGroup';
export type PublisherRelatedDataSourceStatus = 'available' | 'loading' | 'loaded' | 'error';

export interface PublisherRelatedDataSource {
    id: PublisherRelatedDataSourceKind;
    kind: PublisherRelatedDataSourceKind;
    entityId: number;
    label: string;
    name: string;
    frontendUrl?: string;
    status: PublisherRelatedDataSourceStatus;
    fieldCount: number;
    error?: string;
    warning?: string;
}

interface RelatedFieldMetadata {
    multiline?: boolean;
    formatType?: PublisherDataField['formatType'];
    rawValue?: string;
    values?: string[];
}

const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const plainText = (value: unknown) => textValue(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const relatedField = (
    id: string,
    label: string,
    type: PublisherDataField['type'],
    value: string,
    source: Pick<PublisherRelatedDataSource, 'id' | 'label'>,
    options: AppointmentMappingOptions,
    metadata: RelatedFieldMetadata = {},
): PublisherDataField => ({
    id,
    label,
    type,
    value,
    multiline: metadata.multiline,
    placeholder: `{{${id}}}`,
    formatType: metadata.formatType,
    rawValue: metadata.rawValue,
    values: metadata.values,
    locale: metadata.formatType ? options.locale : undefined,
    timeZone: metadata.formatType ? options.timeZone : undefined,
    sourceId: source.id,
    sourceLabel: source.label,
    editable: false,
});

export const relatedEntityId = (domainIdentifier: string) => {
    const match = domainIdentifier.match(/(?:^|[^0-9])(\d+)$/);
    const id = match ? Number(match[1]) : Number.NaN;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const createAppointmentRelatedDataSources = (
    details: AppointmentCalculatedWithIncludes | undefined,
): PublisherRelatedDataSource[] => {
    if (!details) return [];
    const sources: PublisherRelatedDataSource[] = [];
    const addSource = (
        kind: PublisherRelatedDataSourceKind,
        relation: DomainObjectEvent | DomainObjectGroup | null | undefined,
        label: string,
    ) => {
        if (!relation) return;
        const entityId = relatedEntityId(relation.domainIdentifier);
        if (!entityId) return;
        sources.push({
            id: kind,
            kind,
            entityId,
            label,
            name: relation.title,
            frontendUrl: relation.frontendUrl,
            status: 'available',
            fieldCount: 0,
        });
    };

    addSource('event', details.event, 'Event & Dienste');
    addSource('signupGroup', details.group, 'Anmeldegruppe');
    return sources;
};

const formatDate = (rawValue: string, options: AppointmentMappingOptions, dateOptions: Intl.DateTimeFormatOptions) => {
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return '';
    try {
        return new Intl.DateTimeFormat(options.locale, { ...dateOptions, timeZone: options.timeZone }).format(date);
    } catch {
        return new Intl.DateTimeFormat(options.locale, dateOptions).format(date);
    }
};

const servicePersonName = (service: EventService) => textValue(service.person?.title)
    || [service.person?.domainAttributes.firstName, service.person?.domainAttributes.lastName].filter(Boolean).join(' ').trim();

export const createEventDataFields = (
    event: Event,
    source: PublisherRelatedDataSource,
    options: AppointmentMappingOptions,
    masterData?: EventMasterData,
): PublisherDataField[] => {
    const coreFields = [
        relatedField('eventName', 'Eventname', 'text', textValue(event.name), source, options, { multiline: true }),
        relatedField('eventNote', 'Eventnotiz', 'text', plainText(event.note), source, options, { multiline: true }),
        relatedField('eventDate', 'Eventdatum', 'text', formatDate(event.startDate, options, { dateStyle: 'long' }), source, options, {
            formatType: 'date', rawValue: event.startDate,
        }),
        relatedField('eventStartTime', 'Eventbeginn', 'text', formatDate(event.startDate, options, { timeStyle: 'short' }), source, options, {
            formatType: 'time', rawValue: event.startDate,
        }),
        relatedField('eventEndTime', 'Eventende', 'text', formatDate(event.endDate, options, { timeStyle: 'short' }), source, options, {
            formatType: 'time', rawValue: event.endDate,
        }),
        relatedField('eventCalendar', 'Eventkalender', 'text', textValue(event.calendar?.title), source, options),
        relatedField('eventLink', 'Eventlink', 'text', source.frontendUrl ?? '', source, options, { formatType: 'url' }),
        relatedField('eventCanceled', 'Event abgesagt', 'text', event.isCanceled ? 'Ja' : 'Nein', source, options),
    ];

    const serviceNames = new Map(masterData?.services?.map((service) => [
        service.id,
        textValue(service.nameTranslated) || textValue(service.name),
    ]) ?? []);
    const services = new Map<string, { label: string; entries: EventService[] }>();
    for (const service of event.eventServices ?? []) {
        const fallbackName = service.serviceId ? serviceNames.get(service.serviceId) : '';
        const displayName = fallbackName || textValue(service.serviceName) || textValue(service.name) || 'Dienst';
        const key = service.serviceId ? String(service.serviceId) : displayName.toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!key) continue;
        const current = services.get(key) ?? { label: displayName, entries: [] };
        current.entries.push(service);
        services.set(key, current);
    }

    for (const [serviceKey, serviceGroup] of services) {
        const entries = [...serviceGroup.entries].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
        const names = entries.map(servicePersonName).filter(Boolean);
        const baseId = `eventService-${serviceKey}`.slice(0, 48).replace(/-$/, '');
        coreFields.push(relatedField(baseId, serviceGroup.label, 'text', names.join(', '), source, options, {
            multiline: names.length > 1,
            formatType: 'list',
            values: names,
        }));
    }

    return coreFields.filter(({ id, sourceId, value }) => sourceId === 'event' && (
        value !== '' || id === 'eventCanceled' || id.startsWith('eventService-')
    ));
};

const addressText = (place: NonNullable<Group['places']>[number]) => [
    place.name,
    [place.street, place.addition].filter(Boolean).join(' '),
    [place.zip, place.city].filter(Boolean).join(' '),
].filter(Boolean).join(', ');

export const createSignupGroupDataFields = (
    group: Group,
    source: PublisherRelatedDataSource,
    options: AppointmentMappingOptions,
): PublisherDataField[] => {
    const statistics = group.memberStatistics;
    const maximum = group.settings.maxMembers ?? group.information.maxMembers;
    const available = maximum === null || maximum === undefined || !statistics
        ? ''
        : String(Math.max(0, maximum - statistics.seatsTaken));
    const places = group.places?.map(addressText).filter(Boolean).join('\n') ?? '';
    const candidates = [
        relatedField('signupGroupName', 'Name der Anmeldegruppe', 'text', textValue(group.name), source, options, { multiline: true }),
        relatedField('signupGroupNote', 'Beschreibung der Anmeldegruppe', 'text', plainText(group.information.note), source, options, { multiline: true }),
        relatedField('signupGroupMeetingTime', 'Treffzeit', 'text', textValue(group.information.meetingTime), source, options),
        relatedField('signupGroupWebsite', 'Website der Anmeldegruppe', 'text', textValue(group.information.groupHomepageUrl), source, options, { formatType: 'url' }),
        relatedField('signupGroupLink', 'Link zur Anmeldegruppe', 'text', source.frontendUrl ?? '', source, options, { formatType: 'url' }),
        relatedField('signupGroupImage', 'Bild der Anmeldegruppe', 'image', textValue(group.information.imageUrl), source, options),
        relatedField('signupGroupPlaces', 'Orte der Anmeldegruppe', 'text', places, source, options, { multiline: true }),
        relatedField('signupGroupParticipants', 'Teilnehmende', 'text', statistics ? String(statistics.participants) : '', source, options),
        relatedField('signupGroupLeaders', 'Leitende', 'text', statistics ? String(statistics.leaders) : '', source, options),
        relatedField('signupGroupRequests', 'Offene Anfragen', 'text', statistics ? String(statistics.requested) : '', source, options),
        relatedField('signupGroupWaiting', 'Warteliste', 'text', statistics ? String(statistics.waiting) : '', source, options),
        relatedField('signupGroupCapacity', 'Maximale Plätze', 'text', maximum === null || maximum === undefined ? '' : String(maximum), source, options),
        relatedField('signupGroupAvailableSeats', 'Freie Plätze', 'text', available, source, options),
    ];
    return candidates.filter(({ value }) => value !== '');
};
