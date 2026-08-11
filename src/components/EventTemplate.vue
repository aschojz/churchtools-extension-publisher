<script setup lang="ts">
import type Konva from 'konva';
import type { Box } from 'konva/lib/shapes/Transformer';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import EditableTextElement from './EditableTextElement.vue';
import type { EventTemplateProps } from '../domain/EventTemplateProps';
import { calculateCoverCrop, type ImageFocus } from '../domain/imageFocus';
import {
    alignLayoutGeometry,
    calculateAlignmentSnap,
    constrainLayoutGeometry,
    constrainLayoutDelta,
    constrainFontSize,
    createLayoutOrder,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    isHexColor,
    keepRotatedFrameInDocument,
    layoutFramesIntersect,
    type AlignmentGuide,
    type LayoutElementId,
    type LayoutFrame,
    type LayoutGeometry,
    type LayoutAlignment,
    type LayoutTextStyle,
    moveLayoutElementInOrder,
    resizeLayoutFrame,
    resetLayoutElementState,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
    TEMPLATE_ELEMENT_FRAMES,
} from '../domain/layoutEditing';
import {
    cloneLayoutState,
    commitLayoutHistory,
    createLayoutHistory,
    redoLayoutHistory,
    type SerializableLayoutState,
    undoLayoutHistory,
} from '../domain/layoutHistory';
import type { TemplateId } from '../domain/templates';
import {
    BUILT_IN_TEMPLATE_DEFINITIONS,
    TEMPLATE_TEXT_BINDINGS,
    type TemplateDecoration,
    type TemplateDecorationPlacement,
    type TemplateTextBinding,
} from '../domain/templateDefinition';
import {
    calculatePreviewScale,
    DOCUMENT_HEIGHT,
    DOCUMENT_WIDTH,
} from '../utils/stageDimensions';

type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

const props = defineProps<{
    draftId: string;
    initialLayouts: Partial<Record<TemplateId, SerializableLayoutState>>;
    imageFocus: ImageFocus;
    previewZoom: number;
    template: EventTemplateProps;
    templateId: TemplateId;
    snapEnabled: boolean;
}>();

const emit = defineEmits<{
    imageStatus: [status: ImageStatus];
    historyChange: [canUndo: boolean, canRedo: boolean];
    layoutChange: [changed: boolean];
    layoutStateChange: [templateId: TemplateId, state: SerializableLayoutState];
    layerPositionChange: [position: number, total: number];
    selectionChange: [elementId: LayoutElementId | null];
    selectionIdsChange: [elementIds: LayoutElementId[]];
    selectionDefaultChange: [changed: boolean];
    selectionGeometryChange: [geometry: (LayoutGeometry & { elementId: LayoutElementId }) | null];
    selectionStyleChange: [style: (LayoutTextStyle & { elementId: LayoutElementId }) | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<VueKonvaRef<Konva.Stage> | null>(null);
const transformerRef = ref<VueKonvaRef<Konva.Transformer> | null>(null);
const containerWidth = ref(DOCUMENT_WIDTH);
const image = shallowRef<HTMLImageElement | null>(null);
const imageStatus = ref<ImageStatus>('idle');
const selectedElements = ref<LayoutElementId[]>([]);
const selectedElement = computed(() => selectedElements.value.at(-1) ?? null);
const isExporting = ref(false);
const activeAlignmentGuides = ref<AlignmentGuide[]>([]);
const selectionRectangle = ref<LayoutFrame | null>(null);
const layoutOffsets = ref<Record<TemplateId, ReturnType<typeof createLayoutOffsets>>>({
    split: createLayoutOffsets(),
    poster: createLayoutOffsets(),
});
const layoutSizes = ref<Record<TemplateId, ReturnType<typeof createLayoutSizes>>>({
    split: createLayoutSizes('split'),
    poster: createLayoutSizes('poster'),
});
const layoutRotations = ref<Record<TemplateId, ReturnType<typeof createLayoutRotations>>>({
    split: createLayoutRotations(),
    poster: createLayoutRotations(),
});
const layoutOrder = ref<Record<TemplateId, ReturnType<typeof createLayoutOrder>>>({
    split: createLayoutOrder(),
    poster: createLayoutOrder(),
});
const layoutTextStyles = ref<Record<TemplateId, ReturnType<typeof createLayoutTextStyles>>>({
    split: createLayoutTextStyles('split'),
    poster: createLayoutTextStyles('poster'),
});
const layoutHistories = ref<Record<TemplateId, ReturnType<typeof createLayoutHistory>>>({
    split: createLayoutHistory(),
    poster: createLayoutHistory(),
});
let resizeObserver: ResizeObserver | undefined;
let selectionStart: { x: number; y: number; additive: boolean } | null = null;
let activeDrag: {
    previousState: SerializableLayoutState;
    startPosition: { x: number; y: number };
    nodePositions: Partial<Record<LayoutElementId, { x: number; y: number }>>;
    nodeBounds: Partial<Record<LayoutElementId, LayoutFrame>>;
} | null = null;

const previewScale = computed(() => calculatePreviewScale(containerWidth.value, props.previewZoom));
const stageConfig = computed(() => ({
    width: DOCUMENT_WIDTH * previewScale.value,
    height: DOCUMENT_HEIGHT * previewScale.value,
    scaleX: previewScale.value,
    scaleY: previewScale.value,
}));
const templateDefinition = computed(() => BUILT_IN_TEMPLATE_DEFINITIONS[props.templateId]);
const transformerConfig = computed(() => ({
    rotateEnabled: selectedElements.value.length === 1,
    flipEnabled: false,
    keepRatio: false,
    enabledAnchors: selectedElements.value.length === 1
        ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
        : [],
    anchorFill: '#ffffff',
    anchorStroke: '#2479c5',
    anchorSize: 18,
    borderStroke: '#2479c5',
    borderStrokeWidth: 4,
    rotateAnchorOffset: 45,
    rotationSnaps: props.snapEnabled
        ? [-180, -165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
        : [],
    rotationSnapTolerance: 5,
    boundBoxFunc: (oldBox: Box, newBox: Box) => {
        const insideDocument =
            newBox.x >= 0 &&
            newBox.y >= 0 &&
            newBox.x + newBox.width <= DOCUMENT_WIDTH &&
            newBox.y + newBox.height <= DOCUMENT_HEIGHT;
        return newBox.width >= 120 && newBox.height >= 50 && insideDocument ? newBox : oldBox;
    },
}));

const imageCrop = computed(() => {
    if (!image.value) {
        return undefined;
    }

    const imageFrame = templateDefinition.value.composition.imageFrame;
    return calculateCoverCrop(
        { width: image.value.naturalWidth, height: image.value.naturalHeight },
        { width: imageFrame.width, height: imageFrame.height },
        props.imageFocus,
    ) ?? undefined;
});

const imageConfig = computed(() => ({
    image: image.value ?? undefined,
    ...templateDefinition.value.composition.imageFrame,
    crop: imageCrop.value,
}));

const decorationLayers = (placement: TemplateDecorationPlacement) =>
    templateDefinition.value.composition.decorations.filter((decoration) =>
        decoration.placement === placement &&
        (decoration.visibility === 'always' || imageStatus.value !== 'loaded'),
    );

const decorationConfig = (decoration: TemplateDecoration) => ({
    ...decoration.frame,
    ...(decoration.type === 'text'
        ? {
              text: decoration.text,
              fill: decoration.fill,
              fontFamily: decoration.fontFamily,
              fontSize: decoration.fontSize,
              fontStyle: decoration.fontStyle,
              letterSpacing: decoration.letterSpacing,
              align: decoration.align,
          }
        : {
              fill: decoration.fill,
              opacity: imageStatus.value === 'loaded' && decoration.imageLoadedOpacity !== undefined
                  ? decoration.imageLoadedOpacity
                  : decoration.opacity,
          }),
});

const dateAndTime = computed(() => [props.template.date, props.template.time].filter(Boolean).join(' · '));
const editableTextValues = computed<Record<TemplateTextBinding, string>>(() => ({
    title: props.template.title,
    dateTime: dateAndTime.value,
    location: props.template.location,
}));

const editableTextConfig = (binding: TemplateTextBinding) => {
    const definitionStyle = templateDefinition.value.elements[binding].style;
    const editableStyle = layoutTextStyles.value[props.templateId][binding];
    return {
        text: editableTextValues.value[binding],
        fill: editableStyle.color,
        fontSize: editableStyle.fontSize,
        fontFamily: definitionStyle.fontFamily,
        fontStyle: definitionStyle.fontStyle,
        lineHeight: definitionStyle.lineHeight,
        wrap: definitionStyle.wrap,
        ellipsis: definitionStyle.ellipsis,
        align: definitionStyle.align,
    };
};
const currentLayoutChanged = computed(() => {
    const geometryChanged = (
        Object.entries(layoutOffsets.value[props.templateId]) as [LayoutElementId, { x: number; y: number }][]
    ).some(
        ([elementId, { x, y }]) => {
            const size = layoutSizes.value[props.templateId][elementId];
            const base = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
            const rotation = layoutRotations.value[props.templateId][elementId];
            return x !== 0 || y !== 0 || size.width !== base.width || size.height !== base.height || rotation !== 0;
        },
    );
    const defaultOrder = createLayoutOrder();
    const orderChanged = layoutOrder.value[props.templateId].some(
        (elementId, index) => elementId !== defaultOrder[index],
    );
    const defaultStyles = createLayoutTextStyles(props.templateId);
    const styleChanged = createLayoutOrder().some((elementId) => {
        const style = layoutTextStyles.value[props.templateId][elementId];
        return style.fontSize !== defaultStyles[elementId].fontSize ||
            style.color !== defaultStyles[elementId].color;
    });
    return geometryChanged || orderChanged || styleChanged;
});

const elementFrame = (elementId: LayoutElementId): LayoutFrame => {
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const offset = layoutOffsets.value[props.templateId][elementId];
    const size = layoutSizes.value[props.templateId][elementId];
    return {
        ...baseFrame,
        x: baseFrame.x + offset.x,
        y: baseFrame.y + offset.y,
        width: size.width,
        height: size.height,
    };
};

const emitSelectionGeometry = () => {
    if (!selectedElement.value) {
        emit('selectionGeometryChange', null);
        emit('selectionStyleChange', null);
        emit('selectionDefaultChange', false);
        return;
    }

    const elementId = selectedElement.value;
    if (selectedElements.value.length > 1) {
        emit('selectionGeometryChange', null);
        emit('selectionStyleChange', {
            elementId,
            ...layoutTextStyles.value[props.templateId][elementId],
        });
        emit('selectionDefaultChange', selectedElements.value.some((selectedId) => {
            const frame = elementFrame(selectedId);
            const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][selectedId];
            const defaultStyle = createLayoutTextStyles(props.templateId)[selectedId];
            const style = layoutTextStyles.value[props.templateId][selectedId];
            return frame.x !== baseFrame.x || frame.y !== baseFrame.y ||
                frame.width !== baseFrame.width || frame.height !== baseFrame.height ||
                layoutRotations.value[props.templateId][selectedId] !== 0 ||
                layoutOrder.value[props.templateId].indexOf(selectedId) !== createLayoutOrder().indexOf(selectedId) ||
                style.fontSize !== defaultStyle.fontSize || style.color !== defaultStyle.color;
        }));
        return;
    }

    const frame = elementFrame(elementId);
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    emit('selectionGeometryChange', {
        elementId,
        ...frame,
        rotation: layoutRotations.value[props.templateId][elementId],
    });
    emit('selectionStyleChange', {
        elementId,
        ...layoutTextStyles.value[props.templateId][elementId],
    });
    emit(
        'selectionDefaultChange',
        frame.x !== baseFrame.x || frame.y !== baseFrame.y ||
            frame.width !== baseFrame.width || frame.height !== baseFrame.height ||
            layoutRotations.value[props.templateId][elementId] !== 0 ||
            layoutOrder.value[props.templateId].indexOf(elementId) !== createLayoutOrder().indexOf(elementId) ||
            layoutTextStyles.value[props.templateId][elementId].fontSize !==
                createLayoutTextStyles(props.templateId)[elementId].fontSize ||
            layoutTextStyles.value[props.templateId][elementId].color !==
                createLayoutTextStyles(props.templateId)[elementId].color,
    );
};

const captureLayoutState = (): SerializableLayoutState =>
    cloneLayoutState({
        offsets: layoutOffsets.value[props.templateId],
        sizes: layoutSizes.value[props.templateId],
        rotations: layoutRotations.value[props.templateId],
        order: layoutOrder.value[props.templateId],
        styles: layoutTextStyles.value[props.templateId],
    });

const emitHistoryState = () => {
    const history = layoutHistories.value[props.templateId];
    emit('historyChange', history.past.length > 0, history.future.length > 0);
};

const commitCurrentLayout = (previousState: SerializableLayoutState) => {
    layoutHistories.value[props.templateId] = commitLayoutHistory(
        layoutHistories.value[props.templateId],
        previousState,
        captureLayoutState(),
    );
    emit('layoutStateChange', props.templateId, captureLayoutState());
    emitSelectionGeometry();
    emitHistoryState();
};

const restoreLayoutState = (state: SerializableLayoutState) => {
    const restored = cloneLayoutState(state);
    layoutOffsets.value[props.templateId] = restored.offsets;
    layoutSizes.value[props.templateId] = restored.sizes;
    layoutRotations.value[props.templateId] = restored.rotations;
    layoutOrder.value[props.templateId] = restored.order;
    layoutTextStyles.value[props.templateId] = restored.styles;
    emit('layoutStateChange', props.templateId, captureLayoutState());
    emit('layoutChange', currentLayoutChanged.value);
    emitLayerPosition();
    emitSelectionGeometry();
    void syncTransformer();
};

const syncTransformer = async () => {
    await nextTick();
    const transformer = transformerRef.value?.getNode();
    const stage = stageRef.value?.getNode();
    if (!transformer || !stage) {
        return;
    }

    const selectedNodes = selectedElements.value
        .map((elementId) => stage.findOne(`#editable-${elementId}`))
        .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(!isExporting.value ? selectedNodes : []);
    transformer.getLayer()?.batchDraw();
};

const emitLayerPosition = () => {
    if (!selectedElement.value || selectedElements.value.length !== 1) {
        emit('layerPositionChange', 0, 0);
        return;
    }

    const order = layoutOrder.value[props.templateId];
    emit('layerPositionChange', order.indexOf(selectedElement.value) + 1, order.length);
};

const updateSelection = (elementIds: LayoutElementId[]) => {
    selectedElements.value = elementIds.filter(
        (elementId, index) => createLayoutOrder().includes(elementId) && elementIds.indexOf(elementId) === index,
    );
    emit('selectionIdsChange', [...selectedElements.value]);
    emit('selectionChange', selectedElement.value);
    emitLayerPosition();
    emitSelectionGeometry();
    void syncTransformer();
};

const selectElement = (elementId: LayoutElementId, additive = false) => {
    if (!additive) {
        updateSelection([elementId]);
        return;
    }

    updateSelection(selectedElements.value.includes(elementId)
        ? selectedElements.value.filter((candidate) => candidate !== elementId)
        : [...selectedElements.value, elementId]);
};

const clearSelection = () => {
    updateSelection([]);
};

const eventIsAdditive = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) =>
    'ctrlKey' in event.evt && (event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey);

const stagePointerPosition = () => {
    const stage = stageRef.value?.getNode();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) {
        return null;
    }
    return stage.getAbsoluteTransform().copy().invert().point(pointer);
};

const handleStagePointer = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const editableGroup = event.target.findAncestor('.editable-element', true);
    const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;

    if (elementId) {
        selectElement(elementId, eventIsAdditive(event));
        selectionStart = null;
        selectionRectangle.value = null;
        return;
    }

    const pointer = stagePointerPosition();
    if (!pointer) {
        return;
    }
    selectionStart = { ...pointer, additive: eventIsAdditive(event) };
    selectionRectangle.value = { x: pointer.x, y: pointer.y, width: 0, height: 0 };
};

const updateSelectionRectangle = () => {
    const pointer = stagePointerPosition();
    if (!selectionStart || !pointer) {
        return;
    }
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
    selectionStart = null;
    selectionRectangle.value = null;
    if (!rectangle || !start) {
        return;
    }
    if (rectangle.width < 5 && rectangle.height < 5) {
        if (!start.additive) {
            clearSelection();
        }
        return;
    }

    const stage = stageRef.value?.getNode();
    if (!stage) {
        return;
    }
    const matches = createLayoutOrder().filter((elementId) => {
        const node = stage.findOne(`#editable-${elementId}`);
        if (!node) {
            return false;
        }
        const bounds = node.getClientRect({ relativeTo: stage });
        return layoutFramesIntersect(rectangle, bounds);
    });
    updateSelection(start.additive ? [...new Set([...selectedElements.value, ...matches])] : matches);
};

const startElementDrag = (elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!selectedElements.value.includes(elementId)) {
        selectElement(elementId);
    }
    const stage = stageRef.value?.getNode();
    const parent = event.target.getParent();
    if (!stage || !parent) {
        return;
    }
    const nodePositions: Partial<Record<LayoutElementId, { x: number; y: number }>> = {};
    const nodeBounds: Partial<Record<LayoutElementId, LayoutFrame>> = {};
    for (const selectedId of selectedElements.value) {
        const node = stage.findOne(`#editable-${selectedId}`);
        if (node) {
            nodePositions[selectedId] = { ...node.position() };
            nodeBounds[selectedId] = node.getClientRect({ relativeTo: parent, skipStroke: true });
        }
    }
    activeDrag = {
        previousState: captureLayoutState(),
        startPosition: { ...event.target.position() },
        nodePositions,
        nodeBounds,
    };
};

const alignElementWhileDragging = (_elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const parent = node.getParent();
    const stage = stageRef.value?.getNode();
    if (!parent || !stage) {
        return;
    }

    const targetFrames = createLayoutOrder()
        .filter((candidateId) => !selectedElements.value.includes(candidateId))
        .map((candidateId) => stage.findOne(`#editable-${candidateId}`))
        .filter((candidate): candidate is Konva.Node => Boolean(candidate))
        .map((candidate) => candidate.getClientRect({ relativeTo: parent, skipStroke: true }));
    node.position(snapLayoutPoint(node.position(), props.snapEnabled));
    const frame = node.getClientRect({ relativeTo: parent, skipStroke: true });
    const alignment = calculateAlignmentSnap(frame, targetFrames);

    node.position({
        x: node.x() + alignment.offset.x,
        y: node.y() + alignment.offset.y,
    });
    activeAlignmentGuides.value = alignment.guides;

    if (!activeDrag) {
        return;
    }
    const requestedDelta = {
        x: node.x() - activeDrag.startPosition.x,
        y: node.y() - activeDrag.startPosition.y,
    };
    const bounds = Object.values(activeDrag.nodeBounds).filter((value): value is LayoutFrame => Boolean(value));
    const delta = constrainLayoutDelta(bounds, requestedDelta);
    for (const selectedId of selectedElements.value) {
        const selectedNode = stage.findOne(`#editable-${selectedId}`);
        const startPosition = activeDrag.nodePositions[selectedId];
        if (selectedNode && startPosition) {
            selectedNode.position({ x: startPosition.x + delta.x, y: startPosition.y + delta.y });
        }
    }
};

const moveElement = (elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>) => {
    activeAlignmentGuides.value = [];
    const previousState = activeDrag?.previousState ?? captureLayoutState();
    const stage = stageRef.value?.getNode();
    const movedIds = activeDrag ? selectedElements.value : [elementId];
    for (const movedId of movedIds) {
        const node = stage?.findOne(`#editable-${movedId}`) ?? (movedId === elementId ? event.target : null);
        if (!node) {
            continue;
        }
        const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][movedId];
        layoutOffsets.value[props.templateId][movedId] = {
            x: node.x() - baseFrame.x,
            y: node.y() - baseFrame.y,
        };
    }
    activeDrag = null;
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const resizeElement = (elementId: LayoutElementId, event: Konva.KonvaEventObject<Event>) => {
    const node = event.target;
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const currentFrame = elementFrame(elementId);
    const snappedPosition = snapLayoutPoint({ x: node.x(), y: node.y() }, props.snapEnabled);
    const resizedFrame = resizeLayoutFrame(
        { ...currentFrame, ...snappedPosition },
        snapLayoutSize(
            {
                width: currentFrame.width * Math.abs(node.scaleX()),
                height: currentFrame.height * Math.abs(node.scaleY()),
            },
            props.snapEnabled,
        ),
    );
    const rotatedLayout = keepRotatedFrameInDocument(
        resizedFrame,
        snapRotation(node.rotation(), props.snapEnabled),
    );

    if (!rotatedLayout) {
        node.scale({ x: 1, y: 1 });
        node.position({ x: currentFrame.x, y: currentFrame.y });
        node.rotation(layoutRotations.value[props.templateId][elementId]);
        void syncTransformer();
        return;
    }

    const previousState = captureLayoutState();
    node.scale({ x: 1, y: 1 });
    node.position({ x: rotatedLayout.frame.x, y: rotatedLayout.frame.y });
    node.rotation(rotatedLayout.rotation);
    layoutOffsets.value[props.templateId][elementId] = {
        x: rotatedLayout.frame.x - baseFrame.x,
        y: rotatedLayout.frame.y - baseFrame.y,
    };
    layoutSizes.value[props.templateId][elementId] = {
        width: rotatedLayout.frame.width,
        height: rotatedLayout.frame.height,
    };
    layoutRotations.value[props.templateId][elementId] = rotatedLayout.rotation;
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const nudgeSelectedElement = (deltaX: number, deltaY: number) => {
    if (selectedElements.value.length === 0) {
        return;
    }

    const previousState = captureLayoutState();
    const frames = selectedElements.value.map(elementFrame);
    const appliedDelta = constrainLayoutDelta(frames, { x: deltaX, y: deltaY });
    for (const elementId of selectedElements.value) {
        const offset = layoutOffsets.value[props.templateId][elementId];
        layoutOffsets.value[props.templateId][elementId] = {
            x: offset.x + appliedDelta.x,
            y: offset.y + appliedDelta.y,
        };
    }
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const resizeSelectedElement = (deltaWidth: number, deltaHeight: number) => {
    if (selectedElements.value.length === 0) {
        return;
    }

    const previousState = captureLayoutState();
    for (const elementId of selectedElements.value) {
        const frame = elementFrame(elementId);
        const resizedFrame = resizeLayoutFrame(frame, {
            width: frame.width + deltaWidth,
            height: frame.height + deltaHeight,
        });
        layoutSizes.value[props.templateId][elementId] = {
            width: resizedFrame.width,
            height: resizedFrame.height,
        };
    }
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const rotateSelectedElement = (deltaRotation: number) => {
    if (selectedElements.value.length === 0) {
        return;
    }

    const rotations = selectedElements.value.map((elementId) => ({
        elementId,
        layout: keepRotatedFrameInDocument(
            elementFrame(elementId),
            layoutRotations.value[props.templateId][elementId] + deltaRotation,
        ),
    }));
    if (rotations.some(({ layout }) => !layout)) {
        return;
    }

    const previousState = captureLayoutState();
    for (const { elementId, layout } of rotations) {
        if (!layout) continue;
        const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
        layoutOffsets.value[props.templateId][elementId] = {
            x: layout.frame.x - baseFrame.x,
            y: layout.frame.y - baseFrame.y,
        };
        layoutRotations.value[props.templateId][elementId] = layout.rotation;
    }
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const commitSelectedGeometry = (geometry: LayoutGeometry) => {
    if (!selectedElement.value) {
        return;
    }
    const elementId = selectedElement.value;
    const previousState = captureLayoutState();
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    layoutOffsets.value[props.templateId][elementId] = {
        x: geometry.x - baseFrame.x,
        y: geometry.y - baseFrame.y,
    };
    layoutSizes.value[props.templateId][elementId] = {
        width: geometry.width,
        height: geometry.height,
    };
    layoutRotations.value[props.templateId][elementId] = geometry.rotation;
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const setSelectedElementGeometry = (
    field: keyof LayoutGeometry,
    value: number,
) => {
    if (!selectedElement.value || !Number.isFinite(value)) {
        return;
    }

    const elementId = selectedElement.value;
    const geometry = constrainLayoutGeometry({
        ...elementFrame(elementId),
        rotation: layoutRotations.value[props.templateId][elementId],
        [field]: value,
    });
    if (!geometry) {
        emitSelectionGeometry();
        return;
    }

    commitSelectedGeometry(geometry);
};

const setSelectedElementTextStyle = (
    field: keyof LayoutTextStyle,
    value: number | string,
) => {
    if (selectedElements.value.length === 0 || !selectedElement.value) {
        return;
    }

    const currentStyle = layoutTextStyles.value[props.templateId][selectedElement.value];
    const nextStyle = field === 'fontSize'
        ? { ...currentStyle, fontSize: constrainFontSize(Number(value)) }
        : { ...currentStyle, color: String(value).toLowerCase() };
    if (!Number.isFinite(nextStyle.fontSize) || !isHexColor(nextStyle.color)) {
        emitSelectionGeometry();
        return;
    }

    const previousState = captureLayoutState();
    layoutTextStyles.value[props.templateId] = selectedElements.value.reduce(
        (styles, elementId) => ({ ...styles, [elementId]: { ...styles[elementId], [field]: nextStyle[field] } }),
        layoutTextStyles.value[props.templateId],
    );
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

const alignSelectedElement = (alignment: LayoutAlignment) => {
    if (selectedElements.value.length === 0) {
        return;
    }

    if (selectedElements.value.length > 1) {
        const stage = stageRef.value?.getNode();
        if (!stage) {
            return;
        }
        const bounds = selectedElements.value.map((elementId) => ({
            elementId,
            bounds: stage.findOne(`#editable-${elementId}`)?.getClientRect({ relativeTo: stage, skipStroke: true }),
        }));
        if (bounds.some(({ bounds: elementBounds }) => !elementBounds)) {
            return;
        }
        const validBounds = bounds as { elementId: LayoutElementId; bounds: LayoutFrame }[];
        const group = {
            left: Math.min(...validBounds.map(({ bounds: elementBounds }) => elementBounds.x)),
            right: Math.max(...validBounds.map(({ bounds: elementBounds }) => elementBounds.x + elementBounds.width)),
            top: Math.min(...validBounds.map(({ bounds: elementBounds }) => elementBounds.y)),
            bottom: Math.max(...validBounds.map(({ bounds: elementBounds }) => elementBounds.y + elementBounds.height)),
        };
        const previousState = captureLayoutState();
        for (const { elementId, bounds: elementBounds } of validBounds) {
            const shift = {
                left: { x: group.left - elementBounds.x, y: 0 },
                horizontalCenter: {
                    x: (group.left + group.right - elementBounds.width) / 2 - elementBounds.x,
                    y: 0,
                },
                right: { x: group.right - elementBounds.x - elementBounds.width, y: 0 },
                top: { x: 0, y: group.top - elementBounds.y },
                verticalCenter: {
                    x: 0,
                    y: (group.top + group.bottom - elementBounds.height) / 2 - elementBounds.y,
                },
                bottom: { x: 0, y: group.bottom - elementBounds.y - elementBounds.height },
            }[alignment];
            const offset = layoutOffsets.value[props.templateId][elementId];
            layoutOffsets.value[props.templateId][elementId] = {
                x: offset.x + shift.x,
                y: offset.y + shift.y,
            };
        }
        commitCurrentLayout(previousState);
        emit('layoutChange', currentLayoutChanged.value);
        void syncTransformer();
        return;
    }

    const aligned = selectedElements.value.map((elementId) => ({
        elementId,
        geometry: alignLayoutGeometry(
            {
                ...elementFrame(elementId),
                rotation: layoutRotations.value[props.templateId][elementId],
            },
            alignment,
        ),
    }));
    if (aligned.some(({ geometry }) => !geometry)) {
        return;
    }
    const previousState = captureLayoutState();
    for (const { elementId, geometry } of aligned) {
        if (!geometry) continue;
        const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
        layoutOffsets.value[props.templateId][elementId] = {
            x: geometry.x - baseFrame.x,
            y: geometry.y - baseFrame.y,
        };
    }
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const changeSelectedLayer = (direction: -1 | 1) => {
    if (!selectedElement.value || selectedElements.value.length !== 1) {
        return;
    }

    const currentOrder = layoutOrder.value[props.templateId];
    const nextOrder = moveLayoutElementInOrder(currentOrder, selectedElement.value, direction);
    if (nextOrder === currentOrder) {
        return;
    }

    const previousState = captureLayoutState();
    layoutOrder.value[props.templateId] = nextOrder;
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    emitLayerPosition();
    void syncTransformer();
};

const resetLayout = () => {
    const previousState = captureLayoutState();
    layoutOffsets.value[props.templateId] = createLayoutOffsets();
    layoutSizes.value[props.templateId] = createLayoutSizes(props.templateId);
    layoutRotations.value[props.templateId] = createLayoutRotations();
    layoutOrder.value[props.templateId] = createLayoutOrder();
    layoutTextStyles.value[props.templateId] = createLayoutTextStyles(props.templateId);
    commitCurrentLayout(previousState);
    selectedElements.value = [];
    activeAlignmentGuides.value = [];
    emit('selectionChange', null);
    emit('selectionIdsChange', []);
    emitLayerPosition();
    emitSelectionGeometry();
    emit('layoutChange', false);
};

const resetSelectedElement = () => {
    if (selectedElements.value.length === 0) {
        return;
    }

    const previousState = captureLayoutState();
    const reset = selectedElements.value.reduce(
        (state, elementId) => resetLayoutElementState(props.templateId, elementId, state),
        previousState,
    );
    layoutOffsets.value[props.templateId] = reset.offsets;
    layoutSizes.value[props.templateId] = reset.sizes;
    layoutRotations.value[props.templateId] = reset.rotations;
    layoutOrder.value[props.templateId] = reset.order;
    layoutTextStyles.value[props.templateId] = reset.styles;
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    emitLayerPosition();
    void syncTransformer();
};

const undoLayout = () => {
    const result = undoLayoutHistory(layoutHistories.value[props.templateId], captureLayoutState());
    if (!result) {
        return;
    }

    layoutHistories.value[props.templateId] = result.history;
    restoreLayoutState(result.state);
    emitHistoryState();
};

const redoLayout = () => {
    const result = redoLayoutHistory(layoutHistories.value[props.templateId], captureLayoutState());
    if (!result) {
        return;
    }

    layoutHistories.value[props.templateId] = result.history;
    restoreLayoutState(result.state);
    emitHistoryState();
};

const restoreDraftLayouts = () => {
    for (const templateId of ['split', 'poster'] as const) {
        const savedState = props.initialLayouts[templateId];
        const restored = savedState
            ? cloneLayoutState(savedState)
            : {
                  offsets: createLayoutOffsets(),
                  sizes: createLayoutSizes(templateId),
                  rotations: createLayoutRotations(),
                  order: createLayoutOrder(),
                  styles: createLayoutTextStyles(templateId),
              };
        layoutOffsets.value[templateId] = restored.offsets;
        layoutSizes.value[templateId] = restored.sizes;
        layoutRotations.value[templateId] = restored.rotations;
        layoutOrder.value[templateId] = restored.order;
        layoutTextStyles.value[templateId] = restored.styles;
        layoutHistories.value[templateId] = createLayoutHistory();
    }
    selectedElements.value = [];
    activeAlignmentGuides.value = [];
    emit('selectionChange', null);
    emit('selectionIdsChange', []);
    emitLayerPosition();
    emitSelectionGeometry();
    emitHistoryState();
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

watch(
    () => props.template.imageUrl,
    (imageUrl, _, onCleanup) => {
        image.value = null;

        if (!imageUrl) {
            imageStatus.value = 'idle';
            return;
        }

        imageStatus.value = 'loading';
        const nextImage = new Image();
        nextImage.crossOrigin = 'anonymous';
        nextImage.onload = () => {
            image.value = nextImage;
            imageStatus.value = 'loaded';
        };
        nextImage.onerror = () => {
            image.value = null;
            imageStatus.value = 'error';
        };
        nextImage.src = imageUrl;

        onCleanup(() => {
            nextImage.onload = null;
            nextImage.onerror = null;
        });
    },
    { immediate: true },
);

watch(imageStatus, (status) => emit('imageStatus', status), { immediate: true });
watch(() => props.draftId, restoreDraftLayouts, { immediate: true });
watch(
    () => props.templateId,
    () => {
        selectedElements.value = [];
        activeAlignmentGuides.value = [];
        emit('selectionChange', null);
        emit('selectionIdsChange', []);
        emitLayerPosition();
        emitSelectionGeometry();
        emitHistoryState();
        emit('layoutChange', currentLayoutChanged.value);
        void syncTransformer();
    },
);

onMounted(() => {
    emitHistoryState();
    if (!containerRef.value) {
        return;
    }

    resizeObserver = new ResizeObserver(([entry]) => {
        if (entry) {
            containerWidth.value = entry.contentRect.width;
        }
    });
    resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());

const exportPng = async () => {
    await document.fonts.ready;

    if (imageStatus.value === 'loading') {
        throw new Error('Das Veranstaltungsbild wird noch geladen.');
    }

    const stage = stageRef.value?.getNode();
    if (!stage) {
        throw new Error('Die Vorschau ist noch nicht bereit.');
    }

    const previewState = {
        width: stage.width(),
        height: stage.height(),
        scaleX: stage.scaleX(),
        scaleY: stage.scaleY(),
    };

    try {
        isExporting.value = true;
        await syncTransformer();
        stage.size({ width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT });
        stage.scale({ x: 1, y: 1 });
        stage.draw();
        return stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    } finally {
        isExporting.value = false;
        stage.size({ width: previewState.width, height: previewState.height });
        stage.scale({ x: previewState.scaleX, y: previewState.scaleY });
        await syncTransformer();
        stage.draw();
    }
};

defineExpose({
    alignSelectedElement,
    changeSelectedLayer,
    clearSelection,
    exportPng,
    nudgeSelectedElement,
    redoLayout,
    resetLayout,
    resetSelectedElement,
    resizeSelectedElement,
    rotateSelectedElement,
    setSelectedElementGeometry,
    setSelectedElementTextStyle,
    selectElement,
    undoLayout,
});
</script>

<template>
    <div ref="containerRef" class="template-preview">
        <v-stage
            ref="stageRef"
            :config="stageConfig"
            @mousedown="handleStagePointer"
            @mousemove="updateSelectionRectangle"
            @mouseup="finishSelectionRectangle"
            @mouseleave="finishSelectionRectangle"
            @touchstart="handleStagePointer"
            @touchmove="updateSelectionRectangle"
            @touchend="finishSelectionRectangle"
            @touchcancel="finishSelectionRectangle"
        >
            <v-layer>
                <template v-for="decoration in decorationLayers('behindImage')" :key="decoration.id">
                    <v-rect v-if="decoration.type === 'rect'" :config="decorationConfig(decoration)" />
                    <v-text v-else :config="decorationConfig(decoration)" />
                </template>
                <v-image v-if="imageStatus === 'loaded'" :config="imageConfig" />
                <template v-for="decoration in decorationLayers('overImage')" :key="decoration.id">
                    <v-rect v-if="decoration.type === 'rect'" :config="decorationConfig(decoration)" />
                    <v-text v-else :config="decorationConfig(decoration)" />
                </template>
                <v-group>
                    <template v-for="binding in TEMPLATE_TEXT_BINDINGS" :key="binding">
                        <EditableTextElement
                            v-if="binding !== 'location' || template.location"
                            :element-id="binding"
                            :frame="elementFrame(binding)"
                            :rotation="layoutRotations[templateId][binding]"
                            :selected="selectedElements.includes(binding) && !isExporting"
                            :z-index="layoutOrder[templateId].indexOf(binding)"
                            :text-config="editableTextConfig(binding)"
                            @drag-start="startElementDrag"
                            @dragging="alignElementWhileDragging"
                            @move="moveElement"
                            @resize="resizeElement"
                        />
                    </template>
                </v-group>
            </v-layer>
            <v-layer v-if="!isExporting" :config="{ listening: false }">
                <v-rect
                    v-if="selectionRectangle"
                    :config="{
                        ...selectionRectangle,
                        fill: 'rgba(36, 121, 197, 0.14)',
                        stroke: '#2479c5',
                        strokeWidth: 3,
                        dash: [12, 8],
                    }"
                />
                <v-line
                    v-for="guide in activeAlignmentGuides"
                    :key="`${guide.orientation}-${guide.position}`"
                    :config="{
                        points: guide.orientation === 'vertical'
                            ? [guide.position, 0, guide.position, DOCUMENT_HEIGHT]
                            : [0, guide.position, DOCUMENT_WIDTH, guide.position],
                        stroke: '#ee3d8f',
                        strokeWidth: 4,
                        dash: [18, 12],
                    }"
                />
            </v-layer>
            <v-layer>
                <v-transformer ref="transformerRef" :config="transformerConfig" />
            </v-layer>
        </v-stage>
    </div>
</template>
