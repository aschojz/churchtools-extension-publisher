import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';

import { mapAppointmentToTemplateProps, type AppointmentMappingOptions } from './mapAppointmentToTemplateProps';

export type PublisherDataFieldType = 'text' | 'image';
export type PublisherDataFormatType = 'date' | 'time' | 'url';

export interface PublisherDataValue {
    value: string;
    formatType?: PublisherDataFormatType;
    rawValue?: string;
    locale?: string;
    timeZone?: string;
}

export type PublisherDataValues = Record<string, string | PublisherDataValue>;

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

const dateParts = (data: PublisherDataValue) => {
    const date = new Date(data.rawValue ?? data.value);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = (options: Intl.DateTimeFormatOptions) => {
        try {
            return new Intl.DateTimeFormat(data.locale ?? 'de-DE', { ...options, timeZone: data.timeZone }).formatToParts(date);
        } catch {
            return new Intl.DateTimeFormat(data.locale ?? 'de-DE', options).formatToParts(date);
        }
    };
    const parts = formatter({ day: '2-digit', month: '2-digit', year: 'numeric' });
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    const shortMonth = formatter({ month: 'short' }).find((part) => part.type === 'month')?.value.replace(/\.$/, '') ?? '';
    return { day: get('day'), month: get('month'), year: get('year'), shortMonth };
};

const timeParts = (data: PublisherDataValue) => {
    const date = new Date(data.rawValue ?? data.value);
    if (Number.isNaN(date.getTime())) return null;
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat(data.locale ?? 'de-DE', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: data.timeZone,
        }).formatToParts(date);
    } catch {
        parts = new Intl.DateTimeFormat(data.locale ?? 'de-DE', {
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(date);
    }
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return { hour: get('hour').padStart(2, '0'), minute: get('minute').padStart(2, '0') };
};

export const formatPublisherDataValue = (data: PublisherDataValue, formatter: string, pattern: string) => {
    if (formatter === 'date' && data.formatType === 'date') {
        const parts = dateParts(data);
        if (!parts) return data.value;
        const day = String(Number(parts.day));
        return ({
            'DD.MM.': `${parts.day}.${parts.month}.`,
            'D. MMM': `${day}. ${parts.shortMonth}`,
            'DD.MM.YY': `${parts.day}.${parts.month}.${parts.year.slice(-2)}`,
            'DD.MM.YYYY': `${parts.day}.${parts.month}.${parts.year}`,
        } as Record<string, string>)[pattern] ?? data.value;
    }
    if (formatter === 'time' && data.formatType === 'time') {
        const parts = timeParts(data);
        if (!parts) return data.value;
        const hour = String(Number(parts.hour));
        return ({
            'HH:mm': `${parts.hour}:${parts.minute}`,
            'HH.mm': `${parts.hour}.${parts.minute}`,
            'H:mm': `${hour}:${parts.minute}`,
            'H Uhr': `${hour} Uhr`,
        } as Record<string, string>)[pattern] ?? data.value;
    }
    return data.value;
};

export const resolvePublisherPlaceholders = (value: string, dataValues: PublisherDataValues) =>
    value.replace(
        /\{\{([a-zA-Z][a-zA-Z0-9_-]{0,63})(?:\|([a-z]+):([^{}|]+))?\}\}/g,
        (placeholder, fieldId: string, formatter?: string, pattern?: string) => {
            if (!Object.hasOwn(dataValues, fieldId)) return placeholder;
            const candidate = dataValues[fieldId];
            const data = typeof candidate === 'string' ? { value: candidate } : candidate;
            return formatter && pattern ? formatPublisherDataValue(data, formatter, pattern) : data.value;
        },
    );

export interface PublisherPlaceholderOption {
    label: string;
    placeholder: string;
}

export const publisherPlaceholderOptions = (field: PublisherDataField): PublisherPlaceholderOption[] => {
    const base = [{ label: field.label, placeholder: field.placeholder }];
    if (field.formatType === 'date') return [
        ...base,
        { label: '01.12.', placeholder: `{{${field.id}|date:DD.MM.}}` },
        { label: '1. Dez', placeholder: `{{${field.id}|date:D. MMM}}` },
        { label: '01.12.26', placeholder: `{{${field.id}|date:DD.MM.YY}}` },
        { label: '01.12.2026', placeholder: `{{${field.id}|date:DD.MM.YYYY}}` },
    ];
    if (field.formatType === 'time') return [
        ...base,
        { label: '10:00', placeholder: `{{${field.id}|time:HH:mm}}` },
        { label: '10.00', placeholder: `{{${field.id}|time:HH.mm}}` },
        { label: '10:00 kurz', placeholder: `{{${field.id}|time:H:mm}}` },
        { label: '10 Uhr', placeholder: `{{${field.id}|time:H Uhr}}` },
    ];
    return base;
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
