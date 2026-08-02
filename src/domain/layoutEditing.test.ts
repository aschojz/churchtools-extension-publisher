import { describe, expect, it } from 'vitest';

import {
    alignLayoutGeometry,
    calculateAlignmentSnap,
    clampLayoutPosition,
    constrainLayoutGeometry,
    createLayoutOrder,
    createLayoutOffsets,
    keepRotatedFrameInDocument,
    normalizeRotation,
    moveLayoutElementInOrder,
    resizeLayoutFrame,
    resetLayoutElementState,
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

    it('constrains exact geometry values to a valid document frame', () => {
        expect(
            constrainLayoutGeometry({ x: 1100, y: 130, width: 760, height: 310, rotation: 0 }),
        ).toEqual({ x: 1100, y: 130, width: 760, height: 310, rotation: 0 });
        expect(
            constrainLayoutGeometry({ x: -20, y: 1040, width: 2500, height: 10, rotation: 360 }),
        ).toEqual({ x: 0, y: 1030, width: 1920, height: 50, rotation: 0 });
    });

    it('rejects non-finite or impossible rotated geometry', () => {
        expect(
            constrainLayoutGeometry({ x: 0, y: 0, width: Number.NaN, height: 100, rotation: 0 }),
        ).toBeNull();
        expect(
            constrainLayoutGeometry({ x: 0, y: 0, width: 1600, height: 410, rotation: 90 }),
        ).toBeNull();
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

    it('moves elements through a serializable layer order without crossing its bounds', () => {
        const initialOrder = createLayoutOrder();
        const movedOrder = moveLayoutElementInOrder(initialOrder, 'title', 1);

        expect(movedOrder).toEqual(['dateTime', 'title', 'location']);
        expect(initialOrder).toEqual(['title', 'dateTime', 'location']);
        expect(moveLayoutElementInOrder(initialOrder, 'title', -1)).toBe(initialOrder);
    });

    it('resets only the selected element geometry and default layer position', () => {
        const state = {
            offsets: {
                title: { x: 40, y: 20 },
                dateTime: { x: 15, y: 10 },
                location: { x: 0, y: 0 },
            },
            sizes: {
                title: { width: 500, height: 200 },
                dateTime: { width: 400, height: 60 },
                location: { width: 760, height: 170 },
            },
            rotations: { title: 30, dateTime: 15, location: 0 },
            order: ['dateTime', 'location', 'title'] as const,
        };

        const reset = resetLayoutElementState('split', 'title', {
            ...state,
            order: [...state.order],
        });

        expect(reset.offsets.title).toEqual({ x: 0, y: 0 });
        expect(reset.sizes.title).toEqual({ width: 760, height: 310 });
        expect(reset.rotations.title).toBe(0);
        expect(reset.order).toEqual(['title', 'dateTime', 'location']);
        expect(reset.offsets.dateTime).toEqual(state.offsets.dateTime);
        expect(reset.sizes.dateTime).toEqual(state.sizes.dateTime);
        expect(reset.rotations.dateTime).toBe(15);
    });

    it('snaps matching element edges and reports visual alignment guides', () => {
        expect(
            calculateAlignmentSnap(
                { x: 98, y: 207, width: 100, height: 60 },
                [{ x: 200, y: 300, width: 200, height: 100 }],
            ),
        ).toEqual({
            offset: { x: 2, y: 0 },
            guides: [{ orientation: 'vertical', position: 200 }],
        });
    });

    it('snaps element centers to the document center', () => {
        expect(calculateAlignmentSnap({ x: 906, y: 506, width: 100, height: 60 }, [])).toEqual({
            offset: { x: 4, y: 4 },
            guides: [
                { orientation: 'vertical', position: 960 },
                { orientation: 'horizontal', position: 540 },
            ],
        });
    });

    it('aligns unrotated geometry to document edges and centers', () => {
        const geometry = { x: 300, y: 200, width: 600, height: 300, rotation: 0 };

        expect(alignLayoutGeometry(geometry, 'left')?.x).toBe(0);
        expect(alignLayoutGeometry(geometry, 'horizontalCenter')?.x).toBe(660);
        expect(alignLayoutGeometry(geometry, 'right')?.x).toBe(1320);
        expect(alignLayoutGeometry(geometry, 'top')?.y).toBe(0);
        expect(alignLayoutGeometry(geometry, 'verticalCenter')?.y).toBe(390);
        expect(alignLayoutGeometry(geometry, 'bottom')?.y).toBe(780);
    });

    it('aligns the visible bounds of rotated geometry', () => {
        const aligned = alignLayoutGeometry(
            { x: 500, y: 300, width: 400, height: 200, rotation: 45 },
            'left',
        );

        expect(aligned).not.toBeNull();
        expect(aligned?.x).toBeCloseTo(200 * Math.sin(Math.PI / 4));
    });
});
