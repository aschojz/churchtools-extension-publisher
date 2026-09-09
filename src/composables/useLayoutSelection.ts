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
        canGroupLayoutSelection, canUngroupLayoutSelection,
        hasLayoutSelection, hasMultipleLayoutSelection, layoutChanged, selectedLayerPosition,
        selectedLayerTotal, selectedLayoutElement, selectedLayoutElements,
        selectedLayoutGeometry, selectedLayoutGroupDepth, selectedLayoutStyle, selectedLayoutTextContent,
        selectedLayoutVisualStyle,
    } = storeToRefs(editorStore);

    watch(selectedLayoutElements, (ids) => { if (ids.length > 0) onSelectionActivated(); });

    const clearLayoutSelection = () => templateRef.value?.commands.clearSelection();
    const deleteLayoutElements = (ids: LayoutElementId[]) => templateRef.value?.commands.deleteElements(ids);
    const nudgeLayoutElement = (x: number, y: number) => templateRef.value?.commands.nudgeSelectedElement(x, y);
    const alignLayoutElement = (alignment: LayoutAlignment) => templateRef.value?.commands.alignSelectedElement(alignment);
    const changeSelectedLayer = (direction: -1 | 1) => templateRef.value?.commands.changeSelectedLayer(direction);
    const selectLayoutElement = (id: LayoutElementId, event: MouseEvent) =>
        templateRef.value?.commands.selectElement(id, event.ctrlKey || event.metaKey || event.shiftKey);
    const selectLayoutGroup = (id: string, event: MouseEvent) =>
        templateRef.value?.commands.selectGroup(id, event.ctrlKey || event.metaKey || event.shiftKey);
    const updateSelectedLayoutGeometry = (field: keyof LayoutGeometry, event: Event) => {
        const input = event.target as HTMLInputElement;
        if (Number.isFinite(input.valueAsNumber)) {
            templateRef.value?.commands.setSelectedElementGeometry(field, input.valueAsNumber);
        }
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
        templateRef.value?.commands.setSelectedElementTextStyle(field, value);
    };
    const updateSelectedVisualStyle = (field: keyof LayoutVisualStyle, event: Event) => {
        const input = event.target as HTMLInputElement;
        templateRef.value?.commands.setSelectedElementVisualStyle(
            field,
            field === 'strokeWidth' ? input.valueAsNumber : input.value,
        );
    };
    const restoreSelectedFontSizeInput = (event: FocusEvent) => {
        (event.target as HTMLInputElement).value = selectedLayoutStyle.value ? String(selectedLayoutStyle.value.fontSize) : '';
    };
    const updateSelectedTextContent = (input: Event | string) => {
        const value = typeof input === 'string' ? input : (input.target as HTMLTextAreaElement).value;
        selectedLayoutTextContent.value = value;
        templateRef.value?.commands.setSelectedElementTextContent(value);
    };

    return {
        alignLayoutElement, canGroupLayoutSelection, canUngroupLayoutSelection,
        changeSelectedLayer, clearLayoutSelection, deleteLayoutElements, hasLayoutSelection, hasMultipleLayoutSelection,
        layoutChanged, nudgeLayoutElement,
        restoreSelectedFontSizeInput, restoreSelectedLayoutGeometryInput, selectedLayerPosition, selectedLayerTotal,
        selectedLayoutElement, selectedLayoutElements, selectedLayoutGeometry,
        selectedLayoutGroupDepth, selectedLayoutStyle, selectedLayoutVisualStyle, selectLayoutElement,
        selectedLayoutTextContent,
        selectLayoutGroup, updateLayerPosition: editorStore.updateLayerPosition,
        updateLayoutGrouping: editorStore.updateLayoutGrouping,
        updateSelectedLayoutGeometry, updateSelectedTextContent, updateSelectedTextStyle, updateSelectedVisualStyle,
    };
};
