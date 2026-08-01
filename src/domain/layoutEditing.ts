import type { TemplateId } from './templates';
import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';

export type LayoutElementId = 'title' | 'dateTime' | 'location';

export interface LayoutFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutPoint {
    x: number;
    y: number;
}

export interface LayoutSize {
    width: number;
    height: number;
}

export type LayoutOffsets = Record<LayoutElementId, LayoutPoint>;
export type LayoutSizes = Record<LayoutElementId, LayoutSize>;
export type LayoutRotations = Record<LayoutElementId, number>;

export const MIN_ELEMENT_WIDTH = 120;
export const MIN_ELEMENT_HEIGHT = 50;

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

export const clampLayoutPosition = (position: LayoutPoint, frame: LayoutFrame): LayoutPoint => ({
    x: Math.min(Math.max(position.x, 0), DOCUMENT_WIDTH - frame.width),
    y: Math.min(Math.max(position.y, 0), DOCUMENT_HEIGHT - frame.height),
});

export const resizeLayoutFrame = (frame: LayoutFrame, size: LayoutSize): LayoutFrame => ({
    ...frame,
    width: Math.min(Math.max(size.width, MIN_ELEMENT_WIDTH), DOCUMENT_WIDTH - frame.x),
    height: Math.min(Math.max(size.height, MIN_ELEMENT_HEIGHT), DOCUMENT_HEIGHT - frame.y),
});

export const normalizeRotation = (rotation: number) => ((rotation % 360) + 540) % 360 - 180;

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
