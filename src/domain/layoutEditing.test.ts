import { describe, expect, it } from 'vitest';

import {
    clampLayoutPosition,
    createLayoutOffsets,
    keepRotatedFrameInDocument,
    normalizeRotation,
    resizeLayoutFrame,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
} from './layoutEditing';

describe('layout editing', () => {
    it('creates independent zero offsets for all editable elements', () => {
        const offsets = createLayoutOffsets();

        expect(offsets).toEqual({
            title: { x: 0, y: 0 },
            dateTime: { x: 0, y: 0 },
            location: { x: 0, y: 0 },
        });
        expect(offsets.title).not.toBe(offsets.location);
    });

    it('keeps a moved element inside the document', () => {
        const frame = { x: 0, y: 0, width: 760, height: 310 };

        expect(clampLayoutPosition({ x: -50, y: 900 }, frame)).toEqual({ x: 0, y: 770 });
        expect(clampLayoutPosition({ x: 1400, y: 20 }, frame)).toEqual({ x: 1160, y: 20 });
    });

    it('limits resized elements to minimum dimensions and the document bounds', () => {
        const frame = { x: 1500, y: 900, width: 300, height: 100 };

        expect(resizeLayoutFrame(frame, { width: 10, height: 10 })).toEqual({
            ...frame,
            width: 120,
            height: 50,
        });
        expect(resizeLayoutFrame(frame, { width: 900, height: 500 })).toEqual({
            ...frame,
            width: 420,
            height: 180,
        });
    });

    it('normalizes rotation and shifts rotated bounds back into the document', () => {
        expect(normalizeRotation(190)).toBe(-170);
        expect(normalizeRotation(-190)).toBe(170);

        const result = keepRotatedFrameInDocument(
            { x: 1800, y: 100, width: 200, height: 100 },
            45,
        );

        expect(result?.rotation).toBe(45);
        expect(result?.frame.x).toBeLessThan(1800);
    });

    it('rejects a rotation whose bounding box cannot fit into the document', () => {
        expect(
            keepRotatedFrameInDocument(
                { x: 0, y: 0, width: 1600, height: 410 },
                90,
            ),
        ).toBeNull();
    });

    it('snaps positions, sizes and rotations only when enabled', () => {
        expect(snapLayoutPoint({ x: 113, y: 129 }, true)).toEqual({ x: 120, y: 120 });
        expect(snapLayoutSize({ width: 753, height: 307 }, true)).toEqual({ width: 760, height: 300 });
        expect(snapRotation(22, true)).toBe(15);
        expect(snapRotation(22, false)).toBe(22);
    });
});
