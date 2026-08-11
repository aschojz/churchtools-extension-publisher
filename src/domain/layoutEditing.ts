import type { TemplateId } from './templates';
import {
    BUILT_IN_TEMPLATE_DEFINITIONS,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
} from './templateDefinition';
import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';

export type LayoutElementId = 'title' | 'dateTime' | 'location';

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

export interface LayoutTextStyle {
    fontSize: number;
    color: string;
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
export type LayoutTextStyles = Record<LayoutElementId, LayoutTextStyle>;

export interface LayoutElementState {
    offsets: LayoutOffsets;
    sizes: LayoutSizes;
    rotations: LayoutRotations;
    order: LayoutOrder;
    styles: LayoutTextStyles;
}

export const MIN_ELEMENT_WIDTH = 120;
export const MIN_ELEMENT_HEIGHT = 50;
export const SNAP_GRID_SIZE = 20;
export const SNAP_ROTATION_STEP = 15;
export const ALIGNMENT_SNAP_THRESHOLD = 10;
export { MAX_FONT_SIZE, MIN_FONT_SIZE };

export const TEMPLATE_ELEMENT_FRAMES: Record<TemplateId, Record<LayoutElementId, LayoutFrame>> = {
    split: {
        title: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.elements.title.frame },
        dateTime: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.elements.dateTime.frame },
        location: { ...BUILT_IN_TEMPLATE_DEFINITIONS.split.elements.location.frame },
    },
    poster: {
        title: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.elements.title.frame },
        dateTime: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.elements.dateTime.frame },
        location: { ...BUILT_IN_TEMPLATE_DEFINITIONS.poster.elements.location.frame },
    },
};

export const createLayoutOffsets = (): LayoutOffsets => ({
    title: { x: 0, y: 0 },
    dateTime: { x: 0, y: 0 },
    location: { x: 0, y: 0 },
});

export const createLayoutSizes = (templateId: TemplateId): LayoutSizes => ({
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
    title: 0,
    dateTime: 0,
    location: 0,
});

export const createLayoutOrder = (): LayoutOrder => ['title', 'dateTime', 'location'];

export const createLayoutGroups = (): LayoutGroups => [];

export const layoutGroupElementIds = (group: LayoutGroup): LayoutElementId[] =>
    group.children.flatMap((child) => typeof child === 'string' ? [child] : layoutGroupElementIds(child));

export const flattenLayoutGroups = (groups: LayoutGroups): LayoutGroup[] =>
    groups.flatMap((group) => [
        group,
        ...flattenLayoutGroups(group.children.filter((child): child is LayoutGroup => typeof child !== 'string')),
    ]);

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
    return {
        title: { fontSize: elements.title.style.fontSize, color: elements.title.style.color },
        dateTime: { fontSize: elements.dateTime.style.fontSize, color: elements.dateTime.style.color },
        location: { fontSize: elements.location.style.fontSize, color: elements.location.style.color },
    };
};

export const constrainFontSize = (fontSize: number) =>
    Math.min(Math.max(Math.round(fontSize), MIN_FONT_SIZE), MAX_FONT_SIZE);

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
            [elementId]: { ...createLayoutTextStyles(templateId)[elementId] },
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
): AlignmentSnap => {
    const verticalTargets = [0, DOCUMENT_WIDTH / 2, DOCUMENT_WIDTH];
    const horizontalTargets = [0, DOCUMENT_HEIGHT / 2, DOCUMENT_HEIGHT];
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

export const clampLayoutPosition = (position: LayoutPoint, frame: LayoutFrame): LayoutPoint => ({
    x: Math.min(Math.max(position.x, 0), DOCUMENT_WIDTH - frame.width),
    y: Math.min(Math.max(position.y, 0), DOCUMENT_HEIGHT - frame.height),
});

export const constrainLayoutDelta = (frames: LayoutFrame[], delta: LayoutPoint): LayoutPoint => {
    if (frames.length === 0) {
        return { x: 0, y: 0 };
    }
    return {
        x: Math.min(
            Math.max(delta.x, ...frames.map((frame) => -frame.x)),
            ...frames.map((frame) => DOCUMENT_WIDTH - frame.x - frame.width),
        ),
        y: Math.min(
            Math.max(delta.y, ...frames.map((frame) => -frame.y)),
            ...frames.map((frame) => DOCUMENT_HEIGHT - frame.y - frame.height),
        ),
    };
};

export const layoutFramesIntersect = (left: LayoutFrame, right: LayoutFrame) =>
    left.x <= right.x + right.width && left.x + left.width >= right.x &&
    left.y <= right.y + right.height && left.y + left.height >= right.y;

export const resizeLayoutFrame = (frame: LayoutFrame, size: LayoutSize): LayoutFrame => ({
    ...frame,
    width: Math.min(Math.max(size.width, MIN_ELEMENT_WIDTH), DOCUMENT_WIDTH - frame.x),
    height: Math.min(Math.max(size.height, MIN_ELEMENT_HEIGHT), DOCUMENT_HEIGHT - frame.y),
});

export const constrainLayoutGeometry = ({
    x,
    y,
    width,
    height,
    rotation,
}: LayoutGeometry): LayoutGeometry | null => {
    if (![x, y, width, height, rotation].every(Number.isFinite)) {
        return null;
    }

    const position = {
        x: Math.min(Math.max(x, 0), DOCUMENT_WIDTH - MIN_ELEMENT_WIDTH),
        y: Math.min(Math.max(y, 0), DOCUMENT_HEIGHT - MIN_ELEMENT_HEIGHT),
    };
    const resizedFrame = resizeLayoutFrame(
        { ...position, width, height },
        { width, height },
    );
    const clampedPosition = clampLayoutPosition(position, resizedFrame);
    const rotatedLayout = keepRotatedFrameInDocument(
        { ...resizedFrame, ...clampedPosition },
        rotation,
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

    if (maxX - minX > DOCUMENT_WIDTH || maxY - minY > DOCUMENT_HEIGHT) {
        return null;
    }

    const shiftX = minX < 0 ? -minX : maxX > DOCUMENT_WIDTH ? DOCUMENT_WIDTH - maxX : 0;
    const shiftY = minY < 0 ? -minY : maxY > DOCUMENT_HEIGHT ? DOCUMENT_HEIGHT - maxY : 0;

    return {
        frame: { ...frame, x: frame.x + shiftX, y: frame.y + shiftY },
        rotation: normalizedRotation,
    };
};

export const alignLayoutGeometry = (
    geometry: LayoutGeometry,
    alignment: LayoutAlignment,
): LayoutGeometry | null => {
    const constrained = constrainLayoutGeometry(geometry);
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
        horizontalCenter: { x: DOCUMENT_WIDTH / 2 - (minX + maxX) / 2, y: 0 },
        right: { x: DOCUMENT_WIDTH - maxX, y: 0 },
        top: { x: 0, y: -minY },
        verticalCenter: { x: 0, y: DOCUMENT_HEIGHT / 2 - (minY + maxY) / 2 },
        bottom: { x: 0, y: DOCUMENT_HEIGHT - maxY },
    };
    const shift = shifts[alignment];

    return constrainLayoutGeometry({
        ...constrained,
        x: constrained.x + shift.x,
        y: constrained.y + shift.y,
    });
};
