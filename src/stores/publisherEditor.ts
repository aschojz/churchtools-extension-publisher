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

    return {
        activeEditorTool,
        activeEditorToolLabel,
        availableLayoutElements,
        canGroupLayoutSelection,
        canRedoLayout,
        canUndoLayout,
        canUngroupLayoutSelection,
        clearSelectionState,
        hasLayoutSelection,
        hasMultipleLayoutSelection,
        layoutChanged,
        previewZoomPercent,
        selectedLayerPosition,
        selectedLayerTotal,
        selectedLayoutElement,
        selectedLayoutElementChanged,
        selectedLayoutElements,
        selectedLayoutGeometry,
        selectedLayoutGroupDepth,
        selectedLayoutGroupPath,
        selectedLayoutStyle,
        selectedLayoutTextContent,
        selectedLayoutTextMode,
        selectedLayoutVisualStyle,
        snapEnabled,
        updateLayerPosition,
        updateLayoutGrouping,
        updateLayoutHistory,
    };
});
