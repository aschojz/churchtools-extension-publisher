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
        expect(wrapper.get('[aria-label="Seitenübersicht öffnen"]').attributes('aria-expanded')).toBe('false');
        expect(wrapper.get('[aria-label="Eigenschaften öffnen"]').attributes('aria-expanded')).toBe('false');
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
        expect(wrapper.find('.publisher-shell__drawer-actions').exists()).toBe(false);
    });

    it('opens responsive drawers and closes them with Escape', async () => {
        const wrapper = mount(PublisherEditorShell, {
            attachTo: document.body,
            slots: { left: '<span>Seiten</span>', default: 'Canvas', right: '<span>Eigenschaften</span>' },
        });

        await wrapper.get('[aria-label="Seitenübersicht öffnen"]').trigger('click');
        expect(wrapper.get('#publisher-pages-drawer').classes()).toContain('is-open');
        expect(document.activeElement).toBe(wrapper.get('[aria-label="Seitenübersicht schließen"]').element);

        await wrapper.get('.publisher-shell').trigger('keydown', { key: 'Escape' });
        expect(wrapper.get('#publisher-pages-drawer').classes()).not.toContain('is-open');
        expect(document.activeElement).toBe(wrapper.get('[aria-label="Seitenübersicht öffnen"]').element);
        wrapper.unmount();
    });
});
