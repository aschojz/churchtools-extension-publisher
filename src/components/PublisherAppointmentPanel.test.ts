// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PublisherAppointmentPanel from './PublisherAppointmentPanel.vue';

const panelProps = {
    appointments: [{ key: '1:start', label: 'Sommerfest — 12.08.2026' }],
    calendars: [{ id: '4', label: 'Gemeinde' }],
    hasError: false,
    hasFilters: false,
    isLoading: false,
    totalCount: 1,
    search: '',
    selectedCalendar: '',
    selectedRange: '',
    onlyDrafts: false,
    selectedAppointmentKey: '',
};

describe('PublisherAppointmentPanel', () => {
    it('renders compact appointment filters and options', () => {
        const wrapper = mount(PublisherAppointmentPanel, { props: panelProps });

        expect(wrapper.get('h2').text()).toBe('Termine');
        expect(wrapper.get('option[value="1:start"]').text()).toContain('Sommerfest');
        expect(wrapper.get('option[value="4"]').text()).toBe('Gemeinde');
        expect(wrapper.text()).toContain('1 von 1 Terminen');
    });

    it('emits model changes and filter reset actions', async () => {
        const wrapper = mount(PublisherAppointmentPanel, {
            props: { ...panelProps, hasFilters: true },
        });

        await wrapper.get('input[type="search"]').setValue('Jugend');
        await wrapper.get('button').trigger('click');

        expect(wrapper.emitted('update:search')).toEqual([['Jugend']]);
        expect(wrapper.emitted('resetFilters')).toHaveLength(1);
    });
});
