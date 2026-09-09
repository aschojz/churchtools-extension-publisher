// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import DesignPopover from './DesignPopover.vue';

afterEach(() => { document.body.innerHTML = ''; });

describe('DesignPopover', () => {
    it('teleports interactive content outside clipping containers and returns focus on Escape', async () => {
        const wrapper = mount(DesignPopover, {
            attachTo: document.body,
            props: { label: 'Ausrichtung', width: 430 },
            slots: { default: '<button data-test="action">Links</button>' },
        });
        const trigger = wrapper.get('.design-popover__trigger');

        await trigger.trigger('click');
        const panel = document.body.querySelector<HTMLElement>('.design-popover__panel');
        expect(panel).not.toBeNull();
        expect(wrapper.element.contains(panel)).toBe(false);
        expect(panel?.style.width).toBe('430px');
        expect(document.activeElement).toBe(panel?.querySelector('[data-test="action"]'));

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await wrapper.vm.$nextTick();
        expect(document.body.querySelector('.design-popover__panel')).toBeNull();
        expect(document.activeElement).toBe(trigger.element);
        wrapper.unmount();
    });

    it('closes when the user points outside', async () => {
        const wrapper = mount(DesignPopover, {
            attachTo: document.body,
            props: { label: 'Ebenen' },
            slots: { default: '<button>Gruppieren</button>' },
        });
        await wrapper.get('.design-popover__trigger').trigger('click');
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await wrapper.vm.$nextTick();
        expect(document.body.querySelector('.design-popover__panel')).toBeNull();
        wrapper.unmount();
    });
});
