import type { TemplateId } from './templates';
import {
    BUILT_IN_TEMPLATE_DEFINITIONS,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
} from './templateDefinition';
import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';
import type { PublisherIconName } from './publisherIcons';
import type { LayoutColorBinding } from './imagePalette';
import type { LayoutGradient } from './layoutGradient';

export const TEXT_LAYOUT_ELEMENT_IDS = ['title', 'dateTime', 'location'] as const;
export const SHAPE_LAYOUT_ELEMENT_IDS = ['background', 'accent'] as const;
export const LAYOUT_ELEMENT_IDS = ['background', 'image', 'accent', ...TEXT_LAYOUT_ELEMENT_IDS] as const;
export type BuiltInLayoutElementId = (typeof LAYOUT_ELEMENT_IDS)[number];
export type CustomTextElementId = `text-${string}`;
export type CustomImageElementId = `image-${string}`;
export type CustomShapeElementId = `shape-${'rectangle' | 'circle' | 'triangle' | 'line'}-${string}`;
export type CustomIconElementId = `icon-${string}`;
export type CustomQrElementId = `qr-${string}`;
export type LayoutElementId = BuiltInLayoutElementId | CustomTextElementId | CustomImageElementId | CustomShapeElementId | CustomIconElementId | CustomQrElementId;
export type LayoutTextElementId = (typeof TEXT_LAYOUT_ELEMENT_IDS)[number] | CustomTextElementId;
export type LayoutShapeElementId = (typeof SHAPE_LAYOUT_ELEMENT_IDS)[number] | CustomShapeElementId | CustomIconElementId | CustomQrElementId;
export type LayoutCustomElementKind = 'text' | 'image' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'icon' | 'qr';
export type LayoutTextMode = 'graphic' | 'frame';
export type LayoutQrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface LayoutCustomElement {
    id: LayoutElementId;
    kind: LayoutCustomElementKind;
    name: string;
    frame: LayoutFrame;
    text?: string;
    textMode?: LayoutTextMode;
    imageSource?: string;
    dataBinding?: string;
    iconName?: PublisherIconName;
    qrValue?: string;
    qrBackground?: string;
    qrMargin?: number;
    qrErrorCorrection?: LayoutQrErrorCorrection;
}

export const isBuiltInLayoutElement = (elementId: LayoutElementId): elementId is BuiltInLayoutElementId =>
    LAYOUT_ELEMENT_IDS.includes(elementId as BuiltInLayoutElementId);
export const isTextLayoutElement = (elementId: LayoutElementId): elementId is LayoutTextElementId =>
    TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as (typeof TEXT_LAYOUT_ELEMENT_IDS)[number]) || elementId.startsWith('text-');
export const isShapeLayoutElement = (elementId: LayoutElementId): elementId is LayoutShapeElementId =>
    SHAPE_LAYOUT_ELEMENT_IDS.includes(elementId as (typeof SHAPE_LAYOUT_ELEMENT_IDS)[number]) ||
    elementId.startsWith('shape-') || elementId.startsWith('icon-') || elementId.startsWith('qr-');
export const isImageLayoutElement = (elementId: LayoutElementId) =>
    elementId === 'image' || elementId.startsWith('image-');
export const isFixedAspectRatioLayoutElement = (elementId: LayoutElementId) =>
    elementId.startsWith('icon-') || elementId.startsWith('qr-');

export interface LayoutFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutGeometry extends LayoutFrame {
    rotation: number;
}

export interface LayoutSelectionGeometry extends LayoutGeometry {
    elementId: LayoutElementId | null;
    groupId?: string;
}

export interface LayoutPoint {
    x: number;
    y: number;
}

export interface LayoutSize {
    width: number;
    height: number;
}

export interface LayoutDocumentSize {
    width: number;
    height: number;
}

const DEFAULT_LAYOUT_DOCUMENT_SIZE: LayoutDocumentSize = { width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT };

export interface LayoutTextStyle {
    fontSize: number;
    color: string;
    colorGradient?: LayoutGradient;
    colorBinding?: LayoutColorBinding;
    stroke: string;
    strokeWidth: number;
    strokeBinding?: LayoutColorBinding;
    fontFamily: string;
    fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
    lineHeight: number;
    letterSpacing: number;
    align: 'left' | 'center' | 'right';
    listStyle: 'none' | 'bullet' | 'numbered';
    textTransform: 'none' | 'uppercase' | 'smallCaps';
    underlineStyle: 'none' | 'single' | 'double';
    strikethroughStyle: 'none' | 'single' | 'double';
}

export interface LayoutVisualStyle {
    fill: string;
    fillGradient?: LayoutGradient;
    stroke: string;
    strokeWidth: number;
    fillBinding?: LayoutColorBinding;
    strokeBinding?: LayoutColorBinding;
}

export type LayoutBlendMode =
    | 'source-over'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten';

export interface LayoutShadowEffect {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
    opacity: number;
    forStroke: boolean;
}

export interface LayoutBlurEffect {
    enabled: boolean;
    radius: number;
}

export interface LayoutElementEffects {
    shadow: LayoutShadowEffect;
    blur: LayoutBlurEffect;
    opacity: number;
    blendMode: LayoutBlendMode;
}

export type LayoutEffects = Record<string, LayoutElementEffects>;
export type LayoutElementEffectsInput = Partial<Omit<LayoutElementEffects, 'shadow' | 'blur'>> & {
    shadow?: Partial<LayoutShadowEffect>;
    blur?: Partial<LayoutBlurEffect>;
};

export const createLayoutElementEffects = (): LayoutElementEffects => ({
    shadow: {
        enabled: false,
        color: '#000000',
        blur: 16,
        offsetX: 8,
        offsetY: 8,
        opacity: 0.5,
        forStroke: true,
    },
    blur: { enabled: false, radius: 4 },
    opacity: 1,
    blendMode: 'source-over',
});

const clampEffectNumber = (value: number | undefined, fallback: number, minimum: number, maximum: number) =>
    Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value!)) : fallback;
const LAYOUT_BLEND_MODES: LayoutBlendMode[] = [
    'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
];

export const normalizeLayoutElementEffects = (
    effects?: LayoutElementEffectsInput | null,
): LayoutElementEffects => {
    const defaults = createLayoutElementEffects();
    return {
        shadow: {
            ...defaults.shadow,
            enabled: effects?.shadow?.enabled ?? defaults.shadow.enabled,
            color: effects?.shadow?.color && /^#[0-9a-f]{6}$/i.test(effects.shadow.color)
                ? effects.shadow.color : defaults.shadow.color,
            blur: clampEffectNumber(effects?.shadow?.blur, defaults.shadow.blur, 0, 200),
            offsetX: clampEffectNumber(effects?.shadow?.offsetX, defaults.shadow.offsetX, -500, 500),
            offsetY: clampEffectNumber(effects?.shadow?.offsetY, defaults.shadow.offsetY, -500, 500),
            opacity: clampEffectNumber(effects?.shadow?.opacity, defaults.shadow.opacity, 0, 1),
            forStroke: effects?.shadow?.forStroke ?? defaults.shadow.forStroke,
        },
        blur: {
            enabled: effects?.blur?.enabled ?? defaults.blur.enabled,
            radius: clampEffectNumber(effects?.blur?.radius, defaults.blur.radius, 0, 100),
        },
        opacity: clampEffectNumber(effects?.opacity, defaults.opacity, 0, 1),
        blendMode: effects?.blendMode && LAYOUT_BLEND_MODES.includes(effects.blendMode)
            ? effects.blendMode : defaults.blendMode,
    };
};

export const layoutElementHasEffects = (effects?: LayoutElementEffectsInput | null) => {
    const normalized = normalizeLayoutElementEffects(effects);
    return normalized.shadow.enabled || normalized.blur.enabled ||
        normalized.opacity < 1 || normalized.blendMode !== 'source-over';
};

export const createCustomTextStyle = (color = '#ffffff'): LayoutTextStyle => ({
    fontSize: 64,
    color,
    stroke: '#000000',
    strokeWidth: 0,
    fontFamily: 'Lato, Arial, sans-serif',
    fontStyle: 'normal',
    lineHeight: 1.2,
    letterSpacing: 0,
    align: 'left',
    listStyle: 'none',
    textTransform: 'none',
    underlineStyle: 'none',
    strikethroughStyle: 'none',
});

export const createCustomVisualStyle = (fill = '#69a7e8'): LayoutVisualStyle => ({
    fill,
    stroke: '#2768ad',
    strokeWidth: 0,
});

export const createLayoutCustomElement = (
    kind: LayoutCustomElementKind,
    documentSize: LayoutDocumentSize,
    options: {
        imageSource?: string;
        name?: string;
        text?: string;
        textMode?: LayoutTextMode;
        iconName?: PublisherIconName;
        qrValue?: string;
        dataBinding?: string;
        position?: LayoutPoint;
    } = {},
): LayoutCustomElement => {
    const sequence = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const prefix = kind === 'text' ? 'text' : kind === 'image' ? 'image' : kind === 'icon' ? 'icon' : kind === 'qr' ? 'qr' : `shape-${kind}`;
    const preferredSize = kind === 'text'
        ? { width: 520, height: 140 }
        : kind === 'image' ? { width: 480, height: 320 }
            : kind === 'icon' ? { width: 180, height: 180 }
                : kind === 'line' ? { width: 300, height: 4 }
                    : { width: 260, height: 260 };
    const width = Math.min(preferredSize.width, documentSize.width * 0.7);
    const height = Math.min(preferredSize.height, documentSize.height * 0.7);
    const defaultNames: Record<LayoutCustomElementKind, string> = {
        text: 'Neuer Text',
        image: 'Neues Bild',
        rectangle: 'Quadrat',
        circle: 'Kreis',
        triangle: 'Dreieck',
        line: 'Strich',
        icon: 'Icon',
        qr: 'QR-Code',
    };
    return {
        id: `${prefix}-${sequence}` as LayoutElementId,
        kind,
        name: options.name?.trim() || defaultNames[kind],
        frame: {
            x: Math.round(Math.min(documentSize.width - width, Math.max(0, options.position?.x ?? (documentSize.width - width) / 2))),
            y: Math.round(Math.min(documentSize.height - height, Math.max(0, options.position?.y ?? (documentSize.height - height) / 2))),
            width: Math.round(width),
            height: Math.round(height),
        },
        ...(kind === 'text' ? { text: options.text ?? 'Neuer Text', textMode: options.textMode ?? 'graphic' } : {}),
        ...(kind === 'image' && options.imageSource ? { imageSource: options.imageSource } : {}),
        ...(options.dataBinding ? { dataBinding: options.dataBinding } : {}),
        ...(kind === 'icon' && options.iconName ? { iconName: options.iconName } : {}),
        ...(kind === 'qr' ? {
            qrValue: options.qrValue ?? 'https://church.tools',
            qrBackground: '#ffffff',
            qrMargin: 2,
            qrErrorCorrection: 'M' as const,
        } : {}),
    };
};

export const layoutElementLabel = (elementId: LayoutElementId) => {
    const builtInLabels: Record<BuiltInLayoutElementId, string> = {
        background: 'Hintergrund', image: 'Bild', accent: 'Akzentform', title: 'Titel',
        dateTime: 'Datum/Uhrzeit', location: 'Ort',
    };
    if (isBuiltInLayoutElement(elementId)) return builtInLabels[elementId];
    if (elementId.startsWith('text-')) return 'Text';
    if (elementId.startsWith('image-')) return 'Bild';
    if (elementId.startsWith('icon-')) return 'Icon';
    if (elementId.startsWith('qr-')) return 'QR-Code';
    if (elementId.startsWith('shape-rectangle-')) return 'Quadrat';
    if (elementId.startsWith('shape-circle-')) return 'Kreis';
    if (elementId.startsWith('shape-line-')) return 'Strich';
    return 'Dreieck';
};

export interface AlignmentGuide {
    orientation: 'horizontal' | 'vertical';
    position: number;
}

export interface AlignmentSnap {
    offset: LayoutPoint;
    guides: AlignmentGuide[];
}

export type LayoutAlignment =
    | 'left'
    | 'horizontalCenter'
    | 'right'
    | 'top'
    | 'verticalCenter'
    | 'bottom';

export type LayoutOffsets = Record<string, LayoutPoint>;
export type LayoutSizes = Record<string, LayoutSize>;
export type LayoutRotations = Record<string, number>;
export type LayoutOrder = LayoutElementId[];
export type LayoutDistributionAxis = 'horizontal' | 'vertical';
export type LayoutHorizontalOrigin = 'left' | 'center' | 'right';
export type LayoutVerticalOrigin = 'top' | 'center' | 'bottom';
export interface LayoutGroupAutoLayout {
    axis: LayoutDistributionAxis;
    gap: number;
    horizontalOrigin: LayoutHorizontalOrigin;
    verticalOrigin: LayoutVerticalOrigin;
    anchor: LayoutPoint;
}
export interface LayoutGroupRepeat {
    sourceFieldId: string;
    itemAlias: string;
    axis: LayoutDistributionAxis;
    gap: number;
}
export interface LayoutGroup {
    id: string;
    children: (LayoutElementId | LayoutGroup)[];
    autoLayout?: LayoutGroupAutoLayout;
    repeat?: LayoutGroupRepeat;
    rotation?: number;
}
export type LayoutGroups = LayoutGroup[];
export type LayoutLayerTreeNode =
    | { kind: 'element'; id: LayoutElementId; elementId: LayoutElementId }
    | { kind: 'group'; id: string; elementIds: LayoutElementId[]; children: LayoutLayerTreeNode[] };
export type LayoutTextStyles = Record<string, LayoutTextStyle>;
export type LayoutVisualStyles = Record<string, LayoutVisualStyle>;

export interface LayoutElementState {
    offsets: LayoutOffsets;
    sizes: LayoutSizes;
    rotations: LayoutRotations;
    order: LayoutOrder;
    styles: LayoutTextStyles;
    visualStyles: LayoutVisualStyles;
}

export const MIN_ELEMENT_WIDTH = 1;
export const MIN_ELEMENT_HEIGHT = 1;
export const SNAP_GRID_SIZE = 20;
export const SNAP_ROTATION_STEP = 15;
export const ALIGNMENT_SNAP_THRESHOLD = 10;
export { MAX_FONT_SIZE, MIN_FONT_SIZE };

const decorationFrame = (templateId: TemplateId, decorationId: LayoutShapeElementId): LayoutFrame => ({
    ...BUILT_IN_TEMPLATE_DEFINITIONS[templateId].composition.decorations.find(({ id }) => id === decorationId)!.frame,
});

export const TEMPLATE_ELEMENT_FRAMES: Record<TemplateId, Record<LayoutElementId, LayoutFrame>> = {
    split: {
        background: decorationFrame('split', 'background'),
        image: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.composition.imageFrame },
        accent: decorationFrame('split', 'accent'),
        title: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.elements.title.frame },
        dateTime: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.elements.dateTime.frame },
        location: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.elements.location.frame },
    },
    poster: {
        background: decorationFrame('poster', 'background'),
        image: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.composition.imageFrame },
        accent: decorationFrame('poster', 'accent'),
        title: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.elements.title.frame },
        dateTime: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.elements.dateTime.frame },
        location: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.elements.location.frame },
    },
};

export const createLayoutOffsets = (): LayoutOffsets => ({
    background: { x: 0, y: 0 },
    image: { x: 0, y: 0 },
    accent: { x: 0, y: 0 },
    title: { x: 0, y: 0 },
    dateTime: { x: 0, y: 0 },
    location: { x: 0, y: 0 },
});

export const createLayoutSizes = (templateId: TemplateId): LayoutSizes => ({
    background: {
        width: TEMPLATE_ELEMENT_FRAMES[templateId].background.width,
        height: TEMPLATE_ELEMENT_FRAMES[templateId].background.height,
    },
    image: {
        width: TEMPLATE_ELEMENT_FRAMES[templateId].image.width,
        height: TEMPLATE_ELEMENT_FRAMES[templateId].image.height,
    },
    accent: {
        width: TEMPLATE_ELEMENT_FRAMES[templateId].accent.width,
        height: TEMPLATE_ELEMENT_FRAMES[templateId].accent.height,
    },
    title: {
        width: TEMPLATE_ELEMENT_FRAMES[templateId].title.width,
        height: TEMPLATE_ELEMENT_FRAMES[templateId].title.height,
    },
    dateTime: {
        width: TEMPLATE_ELEMENT_FRAMES[templateId].dateTime.width,
        height: TEMPLATE_ELEMENT_FRAMES[templateId].dateTime.height,
    },
    location: {
        width: TEMPLATE_ELEMENT_FRAMES[templateId].location.width,
        height: TEMPLATE_ELEMENT_FRAMES[templateId].location.height,
    },
});

export const createLayoutRotations = (): LayoutRotations => ({
    background: 0,
    image: 0,
    accent: 0,
    title: 0,
    dateTime: 0,
    location: 0,
});

export const createLayoutOrder = (): LayoutOrder => [...LAYOUT_ELEMENT_IDS];

export type CanvasStackItem = LayoutElementId | 'decoration-behind' | 'decoration-over';
export const createCanvasStackOrder = (
    order: LayoutOrder,
    deleted: LayoutElementId[] = [],
    showLocation = true,
): CanvasStackItem[] => order.flatMap((elementId): CanvasStackItem[] => {
    const visible = !deleted.includes(elementId) && (elementId !== 'location' || showLocation);
    if (elementId !== 'image') return visible ? [elementId] : [];
    return ['decoration-behind', ...(visible ? [elementId] : []), 'decoration-over'];
});

export const createLayoutGroups = (): LayoutGroups => [];

export const layoutGroupElementIds = (group: LayoutGroup): LayoutElementId[] =>
    group.children.flatMap((child) => typeof child === 'string' ? [child] : layoutGroupElementIds(child));

export const flattenLayoutGroups = (groups: LayoutGroups): LayoutGroup[] =>
    groups.flatMap((group) => [
        group,
        ...flattenLayoutGroups(group.children.filter((child): child is LayoutGroup => typeof child !== 'string')),
    ]);

export const layoutGroupBounds = (
    group: LayoutGroup,
    frames: Partial<Record<LayoutElementId, LayoutFrame>>,
): LayoutFrame | null => {
    const childFrames = layoutGroupElementIds(group)
        .map((elementId) => frames[elementId])
        .filter((frame): frame is LayoutFrame => Boolean(frame));
    if (childFrames.length === 0) return null;
    const x = Math.min(...childFrames.map((frame) => frame.x));
    const y = Math.min(...childFrames.map((frame) => frame.y));
    const right = Math.max(...childFrames.map((frame) => frame.x + frame.width));
    const bottom = Math.max(...childFrames.map((frame) => frame.y + frame.height));
    return { x, y, width: right - x, height: bottom - y };
};

export const layoutGroupAnchor = (
    bounds: LayoutFrame,
    horizontalOrigin: LayoutHorizontalOrigin,
    verticalOrigin: LayoutVerticalOrigin,
): LayoutPoint => ({
    x: bounds.x + bounds.width * ({ left: 0, center: 0.5, right: 1 }[horizontalOrigin]),
    y: bounds.y + bounds.height * ({ top: 0, center: 0.5, bottom: 1 }[verticalOrigin]),
});

const directLayoutGroupChildBounds = (
    child: LayoutElementId | LayoutGroup,
    frames: Partial<Record<LayoutElementId, LayoutFrame>>,
) => typeof child === 'string' ? frames[child] ?? null : layoutGroupBounds(child, frames);

export const sortLayoutGroupChildren = (
    group: LayoutGroup,
    frames: Partial<Record<LayoutElementId, LayoutFrame>>,
    axis: LayoutDistributionAxis,
): LayoutGroup => ({
    ...group,
    children: [...group.children].sort((left, right) => {
        const leftBounds = directLayoutGroupChildBounds(left, frames);
        const rightBounds = directLayoutGroupChildBounds(right, frames);
        if (!leftBounds || !rightBounds) return 0;
        return axis === 'vertical' ? leftBounds.y - rightBounds.y : leftBounds.x - rightBounds.x;
    }),
});

export const applyLayoutGroupAutoLayout = (
    group: LayoutGroup,
    frames: Partial<Record<LayoutElementId, LayoutFrame>>,
): Partial<Record<LayoutElementId, LayoutFrame>> => {
    const settings = group.autoLayout;
    if (!settings) return frames;
    const children = group.children.map((child) => ({ child, bounds: directLayoutGroupChildBounds(child, frames) }))
        .filter((entry): entry is { child: LayoutElementId | LayoutGroup; bounds: LayoutFrame } => Boolean(entry.bounds));
    if (children.length === 0) return frames;
    const width = settings.axis === 'horizontal'
        ? children.reduce((total, { bounds }) => total + bounds.width, 0) + settings.gap * (children.length - 1)
        : Math.max(...children.map(({ bounds }) => bounds.width));
    const height = settings.axis === 'vertical'
        ? children.reduce((total, { bounds }) => total + bounds.height, 0) + settings.gap * (children.length - 1)
        : Math.max(...children.map(({ bounds }) => bounds.height));
    const start = {
        x: settings.anchor.x - width * ({ left: 0, center: 0.5, right: 1 }[settings.horizontalOrigin]),
        y: settings.anchor.y - height * ({ top: 0, center: 0.5, bottom: 1 }[settings.verticalOrigin]),
    };
    const nextFrames = { ...frames };
    let cursor = settings.axis === 'vertical' ? start.y : start.x;
    for (const { child, bounds } of children) {
        const target = settings.axis === 'vertical'
            ? {
                x: start.x + ({ left: 0, center: (width - bounds.width) / 2, right: width - bounds.width }[settings.horizontalOrigin]),
                y: cursor,
            }
            : {
                x: cursor,
                y: start.y + ({ top: 0, center: (height - bounds.height) / 2, bottom: height - bounds.height }[settings.verticalOrigin]),
            };
        const delta = { x: target.x - bounds.x, y: target.y - bounds.y };
        const elementIds = typeof child === 'string' ? [child] : layoutGroupElementIds(child);
        for (const elementId of elementIds) {
            const frame = nextFrames[elementId];
            if (frame) nextFrames[elementId] = { ...frame, x: frame.x + delta.x, y: frame.y + delta.y };
        }
        cursor += (settings.axis === 'vertical' ? bounds.height : bounds.width) + settings.gap;
    }
    return nextFrames;
};

export const distributeLayoutFrames = (
    frames: Partial<Record<LayoutElementId, LayoutFrame>>,
    axis: LayoutDistributionAxis,
): Partial<Record<LayoutElementId, LayoutFrame>> => {
    const entries = Object.entries(frames)
        .filter((entry): entry is [LayoutElementId, LayoutFrame] => Boolean(entry[1]))
        .sort((left, right) => axis === 'horizontal' ? left[1].x - right[1].x : left[1].y - right[1].y);
    if (entries.length < 3) return frames;
    const first = entries[0]![1];
    const last = entries.at(-1)![1];
    const start = axis === 'horizontal' ? first.x : first.y;
    const end = axis === 'horizontal' ? last.x + last.width : last.y + last.height;
    const totalSize = entries.reduce((sum, [, frame]) => sum + (axis === 'horizontal' ? frame.width : frame.height), 0);
    const gap = (end - start - totalSize) / (entries.length - 1);
    const next = { ...frames };
    let cursor = start;
    for (const [elementId, frame] of entries) {
        next[elementId] = axis === 'horizontal' ? { ...frame, x: cursor } : { ...frame, y: cursor };
        cursor += (axis === 'horizontal' ? frame.width : frame.height) + gap;
    }
    return next;
};

export const createLayoutLayerTree = (
    order: LayoutOrder,
    groups: LayoutGroups,
    deleted: LayoutElementId[] = [],
): LayoutLayerTreeNode[] => {
    const deletedIds = new Set(deleted);
    const orderIndex = new Map(order.map((elementId, index) => [elementId, index]));
    const nodeIndex = (node: LayoutLayerTreeNode) => node.kind === 'element'
        ? (orderIndex.get(node.elementId) ?? -1)
        : Math.max(-1, ...node.elementIds.map((elementId) => orderIndex.get(elementId) ?? -1));
    const sortTopFirst = (nodes: LayoutLayerTreeNode[]) =>
        nodes.sort((left, right) => nodeIndex(right) - nodeIndex(left));
    const groupNode = (group: LayoutGroup): LayoutLayerTreeNode | null => {
        const children = sortTopFirst(group.children.flatMap((child): LayoutLayerTreeNode[] => {
            if (typeof child === 'string') {
                return deletedIds.has(child) || !orderIndex.has(child)
                    ? []
                    : [{ kind: 'element', id: child, elementId: child }];
            }
            const nested = groupNode(child);
            return nested ? [nested] : [];
        }));
        const elementIds = children.flatMap((child) =>
            child.kind === 'element' ? [child.elementId] : child.elementIds);
        return elementIds.length > 0
            ? { kind: 'group', id: group.id, elementIds, children }
            : null;
    };
    const groupedIds = new Set(groups.flatMap(layoutGroupElementIds));
    const roots: LayoutLayerTreeNode[] = groups.flatMap((group) => {
        const node = groupNode(group);
        return node ? [node] : [];
    });
    roots.push(...order.flatMap((elementId): LayoutLayerTreeNode[] =>
        deletedIds.has(elementId) || groupedIds.has(elementId)
            ? []
            : [{ kind: 'element', id: elementId, elementId }]));
    return sortTopFirst(roots);
};

export const findLayoutGroupDepth = (groups: LayoutGroups, groupId: string, depth = 1): number => {
    for (const group of groups) {
        if (group.id === groupId) {
            return depth;
        }
        const nestedDepth = findLayoutGroupDepth(
            group.children.filter((child): child is LayoutGroup => typeof child !== 'string'),
            groupId,
            depth + 1,
        );
        if (nestedDepth > 0) {
            return nestedDepth;
        }
    }
    return 0;
};

export const findLayoutGroupPath = (
    groups: LayoutGroups,
    elementId: LayoutElementId,
): LayoutGroup[] => {
    for (const group of groups) {
        if (!layoutGroupElementIds(group).includes(elementId)) {
            continue;
        }
        const childGroups = group.children.filter((child): child is LayoutGroup => typeof child !== 'string');
        return [group, ...findLayoutGroupPath(childGroups, elementId)];
    }
    return [];
};

export const resolveLayoutSelectionTarget = (
    groups: LayoutGroups,
    elementId: LayoutElementId,
    currentGroupId: string | null,
    drillDown: boolean,
): { elementIds: LayoutElementId[]; groupId: string | null } => {
    const path = findLayoutGroupPath(groups, elementId);
    if (path.length === 0) {
        return { elementIds: [elementId], groupId: null };
    }
    if (!drillDown) {
        const currentIndex = currentGroupId ? path.findIndex((group) => group.id === currentGroupId) : -1;
        const group = currentIndex >= 0 ? path[currentIndex]! : path[0]!;
        return { elementIds: layoutGroupElementIds(group), groupId: group.id };
    }
    const currentIndex = currentGroupId ? path.findIndex((group) => group.id === currentGroupId) : -1;
    const nextGroup = path[currentIndex + 1];
    return nextGroup
        ? { elementIds: layoutGroupElementIds(nextGroup), groupId: nextGroup.id }
        : { elementIds: [elementId], groupId: null };
};

export const expandLayoutSelection = (
    groups: LayoutGroups,
    elementIds: LayoutElementId[],
    order: LayoutOrder = createLayoutOrder(),
) => {
    const expanded = new Set(elementIds);
    for (const group of groups) {
        const descendants = layoutGroupElementIds(group);
        if (descendants.some((elementId) => expanded.has(elementId))) {
            descendants.forEach((elementId) => expanded.add(elementId));
        }
    }
    return order.filter((elementId) => expanded.has(elementId));
};

export const groupLayoutElements = (
    groups: LayoutGroups,
    elementIds: LayoutElementId[],
    groupId: string,
    order: LayoutOrder = createLayoutOrder(),
): LayoutGroups => {
    const selectedIds = new Set(expandLayoutSelection(groups, elementIds, order));
    const selectedChildren: (LayoutElementId | LayoutGroup)[] = [];
    const remainingGroups: LayoutGroups = [];
    for (const group of groups) {
        const descendants = layoutGroupElementIds(group);
        if (descendants.every((elementId) => selectedIds.has(elementId))) {
            selectedChildren.push(group);
            descendants.forEach((elementId) => selectedIds.delete(elementId));
        } else {
            remainingGroups.push(group);
        }
    }
    selectedChildren.push(...order.filter((elementId) => selectedIds.has(elementId)));
    if (selectedChildren.length < 2) {
        return groups;
    }
    return [...remainingGroups, { id: groupId, children: selectedChildren }];
};

export const ungroupLayoutElements = (
    groups: LayoutGroups,
    elementIds: LayoutElementId[],
) => {
    const ungroupChildren = (children: (LayoutElementId | LayoutGroup)[]): (LayoutElementId | LayoutGroup)[] =>
        children.flatMap((child) => {
            if (typeof child === 'string') {
                return [child];
            }
            if (layoutGroupElementIds(child).every((elementId) => elementIds.includes(elementId))) {
                return child.children;
            }
            return [{ ...child, children: ungroupChildren(child.children) }];
        });
    return ungroupChildren(groups).filter((child): child is LayoutGroup => typeof child !== 'string');
};

export type LayoutLayerDragNode = { kind: 'element' | 'group'; id: string };
export type LayoutLayerDropPlacement = 'before' | 'after' | 'inside';

export const moveLayoutOrderBlock = (
    order: LayoutOrder,
    movingElementIds: LayoutElementId[],
    targetElementIds: LayoutElementId[],
    placement: LayoutLayerDropPlacement,
): LayoutOrder => {
    const moving = new Set(movingElementIds);
    const remaining = order.filter((elementId) => !moving.has(elementId));
    const targetIndexes = targetElementIds.map((elementId) => remaining.indexOf(elementId)).filter((index) => index >= 0);
    if (targetIndexes.length === 0) return order;
    const orderedMovingIds = order.filter((elementId) => moving.has(elementId));
    const insertionIndex = placement === 'after'
        ? Math.min(...targetIndexes)
        : Math.max(...targetIndexes) + 1;
    return [...remaining.slice(0, insertionIndex), ...orderedMovingIds, ...remaining.slice(insertionIndex)];
};

export const nestLayoutNodeInGroup = (
    groups: LayoutGroups,
    source: LayoutLayerDragNode,
    targetGroupId: string,
): LayoutGroups => {
    const target = flattenLayoutGroups(groups).find(({ id }) => id === targetGroupId);
    if (!target || source.id === targetGroupId) return groups;
    const sourceNode: LayoutElementId | LayoutGroup | null = source.kind === 'element'
        ? source.id as LayoutElementId
        : flattenLayoutGroups(groups).find(({ id }) => id === source.id) ?? null;
    if (!sourceNode) return groups;
    if (source.kind === 'element' && layoutGroupElementIds(target).includes(sourceNode as LayoutElementId)) return groups;
    if (source.kind === 'group' && flattenLayoutGroups([sourceNode as LayoutGroup]).some(({ id }) => id === targetGroupId)) return groups;

    const removeSource = (children: (LayoutElementId | LayoutGroup)[]): (LayoutElementId | LayoutGroup)[] =>
        children.flatMap((child): (LayoutElementId | LayoutGroup)[] => {
            if (typeof child === 'string') return source.kind === 'element' && child === source.id ? [] : [child];
            if (source.kind === 'group' && child.id === source.id) return [];
            const nextChildren = removeSource(child.children);
            return nextChildren.length >= 2 ? [{ ...child, children: nextChildren }] : nextChildren;
        });
    const withoutSource = removeSource(groups).filter((child): child is LayoutGroup => typeof child !== 'string');
    const appendToTarget = (group: LayoutGroup): LayoutGroup => group.id === targetGroupId
        ? { ...group, children: [...group.children, sourceNode] }
        : { ...group, children: group.children.map((child) => typeof child === 'string' ? child : appendToTarget(child)) };
    const nested = withoutSource.map(appendToTarget);
    return flattenLayoutGroups(nested).some(({ id }) => id === targetGroupId) ? nested : groups;
};

export const createLayoutTextStyles = (templateId: TemplateId): LayoutTextStyles => {
    const elements = BUILT_IN_TEMPLATE_DEFINITIONS[templateId].elements;
    const styleFor = (elementId: (typeof TEXT_LAYOUT_ELEMENT_IDS)[number]): LayoutTextStyle => ({
        fontSize: elements[elementId].style.fontSize,
        color: elements[elementId].style.color,
        stroke: '#000000',
        strokeWidth: 0,
        fontFamily: elements[elementId].style.fontFamily,
        fontStyle: elements[elementId].style.fontStyle,
        lineHeight: elements[elementId].style.lineHeight,
        letterSpacing: 0,
        align: elements[elementId].style.align,
        listStyle: 'none',
        textTransform: 'none',
        underlineStyle: 'none',
        strikethroughStyle: 'none',
    });
    return {
        title: styleFor('title'),
        dateTime: styleFor('dateTime'),
        location: styleFor('location'),
    };
};

export const createLayoutVisualStyles = (templateId: TemplateId): LayoutVisualStyles => {
    const decorations = BUILT_IN_TEMPLATE_DEFINITIONS[templateId].composition.decorations;
    const styleFor = (elementId: (typeof SHAPE_LAYOUT_ELEMENT_IDS)[number]): LayoutVisualStyle => ({
        fill: (decorations.find(({ id }) => id === elementId) as { fill: string }).fill,
        stroke: '#000000',
        strokeWidth: 0,
    });
    return { background: styleFor('background'), accent: styleFor('accent') };
};

export const constrainFontSize = (fontSize: number) =>
    Math.min(Math.max(Math.round(fontSize), MIN_FONT_SIZE), MAX_FONT_SIZE);

export const constrainLineHeight = (lineHeight: number) =>
    Math.min(Math.max(Math.round(lineHeight * 10) / 10, 0.5), 3);

export const constrainLetterSpacing = (letterSpacing: number) =>
    Math.min(Math.max(Math.round(letterSpacing), -20), 100);

export const isHexColor = (color: string) => /^#[0-9a-f]{6}$/i.test(color);

export const moveLayoutElementInOrder = (
    order: LayoutOrder,
    elementId: LayoutElementId,
    direction: -1 | 1,
): LayoutOrder => {
    const currentIndex = order.indexOf(elementId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) {
        return order;
    }

    const nextOrder = [...order];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    return nextOrder;
};

const frameAnchors = (frame: LayoutFrame, axis: 'x' | 'y') => {
    const start = frame[axis];
    const size = axis === 'x' ? frame.width : frame.height;
    return [start, start + size / 2, start + size];
};

const closestAlignment = (anchors: number[], targets: number[], threshold: number) => {
    let closest: { offset: number; position: number } | undefined;

    for (const anchor of anchors) {
        for (const target of targets) {
            const offset = target - anchor;
            if (Math.abs(offset) <= threshold && (!closest || Math.abs(offset) < Math.abs(closest.offset))) {
                closest = { offset, position: target };
            }
        }
    }

    return closest;
};

export const calculateAlignmentSnap = (
    frame: LayoutFrame,
    targetFrames: LayoutFrame[],
    threshold = ALIGNMENT_SNAP_THRESHOLD,
    documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE,
): AlignmentSnap => {
    const verticalTargets = [0, documentSize.width / 2, documentSize.width];
    const horizontalTargets = [0, documentSize.height / 2, documentSize.height];
    for (const targetFrame of targetFrames) {
        verticalTargets.push(...frameAnchors(targetFrame, 'x'));
        horizontalTargets.push(...frameAnchors(targetFrame, 'y'));
    }

    const vertical = closestAlignment(frameAnchors(frame, 'x'), verticalTargets, threshold);
    const horizontal = closestAlignment(frameAnchors(frame, 'y'), horizontalTargets, threshold);
    const guides: AlignmentGuide[] = [];
    if (vertical) {
        guides.push({ orientation: 'vertical', position: vertical.position });
    }
    if (horizontal) {
        guides.push({ orientation: 'horizontal', position: horizontal.position });
    }

    return {
        offset: { x: vertical?.offset ?? 0, y: horizontal?.offset ?? 0 },
        guides,
    };
};

export const clampLayoutPosition = (position: LayoutPoint, frame: LayoutFrame, documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE): LayoutPoint => ({
    x: Math.min(Math.max(position.x, 0), documentSize.width - frame.width),
    y: Math.min(Math.max(position.y, 0), documentSize.height - frame.height),
});

export const constrainLayoutDelta = (frames: LayoutFrame[], delta: LayoutPoint, documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE): LayoutPoint => {
    if (frames.length === 0) {
        return { x: 0, y: 0 };
    }
    return {
        x: Math.min(
            Math.max(delta.x, ...frames.map((frame) => -frame.x)),
            ...frames.map((frame) => documentSize.width - frame.x - frame.width),
        ),
        y: Math.min(
            Math.max(delta.y, ...frames.map((frame) => -frame.y)),
            ...frames.map((frame) => documentSize.height - frame.y - frame.height),
        ),
    };
};

export const layoutFramesIntersect = (left: LayoutFrame, right: LayoutFrame) =>
    left.x <= right.x + right.width && left.x + left.width >= right.x &&
    left.y <= right.y + right.height && left.y + left.height >= right.y;

export const resizeLayoutFrame = (frame: LayoutFrame, size: LayoutSize, documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE): LayoutFrame => ({
    ...frame,
    width: Math.min(Math.max(size.width, Math.min(MIN_ELEMENT_WIDTH, documentSize.width)), documentSize.width - frame.x),
    height: Math.min(Math.max(size.height, Math.min(MIN_ELEMENT_HEIGHT, documentSize.height)), documentSize.height - frame.y),
});

export const resizeLayoutFrameProportionally = (
    frame: LayoutFrame,
    size: LayoutSize,
    documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE,
): LayoutFrame => {
    if (frame.width <= 0 || frame.height <= 0 || ![size.width, size.height].every(Number.isFinite)) return frame;
    const requestedScale = Math.max(size.width / frame.width, size.height / frame.height);
    const minimumScale = Math.max(
        Math.min(MIN_ELEMENT_WIDTH, documentSize.width) / frame.width,
        Math.min(MIN_ELEMENT_HEIGHT, documentSize.height) / frame.height,
    );
    const maximumScale = Math.max(0, Math.min(
        (documentSize.width - frame.x) / frame.width,
        (documentSize.height - frame.y) / frame.height,
    ));
    const scale = Math.min(Math.max(requestedScale, minimumScale), maximumScale);
    return { ...frame, width: frame.width * scale, height: frame.height * scale };
};

export const constrainTransformerFrame = (
    oldFrame: LayoutFrame,
    newFrame: LayoutFrame,
    minimumSize: number,
    documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE,
): LayoutFrame => {
    const x = Math.max(0, newFrame.x);
    const y = Math.max(0, newFrame.y);
    const right = Math.min(documentSize.width, newFrame.x + newFrame.width);
    const bottom = Math.min(documentSize.height, newFrame.y + newFrame.height);
    const constrained = { ...newFrame, x, y, width: right - x, height: bottom - y };
    return constrained.width >= minimumSize && constrained.height >= minimumSize ? constrained : oldFrame;
};

export const constrainLayoutGeometry = ({
    x,
    y,
    width,
    height,
    rotation,
}: LayoutGeometry, documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE): LayoutGeometry | null => {
    if (![x, y, width, height, rotation].every(Number.isFinite)) {
        return null;
    }

    const position = {
        x: Math.min(Math.max(x, 0), documentSize.width - Math.min(MIN_ELEMENT_WIDTH, documentSize.width)),
        y: Math.min(Math.max(y, 0), documentSize.height - Math.min(MIN_ELEMENT_HEIGHT, documentSize.height)),
    };
    const resizedFrame = resizeLayoutFrame(
        { ...position, width, height },
        { width, height },
        documentSize,
    );
    const clampedPosition = clampLayoutPosition(position, resizedFrame, documentSize);
    const rotatedLayout = keepRotatedFrameInDocument(
        { ...resizedFrame, ...clampedPosition },
        rotation,
        documentSize,
    );

    return rotatedLayout
        ? { ...rotatedLayout.frame, rotation: rotatedLayout.rotation }
        : null;
};

export const normalizeRotation = (rotation: number) => ((rotation % 360) + 540) % 360 - 180;

export const snapValue = (value: number, step: number) => Math.round(value / step) * step;

export const snapLayoutPoint = (point: LayoutPoint, enabled: boolean): LayoutPoint =>
    enabled
        ? {
              x: snapValue(point.x, SNAP_GRID_SIZE),
              y: snapValue(point.y, SNAP_GRID_SIZE),
          }
        : point;

export const calculateSelectionDragSnap = (
    frames: LayoutFrame[],
    rawDelta: LayoutPoint,
    targetFrames: LayoutFrame[],
    enabled: boolean,
    threshold = ALIGNMENT_SNAP_THRESHOLD,
    documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE,
): AlignmentSnap => {
    if (frames.length === 0) return { offset: { x: 0, y: 0 }, guides: [] };
    const left = Math.min(...frames.map((frame) => frame.x));
    const top = Math.min(...frames.map((frame) => frame.y));
    const movedBounds = {
        x: left + rawDelta.x,
        y: top + rawDelta.y,
        width: Math.max(...frames.map((frame) => frame.x + frame.width)) - left,
        height: Math.max(...frames.map((frame) => frame.y + frame.height)) - top,
    };
    const snappedOrigin = snapLayoutPoint({ x: movedBounds.x, y: movedBounds.y }, enabled);
    const gridOffset = {
        x: snappedOrigin.x - movedBounds.x,
        y: snappedOrigin.y - movedBounds.y,
    };
    const alignment = calculateAlignmentSnap({
        ...movedBounds,
        x: movedBounds.x + gridOffset.x,
        y: movedBounds.y + gridOffset.y,
    }, targetFrames, threshold, documentSize);
    const requestedDelta = {
        x: rawDelta.x + gridOffset.x + alignment.offset.x,
        y: rawDelta.y + gridOffset.y + alignment.offset.y,
    };
    return {
        offset: constrainLayoutDelta(frames, requestedDelta, documentSize),
        guides: alignment.guides,
    };
};

export const snapLayoutSize = (size: LayoutSize, enabled: boolean): LayoutSize =>
    enabled
        ? {
              width: snapValue(size.width, SNAP_GRID_SIZE),
              height: snapValue(size.height, SNAP_GRID_SIZE),
          }
        : size;

export const snapRotation = (rotation: number, enabled: boolean) =>
    enabled ? snapValue(rotation, SNAP_ROTATION_STEP) : rotation;

export const keepRotatedFrameInDocument = (
    frame: LayoutFrame,
    rotation: number,
    documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE,
): { frame: LayoutFrame; rotation: number } | null => {
    const normalizedRotation = normalizeRotation(rotation);
    const radians = (normalizedRotation * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const corners = [
        { x: 0, y: 0 },
        { x: frame.width, y: 0 },
        { x: 0, y: frame.height },
        { x: frame.width, y: frame.height },
    ].map(({ x, y }) => ({
        x: frame.x + x * cosine - y * sine,
        y: frame.y + x * sine + y * cosine,
    }));
    const minX = Math.min(...corners.map(({ x }) => x));
    const maxX = Math.max(...corners.map(({ x }) => x));
    const minY = Math.min(...corners.map(({ y }) => y));
    const maxY = Math.max(...corners.map(({ y }) => y));

    if (maxX - minX > documentSize.width || maxY - minY > documentSize.height) {
        return null;
    }

    const shiftX = minX < 0 ? -minX : maxX > documentSize.width ? documentSize.width - maxX : 0;
    const shiftY = minY < 0 ? -minY : maxY > documentSize.height ? documentSize.height - maxY : 0;

    return {
        frame: { ...frame, x: frame.x + shiftX, y: frame.y + shiftY },
        rotation: normalizedRotation,
    };
};

export const alignLayoutGeometry = (
    geometry: LayoutGeometry,
    alignment: LayoutAlignment,
    documentSize: LayoutDocumentSize = DEFAULT_LAYOUT_DOCUMENT_SIZE,
): LayoutGeometry | null => {
    const constrained = constrainLayoutGeometry(geometry, documentSize);
    if (!constrained) {
        return null;
    }

    const radians = (constrained.rotation * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const corners = [
        { x: 0, y: 0 },
        { x: constrained.width, y: 0 },
        { x: 0, y: constrained.height },
        { x: constrained.width, y: constrained.height },
    ].map(({ x, y }) => ({
        x: constrained.x + x * cosine - y * sine,
        y: constrained.y + x * sine + y * cosine,
    }));
    const minX = Math.min(...corners.map(({ x }) => x));
    const maxX = Math.max(...corners.map(({ x }) => x));
    const minY = Math.min(...corners.map(({ y }) => y));
    const maxY = Math.max(...corners.map(({ y }) => y));
    const shifts: Record<LayoutAlignment, LayoutPoint> = {
        left: { x: -minX, y: 0 },
        horizontalCenter: { x: documentSize.width / 2 - (minX + maxX) / 2, y: 0 },
        right: { x: documentSize.width - maxX, y: 0 },
        top: { x: 0, y: -minY },
        verticalCenter: { x: 0, y: documentSize.height / 2 - (minY + maxY) / 2 },
        bottom: { x: 0, y: documentSize.height - maxY },
    };
    const shift = shifts[alignment];

    return constrainLayoutGeometry({
        ...constrained,
        x: constrained.x + shift.x,
        y: constrained.y + shift.y,
    }, documentSize);
};
