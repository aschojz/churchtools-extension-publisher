import { describe, expect, it } from 'vitest';

import { createLayoutGradient, layoutGradientFillConfig, normalizeLayoutGradient } from './layoutGradient';

describe('layout gradients', () => {
    it('maps percentage coordinates and transparent stops to a linear Konva fill', () => {
        const gradient = createLayoutGradient('#112233');
        gradient.stops[0].opacity = 0.25;
        const config = layoutGradientFillConfig(gradient, { x: 0, y: 0, width: 200, height: 80 });

        expect(config).toMatchObject({
            fillLinearGradientStartPoint: { x: 0, y: 40 },
            fillLinearGradientEndPoint: { x: 200, y: 40 },
            fillLinearGradientColorStops: [0, 'rgba(17, 34, 51, 0.25)', 1, 'rgba(255, 255, 255, 1)'],
        });
    });

    it('supports independent radial centers and radii', () => {
        const gradient = normalizeLayoutGradient({
            ...createLayoutGradient(), type: 'radial', startX: 25, startY: 40,
            endX: 60, endY: 70, startRadius: 5, endRadius: 80,
        });
        const config = layoutGradientFillConfig(gradient, { x: 0, y: 0, width: 300, height: 100 });

        expect(config).toMatchObject({
            fillRadialGradientStartPoint: { x: 75, y: 40 },
            fillRadialGradientEndPoint: { x: 180, y: 70 },
            fillRadialGradientStartRadius: 15,
            fillRadialGradientEndRadius: 240,
        });
    });

    it('resolves dynamic image colors while retaining the stop color as fallback', () => {
        const gradient = createLayoutGradient('#112233');
        gradient.stops[0]!.colorBinding = { imageId: 'image-1', token: 'primary' };
        const config = layoutGradientFillConfig(
            gradient,
            { x: 0, y: 0, width: 200, height: 80 },
            (binding, fallback) => binding?.imageId === 'image-1' ? '#abcdef' : fallback,
        );

        expect(config.fillLinearGradientColorStops).toEqual([
            0, 'rgba(171, 205, 239, 1)',
            1, 'rgba(255, 255, 255, 1)',
        ]);
        expect(normalizeLayoutGradient(gradient).stops[0]?.colorBinding).toEqual({
            imageId: 'image-1', token: 'primary',
        });
    });
});
