import { describe, expect, it } from 'vitest';

import {
    createLayoutOffsets,
    createCustomTextStyle,
    createLayoutCustomElement,
    createLayoutOrder,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
} from './layoutEditing';
import { createImageFocusByTemplate } from './imageFocus';
import { createLayoutElementEffects } from './layoutEditing';
import { createLayoutGradient } from './layoutGradient';
import { createLayoutFilterStack } from './layoutFilters';
import {
    deletePublisherDraft,
    findPublisherDraftAppointmentKeys,
    loadPublisherDraft,
    PUBLISHER_DRAFT_VERSION,
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
    version: PUBLISHER_DRAFT_VERSION,
    selectedTemplateId: 'poster',
    templateOverrides: { title: 'Lokaler Titel', subtitle: 'Dynamischer Untertitel' },
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
            filters: {},
        },
    },
    imageFocus: { ...createImageFocusByTemplate(), split: { x: 20, y: 80, zoom: 175 } },
    snapEnabled: false,
    previewZoomPercent: 150,
    updatedAt: '2026-08-02T12:00:00.000Z',
});

describe('publisher draft', () => {
    it('round-trips dynamically added layout elements', () => {
        const storage = createStorage();
        const draft = createDraft();
        const element = createLayoutCustomElement('text', { width: 1920, height: 1080 }, {
            name: 'Titel', text: '{{title}}', dataBinding: 'title',
        });
        const layout = draft.layouts.split!;
        layout.customElements = [element];
        layout.offsets[element.id] = { x: 0, y: 0 };
        layout.sizes[element.id] = { width: element.frame.width, height: element.frame.height };
        layout.rotations[element.id] = 0;
        layout.order.push(element.id);
        layout.styles[element.id] = createCustomTextStyle();

        savePublisherDraft(storage, '42:custom', draft);

        expect(loadPublisherDraft(storage, '42:custom')?.layouts.split?.customElements).toEqual([element]);
        expect(loadPublisherDraft(storage, '42:custom')?.layouts.split?.order).toContain(element.id);
    });

    it('round-trips dynamic image-color bindings with their fallback colors', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.layouts.split!.styles.title!.color = '#eeeeee';
        draft.layouts.split!.styles.title!.colorBinding = { imageId: 'data:image', token: 'foreground' };
        draft.layouts.split!.visualStyles.background!.fill = '#222222';
        draft.layouts.split!.visualStyles.background!.fillBinding = { imageId: 'data:image', token: 'background' };

        savePublisherDraft(storage, '42:palette', draft);
        const restored = loadPublisherDraft(storage, '42:palette')!;

        expect(restored.layouts.split?.styles.title).toMatchObject({
            color: '#eeeeee', colorBinding: { imageId: 'data:image', token: 'foreground' },
        });
        expect(restored.layouts.split?.visualStyles.background).toMatchObject({
            fill: '#222222', fillBinding: { imageId: 'data:image', token: 'background' },
        });
    });

    it('round-trips gradients, layer opacity, and locked layers', () => {
        const storage = createStorage();
        const draft = createDraft();
        const layout = draft.layouts.split!;
        layout.styles.title!.colorGradient = createLayoutGradient('#112233');
        layout.styles.title!.colorGradient.stops[0]!.colorBinding = { imageId: 'data:image', token: 'primary' };
        layout.visualStyles.background!.fillGradient = { ...createLayoutGradient('#445566'), type: 'radial' };
        const effects = createLayoutElementEffects();
        effects.opacity = 0.45;
        layout.effects = { title: effects };
        const filters = createLayoutFilterStack();
        filters.find(({ type }) => type === 'contrast')!.enabled = true;
        layout.filters = { title: filters };
        layout.locked = ['title'];

        savePublisherDraft(storage, '42:appearance', draft);
        const restored = loadPublisherDraft(storage, '42:appearance')!.layouts.split!;

        expect(restored.styles.title?.colorGradient?.stops[0].color).toBe('#112233');
        expect(restored.styles.title?.colorGradient?.stops[0].colorBinding).toEqual({ imageId: 'data:image', token: 'primary' });
        expect(restored.visualStyles.background?.fillGradient?.type).toBe('radial');
        expect(restored.effects?.title?.opacity).toBe(0.45);
        expect(restored.filters?.title?.find(({ type }) => type === 'contrast')).toMatchObject({
            enabled: true,
            amount: 20,
        });
        expect(restored.locked).toEqual(['title']);
    });

    it('migrates version-one drafts to the current schema with an empty filter map', () => {
        const storage = createStorage();
        const draft = createDraft();
        const legacyLayout = structuredClone(draft.layouts.split!);
        delete legacyLayout.filters;
        storage.setItem('churchtools-publisher:draft:version-one', JSON.stringify({
            ...draft,
            version: 1,
            layouts: { split: legacyLayout },
        }));

        const restored = loadPublisherDraft(storage, 'version-one');
        expect(restored?.version).toBe(PUBLISHER_DRAFT_VERSION);
        expect(restored?.layouts.split?.filters).toEqual({});
    });

    it('migrates version-two documents without inventing repeat bindings', () => {
        const storage = createStorage();
        const draft = createDraft();
        storage.setItem('churchtools-publisher:draft:version-two', JSON.stringify({ ...draft, version: 2 }));

        const restored = loadPublisherDraft(storage, 'version-two');

        expect(restored?.version).toBe(PUBLISHER_DRAFT_VERSION);
        expect(restored?.layouts.split?.groups).toEqual([]);
    });

    it('loads text from older drafts as frame text', () => {
        const storage = createStorage();
        const draft = createDraft();
        const element = createLayoutCustomElement('text', { width: 1920, height: 1080 });
        const { textMode: _, ...legacyElement } = element;
        const layout = draft.layouts.split!;
        layout.customElements = [legacyElement];
        layout.offsets[element.id] = { x: 0, y: 0 };
        layout.sizes[element.id] = { width: element.frame.width, height: element.frame.height };
        layout.rotations[element.id] = 0;
        layout.order.push(element.id);
        layout.styles[element.id] = createCustomTextStyle();
        storage.setItem('churchtools-publisher:draft:legacy-text', JSON.stringify(draft));

        expect(loadPublisherDraft(storage, 'legacy-text')?.layouts.split?.customElements?.[0].textMode).toBe('frame');
    });

    it('round-trips icon and QR-code elements with their configuration', () => {
        const storage = createStorage();
        const draft = createDraft();
        const icon = createLayoutCustomElement('icon', { width: 1920, height: 1080 }, { iconName: 'heart' });
        const qr = createLayoutCustomElement('qr', { width: 1920, height: 1080 }, {
            qrValue: '{{link}}', dataBinding: 'link',
        });
        const layout = draft.layouts.split!;
        layout.customElements = [icon, qr];
        for (const element of [icon, qr]) {
            layout.offsets[element.id] = { x: 0, y: 0 };
            layout.sizes[element.id] = { width: element.frame.width, height: element.frame.height };
            layout.rotations[element.id] = 0;
            layout.order.push(element.id);
            layout.visualStyles[element.id] = createLayoutVisualStyles('split').accent;
        }

        savePublisherDraft(storage, '42:visuals', draft);

        expect(loadPublisherDraft(storage, '42:visuals')?.layouts.split?.customElements).toEqual([icon, qr]);
    });

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
                name: 'Hauptfolie',
                width: 1920,
                height: 1080,
                templateId: 'split',
                layouts: draft.layouts,
                imageFocus: createImageFocusByTemplate(),
            },
            {
                id: 'page-square',
                name: 'Social Media',
                width: 600,
                height: 600,
                templateId: 'poster',
                layouts: {},
                imageFocus: createImageFocusByTemplate(),
            },
            {
                id: 'page-banner',
                name: 'Website-Banner',
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
        storage.setItem('churchtools-publisher:draft:old', JSON.stringify({ ...createDraft(), version: 99 }));
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

    it('removes legacy deleted layers from the restored layer order', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.layouts.split!.deleted = ['background', 'image'];

        storage.setItem('churchtools-publisher:draft:deleted-order-legacy', JSON.stringify(draft));

        expect(loadPublisherDraft(storage, 'deleted-order-legacy')?.layouts.split?.order)
            .toEqual(createLayoutOrder().filter((elementId) => !['background', 'image'].includes(elementId)));
    });

    it('persists non-destructively hidden layers and keeps legacy layouts visible', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.layouts.split!.hidden = ['title', 'accent'];
        savePublisherDraft(storage, 'hidden-layers', draft);
        expect(loadPublisherDraft(storage, 'hidden-layers')?.layouts.split?.hidden).toEqual(['title', 'accent']);

        const legacyDraft = createDraft();
        delete legacyDraft.layouts.split!.hidden;
        savePublisherDraft(storage, 'hidden-legacy', legacyDraft);
        expect(loadPublisherDraft(storage, 'hidden-legacy')?.layouts.split?.hidden).toBeUndefined();
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
            rotation: 30,
            autoLayout: {
                axis: 'vertical', gap: 8, horizontalOrigin: 'left', verticalOrigin: 'top',
                anchor: { x: 120, y: 80 },
            },
            repeat: { sourceFieldId: 'eventService-12', itemAlias: 'person', axis: 'vertical', gap: 12 },
        }];
        const groupEffects = createLayoutElementEffects();
        groupEffects.shadow.enabled = true;
        splitLayout.effects = { outer: groupEffects };
        const groupFilters = createLayoutFilterStack();
        groupFilters.find(({ type }) => type === 'grayscale')!.enabled = true;
        splitLayout.filters = { outer: groupFilters };
        savePublisherDraft(storage, 'groups-nested', draft);
        const restored = loadPublisherDraft(storage, 'groups-nested')?.layouts.split;
        expect(restored?.groups).toEqual(splitLayout.groups);
        expect(restored?.effects?.outer?.shadow.enabled).toBe(true);
        expect(restored?.filters?.outer?.find(({ type }) => type === 'grayscale')?.enabled).toBe(true);
    });

    it('rejects invalid group rotations instead of silently dropping them', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.layouts.split!.groups = [{ id: 'group', children: ['title', 'dateTime'], rotation: Number.NaN }];

        savePublisherDraft(storage, 'invalid-group-rotation', draft);

        expect(loadPublisherDraft(storage, 'invalid-group-rotation')).toBeNull();
    });

    it('rejects unsafe repeat bindings instead of silently changing them', () => {
        const storage = createStorage();
        const draft = createDraft();
        draft.layouts.split!.groups = [{
            id: 'group', children: ['title', 'dateTime'],
            repeat: { sourceFieldId: '../people', itemAlias: 'person', axis: 'vertical', gap: 8 },
        }];

        savePublisherDraft(storage, 'invalid-group-repeat', draft);

        expect(loadPublisherDraft(storage, 'invalid-group-repeat')).toBeNull();
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
