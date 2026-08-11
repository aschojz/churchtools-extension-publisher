// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PublisherEditorShell from './PublisherEditorShell.vue';

describe('PublisherEditorShell', () => {
    it('renders the permanent editor regions and provided optional panels', () => {
        const wrapper = mount(PublisherEditorShell, {
            slots: {
                topbar: '<span>Publisher</span>',
                contextbar: '<span>Auswahl</span>',
                tools: '<button>Text</button>',
                left: '<span>Termine</span>',
                default: '<article>Canvas</article>',
                right: '<span>Ebenen</span>',
                statusbar: '<span>100 %</span>',
            },
        });

        expect(wrapper.get('header').text()).toContain('Publisher');
        expect(wrapper.get('nav').attributes('aria-label')).toBe('Werkzeuge');
        expect(wrapper.get('main').text()).toContain('Canvas');
        expect(wrapper.findAll('aside')).toHaveLength(2);
        expect(wrapper.get('footer').text()).toContain('100 %');
    });

    it('omits unused optional regions', () => {
        const wrapper = mount(PublisherEditorShell, {
            slots: {
                topbar: 'Publisher',
                default: 'Arbeitsbereich',
            },
        });

        expect(wrapper.find('nav').exists()).toBe(false);
        expect(wrapper.find('aside').exists()).toBe(false);
        expect(wrapper.find('footer').exists()).toBe(false);
        expect(wrapper.get('main').text()).toBe('Arbeitsbereich');
    });
});
