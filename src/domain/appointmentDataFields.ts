import type { AppointmentCalculatedWithIncludes } from '../utils/ct-types';

import { mapAppointmentToTemplateProps, type AppointmentMappingOptions } from './mapAppointmentToTemplateProps';
import type {
    PublisherDataFormatType,
    PublisherDataValues,
    PublisherVariableTransform,
} from './publisherVariableExpression';
export {
    createPublisherVariableExpression,
    formatPublisherDataValue,
    parsePublisherVariableExpression,
    PUBLISHER_VARIABLE_EXPRESSION_VERSION,
    resolvePublisherPlaceholders,
} from './publisherVariableExpression';
export type {
    PublisherDataFormatType,
    PublisherDataValue,
    PublisherDataValues,
    PublisherVariableExpression,
    PublisherVariableTransform,
} from './publisherVariableExpression';

export type PublisherDataFieldType = 'text' | 'image';

export interface PublisherDataField {
    id: string;
    label: string;
    type: PublisherDataFieldType;
    value: string;
    multiline?: boolean;
    placeholder: string;
    formatType?: PublisherDataFormatType;
    rawValue?: string;
    locale?: string;
    timeZone?: string;
    values?: string[];
    sourceId?: string;
    sourceLabel?: string;
    editable?: boolean;
}

export const PUBLISHER_DATA_TRANSFER_TYPE = 'application/x-churchtools-publisher-field';
export const PUBLISHER_APPOINTMENT_FIELD_IDS = [
    'title', 'subtitle', 'description', 'date', 'time', 'endTime', 'location', 'link', 'calendar',
    'eventTitle', 'eventInfo', 'groupTitle', 'groupInfo', 'image',
] as const;

export interface PublisherDataTransfer {
    id: string;
    label: string;
    type: PublisherDataFieldType;
    value: string;
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

const field = (
    id: string,
    label: string,
    type: PublisherDataFieldType,
    value: string,
    multiline = false,
    metadata: Pick<PublisherDataField, 'formatType' | 'rawValue' | 'locale' | 'timeZone'> = {},
): PublisherDataField => ({ id, label, type, value, multiline, placeholder: `{{${id}}}`, ...metadata });

const formatEnd = (source: AppointmentCalculatedWithIncludes, options: AppointmentMappingOptions) => {
    if (source.appointment.base.allDay) return '';
    const date = new Date(source.appointment.calculated.endDate);
    try {
        return new Intl.DateTimeFormat(options.locale, { timeStyle: 'short', timeZone: options.timeZone }).format(date);
    } catch {
        return new Intl.DateTimeFormat(options.locale, { timeStyle: 'short' }).format(date);
    }
};

export const createAppointmentDataFields = (
    source: AppointmentCalculatedWithIncludes,
    options: AppointmentMappingOptions,
): PublisherDataField[] => {
    const base = source.appointment.base;
    const mapped = mapAppointmentToTemplateProps(source.appointment, options);
    const candidates = [
        field('title', 'Titel', 'text', mapped.title, true),
        field('subtitle', 'Untertitel', 'text', textValue(base.subtitle), true),
        field('description', 'Beschreibung', 'text', plainText(base.description), true),
        field('date', 'Datum', 'text', mapped.date, false, {
            formatType: 'date', rawValue: source.appointment.calculated.startDate,
            locale: options.locale, timeZone: options.timeZone,
        }),
        field('time', 'Beginn', 'text', mapped.time, false, {
            formatType: 'time', rawValue: source.appointment.calculated.startDate,
            locale: options.locale, timeZone: options.timeZone,
        }),
        field('endTime', 'Ende', 'text', formatEnd(source, options), false, {
            formatType: 'time', rawValue: source.appointment.calculated.endDate,
            locale: options.locale, timeZone: options.timeZone,
        }),
        field('location', 'Ort', 'text', mapped.location, true),
        field('link', 'Link', 'text', textValue(base.link), true, { formatType: 'url' }),
        field('calendar', 'Kalender', 'text', textValue(base.calendar?.nameTranslated)),
        field('eventTitle', 'Event', 'text', textValue(source.event?.title), true),
        field('eventInfo', 'Event-Information', 'text', source.event?.infos?.filter(Boolean).join('\n') ?? '', true),
        field('groupTitle', 'Gruppe', 'text', textValue(source.group?.title), true),
        field('groupInfo', 'Gruppen-Information', 'text', source.group?.infos?.filter(Boolean).join('\n') ?? '', true),
        field('image', 'Terminbild', 'image', mapped.imageUrl ?? ''),
    ];

    return candidates.filter(({ value }) => value !== '');
};

export const publisherDataValue = (dataValues: PublisherDataValues, fieldId: string) => {
    const candidate = dataValues[fieldId];
    return typeof candidate === 'string' ? candidate : candidate?.value ?? '';
};

export interface PublisherPlaceholderOption {
    label: string;
    placeholder: string;
}

export interface PublisherDataFormatterOption {
    label: string;
    transform: PublisherVariableTransform;
}

export const publisherDataFormatterOptions = (field: PublisherDataField): PublisherDataFormatterOption[] => {
    if (field.formatType === 'date') return [
        { label: '01.12.', transform: { name: 'date', arguments: ['DD.MM.'] } },
        { label: '1. Dez', transform: { name: 'date', arguments: ['D. MMM'] } },
        { label: '01.12.26', transform: { name: 'date', arguments: ['DD.MM.YY'] } },
        { label: '01.12.2026', transform: { name: 'date', arguments: ['DD.MM.YYYY'] } },
    ];
    if (field.formatType === 'time') return [
        { label: '10:00', transform: { name: 'time', arguments: ['HH:mm'] } },
        { label: '10.00', transform: { name: 'time', arguments: ['HH.mm'] } },
        { label: '10:00 kurz', transform: { name: 'time', arguments: ['H:mm'] } },
        { label: '10 Uhr', transform: { name: 'time', arguments: ['H Uhr'] } },
    ];
    if (field.formatType === 'list') return [
        { label: 'Kommagetrennt', transform: { name: 'list', arguments: ['comma'] } },
        { label: 'Eine Person pro Zeile', transform: { name: 'list', arguments: ['lines'] } },
        { label: 'Aufzählung', transform: { name: 'list', arguments: ['bullets'] } },
        { label: 'Mit „und“', transform: { name: 'list', arguments: ['and'] } },
        { label: 'Nur erste Person', transform: { name: 'list', arguments: ['first'] } },
    ];
    if (field.formatType === 'number') return [
        { label: '1.234', transform: { name: 'number', arguments: ['integer'] } },
        { label: '1.234,5', transform: { name: 'number', arguments: ['decimal', '0', '1'] } },
        { label: '1.234,50', transform: { name: 'number', arguments: ['decimal', '2', '2'] } },
        { label: '1.234,50 €', transform: { name: 'number', arguments: ['currency', 'EUR', '2', '2'] } },
    ];
    return [];
};

export const publisherPlaceholderOptions = (field: PublisherDataField): PublisherPlaceholderOption[] => {
    const base = [{ label: field.label, placeholder: field.placeholder }];
    return [
        ...base,
        ...publisherDataFormatterOptions(field).map(({ label, transform }) => ({
            label,
            placeholder: `{{${field.id}|${transform.name}:${transform.arguments.join(',')}}}`,
        })),
    ];
};

export const parsePublisherDataTransfer = (value: string): PublisherDataTransfer | null => {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const candidate = parsed as Record<string, unknown>;
        if (typeof candidate.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(candidate.id) ||
            typeof candidate.label !== 'string' || !candidate.label.trim() || candidate.label.length > 100 ||
            (candidate.type !== 'text' && candidate.type !== 'image') ||
            typeof candidate.value !== 'string' || candidate.value.length > 2_000_000) return null;
        return { id: candidate.id, label: candidate.label.trim(), type: candidate.type, value: candidate.value };
    } catch {
        return null;
    }
};
