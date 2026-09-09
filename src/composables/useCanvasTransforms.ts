import type Konva from 'konva';
import type { Ref } from 'vue';
import type { VueKonvaRef } from 'vue-konva';

import {
    calculateSelectionDragSnap,
    constrainFontSize,
    constrainLayoutDelta,
    constrainLayoutGeometry,
    flattenLayoutGroups,
    isFixedAspectRatioLayoutElement,
    keepRotatedFrameInDocument,
    layoutGroupElementIds,
    normalizeRotation,
    resizeLayoutFrame,
    resizeLayoutFrameProportionally,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
    type AlignmentGuide,
    type LayoutCustomElement,
    type LayoutElementId,
    type LayoutFrame,
    type LayoutGeometry,
    type LayoutGroup,
    type LayoutGroups,
} from '../domain/layoutEditing';
import type { SerializableLayoutState } from '../domain/layoutHistory';

type CanvasDragEvent = Konva.KonvaEventObject<DragEvent>;
type CanvasTransformEvent = Konva.KonvaEventObject<Event>;
type TransformLayoutState = Pick<
    SerializableLayoutState,
    'groups' | 'offsets' | 'order' | 'rotations' | 'sizes' | 'styles'
>;

interface UseCanvasTransformsOptions {
    activeAlignmentGuides: Ref<AlignmentGuide[]>;
    captureLayoutState: () => SerializableLayoutState;
    commitCurrentLayout: (previousState: SerializableLayoutState) => void;
    documentSize: Readonly<Ref<{ width: number; height: number }>>;
    elementFrame: (elementId: LayoutElementId) => LayoutFrame;
    elementIsLocked: (elementId: LayoutElementId) => boolean;
    getBaseFrame: (elementId: LayoutElementId) => LayoutFrame;
    getCustomElement: (elementId: LayoutElementId) => LayoutCustomElement | undefined;
    getLayout: () => TransformLayoutState;
    onLayoutChange: () => void;
    onSelectionDetailsChange: () => void;
    reflowAutoLayoutGroups: () => void;
    selectElement: (elementId: LayoutElementId, additive?: boolean) => void;
    selectGroup: (groupId: string, additive?: boolean) => void;
    selectedElement: Readonly<Ref<LayoutElementId | null>>;
    selectedElements: Readonly<Ref<LayoutElementId[]>>;
    selectedGroupId: Readonly<Ref<string | null>>;
    selectedGroupVisualBounds: (group: LayoutGroup) => LayoutFrame | null;
    setLayoutGroups: (groups: LayoutGroups) => void;
    snapEnabled: Readonly<Ref<boolean>>;
    stageRef: Ref<VueKonvaRef<Konva.Stage> | null>;
    syncGraphicTextSize: (elementId: LayoutElementId) => void;
    syncSelectedAutoLayoutAnchor: () => void;
    syncTransformer: () => Promise<void>;
}

interface ActiveElementDrag {
    nodeBounds: Partial<Record<LayoutElementId, LayoutFrame>>;
    nodePositions: Partial<Record<LayoutElementId, { x: number; y: number }>>;
    previousState: SerializableLayoutState;
    startPosition: { x: number; y: number };
}

interface ActiveGroupDrag {
    elementFrames: Partial<Record<LayoutElementId, LayoutFrame>>;
    groupId: string;
    previousState: SerializableLayoutState;
    startAbsolutePosition: { x: number; y: number };
    startBounds: LayoutFrame;
    startPosition: { x: number; y: number };
}

const updateLayoutGroup = (
    groups: LayoutGroups,
    groupId: string,
    update: (group: LayoutGroup) => LayoutGroup,
): LayoutGroups => groups.map((group) => group.id === groupId
    ? update(group)
    : {
        ...group,
        children: group.children.map((child) => typeof child === 'string'
            ? child
            : updateLayoutGroup([child], groupId, update)[0]!),
    });

export const useCanvasTransforms = (options: UseCanvasTransformsOptions) => {
    let activeDrag: ActiveElementDrag | null = null;
    let activeGroupDrag: ActiveGroupDrag | null = null;

    const layout = () => options.getLayout();
    const selectionContainsLockedElement = () => options.selectedElements.value.some(options.elementIsLocked);
    const nodeDocumentPosition = (node: Konva.Node) => {
        const stage = options.stageRef.value?.getNode();
        return stage ? node.getAbsolutePosition(stage) : node.position();
    };
    const positionNodeAtDocumentPoint = (node: Konva.Node, point: { x: number; y: number }) => {
        const stage = options.stageRef.value?.getNode();
        const parent = node.getParent();
        if (!stage || !parent) {
            node.position(point);
            return;
        }
        node.position(parent.getAbsoluteTransform(stage).copy().invert().point(point));
    };
    const finishMutation = (
        previousState: SerializableLayoutState,
        followUp: 'none' | 'reflow' | 'sync-anchor' = 'none',
    ) => {
        if (followUp === 'reflow') options.reflowAutoLayoutGroups();
        if (followUp === 'sync-anchor') options.syncSelectedAutoLayoutAnchor();
        options.commitCurrentLayout(previousState);
        options.onLayoutChange();
        void options.syncTransformer();
    };

    const startElementDrag = (elementId: LayoutElementId, event: CanvasDragEvent) => {
        if (!options.selectedElements.value.includes(elementId)) options.selectElement(elementId);
        const stage = options.stageRef.value?.getNode();
        const parent = event.target.getParent();
        if (!stage || !parent) return;
        const nodePositions: ActiveElementDrag['nodePositions'] = {};
        const nodeBounds: ActiveElementDrag['nodeBounds'] = {};
        for (const selectedId of options.selectedElements.value) {
            const node = stage.findOne(`#editable-${selectedId}`);
            if (!node) continue;
            nodePositions[selectedId] = { ...node.position() };
            nodeBounds[selectedId] = node.getClientRect({ relativeTo: parent, skipStroke: true, skipShadow: true });
        }
        activeDrag = {
            previousState: options.captureLayoutState(),
            startPosition: { ...event.target.position() },
            nodePositions,
            nodeBounds,
        };
    };

    const alignElementWhileDragging = (_elementId: LayoutElementId, event: CanvasDragEvent) => {
        const node = event.target;
        const parent = node.getParent();
        const stage = options.stageRef.value?.getNode();
        if (!parent || !stage || !activeDrag) return;
        const targetFrames = layout().order
            .filter((candidateId) => !options.selectedElements.value.includes(candidateId))
            .map((candidateId) => stage.findOne(`#editable-${candidateId}`))
            .filter((candidate): candidate is Konva.Node => Boolean(candidate))
            .map((candidate) => candidate.getClientRect({ relativeTo: parent, skipStroke: true, skipShadow: true }));
        const rawDelta = {
            x: node.x() - activeDrag.startPosition.x,
            y: node.y() - activeDrag.startPosition.y,
        };
        const bounds = Object.values(activeDrag.nodeBounds).filter((value): value is LayoutFrame => Boolean(value));
        const snapped = calculateSelectionDragSnap(
            bounds,
            rawDelta,
            targetFrames,
            options.snapEnabled.value,
            10,
            options.documentSize.value,
        );
        options.activeAlignmentGuides.value = snapped.guides;
        for (const selectedId of options.selectedElements.value) {
            const selectedNode = stage.findOne(`#editable-${selectedId}`);
            const startPosition = activeDrag.nodePositions[selectedId];
            if (selectedNode && startPosition) {
                selectedNode.position({ x: startPosition.x + snapped.offset.x, y: startPosition.y + snapped.offset.y });
            }
        }
    };

    const moveElement = (elementId: LayoutElementId, event: CanvasDragEvent) => {
        options.activeAlignmentGuides.value = [];
        const previousState = activeDrag?.previousState ?? options.captureLayoutState();
        const stage = options.stageRef.value?.getNode();
        const movedIds = activeDrag ? options.selectedElements.value : [elementId];
        for (const movedId of movedIds) {
            const node = stage?.findOne(`#editable-${movedId}`) ?? (movedId === elementId ? event.target : null);
            if (!node) continue;
            const baseFrame = options.getBaseFrame(movedId);
            const documentPosition = nodeDocumentPosition(node);
            layout().offsets[movedId] = {
                x: documentPosition.x - baseFrame.x,
                y: documentPosition.y - baseFrame.y,
            };
        }
        activeDrag = null;
        finishMutation(previousState, 'sync-anchor');
    };

    const startGroupDrag = (groupId: string, event: CanvasDragEvent) => {
        const group = flattenLayoutGroups(layout().groups).find(({ id }) => id === groupId);
        const stage = options.stageRef.value?.getNode();
        if (!group || !stage || layoutGroupElementIds(group).some(options.elementIsLocked)) return;
        if (options.selectedGroupId.value !== groupId) options.selectGroup(groupId);
        const elementFrames = Object.fromEntries(layoutGroupElementIds(group).map((elementId) => [
            elementId,
            { ...options.elementFrame(elementId) },
        ])) as ActiveGroupDrag['elementFrames'];
        activeGroupDrag = {
            groupId,
            previousState: options.captureLayoutState(),
            startPosition: { ...event.target.position() },
            startAbsolutePosition: { ...event.target.getAbsolutePosition(stage) },
            startBounds: event.target.getClientRect({ relativeTo: stage, skipStroke: true, skipShadow: true }),
            elementFrames,
        };
    };

    const alignGroupWhileDragging = (groupId: string, event: CanvasDragEvent) => {
        const drag = activeGroupDrag;
        const stage = options.stageRef.value?.getNode();
        if (!drag || drag.groupId !== groupId || !stage) return;
        const movingIds = new Set(Object.keys(drag.elementFrames));
        const targetFrames = layout().order
            .filter((elementId) => !movingIds.has(elementId))
            .map((elementId) => stage.findOne(`#editable-${elementId}`))
            .filter((node): node is Konva.Node => Boolean(node))
            .map((node) => node.getClientRect({ relativeTo: stage, skipStroke: true, skipShadow: true }));
        const absolutePosition = event.target.getAbsolutePosition(stage);
        const rawDelta = {
            x: absolutePosition.x - drag.startAbsolutePosition.x,
            y: absolutePosition.y - drag.startAbsolutePosition.y,
        };
        const snapped = calculateSelectionDragSnap(
            [drag.startBounds],
            rawDelta,
            targetFrames,
            options.snapEnabled.value,
            10,
            options.documentSize.value,
        );
        options.activeAlignmentGuides.value = snapped.guides;
        event.target.position({
            x: drag.startPosition.x + snapped.offset.x,
            y: drag.startPosition.y + snapped.offset.y,
        });
    };

    const moveGroup = (groupId: string, event: CanvasDragEvent) => {
        const drag = activeGroupDrag;
        const stage = options.stageRef.value?.getNode();
        options.activeAlignmentGuides.value = [];
        if (!drag || drag.groupId !== groupId || !stage) return;
        const absolutePosition = event.target.getAbsolutePosition(stage);
        const delta = {
            x: absolutePosition.x - drag.startAbsolutePosition.x,
            y: absolutePosition.y - drag.startAbsolutePosition.y,
        };
        event.target.position(drag.startPosition);
        for (const [elementId, frame] of Object.entries(drag.elementFrames) as [LayoutElementId, LayoutFrame][]) {
            const baseFrame = options.getBaseFrame(elementId);
            layout().offsets[elementId] = {
                x: frame.x + delta.x - baseFrame.x,
                y: frame.y + delta.y - baseFrame.y,
            };
        }
        activeGroupDrag = null;
        finishMutation(drag.previousState, 'sync-anchor');
    };

    const commitSelectedGeometry = (elementId: LayoutElementId, geometry: LayoutGeometry) => {
        const previousState = options.captureLayoutState();
        const baseFrame = options.getBaseFrame(elementId);
        layout().offsets[elementId] = { x: geometry.x - baseFrame.x, y: geometry.y - baseFrame.y };
        layout().sizes[elementId] = { width: geometry.width, height: geometry.height };
        layout().rotations[elementId] = geometry.rotation;
        finishMutation(previousState, 'reflow');
    };

    const setSelectedGroupGeometry = (field: keyof LayoutGeometry, value: number) => {
        const selectedGroupId = options.selectedGroupId.value;
        if (!selectedGroupId || !Number.isFinite(value)) return;
        const group = flattenLayoutGroups(layout().groups).find(({ id }) => id === selectedGroupId);
        const bounds = group ? options.selectedGroupVisualBounds(group) : null;
        if (!group || !bounds || field === 'width' || field === 'height') {
            options.onSelectionDetailsChange();
            return;
        }

        const elementIds = layoutGroupElementIds(group);
        const previousState = options.captureLayoutState();
        if (field === 'x' || field === 'y') {
            const requestedDelta = {
                x: field === 'x' ? value - bounds.x : 0,
                y: field === 'y' ? value - bounds.y : 0,
            };
            const delta = constrainLayoutDelta([bounds], requestedDelta, options.documentSize.value);
            for (const elementId of elementIds) {
                const frame = options.elementFrame(elementId);
                const baseFrame = options.getBaseFrame(elementId);
                layout().offsets[elementId] = {
                    x: frame.x + delta.x - baseFrame.x,
                    y: frame.y + delta.y - baseFrame.y,
                };
            }
        } else {
            const currentRotation = group.rotation ?? 0;
            const deltaRotation = normalizeRotation(value - currentRotation);
            const radians = deltaRotation * Math.PI / 180;
            const cosine = Math.cos(radians);
            const sine = Math.sin(radians);
            const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
            const updates = elementIds.map((elementId) => {
                const frame = options.elementFrame(elementId);
                const relative = { x: frame.x - center.x, y: frame.y - center.y };
                const requestedFrame = {
                    ...frame,
                    x: center.x + relative.x * cosine - relative.y * sine,
                    y: center.y + relative.x * sine + relative.y * cosine,
                };
                const rotation = normalizeRotation(layout().rotations[elementId] + deltaRotation);
                const constrained = keepRotatedFrameInDocument(requestedFrame, rotation, options.documentSize.value);
                const remainsRigid = constrained &&
                    Math.abs(constrained.frame.x - requestedFrame.x) < 0.01 &&
                    Math.abs(constrained.frame.y - requestedFrame.y) < 0.01;
                return remainsRigid ? { elementId, frame: requestedFrame, rotation } : null;
            });
            if (updates.some((update) => !update)) {
                options.onSelectionDetailsChange();
                return;
            }
            for (const update of updates) {
                if (!update) continue;
                const baseFrame = options.getBaseFrame(update.elementId);
                layout().offsets[update.elementId] = {
                    x: update.frame.x - baseFrame.x,
                    y: update.frame.y - baseFrame.y,
                };
                layout().rotations[update.elementId] = update.rotation;
            }
            const rotateGroupMetadata = (candidate: LayoutGroup): LayoutGroup => ({
                ...candidate,
                rotation: normalizeRotation((candidate.rotation ?? 0) + deltaRotation),
                children: candidate.children.map((child) =>
                    typeof child === 'string' ? child : rotateGroupMetadata(child)),
            });
            options.setLayoutGroups(updateLayoutGroup(layout().groups, group.id, rotateGroupMetadata));
        }

        options.syncSelectedAutoLayoutAnchor();
        finishMutation(previousState);
    };

    const transformGroup = (groupId: string, event: CanvasTransformEvent) => {
        const group = flattenLayoutGroups(layout().groups).find(({ id }) => id === groupId);
        if (!group || layoutGroupElementIds(group).some(options.elementIsLocked)) return;
        const rotation = normalizeRotation((group.rotation ?? 0) + event.target.rotation());
        event.target.rotation(0);
        event.target.scale({ x: 1, y: 1 });
        options.selectGroup(groupId);
        setSelectedGroupGeometry('rotation', rotation);
    };

    const resizeElement = (elementId: LayoutElementId, event: CanvasTransformEvent) => {
        const node = event.target;
        const baseFrame = options.getBaseFrame(elementId);
        const currentFrame = options.elementFrame(elementId);
        const snappedPosition = snapLayoutPoint(nodeDocumentPosition(node), options.snapEnabled.value);
        const customElement = options.getCustomElement(elementId);

        if (customElement?.kind === 'text' && (customElement.textMode ?? 'frame') === 'graphic') {
            const previousState = options.captureLayoutState();
            const currentStyle = layout().styles[elementId];
            const requestedScale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
            layout().styles[elementId] = {
                ...currentStyle,
                fontSize: constrainFontSize(currentStyle.fontSize * requestedScale),
            };
            options.syncGraphicTextSize(elementId);
            const measuredSize = layout().sizes[elementId];
            const resizedFrame = { x: snappedPosition.x, y: snappedPosition.y, ...measuredSize };
            const rotatedLayout = keepRotatedFrameInDocument(
                resizedFrame,
                snapRotation(node.rotation(), options.snapEnabled.value),
                options.documentSize.value,
            );
            if (!rotatedLayout) {
                layout().styles[elementId] = currentStyle;
                layout().sizes[elementId] = { width: currentFrame.width, height: currentFrame.height };
                node.scale({ x: 1, y: 1 });
                positionNodeAtDocumentPoint(node, { x: currentFrame.x, y: currentFrame.y });
                node.rotation(layout().rotations[elementId]);
                void options.syncTransformer();
                return;
            }
            node.scale({ x: 1, y: 1 });
            positionNodeAtDocumentPoint(node, { x: rotatedLayout.frame.x, y: rotatedLayout.frame.y });
            node.rotation(rotatedLayout.rotation);
            layout().offsets[elementId] = {
                x: rotatedLayout.frame.x - baseFrame.x,
                y: rotatedLayout.frame.y - baseFrame.y,
            };
            layout().sizes[elementId] = {
                width: rotatedLayout.frame.width,
                height: rotatedLayout.frame.height,
            };
            layout().rotations[elementId] = rotatedLayout.rotation;
            finishMutation(previousState, 'reflow');
            return;
        }

        const frameAtRequestedPosition = { ...currentFrame, ...snappedPosition };
        const snappedSize = snapLayoutSize({
            width: currentFrame.width * Math.abs(node.scaleX()),
            height: currentFrame.height * Math.abs(node.scaleY()),
        }, options.snapEnabled.value);
        const requestedSize = customElement?.kind === 'line'
            ? { width: snappedSize.width, height: currentFrame.height }
            : snappedSize;
        const resizedFrame = isFixedAspectRatioLayoutElement(elementId)
            ? resizeLayoutFrameProportionally(frameAtRequestedPosition, requestedSize, options.documentSize.value)
            : resizeLayoutFrame(frameAtRequestedPosition, requestedSize, options.documentSize.value);
        const rotatedLayout = keepRotatedFrameInDocument(
            resizedFrame,
            snapRotation(node.rotation(), options.snapEnabled.value),
            options.documentSize.value,
        );
        if (!rotatedLayout) {
            node.scale({ x: 1, y: 1 });
            positionNodeAtDocumentPoint(node, { x: currentFrame.x, y: currentFrame.y });
            node.rotation(layout().rotations[elementId]);
            void options.syncTransformer();
            return;
        }

        const previousState = options.captureLayoutState();
        node.scale({ x: 1, y: 1 });
        positionNodeAtDocumentPoint(node, { x: rotatedLayout.frame.x, y: rotatedLayout.frame.y });
        node.rotation(rotatedLayout.rotation);
        layout().offsets[elementId] = {
            x: rotatedLayout.frame.x - baseFrame.x,
            y: rotatedLayout.frame.y - baseFrame.y,
        };
        layout().sizes[elementId] = {
            width: rotatedLayout.frame.width,
            height: rotatedLayout.frame.height,
        };
        layout().rotations[elementId] = rotatedLayout.rotation;
        finishMutation(previousState, 'reflow');
    };

    const nudgeSelectedElement = (deltaX: number, deltaY: number) => {
        if (options.selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
        const previousState = options.captureLayoutState();
        const frames = options.selectedElements.value.map(options.elementFrame);
        const delta = constrainLayoutDelta(frames, { x: deltaX, y: deltaY }, options.documentSize.value);
        for (const elementId of options.selectedElements.value) {
            const offset = layout().offsets[elementId];
            layout().offsets[elementId] = { x: offset.x + delta.x, y: offset.y + delta.y };
        }
        finishMutation(previousState, 'sync-anchor');
    };

    const resizeSelectedElement = (deltaWidth: number, deltaHeight: number) => {
        if (options.selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
        const previousState = options.captureLayoutState();
        for (const elementId of options.selectedElements.value) {
            const frame = options.elementFrame(elementId);
            const requestedSize = {
                width: frame.width + deltaWidth,
                height: options.getCustomElement(elementId)?.kind === 'line'
                    ? frame.height
                    : frame.height + deltaHeight,
            };
            const resizedFrame = isFixedAspectRatioLayoutElement(elementId)
                ? resizeLayoutFrameProportionally(frame, requestedSize, options.documentSize.value)
                : resizeLayoutFrame(frame, requestedSize, options.documentSize.value);
            layout().sizes[elementId] = { width: resizedFrame.width, height: resizedFrame.height };
        }
        finishMutation(previousState, 'reflow');
    };

    const rotateSelectedElement = (deltaRotation: number) => {
        if (options.selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
        const rotations = options.selectedElements.value.map((elementId) => ({
            elementId,
            layout: keepRotatedFrameInDocument(
                options.elementFrame(elementId),
                layout().rotations[elementId] + deltaRotation,
                options.documentSize.value,
            ),
        }));
        if (rotations.some(({ layout: rotated }) => !rotated)) return;
        const previousState = options.captureLayoutState();
        for (const { elementId, layout: rotated } of rotations) {
            if (!rotated) continue;
            const baseFrame = options.getBaseFrame(elementId);
            layout().offsets[elementId] = {
                x: rotated.frame.x - baseFrame.x,
                y: rotated.frame.y - baseFrame.y,
            };
            layout().rotations[elementId] = rotated.rotation;
        }
        finishMutation(previousState);
    };

    const setSelectedElementGeometry = (field: keyof LayoutGeometry, value: number) => {
        if (selectionContainsLockedElement()) return;
        if (options.selectedGroupId.value) {
            setSelectedGroupGeometry(field, value);
            return;
        }
        const elementId = options.selectedElement.value;
        if (!elementId || !Number.isFinite(value)) return;
        if (options.getCustomElement(elementId)?.kind === 'line' && field === 'height') {
            options.onSelectionDetailsChange();
            return;
        }
        const currentFrame = options.elementFrame(elementId);
        const requestedFrame = isFixedAspectRatioLayoutElement(elementId) && (field === 'width' || field === 'height')
            ? resizeLayoutFrameProportionally(
                currentFrame,
                field === 'width'
                    ? { width: value, height: value / (currentFrame.width / currentFrame.height) }
                    : { width: value * (currentFrame.width / currentFrame.height), height: value },
                options.documentSize.value,
            )
            : { ...currentFrame, [field]: value };
        const geometry = constrainLayoutGeometry({
            ...requestedFrame,
            rotation: layout().rotations[elementId],
            ...(field === 'rotation' ? { rotation: value } : {}),
        }, options.documentSize.value);
        if (!geometry) {
            options.onSelectionDetailsChange();
            return;
        }
        commitSelectedGeometry(elementId, geometry);
    };

    return {
        alignElementWhileDragging,
        alignGroupWhileDragging,
        moveElement,
        moveGroup,
        nudgeSelectedElement,
        resizeElement,
        resizeSelectedElement,
        rotateSelectedElement,
        setSelectedElementGeometry,
        startElementDrag,
        startGroupDrag,
        transformGroup,
    };
};
