import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppointmentRelatedData } from './useAppointmentRelatedData';

vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get: vi.fn() } }));

const details = {
    appointment: { calculated: { startDate: '2026-12-01T09:00:00Z' } },
    event: {
        domainIdentifier: 'event:42', domainType: 'event', title: 'Gottesdienst', frontendUrl: '/events/42',
    },
} as unknown as AppointmentCalculatedWithIncludes;

describe('useAppointmentRelatedData', () => {
    beforeEach(() => vi.mocked(churchtoolsClient.get).mockReset());

    it('only loads a linked source after the user requests it', async () => {
        const appointmentDetails = ref<AppointmentCalculatedWithIncludes | undefined>(details);
        const result = useAppointmentRelatedData(appointmentDetails, ref('42:2026-12-01'), 'de-DE', 'Europe/Berlin');

        expect(result.relatedDataSources.value[0]).toMatchObject({ id: 'event', status: 'available' });
        expect(churchtoolsClient.get).not.toHaveBeenCalled();
        vi.mocked(churchtoolsClient.get).mockResolvedValueOnce({
            id: 42,
            name: 'Gottesdienst',
            note: '',
            startDate: '2026-12-01T09:00:00Z',
            endDate: '2026-12-01T10:00:00Z',
            isCanceled: false,
            calendar: { title: 'Gottesdienste' },
            eventServices: [{
                serviceId: 12,
                person: { title: 'Ada Lovelace', domainAttributes: { firstName: 'Ada', lastName: 'Lovelace' } },
            }],
        }).mockResolvedValueOnce({
            services: [{ id: 12, name: 'sermon', nameTranslated: 'Predigt' }],
        });

        await result.loadRelatedDataSource('event');

        expect(churchtoolsClient.get).toHaveBeenCalledWith('/events/42');
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/event/masterdata');
        expect(result.relatedDataSources.value[0]).toMatchObject({ status: 'loaded' });
        expect(result.relatedDataFields.value.find(({ id }) => id === 'eventService-12')?.value).toBe('Ada Lovelace');
    });

    it('drops loaded fields when the selected appointment changes', async () => {
        const appointmentDetails = ref<AppointmentCalculatedWithIncludes | undefined>(details);
        const key = ref('42:2026-12-01');
        const result = useAppointmentRelatedData(appointmentDetails, key, 'de-DE');
        vi.mocked(churchtoolsClient.get).mockResolvedValueOnce({
            id: 42, name: 'Gottesdienst', note: '', startDate: '2026-12-01T09:00:00Z',
            endDate: '2026-12-01T10:00:00Z', isCanceled: false, calendar: { title: 'Gottesdienste' },
        }).mockResolvedValueOnce({ services: [] });
        await result.loadRelatedDataSource('event');
        expect(result.relatedDataFields.value.length).toBeGreaterThan(0);

        key.value = '43:2026-12-08';
        await nextTick();

        expect(result.relatedDataFields.value).toEqual([]);
        expect(result.relatedDataSources.value[0]?.status).toBe('available');
    });

    it('keeps event fields usable and reports a master-data warning', async () => {
        const result = useAppointmentRelatedData(ref(details), ref('42:2026-12-01'), 'de-DE');
        vi.mocked(churchtoolsClient.get)
            .mockResolvedValueOnce({
                id: 42, name: 'Gottesdienst', note: '', startDate: '2026-12-01T09:00:00Z',
                endDate: '2026-12-01T10:00:00Z', isCanceled: false,
                eventServices: [{ serviceId: 12, serviceName: 'Predigt', person: { title: 'Ada Lovelace' } }],
            })
            .mockRejectedValueOnce(new Error('Masterdata unavailable'));

        await result.loadRelatedDataSource('event');

        expect(result.relatedDataSources.value[0]).toMatchObject({
            status: 'loaded',
            warning: expect.stringContaining('Stammdaten'),
        });
        expect(result.relatedDataFields.value.find(({ id }) => id === 'eventService-12')).toMatchObject({
            label: 'Predigt', value: 'Ada Lovelace',
        });
    });
});
