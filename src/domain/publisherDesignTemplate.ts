import { createImageFocusByTemplate } from './imageFocus';
import { clonePublisherPage, MAX_PUBLISHER_PAGE_NAME_LENGTH, type PublisherPage } from './publisherPage';
import {
    isPublisherFiniteNumber,
    isPublisherRecord,
    parsePublisherImageFocus,
    parsePublisherLayoutState,
} from './publisherDraft';
import type { TemplateId } from './templates';

export const PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION = 4;
export const PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY = 'churchtools-publisher:design-templates';
export const MAX_PUBLISHER_DESIGN_TEMPLATES = 50;
export const MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH = 80;
export const MAX_PUBLISHER_DESIGN_TEMPLATE_PAGES = 50;

export interface PublisherDesignTemplate {
    id: string;
    name: string;
    pages: PublisherPage[];
    activePageId: string;
    createdAt: string;
    updatedAt: string;
}

interface PublisherDesignTemplateLibrary {
    version: typeof PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION;
    templates: PublisherDesignTemplate[];
}

const isTemplateId = (value: unknown): value is TemplateId => value === 'split' || value === 'poster';

const parseTemplateMetadata = (value: Record<string, unknown>) => {
    if (typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() ||
        value.name.length > MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH || typeof value.createdAt !== 'string' ||
        typeof value.updatedAt !== 'string') return null;
    return {
        id: value.id,
        name: value.name.trim(),
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
};

const parseTemplatePage = (value: unknown, pageIndex: number): PublisherPage | null => {
    if (!isPublisherRecord(value) || typeof value.id !== 'string' || !value.id ||
        (value.name !== undefined && (typeof value.name !== 'string' || !value.name.trim() || value.name.length > MAX_PUBLISHER_PAGE_NAME_LENGTH)) ||
        !isPublisherFiniteNumber(value.width) || !isPublisherFiniteNumber(value.height) ||
        value.width < 64 || value.height < 64 || value.width > 8192 || value.height > 8192 ||
        !isTemplateId(value.templateId) || !isPublisherRecord(value.layouts)) return null;
    const imageFocus = parsePublisherImageFocus(value.imageFocus);
    if (!imageFocus) return null;
    const layouts: PublisherPage['layouts'] = {};
    for (const templateId of ['split', 'poster'] as const) {
        const candidate = value.layouts[templateId];
        const layout = candidate === undefined
            ? undefined
            : parsePublisherLayoutState(candidate, templateId, value.width, value.height);
        if (candidate !== undefined && !layout) return null;
        if (layout) layouts[templateId] = layout;
    }
    return {
        id: value.id,
        name: typeof value.name === 'string' ? value.name.trim() : `Seite ${pageIndex + 1}`,
        width: Math.round(value.width),
        height: Math.round(value.height),
        templateId: value.templateId,
        layouts,
        imageFocus,
    };
};

export const parsePublisherDesignTemplate = (value: unknown): PublisherDesignTemplate | null => {
    if (!isPublisherRecord(value)) return null;
    const metadata = parseTemplateMetadata(value);
    if (!metadata || !Array.isArray(value.pages) || value.pages.length === 0 ||
        value.pages.length > MAX_PUBLISHER_DESIGN_TEMPLATE_PAGES || typeof value.activePageId !== 'string') return null;
    const pages: PublisherPage[] = [];
    const pageIds = new Set<string>();
    for (const [pageIndex, candidate] of value.pages.entries()) {
        const page = parseTemplatePage(candidate, pageIndex);
        if (!page || pageIds.has(page.id)) return null;
        pageIds.add(page.id);
        pages.push(page);
    }
    if (!pageIds.has(value.activePageId)) return null;
    return { ...metadata, pages: pages.map((page) => clonePublisherPage(page)), activePageId: value.activePageId };
};

const parseLegacyDesignTemplate = (value: unknown): PublisherDesignTemplate | null => {
    if (!isPublisherRecord(value)) return null;
    const metadata = parseTemplateMetadata(value);
    if (!metadata || !isTemplateId(value.baseTemplateId)) return null;
    const layout = parsePublisherLayoutState(value.layout, value.baseTemplateId);
    const focus = parsePublisherImageFocus({
        ...createImageFocusByTemplate(),
        [value.baseTemplateId]: value.imageFocus,
    });
    if (!layout || !focus) return null;
    const pageId = `template-${metadata.id}-page-1`;
    return {
        ...metadata,
        pages: [{
            id: pageId,
            name: 'Seite 1',
            width: 1920,
            height: 1080,
            templateId: value.baseTemplateId,
            layouts: { [value.baseTemplateId]: layout },
            imageFocus: focus,
        }],
        activePageId: pageId,
    };
};

export const parsePublisherDesignTemplateLibrary = (value: string | null): PublisherDesignTemplate[] | null => {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!isPublisherRecord(parsed) ||
            ![1, 2, 3, PUBLISHER_DESIGN_TEMPLATE_LIBRARY_VERSION].includes(Number(parsed.version)) ||
            !Array.isArray(parsed.templates) || parsed.templates.length > MAX_PUBLISHER_DESIGN_TEMPLATES) return null;
        const parseEntry = parsed.version === 1 ? parseLegacyDesignTemplate : parsePublisherDesignTemplate;
        const templates: PublisherDesignTemplate[] = [];
        const ids = new Set<string>();
        for (const candidate of parsed.templates) {
            const template = parseEntry(candidate);
            if (!template || ids.has(template.id)) continue;
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
        templates: templates.map((template) => ({
            ...template,
            pages: template.pages.map((page) => clonePublisherPage(page)),
        })),
    };
    storage.setItem(PUBLISHER_DESIGN_TEMPLATE_STORAGE_KEY, JSON.stringify(library));
};

export const savePublisherDesignTemplate = (
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    template: PublisherDesignTemplate,
) => {
    const parsedTemplate = parsePublisherDesignTemplate(template);
    const templates = loadPublisherDesignTemplates(storage);
    if (!parsedTemplate) throw new Error('Das aktuelle Dokument enthält ungültige Vorlagendaten.');
    if (!templates) throw new Error('Die gespeicherte Vorlagenbibliothek ist ungültig.');
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
    if (!templates) throw new Error('Die Vorlagenbibliothek ist ungültig.');
    const nextTemplates = templates.filter(({ id }) => id !== templateId);
    writeTemplateLibrary(storage, nextTemplates);
    return nextTemplates;
};
