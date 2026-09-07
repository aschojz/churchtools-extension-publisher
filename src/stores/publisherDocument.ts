import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
    LAYOUT_ELEMENT_IDS,
    createLayoutGroups,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
} from '../domain/layoutEditing';
import type { SerializableLayoutState } from '../domain/layoutHistory';
import { createPublisherPage, type PublisherPage } from '../domain/publisherPage';
import type { TemplateId } from '../domain/templates';

const createBlankLayout = (templateId: TemplateId): SerializableLayoutState => ({
    offsets: createLayoutOffsets(),
    sizes: createLayoutSizes(templateId),
    rotations: createLayoutRotations(),
    order: [],
    styles: createLayoutTextStyles(templateId),
    visualStyles: createLayoutVisualStyles(templateId),
    groups: createLayoutGroups(),
    deleted: [...LAYOUT_ELEMENT_IDS],
    hidden: [],
    customElements: [],
});

const createBlankPage = () => {
    const page = createPublisherPage();
    page.layouts = { [page.templateId]: createBlankLayout(page.templateId) };
    return page;
};

export const usePublisherDocumentStore = defineStore('publisherDocument', () => {
    const initialPage = createBlankPage();
    const pages = ref<PublisherPage[]>([initialPage]);
    const activePageId = ref(initialPage.id);
    const activePage = computed(() => pages.value.find(({ id }) => id === activePageId.value) ?? pages.value[0]!);
    const selectedTemplateId = computed<TemplateId>({
        get: () => activePage.value.templateId,
        set: (templateId) => { activePage.value.templateId = templateId; },
    });
    const draftLayouts = computed<Partial<Record<TemplateId, SerializableLayoutState>>>({
        get: () => activePage.value.layouts,
        set: (layouts) => { activePage.value.layouts = layouts; },
    });
    const imageFocusByTemplate = computed({
        get: () => activePage.value.imageFocus,
        set: (imageFocus) => { activePage.value.imageFocus = imageFocus; },
    });

    const activatePage = (pageId: string) => {
        if (pages.value.some(({ id }) => id === pageId)) activePageId.value = pageId;
    };

    const addPage = (width: number, height: number, templateId: TemplateId) => {
        const page = createPublisherPage(width, height, templateId);
        page.layouts = { [templateId]: createBlankLayout(templateId) };
        pages.value = [...pages.value, page];
        activePageId.value = page.id;
        return page;
    };

    const replacePages = (nextPages: PublisherPage[], nextActivePageId?: string) => {
        pages.value = nextPages;
        activePageId.value = nextPages.some(({ id }) => id === nextActivePageId)
            ? nextActivePageId!
            : nextPages[0]!.id;
    };

    return {
        activePage,
        activePageId,
        activatePage,
        addPage,
        draftLayouts,
        imageFocusByTemplate,
        pages,
        replacePages,
        selectedTemplateId,
    };
});
