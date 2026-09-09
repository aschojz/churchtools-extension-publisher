// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DesignConfirmDialog from './DesignConfirmDialog.vue';

describe('DesignConfirmDialog', () => {
    it('requires an explicit destructive confirmation', async () => {
        const wrapper = mount(DesignConfirmDialog, {
            props: { open: true, title: 'Vorlage löschen?', description: '„Sonntag“ wird gelöscht.' },
            global: { stubs: { teleport: true } },
        });

        expect(wrapper.text()).toContain('nicht über Rückgängig');
        await wrapper.findAll('button').find((button) => button.text() === 'Abbrechen')!.trigger('click');
        await wrapper.findAll('button').find((button) => button.text() === 'Löschen')!.trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
        expect(wrapper.emitted('confirm')).toHaveLength(1);
    });
});
