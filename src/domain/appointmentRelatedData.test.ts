import type { AppointmentCalculatedWithIncludes, Event, Group } from '@churchtools/api-types';
import { describe, expect, it } from 'vitest';

import {
    createAppointmentRelatedDataSources,
    createEventDataFields,
    createSignupGroupDataFields,
    relatedEntityId,
    type PublisherRelatedDataSource,
} from './appointmentRelatedData';

const options = { locale: 'de-DE', timeZone: 'Europe/Berlin' };

const eventSource: PublisherRelatedDataSource = {
    id: 'event', kind: 'event', entityId: 42, label: 'Event & Dienste', name: 'Gottesdienst',
    frontendUrl: '/events/42', status: 'available', fieldCount: 0,
};

describe('appointment related data', () => {
    it('discovers linked events and signup groups without loading their details', () => {
        const details = {
            event: { domainIdentifier: 'event:42', domainType: 'event', title: 'Gottesdienst', frontendUrl: '/events/42' },
            group: { domainIdentifier: '17', domainType: 'group', title: 'Anmeldung', frontendUrl: '/groups/17' },
        } as AppointmentCalculatedWithIncludes;

        expect(createAppointmentRelatedDataSources(details)).toEqual([
            expect.objectContaining({ id: 'event', entityId: 42, name: 'Gottesdienst', status: 'available' }),
            expect.objectContaining({ id: 'signupGroup', entityId: 17, name: 'Anmeldung', status: 'available' }),
        ]);
        expect(relatedEntityId('group:17')).toBe(17);
        expect(relatedEntityId('not-an-id')).toBeNull();
    });

    it('creates stable service variables and aggregates multiple assignments', () => {
        const event = {
            id: 42,
            name: 'Gottesdienst',
            note: '<p>Herzlich willkommen</p>',
            startDate: '2026-12-01T09:00:00Z',
            endDate: '2026-12-01T10:30:00Z',
            isCanceled: false,
            calendar: { title: 'Gottesdienste' },
            eventServices: [
                {
                    serviceId: 12, index: 0, isAccepted: true,
                    person: { title: 'Ada Lovelace', domainAttributes: { firstName: 'Ada', lastName: 'Lovelace' } },
                },
                {
                    serviceId: 12, index: 1, isAccepted: false,
                    person: { title: 'Grace Hopper', domainAttributes: { firstName: 'Grace', lastName: 'Hopper' } },
                },
            ],
        } as unknown as Event;

        const fields = createEventDataFields(event, eventSource, options, {
            services: [{ id: 12, name: 'sermon', nameTranslated: 'Predigt' }],
        } as never);

        expect(fields.find(({ id }) => id === 'eventService-12')).toMatchObject({
            label: 'Predigt', value: 'Ada Lovelace, Grace Hopper', placeholder: '{{eventService-12}}',
            formatType: 'list', values: ['Ada Lovelace', 'Grace Hopper'], multiline: true,
        });
        expect(fields.some(({ id }) => id.startsWith('eventService-12-1'))).toBe(false);
        expect(fields.filter(({ id }) => id.startsWith('eventService-'))).toHaveLength(1);
        expect(fields.every(({ editable, sourceId }) => editable === false && sourceId === 'event')).toBe(true);
    });

    it('turns signup metadata and statistics into reusable variables', () => {
        const groupSource: PublisherRelatedDataSource = {
            id: 'signupGroup', kind: 'signupGroup', entityId: 17, label: 'Anmeldegruppe', name: 'Anmeldung',
            frontendUrl: '/groups/17', status: 'available', fieldCount: 0,
        };
        const group = {
            id: 17,
            name: 'Anmeldung Familienfreizeit',
            information: { note: 'Jetzt anmelden', meetingTime: 'Freitag, 18 Uhr', groupHomepageUrl: null, imageUrl: null, maxMembers: 30 },
            settings: { maxMembers: 30 },
            memberStatistics: { participants: 20, leaders: 2, requested: 3, waiting: 1, seatsTaken: 25 },
            places: [{ name: 'Gemeindehaus', street: 'Kirchweg 1', addition: null, zip: '12345', city: 'Berlin' }],
        } as Group;

        const fields = createSignupGroupDataFields(group, groupSource, options);

        expect(fields.find(({ id }) => id === 'signupGroupAvailableSeats')?.value).toBe('5');
        expect(fields.find(({ id }) => id === 'signupGroupPlaces')?.value).toBe('Gemeindehaus, Kirchweg 1, 12345 Berlin');
        expect(fields.find(({ id }) => id === 'signupGroupParticipants')?.placeholder).toBe('{{signupGroupParticipants}}');
    });
});
