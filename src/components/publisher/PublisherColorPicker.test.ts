// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { usePublisherColorsStore } from '../../stores/publisherColors';
import { usePublisherImagePalettesStore } from '../../stores/publisherImagePalettes';
import PublisherColorPicker from './PublisherColorPicker.vue';

describe('PublisherColorPicker', () => {
    it('teleports the open popover outside of clipping inspector containers', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(PublisherColorPicker, {
            props: { modelValue: '#ffffff' },
            attachTo: document.body,
            global: { plugins: [pinia] },
        });

        await wrapper.get('[aria-label="Farbe auswählen"]').trigger('click');
        const popover = document.body.querySelector<HTMLElement>('.publisher-color-picker__popover');

        expect(popover).not.toBeNull();
        expect(wrapper.element.contains(popover)).toBe(false);
        expect(popover?.style.top).toMatch(/px$/);
        expect(popover?.style.left).toMatch(/px$/);
        expect(popover?.style.width).toBe('300px');
        wrapper.unmount();
    });

    it('offers analyzed image colors and remembers the selected color', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const imagePalettes = usePublisherImagePalettesStore();
        imagePalettes.syncSources([{ id: 'image-1', label: 'Titelbild', source: 'data:image/png;base64,image' }]);
        imagePalettes.palettes['image-1'] = {
            colors: [{ id: 'Extracted-1', label: 'Bildfarbe 1', hex: '#f05a28' }],
            primary: '#f05a28', background: '#221811', foreground: '#ffffff',
        };
        const wrapper = mount(PublisherColorPicker, {
            props: { modelValue: '#ffffff' },
            global: { plugins: [pinia], stubs: { teleport: true } },
        });

        await wrapper.get('[aria-label="Farbe auswählen"]').trigger('click');
        await wrapper.get('[aria-label="Bildfarbe 1: #F05A28"]').trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([['#f05a28']]);
        expect(usePublisherColorsStore().lastUsedColor).toBe('#f05a28');
    });

    it('shows only the tabs enabled by the caller and renders gradient controls in the second tab', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(PublisherColorPicker, {
            props: { modelValue: '#ffffff', tabs: ['color', 'gradient'] },
            slots: { gradient: '<div data-test="gradient-controls">Verlaufseinstellungen</div>' },
            global: { plugins: [pinia], stubs: { teleport: true } },
        });

        await wrapper.get('[aria-label="Farbe auswählen"]').trigger('click');
        expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Farbe & Farbfelder', 'Verlauf']);
        await wrapper.findAll('[role="tab"]')[1]!.trigger('click');
        expect(wrapper.get('[data-test="gradient-controls"]').text()).toBe('Verlaufseinstellungen');
    });

    it('emits a dynamic semantic image-color binding when enabled by the caller', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const imagePalettes = usePublisherImagePalettesStore();
        imagePalettes.syncSources([{ id: 'image-1', label: 'Titelbild', source: 'data:image/png;base64,image' }]);
        imagePalettes.palettes['image-1'] = {
            colors: [
                { id: 'primary', label: 'Primärfarbe', hex: '#f05a28' },
                { id: 'background', label: 'Hintergrundfarbe', hex: '#221811' },
                { id: 'foreground', label: 'Vordergrundfarbe', hex: '#ffffff' },
            ],
            primary: '#f05a28', background: '#221811', foreground: '#ffffff',
        };
        const wrapper = mount(PublisherColorPicker, {
            props: { dynamic: true, modelValue: '#123456' },
            global: { plugins: [pinia], stubs: { teleport: true } },
        });

        await wrapper.get('[aria-label="Farbe auswählen"]').trigger('click');
        await wrapper.get('[aria-label="Primär aus Titelbild dynamisch verwenden"]').trigger('click');

        expect(wrapper.emitted('update:colorBinding')).toEqual([[
            { imageId: 'image-1', token: 'primary' },
        ]]);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('reassigns an image role through the nine palette swatches', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const imagePalettes = usePublisherImagePalettesStore();
        imagePalettes.syncSources([{ id: 'image-1', label: 'Titelbild', source: 'data:image/png;base64,image' }]);
        imagePalettes.palettes['image-1'] = {
            colors: [
                { id: 'one', label: 'Bildfarbe 1', hex: '#f05a28' },
                { id: 'two', label: 'Bildfarbe 2', hex: '#221811' },
            ],
            primary: '#f05a28', background: '#221811', foreground: '#f05a28',
        };
        const wrapper = mount(PublisherColorPicker, {
            props: { dynamic: true, modelValue: '#123456' },
            global: { plugins: [pinia], stubs: { teleport: true } },
        });

        await wrapper.get('[aria-label="Farbe auswählen"]').trigger('click');
        await wrapper.get('[aria-label="Hintergrundfarbe festlegen"]').trigger('click');
        await wrapper.get('[aria-label="Hintergrundfarbe auf #F05A28 setzen"]').trigger('click');

        expect(imagePalettes.palettes['image-1']?.background).toBe('#f05a28');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });
});
