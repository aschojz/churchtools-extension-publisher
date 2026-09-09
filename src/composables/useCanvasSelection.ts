import type Konva from 'konva';
import { ref, type Ref, type WritableComputedRef } from 'vue';
import type { VueKonvaRef } from 'vue-konva';

import {
    expandLayoutSelection,
    findLayoutGroupDepth,
    findLayoutGroupPath,
    flattenLayoutGroups,
    layoutFramesIntersect,
    layoutGroupElementIds,
    resolveLayoutSelectionTarget,
    type LayoutElementId,
    type LayoutFrame,
    type LayoutGroups,
} from '../domain/layoutEditing';

type CanvasPointerEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;

export interface CanvasSelectionSnapshot {
    canGroup: boolean;
    canUngroup: boolean;
    elementId: LayoutElementId | null;
    elementIds: LayoutElementId[];
    groupDepth: number;
    groupPath: string[];
    layerPosition: number;
    layerTotal: number;
}

interface UseCanvasSelectionOptions {
    elementIsLocked: (elementId: LayoutElementId) => boolean;
    getDeletedElements: () => LayoutElementId[];
    getLayoutGroups: () => LayoutGroups;
    getLayoutOrder: () => LayoutElementId[];
    onSelectionDetailsChange: () => void;
    onSelectionStateChange: (snapshot: CanvasSelectionSnapshot) => void;
    selectedElements: WritableComputedRef<LayoutElementId[]>;
    selectedGroupId: WritableComputedRef<string | null>;
    stageRef: Ref<VueKonvaRef<Konva.Stage> | null>;
    syncTransformer: () => Promise<void>;
    transformerRef: Ref<VueKonvaRef<Konva.Transformer> | null>;
}

const eventIsAdditive = (event: CanvasPointerEvent) =>
    'ctrlKey' in event.evt && (event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey);

export const useCanvasSelection = (options: UseCanvasSelectionOptions) => {
    const selectionRectangle = ref<LayoutFrame | null>(null);
    let selectionStart: { x: number; y: number; additive: boolean } | null = null;

    const selectionSnapshot = (): CanvasSelectionSnapshot => {
        const order = options.getLayoutOrder();
        const groups = flattenLayoutGroups(options.getLayoutGroups());
        const selectedElement = options.selectedElements.value.at(-1) ?? null;
        const selectionIsOneGroup = groups.some((group) =>
            layoutGroupElementIds(group).length === options.selectedElements.value.length &&
            layoutGroupElementIds(group).every((elementId) => options.selectedElements.value.includes(elementId)),
        );
        return {
            canGroup: options.selectedElements.value.length >= 2 && !selectionIsOneGroup,
            canUngroup: groups.some((group) =>
                layoutGroupElementIds(group).every((elementId) => options.selectedElements.value.includes(elementId))),
            elementId: selectedElement,
            elementIds: [...options.selectedElements.value],
            groupDepth: options.selectedGroupId.value
                ? findLayoutGroupDepth(options.getLayoutGroups(), options.selectedGroupId.value)
                : 0,
            groupPath: options.selectedElements.value[0]
                ? findLayoutGroupPath(options.getLayoutGroups(), options.selectedElements.value[0]).map(({ id }) => id)
                : [],
            layerPosition: selectedElement && options.selectedElements.value.length === 1
                ? order.indexOf(selectedElement) + 1
                : 0,
            layerTotal: selectedElement && options.selectedElements.value.length === 1 ? order.length : 0,
        };
    };

    const updateSelection = (elementIds: LayoutElementId[], groupId: string | null = null) => {
        const order = options.getLayoutOrder();
        options.selectedElements.value = elementIds.filter(
            (elementId, index) => order.includes(elementId) && elementIds.indexOf(elementId) === index,
        );
        options.selectedGroupId.value = groupId;
        options.onSelectionStateChange(selectionSnapshot());
        options.onSelectionDetailsChange();
        void options.syncTransformer();
    };

    const selectElement = (elementId: LayoutElementId, additive = false) => {
        const groups = options.getLayoutGroups();
        const target = resolveLayoutSelectionTarget(groups, elementId, options.selectedGroupId.value, false);
        if (!additive) {
            updateSelection(target.elementIds, target.groupId);
            return;
        }

        const groupSelection = expandLayoutSelection(groups, [elementId], options.getLayoutOrder());
        updateSelection(options.selectedElements.value.includes(elementId)
            ? options.selectedElements.value.filter((candidate) => !groupSelection.includes(candidate))
            : [...options.selectedElements.value, ...groupSelection]);
    };

    const drillIntoElement = (elementId: LayoutElementId) => {
        const target = resolveLayoutSelectionTarget(
            options.getLayoutGroups(),
            elementId,
            options.selectedGroupId.value,
            true,
        );
        updateSelection(target.elementIds, target.groupId);
    };

    const selectGroup = (groupId: string, additive = false) => {
        const group = flattenLayoutGroups(options.getLayoutGroups()).find((candidate) => candidate.id === groupId);
        if (!group) return;
        const deleted = options.getDeletedElements();
        const elementIds = layoutGroupElementIds(group).filter((elementId) => !deleted.includes(elementId));
        if (!additive) {
            updateSelection(elementIds, groupId);
            return;
        }
        const fullySelected = elementIds.every((elementId) => options.selectedElements.value.includes(elementId));
        updateSelection(
            fullySelected
                ? options.selectedElements.value.filter((elementId) => !elementIds.includes(elementId))
                : [...options.selectedElements.value, ...elementIds],
            fullySelected ? null : groupId,
        );
    };

    const clearSelection = () => updateSelection([]);

    const stagePointerPosition = () => {
        const stage = options.stageRef.value?.getNode();
        const pointer = stage?.getPointerPosition();
        return stage && pointer ? stage.getAbsoluteTransform().copy().invert().point(pointer) : null;
    };

    const cancelSelectionRectangle = () => {
        selectionStart = null;
        selectionRectangle.value = null;
    };

    const handleStagePointer = (event: CanvasPointerEvent) => {
        const transformer = options.transformerRef.value?.getNode();
        if (transformer && (
            (event.target as unknown as Konva.Transformer) === transformer || transformer.isAncestorOf(event.target)
        )) {
            cancelSelectionRectangle();
            return;
        }

        const editableGroup = event.target.findAncestor('.editable-element', true);
        const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;
        if (elementId) {
            if (!options.elementIsLocked(elementId)) selectElement(elementId, eventIsAdditive(event));
            cancelSelectionRectangle();
            return;
        }

        const layoutGroup = event.target.findAncestor('.editable-layout-group', true);
        const groupId = layoutGroup?.getAttr('layoutGroupId') as string | undefined;
        if (groupId) {
            selectGroup(groupId, eventIsAdditive(event));
            cancelSelectionRectangle();
            return;
        }

        const pointer = stagePointerPosition();
        if (!pointer) return;
        selectionStart = { ...pointer, additive: eventIsAdditive(event) };
        selectionRectangle.value = { x: pointer.x, y: pointer.y, width: 0, height: 0 };
    };

    const handleStageDoubleClick = (event: CanvasPointerEvent) => {
        const editableGroup = event.target.findAncestor('.editable-element', true);
        const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;
        if (elementId && !options.elementIsLocked(elementId)) drillIntoElement(elementId);
    };

    const updateSelectionRectangle = () => {
        const pointer = stagePointerPosition();
        if (!selectionStart || !pointer) return;
        selectionRectangle.value = {
            x: Math.min(selectionStart.x, pointer.x),
            y: Math.min(selectionStart.y, pointer.y),
            width: Math.abs(pointer.x - selectionStart.x),
            height: Math.abs(pointer.y - selectionStart.y),
        };
    };

    const finishSelectionRectangle = () => {
        const rectangle = selectionRectangle.value;
        const start = selectionStart;
        cancelSelectionRectangle();
        if (!rectangle || !start) return;
        if (rectangle.width < 5 && rectangle.height < 5) {
            if (!start.additive) clearSelection();
            return;
        }

        const stage = options.stageRef.value?.getNode();
        if (!stage) return;
        const matches = options.getLayoutOrder().filter((elementId) => {
            if (options.elementIsLocked(elementId)) return false;
            const node = stage.findOne(`#editable-${elementId}`);
            return Boolean(node && layoutFramesIntersect(rectangle, node.getClientRect({ relativeTo: stage })));
        });
        const expandedMatches = expandLayoutSelection(
            options.getLayoutGroups(),
            matches,
            options.getLayoutOrder(),
        );
        updateSelection(start.additive
            ? [...new Set([...options.selectedElements.value, ...expandedMatches])]
            : expandedMatches);
    };

    return {
        cancelSelectionRectangle,
        clearSelection,
        drillIntoElement,
        finishSelectionRectangle,
        handleStageDoubleClick,
        handleStagePointer,
        selectElement,
        selectGroup,
        selectionRectangle,
        selectionSnapshot,
        updateSelection,
        updateSelectionRectangle,
    };
};
