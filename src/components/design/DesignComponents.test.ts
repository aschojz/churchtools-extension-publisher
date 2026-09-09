// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DesignButton from './DesignButton.vue';
import DesignIconButton from './DesignIconButton.vue';
import DesignTabs from './DesignTabs.vue';

describe('publisher design components', () => {
    it('renders text button variants from one shared API', () => {
        const wrapper = mount(DesignButton, {
            props: { block: true, size: 'compact', type: 'submit', variant: 'danger' },
            slots: { default: 'Löschen' },
        });

        expect(wrapper.get('button').attributes('type')).toBe('submit');
        expect(wrapper.classes()).toEqual(expect.arrayContaining([
            'design-button--danger', 'design-button--compact', 'is-block',
        ]));
    });

    it('gives icon-only buttons an accessible name and active state', () => {
        const wrapper = mount(DesignIconButton, {
            props: { active: true, label: 'Fett', size: 'compact', toggle: true },
            slots: { default: '↶' },
        });

        expect(wrapper.get('button').attributes('aria-label')).toBe('Fett');
        expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
        expect(wrapper.classes()).toEqual(expect.arrayContaining(['is-active', 'design-icon-button--compact']));
    });

    it('emits the selected tab id and supports roving keyboard focus', async () => {
        const wrapper = mount(DesignTabs, {
            props: {
                id: 'view-tabs',
                label: 'Ansicht',
                items: [{ id: 'one', label: 'Eins' }, { id: 'two', label: 'Zwei' }],
                modelValue: 'one',
            },
        });

        await wrapper.findAll('button')[1]!.trigger('click');
        expect(wrapper.emitted('update:modelValue')).toEqual([['two']]);
        await wrapper.setProps({ modelValue: 'two' });
        expect(wrapper.findAll('button')[0]!.attributes('tabindex')).toBe('-1');
        expect(wrapper.findAll('button')[1]!.attributes('aria-controls')).toBe('view-tabs-two-panel');
        await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' });
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['one']);
    });
});
