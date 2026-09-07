import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
    cloneLayoutState,
    commitLayoutHistory,
    createLayoutHistory,
    redoLayoutHistory,
    undoLayoutHistory,
    type LayoutHistory,
    type SerializableLayoutState,
} from '../domain/layoutHistory';
import {
    clonePublisherPage,
    createBlankPublisherPage,
    createStandardPublisherLayout,
    type PublisherPage,
} from '../domain/publisherPage';
import type { TemplateId } from '../domain/templates';
import { createImageFocusByTemplate } from '../domain/imageFocus';

const historyKey = (pageId: string, templateId: TemplateId) => `${pageId}:${templateId}`;

export const usePublisherDocumentStore = defineStore('publisherDocument', () => {
    const initialPage = createBlankPublisherPage();
    const pages = ref<PublisherPage[]>([initialPage]);
    const activePageId = ref(initialPage.id);
    const revision = ref(0);
    const histories = ref<Record<string, LayoutHistory>>({});
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

    const pageById = (pageId: string) => pages.value.find(({ id }) => id === pageId);

    const ensurePageLayout = (
        pageId: string,
        templateId: TemplateId,
        create: () => SerializableLayoutState,
    ) => {
        const page = pageById(pageId);
        if (!page) throw new Error(`Unbekannte Publisher-Seite: ${pageId}`);
        const existing = page.layouts[templateId];
        if (existing) return existing;
        const layout = cloneLayoutState(create());
        page.layouts = { ...page.layouts, [templateId]: layout };
        revision.value += 1;
        return layout;
    };

    const replacePageLayout = (pageId: string, templateId: TemplateId, layout: SerializableLayoutState) => {
        const page = pageById(pageId);
        if (!page) return false;
        page.layouts = { ...page.layouts, [templateId]: cloneLayoutState(layout) };
        revision.value += 1;
        return true;
    };

    const replacePageLayoutSection = <Key extends keyof SerializableLayoutState>(
        pageId: string,
        templateId: TemplateId,
        key: Key,
        value: SerializableLayoutState[Key],
    ) => {
        const layout = pageById(pageId)?.layouts[templateId];
        if (!layout) return false;
        layout[key] = value;
        revision.value += 1;
        return true;
    };

    const getPageLayoutHistory = (pageId: string, templateId: TemplateId) =>
        histories.value[historyKey(pageId, templateId)] ?? createLayoutHistory();

    const replacePageLayoutHistory = (pageId: string, templateId: TemplateId, history: LayoutHistory) => {
        histories.value = { ...histories.value, [historyKey(pageId, templateId)]: history };
    };

    const resetPageLayoutHistory = (pageId: string, templateId?: TemplateId) => {
        const prefix = `${pageId}:`;
        histories.value = Object.fromEntries(Object.entries(histories.value).filter(([key]) =>
            templateId ? key !== historyKey(pageId, templateId) : !key.startsWith(prefix)));
    };

    const commitPageLayout = (
        pageId: string,
        templateId: TemplateId,
        previousState: SerializableLayoutState,
        currentState: SerializableLayoutState,
    ) => {
        const history = commitLayoutHistory(getPageLayoutHistory(pageId, templateId), previousState, currentState);
        replacePageLayoutHistory(pageId, templateId, history);
        replacePageLayout(pageId, templateId, currentState);
        return history;
    };

    const undoPageLayout = (pageId: string, templateId: TemplateId) => {
        const current = pageById(pageId)?.layouts[templateId];
        if (!current) return null;
        const result = undoLayoutHistory(getPageLayoutHistory(pageId, templateId), current);
        if (!result) return null;
        replacePageLayoutHistory(pageId, templateId, result.history);
        replacePageLayout(pageId, templateId, result.state);
        return result;
    };

    const redoPageLayout = (pageId: string, templateId: TemplateId) => {
        const current = pageById(pageId)?.layouts[templateId];
        if (!current) return null;
        const result = redoLayoutHistory(getPageLayoutHistory(pageId, templateId), current);
        if (!result) return null;
        replacePageLayoutHistory(pageId, templateId, result.history);
        replacePageLayout(pageId, templateId, result.state);
        return result;
    };

    const addPage = (width: number, height: number, templateId: TemplateId) => {
        const page = createBlankPublisherPage(width, height, templateId);
        pages.value = [...pages.value, page];
        activePageId.value = page.id;
        revision.value += 1;
        return page;
    };

    const removePage = (pageId: string) => {
        if (pages.value.length <= 1) return false;
        const pageIndex = pages.value.findIndex(({ id }) => id === pageId);
        if (pageIndex < 0) return false;
        pages.value = pages.value.filter(({ id }) => id !== pageId);
        resetPageLayoutHistory(pageId);
        if (activePageId.value === pageId) {
            activePageId.value = pages.value[Math.max(0, pageIndex - 1)]!.id;
        }
        revision.value += 1;
        return true;
    };

    const replaceActivePageTemplate = (templateId: TemplateId) => {
        const page = activePage.value;
        page.templateId = templateId;
        page.layouts = { [templateId]: createStandardPublisherLayout(templateId, page.width, page.height) };
        page.imageFocus = createImageFocusByTemplate();
        resetPageLayoutHistory(page.id);
        revision.value += 1;
    };

    const replacePages = (nextPages: PublisherPage[], nextActivePageId?: string) => {
        if (nextPages.length === 0) return false;
        pages.value = nextPages.map((page) => clonePublisherPage(page));
        activePageId.value = pages.value.some(({ id }) => id === nextActivePageId)
            ? nextActivePageId!
            : pages.value[0]!.id;
        histories.value = {};
        revision.value += 1;
        return true;
    };

    return {
        activePage,
        activePageId,
        activatePage,
        addPage,
        commitPageLayout,
        draftLayouts,
        ensurePageLayout,
        getPageLayoutHistory,
        histories,
        imageFocusByTemplate,
        pageById,
        pages,
        redoPageLayout,
        removePage,
        replaceActivePageTemplate,
        replacePageLayout,
        replacePageLayoutHistory,
        replacePageLayoutSection,
        replacePages,
        resetPageLayoutHistory,
        revision,
        selectedTemplateId,
        undoPageLayout,
    };
});
