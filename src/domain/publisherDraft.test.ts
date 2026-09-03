import { describe, expect, it } from 'vitest';

import {
    createLayoutOffsets,
    createLayoutOrder,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
} from './layoutEditing';
import { createImageFocusByTemplate } from './imageFocus';
import {
    deletePublisherDraft,
    findPublisherDraftAppointmentKeys,
    loadPublisherDraft,
    type PublisherDraft,
    savePublisherDraft,
} from './publisherDraft';

const createStorage = () => {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
    };
};

const createDraft = (): PublisherDraft => ({
    version: 1,
    selectedTemplateId: 'poster',
    templateOverrides: { title: 'Lokaler Titel' },
    layouts: {
        split: {
            offsets: createLayoutOffsets(),
            sizes: createLayoutSizes('split'),
            rotations: createLayoutRotations(),
            order: createLayoutOrder(),
            styles: createLayoutTextStyles('split'),
            visualStyles: createLayoutVisualStyles('split'),
            groups: [],
            deleted: [],
        },
    },
    imageFocus: { ...createImageFocusByTemplate(), split: { x: 20, y: 80, zoom: 175 } },
    snapEnabled: false,
    previewZoomPercent: 150,
    updatedAt: '2026-08-02T12:00:00.000Z',
});

describe('publisher draft', () => {
    it('round-trips and deletes a versioned appointment draft', () => {
        const storage = createStorage();
        savePublisherDraft(storage, '42:date', createDraft());
        expect(loadPublisherDraft(storage, '42:date')).toEqual(createDraft());
        deletePublisherDraft(storage, '42:date');
        expect(loadPublisherDraft(storage, '42:date')).toBeNull();
    });

    it('round-trips independently sized document pages', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.pages = [
            {
                id: 'page-full-hd',
                width: 1920,
                height: 1080,
                templateId: 'split',
                layouts: draft.layouts,
                imageFocus: createImageFocusByTemplate(),
            },
            {
                id: 'page-square',
                width: 600,
                height: 600,
                templateId: 'poster',
                layouts: {},
                imageFocus: createImageFocusByTemplate(),
            },
            {
                id: 'page-banner',
                width: 1920,
                height: 300,
                templateId: 'split',
                layouts: {},
                imageFocus: createImageFocusByTemplate(),
            },
        ];
        draft.activePageId = 'page-square';

        savePublisherDraft(storage, '42:pages', draft);
        expect(loadPublisherDraft(storage, '42:pages')?.pages).toEqual(draft.pages);
        expect(loadPublisherDraft(storage, '42:pages')?.activePageId).toBe('page-square');
    });

    it('migrates visual layers on older custom-sized pages using the page dimensions', () => {
        const storage = createStorage();
        const draft = createDraft();
        const layout = structuredClone(draft.layouts.split!);
        for (const elementId of ['background', 'image', 'accent'] as const) {
            delete (layout.offsets as Partial<typeof layout.offsets>)[elementId];
            delete (layout.sizes as Partial<typeof layout.sizes>)[elementId];
            delete (layout.rotations as Partial<typeof layout.rotations>)[elementId];
        }
        layout.order = ['title', 'dateTime', 'location'];
        delete (layout as Partial<typeof layout>).visualStyles;
        storage.setItem('churchtools-publisher:draft:visual-layers-legacy', JSON.stringify({
            ...draft,
            pages: [{
                id: 'page-square',
                width: 600,
                height: 600,
                templateId: 'split',
                layouts: { split: layout },
                imageFocus: createImageFocusByTemplate(),
            }],
            activePageId: 'page-square',
        }));

        const restored = loadPublisherDraft(storage, 'visual-layers-legacy')?.pages?.[0]?.layouts.split;
        expect(restored?.sizes.background).toEqual({ width: 600, height: 600 });
        expect(restored?.sizes.image).toEqual({ width: 287.5, height: 600 });
        expect(restored?.visualStyles).toEqual(createLayoutVisualStyles('split'));
    });

    it('rejects malformed and unsupported drafts', () => {
        const storage = createStorage();
        storage.setItem('churchtools-publisher:draft:broken', '{invalid');
        expect(loadPublisherDraft(storage, 'broken')).toBeNull();
        storage.setItem('churchtools-publisher:draft:old', JSON.stringify({ ...createDraft(), version: 2 }));
        expect(loadPublisherDraft(storage, 'old')).toBeNull();
        storage.setItem('churchtools-publisher:draft:zoom', JSON.stringify({ ...createDraft(), previewZoomPercent: 999 }));
        expect(loadPublisherDraft(storage, 'zoom')).toBeNull();
        storage.setItem('churchtools-publisher:draft:focus', JSON.stringify({
            ...createDraft(),
            imageFocus: { ...createImageFocusByTemplate(), split: { x: 101, y: 50, zoom: 100 } },
        }));
        expect(loadPublisherDraft(storage, 'focus')).toBeNull();
    });

    it('loads older drafts without image focus using centered defaults', () => {
        const storage = createStorage();
        const draft = createDraft();
        const { imageFocus: _, ...legacyDraft } = draft;
        storage.setItem('churchtools-publisher:draft:legacy', JSON.stringify(legacyDraft));

        expect(loadPublisherDraft(storage, 'legacy')?.imageFocus).toEqual(createImageFocusByTemplate());
    });

    it('loads previous focus values without zoom at 100 percent', () => {
        const storage = createStorage();
        const draft = createDraft();
        storage.setItem('churchtools-publisher:draft:focus-legacy', JSON.stringify({
            ...draft,
            imageFocus: {
                split: { x: 20, y: 80 },
                poster: { x: 50, y: 50 },
            },
        }));

        expect(loadPublisherDraft(storage, 'focus-legacy')?.imageFocus).toEqual({
            split: { x: 20, y: 80, zoom: 100 },
            poster: { x: 50, y: 50, zoom: 100 },
        });
    });

    it('migrates older layout drafts to the template text styles', () => {
        const storage = createStorage();
        const draft = createDraft();
        const splitLayout = draft.layouts.split;
        expect(splitLayout).toBeDefined();
        const { styles: _, ...legacyLayout } = splitLayout!;
        storage.setItem('churchtools-publisher:draft:layout-legacy', JSON.stringify({
            ...draft,
            layouts: { split: legacyLayout },
        }));

        expect(loadPublisherDraft(storage, 'layout-legacy')?.layouts.split?.styles)
            .toEqual(createLayoutTextStyles('split'));
    });

    it('persists deleted layers and migrates layouts without deletion metadata', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.layouts.split!.deleted = ['location'];
        draft.layouts.split!.order = draft.layouts.split!.order.filter((elementId) => elementId !== 'location');
        savePublisherDraft(storage, 'deleted-layer', draft);
        expect(loadPublisherDraft(storage, 'deleted-layer')?.layouts.split?.deleted).toEqual(['location']);

        const { deleted: _, ...legacyLayout } = createDraft().layouts.split!;
        storage.setItem('churchtools-publisher:draft:deleted-legacy', JSON.stringify({
            ...createDraft(),
            layouts: { split: legacyLayout },
        }));
        expect(loadPublisherDraft(storage, 'deleted-legacy')?.layouts.split?.deleted).toEqual([]);
    });

    it('loads legacy layouts without groups and preserves nested groups', () => {
        const storage = createStorage();
        const draft = createDraft();
        const splitLayout = draft.layouts.split!;
        const { groups: _, ...legacyLayout } = splitLayout;
        storage.setItem('churchtools-publisher:draft:groups-legacy', JSON.stringify({
            ...draft,
            layouts: { split: legacyLayout },
        }));
        expect(loadPublisherDraft(storage, 'groups-legacy')?.layouts.split?.groups).toEqual([]);

        splitLayout.groups = [{
            id: 'outer',
            children: [{ id: 'inner', children: ['title', 'dateTime'] }, 'location'],
        }];
        savePublisherDraft(storage, 'groups-nested', draft);
        expect(loadPublisherDraft(storage, 'groups-nested')?.layouts.split?.groups).toEqual(splitLayout.groups);
    });

    it('rejects invalid persisted text styles', () => {
        const storage = createStorage();
        const draft = createDraft();
        const splitLayout = draft.layouts.split!;
        storage.setItem('churchtools-publisher:draft:invalid-style', JSON.stringify({
            ...draft,
            layouts: {
                split: {
                    ...splitLayout,
                    styles: {
                        ...splitLayout.styles,
                        title: { fontSize: 500, color: 'white' },
                    },
                },
            },
        }));

        expect(loadPublisherDraft(storage, 'invalid-style')).toBeNull();
    });

    it('rejects overlapping or malformed persisted groups', () => {
        const storage = createStorage();
        const draft = createDraft();
        const splitLayout = draft.layouts.split!;
        storage.setItem('churchtools-publisher:draft:invalid-groups', JSON.stringify({
            ...draft,
            layouts: {
                split: {
                    ...splitLayout,
                    groups: [
                        { id: 'first', children: ['title', 'dateTime'] },
                        { id: 'second', children: ['title', 'location'] },
                    ],
                },
            },
        }));

        expect(loadPublisherDraft(storage, 'invalid-groups')).toBeNull();
    });

    it('finds only valid drafts among the supplied appointment keys', () => {
        const storage = createStorage();
        savePublisherDraft(storage, '42:first', createDraft());
        storage.setItem('churchtools-publisher:draft:42:broken', '{invalid');

        expect(findPublisherDraftAppointmentKeys(storage, [
            '42:first',
            '42:broken',
            '42:missing',
        ])).toEqual(new Set(['42:first']));
    });
});
