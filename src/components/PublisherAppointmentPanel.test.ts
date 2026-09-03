// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import PublisherAppointmentPanel from './PublisherAppointmentPanel.vue';

const panelProps = {
    appointments: [{ key: '1:start', label: 'Sommerfest — 12.08.2026' }],
    calendars: [{ id: '4', label: 'Gemeinde' }],
    hasError: false,
    hasFilters: false,
    isLoading: false,
    open: true,
    totalCount: 1,
    search: '',
    selectedCalendar: '',
    selectedRange: '',
    onlyDrafts: false,
    selectedAppointmentKey: '',
};

describe('PublisherAppointmentPanel', () => {
    it('renders appointment filters and options in an open dialog', async () => {
        const wrapper = mount(PublisherAppointmentPanel, { props: panelProps });
        await nextTick();

        expect(wrapper.get('dialog').attributes()).toHaveProperty('open');
        expect(wrapper.get('h2').text()).toBe('Termin auswählen');
        expect(wrapper.get('option[value="1:start"]').text()).toContain('Sommerfest');
        expect(wrapper.get('option[value="4"]').text()).toBe('Gemeinde');
        expect(wrapper.text()).toContain('1 von 1 Terminen');
    });

    it('emits model changes and filter reset actions', async () => {
        const wrapper = mount(PublisherAppointmentPanel, {
            props: { ...panelProps, hasFilters: true },
        });

        await wrapper.get('input[type="search"]').setValue('Jugend');
        await wrapper.get('.appointment-picker__reset').trigger('click');

        expect(wrapper.emitted('update:search')).toEqual([['Jugend']]);
        expect(wrapper.emitted('resetFilters')).toHaveLength(1);
    });

    it('closes after selecting an appointment', async () => {
        const wrapper = mount(PublisherAppointmentPanel, { props: panelProps });

        await wrapper.get('#appointment').setValue('1:start');

        expect(wrapper.emitted('update:selectedAppointmentKey')).toEqual([['1:start']]);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('synchronizes the native dialog with the open property', async () => {
        const wrapper = mount(PublisherAppointmentPanel, { props: panelProps });
        await nextTick();

        await wrapper.setProps({ open: false });
        await nextTick();

        expect(wrapper.get('dialog').attributes()).not.toHaveProperty('open');
    });
});
