// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import DesignDialog from './DesignDialog.vue';

describe('DesignDialog', () => {
    it('teleports, traps focus and requests closing with Escape', async () => {
        const returnTarget = document.createElement('button');
        document.body.append(returnTarget);
        returnTarget.focus();
        const wrapper = mount(DesignDialog, {
            props: { open: false, title: 'Vorlagen' },
            slots: { default: '<button data-test="content-action">Aktion</button>' },
            attachTo: document.body,
        });

        await wrapper.setProps({ open: true });
        await nextTick();
        const dialog = document.body.querySelector<HTMLElement>('.design-dialog');
        const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [];
        expect(dialog).not.toBeNull();
        expect(document.activeElement).toBe(buttons[0]);

        buttons[buttons.length - 1]?.focus();
        dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(document.activeElement).toBe(buttons[0]);

        dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(wrapper.emitted('close')).toHaveLength(1);
        await wrapper.setProps({ open: false });
        await nextTick();
        expect(document.activeElement).toBe(returnTarget);

        wrapper.unmount();
        returnTarget.remove();
    });
});
