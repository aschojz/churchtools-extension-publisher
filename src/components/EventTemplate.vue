<script setup lang="ts">
import type Konva from 'konva';
import { Rect as KonvaRect } from 'konva/lib/shapes/Rect';
import { Text as KonvaText } from 'konva/lib/shapes/Text';
import QRCode from 'qrcode';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, ref, shallowRef, toRef, watch } from 'vue';

import EditableTextElement from './EditableTextElement.vue';
import EditableVisualElement from './EditableVisualElement.vue';
import CanvasGradientHandles from './CanvasGradientHandles.vue';
import CanvasSceneTree from './CanvasSceneTree.vue';
import { useCanvasDataFieldDrop } from '../composables/useCanvasDataFieldDrop';
import { useCanvasElementStyles } from '../composables/useCanvasElementStyles';
import { useCanvasGroups } from '../composables/useCanvasGroups';
import { useCanvasSelection } from '../composables/useCanvasSelection';
import { useCanvasTransformer } from '../composables/useCanvasTransformer';
import { useCanvasTransforms } from '../composables/useCanvasTransforms';
import type { EventTemplateProps } from '../domain/EventTemplateProps';
import {
    publisherDataValue,
    resolvePublisherPlaceholders,
    type PublisherDataValues,
} from '../domain/appointmentDataFields';
import { calculateCoverCrop, type ImageFocus } from '../domain/imageFocus';
import { createPublisherImageUrl } from '../domain/mapAppointmentToTemplateProps';
import { layoutGradientFillConfig } from '../domain/layoutGradient';
import {
    layoutFilterStackHasEnabled,
    normalizeLayoutFilterStack,
} from '../domain/layoutFilters';
import { publisherIcon, type PublisherIconName } from '../domain/publisherIcons';
import { usePublisherImagePalettesStore } from '../stores/publisherImagePalettes';
import { usePublisherColorsStore } from '../stores/publisherColors';
import { usePublisherDocumentStore } from '../stores/publisherDocument';
import { usePublisherEditorStore } from '../stores/publisherEditor';
import {
    alignLayoutGeometry,
    constrainFontSize,
    createCustomTextStyle,
    createCustomVisualStyle,
    createLayoutLayerTree,
    createLayoutCustomElement,
    createLayoutOrder,
    createLayoutVisualStyles,
    flattenLayoutGroups,
    findLayoutGroupPath,
    isFixedAspectRatioLayoutElement,
    isShapeLayoutElement,
    isTextLayoutElement,
    type AlignmentGuide,
    type LayoutElementId,
    type LayoutCustomElement,
    type LayoutCustomElementKind,
    type LayoutFrame,
    type LayoutSelectionGeometry,
    type LayoutGroup,
    type LayoutDistributionAxis,
    type LayoutGroups,
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
    distributeLayoutFrames,
    resizeLayoutFrame,
} from '../domain/layoutEditing';
import {
    cloneLayoutState,
    type SerializableLayoutState,
} from '../domain/layoutHistory';
import { createLayoutRepeatProjection } from '../domain/layoutRepeat';
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
    layoutChange: [changed: boolean];
    layoutStateChange: [templateId: TemplateId, state: SerializableLayoutState];
    renderContentChange: [];
    availableElementsChange: [elementIds: LayoutElementId[]];
    layerPositionChange: [position: number, total: number];
    selectionChange: [elementId: LayoutElementId | null];
    selectionIdsChange: [elementIds: LayoutElementId[]];
    selectionGroupChange: [canGroup: boolean, canUngroup: boolean, groupDepth: number];
    selectionGroupPathChange: [groupIds: string[]];
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
const customImageRenderRevisions = new Map<LayoutElementId, number>();

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
const layoutOffsets = layoutSectionProxy('offsets');
const layoutSizes = layoutSectionProxy('sizes');
const layoutRotations = layoutSectionProxy('rotations');
const layoutOrder = layoutSectionProxy('order');
const layoutTextStyles = layoutSectionProxy('styles');
const layoutVisualStyles = layoutSectionProxy('visualStyles');
const layoutGroups = layoutSectionProxy('groups');
const layoutEffects = layoutSectionProxy('effects');
const layoutFilters = layoutSectionProxy('filters');
const deletedElements = layoutSectionProxy('deleted');
const hiddenElements = layoutSectionProxy('hidden');
const lockedElements = layoutSectionProxy('locked');
const elementIsLocked = (elementId: LayoutElementId) => lockedElements.value[props.templateId].includes(elementId);
const availableElements = computed(() =>
    layoutOrder.value[props.templateId].filter((elementId) => !deletedElements.value[props.templateId].includes(elementId)));
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
const selectedElementTouchesTopEdge = computed(() => {
    if (selectedGroupId.value || selectedElements.value.length !== 1 || !selectedElement.value) return false;
    const elementId = selectedElement.value;
    const baseFrame = templateElementFrames.value[props.templateId][elementId];
    const offset = layoutOffsets.value[props.templateId][elementId];
    const rotation = layoutRotations.value[props.templateId][elementId] % 360;
    return rotation === 0 && (baseFrame.y + offset.y) * previewScale.value < 24;
});
const snapEnabledRef = toRef(props, 'snapEnabled');
const { syncTransformer, transformerConfig } = useCanvasTransformer({
    documentSize,
    elementIsLocked,
    getElementRotation: (elementId) => layoutRotations.value[props.templateId][elementId],
    isExporting,
    onAutoFitTextFrame: (axis) => autoFitSelectedTextFrame(axis),
    selectedElement,
    selectedElementTouchesTopEdge,
    selectedElements,
    selectedGraphicText,
    selectedGroupId,
    selectedKeepsAspectRatio,
    selectedLine,
    snapEnabled: snapEnabledRef,
    stageRef,
    transformerRef,
});
const {
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
} = useCanvasSelection({
    elementIsLocked,
    getDeletedElements: () => deletedElements.value[props.templateId],
    getLayoutGroups: () => layoutGroups.value[props.templateId],
    getLayoutOrder: () => layoutOrder.value[props.templateId],
    onSelectionDetailsChange: () => emitSelectionGeometry(),
    onSelectionStateChange: (selection) => {
        emit('selectionIdsChange', selection.elementIds);
        emit('selectionChange', selection.elementId);
        emit('selectionGroupPathChange', selection.groupPath);
        emit('selectionGroupChange', selection.canGroup, selection.canUngroup, selection.groupDepth);
        emit('layerPositionChange', selection.layerPosition, selection.layerTotal);
    },
    selectedElements,
    selectedGroupId,
    stageRef,
    syncTransformer,
    transformerRef,
});

const emitLayerPosition = () => {
    const selection = selectionSnapshot();
    emit('layerPositionChange', selection.layerPosition, selection.layerTotal);
};

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
const elementFilters = (targetId: string) =>
    normalizeLayoutFilterStack(layoutFilters.value[props.templateId][targetId]);

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

const resolvedCustomText = (
    element: LayoutCustomElement,
    style: LayoutTextStyle,
    dataValues: PublisherDataValues = props.dataValues,
) =>
    applyTextTransform(
        applyListStyle(resolvePublisherPlaceholders(element.text ?? 'Neuer Text', dataValues), style.listStyle),
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

const customTextConfig = (element: LayoutCustomElement, dataValues: PublisherDataValues = props.dataValues) => {
    const style = layoutTextStyles.value[props.templateId][element.id] ?? createCustomTextStyle();
    return {
        text: resolvedCustomText(element, style, dataValues),
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

const customTextDecorationLines = (element: LayoutCustomElement, dataValues: PublisherDataValues = props.dataValues) => {
    const style = layoutTextStyles.value[props.templateId][element.id] ?? createCustomTextStyle();
    return additionalTextDecorationLines(
        element.id,
        customTextConfig(element, dataValues),
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

const imageRequestPixelRatio = () => {
    const displayDensity = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.max(1, Math.min(2, previewScale.value * displayDensity));
};

const requestedImageSource = (
    source: string,
    frame: Pick<LayoutFrame, 'width' | 'height'>,
    focusZoom = 100,
) => createPublisherImageUrl(source, {
    width: frame.width,
    height: frame.height,
    focusZoom,
    pixelRatio: imageRequestPixelRatio(),
});

const loadCustomImage = (element: LayoutCustomElement) => {
    const source = resolvedCustomImageSource(element);
    if (element.kind !== 'image') return;
    const revision = (customImageRenderRevisions.get(element.id) ?? 0) + 1;
    customImageRenderRevisions.set(element.id, revision);
    if (!source) {
        const { [element.id]: _, ...remaining } = customImageNodes.value;
        customImageNodes.value = remaining;
        return;
    }
    const renderSource = requestedImageSource(source, elementFrame(element.id));
    const nextImage = new Image();
    if (/^https?:\/\//i.test(renderSource)) nextImage.crossOrigin = 'anonymous';
    nextImage.onload = () => {
        if (customImageRenderRevisions.get(element.id) !== revision) return;
        customImageNodes.value = { ...customImageNodes.value, [element.id]: nextImage };
        emit('renderContentChange');
    };
    nextImage.onerror = () => {
        if (customImageRenderRevisions.get(element.id) !== revision) return;
        const { [element.id]: _, ...remaining } = customImageNodes.value;
        customImageNodes.value = remaining;
    };
    nextImage.src = renderSource;
};

const loadCustomImages = (elements: LayoutCustomElement[]) => {
    const imageIds = new Set<string>(elements.filter(({ kind }) => kind === 'image').map(({ id }) => id));
    customImageNodes.value = Object.fromEntries(
        Object.entries(customImageNodes.value).filter(([elementId]) => imageIds.has(elementId)),
    );
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
                emit('renderContentChange');
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
        Object.values(layoutFilters.value[props.templateId]).some(layoutFilterStackHasEnabled) ||
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

const appointmentImageRenderSource = computed(() => props.template.imageUrl
    ? requestedImageSource(props.template.imageUrl, elementFrame('image'), props.imageFocus.zoom)
    : null);

const customImageRenderSources = computed(() => Object.fromEntries(
    customElements.value[props.templateId]
        .filter(({ kind }) => kind === 'image')
        .map((element) => {
            const source = resolvedCustomImageSource(element);
            return [element.id, source ? requestedImageSource(source, elementFrame(element.id)) : ''];
        }),
));

const gradientPaintFrame = (elementId: LayoutElementId, frame: LayoutFrame): LayoutFrame => {
    const element = customElementById(elementId);
    if (element?.kind !== 'icon' || !element.iconName) return frame;
    const definition = publisherIcon(element.iconName).icon;
    const sourceWidth = definition.icon[0];
    const sourceHeight = definition.icon[1];
    const scale = Math.min(frame.width / sourceWidth, frame.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return {
        x: frame.x + (frame.width - width) / 2,
        y: frame.y + (frame.height - height) / 2,
        width,
        height,
    };
};

const activeCanvasGradient = computed(() => {
    if (selectedGroupId.value || selectedElements.value.length !== 1 || !selectedElement.value ||
        elementIsLocked(selectedElement.value)) return null;
    const elementId = selectedElement.value;
    const textGradient = isTextLayoutElement(elementId)
        ? layoutTextStyles.value[props.templateId][elementId]?.colorGradient
        : undefined;
    const fillGradient = isShapeLayoutElement(elementId)
        ? layoutVisualStyles.value[props.templateId][elementId]?.fillGradient
        : undefined;
    const gradient = textGradient ?? fillGradient;
    if (!gradient) return null;
    const frame = elementFrame(elementId);
    return {
        elementId,
        field: textGradient ? 'color' as const : 'fill' as const,
        frame: gradientPaintFrame(elementId, frame),
        gradient,
        rotation: layoutRotations.value[props.templateId][elementId],
        rotationOrigin: { x: frame.x, y: frame.y },
    };
});

const elementVisualBounds = (elementId: LayoutElementId) => {
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
};

const canvasRepeatProjection = computed(() => createLayoutRepeatProjection(
    layoutGroups.value[props.templateId],
    Object.fromEntries(layoutOrder.value[props.templateId].map((elementId) => [elementId, elementVisualBounds(elementId)])),
    props.dataValues,
));
const selectedGroupVisualBounds = (group: LayoutGroup): LayoutFrame | null =>
    canvasRepeatProjection.value.groupFrames[group.id] ?? null;

const canvasSceneNodes = computed(() => createLayoutLayerTree(
    layoutOrder.value[props.templateId],
    layoutGroups.value[props.templateId],
    deletedElements.value[props.templateId].filter((elementId) => elementId !== 'image').concat(
        props.template.location ? [] : ['location'],
    ),
));
const canvasGroupFrames = computed<Record<string, LayoutFrame>>(() => canvasRepeatProjection.value.groupFrames);
const canvasPrototypeGroupFrames = computed<Record<string, LayoutFrame>>(() => canvasRepeatProjection.value.prototypeFrames);
const canvasGroupRepeats = computed(() => Object.fromEntries(
    flattenLayoutGroups(layoutGroups.value[props.templateId]).flatMap((group) => group.repeat ? [[group.id, group.repeat]] : []),
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
    JSON.stringify(props.dataValues),
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

const {
    groupSelectedElements,
    moveLayerNode,
    pruneEffectsForCurrentTargets,
    reflowAutoLayoutGroups,
    setSelectedGroupAutoLayout,
    setSelectedGroupRepeat,
    syncSelectedAutoLayoutAnchor,
    ungroupSelectedElements,
} = useCanvasGroups({
    autoLayoutTextHeight,
    captureLayoutState: () => captureLayoutState(),
    commitCurrentLayout: (previousState) => commitCurrentLayout(previousState),
    elementFrame,
    elementIsLocked,
    getBaseFrame: (elementId) => templateElementFrames.value[props.templateId][elementId],
    getLayout: () => ({
        deleted: deletedElements.value[props.templateId],
        effects: layoutEffects.value[props.templateId],
        filters: layoutFilters.value[props.templateId],
        groups: layoutGroups.value[props.templateId],
        offsets: layoutOffsets.value[props.templateId],
        order: layoutOrder.value[props.templateId],
        sizes: layoutSizes.value[props.templateId],
    }),
    onLayoutChange: () => emit('layoutChange', currentLayoutChanged.value),
    selectedElements,
    selectedGroupId,
    setEffects: (effects) => { layoutEffects.value[props.templateId] = effects; },
    setFilters: (filters) => { layoutFilters.value[props.templateId] = filters; },
    setGroups: (groups) => { layoutGroups.value[props.templateId] = groups; },
    setOrder: (order) => { layoutOrder.value[props.templateId] = order; },
    updateSelection,
});

const emitSelectionGeometry = () => {
    if (!selectedElement.value) {
        emit('selectionGeometryChange', null);
        emit('selectionStyleChange', null);
        emit('selectionVisualStyleChange', null);
        emit('selectionTextContentChange', null);
        emit('selectionTextModeChange', null);
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
        filters: layoutFilters.value[props.templateId],
    });

const commitCurrentLayout = (previousState: SerializableLayoutState) => {
    documentStore.commitPageLayout(
        props.pageId,
        props.templateId,
        previousState,
        captureLayoutState(),
    );
    emit('layoutStateChange', props.templateId, captureLayoutState());
    emitSelectionGeometry();
};

const {
    beginCanvasGradientEdit,
    finishCanvasGradientEdit,
    setElementEffects,
    setElementFilters,
    setSelectedCustomTextMode,
    setSelectedElementColorBinding,
    setSelectedElementGradient,
    setSelectedElementStaticColor,
    setSelectedElementTextContent,
    setSelectedElementTextStyle,
    setSelectedElementVisualStyle,
    setSelectedQrOptions,
    updateCanvasGradient,
} = useCanvasElementStyles({
    captureLayoutState,
    commitCurrentLayout,
    elementIsLocked,
    getActiveCanvasGradient: () => activeCanvasGradient.value,
    getCustomElement: customElementById,
    getLayout: () => ({
        customElements: customElements.value[props.templateId],
        effects: layoutEffects.value[props.templateId],
        filters: layoutFilters.value[props.templateId],
        groups: layoutGroups.value[props.templateId],
        order: layoutOrder.value[props.templateId],
        sizes: layoutSizes.value[props.templateId],
        styles: layoutTextStyles.value[props.templateId],
        visualStyles: layoutVisualStyles.value[props.templateId],
    }),
    loadCustomQr: (element) => { void loadCustomQr(element); },
    onLayoutChange: () => emit('layoutChange', currentLayoutChanged.value),
    onSelectionDetailsChange: emitSelectionGeometry,
    reflowAutoLayoutGroups,
    rememberColor: colorsStore.rememberColor,
    selectedElement,
    selectedElements,
    setCustomElements: (elements) => { customElements.value[props.templateId] = elements; },
    setEffects: (effects) => { layoutEffects.value[props.templateId] = effects; },
    setFilters: (filters) => { layoutFilters.value[props.templateId] = filters; },
    setStyles: (styles) => { layoutTextStyles.value[props.templateId] = styles; },
    syncGraphicTextSize,
    syncTransformer,
});

const {
    alignElementWhileDragging,
    alignGroupWhileDragging,
    moveElement,
    moveGroup,
    nudgeSelectedElement,
    resizeElement,
    setSelectedElementGeometry,
    startElementDrag,
    startGroupDrag,
    transformGroup,
} = useCanvasTransforms({
    activeAlignmentGuides,
    captureLayoutState,
    commitCurrentLayout,
    documentSize,
    elementFrame,
    elementIsLocked,
    getBaseFrame: (elementId) => templateElementFrames.value[props.templateId][elementId],
    getCustomElement: customElementById,
    getLayout: () => ({
        groups: layoutGroups.value[props.templateId],
        offsets: layoutOffsets.value[props.templateId],
        order: layoutOrder.value[props.templateId],
        rotations: layoutRotations.value[props.templateId],
        sizes: layoutSizes.value[props.templateId],
        styles: layoutTextStyles.value[props.templateId],
    }),
    onLayoutChange: () => emit('layoutChange', currentLayoutChanged.value),
    onSelectionDetailsChange: emitSelectionGeometry,
    reflowAutoLayoutGroups,
    selectElement,
    selectGroup,
    selectedElement,
    selectedElements,
    selectedGroupId,
    selectedGroupVisualBounds,
    setLayoutGroups: (groups) => { layoutGroups.value[props.templateId] = groups; },
    snapEnabled: snapEnabledRef,
    stageRef,
    syncGraphicTextSize,
    syncSelectedAutoLayoutAnchor,
    syncTransformer,
});


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

const { handleDataFieldDrop } = useCanvasDataFieldDrop(() => previewScale.value, addElement);


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
    layoutFilters.value[props.templateId] = Object.fromEntries(
        Object.entries(layoutFilters.value[props.templateId]).filter(([elementId]) => !deleted.has(elementId as LayoutElementId)),
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

const restoreDraftLayouts = () => {
    documentStore.ensurePageLayout(props.pageId, props.templateId, () => createPageLayoutState(props.templateId));
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
    appointmentImageRenderSource,
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

watch(customImageRenderSources, reloadAllCustomImages, { deep: true });

watch(imageStatus, (status) => emit('imageStatus', status), { immediate: true });
watch(() => props.dataValues, () => {
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
    emit('renderContentChange');
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

const renderThumbnail = async (maxWidth = 176, maxHeight = 120) => {
    await document.fonts.ready;
    await nextTick();
    if (isExporting.value) return null;
    const stage = stageRef.value?.getNode();
    if (!stage || stage.width() <= 0 || stage.height() <= 0) return null;

    try {
        isExporting.value = true;
        await nextTick();
        await syncTransformer();
        stage.draw();
        const pixelRatio = Math.min(1, maxWidth / stage.width(), maxHeight / stage.height());
        return stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
    } finally {
        isExporting.value = false;
        await nextTick();
        await syncTransformer();
        stage.draw();
    }
};

const commands = {
    addElement,
    alignSelectedElement,
    distributeSelectedElements,
    changeSelectedLayer,
    clearSelection,
    drillIntoElement,
    deleteElements,
    deleteSelectedElements,
    groupSelectedElements,
    moveLayerNode,
    nudgeSelectedElement,
    setSelectedElementGeometry,
    setSelectedElementGradient,
    setElementEffects,
    setElementFilters,
    setSelectedElementColorBinding,
    setSelectedElementStaticColor,
    setSelectedElementTextStyle,
    setSelectedElementTextContent,
    setSelectedGroupAutoLayout,
    setSelectedGroupRepeat,
    setSelectedCustomTextMode,
    setSelectedQrOptions,
    setSelectedElementVisualStyle,
    toggleElementsLock,
    toggleElementsVisibility,
    selectElement,
    selectGroup,
    ungroupSelectedElements,
};

defineExpose({ commands, exportImage, renderThumbnail });
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
                    :data-values="dataValues"
                    :draggable-group-ids="draggableGroupIds"
                    :editor-scale="previewScale"
                    :effects="layoutEffects[templateId]"
                    :filters="layoutFilters[templateId]"
                    :group-frames="canvasGroupFrames"
                    :group-repeats="canvasGroupRepeats"
                    :locked-element-ids="lockedElements[templateId]"
                    :nodes="canvasSceneNodes"
                    :prototype-group-frames="canvasPrototypeGroupFrames"
                    :render-revision="sceneRenderRevision"
                    :selected-group-id="isExporting ? null : selectedGroupId"
                    :show-empty-repeat-prototype="!isExporting"
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
                    <template #element="{ dataValues: scopedDataValues, elementId, instanceKey, interactive, origin }">
                      <template v-for="item in canvasRenderItem(elementId)" :key="item.id">
                    <EditableVisualElement
                        v-if="item.role === 'background'"
                        element-id="background"
                        :frame="relativeElementFrame('background', origin)"
                        :locked="elementIsLocked('background') || !elementCanDragDirectly('background')"
                        :editor-scale="previewScale"
                        :instance-key="instanceKey"
                        :interactive="interactive"
                        :rotation="layoutRotations[templateId].background"
                        :selected="interactive && selectedElements.includes('background') && !isExporting"
                        :effects="elementEffects('background')"
                        :filters="elementFilters('background')"
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
                        :instance-key="instanceKey"
                        :interactive="interactive"
                        :image-config="imageIsVisible ? imageConfig : null"
                        :rotation="layoutRotations[templateId].image"
                        :selected="interactive && selectedElements.includes('image') && !isExporting"
                        :effects="elementEffects('image')"
                        :filters="elementFilters('image')"
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
                        :instance-key="instanceKey"
                        :interactive="interactive"
                        :rotation="layoutRotations[templateId].accent"
                        :selected="interactive && selectedElements.includes('accent') && !isExporting"
                        :effects="elementEffects('accent')"
                        :filters="elementFilters('accent')"
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
                        :instance-key="instanceKey"
                        :interactive="interactive"
                        :locked="elementIsLocked(item.id) || !elementCanDragDirectly(item.id)"
                        :rotation="layoutRotations[templateId][item.id]"
                        :selected="interactive && selectedElements.includes(item.id) && !isExporting"
                        :effects="elementEffects(item.id)"
                        :filters="elementFilters(item.id)"
                        :text-config="editableTextConfig(item.id)"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableTextElement
                        v-else-if="item.role === 'custom' && item.element.kind === 'text'"
                        :element-id="item.element.id"
                        :decoration-lines="customTextDecorationLines(item.element, scopedDataValues)"
                        :editor-scale="previewScale"
                        :frame="relativeElementFrame(item.element.id, origin)"
                        :graphic-text="customTextMode(item.element) === 'graphic'"
                        :instance-key="instanceKey"
                        :interactive="interactive"
                        :locked="elementIsLocked(item.element.id) || !elementCanDragDirectly(item.element.id)"
                        :rotation="layoutRotations[templateId][item.element.id]"
                        :selected="interactive && selectedElements.includes(item.element.id) && !isExporting"
                        :effects="elementEffects(item.element.id)"
                        :filters="elementFilters(item.element.id)"
                        :text-config="customTextConfig(item.element, scopedDataValues)"
                        @drag-start="startElementDrag"
                        @dragging="alignElementWhileDragging"
                        @move="moveElement"
                        @resize="resizeElement"
                    />
                    <EditableVisualElement
                        v-else-if="item.role === 'custom'"
                        :element-id="item.element.id"
                        :editor-scale="previewScale"
                        :instance-key="instanceKey"
                        :interactive="interactive"
                        :frame="relativeElementFrame(item.element.id, origin)"
                        :locked="elementIsLocked(item.element.id) || !elementCanDragDirectly(item.element.id)"
                        :image-config="item.element.kind === 'image'
                            ? customImageConfig(item.element)
                            : item.element.kind === 'qr' && customQrNodes[item.element.id]
                                ? { image: customQrNodes[item.element.id] }
                                : null"
                        :path-config="item.element.kind === 'icon' ? customIconPathConfig(item.element) : null"
                        :rotation="layoutRotations[templateId][item.element.id]"
                        :selected="interactive && selectedElements.includes(item.element.id) && !isExporting"
                        :effects="elementEffects(item.element.id)"
                        :filters="elementFilters(item.element.id)"
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
            <v-layer v-if="!isExporting && activeCanvasGradient">
                <CanvasGradientHandles
                    :editor-scale="previewScale"
                    :frame="activeCanvasGradient.frame"
                    :gradient="activeCanvasGradient.gradient"
                    :rotation="activeCanvasGradient.rotation"
                    :rotation-origin="activeCanvasGradient.rotationOrigin"
                    @edit-start="beginCanvasGradientEdit"
                    @update="updateCanvasGradient"
                    @edit-end="finishCanvasGradientEdit"
                />
            </v-layer>
        </v-stage>
    </div>
</template>
