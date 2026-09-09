// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createPublisherPage } from '../../domain/publisherPage';
import PublisherExportDialog from './PublisherExportDialog.vue';

const pages = [createPublisherPage(1920, 1080), createPublisherPage(600, 600)];
const settings = [
    { pageId: pages[0]!.id, enabled: true, format: 'png' as const, jpegQuality: 90 },
    { pageId: pages[1]!.id, enabled: true, format: 'jpeg' as const, jpegQuality: 72 },
];

describe('PublisherExportDialog', () => {
    it('configures format and JPEG quality independently for every page', async () => {
        const wrapper = mount(PublisherExportDialog, {
            props: { busy: false, error: '', open: true, pages, progress: '', settings },
            global: { stubs: { teleport: true } },
        });

        expect(wrapper.findAll('.publisher-export-page')).toHaveLength(2);
        expect(wrapper.text()).toContain('1920 × 1080 px');
        expect(wrapper.findAll('.publisher-export-page__quality')).toHaveLength(1);
        expect(wrapper.get('.publisher-export-page__quality output').text()).toBe('72 %');

        await wrapper.findAll('select')[0]!.setValue('jpeg');
        await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(false);

        expect(wrapper.emitted('updatePage')).toEqual([
            [pages[0]!.id, { format: 'jpeg' }],
            [pages[1]!.id, { enabled: false }],
        ]);
    });

    it('submits one ZIP export and disables closing while rendering', async () => {
        const wrapper = mount(PublisherExportDialog, {
            props: { busy: true, error: '', open: true, pages, progress: 'Seite 1 von 2 wird gerendert …', settings },
            global: { stubs: { teleport: true } },
        });

        expect(wrapper.text()).toContain('Seite 1 von 2 wird gerendert');
        expect(wrapper.get('[aria-label="Dialog schließen"]').attributes()).toHaveProperty('disabled');
        expect(wrapper.findAll('button').find((button) => button.text().includes('Exportiere'))?.attributes()).toHaveProperty('disabled');
    });
});
