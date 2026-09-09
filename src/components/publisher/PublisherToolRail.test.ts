// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PublisherToolRail from './PublisherToolRail.vue';

describe('PublisherToolRail', () => {
    it('adds text and shape elements from the toolbar', async () => {
        const wrapper = mount(PublisherToolRail);

        await wrapper.get('[aria-label="Grafiktext hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="Rahmentext hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="Bild hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="Kreis hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="Strich hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="Font-Awesome-Icon hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="Kirche hinzufügen"]').trigger('click');
        await wrapper.get('[aria-label="QR-Code hinzufügen"]').trigger('click');

        expect(wrapper.emitted('addText')).toEqual([['graphic'], ['frame']]);
        expect(wrapper.emitted('addImage')).toEqual([[]]);
        expect(wrapper.emitted('add')).toEqual([['circle'], ['line']]);
        expect(wrapper.emitted('addIcon')).toEqual([['church']]);
        expect(wrapper.emitted('addQr')).toEqual([[]]);
    });

    it('keeps insertion available on a termin-independent blank document', () => {
        const wrapper = mount(PublisherToolRail);

        expect(wrapper.findAll('button').every((button) => button.attributes('disabled') === undefined)).toBe(true);
    });
});
