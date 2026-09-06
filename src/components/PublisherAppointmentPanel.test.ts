// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import PublisherAppointmentPanel from './PublisherAppointmentPanel.vue';
import { usePublisherAppointmentsStore } from '../stores/publisherAppointments';

const panelProps = {
    appointments: [{ key: '1:start', label: 'Sommerfest — 12.08.2026' }],
    calendars: [{ id: '4', label: 'Gemeinde' }],
    hasError: false,
    isLoading: false,
    totalCount: 1,
};

const mountPanel = () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = usePublisherAppointmentsStore();
    store.appointmentDialogOpen = true;
    return { store, wrapper: mount(PublisherAppointmentPanel, { props: panelProps, global: { plugins: [pinia] } }) };
};

describe('PublisherAppointmentPanel', () => {
    it('renders appointment filters and options in an open dialog', async () => {
        const { wrapper } = mountPanel();
        await nextTick();

        expect(wrapper.get('dialog').attributes()).toHaveProperty('open');
        expect(wrapper.get('h2').text()).toBe('Termin auswählen');
        expect(wrapper.get('option[value="1:start"]').text()).toContain('Sommerfest');
        expect(wrapper.get('option[value="4"]').text()).toBe('Gemeinde');
        expect(wrapper.text()).toContain('1 von 1 Terminen');
    });

    it('stores filter changes and can reset them', async () => {
        const { store, wrapper } = mountPanel();

        await wrapper.get('input[type="search"]').setValue('Jugend');
        await wrapper.get('.appointment-picker__reset').trigger('click');

        expect(store.appointmentSearch).toBe('');
    });

    it('closes only after confirming an appointment', async () => {
        const { store, wrapper } = mountPanel();

        await wrapper.get('#appointment').setValue('1:start');
        expect(wrapper.emitted('close')).toBeUndefined();
        await wrapper.get('.publisher-appointment-panel__footer button:last-child').trigger('click');

        expect(store.selectedAppointmentKey).toBe('1:start');
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('synchronizes the native dialog with the store', async () => {
        const { store, wrapper } = mountPanel();
        await nextTick();

        store.appointmentDialogOpen = false;
        await nextTick();

        expect(wrapper.get('dialog').attributes()).not.toHaveProperty('open');
    });
});
