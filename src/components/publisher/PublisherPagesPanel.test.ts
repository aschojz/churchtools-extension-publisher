// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import PublisherPagesPanel from './PublisherPagesPanel.vue';

describe('PublisherPagesPanel', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('shows rendered thumbnails and emits compact page actions', async () => {
        const documentStore = usePublisherDocumentStore();
        const editorStore = usePublisherEditorStore();
        const firstPage = documentStore.activePage;
        documentStore.renamePage(firstPage.id, 'Begrüßung');
        documentStore.addPage(600, 600, 'split');
        editorStore.setPageThumbnail(firstPage.id, 'data:image/png;base64,preview');
        const wrapper = mount(PublisherPagesPanel);

        expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,preview');
        expect(wrapper.text()).toContain('Begrüßung');
        expect(wrapper.text()).toContain('600 × 600 px');

        await wrapper.get('[aria-label="Begrüßung duplizieren"]').trigger('click');
        expect(wrapper.emitted('duplicate')).toEqual([[firstPage.id]]);

        await wrapper.get('[aria-label="Begrüßung umbenennen"]').trigger('click');
        const input = wrapper.get<HTMLInputElement>('[aria-label="Seitenname"]');
        await input.setValue('Einstieg');
        await input.trigger('keydown.enter');
        expect(wrapper.emitted('rename')).toEqual([[firstPage.id, 'Einstieg']]);
    });

    it('emits a page reorder relative to the hovered half', async () => {
        const documentStore = usePublisherDocumentStore();
        const firstPage = documentStore.activePage;
        const secondPage = documentStore.addPage(600, 600, 'split');
        const wrapper = mount(PublisherPagesPanel);
        const entries = wrapper.findAll('.publisher-page-entry');
        const transfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: () => undefined,
            getData: () => firstPage.id,
        };

        await entries[0]!.get('.publisher-page-entry__drag').trigger('dragstart', { dataTransfer: transfer });
        await entries[1]!.trigger('dragover', { clientY: 1, dataTransfer: transfer });
        await entries[1]!.trigger('drop', { clientY: 1, dataTransfer: transfer });

        expect(wrapper.emitted('reorder')).toEqual([[firstPage.id, secondPage.id, 'after']]);
    });
});
