// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import PublisherTopbar from './PublisherTopbar.vue';

describe('PublisherTopbar', () => {
    it('keeps appointment selection in the appointment-data inspector', () => {
        const wrapper = mount(PublisherTopbar, {
            props: {
                documentTitle: 'Unbenannt',
                exportDisabled: false,
                hasTemplate: true,
            },
            global: { plugins: [createPinia()] },
        });

        expect(wrapper.text()).toContain('Publisher');
        expect(wrapper.text()).not.toContain('Termine');
        expect(wrapper.find('[aria-label="Termindaten"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('Exportieren');
    });
});
