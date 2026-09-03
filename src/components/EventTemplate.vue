<script setup lang="ts">
import type Konva from 'konva';
import type { Box } from 'konva/lib/shapes/Transformer';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import EditableTextElement from './EditableTextElement.vue';
import EditableVisualElement from './EditableVisualElement.vue';
import type { EventTemplateProps } from '../domain/EventTemplateProps';
import { calculateCoverCrop, type ImageFocus } from '../domain/imageFocus';
import {
    alignLayoutGeometry,
    calculateAlignmentSnap,
    constrainLayoutGeometry,
    constrainLayoutDelta,
    constrainFontSize,
    constrainLetterSpacing,
    constrainLineHeight,
    createLayoutGroups,
    createLayoutOrder,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutVisualStyles,
    expandLayoutSelection,
    flattenLayoutGroups,
    findLayoutGroupDepth,
    groupLayoutElements,
    isHexColor,
    keepRotatedFrameInDocument,
    layoutGroupElementIds,
    layoutFramesIntersect,
    type AlignmentGuide,
    type LayoutElementId,
    type LayoutFrame,
    type LayoutGeometry,
    type LayoutGroup,
    type LayoutGroups,
    type LayoutAlignment,
    type LayoutTextStyle,
    type LayoutTextStyles,
    type LayoutVisualStyle,
    type LayoutVisualStyles,
    LAYOUT_ELEMENT_IDS,
    SHAPE_LAYOUT_ELEMENT_IDS,
    TEXT_LAYOUT_ELEMENT_IDS,
    moveLayoutElementInOrder,
    resizeLayoutFrame,
    resolveLayoutSelectionTarget,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
    ungroupLayoutElements,
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
    scaleTemplateDefinition,
    TEMPLATE_TEXT_BINDINGS,
    type TemplateDecoration,
    type TemplateDecorationPlacement,
    type TemplateTextBinding,
} from '../domain/templateDefinition';
import { calculatePreviewScale } from '../utils/stageDimensions';

type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

const props = defineProps<{
    draftId: string;
    documentHeight: number;
    documentWidth: number;
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
    availableElementsChange: [elementIds: LayoutElementId[]];
    layerPositionChange: [position: number, total: number];
    selectionChange: [elementId: LayoutElementId | null];
    selectionIdsChange: [elementIds: LayoutElementId[]];
    selectionGroupChange: [canGroup: boolean, canUngroup: boolean, groupDepth: number];
    selectionDefaultChange: [changed: boolean];
    selectionGeometryChange: [geometry: (LayoutGeometry & { elementId: LayoutElementId }) | null];
    selectionStyleChange: [style: (LayoutTextStyle & { elementId: LayoutElementId }) | null];
    selectionVisualStyleChange: [style: (LayoutVisualStyle & { elementId: LayoutElementId }) | null];
}>();

const scaledTemplateDefinitions = computed(() => ({
    split: scaleTemplateDefinition(BUILT_IN_TEMPLATE_DEFINITIONS.split, props.documentWidth, props.documentHeight),
    poster: scaleTemplateDefinition(BUILT_IN_TEMPLATE_DEFINITIONS.poster, props.documentWidth, props.documentHeight),
}));
const templateElementFrames = computed(() => ({
    split: createPageElementFrames('split'),
    poster: createPageElementFrames('poster'),
}));
function createPageElementFrames(templateId: TemplateId): Record<LayoutElementId, LayoutFrame> {
    const definition = scaledTemplateDefinitions.value[templateId];
    const decorationFrame = (id: 'background' | 'accent') => ({
        ...definition.composition.decorations.find((decoration) => decoration.id === id)!.frame,
    });
    return {
        background: decorationFrame('background'),
        image: { ...definition.composition.imageFrame },
        accent: decorationFrame('accent'),
        title: { ...definition.elements.title.frame },
        dateTime: { ...definition.elements.dateTime.frame },
        location: { ...definition.elements.location.frame },
    };
}
const createPageLayoutSizes = (templateId: TemplateId) => Object.fromEntries(
    LAYOUT_ELEMENT_IDS.map((elementId) => [elementId, {
        width: templateElementFrames.value[templateId][elementId].width,
        height: templateElementFrames.value[templateId][elementId].height,
    }]),
) as Record<LayoutElementId, { width: number; height: number }>;
const createPageLayoutTextStyles = (templateId: TemplateId) => Object.fromEntries(
    TEMPLATE_TEXT_BINDINGS.map((binding) => [binding, {
        fontSize: scaledTemplateDefinitions.value[templateId].elements[binding].style.fontSize,
        color: scaledTemplateDefinitions.value[templateId].elements[binding].style.color,
        fontFamily: scaledTemplateDefinitions.value[templateId].elements[binding].style.fontFamily,
        fontStyle: scaledTemplateDefinitions.value[templateId].elements[binding].style.fontStyle,
        lineHeight: scaledTemplateDefinitions.value[templateId].elements[binding].style.lineHeight,
        letterSpacing: 0,
        align: scaledTemplateDefinitions.value[templateId].elements[binding].style.align,
        listStyle: 'none',
    }]),
) as LayoutTextStyles;
const createPageLayoutVisualStyles = (templateId: TemplateId): LayoutVisualStyles => {
    const defaults = createLayoutVisualStyles(templateId);
    return {
        background: { ...defaults.background },
        accent: { ...defaults.accent },
    };
};

const stageRef = ref<VueKonvaRef<Konva.Stage> | null>(null);
const transformerRef = ref<VueKonvaRef<Konva.Transformer> | null>(null);
const image = shallowRef<HTMLImageElement | null>(null);
const imageStatus = ref<ImageStatus>('idle');
const selectedElements = ref<LayoutElementId[]>([]);
const selectedElement = computed(() => selectedElements.value.at(-1) ?? null);
const selectedGroupId = ref<string | null>(null);
const isExporting = ref(false);
const activeAlignmentGuides = ref<AlignmentGuide[]>([]);
const selectionRectangle = ref<LayoutFrame | null>(null);
const layoutOffsets = ref<Record<TemplateId, ReturnType<typeof createLayoutOffsets>>>({
    split: createLayoutOffsets(),
    poster: createLayoutOffsets(),
});
const layoutSizes = ref<Record<TemplateId, ReturnType<typeof createPageLayoutSizes>>>({
    split: createPageLayoutSizes('split'),
    poster: createPageLayoutSizes('poster'),
});
const layoutRotations = ref<Record<TemplateId, ReturnType<typeof createLayoutRotations>>>({
    split: createLayoutRotations(),
    poster: createLayoutRotations(),
});
const layoutOrder = ref<Record<TemplateId, ReturnType<typeof createLayoutOrder>>>({
    split: createLayoutOrder(),
    poster: createLayoutOrder(),
});
const layoutTextStyles = ref<Record<TemplateId, ReturnType<typeof createPageLayoutTextStyles>>>({
    split: createPageLayoutTextStyles('split'),
    poster: createPageLayoutTextStyles('poster'),
});
const layoutVisualStyles = ref<Record<TemplateId, ReturnType<typeof createPageLayoutVisualStyles>>>({
    split: createPageLayoutVisualStyles('split'),
    poster: createPageLayoutVisualStyles('poster'),
});
const layoutGroups = ref<Record<TemplateId, ReturnType<typeof createLayoutGroups>>>({
    split: createLayoutGroups(),
    poster: createLayoutGroups(),
});
const deletedElements = ref<Record<TemplateId, LayoutElementId[]>>({ split: [], poster: [] });
const availableElements = computed(() =>
    layoutOrder.value[props.templateId].filter((elementId) => !deletedElements.value[props.templateId].includes(elementId)));
const layoutHistories = ref<Record<TemplateId, ReturnType<typeof createLayoutHistory>>>({
    split: createLayoutHistory(),
    poster: createLayoutHistory(),
});
let layoutGroupSequence = 0;
let selectionStart: { x: number; y: number; additive: boolean } | null = null;
let activeDrag: {
    previousState: SerializableLayoutState;
    startPosition: { x: number; y: number };
    nodePositions: Partial<Record<LayoutElementId, { x: number; y: number }>>;
    nodeBounds: Partial<Record<LayoutElementId, LayoutFrame>>;
} | null = null;

const previewScale = computed(() => calculatePreviewScale(props.documentWidth, props.previewZoom, props.documentWidth));
const documentSize = computed(() => ({ width: props.documentWidth, height: props.documentHeight }));
const stageConfig = computed(() => ({
    width: props.documentWidth * previewScale.value,
    height: props.documentHeight * previewScale.value,
    scaleX: previewScale.value,
    scaleY: previewScale.value,
}));
const templateDefinition = computed(() => scaledTemplateDefinitions.value[props.templateId]);
const imageIsVisible = computed(() =>
    imageStatus.value === 'loaded' && !deletedElements.value[props.templateId].includes('image'));
const transformerConfig = computed(() => ({
    rotateEnabled: selectedElements.value.length === 1,
    flipEnabled: false,
    keepRatio: false,
    enabledAnchors: selectedElements.value.length === 1
        ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
        : [],
    anchorFill: '#ffffff',
    anchorStroke: '#2479c5',
    anchorSize: 7,
    borderStroke: '#2479c5',
    borderStrokeWidth: 1,
    rotateAnchorOffset: 18,
    rotationSnaps: props.snapEnabled
        ? [-180, -165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
        : [],
    rotationSnapTolerance: 5,
    boundBoxFunc: (oldBox: Box, newBox: Box) => {
        const insideDocument =
            newBox.x >= 0 &&
            newBox.y >= 0 &&
            newBox.x + newBox.width <= props.documentWidth &&
            newBox.y + newBox.height <= props.documentHeight;
        return newBox.width >= 120 && newBox.height >= 50 && insideDocument ? newBox : oldBox;
    },
}));

const imageCrop = computed(() => {
    if (!image.value) {
        return undefined;
    }

    const imageFrame = elementFrame('image');
    return calculateCoverCrop(
        { width: image.value.naturalWidth, height: image.value.naturalHeight },
        { width: imageFrame.width, height: imageFrame.height },
        props.imageFocus,
    ) ?? undefined;
});

const imageConfig = computed(() => ({
    image: image.value ?? undefined,
    crop: imageCrop.value,
}));

const decorationLayers = (placement: TemplateDecorationPlacement) =>
    templateDefinition.value.composition.decorations.filter((decoration) =>
        decoration.placement === placement &&
        decoration.id !== 'background' && decoration.id !== 'accent' &&
        (decoration.visibility === 'always' || !imageIsVisible.value),
    );

const visualConfig = (elementId: 'background' | 'accent') => ({
    fill: layoutVisualStyles.value[props.templateId][elementId].fill,
    stroke: layoutVisualStyles.value[props.templateId][elementId].stroke,
    strokeWidth: layoutVisualStyles.value[props.templateId][elementId].strokeWidth,
});

const decorationConfig = (decoration: TemplateDecoration) => ({
    ...decoration.frame,
    listening: false,
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
              opacity: imageIsVisible.value && decoration.imageLoadedOpacity !== undefined
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

const applyListStyle = (text: string, listStyle: LayoutTextStyle['listStyle']) => {
    if (listStyle === 'none') {
        return text;
    }
    return text.split('\n').map((line, index) =>
        line.trim() ? `${listStyle === 'bullet' ? '•' : `${index + 1}.`} ${line}` : line).join('\n');
};

const editableTextConfig = (binding: TemplateTextBinding) => {
    const definitionStyle = templateDefinition.value.elements[binding].style;
    const editableStyle = layoutTextStyles.value[props.templateId][binding];
    return {
        text: applyListStyle(editableTextValues.value[binding], editableStyle.listStyle),
        fill: editableStyle.color,
        fontSize: editableStyle.fontSize,
        fontFamily: editableStyle.fontFamily,
        fontStyle: editableStyle.fontStyle,
        lineHeight: editableStyle.lineHeight,
        letterSpacing: editableStyle.letterSpacing,
        wrap: definitionStyle.wrap,
        ellipsis: definitionStyle.ellipsis,
        align: editableStyle.align,
    };
};
const currentLayoutChanged = computed(() => {
    const geometryChanged = (
        Object.entries(layoutOffsets.value[props.templateId]) as [LayoutElementId, { x: number; y: number }][]
    ).some(
        ([elementId, { x, y }]) => {
            const size = layoutSizes.value[props.templateId][elementId];
            const base = templateElementFrames.value[props.templateId][elementId];
            const rotation = layoutRotations.value[props.templateId][elementId];
            return x !== 0 || y !== 0 || size.width !== base.width || size.height !== base.height || rotation !== 0;
        },
    );
    const defaultOrder = createLayoutOrder();
    const orderChanged = layoutOrder.value[props.templateId].length !== defaultOrder.length ||
        layoutOrder.value[props.templateId].some(
        (elementId, index) => elementId !== defaultOrder[index],
    );
    const defaultStyles = createPageLayoutTextStyles(props.templateId);
    const textStyleChanged = TEXT_LAYOUT_ELEMENT_IDS.some((elementId) => {
        const style = layoutTextStyles.value[props.templateId][elementId];
        return JSON.stringify(style) !== JSON.stringify(defaultStyles[elementId]);
    });
    const defaultVisualStyles = createPageLayoutVisualStyles(props.templateId);
    const visualStyleChanged = SHAPE_LAYOUT_ELEMENT_IDS.some((elementId) => {
        const style = layoutVisualStyles.value[props.templateId][elementId];
        const defaultStyle = defaultVisualStyles[elementId];
        return style.fill !== defaultStyle.fill || style.stroke !== defaultStyle.stroke ||
            style.strokeWidth !== defaultStyle.strokeWidth;
    });
    return geometryChanged || orderChanged || textStyleChanged || visualStyleChanged ||
        deletedElements.value[props.templateId].length > 0 ||
        layoutGroups.value[props.templateId].length > 0;
});

const elementFrame = (elementId: LayoutElementId): LayoutFrame => {
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
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

const elementIsDefault = (elementId: LayoutElementId) => {
    const frame = elementFrame(elementId);
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
    const geometryChanged = frame.x !== baseFrame.x || frame.y !== baseFrame.y ||
        frame.width !== baseFrame.width || frame.height !== baseFrame.height ||
        layoutRotations.value[props.templateId][elementId] !== 0 ||
        layoutOrder.value[props.templateId].indexOf(elementId) !== createLayoutOrder().indexOf(elementId);
    if (TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number])) {
        const textId = elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number];
        const style = layoutTextStyles.value[props.templateId][textId];
        const defaultStyle = createPageLayoutTextStyles(props.templateId)[textId];
        return !geometryChanged && JSON.stringify(style) === JSON.stringify(defaultStyle);
    }
    if (SHAPE_LAYOUT_ELEMENT_IDS.includes(elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number])) {
        const shapeId = elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number];
        const style = layoutVisualStyles.value[props.templateId][shapeId];
        const defaultStyle = createPageLayoutVisualStyles(props.templateId)[shapeId];
        return !geometryChanged && style.fill === defaultStyle.fill && style.stroke === defaultStyle.stroke &&
            style.strokeWidth === defaultStyle.strokeWidth;
    }
    return !geometryChanged;
};

const emitSelectionGeometry = () => {
    if (!selectedElement.value) {
        emit('selectionGeometryChange', null);
        emit('selectionStyleChange', null);
        emit('selectionVisualStyleChange', null);
        emit('selectionDefaultChange', false);
        return;
    }

    const elementId = selectedElement.value;
    if (selectedElements.value.length > 1) {
        emit('selectionGeometryChange', null);
        const textId = TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number])
            ? elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number] : null;
        const shapeId = SHAPE_LAYOUT_ELEMENT_IDS.includes(elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number])
            ? elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number] : null;
        emit('selectionStyleChange', textId ? { elementId, ...layoutTextStyles.value[props.templateId][textId] } : null);
        emit('selectionVisualStyleChange', shapeId ? { elementId, ...layoutVisualStyles.value[props.templateId][shapeId] } : null);
        emit('selectionDefaultChange', selectedElements.value.some((selectedId) => !elementIsDefault(selectedId)));
        return;
    }

    const frame = elementFrame(elementId);
    emit('selectionGeometryChange', {
        elementId,
        ...frame,
        rotation: layoutRotations.value[props.templateId][elementId],
    });
    const textId = TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number])
        ? elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number] : null;
    const shapeId = SHAPE_LAYOUT_ELEMENT_IDS.includes(elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number])
        ? elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number] : null;
    emit('selectionStyleChange', textId ? { elementId, ...layoutTextStyles.value[props.templateId][textId] } : null);
    emit('selectionVisualStyleChange', shapeId ? { elementId, ...layoutVisualStyles.value[props.templateId][shapeId] } : null);
    emit('selectionDefaultChange', !elementIsDefault(elementId));
};

const captureLayoutState = (): SerializableLayoutState =>
    cloneLayoutState({
        offsets: layoutOffsets.value[props.templateId],
        sizes: layoutSizes.value[props.templateId],
        rotations: layoutRotations.value[props.templateId],
        order: layoutOrder.value[props.templateId],
        styles: layoutTextStyles.value[props.templateId],
        visualStyles: layoutVisualStyles.value[props.templateId],
        groups: layoutGroups.value[props.templateId],
        deleted: deletedElements.value[props.templateId],
    });

const getLayoutState = () => captureLayoutState();

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
    layoutVisualStyles.value[props.templateId] = restored.visualStyles;
    layoutGroups.value[props.templateId] = restored.groups;
    deletedElements.value[props.templateId] = restored.deleted;
    emit('availableElementsChange', availableElements.value);
    emit('layoutStateChange', props.templateId, captureLayoutState());
    emit('layoutChange', currentLayoutChanged.value);
    const restoredGroupId = flattenLayoutGroups(restored.groups)
        .some((group) => group.id === selectedGroupId.value)
        ? selectedGroupId.value
        : null;
    updateSelection(selectedElements.value, restoredGroupId);
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

const updateSelection = (elementIds: LayoutElementId[], groupId: string | null = null) => {
    selectedElements.value = elementIds.filter(
        (elementId, index) => createLayoutOrder().includes(elementId) && elementIds.indexOf(elementId) === index,
    );
    selectedGroupId.value = groupId;
    emit('selectionIdsChange', [...selectedElements.value]);
    emit('selectionChange', selectedElement.value);
    const groups = flattenLayoutGroups(layoutGroups.value[props.templateId]);
    const selectionIsOneGroup = groups.some((group) =>
        layoutGroupElementIds(group).length === selectedElements.value.length &&
        layoutGroupElementIds(group).every((elementId) => selectedElements.value.includes(elementId)),
    );
    emit(
        'selectionGroupChange',
        selectedElements.value.length >= 2 && !selectionIsOneGroup,
        groups.some((group) =>
            layoutGroupElementIds(group).every((elementId) => selectedElements.value.includes(elementId)),
        ),
        selectedGroupId.value
            ? findLayoutGroupDepth(layoutGroups.value[props.templateId], selectedGroupId.value)
            : 0,
    );
    emitLayerPosition();
    emitSelectionGeometry();
    void syncTransformer();
};

const createLayoutGroupId = () => `group-${Date.now()}-${layoutGroupSequence++}`;

const groupSelectedElements = () => {
    if (selectedElements.value.length < 2) {
        return;
    }
    const previousState = captureLayoutState();
    const currentGroups = layoutGroups.value[props.templateId];
    const groupId = createLayoutGroupId();
    const nextGroups = groupLayoutElements(currentGroups, selectedElements.value, groupId);
    if (nextGroups === currentGroups) {
        return;
    }
    layoutGroups.value[props.templateId] = nextGroups;
    commitCurrentLayout(previousState);
    updateSelection(selectedElements.value, groupId);
    emit('layoutChange', currentLayoutChanged.value);
};

const ungroupSelectedElements = () => {
    if (selectedElements.value.length === 0) {
        return;
    }
    const previousState = captureLayoutState();
    const currentGroups = layoutGroups.value[props.templateId];
    const nextGroups = ungroupLayoutElements(currentGroups, selectedElements.value);
    if (nextGroups.length === currentGroups.length &&
        nextGroups.every((group, index) => group === currentGroups[index])) {
        return;
    }
    layoutGroups.value[props.templateId] = nextGroups;
    commitCurrentLayout(previousState);
    updateSelection(selectedElements.value);
    emit('layoutChange', currentLayoutChanged.value);
};

const selectElement = (elementId: LayoutElementId, additive = false) => {
    const target = resolveLayoutSelectionTarget(
        layoutGroups.value[props.templateId],
        elementId,
        selectedGroupId.value,
        false,
    );
    if (!additive) {
        updateSelection(target.elementIds, target.groupId);
        return;
    }

    const groupSelection = expandLayoutSelection(layoutGroups.value[props.templateId], [elementId]);
    updateSelection(selectedElements.value.includes(elementId)
        ? selectedElements.value.filter((candidate) => !groupSelection.includes(candidate))
        : [...selectedElements.value, ...groupSelection]);
};

const drillIntoElement = (elementId: LayoutElementId) => {
    const target = resolveLayoutSelectionTarget(
        layoutGroups.value[props.templateId],
        elementId,
        selectedGroupId.value,
        true,
    );
    updateSelection(target.elementIds, target.groupId);
};

const selectGroup = (groupId: string, additive = false) => {
    const group = flattenLayoutGroups(layoutGroups.value[props.templateId])
        .find((candidate) => candidate.id === groupId);
    if (!group) {
        return;
    }
    const elementIds = layoutGroupElementIds(group).filter((elementId) =>
        !deletedElements.value[props.templateId].includes(elementId));
    if (!additive) {
        updateSelection(elementIds, groupId);
        return;
    }
    const fullySelected = elementIds.every((elementId) => selectedElements.value.includes(elementId));
    updateSelection(
        fullySelected
            ? selectedElements.value.filter((elementId) => !elementIds.includes(elementId))
            : [...selectedElements.value, ...elementIds],
        fullySelected ? null : groupId,
    );
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

const handleStageDoubleClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const editableGroup = event.target.findAncestor('.editable-element', true);
    const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;
    if (elementId) {
        drillIntoElement(elementId);
    }
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
    const expandedMatches = expandLayoutSelection(layoutGroups.value[props.templateId], matches);
    updateSelection(start.additive ? [...new Set([...selectedElements.value, ...expandedMatches])] : expandedMatches);
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
    const alignment = calculateAlignmentSnap(frame, targetFrames, 10, documentSize.value);

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
    const delta = constrainLayoutDelta(bounds, requestedDelta, documentSize.value);
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
        const baseFrame = templateElementFrames.value[props.templateId][movedId];
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
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
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
        documentSize.value,
    );
    const rotatedLayout = keepRotatedFrameInDocument(
        resizedFrame,
        snapRotation(node.rotation(), props.snapEnabled),
        documentSize.value,
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
    const appliedDelta = constrainLayoutDelta(frames, { x: deltaX, y: deltaY }, documentSize.value);
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
        }, documentSize.value);
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
            documentSize.value,
        ),
    }));
    if (rotations.some(({ layout }) => !layout)) {
        return;
    }

    const previousState = captureLayoutState();
    for (const { elementId, layout } of rotations) {
        if (!layout) continue;
        const baseFrame = templateElementFrames.value[props.templateId][elementId];
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
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
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
    }, documentSize.value);
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
    if (selectedElements.value.length === 0 || !selectedElement.value ||
        !TEXT_LAYOUT_ELEMENT_IDS.includes(selectedElement.value as typeof TEXT_LAYOUT_ELEMENT_IDS[number])) {
        return;
    }

    const selectedTextId = selectedElement.value as typeof TEXT_LAYOUT_ELEMENT_IDS[number];
    const currentStyle = layoutTextStyles.value[props.templateId][selectedTextId];
    const nextValue = field === 'fontSize'
        ? constrainFontSize(Number(value))
        : field === 'lineHeight'
            ? constrainLineHeight(Number(value))
            : field === 'letterSpacing'
                ? constrainLetterSpacing(Number(value))
                : field === 'color' ? String(value).toLowerCase() : String(value);
    const nextStyle = { ...currentStyle, [field]: nextValue } as LayoutTextStyle;
    if (!Number.isFinite(nextStyle.fontSize) || !isHexColor(nextStyle.color) ||
        !nextStyle.fontFamily.trim() || !['normal', 'bold', 'italic', 'bold italic'].includes(nextStyle.fontStyle) ||
        !Number.isFinite(nextStyle.lineHeight) || !Number.isFinite(nextStyle.letterSpacing) ||
        !['left', 'center', 'right'].includes(nextStyle.align) ||
        !['none', 'bullet', 'numbered'].includes(nextStyle.listStyle)) {
        emitSelectionGeometry();
        return;
    }

    const previousState = captureLayoutState();
    layoutTextStyles.value[props.templateId] = selectedElements.value.reduce(
        (styles, elementId) => TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number])
            ? { ...styles, [elementId]: { ...styles[elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number]], [field]: nextStyle[field] } }
            : styles,
        layoutTextStyles.value[props.templateId],
    );
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

const setSelectedElementVisualStyle = (
    field: keyof LayoutVisualStyle,
    value: number | string,
) => {
    if (!selectedElement.value ||
        !SHAPE_LAYOUT_ELEMENT_IDS.includes(selectedElement.value as typeof SHAPE_LAYOUT_ELEMENT_IDS[number])) {
        return;
    }
    const shapeId = selectedElement.value as typeof SHAPE_LAYOUT_ELEMENT_IDS[number];
    const nextValue = field === 'strokeWidth' ? Number(value) : String(value).toLowerCase();
    if ((field === 'strokeWidth' && (!Number.isFinite(nextValue) || Number(nextValue) < 0 || Number(nextValue) > 100)) ||
        (field !== 'strokeWidth' && !isHexColor(String(nextValue)))) {
        emitSelectionGeometry();
        return;
    }
    const previousState = captureLayoutState();
    layoutVisualStyles.value[props.templateId][shapeId] = {
        ...layoutVisualStyles.value[props.templateId][shapeId],
        [field]: nextValue,
    };
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
            documentSize.value,
        ),
    }));
    if (aligned.some(({ geometry }) => !geometry)) {
        return;
    }
    const previousState = captureLayoutState();
    for (const { elementId, geometry } of aligned) {
        if (!geometry) continue;
        const baseFrame = templateElementFrames.value[props.templateId][elementId];
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

const pruneDeletedElementsFromGroups = (groups: LayoutGroups, deleted: Set<LayoutElementId>): LayoutGroups =>
    groups.flatMap((group) => {
        const children: (LayoutElementId | LayoutGroup)[] = group.children.flatMap((child): (LayoutElementId | LayoutGroup)[] => {
            if (typeof child === 'string') {
                return deleted.has(child) ? [] : [child];
            }
            return pruneDeletedElementsFromGroups([child], deleted);
        });
        return children.length >= 2 ? [{ ...group, children }] : [];
    });

const deleteElements = (elementIds: LayoutElementId[]) => {
    const existingIds = elementIds.filter((elementId) =>
        layoutOrder.value[props.templateId].includes(elementId));
    if (existingIds.length === 0) {
        return;
    }
    const previousState = captureLayoutState();
    const deleted = new Set([...deletedElements.value[props.templateId], ...existingIds]);
    deletedElements.value[props.templateId] = createLayoutOrder().filter((elementId) => deleted.has(elementId));
    layoutOrder.value[props.templateId] = layoutOrder.value[props.templateId].filter((elementId) => !deleted.has(elementId));
    layoutGroups.value[props.templateId] = pruneDeletedElementsFromGroups(layoutGroups.value[props.templateId], deleted);
    commitCurrentLayout(previousState);
    updateSelection([]);
    emit('availableElementsChange', availableElements.value);
    emit('layoutChange', currentLayoutChanged.value);
};

const deleteSelectedElements = () => deleteElements(selectedElements.value);

const resetLayout = () => {
    const previousState = captureLayoutState();
    layoutOffsets.value[props.templateId] = createLayoutOffsets();
    layoutSizes.value[props.templateId] = createPageLayoutSizes(props.templateId);
    layoutRotations.value[props.templateId] = createLayoutRotations();
    layoutOrder.value[props.templateId] = createLayoutOrder();
    layoutTextStyles.value[props.templateId] = createPageLayoutTextStyles(props.templateId);
    layoutVisualStyles.value[props.templateId] = createPageLayoutVisualStyles(props.templateId);
    layoutGroups.value[props.templateId] = createLayoutGroups();
    deletedElements.value[props.templateId] = [];
    commitCurrentLayout(previousState);
    selectedElements.value = [];
    selectedGroupId.value = null;
    activeAlignmentGuides.value = [];
    emit('selectionChange', null);
    emit('selectionIdsChange', []);
    emit('selectionGroupChange', false, false, 0);
    emitLayerPosition();
    emitSelectionGeometry();
    emit('availableElementsChange', availableElements.value);
    emit('layoutChange', false);
};

const resetSelectedElement = () => {
    if (selectedElements.value.length === 0) {
        return;
    }

    const previousState = captureLayoutState();
    const reset = selectedElements.value.reduce<SerializableLayoutState>(
        (state, elementId) => {
            const defaultOrder = createLayoutOrder();
            const order = state.order.filter((candidate) => candidate !== elementId);
            order.splice(defaultOrder.indexOf(elementId), 0, elementId);
            return {
                ...state,
                offsets: { ...state.offsets, [elementId]: { x: 0, y: 0 } },
                sizes: { ...state.sizes, [elementId]: { ...createPageLayoutSizes(props.templateId)[elementId] } },
                rotations: { ...state.rotations, [elementId]: 0 },
                order,
                styles: {
                    ...state.styles,
                    ...(TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number])
                        ? { [elementId]: { ...createPageLayoutTextStyles(props.templateId)[elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number]] } }
                        : {}),
                },
                visualStyles: {
                    ...state.visualStyles,
                    ...(SHAPE_LAYOUT_ELEMENT_IDS.includes(elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number])
                        ? { [elementId]: { ...createPageLayoutVisualStyles(props.templateId)[elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number]] } }
                        : {}),
                },
                groups: state.groups,
            };
        },
        previousState,
    );
    layoutOffsets.value[props.templateId] = reset.offsets;
    layoutSizes.value[props.templateId] = reset.sizes;
    layoutRotations.value[props.templateId] = reset.rotations;
    layoutOrder.value[props.templateId] = reset.order;
    layoutTextStyles.value[props.templateId] = reset.styles;
    layoutVisualStyles.value[props.templateId] = reset.visualStyles;
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
                  sizes: createPageLayoutSizes(templateId),
                  rotations: createLayoutRotations(),
                  order: createLayoutOrder(),
                  styles: createPageLayoutTextStyles(templateId),
                  visualStyles: createPageLayoutVisualStyles(templateId),
                  groups: createLayoutGroups(),
                  deleted: [],
              };
        layoutOffsets.value[templateId] = restored.offsets;
        layoutSizes.value[templateId] = restored.sizes;
        layoutRotations.value[templateId] = restored.rotations;
        layoutOrder.value[templateId] = restored.order;
        layoutTextStyles.value[templateId] = restored.styles;
        layoutVisualStyles.value[templateId] = restored.visualStyles;
        layoutGroups.value[templateId] = restored.groups;
        deletedElements.value[templateId] = restored.deleted;
        layoutHistories.value[templateId] = createLayoutHistory();
    }
    selectedElements.value = [];
    selectedGroupId.value = null;
    activeAlignmentGuides.value = [];
    emit('selectionChange', null);
    emit('selectionIdsChange', []);
    emit('selectionGroupChange', false, false, 0);
    emitLayerPosition();
    emitSelectionGeometry();
    emitHistoryState();
    emit('availableElementsChange', availableElements.value);
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
        selectedGroupId.value = null;
        activeAlignmentGuides.value = [];
        emit('selectionChange', null);
        emit('selectionIdsChange', []);
        emit('selectionGroupChange', false, false, 0);
        emitLayerPosition();
        emitSelectionGeometry();
        emitHistoryState();
        emit('availableElementsChange', availableElements.value);
        emit('layoutChange', currentLayoutChanged.value);
        void syncTransformer();
    },
);

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
        stage.size({ width: props.documentWidth, height: props.documentHeight });
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
    drillIntoElement,
    deleteElements,
    deleteSelectedElements,
    exportPng,
    groupSelectedElements,
    getLayoutState,
    nudgeSelectedElement,
    redoLayout,
    resetLayout,
    resetSelectedElement,
    resizeSelectedElement,
    rotateSelectedElement,
    setSelectedElementGeometry,
    setSelectedElementTextStyle,
    setSelectedElementVisualStyle,
    selectElement,
    selectGroup,
    undoLayout,
    ungroupSelectedElements,
});
</script>

<template>
    <div class="template-preview">
        <v-stage
            ref="stageRef"
            :config="stageConfig"
            @mousedown="handleStagePointer"
            @dblclick="handleStageDoubleClick"
            @mousemove="updateSelectionRectangle"
            @mouseup="finishSelectionRectangle"
            @mouseleave="finishSelectionRectangle"
            @touchstart="handleStagePointer"
            @dbltap="handleStageDoubleClick"
            @touchmove="updateSelectionRectangle"
            @touchend="finishSelectionRectangle"
            @touchcancel="finishSelectionRectangle"
        >
            <v-layer>
                <EditableVisualElement
                    v-if="!deletedElements[templateId].includes('background')"
                    element-id="background"
                    :frame="elementFrame('background')"
                    :editor-scale="previewScale"
                    :rotation="layoutRotations[templateId].background"
                    :selected="selectedElements.includes('background') && !isExporting"
                    :visual-config="visualConfig('background')"
                    :z-index="layoutOrder[templateId].indexOf('background')"
                    @drag-start="startElementDrag"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                <template v-for="decoration in decorationLayers('behindImage')" :key="decoration.id">
                    <v-rect v-if="decoration.type === 'rect'" :config="decorationConfig(decoration)" />
                    <v-text v-else :config="decorationConfig(decoration)" />
                </template>
            </v-layer>
            <v-layer>
                <EditableVisualElement
                    v-if="!deletedElements[templateId].includes('image')"
                    element-id="image"
                    :frame="elementFrame('image')"
                    :editor-scale="previewScale"
                    :image-config="imageIsVisible ? imageConfig : null"
                    :rotation="layoutRotations[templateId].image"
                    :selected="selectedElements.includes('image') && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('image')"
                    @drag-start="startElementDrag"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
            </v-layer>
            <v-layer>
                <template v-for="decoration in decorationLayers('overImage')" :key="decoration.id">
                    <v-rect v-if="decoration.type === 'rect'" :config="decorationConfig(decoration)" />
                    <v-text v-else :config="decorationConfig(decoration)" />
                </template>
                <EditableVisualElement
                    v-if="!deletedElements[templateId].includes('accent')"
                    element-id="accent"
                    :frame="elementFrame('accent')"
                    :editor-scale="previewScale"
                    :rotation="layoutRotations[templateId].accent"
                    :selected="selectedElements.includes('accent') && !isExporting"
                    :visual-config="visualConfig('accent')"
                    :z-index="layoutOrder[templateId].indexOf('accent')"
                    @drag-start="startElementDrag"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                <v-group>
                    <template v-for="binding in TEMPLATE_TEXT_BINDINGS" :key="binding">
                        <EditableTextElement
                            v-if="!deletedElements[templateId].includes(binding) && (binding !== 'location' || template.location)"
                            :element-id="binding"
                            :editor-scale="previewScale"
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
                        strokeWidth: 1.25 / previewScale,
                        dash: [6 / previewScale, 4 / previewScale],
                    }"
                />
                <v-line
                    v-for="guide in activeAlignmentGuides"
                    :key="`${guide.orientation}-${guide.position}`"
                    :config="{
                        points: guide.orientation === 'vertical'
                            ? [guide.position, 0, guide.position, documentHeight]
                            : [0, guide.position, documentWidth, guide.position],
                        stroke: '#ee3d8f',
                        strokeWidth: 1 / previewScale,
                        dash: [8 / previewScale, 5 / previewScale],
                    }"
                />
            </v-layer>
            <v-layer>
                <v-transformer ref="transformerRef" :config="transformerConfig" />
            </v-layer>
        </v-stage>
    </div>
</template>
