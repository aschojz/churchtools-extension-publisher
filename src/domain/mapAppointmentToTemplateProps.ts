import type { AppointmentBase, AppointmentCalculatedWithIncludes } from '../utils/ct-types';

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

export interface PublisherImageRequest {
    width: number;
    height: number;
    focusZoom?: number;
    pixelRatio?: number;
    quality?: number;
}

const normalizeImageDimension = (value: number) => Math.min(8192, Math.max(1, Math.ceil(value)));

export const createPublisherImageUrl = (imageUrl: string, request: PublisherImageRequest) => {
    if (/^(?:blob:|data:)/i.test(imageUrl)) return imageUrl;
    const hashIndex = imageUrl.indexOf('#');
    const hash = hashIndex >= 0 ? imageUrl.slice(hashIndex) : '';
    const urlWithoutHash = hashIndex >= 0 ? imageUrl.slice(0, hashIndex) : imageUrl;
    const queryIndex = urlWithoutHash.indexOf('?');
    const baseUrl = queryIndex >= 0 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
    const searchParams = new URLSearchParams(queryIndex >= 0 ? urlWithoutHash.slice(queryIndex + 1) : '');
    const density = Math.max(1, Number.isFinite(request.pixelRatio) ? request.pixelRatio ?? 1 : 1);
    const focusScale = Math.max(1, Number.isFinite(request.focusZoom) ? (request.focusZoom ?? 100) / 100 : 1);
    const width = normalizeImageDimension(request.width * density * focusScale);
    const height = normalizeImageDimension(request.height * density * focusScale);
    const quality = Math.min(100, Math.max(1, Math.round(request.quality ?? 100)));

    searchParams.set('w', String(width));
    searchParams.set('h', String(height));
    searchParams.set('q', String(quality));

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
        imageUrl: appointment.base.image?.imageUrl ?? null,
    };
};
