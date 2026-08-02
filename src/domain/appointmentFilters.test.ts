import { describe, expect, it } from 'vitest';

import { isAppointmentWithinDays, matchesAppointmentFilters } from './appointmentFilters';

const appointment = {
    title: 'Frühstück für Familien',
    calendarId: '42',
    calendarName: 'Kirche Zentrale',
};

describe('appointment filters', () => {
    it('matches every normalized search term across title and calendar', () => {
        expect(matchesAppointmentFilters(appointment, 'fruhstuck zentrale', '')).toBe(true);
        expect(matchesAppointmentFilters(appointment, 'familien kirche', '')).toBe(true);
        expect(matchesAppointmentFilters(appointment, 'jugend', '')).toBe(false);
    });

    it('filters by calendar independently of the search query', () => {
        expect(matchesAppointmentFilters(appointment, '', '42')).toBe(true);
        expect(matchesAppointmentFilters(appointment, 'familien', '7')).toBe(false);
    });

    it('treats blank search and calendar values as no filter', () => {
        expect(matchesAppointmentFilters(appointment, '   ', '')).toBe(true);
    });

    it('limits appointments to the selected number of future days', () => {
        const referenceDate = new Date(2026, 7, 2, 10);

        expect(isAppointmentWithinDays(new Date(2026, 8, 1, 10).toISOString(), 30, referenceDate)).toBe(true);
        expect(isAppointmentWithinDays(new Date(2026, 8, 1, 10, 0, 0, 1).toISOString(), 30, referenceDate)).toBe(false);
        expect(isAppointmentWithinDays('2027-01-01T00:00:00.000Z', null, referenceDate)).toBe(true);
    });

    it('excludes past appointments but includes the start of the local reference day', () => {
        const referenceDate = new Date(2026, 7, 2, 10);

        expect(isAppointmentWithinDays(new Date(2026, 7, 2, 0).toISOString(), 30, referenceDate)).toBe(true);
        expect(isAppointmentWithinDays(new Date(2026, 7, 1, 23, 59).toISOString(), 30, referenceDate)).toBe(false);
        expect(isAppointmentWithinDays(new Date(2026, 7, 1, 23, 59).toISOString(), null, referenceDate)).toBe(false);
    });

    it('rejects invalid dates and negative ranges', () => {
        const referenceDate = new Date('2026-08-02T10:00:00.000Z');

        expect(isAppointmentWithinDays('invalid', 30, referenceDate)).toBe(false);
        expect(isAppointmentWithinDays('2026-08-03T10:00:00.000Z', -1, referenceDate)).toBe(false);
    });
});
