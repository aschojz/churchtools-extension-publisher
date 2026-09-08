// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PublisherZoomControls from './PublisherZoomControls.vue';

describe('PublisherZoomControls', () => {
    it('offers pan and fit actions with selection-aware availability', async () => {
        const wrapper = mount(PublisherZoomControls, {
            props: { canFitSelection: false, panActive: true, zoom: 125 },
        });

        expect(wrapper.get('[aria-label="Arbeitsfläche verschieben (Leertaste)"]').attributes('aria-pressed')).toBe('true');
        expect(wrapper.get('[aria-label="Auswahl einpassen"]').attributes()).toHaveProperty('disabled');
        expect(wrapper.get('output').text()).toBe('125 %');

        await wrapper.get('[aria-label="Aktive Seite einpassen"]').trigger('click');
        await wrapper.get('[aria-label="Arbeitsfläche verschieben (Leertaste)"]').trigger('click');
        expect(wrapper.emitted('fitPage')).toHaveLength(1);
        expect(wrapper.emitted('togglePan')).toHaveLength(1);
    });

    it('emits zoom and selection fit changes', async () => {
        const wrapper = mount(PublisherZoomControls, {
            props: { canFitSelection: true, panActive: false, zoom: 100 },
        });

        await wrapper.get('[aria-label="Zoom"]').setValue('180');
        await wrapper.get('[aria-label="Auswahl einpassen"]').trigger('click');
        await wrapper.get('button[title="Tatsächliche Größe anzeigen"]').trigger('click');

        expect(wrapper.emitted('update:zoom')).toEqual([[180]]);
        expect(wrapper.emitted('fitSelection')).toHaveLength(1);
        expect(wrapper.emitted('showActualSize')).toHaveLength(1);
    });
});
