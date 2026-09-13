import { describe, expect, it } from 'vitest';

import {
    createAppointmentDataFields,
    parsePublisherDataTransfer,
    resolvePublisherPlaceholders,
} from './appointmentDataFields';
import type { AppointmentCalculatedWithIncludes } from '../utils/ct-types';

const appointment = {
    appointment: {
        base: {
            title: 'Sommerfest', subtitle: 'Im Garten', description: '<p>Für alle &amp; Freunde</p>',
            allDay: false, link: 'https://example.test', address: null,
            image: { imageUrl: 'https://example.test/image.jpg' },
            calendar: { nameTranslated: 'Gemeinde' },
        },
        calculated: { startDate: '2026-08-15T17:30:00Z', endDate: '2026-08-15T19:30:00Z' },
    },
} as unknown as AppointmentCalculatedWithIncludes;

describe('appointment data fields', () => {
    it('only exposes fields actually supplied by the appointment and infers image fields', () => {
        const fields = createAppointmentDataFields(appointment, { locale: 'de-DE', timeZone: 'Europe/Berlin' });

        expect(fields.find(({ id }) => id === 'subtitle')?.value).toBe('Im Garten');
        expect(fields.find(({ id }) => id === 'description')?.value).toBe('Für alle & Freunde');
        expect(fields.find(({ id }) => id === 'image')).toMatchObject({ type: 'image', placeholder: '{{image}}' });
        expect(fields.some(({ id }) => id === 'location')).toBe(false);
    });

    it('resolves known placeholders and preserves unknown placeholders', () => {
        expect(resolvePublisherPlaceholders('{{title}} – {{missing}}', { title: 'Sommerfest' }))
            .toBe('Sommerfest – {{missing}}');
    });

    it('formats date and time placeholders without changing their source values', () => {
        const values = {
            date: {
                value: '15. August 2026', formatType: 'date' as const,
                rawValue: '2026-08-15T17:30:00Z', locale: 'de-DE', timeZone: 'Europe/Berlin',
            },
            time: {
                value: '19:30', formatType: 'time' as const,
                rawValue: '2026-08-15T17:30:00Z', locale: 'de-DE', timeZone: 'Europe/Berlin',
            },
        };

        expect(resolvePublisherPlaceholders(
            '{{date|date:DD.MM.}} · {{date|date:D. MMM}} · {{date|date:DD.MM.YY}} · {{date|date:DD.MM.YYYY}}',
            values,
        )).toBe('15.08. · 15. Aug · 15.08.26 · 15.08.2026');
        expect(resolvePublisherPlaceholders(
            '{{time|time:HH:mm}} · {{time|time:HH.mm}} · {{time|time:H Uhr}}',
            values,
        )).toBe('19:30 · 19.30 · 19 Uhr');
        expect(values.date.value).toBe('15. August 2026');
    });

    it('renders list variables with safe predefined repeat formats', () => {
        const values = {
            sermon: {
                value: 'Ada Lovelace, Grace Hopper',
                values: ['Ada Lovelace', 'Grace Hopper'],
                formatType: 'list' as const,
                locale: 'de-DE',
            },
        };

        expect(resolvePublisherPlaceholders('{{sermon|list:lines}}', values)).toBe('Ada Lovelace\nGrace Hopper');
        expect(resolvePublisherPlaceholders('{{sermon|list:bullets}}', values)).toBe('• Ada Lovelace\n• Grace Hopper');
        expect(resolvePublisherPlaceholders('{{sermon|list:and}}', values)).toBe('Ada Lovelace und Grace Hopper');
        expect(resolvePublisherPlaceholders('{{sermon|list:first}}', values)).toBe('Ada Lovelace');
    });

    it('validates transferred field data', () => {
        expect(parsePublisherDataTransfer(JSON.stringify({ id: 'title', label: 'Titel', type: 'text', value: 'Fest' })))
            .toEqual({ id: 'title', label: 'Titel', type: 'text', value: 'Fest' });
        expect(parsePublisherDataTransfer('{"id":"../bad"}')).toBeNull();
    });
});
