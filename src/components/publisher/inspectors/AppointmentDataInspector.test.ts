// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { usePublisherAppointmentsStore } from '../../../stores/publisherAppointments';
import AppointmentDataInspector from './AppointmentDataInspector.vue';

const mountInspector = () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = usePublisherAppointmentsStore();
    store.selectedAppointmentKey = 'calendar:appointment';
    store.dataFields = [
        { id: 'title', label: 'Titel', type: 'text', value: 'Familiengottesdienst', multiline: true, placeholder: '{{title}}' },
        { id: 'date', label: 'Datum', type: 'text', value: '05.09.2026', placeholder: '{{date}}', formatType: 'date' },
        { id: 'link', label: 'Link', type: 'text', value: 'https://church.tools', placeholder: '{{link}}', formatType: 'url' },
        { id: 'image', label: 'Terminbild', type: 'image', value: 'https://example.org/image.jpg', placeholder: '{{image}}' },
    ];

    return mount(AppointmentDataInspector, {
        props: {
            error: '',
            focus: { x: 50, y: 50, zoom: 100 },
            overriddenFields: [],
            replacementName: '',
            replacementUrl: null,
        },
        global: { plugins: [pinia] },
    });
};

describe('AppointmentDataInspector', () => {
    it('can reopen the appointment picker while an appointment is selected', async () => {
        const wrapper = mountInspector();

        const button = wrapper.findAll('button').find((candidate) => candidate.text() === 'Anderen Termin wählen')!;
        await button.trigger('click');

        expect(wrapper.emitted('openAppointments')).toHaveLength(1);
    });

    it('shows compact read-only field summaries with the drag handle first', () => {
        const wrapper = mountInspector();
        const titleRow = wrapper.findAll('.publisher-data-field')[0]!;
        const heading = titleRow.get('.publisher-data-field__heading');

        expect(heading.element.children[0]?.classList.contains('publisher-data-field__drag')).toBe(true);
        expect(titleRow.get('.publisher-data-field__title').text()).toBe('Titel{{title}}');
        expect(titleRow.get('.publisher-data-field__summary p').text()).toBe('Familiengottesdienst');
        expect(titleRow.find('textarea').exists()).toBe(false);
        expect(titleRow.get('[aria-label="Titel auf der Seite einfügen"]').classes()).toContain('design-icon-button--compact');
    });

    it('edits a text value only inside the pencil dialog', async () => {
        const wrapper = mountInspector();

        await wrapper.get('[aria-label="Titel bearbeiten"]').trigger('click');
        expect(wrapper.get('[role="dialog"]').text()).toContain('{{title}}');
        await wrapper.get('textarea').setValue('Neuer Titel');
        await wrapper.findAll('button').find((button) => button.text() === 'Übernehmen')!.trigger('submit');

        expect(wrapper.emitted('updateField')).toEqual([['title', 'Neuer Titel']]);
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    });

    it('keeps image replacement and focus controls out of the compact list', async () => {
        const wrapper = mountInspector();

        expect(wrapper.get('.publisher-data-field.is-image .publisher-data-field__type img').attributes('src')).toBe('https://example.org/image.jpg');
        expect(wrapper.get('.publisher-data-field.is-date .publisher-data-field__type svg').classes()).toContain('fa-calendar-days');
        expect(wrapper.get('.publisher-data-field.is-url .publisher-data-field__type svg').classes()).toContain('fa-link');
        expect(wrapper.find('.publisher-data-dialog__focus').exists()).toBe(false);
        await wrapper.get('[aria-label="Terminbild bearbeiten"]').trigger('click');

        expect(wrapper.get('.publisher-data-dialog__image img').attributes('src')).toBe('https://example.org/image.jpg');
        expect(wrapper.get('.publisher-data-dialog__focus').findAll('input[type="range"]')).toHaveLength(3);
    });
});
