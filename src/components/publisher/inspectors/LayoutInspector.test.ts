// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import type { LayoutTextStyle } from '../../../domain/layoutEditing';
import { usePublisherEditorStore } from '../../../stores/publisherEditor';
import { usePublisherImagePalettesStore } from '../../../stores/publisherImagePalettes';
import LayoutInspector from './LayoutInspector.vue';

const textStyle = (overrides: Partial<LayoutTextStyle> = {}): LayoutTextStyle & { elementId: 'title' } => ({
    elementId: 'title',
    fontSize: 72,
    color: '#ffffff',
    stroke: '#000000',
    strokeWidth: 0,
    fontFamily: 'Lato, Arial, sans-serif',
    fontStyle: 'normal',
    lineHeight: 1.2,
    letterSpacing: 0,
    align: 'left',
    listStyle: 'none',
    textTransform: 'none',
    underlineStyle: 'none',
    strikethroughStyle: 'none',
    ...overrides,
});

const mountInspector = (style: LayoutTextStyle & { elementId: 'title' }) => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const editorStore = usePublisherEditorStore();
    editorStore.selectedLayoutElement = 'title';
    editorStore.selectedLayoutElements = ['title'];
    editorStore.selectedLayoutStyle = style;
    editorStore.selectedLayoutTextContent = '';
    editorStore.selectedLayoutGeometry = { elementId: 'title', x: 10, y: 20, width: 300, height: 80, rotation: 0 };
    editorStore.selectedLayerPosition = 1;
    editorStore.selectedLayerTotal = 1;
    return mount(LayoutInspector, { global: { plugins: [pinia] } });
};

const openTab = async (wrapper: ReturnType<typeof mountInspector>, label: string) => {
    const tab = wrapper.findAll('[role="tab"]').find((candidate) => candidate.text() === label);
    await tab!.trigger('click');
};

describe('LayoutInspector typography controls', () => {
    it('represents bold and italic as independently active toggle buttons', async () => {
        const wrapper = mountInspector(textStyle({ fontStyle: 'bold italic' }));
        await openTab(wrapper, 'Text');

        expect(wrapper.get('[aria-label="Fett"]').attributes('aria-pressed')).toBe('true');
        expect(wrapper.get('[aria-label="Kursiv"]').attributes('aria-pressed')).toBe('true');

        await wrapper.get('[aria-label="Kursiv"]').trigger('click');
        expect(wrapper.emitted('updateTextStyle')).toContainEqual(['fontStyle', 'bold']);
    });

    it('uses active icon buttons for alignment and list style', async () => {
        const wrapper = mountInspector(textStyle({ align: 'center', listStyle: 'numbered' }));
        await openTab(wrapper, 'Absatz');

        expect(wrapper.get('[aria-label="Zentriert"]').attributes('aria-pressed')).toBe('true');
        expect(wrapper.get('[aria-label="Nummerierung"]').attributes('aria-pressed')).toBe('true');

        await wrapper.get('[aria-label="Linksbündig"]').trigger('click');
        await wrapper.get('[aria-label="Keine Liste"]').trigger('click');
        expect(wrapper.emitted('updateTextStyle')).toEqual([
            ['align', 'left'],
            ['listStyle', 'none'],
        ]);
    });

    it('switches custom text between graphic and frame behavior', async () => {
        const wrapper = mountInspector(textStyle());
        usePublisherEditorStore().selectedLayoutTextMode = 'frame';
        await openTab(wrapper, 'Text');

        await wrapper.findAll('button').find((button) => button.text() === 'Grafiktext')!.trigger('click');

        expect(wrapper.emitted('updateTextMode')).toEqual([['graphic']]);
    });

    it('controls output casing and double text decorations without editing content', async () => {
        const wrapper = mountInspector(textStyle());
        await openTab(wrapper, 'Text');

        await wrapper.get('[aria-label="Schreibweise"]').findAll('button')[1].trigger('click');
        await wrapper.get('[aria-label="Doppelte Unterstreichung"]').trigger('click');
        await wrapper.get('[aria-label="Doppelte Durchstreichung"]').trigger('click');

        expect(wrapper.emitted('updateTextStyle')).toEqual([
            ['textTransform', 'uppercase'],
            ['underlineStyle', 'double'],
            ['strikethroughStyle', 'double'],
        ]);
        expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).not.toContain('Inhalt');
    });

    it('does not show a whole-layout reset inside Transform', () => {
        const wrapper = mountInspector(textStyle());

        expect(wrapper.text()).not.toContain('Gesamtes Layout zurücksetzen');
        expect(wrapper.findAll('.inspector-transform-grid label').map((label) => label.element.childNodes[0]?.textContent)).toEqual(['X', 'Y', 'B', 'H', 'R']);
        expect(wrapper.get('[aria-label="Breite"]').attributes('title')).toBe('Breite');
    });

    it('keeps empty disabled transform fields visible without a selection', async () => {
        const wrapper = mountInspector(textStyle());
        usePublisherEditorStore().clearSelectionState();
        await wrapper.vm.$nextTick();

        const fields = wrapper.findAll('.inspector-transform-grid input');
        expect(fields).toHaveLength(5);
        expect(fields.every((field) => field.attributes().disabled !== undefined)).toBe(true);
        expect(fields.every((field) => (field.element as HTMLInputElement).value === '')).toBe(true);
        expect(wrapper.get('.inspector-fixed-block--transform').text()).not.toContain('Keine Auswahl');
    });

    it('allows position and rotation but not size changes for selected groups', async () => {
        const wrapper = mountInspector(textStyle());
        const store = usePublisherEditorStore();
        store.selectedLayoutGroupDepth = 1;
        store.selectedLayoutGeometry = {
            elementId: null,
            groupId: 'group-1',
            x: 100,
            y: 120,
            width: 500,
            height: 240,
            rotation: 15,
        };
        await wrapper.vm.$nextTick();

        expect(wrapper.get('[aria-label="X-Position"]').attributes()).not.toHaveProperty('disabled');
        expect(wrapper.get('[aria-label="Y-Position"]').attributes()).not.toHaveProperty('disabled');
        expect(wrapper.get('[aria-label="Breite"]').attributes()).toHaveProperty('disabled');
        expect(wrapper.get('[aria-label="Höhe"]').attributes()).toHaveProperty('disabled');
        expect(wrapper.get('[aria-label="Drehung"]').attributes()).not.toHaveProperty('disabled');
    });

    it('keeps text control descriptions accessible without visible headings', async () => {
        const wrapper = mountInspector(textStyle());
        await openTab(wrapper, 'Text');

        expect(wrapper.get('[title="Schriftart"]').get('[aria-label="Schriftart"]').element.tagName).toBe('SELECT');
        expect(wrapper.get('[aria-label="Schriftgröße"]').attributes('title')).toBe('Schriftgröße');
        expect(wrapper.find('.inspector-control-group__label').exists()).toBe(false);
    });

    it('edits a text contour independently from its fill color', async () => {
        const wrapper = mountInspector(textStyle({ stroke: '#123456', strokeWidth: 2 }));
        await openTab(wrapper, 'Kontur');

        expect(wrapper.get('[aria-label="Textkonturfarbe"]').attributes('value')).toBe('#123456');
        await wrapper.get('[aria-label="Textkonturfarbe"]').setValue('#abcdef');
        await wrapper.get('input[type="number"]').setValue(4);
        expect(wrapper.emitted('updateTextStyle')).toContainEqual(['stroke', expect.anything()]);
        expect(wrapper.emitted('updateTextStyle')).toContainEqual(['strokeWidth', expect.anything()]);
    });

    it('keeps deletion in the sticky layer footer', async () => {
        const wrapper = mountInspector(textStyle());
        await openTab(wrapper, 'Ebenen');

        expect(wrapper.findAll('.inspector-layer-list__delete')).toHaveLength(0);
        await wrapper.get('.inspector-layer-footer [aria-label="Auswahl löschen"]').trigger('click');
        expect(wrapper.emitted('deleteElements')).toEqual([[['title']]]);
    });

    it('opens layer effects from the sticky footer and applies them to the selection', async () => {
        const wrapper = mountInspector(textStyle());
        await openTab(wrapper, 'Ebenen');

        await wrapper.get('.inspector-layer-footer [aria-label="Ebeneneffekte"]').trigger('click');
        expect(wrapper.get('[role="dialog"]').text()).toContain('Ebeneneffekte');

        await wrapper.get('[aria-label="Schlagschatten aktivieren"]').setValue(true);
        await wrapper.get('.publisher-effects-dialog').trigger('submit');

        expect(wrapper.emitted('updateEffects')?.[0]?.[0]).toEqual(['title']);
        expect(wrapper.emitted('updateEffects')?.[0]?.[1]).toMatchObject({
            shadow: { enabled: true, color: '#000000', blur: 16, offsetX: 8, offsetY: 8 },
            blur: { enabled: false },
            opacity: 1,
            blendMode: 'source-over',
        });
    });

    it('does not incorrectly copy effects onto every child of a selected group', async () => {
        const wrapper = mountInspector(textStyle());
        usePublisherEditorStore().selectedLayoutGroupDepth = 1;
        await openTab(wrapper, 'Ebenen');

        const button = wrapper.get('[aria-label="Gruppeneffekte werden noch nicht unterstützt"]');
        expect(button.attributes()).toHaveProperty('disabled');
    });

    it('groups extracted colors by image and emits static or dynamic color choices', async () => {
        const wrapper = mountInspector(textStyle());
        const paletteStore = usePublisherImagePalettesStore();
        paletteStore.syncSources([{ id: 'data:image', label: 'Terminbild', source: 'data:image/png;base64,image' }]);
        paletteStore.palettes['data:image'] = {
            colors: [{ id: 'Vibrant', label: 'Kräftig', hex: '#f05a28' }],
            primary: '#f05a28', background: '#221811', foreground: '#ffffff',
        };
        paletteStore.statuses['data:image'] = 'ready';

        await openTab(wrapper, 'Farbe');
        expect(wrapper.get('.inspector-image-palette').text()).toContain('Terminbild');
        await wrapper.get('[aria-label="Primär aus Terminbild dynamisch verwenden"]').trigger('click');
        expect(wrapper.emitted('setColorBinding')).toEqual([[
            'color', { imageId: 'data:image', token: 'primary' },
        ]]);

        await wrapper.get('[title="Kräftig: #F05A28"]').trigger('click');
        expect(wrapper.emitted('setStaticColor')).toEqual([['color', '#f05a28']]);
    });
});
