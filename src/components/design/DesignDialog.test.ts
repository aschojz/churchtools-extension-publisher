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

    it('honors explicit initial focus and blocks every close path while disabled', async () => {
        const wrapper = mount(DesignDialog, {
            props: {
                closeDisabled: true,
                description: 'Der Vorgang läuft noch.',
                open: true,
                title: 'Export',
            },
            slots: { default: '<input data-dialog-initial-focus aria-label="Dateiname" />' },
            attachTo: document.body,
        });
        await nextTick();
        const dialog = document.body.querySelector<HTMLElement>('.design-dialog');
        const input = dialog?.querySelector<HTMLInputElement>('[aria-label="Dateiname"]');

        expect(document.activeElement).toBe(input);
        expect(dialog?.getAttribute('aria-describedby')).toBeTruthy();
        expect(dialog?.querySelector('[aria-label="Dialog schließen"]')?.hasAttribute('disabled')).toBe(true);
        dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.body.querySelector<HTMLElement>('.design-dialog-backdrop')?.click();
        expect(wrapper.emitted('close')).toBeUndefined();

        wrapper.unmount();
    });
});
