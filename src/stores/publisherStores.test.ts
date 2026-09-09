import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { LAYOUT_ELEMENT_IDS } from '../domain/layoutEditing';
import { cloneLayoutState } from '../domain/layoutHistory';
import { clonePublisherPage, createBlankPublisherPage } from '../domain/publisherPage';
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
        expect(editor.panToolEnabled).toBe(false);
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

    it('renames, duplicates and reorders complete pages', () => {
        const document = usePublisherDocumentStore();
        const firstPageId = document.activePageId;
        document.renamePage(firstPageId, 'Begrüßung');
        const secondPage = document.addPage(600, 600, 'split');
        const duplicate = document.duplicatePage(firstPageId)!;

        expect(duplicate).toMatchObject({ name: 'Begrüßung Kopie', width: 1920, height: 1080 });
        expect(duplicate.id).not.toBe(firstPageId);
        expect(duplicate.layouts.split).not.toBe(document.pageById(firstPageId)?.layouts.split);
        expect(document.pages.map(({ id }) => id)).toEqual([firstPageId, duplicate.id, secondPage.id]);

        expect(document.movePage(secondPage.id, firstPageId, 'before')).toBe(true);
        expect(document.pages.map(({ id }) => id)).toEqual([secondPage.id, firstPageId, duplicate.id]);
        expect(document.activePageId).toBe(duplicate.id);
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

    it('owns chronological document history across canvas and page changes', () => {
        const document = usePublisherDocumentStore();
        const pageId = document.activePageId;
        const previous = cloneLayoutState(document.activePage.layouts.split!);
        const current = cloneLayoutState(previous);
        current.offsets.title = { x: 80, y: 40 };

        document.commitPageLayout(pageId, 'split', previous, current);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 80, y: 40 });
        const secondPage = document.addPage(600, 600, 'split');
        expect(document.activePageId).toBe(secondPage.id);

        expect(document.undoDocument()).toBe(true);
        expect(document.pages).toHaveLength(1);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 80, y: 40 });

        expect(document.undoDocument()).toBe(true);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 0, y: 0 });

        expect(document.redoDocument()).toBe(true);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 80, y: 40 });

        expect(document.redoDocument()).toBe(true);
        expect(document.pages).toHaveLength(2);
        expect(document.activePageId).toBe(secondPage.id);
    });

    it('applies named layout mutations atomically and records a single undo step', () => {
        const document = usePublisherDocumentStore();
        const pageId = document.activePageId;

        expect(document.mutatePageLayout(pageId, 'split', (layout) => {
            layout.offsets.title = { x: 120, y: 60 };
            layout.rotations.title = 15;
        })).toBe(true);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 120, y: 60 });
        expect(document.activePage.layouts.split?.rotations.title).toBe(15);
        expect(document.documentHistory.past).toHaveLength(1);

        expect(document.undoDocument()).toBe(true);
        expect(document.activePage.layouts.split?.offsets.title).toEqual({ x: 0, y: 0 });
        expect(document.activePage.layouts.split?.rotations.title).toBe(0);
        expect(document.mutatePageLayout(pageId, 'split', () => undefined)).toBe(false);
    });

    it('undoes page rename, reorder, duplicate and removal as complete snapshots', () => {
        const document = usePublisherDocumentStore();
        const firstPageId = document.activePageId;
        const secondPage = document.addPage(600, 600, 'split');
        document.renamePage(firstPageId, 'Start');
        document.movePage(secondPage.id, firstPageId, 'before');
        const duplicate = document.duplicatePage(firstPageId)!;
        document.removePage(secondPage.id);

        expect(document.pages.map(({ id }) => id)).toEqual([firstPageId, duplicate.id]);
        expect(document.undoDocument()).toBe(true);
        expect(document.pages.map(({ id }) => id)).toEqual([secondPage.id, firstPageId, duplicate.id]);
        expect(document.undoDocument()).toBe(true);
        expect(document.pages.map(({ id }) => id)).toEqual([secondPage.id, firstPageId]);
        expect(document.undoDocument()).toBe(true);
        expect(document.pages.map(({ id }) => id)).toEqual([firstPageId, secondPage.id]);
        expect(document.undoDocument()).toBe(true);
        expect(document.pageById(firstPageId)?.name).toBe('Seite 1');
    });

    it('undoes applying standard and saved design templates', () => {
        const document = usePublisherDocumentStore();
        const originalPageId = document.activePageId;

        document.replaceActivePageTemplate('poster');
        expect(document.activePage.templateId).toBe('poster');
        expect(document.undoDocument()).toBe(true);
        expect(document.activePage.templateId).toBe('split');
        expect(document.activePage.layouts.split?.order).toEqual([]);

        const templatePage = clonePublisherPage(createBlankPublisherPage(600, 600, 'split', 'Template'), true);
        document.replacePagesWithHistory([templatePage], templatePage.id);
        expect(document.activePage).toMatchObject({ id: templatePage.id, name: 'Template', width: 600 });
        expect(document.undoDocument()).toBe(true);
        expect(document.activePageId).toBe(originalPageId);
    });

    it('clears undo and redo when an independent document is loaded', () => {
        const document = usePublisherDocumentStore();
        document.addPage(600, 600, 'split');
        expect(document.canUndoDocument).toBe(true);
        document.undoDocument();
        expect(document.canRedoDocument).toBe(true);

        const loadedPage = createBlankPublisherPage(1920, 300, 'split', 'Geladen');
        document.replacePages([loadedPage], loadedPage.id);

        expect(document.canUndoDocument).toBe(false);
        expect(document.canRedoDocument).toBe(false);
        expect(document.undoDocument()).toBe(false);
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

    it('keeps only current derived page thumbnails', () => {
        const editor = usePublisherEditorStore();
        editor.setPageThumbnail('page-1', 'data:image/png;base64,one');
        editor.setPageThumbnail('page-2', 'data:image/png;base64,two');

        editor.retainPageThumbnails(['page-2']);

        expect(editor.pageThumbnails).toEqual({ 'page-2': 'data:image/png;base64,two' });
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

    it('assigns semantic image roles only to extracted palette colors', () => {
        const imagePalettes = usePublisherImagePalettesStore();
        imagePalettes.syncSources([{ id: 'image-1', label: 'Bild', source: 'data:image/png;base64,image' }]);
        imagePalettes.palettes['image-1'] = {
            colors: [
                { id: 'one', label: 'Bildfarbe 1', hex: '#123456' },
                { id: 'two', label: 'Bildfarbe 2', hex: '#abcdef' },
            ],
            primary: '#123456', background: '#123456', foreground: '#abcdef',
        };
        const revision = imagePalettes.revision;

        expect(imagePalettes.assignRole('image-1', 'background', '#ABCDEF')).toBe(true);
        expect(imagePalettes.palettes['image-1']?.background).toBe('#abcdef');
        expect(imagePalettes.revision).toBe(revision + 1);
        expect(imagePalettes.assignRole('image-1', 'primary', '#ffffff')).toBe(false);
        expect(imagePalettes.palettes['image-1']?.primary).toBe('#123456');
    });
});
