import type { ImageFocus } from './imageFocus';
import { createImageFocusByTemplate } from './imageFocus';
import type { SerializableLayoutState } from './layoutHistory';
import { cloneLayoutState } from './layoutHistory';
import {
    isPublisherRecord,
    parsePublisherImageFocus,
    parsePublisherLayoutState,
} from './publisherDraft';
import type { TemplateId } from './templates';

export const PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION = 1;
export const PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY = 'churchtools-publisher:design-templates';
export const MAX_PUBLISHER_DESIGN_TEMPLATES = 50;
export const MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH = 80;

export interface PublisherDesignTemplate {
    id: string;
    name: string;
    baseTemplateId: TemplateId;
    layout: SerializableLayoutState;
    imageFocus: ImageFocus;
    createdAt: string;
    updatedAt: string;
}

interface PublisherDesignTemplateLibrary {
    version: typeof PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION;
    templates: PublisherDesignTemplate[];
}

const isTemplateId = (value: unknown): value is TemplateId => value === 'split' || value === 'poster';

const parseDesignTemplate = (value: unknown): PublisherDesignTemplate | null => {
    if (!isPublisherRecord(value) || typeof value.id !== 'string' || !value.id ||
        typeof value.name !== 'string' || !value.name.trim() ||
        value.name.length > MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH ||
        !isTemplateId(value.baseTemplateId) || typeof value.createdAt !== 'string' ||
        typeof value.updatedAt !== 'string') {
        return null;
    }

    const layout = parsePublisherLayoutState(value.layout, value.baseTemplateId);
    const imageFocusByTemplate = parsePublisherImageFocus({
        ...createImageFocusByTemplate(),
        [value.baseTemplateId]: value.imageFocus,
    });
    if (!layout || !imageFocusByTemplate) {
        return null;
    }

    return {
        id: value.id,
        name: value.name.trim(),
        baseTemplateId: value.baseTemplateId,
        layout: cloneLayoutState(layout),
        imageFocus: { ...imageFocusByTemplate[value.baseTemplateId] },
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
};

export const parsePublisherDesignTemplateLibrary = (value: string | null): PublisherDesignTemplate[] | null => {
    if (!value) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (!isPublisherRecord(parsed) || parsed.version !== PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION ||
            !Array.isArray(parsed.templates) || parsed.templates.length > MAX_PUBLISHER_DESIGN_TEMPLATES) {
            return null;
        }

        const templates: PublisherDesignTemplate[] = [];
        const ids = new Set<string>();
        for (const candidate of parsed.templates) {
            const template = parseDesignTemplate(candidate);
            if (!template || ids.has(template.id)) {
                return null;
            }
            ids.add(template.id);
            templates.push(template);
        }
        return templates;
    } catch {
        return null;
    }
};

export const loadPublisherDesignTemplates = (storage: Pick<Storage, 'getItem'>) =>
    parsePublisherDesignTemplateLibrary(storage.getItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY));

const writeTemplateLibrary = (
    storage: Pick<Storage, 'setItem'>,
    templates: PublisherDesignTemplate[],
) => {
    const library: PublisherDesignTemplateLibrary = {
        version: PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION,
        templates,
    };
    storage.setItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY, JSON.stringify(library));
};

export const savePublisherDesignTemplate = (
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    template: PublisherDesignTemplate,
) => {
    const parsedTemplate = parseDesignTemplate(template);
    const templates = loadPublisherDesignTemplates(storage);
    if (!parsedTemplate) {
        throw new Error('Das aktuelle Layout enthält ungültige Vorlagendaten.');
    }
    if (!templates) {
        throw new Error('Die gespeicherte Vorlagenbibliothek ist ungültig.');
    }

    const nextTemplates = [
        parsedTemplate,
        ...templates.filter(({ id }) => id !== parsedTemplate.id),
    ].slice(0, MAX_PUBLISHER_DESIGN_TEMPLATES);
    writeTemplateLibrary(storage, nextTemplates);
    return nextTemplates;
};

export const deletePublisherDesignTemplate = (
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    templateId: string,
) => {
    const templates = loadPublisherDesignTemplates(storage);
    if (!templates) {
        throw new Error('Die Vorlagenbibliothek ist ungültig.');
    }
    const nextTemplates = templates.filter(({ id }) => id !== templateId);
    writeTemplateLibrary(storage, nextTemplates);
    return nextTemplates;
};
