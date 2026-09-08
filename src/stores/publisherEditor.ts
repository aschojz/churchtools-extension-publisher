import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
    LAYOUT_ELEMENT_IDS,
    type LayoutElementId,
    type LayoutSelectionGeometry,
    type LayoutTextStyle,
    type LayoutTextMode,
    type LayoutVisualStyle,
} from '../domain/layoutEditing';

export type EditorToolId = 'appointments' | 'templates' | 'data' | 'layout';

const editorToolLabels: Record<EditorToolId, string> = {
    appointments: 'Termine',
    templates: 'Vorlagen',
    data: 'Termindaten',
    layout: 'Layout',
};

export const usePublisherEditorStore = defineStore('publisherEditor', () => {
    const activeEditorTool = ref<EditorToolId>('layout');
    const snapEnabled = ref(true);
    const previewZoomPercent = ref(100);
    const availableLayoutElements = ref<LayoutElementId[]>([...LAYOUT_ELEMENT_IDS]);
    const layoutChanged = ref(false);
    const canUndoLayout = ref(false);
    const canRedoLayout = ref(false);
    const activeCanvasPageId = ref<string | null>(null);
    const pageThumbnails = ref<Record<string, string>>({});
    const selectedLayoutElement = ref<LayoutElementId | null>(null);
    const selectedLayoutElements = ref<LayoutElementId[]>([]);
    const selectedLayoutGeometry = ref<LayoutSelectionGeometry | null>(null);
    const selectedLayoutStyle = ref<(LayoutTextStyle & { elementId: LayoutElementId }) | null>(null);
    const selectedLayoutTextContent = ref<string | null>(null);
    const selectedLayoutTextMode = ref<LayoutTextMode | null>(null);
    const selectedLayoutVisualStyle = ref<(LayoutVisualStyle & { elementId: LayoutElementId }) | null>(null);
    const selectedLayoutElementChanged = ref(false);
    const canGroupLayoutSelection = ref(false);
    const canUngroupLayoutSelection = ref(false);
    const selectedLayoutGroupDepth = ref(0);
    const selectedLayoutGroupPath = ref<string[]>([]);
    const selectedLayoutGroupId = ref<string | null>(null);
    const selectedLayerPosition = ref(0);
    const selectedLayerTotal = ref(0);
    const hasLayoutSelection = computed(() => selectedLayoutElements.value.length > 0);
    const hasMultipleLayoutSelection = computed(() => selectedLayoutElements.value.length > 1);
    const activeEditorToolLabel = computed(() => editorToolLabels[activeEditorTool.value]);

    const clearSelectionState = () => {
        selectedLayoutElement.value = null;
        selectedLayoutElements.value = [];
        selectedLayoutGeometry.value = null;
        selectedLayoutStyle.value = null;
        selectedLayoutTextContent.value = null;
        selectedLayoutTextMode.value = null;
        selectedLayoutVisualStyle.value = null;
        selectedLayoutGroupPath.value = [];
        selectedLayoutGroupId.value = null;
        canGroupLayoutSelection.value = false;
        canUngroupLayoutSelection.value = false;
        selectedLayoutGroupDepth.value = 0;
        selectedLayerPosition.value = 0;
        selectedLayerTotal.value = 0;
    };

    const activateCanvasPage = (pageId: string) => {
        if (activeCanvasPageId.value !== pageId) clearSelectionState();
        activeCanvasPageId.value = pageId;
    };

    const setCanvasSelection = (pageId: string, elementIds: LayoutElementId[], groupId: string | null = null) => {
        if (activeCanvasPageId.value !== pageId) return false;
        selectedLayoutElements.value = [...elementIds];
        selectedLayoutElement.value = elementIds.at(-1) ?? null;
        selectedLayoutGroupId.value = groupId;
        return true;
    };

    const updateLayoutHistory = (canUndo: boolean, canRedo: boolean) => {
        canUndoLayout.value = canUndo;
        canRedoLayout.value = canRedo;
    };
    const updateLayoutGrouping = (canGroup: boolean, canUngroup: boolean, depth: number) => {
        canGroupLayoutSelection.value = canGroup;
        canUngroupLayoutSelection.value = canUngroup;
        selectedLayoutGroupDepth.value = depth;
    };
    const updateLayerPosition = (position: number, total: number) => {
        selectedLayerPosition.value = position;
        selectedLayerTotal.value = total;
    };

    const setPageThumbnail = (pageId: string, source: string) => {
        if (!pageId || !source) return;
        pageThumbnails.value = { ...pageThumbnails.value, [pageId]: source };
    };

    const retainPageThumbnails = (pageIds: Iterable<string>) => {
        const retainedIds = new Set(pageIds);
        pageThumbnails.value = Object.fromEntries(
            Object.entries(pageThumbnails.value).filter(([pageId]) => retainedIds.has(pageId)),
        );
    };

    return {
        activeEditorTool,
        activeEditorToolLabel,
        activeCanvasPageId,
        activateCanvasPage,
        availableLayoutElements,
        canGroupLayoutSelection,
        canRedoLayout,
        canUndoLayout,
        canUngroupLayoutSelection,
        clearSelectionState,
        hasLayoutSelection,
        hasMultipleLayoutSelection,
        layoutChanged,
        pageThumbnails,
        previewZoomPercent,
        selectedLayerPosition,
        selectedLayerTotal,
        selectedLayoutElement,
        selectedLayoutElementChanged,
        selectedLayoutElements,
        selectedLayoutGeometry,
        selectedLayoutGroupDepth,
        selectedLayoutGroupId,
        selectedLayoutGroupPath,
        selectedLayoutStyle,
        selectedLayoutTextContent,
        selectedLayoutTextMode,
        selectedLayoutVisualStyle,
        snapEnabled,
        setCanvasSelection,
        setPageThumbnail,
        retainPageThumbnails,
        updateLayerPosition,
        updateLayoutGrouping,
        updateLayoutHistory,
    };
});
