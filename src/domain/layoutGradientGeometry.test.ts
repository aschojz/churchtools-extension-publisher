import { describe, expect, it } from 'vitest';

import { createLayoutGradient } from './layoutGradient';
import {
    documentPointToGradientPercent,
    gradientPercentPointToDocument,
    layoutGradientCanvasGeometry,
    updateLayoutGradientPoint,
    updateLayoutGradientRadius,
    updateLayoutGradientStopOffset,
} from './layoutGradientGeometry';

const space = {
    frame: { x: 100, y: 50, width: 200, height: 100 },
    rotation: 0,
};

describe('layout gradient canvas geometry', () => {
    it('maps percentage coordinates to the canvas and back through rotation', () => {
        const rotatedSpace = { ...space, rotation: 90 };
        const point = gradientPercentPointToDocument(rotatedSpace, { x: 25, y: 50 });

        expect(point.x).toBeCloseTo(50);
        expect(point.y).toBeCloseTo(100);
        expect(documentPointToGradientPercent(rotatedSpace, point)).toEqual({ x: 25, y: 50 });
    });

    it('updates linear endpoints and projects stops onto the gradient axis', () => {
        const gradient = createLayoutGradient('#123456');
        const moved = updateLayoutGradientPoint(gradient, space, 'end', { x: 200, y: 150 });
        expect(moved).toMatchObject({ endX: 50, endY: 100 });

        const stop = updateLayoutGradientStopOffset(gradient, space, 'gradient-stop-0', { x: 250, y: 130 });
        expect(stop.stops.find(({ id }) => id === 'gradient-stop-0')?.offset).toBeCloseTo(0.75);
    });

    it('exposes radial radius handles and updates their size', () => {
        const gradient = { ...createLayoutGradient(), type: 'radial' as const, startRadius: 10, endRadius: 40 };
        const geometry = layoutGradientCanvasGeometry(gradient, space);

        expect(geometry.startRadiusHandle).toEqual({ x: 120, y: 100 });
        expect(geometry.endRadiusHandle).toEqual({ x: 380, y: 100 });
        expect(updateLayoutGradientRadius(gradient, space, 'end', { x: 360, y: 100 }).endRadius).toBe(30);
    });
});
