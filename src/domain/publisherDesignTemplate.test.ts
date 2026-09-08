import { describe, expect, it } from 'vitest';

import {
    createLayoutGroups,
    createLayoutOffsets,
    createLayoutOrder,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
} from './layoutEditing';
import type { SerializableLayoutState } from './layoutHistory';
import { createBlankPublisherPage } from './publisherPage';
import type { PublisherDesignTemplate } from './publisherDesignTemplate';
import {
    deletePublisherDesignTemplate,
    loadPublisherDesignTemplates,
    parsePublisherDesignTemplateLibrary,
    PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY,
    savePublisherDesignTemplate,
} from './publisherDesignTemplate';

const createStorage = () => {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    };
};

const createLayout = (): SerializableLayoutState => ({
    offsets: createLayoutOffsets(),
    sizes: createLayoutSizes('split'),
    rotations: createLayoutRotations(),
    order: createLayoutOrder(),
    styles: createLayoutTextStyles('split'),
    visualStyles: createLayoutVisualStyles('split'),
    groups: createLayoutGroups(),
    deleted: [],
});

const createTemplate = (id = 'template-1'): PublisherDesignTemplate => ({
    id,
    name: 'Sonntagsfolie',
    pages: [
        {
            id: 'page-1', name: 'Titel', width: 1920, height: 1080, templateId: 'split',
            layouts: { split: createLayout() },
            imageFocus: {
                split: { x: 35, y: 65, zoom: 125 },
                poster: { x: 50, y: 50, zoom: 100 },
            },
        },
        {
            id: 'page-2', name: 'Quadrat', width: 600, height: 600, templateId: 'split',
            layouts: { split: createLayout() },
            imageFocus: {
                split: { x: 50, y: 50, zoom: 100 },
                poster: { x: 50, y: 50, zoom: 100 },
            },
        },
    ],
    activePageId: 'page-2',
    createdAt: '2026-09-03T18:00:00.000Z',
    updatedAt: '2026-09-03T18:00:00.000Z',
});

describe('publisher design templates', () => {
    it('round-trips, updates and deletes reusable design templates', () => {
        const storage = createStorage();
        const template = createTemplate();

        expect(savePublisherDesignTemplate(storage, template)).toEqual([template]);
        expect(loadPublisherDesignTemplates(storage)).toEqual([template]);

        const updated = { ...template, name: 'Aktualisierte Vorlage', updatedAt: '2026-09-03T19:00:00.000Z' };
        expect(savePublisherDesignTemplate(storage, updated)).toEqual([updated]);
        expect(deletePublisherDesignTemplate(storage, template.id)).toEqual([]);
    });

    it('rejects malformed containers and isolates malformed or duplicate entries', () => {
        const template = createTemplate();
        expect(parsePublisherDesignTemplateLibrary('{invalid')).toBeNull();
        expect(parsePublisherDesignTemplateLibrary(JSON.stringify({ version: 3, templates: [] }))).toBeNull();
        expect(parsePublisherDesignTemplateLibrary(JSON.stringify({ version: 2, templates: [template, template] })))
            .toEqual([template]);
        expect(parsePublisherDesignTemplateLibrary(JSON.stringify({
            version: 2,
            templates: [
                template,
                { ...createTemplate('invalid'), pages: [{ ...template.pages[0], width: 1 }] },
            ],
        }))).toEqual([template]);
    });

    it('stores only design data and no appointment content', () => {
        const storage = createStorage();
        savePublisherDesignTemplate(storage, createTemplate());
        const persisted = storage.getItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY) ?? '';

        expect(persisted).not.toContain('templateOverrides');
        expect(persisted).not.toContain('replacementImage');
        expect(persisted).toContain('"pages"');
        expect(persisted).toContain('"activePageId"');
    });

    it('accepts a document made entirely from differently sized blank pages', () => {
        const storage = createStorage();
        const first = createBlankPublisherPage(1920, 1080);
        const second = createBlankPublisherPage(600, 600);
        const template: PublisherDesignTemplate = {
            id: 'blank-pages',
            name: 'Leere Seiten',
            pages: [first, second],
            activePageId: second.id,
            createdAt: '2026-09-07T12:00:00.000Z',
            updatedAt: '2026-09-07T12:00:00.000Z',
        };

        expect(savePublisherDesignTemplate(storage, template)).toEqual([template]);
    });

    it('migrates version-one single-page templates and their legacy deleted order', () => {
        const storage = createStorage();
        const layout = createLayout();
        layout.deleted = ['background', 'image'];
        const legacyTemplate = {
            id: 'legacy',
            name: 'Alte Vorlage',
            baseTemplateId: 'split',
            layout,
            imageFocus: { x: 35, y: 65, zoom: 125 },
            createdAt: '2026-09-03T18:00:00.000Z',
            updatedAt: '2026-09-03T18:00:00.000Z',
        };
        storage.setItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY, JSON.stringify({
            version: 1,
            templates: [legacyTemplate],
        }));

        const migrated = loadPublisherDesignTemplates(storage)?.[0];
        expect(migrated?.pages).toHaveLength(1);
        expect(migrated?.pages[0]?.layouts.split?.order)
            .toEqual(createLayoutOrder().filter((elementId) => !['background', 'image'].includes(elementId)));
        expect(savePublisherDesignTemplate(storage, { ...createTemplate('template-2'), name: 'Neue Vorlage' }))
            .toHaveLength(2);
        expect(storage.getItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY)).toContain('"version":2');
    });
});
