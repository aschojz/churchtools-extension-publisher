import { describe, expect, it } from 'vitest';

import {
    createPublisherImageUrl,
    mapAppointmentToTemplateProps,
    type AppointmentTemplateSource,
} from './mapAppointmentToTemplateProps';

const makeAppointment = (
    overrides: Partial<AppointmentTemplateSource['base']> = {},
): AppointmentTemplateSource => ({
    base: {
        address: null,
        allDay: false,
        image: null,
        title: 'Sommerfest',
        ...overrides,
    },
    calculated: {
        startDate: '2026-08-15T17:30:00Z',
        endDate: '2026-08-15T19:30:00Z',
        iCalUid: 'appointment-1@example.test',
    },
});

describe('mapAppointmentToTemplateProps', () => {
    it('maps and localizes the display values independently from the API model', () => {
        const result = mapAppointmentToTemplateProps(makeAppointment(), { locale: 'de-DE', timeZone: 'Europe/Berlin' });

        expect(result).toEqual({
            title: 'Sommerfest',
            date: '15. August 2026',
            time: '19:30',
            location: '',
            imageUrl: null,
        });
    });

    it('omits the time for all-day appointments', () => {
        const result = mapAppointmentToTemplateProps(makeAppointment({ allDay: true }), {
            locale: 'de-DE',
            timeZone: 'Europe/Berlin',
        });

        expect(result.time).toBe('');
    });

    it('combines available address fields and omits duplicate values', () => {
        const result = mapAppointmentToTemplateProps(
            makeAppointment({
                address: {
                    name: 'Gemeindehaus',
                    meetingAt: 'Alter Name',
                    addition: null,
                    street: 'Kirchweg 1',
                    zip: '12345',
                    city: 'Musterstadt',
                    country: 'DE',
                },
            }),
            { locale: 'de-DE', timeZone: 'Europe/Berlin' },
        );

        expect(result.location).toBe('Gemeindehaus, Kirchweg 1, 12345 Musterstadt, DE');
    });

    it('keeps the original appointment image reference independent from the canvas target', () => {
        const result = mapAppointmentToTemplateProps(
            makeAppointment({ image: { imageUrl: 'https://example.test/event.jpg' } }),
            { locale: 'en-US', timeZone: 'UTC' },
        );

        expect(result.imageUrl).toBe('https://example.test/event.jpg');
    });

    it('requests the actual render size and replaces transformations without dropping other parameters', () => {
        expect(createPublisherImageUrl('/images/event.jpg?token=abc&w=200&q=60#preview', {
            width: 600,
            height: 400,
            quality: 92,
        })).toBe(
            '/images/event.jpg?token=abc&w=600&q=92&h=400#preview',
        );
    });

    it('accounts for focus zoom and display density while respecting the image service limit', () => {
        expect(createPublisherImageUrl('/images/event.jpg', {
            width: 1200,
            height: 800,
            focusZoom: 150,
            pixelRatio: 2,
        })).toBe('/images/event.jpg?w=3600&h=2400&q=100');
        expect(createPublisherImageUrl('/images/event.jpg', {
            width: 8000,
            height: 6000,
            focusZoom: 300,
            pixelRatio: 2,
        })).toBe('/images/event.jpg?w=8192&h=8192&q=100');
    });

    it('does not append transformations to local browser image sources', () => {
        const source = 'data:image/png;base64,abc';
        expect(createPublisherImageUrl(source, { width: 100, height: 100 })).toBe(source);
        expect(createPublisherImageUrl('blob:https://example.test/id', { width: 100, height: 100 })).toBe(
            'blob:https://example.test/id',
        );
    });
});
