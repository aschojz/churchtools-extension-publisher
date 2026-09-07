<script setup lang="ts">
import type Konva from 'konva';
import { Rect as KonvaRect } from 'konva/lib/shapes/Rect';
import { Text as KonvaText } from 'konva/lib/shapes/Text';
import QRCode from 'qrcode';
import type { Box } from 'konva/lib/shapes/Transformer';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import EditableTextElement from './EditableTextElement.vue';
import EditableVisualElement from './EditableVisualElement.vue';
import CanvasSceneTree from './CanvasSceneTree.vue';
import type { EventTemplateProps } from '../domain/EventTemplateProps';
import {
    PUBLISHER_DATA_TRANSFER_TYPE,
    parsePublisherDataTransfer,
    publisherDataValue,
    resolvePublisherPlaceholders,
    type PublisherDataValues,
} from '../domain/appointmentDataFields';
import { calculateCoverCrop, type ImageFocus } from '../domain/imageFocus';
import type { LayoutColorBinding } from '../domain/imagePalette';
import { layoutGradientFillConfig, normalizeLayoutGradient, type LayoutGradient } from '../domain/layoutGradient';
import { publisherIcon, type PublisherIconName } from '../domain/publisherIcons';
import { usePublisherImagePalettesStore } from '../stores/publisherImagePalettes';
import { usePublisherColorsStore } from '../stores/publisherColors';
import { usePublisherDocumentStore } from '../stores/publisherDocument';
import { usePublisherEditorStore } from '../stores/publisherEditor';
import {
    alignLayoutGeometry,
    applyLayoutGroupAutoLayout,
    calculateSelectionDragSnap,
    constrainLayoutGeometry,
    constrainLayoutDelta,
    constrainTransformerFrame,
    constrainFontSize,
    constrainLetterSpacing,
    constrainLineHeight,
    createCustomTextStyle,
    createCustomVisualStyle,
    createLayoutLayerTree,
    createLayoutCustomElement,
    createLayoutGroups,
    createLayoutOrder,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutVisualStyles,
    expandLayoutSelection,
    flattenLayoutGroups,
    findLayoutGroupDepth,
    findLayoutGroupPath,
    groupLayoutElements,
    isHexColor,
    isBuiltInLayoutElement,
    isFixedAspectRatioLayoutElement,
    isShapeLayoutElement,
    isTextLayoutElement,
    keepRotatedFrameInDocument,
    layoutGroupElementIds,
    layoutGroupAnchor,
    layoutGroupBounds,
    layoutFramesIntersect,
    type AlignmentGuide,
    type LayoutElementId,
    type LayoutElementEffects,
    type LayoutCustomElement,
    type LayoutCustomElementKind,
    type LayoutFrame,
    type LayoutGeometry,
    type LayoutSelectionGeometry,
    type LayoutGroup,
    type LayoutGroupAutoLayout,
    type LayoutDistributionAxis,
    type LayoutHorizontalOrigin,
    type LayoutLayerDragNode,
    type LayoutLayerDropPlacement,
    type LayoutVerticalOrigin,
    type LayoutGroups,
    type LayoutSizes,
    type LayoutAlignment,
    type LayoutTextStyle,
    type LayoutTextMode,
    type LayoutTextStyles,
    type LayoutVisualStyle,
    type LayoutVisualStyles,
    layoutElementHasEffects,
    normalizeLayoutElementEffects,
    LAYOUT_ELEMENT_IDS,
    SHAPE_LAYOUT_ELEMENT_IDS,
    TEXT_LAYOUT_ELEMENT_IDS,
    moveLayoutElementInOrder,
    moveLayoutOrderBlock,
    nestLayoutNodeInGroup,
    normalizeRotation,
    distributeLayoutFrames,
    resizeLayoutFrame,
    resizeLayoutFrameProportionally,
    resolveLayoutSelectionTarget,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
    sortLayoutGroupChildren,
    ungroupLayoutElements,
} from '../domain/layoutEditing';
import {
    cloneLayoutState,
    createLayoutHistory,
    type SerializableLayoutState,
} from '../domain/layoutHistory';
import type { TemplateId } from '../domain/templates';
import type { PublisherCanvasExportOptions } from '../domain/publisherExport';
import { createStandardPublisherLayout } from '../domain/publisherPage';
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
    pageId: string;
    documentHeight: number;
    documentWidth: number;
    dataValues: PublisherDataValues;
    imageFocus: ImageFocus;
    previewZoom: number;
    template: EventTemplateProps;
    templateId: TemplateId;
    snapEnabled: boolean;
    showTemplateDecorations: boolean;
}>();
const imagePaletteStore = usePublisherImagePalettesStore();
const colorsStore = usePublisherColorsStore();
const documentStore = usePublisherDocumentStore();
const editorStore = usePublisherEditorStore();

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
    selectionGroupPathChange: [groupIds: string[]];
    selectionDefaultChange: [changed: boolean];
    selectionGeometryChange: [geometry: LayoutSelectionGeometry | null];
    selectionStyleChange: [style: (LayoutTextStyle & { elementId: LayoutElementId }) | null];
    selectionTextContentChange: [content: string | null];
    selectionTextModeChange: [mode: LayoutTextMode | null];
    selectionVisualStyleChange: [style: (LayoutVisualStyle & { elementId: LayoutElementId }) | null];
}>();

const currentStoredLayout = (templateId: TemplateId) =>
    documentStore.pageById(props.pageId)?.layouts[templateId];
const customElements = computed(() => new Proxy({} as Record<TemplateId, LayoutCustomElement[]>, {
    get: (_target, property) => property === 'split' || property === 'poster'
        ? currentStoredLayout(property)?.customElements ?? []
        : undefined,
    set: (_target, property, value: LayoutCustomElement[]) => {
        if (property !== 'split' && property !== 'poster') return false;
        const layout = documentStore.ensurePageLayout(props.pageId, property, () => createPageLayoutState(property));
        layout.customElements = value;
        return true;
    },
}));
const customImageNodes = shallowRef<Record<string, HTMLImageElement>>({});
const customQrNodes = shallowRef<Record<string, HTMLImageElement>>({});

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
        ...Object.fromEntries(customElements.value[templateId].map((element) => [element.id, { ...element.frame }])),
    };
}
const allElementIds = (templateId: TemplateId) => [
    ...LAYOUT_ELEMENT_IDS,
    ...customElements.value[templateId].map(({ id }) => id),
];
const createPageLayoutSizes = (templateId: TemplateId) => Object.fromEntries(
    allElementIds(templateId).map((elementId) => [elementId, {
        width: templateElementFrames.value[templateId][elementId].width,
        height: templateElementFrames.value[templateId][elementId].height,
    }]),
) as LayoutSizes;
const createPageLayoutTextStyles = (templateId: TemplateId) => Object.fromEntries(
    [
        ...TEMPLATE_TEXT_BINDINGS.map((binding) => [binding, {
        fontSize: constrainFontSize(scaledTemplateDefinitions.value[templateId].elements[binding].style.fontSize),
        color: scaledTemplateDefinitions.value[templateId].elements[binding].style.color,
        stroke: '#000000',
        strokeWidth: 0,
        fontFamily: scaledTemplateDefinitions.value[templateId].elements[binding].style.fontFamily,
        fontStyle: scaledTemplateDefinitions.value[templateId].elements[binding].style.fontStyle,
        lineHeight: scaledTemplateDefinitions.value[templateId].elements[binding].style.lineHeight,
        letterSpacing: 0,
        align: scaledTemplateDefinitions.value[templateId].elements[binding].style.align,
        listStyle: 'none',
        textTransform: 'none',
        underlineStyle: 'none',
        strikethroughStyle: 'none',
        }] as const),
        ...customElements.value[templateId].filter(({ kind }) => kind === 'text')
            .map(({ id }) => [id, createCustomTextStyle()] as const),
    ],
) as LayoutTextStyles;
const createPageLayoutVisualStyles = (templateId: TemplateId): LayoutVisualStyles => {
    const defaults = createLayoutVisualStyles(templateId);
    return {
        background: { ...defaults.background },
        accent: { ...defaults.accent },
        ...Object.fromEntries(customElements.value[templateId]
            .filter(({ kind }) => ['rectangle', 'circle', 'triangle', 'line', 'icon', 'qr'].includes(kind))
            .map(({ id }) => [id, createCustomVisualStyle()])),
    };
};

const createPageLayoutState = (templateId: TemplateId): SerializableLayoutState =>
    createStandardPublisherLayout(templateId, props.documentWidth, props.documentHeight);

type PersistedLayoutSection = Exclude<keyof SerializableLayoutState, 'customElements'>;
const layoutSectionProxy = <Key extends PersistedLayoutSection>(key: Key) => computed(() => new Proxy(
    {} as Record<TemplateId, NonNullable<SerializableLayoutState[Key]>>,
    {
        get: (_target, property) => property === 'split' || property === 'poster'
            ? documentStore.ensurePageLayout(props.pageId, property, () => createPageLayoutState(property))[key]
            : undefined,
        set: (_target, property, value: NonNullable<SerializableLayoutState[Key]>) => {
            if (property !== 'split' && property !== 'poster') return false;
            documentStore.ensurePageLayout(props.pageId, property, () => createPageLayoutState(property));
            documentStore.replacePageLayoutSection(props.pageId, property, key, value);
            return true;
        },
    },
));

const stageRef = ref<VueKonvaRef<Konva.Stage> | null>(null);
const transformerRef = ref<VueKonvaRef<Konva.Transformer> | null>(null);
const image = shallowRef<HTMLImageElement | null>(null);
const imageStatus = ref<ImageStatus>('idle');
const selectedElements = computed<LayoutElementId[]>({
    get: () => editorStore.activeCanvasPageId === props.pageId ? editorStore.selectedLayoutElements : [],
    set: (elementIds) => { editorStore.setCanvasSelection(props.pageId, elementIds, editorStore.selectedLayoutGroupId); },
});
const selectedElement = computed(() => selectedElements.value.at(-1) ?? null);
const selectedGraphicText = computed(() => {
    if (selectedElements.value.length !== 1 || !selectedElement.value) return false;
    return customElements.value[props.templateId]
        .some(({ id, kind, textMode }) => id === selectedElement.value && kind === 'text' && textMode === 'graphic');
});
const selectedLine = computed(() => selectedElements.value.length === 1 && Boolean(
    selectedElement.value && customElementById(selectedElement.value)?.kind === 'line',
));
const selectedKeepsAspectRatio = computed(() =>
    selectedGraphicText.value || (
        selectedElements.value.length === 1 && Boolean(selectedElement.value) &&
        isFixedAspectRatioLayoutElement(selectedElement.value!)
    ));
const selectedGroupId = computed<string | null>({
    get: () => editorStore.activeCanvasPageId === props.pageId ? editorStore.selectedLayoutGroupId : null,
    set: (groupId) => { editorStore.setCanvasSelection(props.pageId, selectedElements.value, groupId); },
});
const isExporting = ref(false);
const activeAlignmentGuides = ref<AlignmentGuide[]>([]);
const selectionRectangle = ref<LayoutFrame | null>(null);
const layoutOffsets = layoutSectionProxy('offsets');
const layoutSizes = layoutSectionProxy('sizes');
const layoutRotations = layoutSectionProxy('rotations');
const layoutOrder = layoutSectionProxy('order');
const layoutTextStyles = layoutSectionProxy('styles');
const layoutVisualStyles = layoutSectionProxy('visualStyles');
const layoutGroups = layoutSectionProxy('groups');
const layoutEffects = layoutSectionProxy('effects');
const deletedElements = layoutSectionProxy('deleted');
const hiddenElements = layoutSectionProxy('hidden');
const lockedElements = layoutSectionProxy('locked');
const elementIsLocked = (elementId: LayoutElementId) => lockedElements.value[props.templateId].includes(elementId);
const selectionContainsLockedElement = () => selectedElements.value.some(elementIsLocked);
const availableElements = computed(() =>
    layoutOrder.value[props.templateId].filter((elementId) => !deletedElements.value[props.templateId].includes(elementId)));
const layoutHistories = computed(() => new Proxy({} as Record<TemplateId, ReturnType<typeof createLayoutHistory>>, {
    get: (_target, property) => property === 'split' || property === 'poster'
        ? documentStore.getPageLayoutHistory(props.pageId, property)
        : undefined,
    set: (_target, property, value: ReturnType<typeof createLayoutHistory>) => {
        if (property !== 'split' && property !== 'poster') return false;
        documentStore.replacePageLayoutHistory(props.pageId, property, value);
        return true;
    },
}));
let layoutGroupSequence = 0;
let selectionStart: { x: number; y: number; additive: boolean } | null = null;
let activeDrag: {
    previousState: SerializableLayoutState;
    startPosition: { x: number; y: number };
    nodePositions: Partial<Record<LayoutElementId, { x: number; y: number }>>;
    nodeBounds: Partial<Record<LayoutElementId, LayoutFrame>>;
} | null = null;
let activeGroupDrag: {
    groupId: string;
    previousState: SerializableLayoutState;
    startPosition: { x: number; y: number };
    startAbsolutePosition: { x: number; y: number };
    startBounds: LayoutFrame;
    elementFrames: Partial<Record<LayoutElementId, LayoutFrame>>;
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
    rotateEnabled: Boolean(selectedGroupId.value) || selectedElements.value.length === 1,
    flipEnabled: false,
    keepRatio: selectedKeepsAspectRatio.value,
    enabledAnchors: selectedGroupId.value
        ? []
        : selectedElements.value.length === 1
        ? selectedLine.value
            ? ['middle-left', 'middle-right']
            : selectedKeepsAspectRatio.value
            ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
            : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
        : [],
    anchorFill: '#ffffff',
    anchorStroke: '#2479c5',
    anchorSize: 7,
    borderStroke: '#2479c5',
    borderStrokeWidth: 1,
    anchorStyleFunc: (anchor: Konva.Rect) => {
        anchor.hitStrokeWidth(18);
        anchor.off('.publisher-autofit');
        anchor.on('mousedown.publisher-autofit', (event) => {
            if ('detail' in event.evt && event.evt.detail >= 2) {
                transformerRef.value?.getNode()?.stopTransform();
                handleTransformerDoubleClick(event);
            }
        });
        anchor.on('mouseup.publisher-autofit', (event) => {
            if ('detail' in event.evt && event.evt.detail >= 2) handleTransformerDoubleClick(event);
        });
        anchor.on('dblclick.publisher-autofit dbltap.publisher-autofit', handleTransformerDoubleClick);
    },
    rotateAnchorOffset: 18,
    rotationSnaps: props.snapEnabled
        ? [-180, -165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
        : [],
    rotationSnapTolerance: 5,
    boundBoxFunc: (oldBox: Box, newBox: Box) => {
        const minimumSize = selectedGraphicText.value ? 12 : 1;
        return {
            ...newBox,
            ...constrainTransformerFrame(oldBox, newBox, minimumSize, documentSize.value),
        };
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
    props.showTemplateDecorations ? templateDefinition.value.composition.decorations.filter((decoration) =>
        decoration.placement === placement &&
        decoration.id !== 'background' && decoration.id !== 'accent' &&
        (decoration.visibility === 'always' || !imageIsVisible.value),
    ) : [];

const resolvedTextColor = (style: LayoutTextStyle) =>
    imagePaletteStore.resolveColor(style.colorBinding, style.color);
const resolvedTextStrokeColor = (style: LayoutTextStyle) =>
    imagePaletteStore.resolveColor(style.strokeBinding, style.stroke);
const resolvedVisualStyle = (style: LayoutVisualStyle): LayoutVisualStyle => ({
    ...style,
    fill: imagePaletteStore.resolveColor(style.fillBinding, style.fill),
    stroke: imagePaletteStore.resolveColor(style.strokeBinding, style.stroke),
});
const visualConfig = (elementId: 'background' | 'accent') =>
    visualPaintConfig(elementId, layoutVisualStyles.value[props.templateId][elementId]);
const visualPaintConfig = (elementId: LayoutElementId, style: LayoutVisualStyle) => {
    const resolved = resolvedVisualStyle(style);
    const { fillGradient: _, ...config } = resolved;
    return style.fillGradient
        ? { ...config, ...layoutGradientFillConfig(style.fillGradient, elementFrame(elementId), imagePaletteStore.resolveColor) }
        : config;
};
const elementEffects = (targetId: string) =>
    normalizeLayoutElementEffects(layoutEffects.value[props.templateId][targetId]);

const decorationConfig = (decoration: TemplateDecoration, origin = { x: 0, y: 0 }) => ({
    ...decoration.frame,
    x: decoration.frame.x - origin.x,
    y: decoration.frame.y - origin.y,
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

const applyTextTransform = (text: string, textTransform: LayoutTextStyle['textTransform']) =>
    textTransform === 'uppercase' ? text.toLocaleUpperCase() : text;

const textDecoration = (style: LayoutTextStyle) => [
    style.underlineStyle !== 'none' ? 'underline' : '',
    style.strikethroughStyle !== 'none' ? 'line-through' : '',
].filter(Boolean).join(' ');

const editableTextConfig = (binding: TemplateTextBinding) => {
    const definitionStyle = templateDefinition.value.elements[binding].style;
    const editableStyle = layoutTextStyles.value[props.templateId][binding];
    return {
        text: applyTextTransform(
            applyListStyle(editableTextValues.value[binding], editableStyle.listStyle),
            editableStyle.textTransform,
        ),
        ...(editableStyle.colorGradient
            ? layoutGradientFillConfig(editableStyle.colorGradient, elementFrame(binding), imagePaletteStore.resolveColor)
            : { fill: resolvedTextColor(editableStyle) }),
        stroke: editableStyle.strokeWidth > 0 ? resolvedTextStrokeColor(editableStyle) : undefined,
        strokeWidth: editableStyle.strokeWidth,
        fontSize: editableStyle.fontSize,
        fontFamily: editableStyle.fontFamily,
        fontStyle: editableStyle.fontStyle,
        lineHeight: editableStyle.lineHeight,
        letterSpacing: editableStyle.letterSpacing,
        wrap: definitionStyle.wrap,
        ellipsis: definitionStyle.ellipsis,
        align: editableStyle.align,
        fontVariant: editableStyle.textTransform === 'smallCaps' ? 'small-caps' : 'normal',
        textDecoration: textDecoration(editableStyle),
    };
};

const customElementById = (elementId: LayoutElementId) =>
    customElements.value[props.templateId].find(({ id }) => id === elementId);

type CanvasRenderItem =
    | { role: 'background'; id: 'background' }
    | { role: 'image'; id: 'image' }
    | { role: 'accent'; id: 'accent' }
    | { role: 'templateText'; id: TemplateTextBinding }
    | { role: 'custom'; id: LayoutElementId; element: LayoutCustomElement };

const canvasRenderItem = (elementId: LayoutElementId): CanvasRenderItem[] => {
    if (hiddenElements.value[props.templateId].includes(elementId) ||
        deletedElements.value[props.templateId].includes(elementId) ||
        (elementId === 'location' && !props.template.location)) return [];
    if (elementId === 'background') return [{ role: 'background', id: elementId }];
    if (elementId === 'image') return [{ role: 'image', id: elementId }];
    if (elementId === 'accent') return [{ role: 'accent', id: elementId }];
    if (TEMPLATE_TEXT_BINDINGS.includes(elementId as TemplateTextBinding)) {
        return [{ role: 'templateText', id: elementId as TemplateTextBinding }];
    }
    const element = customElementById(elementId);
    return element ? [{ role: 'custom', id: element.id, element }] : [];
};

const customTextMode = (element: LayoutCustomElement): LayoutTextMode => element.textMode ?? 'frame';

const resolvedCustomText = (element: LayoutCustomElement, style: LayoutTextStyle) =>
    applyTextTransform(
        applyListStyle(resolvePublisherPlaceholders(element.text ?? 'Neuer Text', props.dataValues), style.listStyle),
        style.textTransform,
    );

const measureCustomText = (element: LayoutCustomElement, style: LayoutTextStyle) => {
    const mode = customTextMode(element);
    const textNode = new KonvaText({
        text: resolvedCustomText(element, style) || ' ',
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fontStyle: style.fontStyle,
        fontVariant: style.textTransform === 'smallCaps' ? 'small-caps' : 'normal',
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        wrap: mode === 'graphic' ? 'none' : 'word',
        ...(mode === 'frame' ? { width: elementFrame(element.id).width } : {}),
    });
    const size = {
        width: mode === 'graphic' ? Math.ceil(textNode.width()) : elementFrame(element.id).width,
        height: Math.ceil(textNode.height()),
    };
    textNode.destroy();
    return {
        width: Math.max(12, Math.min(props.documentWidth, size.width)),
        height: Math.max(12, Math.min(props.documentHeight, size.height)),
    };
};

const syncGraphicTextSize = (elementId: LayoutElementId) => {
    const element = customElementById(elementId);
    if (!element || element.kind !== 'text' || customTextMode(element) !== 'graphic') return;
    const style = layoutTextStyles.value[props.templateId][elementId] ?? createCustomTextStyle();
    layoutSizes.value[props.templateId][elementId] = measureCustomText(element, style);
};

const syncAllGraphicTextSizes = () => {
    customElements.value[props.templateId].forEach(({ id }) => syncGraphicTextSize(id));
};

const customTextConfig = (element: LayoutCustomElement) => {
    const style = layoutTextStyles.value[props.templateId][element.id] ?? createCustomTextStyle();
    return {
        text: resolvedCustomText(element, style),
        ...(style.colorGradient
            ? layoutGradientFillConfig(style.colorGradient, elementFrame(element.id), imagePaletteStore.resolveColor)
            : { fill: resolvedTextColor(style) }),
        stroke: style.strokeWidth > 0 ? resolvedTextStrokeColor(style) : undefined,
        strokeWidth: style.strokeWidth,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fontStyle: style.fontStyle,
        fontVariant: style.textTransform === 'smallCaps' ? 'small-caps' : 'normal',
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        align: style.align,
        textDecoration: textDecoration(style),
        wrap: customTextMode(element) === 'graphic' ? 'none' : 'word',
        ellipsis: customTextMode(element) === 'frame',
    };
};

const additionalTextDecorationLines = (
    elementId: LayoutElementId,
    config: Konva.TextConfig,
    style: LayoutTextStyle,
    graphicText: boolean,
): Konva.LineConfig[] => {
    if (style.underlineStyle !== 'double' && style.strikethroughStyle !== 'double') return [];
    const frame = elementFrame(elementId);
    const textNode = new KonvaText({
        ...config,
        ...(graphicText ? {} : { width: frame.width, height: frame.height }),
    });
    const fontSize = style.fontSize;
    const lineHeight = fontSize * style.lineHeight;
    const metrics = textNode.measureSize('M');
    const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;
    const baseline = (ascent - descent) / 2 + lineHeight / 2;
    const lines: Konva.LineConfig[] = [];
    for (let index = 0; index < textNode.textArr.length; index += 1) {
        const textLine = textNode.textArr[index];
        const x = style.align === 'right'
            ? textNode.width() - textLine.width
            : style.align === 'center' ? (textNode.width() - textLine.width) / 2 : 0;
        const baseY = baseline + index * lineHeight;
        if (style.underlineStyle === 'double') {
            const y = baseY + Math.round(fontSize / 4) - Math.max(2, fontSize / 9);
            lines.push({ points: [x, y, x + textLine.width, y], stroke: resolvedTextColor(style), strokeWidth: fontSize / 15 });
        }
        if (style.strikethroughStyle === 'double') {
            const y = baseY - Math.round(fontSize / 4) + Math.max(2, fontSize / 9);
            lines.push({ points: [x, y, x + textLine.width, y], stroke: resolvedTextColor(style), strokeWidth: fontSize / 15 });
        }
    }
    textNode.destroy();
    return lines;
};

const editableTextDecorationLines = (binding: TemplateTextBinding) => {
    const style = layoutTextStyles.value[props.templateId][binding];
    return additionalTextDecorationLines(binding, editableTextConfig(binding), style, false);
};

const customTextDecorationLines = (element: LayoutCustomElement) => {
    const style = layoutTextStyles.value[props.templateId][element.id] ?? createCustomTextStyle();
    return additionalTextDecorationLines(
        element.id,
        customTextConfig(element),
        style,
        customTextMode(element) === 'graphic',
    );
};

const customVisualConfig = (elementId: LayoutElementId) => visualPaintConfig(
    elementId,
    layoutVisualStyles.value[props.templateId][elementId] ?? createCustomVisualStyle(),
);

const customShapeType = (element: LayoutCustomElement): 'rectangle' | 'circle' | 'triangle' | 'line' =>
    element.kind === 'circle' || element.kind === 'triangle' || element.kind === 'line' ? element.kind : 'rectangle';

const customIconPathConfig = (element: LayoutCustomElement): Konva.PathConfig | null => {
    if (element.kind !== 'icon' || !element.iconName) return null;
    const definition = publisherIcon(element.iconName).icon;
    const path = Array.isArray(definition.icon[4]) ? definition.icon[4][0] : definition.icon[4];
    const sourceWidth = definition.icon[0];
    const sourceHeight = definition.icon[1];
    const frame = elementFrame(element.id);
    const scale = Math.min(frame.width / sourceWidth, frame.height / sourceHeight);
    const style = resolvedVisualStyle(layoutVisualStyles.value[props.templateId][element.id] ?? createCustomVisualStyle());
    const fillConfig = style.fillGradient
        ? layoutGradientFillConfig(style.fillGradient, { x: 0, y: 0, width: sourceWidth, height: sourceHeight }, imagePaletteStore.resolveColor)
        : { fill: style.fill };
    return {
        data: path,
        x: (frame.width - sourceWidth * scale) / 2,
        y: (frame.height - sourceHeight * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        ...fillConfig,
        stroke: style.strokeWidth > 0 ? style.stroke : undefined,
        strokeWidth: style.strokeWidth / Math.max(scale, 0.001),
    };
};

const customImageConfig = (element: LayoutCustomElement) => {
    const imageNode = customImageNodes.value[element.id];
    if (!imageNode) return null;
    const frame = elementFrame(element.id);
    const crop = calculateCoverCrop(
        { width: imageNode.naturalWidth, height: imageNode.naturalHeight },
        { width: frame.width, height: frame.height },
        { x: 50, y: 50, zoom: 100 },
    );
    return { image: imageNode, crop: crop ?? undefined };
};

const resolvedCustomImageSource = (element: LayoutCustomElement) =>
    element.dataBinding ? publisherDataValue(props.dataValues, element.dataBinding) : element.imageSource;

const loadCustomImage = (element: LayoutCustomElement) => {
    const source = resolvedCustomImageSource(element);
    if (element.kind !== 'image' || !source) return;
    const nextImage = new Image();
    if (/^https?:\/\//i.test(source)) nextImage.crossOrigin = 'anonymous';
    nextImage.onload = () => {
        customImageNodes.value = { ...customImageNodes.value, [element.id]: nextImage };
    };
    nextImage.src = source;
};

const loadCustomImages = (elements: LayoutCustomElement[]) => {
    customImageNodes.value = {};
    elements.forEach(loadCustomImage);
};
const reloadAllCustomImages = () => loadCustomImages([
    ...customElements.value.split,
    ...customElements.value.poster,
]);

const qrRenderRevisions = new Map<LayoutElementId, number>();
const resolvedCustomQrValue = (element: LayoutCustomElement) =>
    element.dataBinding ? publisherDataValue(props.dataValues, element.dataBinding) : element.qrValue ?? '';

const loadCustomQr = async (element: LayoutCustomElement) => {
    if (element.kind !== 'qr') return;
    const value = resolvedCustomQrValue(element);
    const revision = (qrRenderRevisions.get(element.id) ?? 0) + 1;
    qrRenderRevisions.set(element.id, revision);
    if (!value) {
        const { [element.id]: _, ...remaining } = customQrNodes.value;
        customQrNodes.value = remaining;
        return;
    }
    const style = resolvedVisualStyle(layoutVisualStyles.value[props.templateId][element.id] ?? createCustomVisualStyle());
    try {
        const source = await QRCode.toDataURL(value, {
            errorCorrectionLevel: element.qrErrorCorrection ?? 'M',
            margin: element.qrMargin ?? 2,
            width: 1024,
            color: { dark: style.fill, light: element.qrBackground ?? '#ffffff' },
        });
        if (qrRenderRevisions.get(element.id) !== revision) return;
        const imageNode = new Image();
        imageNode.onload = () => {
            if (qrRenderRevisions.get(element.id) === revision) {
                customQrNodes.value = { ...customQrNodes.value, [element.id]: imageNode };
            }
        };
        imageNode.src = source;
    } catch {
        const { [element.id]: _, ...remaining } = customQrNodes.value;
        customQrNodes.value = remaining;
    }
};

const reloadCurrentCustomQrs = () => {
    customQrNodes.value = {};
    customElements.value[props.templateId].forEach((element) => void loadCustomQr(element));
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
        return JSON.stringify(style) !== JSON.stringify(defaultStyle);
    });
    return geometryChanged || orderChanged || textStyleChanged || visualStyleChanged ||
        Object.values(layoutEffects.value[props.templateId]).some(layoutElementHasEffects) ||
        customElements.value[props.templateId].length > 0 ||
        deletedElements.value[props.templateId].length > 0 ||
        hiddenElements.value[props.templateId].length > 0 ||
        lockedElements.value[props.templateId].length > 0 ||
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

const currentElementFrames = () => Object.fromEntries(
    layoutOrder.value[props.templateId]
        .filter((elementId) => !deletedElements.value[props.templateId].includes(elementId))
        .map((elementId) => [elementId, elementFrame(elementId)]),
) as Partial<Record<LayoutElementId, LayoutFrame>>;

const selectedGroupVisualBounds = (group: LayoutGroup): LayoutFrame | null => {
    const frames = layoutGroupElementIds(group)
        .map((elementId) => {
            const frame = elementFrame(elementId);
            const radians = layoutRotations.value[props.templateId][elementId] * Math.PI / 180;
            const cosine = Math.cos(radians);
            const sine = Math.sin(radians);
            const corners = [
                { x: 0, y: 0 },
                { x: frame.width, y: 0 },
                { x: 0, y: frame.height },
                { x: frame.width, y: frame.height },
            ].map((point) => ({
                x: frame.x + point.x * cosine - point.y * sine,
                y: frame.y + point.x * sine + point.y * cosine,
            }));
            const x = Math.min(...corners.map((point) => point.x));
            const y = Math.min(...corners.map((point) => point.y));
            return {
                x,
                y,
                width: Math.max(...corners.map((point) => point.x)) - x,
                height: Math.max(...corners.map((point) => point.y)) - y,
            };
        });
    if (frames.length === 0) return null;
    const x = Math.min(...frames.map((frame) => frame.x));
    const y = Math.min(...frames.map((frame) => frame.y));
    const right = Math.max(...frames.map((frame) => frame.x + frame.width));
    const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
    return { x, y, width: right - x, height: bottom - y };
};

const canvasSceneNodes = computed(() => createLayoutLayerTree(
    layoutOrder.value[props.templateId],
    layoutGroups.value[props.templateId],
    deletedElements.value[props.templateId].filter((elementId) => elementId !== 'image').concat(
        props.template.location ? [] : ['location'],
    ),
));
const canvasGroupFrames = computed<Record<string, LayoutFrame>>(() => Object.fromEntries(
    flattenLayoutGroups(layoutGroups.value[props.templateId]).flatMap((group) => {
        const frame = selectedGroupVisualBounds(group);
        return frame ? [[group.id, frame]] : [];
    }),
));
const draggableGroupIds = computed(() => selectedGroupId.value
    ? [selectedGroupId.value]
    : selectedElements.value.length === 0
        ? layoutGroups.value[props.templateId].map(({ id }) => id)
        : []);
const sceneRenderRevision = computed(() => [
    documentStore.revision,
    props.templateId,
    props.template.title,
    props.template.date,
    props.template.time,
    props.template.location,
    imageStatus.value,
].join(':'));
const relativeElementFrame = (elementId: LayoutElementId, origin: { x: number; y: number }) => {
    const frame = elementFrame(elementId);
    return { ...frame, x: frame.x - origin.x, y: frame.y - origin.y };
};
const elementCanDragDirectly = (elementId: LayoutElementId) => {
    const groupPath = findLayoutGroupPath(layoutGroups.value[props.templateId], elementId);
    return groupPath.length === 0 || (
        selectedGroupId.value === null &&
        selectedElements.value.length === 1 &&
        selectedElements.value[0] === elementId
    );
};

const textMeasurementConfig = (elementId: LayoutElementId) => {
    if (!isTextLayoutElement(elementId)) return null;
    const customElement = customElementById(elementId);
    if (customElement?.kind === 'text' && customTextMode(customElement) === 'graphic') return null;
    return customElement?.kind === 'text'
        ? customTextConfig(customElement)
        : editableTextConfig(elementId as (typeof TEXT_LAYOUT_ELEMENT_IDS)[number]);
};

const measuredTextHeight = (elementId: LayoutElementId, width: number) => {
    const config = textMeasurementConfig(elementId);
    if (!config) return null;
    const textNode = new KonvaText({ ...config, width, height: undefined });
    const height = Math.ceil(textNode.height());
    textNode.destroy();
    return height;
};

const autoLayoutTextHeight = (elementId: LayoutElementId) => {
    const frame = elementFrame(elementId);
    const height = measuredTextHeight(elementId, frame.width);
    return height === null ? null : Math.max(12, Math.min(props.documentHeight, height));
};

const autoLayoutTextWidth = (elementId: LayoutElementId) => {
    if (!textMeasurementConfig(elementId)) return null;
    const frame = elementFrame(elementId);
    const minimumWidth = 12;
    const maximumWidth = Math.max(minimumWidth, props.documentWidth - frame.x);
    const targetHeight = Math.max(12, frame.height);
    const maximumWidthHeight = measuredTextHeight(elementId, maximumWidth);
    if (maximumWidthHeight === null) return null;
    if (maximumWidthHeight > targetHeight + 0.5) return maximumWidth;

    let lowerBound = minimumWidth;
    let upperBound = maximumWidth;
    for (let index = 0; index < 18; index += 1) {
        const candidate = (lowerBound + upperBound) / 2;
        const height = measuredTextHeight(elementId, candidate) ?? Number.POSITIVE_INFINITY;
        if (height <= targetHeight + 0.5) upperBound = candidate;
        else lowerBound = candidate;
    }
    return Math.ceil(upperBound);
};

const autoFitSelectedTextFrame = (axis: 'height' | 'width') => {
    if (selectedElements.value.length !== 1 || !selectedElement.value) return;
    const elementId = selectedElement.value;
    const frame = elementFrame(elementId);
    const fittedValue = axis === 'height' ? autoLayoutTextHeight(elementId) : autoLayoutTextWidth(elementId);
    if (fittedValue === null || Math.abs(frame[axis] - fittedValue) < 0.5) return;
    const resizedFrame = resizeLayoutFrame(
        frame,
        axis === 'height' ? { width: frame.width, height: fittedValue } : { width: fittedValue, height: frame.height },
        documentSize.value,
    );
    const previousState = captureLayoutState();
    layoutSizes.value[props.templateId][elementId] = { width: resizedFrame.width, height: resizedFrame.height };
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const reflowAutoLayoutGroups = () => {
    const groups = layoutGroups.value[props.templateId];
    const verticalTextIds = new Set(groups.flatMap((group) => flattenLayoutGroups([group]))
        .filter(({ autoLayout }) => autoLayout?.axis === 'vertical')
        .flatMap(layoutGroupElementIds)
        .filter(isTextLayoutElement));
    for (const elementId of verticalTextIds) {
        const height = autoLayoutTextHeight(elementId);
        if (height !== null) layoutSizes.value[props.templateId][elementId].height = height;
    }

    const reflowGroup = (
        group: LayoutGroup,
        frames: Partial<Record<LayoutElementId, LayoutFrame>>,
    ): Partial<Record<LayoutElementId, LayoutFrame>> => {
        let nextFrames = frames;
        for (const child of group.children) {
            if (typeof child !== 'string') nextFrames = reflowGroup(child, nextFrames);
        }
        return applyLayoutGroupAutoLayout(group, nextFrames);
    };
    let frames = currentElementFrames();
    for (const group of groups) frames = reflowGroup(group, frames);
    for (const [elementId, frame] of Object.entries(frames) as [LayoutElementId, LayoutFrame][]) {
        const baseFrame = templateElementFrames.value[props.templateId][elementId];
        layoutOffsets.value[props.templateId][elementId] = { x: frame.x - baseFrame.x, y: frame.y - baseFrame.y };
        layoutSizes.value[props.templateId][elementId] = { width: frame.width, height: frame.height };
    }
};

const updateLayoutGroup = (
    groups: LayoutGroups,
    groupId: string,
    update: (group: LayoutGroup) => LayoutGroup,
): LayoutGroups => groups.map((group) => group.id === groupId
    ? update(group)
    : { ...group, children: group.children.map((child) => typeof child === 'string'
        ? child
        : updateLayoutGroup([child], groupId, update)[0]!) });

const syncSelectedAutoLayoutAnchor = () => {
    if (!selectedGroupId.value) return;
    const groups = layoutGroups.value[props.templateId];
    const group = flattenLayoutGroups(groups).find(({ id }) => id === selectedGroupId.value);
    if (!group) return;
    const frames = currentElementFrames();
    const syncAnchors = (candidate: LayoutGroup): LayoutGroup => {
        const next = {
            ...candidate,
            children: candidate.children.map((child) => typeof child === 'string' ? child : syncAnchors(child)),
        };
        if (!next.autoLayout) return next;
        const bounds = layoutGroupBounds(next, frames);
        if (!bounds) return next;
        return {
            ...next,
            autoLayout: {
                ...next.autoLayout,
                anchor: layoutGroupAnchor(bounds, next.autoLayout.horizontalOrigin, next.autoLayout.verticalOrigin),
            },
        };
    };
    layoutGroups.value[props.templateId] = updateLayoutGroup(groups, group.id, (candidate) => ({
        ...syncAnchors(candidate),
    }));
};

const setSelectedGroupAutoLayout = (settings: {
    axis: LayoutDistributionAxis;
    gap: number;
    horizontalOrigin: LayoutHorizontalOrigin;
    verticalOrigin: LayoutVerticalOrigin;
} | null) => {
    if (!selectedGroupId.value) return;
    const groups = layoutGroups.value[props.templateId];
    const selectedGroup = flattenLayoutGroups(groups).find(({ id }) => id === selectedGroupId.value);
    if (!selectedGroup) return;
    const previousState = captureLayoutState();
    if (!settings) {
        layoutGroups.value[props.templateId] = updateLayoutGroup(groups, selectedGroup.id, ({ autoLayout: _, ...group }) => group);
    } else {
        const requestedGap = Number(settings.gap);
        const gap = Number.isFinite(requestedGap)
            ? Math.min(4096, Math.max(0, requestedGap))
            : selectedGroup.autoLayout?.gap ?? 8;
        const frames = currentElementFrames();
        const bounds = layoutGroupBounds(selectedGroup, frames);
        if (!bounds) return;
        const originChanged = selectedGroup.autoLayout && (
            selectedGroup.autoLayout.horizontalOrigin !== settings.horizontalOrigin ||
            selectedGroup.autoLayout.verticalOrigin !== settings.verticalOrigin ||
            selectedGroup.autoLayout.axis !== settings.axis
        );
        const anchor = !selectedGroup.autoLayout || originChanged
            ? layoutGroupAnchor(bounds, settings.horizontalOrigin, settings.verticalOrigin)
            : selectedGroup.autoLayout.anchor;
        const autoLayout: LayoutGroupAutoLayout = { ...settings, gap, anchor };
        layoutGroups.value[props.templateId] = updateLayoutGroup(groups, selectedGroup.id, (group) => ({
            ...sortLayoutGroupChildren(group, frames, settings.axis),
            autoLayout,
        }));
        reflowAutoLayoutGroups();
    }
    commitCurrentLayout(previousState);
    updateSelection(selectedElements.value, selectedGroup.id);
    emit('layoutChange', currentLayoutChanged.value);
};

const elementIsDefault = (elementId: LayoutElementId) => {
    if (!isBuiltInLayoutElement(elementId)) return false;
    const frame = elementFrame(elementId);
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
    const geometryChanged = frame.x !== baseFrame.x || frame.y !== baseFrame.y ||
        frame.width !== baseFrame.width || frame.height !== baseFrame.height ||
        layoutRotations.value[props.templateId][elementId] !== 0 ||
        layoutOrder.value[props.templateId].indexOf(elementId) !== createLayoutOrder().indexOf(elementId);
    if (isTextLayoutElement(elementId)) {
        const textId = elementId as typeof TEXT_LAYOUT_ELEMENT_IDS[number];
        const style = layoutTextStyles.value[props.templateId][textId];
        const defaultStyle = createPageLayoutTextStyles(props.templateId)[textId];
        return !geometryChanged && JSON.stringify(style) === JSON.stringify(defaultStyle);
    }
    if (isShapeLayoutElement(elementId)) {
        const shapeId = elementId as typeof SHAPE_LAYOUT_ELEMENT_IDS[number];
        const style = layoutVisualStyles.value[props.templateId][shapeId];
        const defaultStyle = createPageLayoutVisualStyles(props.templateId)[shapeId];
        return !geometryChanged && JSON.stringify(style) === JSON.stringify(defaultStyle);
    }
    return !geometryChanged;
};

const emitSelectionGeometry = () => {
    if (!selectedElement.value) {
        emit('selectionGeometryChange', null);
        emit('selectionStyleChange', null);
        emit('selectionVisualStyleChange', null);
        emit('selectionTextContentChange', null);
        emit('selectionTextModeChange', null);
        emit('selectionDefaultChange', false);
        return;
    }

    const elementId = selectedElement.value;
    if (selectedGroupId.value) {
        const group = flattenLayoutGroups(layoutGroups.value[props.templateId])
            .find(({ id }) => id === selectedGroupId.value);
        const bounds = group ? selectedGroupVisualBounds(group) : null;
        emit('selectionGeometryChange', group && bounds ? {
            elementId: null,
            groupId: group.id,
            ...bounds,
            rotation: group.rotation ?? 0,
        } : null);
        emit('selectionStyleChange', null);
        emit('selectionVisualStyleChange', null);
        emit('selectionTextContentChange', null);
        emit('selectionTextModeChange', null);
        emit('selectionDefaultChange', true);
        return;
    }
    if (selectedElements.value.length > 1) {
        emit('selectionGeometryChange', null);
        const textId = isTextLayoutElement(elementId) ? elementId : null;
        const shapeId = isShapeLayoutElement(elementId) ? elementId : null;
        emit('selectionStyleChange', textId ? { elementId, ...layoutTextStyles.value[props.templateId][textId] } : null);
        emit('selectionVisualStyleChange', shapeId ? { elementId, ...layoutVisualStyles.value[props.templateId][shapeId] } : null);
        emit('selectionTextContentChange', null);
        emit('selectionTextModeChange', null);
        emit('selectionDefaultChange', selectedElements.value.some((selectedId) => !elementIsDefault(selectedId)));
        return;
    }

    const frame = elementFrame(elementId);
    emit('selectionGeometryChange', {
        elementId,
        ...frame,
        rotation: layoutRotations.value[props.templateId][elementId],
    });
    const textId = isTextLayoutElement(elementId) ? elementId : null;
    const shapeId = isShapeLayoutElement(elementId) ? elementId : null;
    emit('selectionStyleChange', textId ? { elementId, ...layoutTextStyles.value[props.templateId][textId] } : null);
    emit('selectionVisualStyleChange', shapeId ? { elementId, ...layoutVisualStyles.value[props.templateId][shapeId] } : null);
    emit('selectionTextContentChange', elementId.startsWith('text-') ? customElementById(elementId)?.text ?? '' : null);
    const customText = elementId.startsWith('text-') ? customElementById(elementId) : null;
    emit('selectionTextModeChange', customText?.kind === 'text' ? customTextMode(customText) : null);
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
        hidden: hiddenElements.value[props.templateId],
        locked: lockedElements.value[props.templateId],
        customElements: customElements.value[props.templateId],
        effects: layoutEffects.value[props.templateId],
    });

const getLayoutState = () => captureLayoutState();

const emitHistoryState = () => {
    const history = layoutHistories.value[props.templateId];
    emit('historyChange', history.past.length > 0, history.future.length > 0);
};

const commitCurrentLayout = (previousState: SerializableLayoutState) => {
    const history = documentStore.commitPageLayout(
        props.pageId,
        props.templateId,
        previousState,
        captureLayoutState(),
    );
    layoutHistories.value[props.templateId] = history;
    emit('layoutStateChange', props.templateId, captureLayoutState());
    emitSelectionGeometry();
    emitHistoryState();
};

const restoreLayoutState = (state: SerializableLayoutState) => {
    const restored = cloneLayoutState(state);
    documentStore.replacePageLayout(props.pageId, props.templateId, restored);
    reloadAllCustomImages();
    reloadCurrentCustomQrs();
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

    const groupNode = selectedGroupId.value && !selectionContainsLockedElement()
        ? stage.findOne(`#editable-group-${selectedGroupId.value}`)
        : null;
    const selectedNodes = groupNode
        ? [groupNode]
        : selectedElements.value
            .filter((elementId) => !elementIsLocked(elementId))
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
        (elementId, index) => layoutOrder.value[props.templateId].includes(elementId) && elementIds.indexOf(elementId) === index,
    );
    selectedGroupId.value = groupId;
    emit('selectionIdsChange', [...selectedElements.value]);
    emit('selectionChange', selectedElement.value);
    emit(
        'selectionGroupPathChange',
        selectedElements.value[0]
            ? findLayoutGroupPath(layoutGroups.value[props.templateId], selectedElements.value[0]).map(({ id }) => id)
            : [],
    );
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
    const nextGroups = groupLayoutElements(
        currentGroups,
        selectedElements.value,
        groupId,
        layoutOrder.value[props.templateId],
    );
    if (nextGroups === currentGroups) {
        return;
    }
    layoutGroups.value[props.templateId] = nextGroups;
    pruneEffectsForCurrentTargets();
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
    pruneEffectsForCurrentTargets();
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

    const groupSelection = expandLayoutSelection(
        layoutGroups.value[props.templateId],
        [elementId],
        layoutOrder.value[props.templateId],
    );
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

const nodeDocumentPosition = (node: Konva.Node) => {
    const stage = stageRef.value?.getNode();
    return stage ? node.getAbsolutePosition(stage) : node.position();
};

const positionNodeAtDocumentPoint = (node: Konva.Node, point: { x: number; y: number }) => {
    const stage = stageRef.value?.getNode();
    const parent = node.getParent();
    if (!stage || !parent) {
        node.position(point);
        return;
    }
    node.position(parent.getAbsoluteTransform(stage).copy().invert().point(point));
};

const cancelSelectionRectangle = () => {
    selectionStart = null;
    selectionRectangle.value = null;
};

const eventTargetsTransformer = (target: Konva.Node) => {
    const transformer = transformerRef.value?.getNode();
    return Boolean(transformer && (target === transformer || transformer.isAncestorOf(target)));
};

const handleStagePointer = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (eventTargetsTransformer(event.target)) {
        cancelSelectionRectangle();
        return;
    }

    const editableGroup = event.target.findAncestor('.editable-element', true);
    const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;

    if (elementId) {
        if (elementIsLocked(elementId)) {
            cancelSelectionRectangle();
            return;
        }
        selectElement(elementId, eventIsAdditive(event));
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
    if (!pointer) {
        return;
    }
    selectionStart = { ...pointer, additive: eventIsAdditive(event) };
    selectionRectangle.value = { x: pointer.x, y: pointer.y, width: 0, height: 0 };
};

const handleStageDoubleClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const editableGroup = event.target.findAncestor('.editable-element', true);
    const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;
    if (elementId && !elementIsLocked(elementId)) {
        drillIntoElement(elementId);
    }
};

const handleTransformerDoubleClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const anchorNames = event.target.name().split(/\s+/);
    if (anchorNames.includes('bottom-center')) {
        event.cancelBubble = true;
        autoFitSelectedTextFrame('height');
    } else if (anchorNames.includes('middle-right')) {
        event.cancelBubble = true;
        autoFitSelectedTextFrame('width');
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
    const matches = layoutOrder.value[props.templateId].filter((elementId) => {
        if (elementIsLocked(elementId)) return false;
        const node = stage.findOne(`#editable-${elementId}`);
        if (!node) {
            return false;
        }
        const bounds = node.getClientRect({ relativeTo: stage });
        return layoutFramesIntersect(rectangle, bounds);
    });
    const expandedMatches = expandLayoutSelection(
        layoutGroups.value[props.templateId],
        matches,
        layoutOrder.value[props.templateId],
    );
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
            nodeBounds[selectedId] = node.getClientRect({ relativeTo: parent, skipStroke: true, skipShadow: true });
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

    const targetFrames = layoutOrder.value[props.templateId]
        .filter((candidateId) => !selectedElements.value.includes(candidateId))
        .map((candidateId) => stage.findOne(`#editable-${candidateId}`))
        .filter((candidate): candidate is Konva.Node => Boolean(candidate))
        .map((candidate) => candidate.getClientRect({ relativeTo: parent, skipStroke: true, skipShadow: true }));
    if (!activeDrag) return;

    const rawDelta = {
        x: node.x() - activeDrag.startPosition.x,
        y: node.y() - activeDrag.startPosition.y,
    };
    const bounds = Object.values(activeDrag.nodeBounds).filter((value): value is LayoutFrame => Boolean(value));
    const selectionSnap = calculateSelectionDragSnap(
        bounds,
        rawDelta,
        targetFrames,
        props.snapEnabled,
        10,
        documentSize.value,
    );
    const delta = selectionSnap.offset;
    activeAlignmentGuides.value = selectionSnap.guides;
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
        const documentPosition = nodeDocumentPosition(node);
        layoutOffsets.value[props.templateId][movedId] = {
            x: documentPosition.x - baseFrame.x,
            y: documentPosition.y - baseFrame.y,
        };
    }
    activeDrag = null;
    syncSelectedAutoLayoutAnchor();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const startGroupDrag = (groupId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const group = flattenLayoutGroups(layoutGroups.value[props.templateId]).find(({ id }) => id === groupId);
    const stage = stageRef.value?.getNode();
    if (!group || !stage || layoutGroupElementIds(group).some(elementIsLocked)) return;
    if (selectedGroupId.value !== groupId) selectGroup(groupId);
    const elementFrames = Object.fromEntries(layoutGroupElementIds(group).map((elementId) => [
        elementId,
        { ...elementFrame(elementId) },
    ])) as Partial<Record<LayoutElementId, LayoutFrame>>;
    activeGroupDrag = {
        groupId,
        previousState: captureLayoutState(),
        startPosition: { ...event.target.position() },
        startAbsolutePosition: { ...event.target.getAbsolutePosition(stage) },
        startBounds: event.target.getClientRect({ relativeTo: stage, skipStroke: true, skipShadow: true }),
        elementFrames,
    };
};

const alignGroupWhileDragging = (groupId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const drag = activeGroupDrag;
    const stage = stageRef.value?.getNode();
    if (!drag || drag.groupId !== groupId || !stage) return;
    const movingIds = new Set(Object.keys(drag.elementFrames));
    const targetFrames = layoutOrder.value[props.templateId]
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
        props.snapEnabled,
        10,
        documentSize.value,
    );
    activeAlignmentGuides.value = snapped.guides;
    event.target.position({
        x: drag.startPosition.x + snapped.offset.x,
        y: drag.startPosition.y + snapped.offset.y,
    });
};

const moveGroup = (groupId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const drag = activeGroupDrag;
    const stage = stageRef.value?.getNode();
    activeAlignmentGuides.value = [];
    if (!drag || drag.groupId !== groupId || !stage) return;
    const absolutePosition = event.target.getAbsolutePosition(stage);
    const delta = {
        x: absolutePosition.x - drag.startAbsolutePosition.x,
        y: absolutePosition.y - drag.startAbsolutePosition.y,
    };
    event.target.position(drag.startPosition);
    for (const [elementId, frame] of Object.entries(drag.elementFrames) as [LayoutElementId, LayoutFrame][]) {
        const baseFrame = templateElementFrames.value[props.templateId][elementId];
        layoutOffsets.value[props.templateId][elementId] = {
            x: frame.x + delta.x - baseFrame.x,
            y: frame.y + delta.y - baseFrame.y,
        };
    }
    activeGroupDrag = null;
    syncSelectedAutoLayoutAnchor();
    commitCurrentLayout(drag.previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const transformGroup = (groupId: string, event: Konva.KonvaEventObject<Event>) => {
    const group = flattenLayoutGroups(layoutGroups.value[props.templateId]).find(({ id }) => id === groupId);
    if (!group || layoutGroupElementIds(group).some(elementIsLocked)) return;
    const rotation = normalizeRotation((group.rotation ?? 0) + event.target.rotation());
    event.target.rotation(0);
    event.target.scale({ x: 1, y: 1 });
    selectGroup(groupId);
    setSelectedGroupGeometry('rotation', rotation);
};

const resizeElement = (elementId: LayoutElementId, event: Konva.KonvaEventObject<Event>) => {
    const node = event.target;
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
    const currentFrame = elementFrame(elementId);
    const snappedPosition = snapLayoutPoint(nodeDocumentPosition(node), props.snapEnabled);
    const customElement = customElementById(elementId);

    if (customElement?.kind === 'text' && customTextMode(customElement) === 'graphic') {
        const previousState = captureLayoutState();
        const currentStyle = layoutTextStyles.value[props.templateId][elementId];
        const requestedScale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
        const nextFontSize = constrainFontSize(currentStyle.fontSize * requestedScale);
        layoutTextStyles.value[props.templateId][elementId] = { ...currentStyle, fontSize: nextFontSize };
        syncGraphicTextSize(elementId);
        const measuredSize = layoutSizes.value[props.templateId][elementId];
        const resizedFrame = {
            x: snappedPosition.x,
            y: snappedPosition.y,
            ...measuredSize,
        };
        const rotatedLayout = keepRotatedFrameInDocument(
            resizedFrame,
            snapRotation(node.rotation(), props.snapEnabled),
            documentSize.value,
        );
        if (!rotatedLayout) {
            layoutTextStyles.value[props.templateId][elementId] = currentStyle;
            layoutSizes.value[props.templateId][elementId] = { width: currentFrame.width, height: currentFrame.height };
            node.scale({ x: 1, y: 1 });
            positionNodeAtDocumentPoint(node, { x: currentFrame.x, y: currentFrame.y });
            node.rotation(layoutRotations.value[props.templateId][elementId]);
            void syncTransformer();
            return;
        }
        node.scale({ x: 1, y: 1 });
        positionNodeAtDocumentPoint(node, { x: rotatedLayout.frame.x, y: rotatedLayout.frame.y });
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
        reflowAutoLayoutGroups();
        commitCurrentLayout(previousState);
        emit('layoutChange', currentLayoutChanged.value);
        void syncTransformer();
        return;
    }

    const frameAtRequestedPosition = { ...currentFrame, ...snappedPosition };
    const snappedSize = snapLayoutSize(
        {
            width: currentFrame.width * Math.abs(node.scaleX()),
            height: currentFrame.height * Math.abs(node.scaleY()),
        },
        props.snapEnabled,
    );
    const requestedSize = customElement?.kind === 'line'
        ? { width: snappedSize.width, height: currentFrame.height }
        : snappedSize;
    const resizedFrame = isFixedAspectRatioLayoutElement(elementId)
        ? resizeLayoutFrameProportionally(frameAtRequestedPosition, requestedSize, documentSize.value)
        : resizeLayoutFrame(frameAtRequestedPosition, requestedSize, documentSize.value);
    const rotatedLayout = keepRotatedFrameInDocument(
        resizedFrame,
        snapRotation(node.rotation(), props.snapEnabled),
        documentSize.value,
    );

    if (!rotatedLayout) {
        node.scale({ x: 1, y: 1 });
        positionNodeAtDocumentPoint(node, { x: currentFrame.x, y: currentFrame.y });
        node.rotation(layoutRotations.value[props.templateId][elementId]);
        void syncTransformer();
        return;
    }

    const previousState = captureLayoutState();
    node.scale({ x: 1, y: 1 });
    positionNodeAtDocumentPoint(node, { x: rotatedLayout.frame.x, y: rotatedLayout.frame.y });
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
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const nudgeSelectedElement = (deltaX: number, deltaY: number) => {
    if (selectedElements.value.length === 0 || selectionContainsLockedElement()) {
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
    syncSelectedAutoLayoutAnchor();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const resizeSelectedElement = (deltaWidth: number, deltaHeight: number) => {
    if (selectedElements.value.length === 0 || selectionContainsLockedElement()) {
        return;
    }

    const previousState = captureLayoutState();
    for (const elementId of selectedElements.value) {
        const frame = elementFrame(elementId);
        const requestedSize = {
            width: frame.width + deltaWidth,
            height: customElementById(elementId)?.kind === 'line' ? frame.height : frame.height + deltaHeight,
        };
        const resizedFrame = isFixedAspectRatioLayoutElement(elementId)
            ? resizeLayoutFrameProportionally(frame, requestedSize, documentSize.value)
            : resizeLayoutFrame(frame, requestedSize, documentSize.value);
        layoutSizes.value[props.templateId][elementId] = {
            width: resizedFrame.width,
            height: resizedFrame.height,
        };
    }
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const rotateSelectedElement = (deltaRotation: number) => {
    if (selectedElements.value.length === 0 || selectionContainsLockedElement()) {
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
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const setSelectedGroupGeometry = (field: keyof LayoutGeometry, value: number) => {
    if (!selectedGroupId.value || !Number.isFinite(value)) return;
    const group = flattenLayoutGroups(layoutGroups.value[props.templateId])
        .find(({ id }) => id === selectedGroupId.value);
    const bounds = group ? selectedGroupVisualBounds(group) : null;
    if (!group || !bounds || field === 'width' || field === 'height') {
        emitSelectionGeometry();
        return;
    }

    const elementIds = layoutGroupElementIds(group);
    const previousState = captureLayoutState();
    if (field === 'x' || field === 'y') {
        const requestedDelta = {
            x: field === 'x' ? value - bounds.x : 0,
            y: field === 'y' ? value - bounds.y : 0,
        };
        const delta = constrainLayoutDelta([bounds], requestedDelta, documentSize.value);
        for (const elementId of elementIds) {
            const frame = elementFrame(elementId);
            const baseFrame = templateElementFrames.value[props.templateId][elementId];
            layoutOffsets.value[props.templateId][elementId] = {
                x: frame.x + delta.x - baseFrame.x,
                y: frame.y + delta.y - baseFrame.y,
            };
        }
        syncSelectedAutoLayoutAnchor();
    } else {
        const currentRotation = group.rotation ?? 0;
        const deltaRotation = normalizeRotation(value - currentRotation);
        const radians = deltaRotation * Math.PI / 180;
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const updates = elementIds.map((elementId) => {
            const frame = elementFrame(elementId);
            const relative = { x: frame.x - center.x, y: frame.y - center.y };
            const requestedFrame = {
                ...frame,
                x: center.x + relative.x * cosine - relative.y * sine,
                y: center.y + relative.x * sine + relative.y * cosine,
            };
            const rotation = normalizeRotation(layoutRotations.value[props.templateId][elementId] + deltaRotation);
            const constrained = keepRotatedFrameInDocument(requestedFrame, rotation, documentSize.value);
            const remainsRigid = constrained &&
                Math.abs(constrained.frame.x - requestedFrame.x) < 0.01 &&
                Math.abs(constrained.frame.y - requestedFrame.y) < 0.01;
            return remainsRigid ? { elementId, frame: requestedFrame, rotation } : null;
        });
        if (updates.some((update) => !update)) {
            emitSelectionGeometry();
            return;
        }
        for (const update of updates) {
            if (!update) continue;
            const baseFrame = templateElementFrames.value[props.templateId][update.elementId];
            layoutOffsets.value[props.templateId][update.elementId] = {
                x: update.frame.x - baseFrame.x,
                y: update.frame.y - baseFrame.y,
            };
            layoutRotations.value[props.templateId][update.elementId] = update.rotation;
        }
        const rotateGroupMetadata = (candidate: LayoutGroup): LayoutGroup => ({
            ...candidate,
            rotation: normalizeRotation((candidate.rotation ?? 0) + deltaRotation),
            children: candidate.children.map((child) =>
                typeof child === 'string' ? child : rotateGroupMetadata(child)),
        });
        layoutGroups.value[props.templateId] = updateLayoutGroup(
            layoutGroups.value[props.templateId],
            group.id,
            rotateGroupMetadata,
        );
        syncSelectedAutoLayoutAnchor();
    }

    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const setSelectedElementGeometry = (
    field: keyof LayoutGeometry,
    value: number,
) => {
    if (selectionContainsLockedElement()) return;
    if (selectedGroupId.value) {
        setSelectedGroupGeometry(field, value);
        return;
    }
    if (!selectedElement.value || !Number.isFinite(value)) {
        return;
    }

    const elementId = selectedElement.value;
    if (customElementById(elementId)?.kind === 'line' && field === 'height') {
        emitSelectionGeometry();
        return;
    }
    const currentFrame = elementFrame(elementId);
    const requestedFrame = isFixedAspectRatioLayoutElement(elementId) && (field === 'width' || field === 'height')
        ? resizeLayoutFrameProportionally(
            currentFrame,
            field === 'width'
                ? { width: value, height: value / (currentFrame.width / currentFrame.height) }
                : { width: value * (currentFrame.width / currentFrame.height), height: value },
            documentSize.value,
        )
        : { ...currentFrame, [field]: value };
    const geometry = constrainLayoutGeometry({
        ...requestedFrame,
        rotation: layoutRotations.value[props.templateId][elementId],
        ...(field === 'rotation' ? { rotation: value } : {}),
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
    if (selectedElements.value.length === 0 || selectionContainsLockedElement() || !selectedElement.value ||
        !isTextLayoutElement(selectedElement.value)) {
        return;
    }

    const selectedTextId = selectedElement.value;
    const currentStyle = layoutTextStyles.value[props.templateId][selectedTextId];
    const nextValue = field === 'fontSize'
        ? constrainFontSize(Number(value))
        : field === 'lineHeight'
            ? constrainLineHeight(Number(value))
            : field === 'letterSpacing'
                ? constrainLetterSpacing(Number(value))
                : field === 'strokeWidth'
                    ? Number(value)
                    : field === 'color' || field === 'stroke' ? String(value).toLowerCase() : String(value);
    const nextStyle = { ...currentStyle, [field]: nextValue } as LayoutTextStyle;
    if (!Number.isFinite(nextStyle.fontSize) || !isHexColor(nextStyle.color) || !isHexColor(nextStyle.stroke) ||
        !Number.isFinite(nextStyle.strokeWidth) || nextStyle.strokeWidth < 0 || nextStyle.strokeWidth > 100 ||
        !nextStyle.fontFamily.trim() || !['normal', 'bold', 'italic', 'bold italic'].includes(nextStyle.fontStyle) ||
        !Number.isFinite(nextStyle.lineHeight) || !Number.isFinite(nextStyle.letterSpacing) ||
        !['left', 'center', 'right'].includes(nextStyle.align) ||
        !['none', 'bullet', 'numbered'].includes(nextStyle.listStyle) ||
        !['none', 'uppercase', 'smallCaps'].includes(nextStyle.textTransform) ||
        !['none', 'single', 'double'].includes(nextStyle.underlineStyle) ||
        !['none', 'single', 'double'].includes(nextStyle.strikethroughStyle)) {
        emitSelectionGeometry();
        return;
    }

    const previousState = captureLayoutState();
    layoutTextStyles.value[props.templateId] = selectedElements.value.reduce(
        (styles, elementId) => isTextLayoutElement(elementId)
            ? { ...styles, [elementId]: { ...styles[elementId], [field]: nextStyle[field] } }
            : styles,
        layoutTextStyles.value[props.templateId],
    );
    if (field === 'color') {
        selectedElements.value.filter(isTextLayoutElement).forEach((elementId) => {
            delete layoutTextStyles.value[props.templateId][elementId].colorGradient;
        });
    }
    selectedElements.value.forEach(syncGraphicTextSize);
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

const setSelectedElementVisualStyle = (
    field: keyof LayoutVisualStyle,
    value: number | string,
) => {
    if (selectionContainsLockedElement() || !selectedElement.value || !isShapeLayoutElement(selectedElement.value)) {
        return;
    }
    const shapeId = selectedElement.value;
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
    if (field === 'fill') delete layoutVisualStyles.value[props.templateId][shapeId].fillGradient;
    const customElement = customElementById(shapeId);
    if (customElement?.kind === 'line' && field === 'strokeWidth') {
        layoutSizes.value[props.templateId][shapeId].height = Math.max(1, Number(nextValue));
    }
    if (customElement?.kind === 'qr') void loadCustomQr(customElement);
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

type LayoutColorField = 'color' | 'fill' | 'stroke';
const setSelectedElementColorBinding = (field: LayoutColorField, binding: LayoutColorBinding | null) => {
    if (selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
    const previousState = captureLayoutState();
    if (field === 'color' || (field === 'stroke' && selectedElements.value.some(isTextLayoutElement))) {
        const bindingField = field === 'color' ? 'colorBinding' : 'strokeBinding';
        for (const elementId of selectedElements.value.filter(isTextLayoutElement)) {
            const style = layoutTextStyles.value[props.templateId][elementId];
            if (!style) continue;
            if (binding) style[bindingField] = { ...binding };
            else delete style[bindingField];
            if (binding && field === 'color') delete style.colorGradient;
        }
    } else {
        const bindingField = field === 'fill' ? 'fillBinding' : 'strokeBinding';
        for (const elementId of selectedElements.value.filter(isShapeLayoutElement)) {
            const style = layoutVisualStyles.value[props.templateId][elementId];
            if (!style) continue;
            if (binding) style[bindingField] = { ...binding };
            else delete style[bindingField];
            if (binding && field === 'fill') delete style.fillGradient;
            const element = customElementById(elementId);
            if (element?.kind === 'qr') void loadCustomQr(element);
        }
    }
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

const setSelectedElementStaticColor = (field: LayoutColorField, color: string) => {
    const normalized = color.toLowerCase();
    if (!isHexColor(normalized) || selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
    const previousState = captureLayoutState();
    if (field === 'color' || (field === 'stroke' && selectedElements.value.some(isTextLayoutElement))) {
        const bindingField = field === 'color' ? 'colorBinding' : 'strokeBinding';
        for (const elementId of selectedElements.value.filter(isTextLayoutElement)) {
            const style = layoutTextStyles.value[props.templateId][elementId];
            if (!style) continue;
            style[field] = normalized;
            delete style[bindingField];
            if (field === 'color') delete style.colorGradient;
        }
    } else {
        const bindingField = field === 'fill' ? 'fillBinding' : 'strokeBinding';
        for (const elementId of selectedElements.value.filter(isShapeLayoutElement)) {
            const style = layoutVisualStyles.value[props.templateId][elementId];
            if (!style) continue;
            style[field] = normalized;
            delete style[bindingField];
            if (field === 'fill') delete style.fillGradient;
            const element = customElementById(elementId);
            if (element?.kind === 'qr') void loadCustomQr(element);
        }
    }
    commitCurrentLayout(previousState);
    colorsStore.rememberColor(normalized);
    emit('layoutChange', currentLayoutChanged.value);
};

const setSelectedElementGradient = (field: 'color' | 'fill', gradient: LayoutGradient | null) => {
    if (selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
    const previousState = captureLayoutState();
    if (field === 'color') {
        for (const elementId of selectedElements.value.filter(isTextLayoutElement)) {
            const style = layoutTextStyles.value[props.templateId][elementId];
            if (!style) continue;
            if (gradient) {
                style.colorGradient = normalizeLayoutGradient(gradient);
                delete style.colorBinding;
            } else {
                delete style.colorGradient;
            }
        }
    } else {
        for (const elementId of selectedElements.value.filter(isShapeLayoutElement)) {
            const element = customElementById(elementId);
            if (element?.kind === 'qr' || element?.kind === 'line') continue;
            const style = layoutVisualStyles.value[props.templateId][elementId];
            if (!style) continue;
            if (gradient) {
                style.fillGradient = normalizeLayoutGradient(gradient);
                delete style.fillBinding;
            } else {
                delete style.fillGradient;
            }
        }
    }
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
        syncSelectedAutoLayoutAnchor();
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

const distributeSelectedElements = (axis: LayoutDistributionAxis) => {
    if (selectedElements.value.length < 3) return;
    const selectedFrames = Object.fromEntries(selectedElements.value.map((elementId) => [elementId, elementFrame(elementId)]));
    const distributed = distributeLayoutFrames(selectedFrames, axis);
    const previousState = captureLayoutState();
    for (const [elementId, frame] of Object.entries(distributed) as [LayoutElementId, LayoutFrame][]) {
        const baseFrame = templateElementFrames.value[props.templateId][elementId];
        layoutOffsets.value[props.templateId][elementId] = { x: frame.x - baseFrame.x, y: frame.y - baseFrame.y };
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

const moveLayerNode = (
    source: LayoutLayerDragNode,
    target: LayoutLayerDragNode,
    placement: LayoutLayerDropPlacement,
) => {
    if (source.kind === target.kind && source.id === target.id) return;
    const groups = layoutGroups.value[props.templateId];
    const sourceGroup = source.kind === 'group' ? flattenLayoutGroups(groups).find(({ id }) => id === source.id) : null;
    const targetGroup = target.kind === 'group' ? flattenLayoutGroups(groups).find(({ id }) => id === target.id) : null;
    const movingElementIds = sourceGroup ? layoutGroupElementIds(sourceGroup) : [source.id as LayoutElementId];
    const targetElementIds = targetGroup ? layoutGroupElementIds(targetGroup) : [target.id as LayoutElementId];
    if (movingElementIds.some((elementId) => targetElementIds.includes(elementId)) || movingElementIds.some(elementIsLocked)) return;

    const previousState = captureLayoutState();
    layoutOrder.value[props.templateId] = moveLayoutOrderBlock(
        layoutOrder.value[props.templateId], movingElementIds, targetElementIds, placement,
    );
    if (placement === 'inside' && target.kind === 'group') {
        layoutGroups.value[props.templateId] = nestLayoutNodeInGroup(groups, source, target.id);
        reflowAutoLayoutGroups();
    }
    commitCurrentLayout(previousState);
    const updatedTargetGroup = placement === 'inside' && target.kind === 'group'
        ? flattenLayoutGroups(layoutGroups.value[props.templateId]).find(({ id }) => id === target.id)
        : null;
    updateSelection(
        updatedTargetGroup ? layoutGroupElementIds(updatedTargetGroup) : movingElementIds,
        updatedTargetGroup?.id ?? sourceGroup?.id ?? null,
    );
    emit('layoutChange', currentLayoutChanged.value);
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

const pruneEffectsForCurrentTargets = () => {
    const validTargets = new Set<string>([
        ...layoutOrder.value[props.templateId],
        ...flattenLayoutGroups(layoutGroups.value[props.templateId]).map(({ id }) => id),
    ]);
    layoutEffects.value[props.templateId] = Object.fromEntries(
        Object.entries(layoutEffects.value[props.templateId]).filter(([targetId]) => validTargets.has(targetId)),
    );
};

const addElement = (
    kind: LayoutCustomElementKind,
    options: {
        imageSource?: string;
        name?: string;
        text?: string;
        textMode?: LayoutTextMode;
        iconName?: PublisherIconName;
        qrValue?: string;
        dataBinding?: string;
        position?: { x: number; y: number };
    } = {},
) => {
    if (kind === 'image' && !options.imageSource) return;
    if (kind === 'icon' && !options.iconName) return;
    const previousState = captureLayoutState();
    const element = createLayoutCustomElement(kind, documentSize.value, options);
    customElements.value[props.templateId] = [...customElements.value[props.templateId], element];
    layoutOffsets.value[props.templateId][element.id] = { x: 0, y: 0 };
    layoutSizes.value[props.templateId][element.id] = {
        width: element.frame.width,
        height: element.frame.height,
    };
    layoutRotations.value[props.templateId][element.id] = 0;
    layoutOrder.value[props.templateId] = [...layoutOrder.value[props.templateId], element.id];
    if (kind === 'text') {
        const style = createCustomTextStyle(colorsStore.lastUsedColor ?? undefined);
        layoutTextStyles.value[props.templateId][element.id] = style;
        if (customTextMode(element) === 'graphic') {
            syncGraphicTextSize(element.id);
        } else {
            const measured = measureCustomText(element, style);
            layoutSizes.value[props.templateId][element.id] = {
                width: element.frame.width,
                height: Math.max(element.frame.height, measured.height),
            };
        }
        if (!options.position) {
            const size = layoutSizes.value[props.templateId][element.id];
            layoutOffsets.value[props.templateId][element.id] = {
                x: (element.frame.width - size.width) / 2,
                y: (element.frame.height - size.height) / 2,
            };
        }
    }
    if (['rectangle', 'circle', 'triangle', 'line', 'icon', 'qr'].includes(kind)) {
        const recentColor = colorsStore.lastUsedColor;
        layoutVisualStyles.value[props.templateId][element.id] = kind === 'qr'
            ? { fill: recentColor ?? '#000000', stroke: recentColor ?? '#000000', strokeWidth: 0 }
            : kind === 'line'
                ? { fill: recentColor ?? '#69a7e8', stroke: recentColor ?? '#69a7e8', strokeWidth: 4 }
                : createCustomVisualStyle(recentColor ?? undefined);
    }
    loadCustomImage(element);
    void loadCustomQr(element);
    commitCurrentLayout(previousState);
    updateSelection([element.id]);
    emit('availableElementsChange', availableElements.value);
    emit('layoutChange', true);
};

const handleDataFieldDrop = (event: DragEvent) => {
    const transferred = parsePublisherDataTransfer(event.dataTransfer?.getData(PUBLISHER_DATA_TRANSFER_TYPE) ?? '');
    if (!transferred || (transferred.type === 'image' && !transferred.value)) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const preferredOffset = transferred.type === 'image' ? { x: 240, y: 160 } : { x: 260, y: 70 };
    const position = {
        x: (event.clientX - bounds.left) / previewScale.value - preferredOffset.x,
        y: (event.clientY - bounds.top) / previewScale.value - preferredOffset.y,
    };
    addElement(transferred.type, {
        name: transferred.label,
        imageSource: transferred.type === 'image' ? transferred.value : undefined,
        text: transferred.type === 'text' ? `{{${transferred.id}}}` : undefined,
        textMode: transferred.type === 'text' ? 'frame' : undefined,
        dataBinding: transferred.id,
        position,
    });
};

const setSelectedElementTextContent = (value: string) => {
    const elementId = selectedElement.value;
    if (!elementId || elementIsLocked(elementId) || !elementId.startsWith('text-')) return;
    const previousState = captureLayoutState();
    customElements.value[props.templateId] = customElements.value[props.templateId].map((element) =>
        element.id === elementId
            ? { ...element, text: value, name: element.dataBinding ? element.name : value.trim() || 'Text' }
            : element);
    syncGraphicTextSize(elementId);
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', true);
};

const setSelectedCustomTextMode = (mode: LayoutTextMode) => {
    if ((mode !== 'graphic' && mode !== 'frame') || selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
    const customTextIds = selectedElements.value.filter((elementId) => {
        const element = customElementById(elementId);
        return element?.kind === 'text';
    });
    if (customTextIds.length === 0) return;
    const previousState = captureLayoutState();
    const ids = new Set(customTextIds);
    customElements.value[props.templateId] = customElements.value[props.templateId].map((element) =>
        ids.has(element.id) ? { ...element, textMode: mode } : element);
    if (mode === 'graphic') customTextIds.forEach(syncGraphicTextSize);
    reflowAutoLayoutGroups();
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    emitSelectionGeometry();
    void syncTransformer();
};

const setSelectedQrOptions = (
    field: 'qrValue' | 'qrBackground' | 'qrMargin' | 'qrErrorCorrection',
    value: string | number,
) => {
    const elementId = selectedElement.value;
    const element = elementId ? customElementById(elementId) : null;
    if (!element || element.kind !== 'qr') return;
    const nextValue = field === 'qrMargin' ? Number(value) : String(value);
    if ((field === 'qrMargin' && (!Number.isFinite(nextValue) || Number(nextValue) < 0 || Number(nextValue) > 10)) ||
        (field === 'qrBackground' && !isHexColor(String(nextValue))) ||
        (field === 'qrErrorCorrection' && !['L', 'M', 'Q', 'H'].includes(String(nextValue))) ||
        (field === 'qrValue' && String(nextValue).length > 10_000)) return;
    const previousState = captureLayoutState();
    let updated: LayoutCustomElement | null = null;
    customElements.value[props.templateId] = customElements.value[props.templateId].map((candidate) => {
        if (candidate.id !== elementId) return candidate;
        if (field === 'qrValue') {
            const { dataBinding: _, ...unboundCandidate } = candidate;
            updated = { ...unboundCandidate, qrValue: String(nextValue) };
        } else {
            updated = { ...candidate, [field]: nextValue };
        }
        return updated;
    });
    if (updated) void loadCustomQr(updated);
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

const setElementEffects = (targetIds: string[], effects: LayoutElementEffects) => {
    const groupsById = new Map(flattenLayoutGroups(layoutGroups.value[props.templateId]).map((group) => [group.id, group]));
    const existingIds = targetIds.filter((targetId) => {
        const group = groupsById.get(targetId);
        return group
            ? !layoutGroupElementIds(group).some(elementIsLocked)
            : (
                layoutOrder.value[props.templateId].includes(targetId as LayoutElementId) &&
                !elementIsLocked(targetId as LayoutElementId)
            );
    });
    if (existingIds.length === 0) return;
    const previousState = captureLayoutState();
    const nextEffects = { ...layoutEffects.value[props.templateId] };
    const normalized = normalizeLayoutElementEffects(effects);
    for (const elementId of existingIds) {
        if (layoutElementHasEffects(normalized)) {
            nextEffects[elementId] = {
                ...normalized,
                shadow: { ...normalized.shadow },
                blur: { ...normalized.blur },
            };
        } else {
            delete nextEffects[elementId];
        }
    }
    layoutEffects.value[props.templateId] = nextEffects;
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
};

const deleteElements = (elementIds: LayoutElementId[]) => {
    const existingIds = elementIds.filter((elementId) =>
        layoutOrder.value[props.templateId].includes(elementId) && !elementIsLocked(elementId));
    if (existingIds.length === 0) {
        return;
    }
    const previousState = captureLayoutState();
    const deleted = new Set([...deletedElements.value[props.templateId], ...existingIds]);
    deletedElements.value[props.templateId] = allElementIds(props.templateId).filter((elementId) => deleted.has(elementId));
    hiddenElements.value[props.templateId] = hiddenElements.value[props.templateId]
        .filter((elementId) => !deleted.has(elementId));
    lockedElements.value[props.templateId] = lockedElements.value[props.templateId]
        .filter((elementId) => !deleted.has(elementId));
    layoutEffects.value[props.templateId] = Object.fromEntries(
        Object.entries(layoutEffects.value[props.templateId]).filter(([elementId]) => !deleted.has(elementId as LayoutElementId)),
    );
    layoutOrder.value[props.templateId] = layoutOrder.value[props.templateId].filter((elementId) => !deleted.has(elementId));
    layoutGroups.value[props.templateId] = pruneDeletedElementsFromGroups(layoutGroups.value[props.templateId], deleted);
    pruneEffectsForCurrentTargets();
    commitCurrentLayout(previousState);
    updateSelection([]);
    emit('availableElementsChange', availableElements.value);
    emit('layoutChange', currentLayoutChanged.value);
};

const deleteSelectedElements = () => deleteElements(selectedElements.value);

const toggleElementsVisibility = (elementIds: LayoutElementId[]) => {
    const existingIds = elementIds.filter((elementId) =>
        layoutOrder.value[props.templateId].includes(elementId));
    if (existingIds.length === 0) return;
    const previousState = captureLayoutState();
    const hidden = new Set(hiddenElements.value[props.templateId]);
    const shouldShow = existingIds.every((elementId) => hidden.has(elementId));
    existingIds.forEach((elementId) => shouldShow ? hidden.delete(elementId) : hidden.add(elementId));
    hiddenElements.value[props.templateId] = layoutOrder.value[props.templateId]
        .filter((elementId) => hidden.has(elementId));
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const toggleElementsLock = (elementIds: LayoutElementId[]) => {
    const existingIds = elementIds.filter((elementId) =>
        layoutOrder.value[props.templateId].includes(elementId));
    if (existingIds.length === 0) return;
    const previousState = captureLayoutState();
    const locked = new Set(lockedElements.value[props.templateId]);
    const shouldUnlock = existingIds.every((elementId) => locked.has(elementId));
    existingIds.forEach((elementId) => shouldUnlock ? locked.delete(elementId) : locked.add(elementId));
    lockedElements.value[props.templateId] = layoutOrder.value[props.templateId]
        .filter((elementId) => locked.has(elementId));
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const resetLayout = () => {
    const previousState = captureLayoutState();
    customElements.value[props.templateId] = [];
    reloadAllCustomImages();
    customQrNodes.value = {};
    layoutOffsets.value[props.templateId] = createLayoutOffsets();
    layoutSizes.value[props.templateId] = createPageLayoutSizes(props.templateId);
    layoutRotations.value[props.templateId] = createLayoutRotations();
    layoutOrder.value[props.templateId] = createLayoutOrder();
    layoutTextStyles.value[props.templateId] = createPageLayoutTextStyles(props.templateId);
    layoutVisualStyles.value[props.templateId] = createPageLayoutVisualStyles(props.templateId);
    layoutGroups.value[props.templateId] = createLayoutGroups();
    layoutEffects.value[props.templateId] = {};
    deletedElements.value[props.templateId] = [];
    hiddenElements.value[props.templateId] = [];
    lockedElements.value[props.templateId] = [];
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
            const defaultOrder = isBuiltInLayoutElement(elementId)
                ? createLayoutOrder()
                : layoutOrder.value[props.templateId];
            const order = state.order.filter((candidate) => candidate !== elementId);
            order.splice(defaultOrder.indexOf(elementId), 0, elementId);
            return {
                ...state,
                offsets: { ...state.offsets, [elementId]: { x: 0, y: 0 } },
                sizes: {
                    ...state.sizes,
                    [elementId]: {
                        width: templateElementFrames.value[props.templateId][elementId].width,
                        height: templateElementFrames.value[props.templateId][elementId].height,
                    },
                },
                rotations: { ...state.rotations, [elementId]: 0 },
                order,
                styles: {
                    ...state.styles,
                    ...(isTextLayoutElement(elementId)
                        ? { [elementId]: isBuiltInLayoutElement(elementId)
                            ? { ...createPageLayoutTextStyles(props.templateId)[elementId] }
                            : createCustomTextStyle() }
                        : {}),
                },
                visualStyles: {
                    ...state.visualStyles,
                    ...(isShapeLayoutElement(elementId)
                        ? { [elementId]: isBuiltInLayoutElement(elementId)
                            ? { ...createPageLayoutVisualStyles(props.templateId)[elementId] }
                            : createCustomVisualStyle() }
                        : {}),
                },
                effects: Object.fromEntries(
                    Object.entries(state.effects ?? {}).filter(([id]) => id !== elementId),
                ),
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
    layoutEffects.value[props.templateId] = reset.effects ?? {};
    if (selectedGroupId.value) {
        const resetGroupRotation = (group: LayoutGroup): LayoutGroup => ({
            ...group,
            rotation: 0,
            children: group.children.map((child) =>
                typeof child === 'string' ? child : resetGroupRotation(child)),
        });
        layoutGroups.value[props.templateId] = updateLayoutGroup(
            reset.groups,
            selectedGroupId.value,
            resetGroupRotation,
        );
    }
    selectedElements.value.forEach(syncGraphicTextSize);
    commitCurrentLayout(previousState);
    emit('layoutChange', currentLayoutChanged.value);
    emitLayerPosition();
    void syncTransformer();
};

const undoLayout = () => {
    const result = documentStore.undoPageLayout(props.pageId, props.templateId);
    if (!result) {
        return;
    }

    restoreLayoutState(result.state);
    emitHistoryState();
};

const redoLayout = () => {
    const result = documentStore.redoPageLayout(props.pageId, props.templateId);
    if (!result) {
        return;
    }

    restoreLayoutState(result.state);
    emitHistoryState();
};

const restoreDraftLayouts = () => {
    documentStore.ensurePageLayout(props.pageId, props.templateId, () => createPageLayoutState(props.templateId));
    documentStore.resetPageLayoutHistory(props.pageId, props.templateId);
    reloadAllCustomImages();
    reloadCurrentCustomQrs();
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
    syncAllGraphicTextSizes();
    if (flattenLayoutGroups(layoutGroups.value[props.templateId]).some(({ autoLayout }) => autoLayout)) {
        reflowAutoLayoutGroups();
        emit('layoutStateChange', props.templateId, captureLayoutState());
    }
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
watch(() => props.dataValues, () => {
    reloadAllCustomImages();
    reloadCurrentCustomQrs();
    syncAllGraphicTextSizes();
    if (flattenLayoutGroups(layoutGroups.value[props.templateId]).some(({ autoLayout }) => autoLayout)) {
        reflowAutoLayoutGroups();
        emit('layoutStateChange', props.templateId, captureLayoutState());
    }
    emitSelectionGeometry();
    void syncTransformer();
}, { deep: true });
watch(() => imagePaletteStore.revision, () => {
    reloadCurrentCustomQrs();
    void syncTransformer();
});
watch(() => props.draftId, restoreDraftLayouts, { immediate: true });
watch(
    () => props.templateId,
    () => {
        reloadCurrentCustomQrs();
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

const exportImage = async ({ format, quality }: PublisherCanvasExportOptions) => {
    await document.fonts.ready;
    reflowAutoLayoutGroups();

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

    let jpegBackground: KonvaRect | null = null;
    try {
        isExporting.value = true;
        await syncTransformer();
        stage.size({ width: props.documentWidth, height: props.documentHeight });
        stage.scale({ x: 1, y: 1 });
        if (format === 'jpeg') {
            const layer = stage.getLayers()[0];
            if (layer) {
                jpegBackground = new KonvaRect({
                    x: 0,
                    y: 0,
                    width: props.documentWidth,
                    height: props.documentHeight,
                    fill: '#ffffff',
                    listening: false,
                });
                layer.add(jpegBackground);
                jpegBackground.moveToBottom();
            }
        }
        stage.draw();
        return stage.toDataURL({
            pixelRatio: 1,
            mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
            quality: format === 'jpeg' ? quality : undefined,
        });
    } finally {
        jpegBackground?.destroy();
        isExporting.value = false;
        stage.size({ width: previewState.width, height: previewState.height });
        stage.scale({ x: previewState.scaleX, y: previewState.scaleY });
        await syncTransformer();
        stage.draw();
    }
};

defineExpose({
    addElement,
    alignSelectedElement,
    distributeSelectedElements,
    changeSelectedLayer,
    clearSelection,
    drillIntoElement,
    deleteElements,
    deleteSelectedElements,
    exportImage,
    groupSelectedElements,
    getLayoutState,
    moveLayerNode,
    nudgeSelectedElement,
    redoLayout,
    resetLayout,
    resetSelectedElement,
    resizeSelectedElement,
    rotateSelectedElement,
    setSelectedElementGeometry,
    setSelectedElementGradient,
    setElementEffects,
    setSelectedElementColorBinding,
    setSelectedElementStaticColor,
    setSelectedElementTextStyle,
    setSelectedElementTextContent,
    setSelectedGroupAutoLayout,
    setSelectedCustomTextMode,
    setSelectedQrOptions,
    setSelectedElementVisualStyle,
    toggleElementsLock,
    toggleElementsVisibility,
    selectElement,
    selectGroup,
    undoLayout,
    ungroupSelectedElements,
});
</script>

<template>
    <div class="template-preview" @dragover.prevent @drop.prevent="handleDataFieldDrop">
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
                <CanvasSceneTree
                    :draggable-group-ids="draggableGroupIds"
                    :editor-scale="previewScale"
                    :effects="layoutEffects[templateId]"
                    :group-frames="canvasGroupFrames"
                    :locked-element-ids="lockedElements[templateId]"
                    :nodes="canvasSceneNodes"
                    :render-revision="sceneRenderRevision"
                    :selected-group-id="isExporting ? null : selectedGroupId"
                    @group-drag-start="startGroupDrag"
                    @group-dragging="alignGroupWhileDragging"
                    @group-move="moveGroup"
                    @group-transform="transformGroup"
                >
                    <template #before-element="{ elementId, origin }">
                        <v-group v-if="elementId === 'image'" :config="{ listening: false }">
                            <template v-for="decoration in decorationLayers('behindImage')" :key="decoration.id">
                                <v-rect v-if="decoration.type === 'rect'" :config="decorationConfig(decoration, origin)" />
                                <v-text v-else :config="decorationConfig(decoration, origin)" />
                            </template>
                        </v-group>
                    </template>
                    <template #element="{ elementId, origin }">
                      <template v-for="item in canvasRenderItem(elementId)" :key="item.id">
                    <EditableVisualElement
                        v-if="item.role === 'background'"
                        element-id="background"
                        :frame="relativeElementFrame('background', origin)"
                        :locked="elementIsLocked('background') || !elementCanDragDirectly('background')"
                        :editor-scale="previewScale"
                        :rotation="layoutRotations[templateId].background"
                        :selected="selectedElements.includes('background') && !isExporting"
                        :effects="elementEffects('background')"
                        :visual-config="visualConfig('background')"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableVisualElement
                        v-else-if="item.role === 'image'"
                        element-id="image"
                        :frame="relativeElementFrame('image', origin)"
                        :locked="elementIsLocked('image') || !elementCanDragDirectly('image')"
                        :editor-scale="previewScale"
                        :image-config="imageIsVisible ? imageConfig : null"
                        :rotation="layoutRotations[templateId].image"
                        :selected="selectedElements.includes('image') && !isExporting"
                        :effects="elementEffects('image')"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableVisualElement
                        v-else-if="item.role === 'accent'"
                        element-id="accent"
                        :frame="relativeElementFrame('accent', origin)"
                        :locked="elementIsLocked('accent') || !elementCanDragDirectly('accent')"
                        :editor-scale="previewScale"
                        :rotation="layoutRotations[templateId].accent"
                        :selected="selectedElements.includes('accent') && !isExporting"
                        :effects="elementEffects('accent')"
                        :visual-config="visualConfig('accent')"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableTextElement
                        v-else-if="item.role === 'templateText'"
                        :element-id="item.id"
                        :decoration-lines="editableTextDecorationLines(item.id)"
                        :editor-scale="previewScale"
                        :frame="relativeElementFrame(item.id, origin)"
                        :graphic-text="false"
                        :locked="elementIsLocked(item.id) || !elementCanDragDirectly(item.id)"
                        :rotation="layoutRotations[templateId][item.id]"
                        :selected="selectedElements.includes(item.id) && !isExporting"
                        :effects="elementEffects(item.id)"
                        :text-config="editableTextConfig(item.id)"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableTextElement
                        v-else-if="item.role === 'custom' && item.element.kind === 'text'"
                        :element-id="item.element.id"
                        :decoration-lines="customTextDecorationLines(item.element)"
                        :editor-scale="previewScale"
                        :frame="relativeElementFrame(item.element.id, origin)"
                        :graphic-text="customTextMode(item.element) === 'graphic'"
                        :locked="elementIsLocked(item.element.id) || !elementCanDragDirectly(item.element.id)"
                        :rotation="layoutRotations[templateId][item.element.id]"
                        :selected="selectedElements.includes(item.element.id) && !isExporting"
                        :effects="elementEffects(item.element.id)"
                        :text-config="customTextConfig(item.element)"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableVisualElement
                        v-else-if="item.role === 'custom'"
                        :element-id="item.element.id"
                        :editor-scale="previewScale"
                        :frame="relativeElementFrame(item.element.id, origin)"
                        :locked="elementIsLocked(item.element.id) || !elementCanDragDirectly(item.element.id)"
                        :image-config="item.element.kind === 'image'
                            ? customImageConfig(item.element)
                            : item.element.kind === 'qr' && customQrNodes[item.element.id]
                                ? { image: customQrNodes[item.element.id] }
                                : null"
                        :path-config="item.element.kind === 'icon' ? customIconPathConfig(item.element) : null"
                        :rotation="layoutRotations[templateId][item.element.id]"
                        :selected="selectedElements.includes(item.element.id) && !isExporting"
                        :effects="elementEffects(item.element.id)"
                        :shape="customShapeType(item.element)"
                        :visual-config="item.element.kind === 'image' || item.element.kind === 'qr' ? null : customVisualConfig(item.element.id)"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                      </template>
                    </template>
                    <template #after-element="{ elementId, origin }">
                        <v-group v-if="elementId === 'image'" :config="{ listening: false }">
                            <template v-for="decoration in decorationLayers('overImage')" :key="decoration.id">
                                <v-rect v-if="decoration.type === 'rect'" :config="decorationConfig(decoration, origin)" />
                                <v-text v-else :config="decorationConfig(decoration, origin)" />
                            </template>
                        </v-group>
                    </template>
                </CanvasSceneTree>
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
                <v-transformer ref="transformerRef" :config="transformerConfig" @transformstart="cancelSelectionRectangle" />
            </v-layer>
        </v-stage>
    </div>
</template>
