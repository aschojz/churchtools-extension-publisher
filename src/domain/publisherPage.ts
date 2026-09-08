import { createImageFocusByTemplate } from './imageFocus';
import {
    LAYOUT_ELEMENT_IDS,
    constrainFontSize,
    createLayoutGroups,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
} from './layoutEditing';
import type { SerializableLayoutState } from './layoutHistory';
import { cloneLayoutState } from './layoutHistory';
import type { TemplateId } from './templates';
import { BUILT_IN_TEMPLATE_DEFINITIONS, scaleTemplateDefinition, TEMPLATE_TEXT_BINDINGS } from './templateDefinition';

export const MAX_PUBLISHER_PAGE_NAME_LENGTH = 80;

export interface PublisherPage {
    id: string;
    name: string;
    width: number;
    height: number;
    templateId: TemplateId;
    layouts: Partial<Record<TemplateId, SerializableLayoutState>>;
    imageFocus: ReturnType<typeof createImageFocusByTemplate>;
}

export const createStandardPublisherLayout = (
    templateId: TemplateId,
    width = 1920,
    height = 1080,
): SerializableLayoutState => {
    const definition = scaleTemplateDefinition(BUILT_IN_TEMPLATE_DEFINITIONS[templateId], width, height);
    const sizes = createLayoutSizes(templateId);
    const frames = {
        background: definition.composition.decorations.find(({ id }) => id === 'background')!.frame,
        image: definition.composition.imageFrame,
        accent: definition.composition.decorations.find(({ id }) => id === 'accent')!.frame,
        title: definition.elements.title.frame,
        dateTime: definition.elements.dateTime.frame,
        location: definition.elements.location.frame,
    };
    for (const elementId of LAYOUT_ELEMENT_IDS) {
        sizes[elementId] = { width: frames[elementId].width, height: frames[elementId].height };
    }
    const styles = createLayoutTextStyles(templateId);
    for (const elementId of TEMPLATE_TEXT_BINDINGS) {
        styles[elementId] = {
            ...styles[elementId],
            fontSize: constrainFontSize(definition.elements[elementId].style.fontSize),
        };
    }
    return {
        offsets: createLayoutOffsets(),
        sizes,
        rotations: createLayoutRotations(),
        order: [...LAYOUT_ELEMENT_IDS],
        styles,
        visualStyles: createLayoutVisualStyles(templateId),
        groups: createLayoutGroups(),
        deleted: [],
        hidden: [],
        locked: [],
        customElements: [],
        effects: {},
    };
};

export const createBlankPublisherLayout = (
    templateId: TemplateId,
    width = 1920,
    height = 1080,
): SerializableLayoutState => ({
    ...createStandardPublisherLayout(templateId, width, height),
    order: [],
    deleted: [...LAYOUT_ELEMENT_IDS],
});

export const createPublisherPageId = () => typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const createPublisherPage = (
    width = 1920,
    height = 1080,
    templateId: TemplateId = 'split',
    name = 'Seite 1',
): PublisherPage => ({
    id: createPublisherPageId(),
    name,
    width,
    height,
    templateId,
    layouts: {},
    imageFocus: createImageFocusByTemplate(),
});

export const createBlankPublisherPage = (
    width = 1920,
    height = 1080,
    templateId: TemplateId = 'split',
    name = 'Seite 1',
) => {
    const page = createPublisherPage(width, height, templateId, name);
    page.layouts = { [templateId]: createBlankPublisherLayout(templateId, width, height) };
    return page;
};

export const clonePublisherPage = (page: PublisherPage, regenerateId = false): PublisherPage => ({
    id: regenerateId ? createPublisherPageId() : page.id,
    name: page.name,
    width: page.width,
    height: page.height,
    templateId: page.templateId,
    layouts: Object.fromEntries(Object.entries(page.layouts).map(([templateId, layout]) => [
        templateId,
        layout ? cloneLayoutState(layout) : layout,
    ])),
    imageFocus: {
        split: { ...page.imageFocus.split },
        poster: { ...page.imageFocus.poster },
    },
});

export const pageShowsTemplateDecorations = (page: PublisherPage) => {
    const layout = page.layouts[page.templateId];
    return !layout || !LAYOUT_ELEMENT_IDS.every((elementId) => layout.deleted.includes(elementId));
};
