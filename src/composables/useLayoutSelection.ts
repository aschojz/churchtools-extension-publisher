import { storeToRefs } from 'pinia';
import { watch, type Ref } from 'vue';

import type EventTemplate from '../components/EventTemplate.vue';
import type { LayoutAlignment, LayoutElementId, LayoutGeometry, LayoutTextStyle, LayoutVisualStyle } from '../domain/layoutEditing';
import { usePublisherEditorStore } from '../stores/publisherEditor';

export const useLayoutSelection = (
    templateRef: Readonly<Ref<InstanceType<typeof EventTemplate> | null>>,
    onSelectionActivated: () => void,
) => {
    const editorStore = usePublisherEditorStore();
    const {
        canGroupLayoutSelection, canRedoLayout, canUndoLayout, canUngroupLayoutSelection,
        hasLayoutSelection, hasMultipleLayoutSelection, layoutChanged, selectedLayerPosition,
        selectedLayerTotal, selectedLayoutElement, selectedLayoutElementChanged, selectedLayoutElements,
        selectedLayoutGeometry, selectedLayoutGroupDepth, selectedLayoutStyle, selectedLayoutTextContent,
        selectedLayoutVisualStyle,
    } = storeToRefs(editorStore);

    watch(selectedLayoutElements, (ids) => { if (ids.length > 0) onSelectionActivated(); });

    const clearLayoutSelection = () => templateRef.value?.clearSelection();
    const deleteLayoutElements = (ids: LayoutElementId[]) => templateRef.value?.deleteElements(ids);
    const resetLayout = () => templateRef.value?.resetLayout();
    const resetSelectedLayoutElement = () => templateRef.value?.resetSelectedElement();
    const undoLayout = () => templateRef.value?.undoLayout();
    const redoLayout = () => templateRef.value?.redoLayout();
    const nudgeLayoutElement = (x: number, y: number) => templateRef.value?.nudgeSelectedElement(x, y);
    const alignLayoutElement = (alignment: LayoutAlignment) => templateRef.value?.alignSelectedElement(alignment);
    const changeSelectedLayer = (direction: -1 | 1) => templateRef.value?.changeSelectedLayer(direction);
    const selectLayoutElement = (id: LayoutElementId, event: MouseEvent) =>
        templateRef.value?.selectElement(id, event.ctrlKey || event.metaKey || event.shiftKey);
    const selectLayoutGroup = (id: string, event: MouseEvent) =>
        templateRef.value?.selectGroup(id, event.ctrlKey || event.metaKey || event.shiftKey);
    const updateSelectedLayoutGeometry = (field: keyof LayoutGeometry, event: Event) => {
        const input = event.target as HTMLInputElement;
        if (Number.isFinite(input.valueAsNumber)) templateRef.value?.setSelectedElementGeometry(field, input.valueAsNumber);
    };
    const restoreSelectedLayoutGeometryInput = (field: keyof LayoutGeometry, event: FocusEvent) => {
        const currentValue = selectedLayoutGeometry.value?.[field];
        (event.target as HTMLInputElement).value = currentValue === undefined ? '' : String(Math.round(currentValue));
    };
    const updateSelectedTextStyle = (field: keyof LayoutTextStyle, inputValue: Event | string | number) => {
        let value: string | number;
        if (inputValue instanceof Event) {
            const input = inputValue.target as HTMLInputElement;
            value = ['fontSize', 'lineHeight', 'letterSpacing', 'strokeWidth'].includes(field) ? input.valueAsNumber : input.value;
        } else {
            value = inputValue;
        }
        templateRef.value?.setSelectedElementTextStyle(field, value);
    };
    const updateSelectedVisualStyle = (field: keyof LayoutVisualStyle, event: Event) => {
        const input = event.target as HTMLInputElement;
        templateRef.value?.setSelectedElementVisualStyle(field, field === 'strokeWidth' ? input.valueAsNumber : input.value);
    };
    const restoreSelectedFontSizeInput = (event: FocusEvent) => {
        (event.target as HTMLInputElement).value = selectedLayoutStyle.value ? String(selectedLayoutStyle.value.fontSize) : '';
    };
    const updateSelectedTextContent = (input: Event | string) => {
        const value = typeof input === 'string' ? input : (input.target as HTMLTextAreaElement).value;
        selectedLayoutTextContent.value = value;
        templateRef.value?.setSelectedElementTextContent(value);
    };

    return {
        alignLayoutElement, canGroupLayoutSelection, canRedoLayout, canUndoLayout, canUngroupLayoutSelection,
        changeSelectedLayer, clearLayoutSelection, deleteLayoutElements, hasLayoutSelection, hasMultipleLayoutSelection,
        layoutChanged, nudgeLayoutElement, redoLayout, resetLayout, resetSelectedLayoutElement,
        restoreSelectedFontSizeInput, restoreSelectedLayoutGeometryInput, selectedLayerPosition, selectedLayerTotal,
        selectedLayoutElement, selectedLayoutElementChanged, selectedLayoutElements, selectedLayoutGeometry,
        selectedLayoutGroupDepth, selectedLayoutStyle, selectedLayoutVisualStyle, selectLayoutElement,
        selectedLayoutTextContent,
        selectLayoutGroup, undoLayout, updateLayerPosition: editorStore.updateLayerPosition,
        updateLayoutGrouping: editorStore.updateLayoutGrouping, updateLayoutHistory: editorStore.updateLayoutHistory,
        updateSelectedLayoutGeometry, updateSelectedTextContent, updateSelectedTextStyle, updateSelectedVisualStyle,
    };
};
