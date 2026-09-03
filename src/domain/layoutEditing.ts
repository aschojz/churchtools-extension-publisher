import type { TemplateId } from './templates';
import {
    BUILT_IN_TEMPLATE_DEFINITIONS,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
} from './templateDefinition';
import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';

export const TEXT_LAYOUT_ELEMENT_IDS = ['title', 'dateTime', 'location'] as const;
export const SHAPE_LAYOUT_ELEMENT_IDS = ['background', 'accent'] as const;
export const LAYOUT_ELEMENT_IDS = ['background', 'image', 'accent', ...TEXT_LAYOUT_ELEMENT_IDS] as const;
export type LayoutElementId = (typeof LAYOUT_ELEMENT_IDS)[number];
export type LayoutTextElementId = (typeof TEXT_LAYOUT_ELEMENT_IDS)[number];
export type LayoutShapeElementId = (typeof SHAPE_LAYOUT_ELEMENT_IDS)[number];

export interface LayoutFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutGeometry extends LayoutFrame {
    rotation: number;
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
    fontFamily: string;
    fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
    lineHeight: number;
    letterSpacing: number;
    align: 'left' | 'center' | 'right';
    listStyle: 'none' | 'bullet' | 'numbered';
}

export interface LayoutVisualStyle {
    fill: string;
    stroke: string;
    strokeWidth: number;
}

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

export type LayoutOffsets = Record<LayoutElementId, LayoutPoint>;
export type LayoutSizes = Record<LayoutElementId, LayoutSize>;
export type LayoutRotations = Record<LayoutElementId, number>;
export type LayoutOrder = LayoutElementId[];
export interface LayoutGroup {
    id: string;
    children: (LayoutElementId | LayoutGroup)[];
}
export type LayoutGroups = LayoutGroup[];
export type LayoutLayerTreeNode =
    | { kind: 'element'; id: LayoutElementId; elementId: LayoutElementId }
    | { kind: 'group'; id: string; elementIds: LayoutElementId[]; children: LayoutLayerTreeNode[] };
export type LayoutTextStyles = Record<LayoutTextElementId, LayoutTextStyle>;
export type LayoutVisualStyles = Record<LayoutShapeElementId, LayoutVisualStyle>;

export interface LayoutElementState {
    offsets: LayoutOffsets;
    sizes: LayoutSizes;
    rotations: LayoutRotations;
    order: LayoutOrder;
    styles: LayoutTextStyles;
    visualStyles: LayoutVisualStyles;
}

export const MIN_ELEMENT_WIDTH = 120;
export const MIN_ELEMENT_HEIGHT = 50;
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

export const createLayoutGroups = (): LayoutGroups => [];

export const layoutGroupElementIds = (group: LayoutGroup): LayoutElementId[] =>
    group.children.flatMap((child) => typeof child === 'string' ? [child] : layoutGroupElementIds(child));

export const flattenLayoutGroups = (groups: LayoutGroups): LayoutGroup[] =>
    groups.flatMap((group) => [
        group,
        ...flattenLayoutGroups(group.children.filter((child): child is LayoutGroup => typeof child !== 'string')),
    ]);

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

export const expandLayoutSelection = (groups: LayoutGroups, elementIds: LayoutElementId[]) => {
    const expanded = new Set(elementIds);
    for (const group of groups) {
        const descendants = layoutGroupElementIds(group);
        if (descendants.some((elementId) => expanded.has(elementId))) {
            descendants.forEach((elementId) => expanded.add(elementId));
        }
    }
    return createLayoutOrder().filter((elementId) => expanded.has(elementId));
};

export const groupLayoutElements = (
    groups: LayoutGroups,
    elementIds: LayoutElementId[],
    groupId: string,
): LayoutGroups => {
    const selectedIds = new Set(expandLayoutSelection(groups, elementIds));
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
    selectedChildren.push(...createLayoutOrder().filter((elementId) => selectedIds.has(elementId)));
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

export const createLayoutTextStyles = (templateId: TemplateId): LayoutTextStyles => {
    const elements = BUILT_IN_TEMPLATE_DEFINITIONS[templateId].elements;
    const styleFor = (elementId: LayoutTextElementId): LayoutTextStyle => ({
        fontSize: elements[elementId].style.fontSize,
        color: elements[elementId].style.color,
        fontFamily: elements[elementId].style.fontFamily,
        fontStyle: elements[elementId].style.fontStyle,
        lineHeight: elements[elementId].style.lineHeight,
        letterSpacing: 0,
        align: elements[elementId].style.align,
        listStyle: 'none',
    });
    return {
        title: styleFor('title'),
        dateTime: styleFor('dateTime'),
        location: styleFor('location'),
    };
};

export const createLayoutVisualStyles = (templateId: TemplateId): LayoutVisualStyles => {
    const decorations = BUILT_IN_TEMPLATE_DEFINITIONS[templateId].composition.decorations;
    const styleFor = (elementId: LayoutShapeElementId): LayoutVisualStyle => ({
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

export const resetLayoutElementState = (
    templateId: TemplateId,
    elementId: LayoutElementId,
    state: LayoutElementState,
): LayoutElementState => {
    const defaultOrder = createLayoutOrder();
    const orderWithoutElement = state.order.filter((candidate) => candidate !== elementId);
    orderWithoutElement.splice(defaultOrder.indexOf(elementId), 0, elementId);

    return {
        offsets: { ...state.offsets, [elementId]: { x: 0, y: 0 } },
        sizes: {
            ...state.sizes,
            [elementId]: {
                width: TEMPLATE_ELEMENT_FRAMES[templateId][elementId].width,
                height: TEMPLATE_ELEMENT_FRAMES[templateId][elementId].height,
            },
        },
        rotations: { ...state.rotations, [elementId]: 0 },
        order: orderWithoutElement,
        styles: {
            ...state.styles,
            ...(TEXT_LAYOUT_ELEMENT_IDS.includes(elementId as LayoutTextElementId)
                ? { [elementId]: { ...createLayoutTextStyles(templateId)[elementId as LayoutTextElementId] } }
                : {}),
        },
        visualStyles: {
            ...state.visualStyles,
            ...(SHAPE_LAYOUT_ELEMENT_IDS.includes(elementId as LayoutShapeElementId)
                ? { [elementId]: { ...createLayoutVisualStyles(templateId)[elementId as LayoutShapeElementId] } }
                : {}),
        },
    };
};

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
