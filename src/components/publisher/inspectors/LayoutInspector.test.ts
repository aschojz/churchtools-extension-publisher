// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import type { LayoutTextStyle } from '../../../domain/layoutEditing';
import { createLayoutFilterStack } from '../../../domain/layoutFilters';
import { createStandardPublisherLayout } from '../../../domain/publisherPage';
import { usePublisherDocumentStore } from '../../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../../stores/publisherEditor';
import { usePublisherImagePalettesStore } from '../../../stores/publisherImagePalettes';
import { usePublisherColorsStore } from '../../../stores/publisherColors';
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
    return mount(LayoutInspector, {
        props: { template: { title: '', date: '', time: '', location: '', imageUrl: null } },
        global: { plugins: [pinia], stubs: { teleport: true } },
    });
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

        await wrapper.get('[aria-label="Textkonturfarbe"]').trigger('click');
        expect(wrapper.get('[aria-label="Textkonturfarbe mit Farbwähler"]').attributes('value')).toBe('#123456');
        await wrapper.get('[aria-label="Textkonturfarbe mit Farbwähler"]').setValue('#abcdef');
        await wrapper.get('input[type="number"]').setValue(4);
        expect(wrapper.emitted('setStaticColor')).toContainEqual(['stroke', '#abcdef']);
        expect(wrapper.emitted('updateTextStyle')).toContainEqual(['strokeWidth', expect.anything()]);
    });

    it('offers gradient editing as an enabled tab of the fill color popover', async () => {
        const wrapper = mountInspector(textStyle());

        await wrapper.get('[aria-label="Textfarbe"]').trigger('click');
        const gradientTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text() === 'Verlauf');
        await gradientTab!.trigger('click');
        await wrapper.findAll('button').find((button) => button.text() === 'Verlauf hinzufügen')!.trigger('click');

        expect(wrapper.emitted('updateGradient')?.[0]?.[0]).toBe('color');
        expect(wrapper.emitted('updateGradient')?.[0]?.[1]).toMatchObject({ type: 'linear' });
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

    it('applies group effects to the group node instead of copying them onto every child', async () => {
        const wrapper = mountInspector(textStyle());
        const store = usePublisherEditorStore();
        store.selectedLayoutGroupDepth = 1;
        store.selectedLayoutGroupId = 'group-1';
        await openTab(wrapper, 'Ebenen');

        const button = wrapper.get('[aria-label="Ebeneneffekte"]');
        expect(button.attributes()).not.toHaveProperty('disabled');
        await button.trigger('click');
        await wrapper.get('[aria-label="Schlagschatten aktivieren"]').setValue(true);
        await wrapper.get('.publisher-effects-dialog').trigger('submit');

        expect(wrapper.emitted('updateEffects')?.[0]?.[0]).toEqual(['group-1']);
    });

    it('configures ordered filters from the sticky footer for a selected layer', async () => {
        const wrapper = mountInspector(textStyle());
        await openTab(wrapper, 'Ebenen');

        const footerButtons = wrapper.findAll('.inspector-layer-footer button');
        expect(footerButtons.map((button) => button.attributes('aria-label'))).toEqual([
            'Ebeneneffekte', 'Ebenenfilter', 'Auswahl sperren', 'Auswahl löschen',
        ]);
        await wrapper.get('.inspector-layer-footer [aria-label="Ebenenfilter"]').trigger('click');
        expect(wrapper.get('[role="dialog"]').text()).toContain('Ebenenfilter');

        await wrapper.findAll('.publisher-filters-dialog nav button')
            .find((button) => button.text().includes('Kontrast'))!
            .trigger('click');
        await wrapper.get('[aria-label="Kontrast aktivieren"]').setValue(true);
        await wrapper.get('button[aria-label="Filter nach oben verschieben"]').trigger('click');
        await wrapper.get('.publisher-filters-dialog').trigger('submit');

        const update = wrapper.emitted('updateFilters')?.[0];
        expect(update?.[0]).toEqual(['title']);
        expect((update?.[1] as { type: string }[])[0]?.type).toBe('contrast');
        expect(update?.[1]).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'contrast', enabled: true, amount: 20 }),
        ]));
    });

    it('targets a selected group with one shared filter stack', async () => {
        const wrapper = mountInspector(textStyle());
        const store = usePublisherEditorStore();
        store.selectedLayoutGroupDepth = 1;
        store.selectedLayoutGroupId = 'group-1';
        await openTab(wrapper, 'Ebenen');

        await wrapper.get('.inspector-layer-footer [aria-label="Ebenenfilter"]').trigger('click');
        await wrapper.get('[aria-label="Graustufen aktivieren"]').setValue(true);
        await wrapper.get('.publisher-filters-dialog').trigger('submit');

        expect(wrapper.emitted('updateFilters')?.[0]?.[0]).toEqual(['group-1']);
    });

    it('marks a filtered layer and reopens its filter stack from the layer row', async () => {
        const wrapper = mountInspector(textStyle());
        const documentStore = usePublisherDocumentStore();
        const layout = createStandardPublisherLayout('split');
        const filters = createLayoutFilterStack();
        filters.find(({ type }) => type === 'sepia')!.enabled = true;
        layout.filters = { title: filters };
        documentStore.replacePageLayout(documentStore.activePage.id, 'split', layout);
        await openTab(wrapper, 'Ebenen');

        const button = wrapper.get('[aria-label="Filter von Titel bearbeiten"]');
        await button.trigger('click');

        expect(wrapper.get('[role="dialog"]').text()).toContain('Ebenenfilter');
        expect((wrapper.get('[aria-label="Sepia aktivieren"]').element as HTMLInputElement).checked).toBe(true);
    });

    it('groups extracted colors by image and emits static or dynamic color choices', async () => {
        const wrapper = mountInspector(textStyle({
            colorBinding: { imageId: 'data:image', token: 'primary' },
        }));
        const paletteStore = usePublisherImagePalettesStore();
        paletteStore.syncSources([{ id: 'data:image', label: 'Terminbild', source: 'data:image/png;base64,image' }]);
        paletteStore.palettes['data:image'] = {
            colors: [
                { id: 'Vibrant', label: 'Kräftig', hex: '#f05a28' },
                { id: 'Dark', label: 'Dunkel', hex: '#221811' },
                { id: 'Light', label: 'Hell', hex: '#ffffff' },
            ],
            primary: '#f05a28', background: '#221811', foreground: '#ffffff',
        };
        paletteStore.statuses['data:image'] = 'ready';

        await openTab(wrapper, 'Farbe');
        const palette = wrapper.get('.inspector-image-palette');
        expect(palette.text()).not.toContain('Terminbild');
        expect(palette.get('.inspector-image-palette__preview img').attributes('src')).toBe('data:image/png;base64,image');
        expect(palette.get('[aria-label="Primär aus Terminbild dynamisch verwenden"] svg').classes()).toContain('fa-star');
        expect(palette.get('[aria-label="Hintergrund aus Terminbild dynamisch verwenden"] .publisher-image-palette-swatches__role').classes()).toContain('is-background');
        expect(palette.get('[aria-label="Vordergrund aus Terminbild dynamisch verwenden"] .publisher-image-palette-swatches__role').classes()).toContain('is-foreground');
        expect(palette.get('[aria-label="Terminbild erneut analysieren"]').attributes('title')).toBe('Terminbild erneut analysieren');
        expect(palette.get('[aria-label="Primär aus Terminbild dynamisch verwenden"]').attributes('aria-pressed')).toBe('true');
        expect(wrapper.find('.inspector-color-binding').exists()).toBe(false);
        await wrapper.get('[aria-label="Primär aus Terminbild dynamisch verwenden"]').trigger('click');
        await palette.get('[aria-label="Dynamische Bildfarbe lösen"]').trigger('click');
        expect(wrapper.emitted('setColorBinding')).toEqual([
            ['color', { imageId: 'data:image', token: 'primary' }],
            ['color', null],
        ]);

        await palette.get('[title="Kräftig: #F05A28"]').trigger('click');
        expect(wrapper.emitted('setStaticColor')).toEqual([['color', '#f05a28']]);
    });

    it('shows recent colors, reapplies them, and remembers colors from the native picker', async () => {
        const wrapper = mountInspector(textStyle());
        const colorsStore = usePublisherColorsStore();
        colorsStore.rememberColor('#123456');
        await wrapper.vm.$nextTick();

        const recent = wrapper.get('[aria-label="Zuletzt benutzte Farben"]');
        expect(wrapper.findAll('.inspector-swatches').map((swatches) => swatches.attributes('aria-label')).slice(0, 2)).toEqual([
            'Zuletzt benutzte Farben',
            'Farbfelder',
        ]);
        expect(recent.get('button').attributes('title')).toBe('#123456');
        await recent.get('button').trigger('click');
        expect(wrapper.emitted('setStaticColor')).toEqual([['color', '#123456']]);

        await wrapper.get('[aria-label="Textfarbe"]').trigger('click');
        await wrapper.get('[aria-label="Textfarbe mit Farbwähler"]').setValue('#abcdef');
        expect(colorsStore.lastUsedColor).toBe('#abcdef');
    });
});
