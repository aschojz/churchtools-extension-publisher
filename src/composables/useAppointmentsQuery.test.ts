import { churchtoolsClient } from '@churchtools/churchtools-client';
import { useQuery } from '@tanstack/vue-query';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppointmentQuery, useCalendarsQuery } from './useAppointmentsQuery';

vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get: vi.fn() } }));
vi.mock('@tanstack/vue-query', () => ({ useQuery: vi.fn((options) => options) }));

describe('appointment queries', () => {
    beforeEach(() => {
        vi.mocked(churchtoolsClient.get).mockReset();
        vi.mocked(useQuery).mockClear();
    });

    it('loads calendars through the configured application client', async () => {
        vi.mocked(churchtoolsClient.get).mockResolvedValueOnce([]);
        useCalendarsQuery();
        const options = vi.mocked(useQuery).mock.calls[0][0] as unknown as { queryFn: () => Promise<unknown> };

        await options.queryFn();

        expect(churchtoolsClient.get).toHaveBeenCalledWith('/calendars');
    });

    it('loads appointment details through the same client using reactive identifiers', async () => {
        vi.mocked(churchtoolsClient.get).mockResolvedValueOnce({});
        const appointmentId = ref<number>();
        const startDate = ref<string>();
        useAppointmentQuery(appointmentId, startDate);
        const options = vi.mocked(useQuery).mock.calls[0][0] as unknown as {
            enabled: () => boolean;
            queryFn: () => Promise<unknown> | null;
        };

        expect(options.enabled()).toBe(false);
        appointmentId.value = 42;
        startDate.value = '2026-12-01';
        expect(options.enabled()).toBe(true);
        await options.queryFn();

        expect(churchtoolsClient.get).toHaveBeenCalledWith('/calendars/appointments/42/2026-12-01');
    });
});
