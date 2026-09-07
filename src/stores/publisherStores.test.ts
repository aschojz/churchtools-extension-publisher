import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { LAYOUT_ELEMENT_IDS } from '../domain/layoutEditing';
import { cloneLayoutState } from '../domain/layoutHistory';
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

    it('applies a standard seed through the same serializable page layout model', () => {
        const document = usePublisherDocumentStore();
        document.addPage(600, 600, 'split');

        document.replaceActivePageTemplate('poster');

        expect(document.activePage.templateId).toBe('poster');
        expect(document.activePage.layouts.poster?.order).toEqual(LAYOUT_ELEMENT_IDS);
        expect(document.activePage.layouts.poster?.sizes.background).toEqual({ width: 600, height: 600 });
        expect(document.activePage.layouts.split).toBeUndefined();
    });

    it('owns page layout history and restores committed changes', () => {
        const document = usePublisherDocumentStore();
        const pageId = document.activePageId;
        const previous = cloneLayoutState(document.activePage.layouts.split!);
        const current = cloneLayoutState(previous);
        current.offsets.title = { x: 80, y: 40 };

        document.commitPageLayout(pageId, 'split', previous, current);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 80, y: 40 });

        document.undoPageLayout(pageId, 'split');
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 0, y: 0 });

        document.redoPageLayout(pageId, 'split');
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 80, y: 40 });
    });

    it('keeps the canvas selection scoped to the active page', () => {
        const document = usePublisherDocumentStore();
        const editor = usePublisherEditorStore();
        const firstPageId = document.activePageId;
        editor.activateCanvasPage(firstPageId);
        expect(editor.setCanvasSelection(firstPageId, ['title'], null)).toBe(true);
        expect(editor.selectedLayoutElements).toEqual(['title']);

        const secondPage = document.addPage(600, 600, 'split');
        editor.activateCanvasPage(secondPage.id);

        expect(editor.selectedLayoutElements).toEqual([]);
        expect(editor.setCanvasSelection(firstPageId, ['dateTime'], null)).toBe(false);
        expect(editor.selectedLayoutElements).toEqual([]);
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
