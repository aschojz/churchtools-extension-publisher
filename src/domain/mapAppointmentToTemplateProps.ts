import type { AppointmentBase, AppointmentCalculatedWithIncludes } from '@churchtools/api-types';

import type { EventTemplateProps } from './EventTemplateProps';

type TemplateAddress = Pick<
    NonNullable<AppointmentBase['address']>,
    'addition' | 'city' | 'country' | 'meetingAt' | 'name' | 'street' | 'zip'
>;
type TemplateImage = Pick<NonNullable<AppointmentBase['image']>, 'imageUrl'>;
type TemplateAppointmentBase = Pick<AppointmentBase, 'allDay' | 'title'> & {
    address: TemplateAddress | null;
    image: TemplateImage | null;
};

export type AppointmentTemplateSource = Pick<AppointmentCalculatedWithIncludes['appointment'], 'calculated'> & {
    base: TemplateAppointmentBase;
};

export interface AppointmentMappingOptions {
    locale: string;
    timeZone?: string;
}

const PUBLISHER_IMAGE_WIDTH = 1920;
const PUBLISHER_IMAGE_HEIGHT = 1080;
const PUBLISHER_IMAGE_QUALITY = 100;

export const createPublisherImageUrl = (imageUrl: string) => {
    const hashIndex = imageUrl.indexOf('#');
    const hash = hashIndex >= 0 ? imageUrl.slice(hashIndex) : '';
    const urlWithoutHash = hashIndex >= 0 ? imageUrl.slice(0, hashIndex) : imageUrl;
    const queryIndex = urlWithoutHash.indexOf('?');
    const baseUrl = queryIndex >= 0 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
    const searchParams = new URLSearchParams(queryIndex >= 0 ? urlWithoutHash.slice(queryIndex + 1) : '');

    searchParams.set('w', String(PUBLISHER_IMAGE_WIDTH));
    searchParams.set('h', String(PUBLISHER_IMAGE_HEIGHT));
    searchParams.set('q', String(PUBLISHER_IMAGE_QUALITY));

    return `${baseUrl}?${searchParams.toString()}${hash}`;
};

const formatWithOptionalTimeZone = (
    date: Date,
    locale: string,
    options: Intl.DateTimeFormatOptions,
    timeZone?: string,
) => {
    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
    } catch {
        return new Intl.DateTimeFormat(locale, options).format(date);
    }
};

const formatLocation = (address: TemplateAddress | null) => {
    if (!address) {
        return '';
    }

    const name = address.name ?? address.meetingAt;
    const city = [address.zip, address.city].filter(Boolean).join(' ');
    const parts = [name, address.addition, address.street, city, address.country].filter(
        (part): part is string => Boolean(part?.trim()),
    );

    return [...new Set(parts)].join(', ');
};

export const mapAppointmentToTemplateProps = (
    appointment: AppointmentTemplateSource,
    { locale, timeZone }: AppointmentMappingOptions,
): EventTemplateProps => {
    const startDate = new Date(appointment.calculated.startDate);

    return {
        title: appointment.base.title.trim() || 'Event',
        date: formatWithOptionalTimeZone(startDate, locale, { dateStyle: 'long' }, timeZone),
        time: appointment.base.allDay
            ? ''
            : formatWithOptionalTimeZone(startDate, locale, { timeStyle: 'short' }, timeZone),
        location: formatLocation(appointment.base.address),
        imageUrl: appointment.base.image ? createPublisherImageUrl(appointment.base.image.imageUrl) : null,
    };
};
