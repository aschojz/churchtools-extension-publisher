import { describe, expect, it } from 'vitest';

import { mapAppointmentToTemplateProps, type AppointmentTemplateSource } from './mapAppointmentToTemplateProps';

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

    it('maps the image URL when an appointment image exists', () => {
        const result = mapAppointmentToTemplateProps(
            makeAppointment({ image: { imageUrl: 'https://example.test/event.jpg' } }),
            { locale: 'en-US', timeZone: 'UTC' },
        );

        expect(result.imageUrl).toBe('https://example.test/event.jpg');
    });
});
