import type { TemplateId } from './templates';
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

export interface LayoutElementState {
    offsets: LayoutOffsets;
    sizes: LayoutSizes;
    rotations: LayoutRotations;
    order: LayoutOrder;
}

export const MIN_ELEMENT_WIDTH = 120;
export const MIN_ELEMENT_HEIGHT = 50;
export const SNAP_GRID_SIZE = 20;
export const SNAP_ROTATION_STEP = 15;
export const ALIGNMENT_SNAP_THRESHOLD = 10;

export const TEMPLATE_ELEMENT_FRAMES: Record<TemplateId, Record<LayoutElementId, LayoutFrame>> = {
    split: {
        title: { x: 1030, y: 130, width: 760, height: 310 },
        dateTime: { x: 1030, y: 555, width: 760, height: 80 },
        location: { x: 1030, y: 700, width: 760, height: 170 },
    },
    poster: {
        title: { x: 160, y: 150, width: 1600, height: 410 },
        dateTime: { x: 160, y: 675, width: 1600, height: 80 },
        location: { x: 260, y: 770, width: 1400, height: 120 },
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
