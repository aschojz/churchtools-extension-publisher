// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { createLayoutGradient } from '../../domain/layoutGradient';
import { usePublisherImagePalettesStore } from '../../stores/publisherImagePalettes';
import LayoutGradientEditor from './LayoutGradientEditor.vue';

describe('LayoutGradientEditor', () => {
    it('applies an analyzed image color to an individual gradient stop', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const imagePalettes = usePublisherImagePalettesStore();
        imagePalettes.syncSources([{ id: 'image-1', label: 'Titelbild', source: 'data:image/png;base64,image' }]);
        imagePalettes.palettes['image-1'] = {
            colors: [{ id: 'Extracted-1', label: 'Bildfarbe 1', hex: '#f05a28' }],
            primary: '#f05a28', background: '#221811', foreground: '#ffffff',
        };
        const gradient = createLayoutGradient('#123456');
        const wrapper = mount(LayoutGradientEditor, {
            props: { fallbackColor: '#123456', gradient },
            global: { plugins: [pinia], stubs: { teleport: true } },
        });

        await wrapper.findAll('[aria-label="Farbe des Verlaufspunkts"]')[0]!.trigger('click');
        await wrapper.findAll('[aria-label="Bildfarbe 1: #F05A28"]')[0]!.trigger('click');

        expect(wrapper.emitted('update')?.[0]?.[0]).toMatchObject({
            stops: [
                { id: 'gradient-stop-0', color: '#f05a28' },
                { id: 'gradient-stop-1', color: '#ffffff' },
            ],
        });
    });

    it('binds a gradient stop to a semantic image color without replacing its fallback', async () => {
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
        const gradient = createLayoutGradient('#123456');
        const wrapper = mount(LayoutGradientEditor, {
            props: { fallbackColor: '#123456', gradient },
            global: { plugins: [pinia], stubs: { teleport: true } },
        });

        await wrapper.findAll('[aria-label="Farbe des Verlaufspunkts"]')[0]!.trigger('click');
        await wrapper.get('[aria-label="Primär aus Titelbild dynamisch verwenden"]').trigger('click');

        expect(wrapper.emitted('update')?.[0]?.[0]).toMatchObject({
            stops: [
                { id: 'gradient-stop-0', color: '#123456', colorBinding: { imageId: 'image-1', token: 'primary' } },
                { id: 'gradient-stop-1', color: '#ffffff' },
            ],
        });
    });
});
