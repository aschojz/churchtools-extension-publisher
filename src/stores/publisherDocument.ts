import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { cloneLayoutState, type SerializableLayoutState } from '../domain/layoutHistory';
import {
    clonePublisherPage,
    createBlankPublisherPage,
    createStandardPublisherLayout,
    MAX_PUBLISHER_PAGE_NAME_LENGTH,
    type PublisherPage,
} from '../domain/publisherPage';
import {
    clonePublisherDocumentSnapshot,
    commitPublisherDocumentHistory,
    createPublisherDocumentHistory,
    redoPublisherDocumentHistory,
    undoPublisherDocumentHistory,
    type PublisherDocumentSnapshot,
} from '../domain/publisherDocumentHistory';
import type { TemplateId } from '../domain/templates';
import { createImageFocusByTemplate } from '../domain/imageFocus';

export const usePublisherDocumentStore = defineStore('publisherDocument', () => {
    const initialPage = createBlankPublisherPage();
    const pages = ref<PublisherPage[]>([initialPage]);
    const activePageId = ref(initialPage.id);
    const revision = ref(0);
    const documentHistory = ref(createPublisherDocumentHistory());
    const canUndoDocument = computed(() => documentHistory.value.past.length > 0);
    const canRedoDocument = computed(() => documentHistory.value.future.length > 0);
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

    const captureDocumentSnapshot = (): PublisherDocumentSnapshot => ({
        pages: pages.value.map((page) => clonePublisherPage(page)),
        activePageId: activePageId.value,
    });

    const applyDocumentSnapshot = (snapshot: PublisherDocumentSnapshot) => {
        const restored = clonePublisherDocumentSnapshot(snapshot);
        pages.value = restored.pages;
        activePageId.value = restored.pages.some(({ id }) => id === restored.activePageId)
            ? restored.activePageId
            : restored.pages[0]!.id;
        revision.value += 1;
    };

    const commitDocumentMutation = (previousSnapshot: PublisherDocumentSnapshot) => {
        documentHistory.value = commitPublisherDocumentHistory(
            documentHistory.value,
            previousSnapshot,
            captureDocumentSnapshot(),
        );
    };

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

    const mutatePageLayout = (
        pageId: string,
        templateId: TemplateId,
        mutate: (layout: SerializableLayoutState) => void,
    ) => {
        const current = pageById(pageId)?.layouts[templateId];
        if (!current) return false;
        const previous = cloneLayoutState(current);
        const next = cloneLayoutState(current);
        mutate(next);
        if (JSON.stringify(previous) === JSON.stringify(next)) return false;
        return commitPageLayout(pageId, templateId, previous, next);
    };

    const commitPageLayout = (
        pageId: string,
        templateId: TemplateId,
        previousState: SerializableLayoutState,
        currentState: SerializableLayoutState,
    ) => {
        const page = pageById(pageId);
        if (!page) return false;

        const currentSnapshot = captureDocumentSnapshot();
        const previousSnapshot = clonePublisherDocumentSnapshot(currentSnapshot);
        const previousPage = previousSnapshot.pages.find(({ id }) => id === pageId)!;
        const currentPage = currentSnapshot.pages.find(({ id }) => id === pageId)!;
        previousPage.layouts = { ...previousPage.layouts, [templateId]: cloneLayoutState(previousState) };
        currentPage.layouts = { ...currentPage.layouts, [templateId]: cloneLayoutState(currentState) };
        page.layouts = { ...page.layouts, [templateId]: cloneLayoutState(currentState) };
        documentHistory.value = commitPublisherDocumentHistory(
            documentHistory.value,
            previousSnapshot,
            currentSnapshot,
        );
        revision.value += 1;
        return true;
    };

    const addPage = (width: number, height: number, templateId: TemplateId) => {
        const previousSnapshot = captureDocumentSnapshot();
        const pageNumbers = pages.value
            .map(({ name }) => /^Seite (\d+)$/.exec(name)?.[1])
            .map(Number)
            .filter(Number.isFinite);
        const page = createBlankPublisherPage(
            width,
            height,
            templateId,
            `Seite ${Math.max(0, ...pageNumbers) + 1}`,
        );
        pages.value = [...pages.value, page];
        activePageId.value = page.id;
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
        return page;
    };

    const duplicatePage = (pageId: string) => {
        const pageIndex = pages.value.findIndex(({ id }) => id === pageId);
        if (pageIndex < 0) return null;
        const previousSnapshot = captureDocumentSnapshot();
        const source = pages.value[pageIndex]!;
        const duplicate = clonePublisherPage(source, true);
        duplicate.name = `${source.name.slice(0, MAX_PUBLISHER_PAGE_NAME_LENGTH - 6)} Kopie`;
        pages.value = [
            ...pages.value.slice(0, pageIndex + 1),
            duplicate,
            ...pages.value.slice(pageIndex + 1),
        ];
        activePageId.value = duplicate.id;
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
        return duplicate;
    };

    const renamePage = (pageId: string, name: string) => {
        const page = pageById(pageId);
        const normalizedName = name.trim().slice(0, MAX_PUBLISHER_PAGE_NAME_LENGTH);
        if (!page || !normalizedName || page.name === normalizedName) return false;
        const previousSnapshot = captureDocumentSnapshot();
        page.name = normalizedName;
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
        return true;
    };

    const movePage = (pageId: string, targetPageId: string, placement: 'before' | 'after') => {
        const sourceIndex = pages.value.findIndex(({ id }) => id === pageId);
        const targetIndex = pages.value.findIndex(({ id }) => id === targetPageId);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
        const previousSnapshot = captureDocumentSnapshot();
        const reordered = [...pages.value];
        const [page] = reordered.splice(sourceIndex, 1);
        let insertionIndex = reordered.findIndex(({ id }) => id === targetPageId);
        if (placement === 'after') insertionIndex += 1;
        reordered.splice(insertionIndex, 0, page!);
        if (reordered.every(({ id }, index) => id === pages.value[index]?.id)) return false;
        pages.value = reordered;
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
        return true;
    };

    const removePage = (pageId: string) => {
        if (pages.value.length <= 1) return false;
        const pageIndex = pages.value.findIndex(({ id }) => id === pageId);
        if (pageIndex < 0) return false;
        const previousSnapshot = captureDocumentSnapshot();
        pages.value = pages.value.filter(({ id }) => id !== pageId);
        if (activePageId.value === pageId) {
            activePageId.value = pages.value[Math.max(0, pageIndex - 1)]!.id;
        }
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
        return true;
    };

    const replaceActivePageTemplate = (templateId: TemplateId) => {
        const previousSnapshot = captureDocumentSnapshot();
        const page = activePage.value;
        page.templateId = templateId;
        page.layouts = { [templateId]: createStandardPublisherLayout(templateId, page.width, page.height) };
        page.imageFocus = createImageFocusByTemplate();
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
    };

    const replacePages = (nextPages: PublisherPage[], nextActivePageId?: string) => {
        if (nextPages.length === 0) return false;
        pages.value = nextPages.map((page) => clonePublisherPage(page));
        activePageId.value = pages.value.some(({ id }) => id === nextActivePageId)
            ? nextActivePageId!
            : pages.value[0]!.id;
        documentHistory.value = createPublisherDocumentHistory();
        revision.value += 1;
        return true;
    };

    const replacePagesWithHistory = (nextPages: PublisherPage[], nextActivePageId?: string) => {
        if (nextPages.length === 0) return false;
        const previousSnapshot = captureDocumentSnapshot();
        pages.value = nextPages.map((page) => clonePublisherPage(page));
        activePageId.value = pages.value.some(({ id }) => id === nextActivePageId)
            ? nextActivePageId!
            : pages.value[0]!.id;
        revision.value += 1;
        commitDocumentMutation(previousSnapshot);
        return true;
    };

    const resetDocumentHistory = () => {
        documentHistory.value = createPublisherDocumentHistory();
    };

    const undoDocument = () => {
        const result = undoPublisherDocumentHistory(documentHistory.value, captureDocumentSnapshot());
        if (!result) return false;
        documentHistory.value = result.history;
        applyDocumentSnapshot(result.snapshot);
        return true;
    };

    const redoDocument = () => {
        const result = redoPublisherDocumentHistory(documentHistory.value, captureDocumentSnapshot());
        if (!result) return false;
        documentHistory.value = result.history;
        applyDocumentSnapshot(result.snapshot);
        return true;
    };

    return {
        activePage,
        activePageId,
        activatePage,
        addPage,
        canRedoDocument,
        canUndoDocument,
        commitPageLayout,
        documentHistory,
        draftLayouts,
        duplicatePage,
        ensurePageLayout,
        imageFocusByTemplate,
        mutatePageLayout,
        pageById,
        pages,
        redoDocument,
        renamePage,
        removePage,
        replaceActivePageTemplate,
        replacePageLayout,
        replacePageLayoutSection,
        replacePages,
        replacePagesWithHistory,
        resetDocumentHistory,
        revision,
        selectedTemplateId,
        movePage,
        undoDocument,
    };
});
