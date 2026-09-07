import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { LAYOUT_ELEMENT_IDS } from '../domain/layoutEditing';
import { usePublisherAppointmentsStore } from './publisherAppointments';
import { usePublisherDocumentStore } from './publisherDocument';
import { usePublisherEditorStore } from './publisherEditor';
import { usePublisherColorsStore } from './publisherColors';
import { usePublisherImagePalettesStore } from './publisherImagePalettes';

describe('publisher stores', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('starts with an editable blank page and without opening appointment selection', () => {
        const appointments = usePublisherAppointmentsStore();
        const document = usePublisherDocumentStore();
        const editor = usePublisherEditorStore();

        expect(appointments.appointmentDialogOpen).toBe(false);
        expect(editor.activeEditorTool).toBe('layout');
        expect(document.pages).toHaveLength(1);
        expect(document.activePage.layouts.split?.deleted).toEqual(LAYOUT_ELEMENT_IDS);
        expect(document.activePage.layouts.split?.order).toEqual([]);
    });

    it('can append a blank page with an independent size', () => {
        const document = usePublisherDocumentStore();

        const page = document.addPage(600, 600, 'split');

        expect(document.pages).toHaveLength(2);
        expect(document.activePageId).toBe(page.id);
        expect(document.activePage).toMatchObject({ width: 600, height: 600 });
        expect(document.activePage.layouts.split?.deleted).toEqual(LAYOUT_ELEMENT_IDS);
        expect(document.activePage.layouts.split?.order).toEqual([]);
    });

    it('keeps the latest twelve unique colors with the most recent first', () => {
        const colors = usePublisherColorsStore();
        for (let index = 0; index < 13; index += 1) {
            colors.rememberColor(`#${index.toString(16).padStart(6, '0')}`);
        }
        colors.rememberColor('#000005');
        colors.rememberColor('invalid');

        expect(colors.recentColors).toHaveLength(12);
        expect(colors.lastUsedColor).toBe('#000005');
        expect(colors.recentColors.filter((color) => color === '#000005')).toHaveLength(1);
        expect(colors.recentColors).not.toContain('#000000');
    });

    it('removes palettes and analysis state for removed image sources', () => {
        const imagePalettes = usePublisherImagePalettesStore();
        imagePalettes.syncSources([{ id: 'image-1', label: 'Bild', source: 'data:image/png;base64,image' }]);
        imagePalettes.palettes['image-1'] = {
            colors: [], primary: '#123456', background: '#ffffff', foreground: '#000000',
        };
        imagePalettes.statuses['image-1'] = 'ready';

        imagePalettes.syncSources([]);

        expect(imagePalettes.sources).toEqual([]);
        expect(imagePalettes.palettes['image-1']).toBeUndefined();
        expect(imagePalettes.statuses['image-1']).toBeUndefined();
    });
});
