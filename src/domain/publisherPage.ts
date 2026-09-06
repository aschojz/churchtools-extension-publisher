import { createImageFocusByTemplate } from './imageFocus';
import { LAYOUT_ELEMENT_IDS } from './layoutEditing';
import type { SerializableLayoutState } from './layoutHistory';
import type { TemplateId } from './templates';

export interface PublisherPage {
    id: string;
    width: number;
    height: number;
    templateId: TemplateId;
    layouts: Partial<Record<TemplateId, SerializableLayoutState>>;
    imageFocus: ReturnType<typeof createImageFocusByTemplate>;
}

export const createPublisherPage = (
    width = 1920,
    height = 1080,
    templateId: TemplateId = 'split',
): PublisherPage => ({
    id: typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    width,
    height,
    templateId,
    layouts: {},
    imageFocus: createImageFocusByTemplate(),
});

export const pageShowsTemplateDecorations = (page: PublisherPage) => {
    const layout = page.layouts[page.templateId];
    return !layout || !LAYOUT_ELEMENT_IDS.every((elementId) => layout.deleted.includes(elementId));
};
