import { describe, expect, it } from 'vitest';

import { matchesAppointmentFilters } from './appointmentFilters';

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
});
