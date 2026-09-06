// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import { usePublisherAppointmentsStore } from '../../stores/publisherAppointments';
import PublisherContextBar from './PublisherContextBar.vue';

const mountContextBar = () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documentStore = usePublisherDocumentStore();
    const editorStore = usePublisherEditorStore();
    documentStore.activePage.layouts.split!.groups = [{ id: 'flow', children: ['title', 'accent', 'dateTime'] }];
    editorStore.selectedLayoutElements = ['title', 'accent', 'dateTime'];
    editorStore.selectedLayoutGroupDepth = 1;
    return mount(PublisherContextBar, {
        props: { hasImage: false, hasTemplate: true, hasTemplateOverrides: false },
        global: { plugins: [pinia] },
    });
};

const mountTextContextBar = () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const editorStore = usePublisherEditorStore();
    editorStore.activeEditorTool = 'layout';
    editorStore.selectedLayoutElement = 'title';
    editorStore.selectedLayoutElements = ['title'];
    editorStore.selectedLayoutTextContent = 'Willkommen';
    usePublisherAppointmentsStore().dataFields = [
        { id: 'title', label: 'Titel', type: 'text', value: 'Sommerfest', placeholder: '{{title}}' },
        { id: 'date', label: 'Datum', type: 'text', value: '1. Dezember 2026', placeholder: '{{date}}', formatType: 'date', rawValue: '2026-12-01T10:00:00+01:00', locale: 'de-DE', timeZone: 'Europe/Berlin' },
    ];
    return mount(PublisherContextBar, {
        props: { hasImage: false, hasTemplate: true, hasTemplateOverrides: false },
        global: { plugins: [pinia] },
    });
};

describe('PublisherContextBar alignment popover', () => {
    it('groups the four layer actions in a popover beside alignment', async () => {
        const wrapper = mountContextBar();
        const editorStore = usePublisherEditorStore();
        editorStore.selectedLayoutElement = 'title';
        editorStore.selectedLayoutElements = ['title'];
        editorStore.canGroupLayoutSelection = true;
        editorStore.canUngroupLayoutSelection = true;
        editorStore.selectedLayerPosition = 2;
        editorStore.selectedLayerTotal = 3;
        await wrapper.vm.$nextTick();

        const layerPopover = wrapper.get('.publisher-layer-popover');
        expect(layerPopover.get('summary').text()).toBe('Ebenen');
        expect(layerPopover.findAll('button').map((button) => button.text())).toEqual([
            'Nach hinten', 'Nach vorne', 'Gruppieren', 'Gruppe lösen',
        ]);
        await layerPopover.findAll('button')[0]!.trigger('click');
        expect(wrapper.emitted('changeLayer')).toEqual([[-1]]);
    });

    it('offers one-time equal distribution on both axes', async () => {
        const wrapper = mountContextBar();

        const distribute = wrapper.findAll('button').filter((button) => button.text() === 'Verteilen');
        await distribute[0]!.trigger('click');
        await distribute[1]!.trigger('click');

        expect(wrapper.emitted('distribute')).toEqual([['horizontal'], ['vertical']]);
    });

    it('enables persistent group layout with an eight pixel default gap', async () => {
        const wrapper = mountContextBar();

        await wrapper.get('.publisher-alignment-popover__toggle input').setValue(true);

        expect(wrapper.emitted('setGroupAutoLayout')).toEqual([[
            { axis: 'vertical', gap: 8, horizontalOrigin: 'left', verticalOrigin: 'top' },
        ]]);
    });
});

describe('PublisherContextBar content controls', () => {
    it('edits text and inserts appointment placeholders in the context row', async () => {
        const wrapper = mountTextContextBar();

        expect(wrapper.get('[aria-label="Textinhalt"]').attributes('value')).toBe('Willkommen');
        await wrapper.get('[aria-label="Textinhalt"]').setValue('Hallo');
        await wrapper.get('[aria-label="Terminplatzhalter einfügen"]').setValue('{{title}}');

        expect(wrapper.emitted('updateTextContent')).toEqual([
            ['Hallo'],
            ['Willkommen {{title}}'],
        ]);
    });

    it('offers date formatting variants through one dropdown', async () => {
        const wrapper = mountTextContextBar();

        const formatter = wrapper.get('[aria-label="Datum oder Uhrzeit formatieren"]');
        expect(formatter.text()).toContain('Datum: 01.12.2026');
        await formatter.setValue('{{date|date:DD.MM.YYYY}}');

        expect(wrapper.emitted('updateTextContent')).toEqual([['{{date|date:DD.MM.YYYY}}']]);
    });

    it('shows the resolved URL of a selected QR code for editing', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const documentStore = usePublisherDocumentStore();
        const editorStore = usePublisherEditorStore();
        documentStore.activePage.layouts.split!.customElements = [{
            id: 'qr-test', kind: 'qr', name: 'QR-Code', frame: { x: 0, y: 0, width: 120, height: 120 },
            qrValue: '{{link}}', dataBinding: 'link', qrBackground: '#ffffff', qrMargin: 2, qrErrorCorrection: 'M',
        }];
        editorStore.activeEditorTool = 'layout';
        editorStore.selectedLayoutElement = 'qr-test';
        editorStore.selectedLayoutElements = ['qr-test'];
        usePublisherAppointmentsStore().dataFields = [
            { id: 'link', label: 'Link', type: 'text', value: 'https://church.tools', placeholder: '{{link}}', formatType: 'url' },
        ];
        const wrapper = mount(PublisherContextBar, {
            props: { hasImage: false, hasTemplate: true, hasTemplateOverrides: false },
            global: { plugins: [pinia] },
        });

        expect(wrapper.get('[aria-label="QR-Inhalt"]').attributes('value')).toBe('https://church.tools');
        await wrapper.get('[aria-label="QR-Inhalt"]').setValue('https://example.org');
        expect(wrapper.emitted('updateQrContent')).toEqual([['https://example.org']]);
    });
});
