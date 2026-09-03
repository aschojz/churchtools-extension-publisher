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

const createTemplate = (id = 'template-1'): PublisherDesignTemplate => ({
    id,
    name: 'Sonntagsfolie',
    baseTemplateId: 'split',
    layout: {
        offsets: createLayoutOffsets(),
        sizes: createLayoutSizes('split'),
        rotations: createLayoutRotations(),
        order: createLayoutOrder(),
        styles: createLayoutTextStyles('split'),
        visualStyles: createLayoutVisualStyles('split'),
        groups: createLayoutGroups(),
        deleted: [],
    },
    imageFocus: { x: 35, y: 65, zoom: 125 },
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

    it('rejects malformed libraries, duplicate ids and invalid layout state', () => {
        const template = createTemplate();
        expect(parsePublisherDesignTemplateLibrary('{invalid')).toBeNull();
        expect(parsePublisherDesignTemplateLibrary(JSON.stringify({ version: 2, templates: [] }))).toBeNull();
        expect(parsePublisherDesignTemplateLibrary(JSON.stringify({ version: 1, templates: [template, template] }))).toBeNull();
        expect(parsePublisherDesignTemplateLibrary(JSON.stringify({
            version: 1,
            templates: [{ ...template, layout: { ...template.layout, order: ['title'] } }],
        }))).toBeNull();
    });

    it('stores only design data and no appointment content', () => {
        const storage = createStorage();
        savePublisherDesignTemplate(storage, createTemplate());
        const persisted = storage.getItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY) ?? '';

        expect(persisted).not.toContain('templateOverrides');
        expect(persisted).not.toContain('replacementImage');
        expect(persisted).toContain('baseTemplateId');
        expect(persisted).toContain('layout');
    });
});
