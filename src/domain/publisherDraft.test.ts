import { describe, expect, it } from 'vitest';

import {
    createLayoutOffsets,
    createLayoutOrder,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
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
