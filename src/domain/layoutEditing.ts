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

export type LayoutOffsets = Record<LayoutElementId, LayoutPoint>;

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

export const clampLayoutPosition = (position: LayoutPoint, frame: LayoutFrame): LayoutPoint => ({
    x: Math.min(Math.max(position.x, 0), DOCUMENT_WIDTH - frame.width),
    y: Math.min(Math.max(position.y, 0), DOCUMENT_HEIGHT - frame.height),
});
