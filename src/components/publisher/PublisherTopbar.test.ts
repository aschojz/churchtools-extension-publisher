// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import PublisherTopbar from './PublisherTopbar.vue';

describe('PublisherTopbar', () => {
    it('keeps appointment selection in the appointment-data inspector', () => {
        const wrapper = mount(PublisherTopbar, {
            props: {
                documentTitle: 'Unbenannt',
            },
            global: { plugins: [createPinia()] },
        });

        expect(wrapper.text()).toContain('Publisher');
        expect(wrapper.text()).not.toContain('Termine');
        expect(wrapper.find('[aria-label="Termindaten"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('Exportieren');
        expect(wrapper.findAll('.publisher-topbar__actions button').map((button) =>
            button.attributes('aria-label') ?? button.text())).toEqual([
            'Rückgängig', 'Wiederholen', 'Termindaten', 'Layout', 'Exportieren',
        ]);
        expect(wrapper.findAll('.publisher-topbar__separator')).toHaveLength(2);
    });

    it('opens templates as a dialog without changing the active inspector', async () => {
        const wrapper = mount(PublisherTopbar, {
            props: { documentTitle: 'Unbenannt' },
            global: { plugins: [createPinia()] },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Vorlagen')!.trigger('click');

        expect(wrapper.emitted('openTemplates')).toHaveLength(1);
        expect(wrapper.emitted('activate')).toBeUndefined();
    });

    it('enables undo and redo from the shared document history', async () => {
        const pinia = createPinia();
        const documentStore = usePublisherDocumentStore(pinia);
        const wrapper = mount(PublisherTopbar, {
            props: { documentTitle: 'Unbenannt' },
            global: { plugins: [pinia] },
        });
        const undoButton = () => wrapper.find('[aria-label="Rückgängig"]');
        const redoButton = () => wrapper.find('[aria-label="Wiederholen"]');

        expect(undoButton().attributes('disabled')).toBeDefined();
        documentStore.addPage(600, 600, 'split');
        await wrapper.vm.$nextTick();
        expect(undoButton().attributes('disabled')).toBeUndefined();

        documentStore.undoDocument();
        await wrapper.vm.$nextTick();
        expect(redoButton().attributes('disabled')).toBeUndefined();
    });
});
