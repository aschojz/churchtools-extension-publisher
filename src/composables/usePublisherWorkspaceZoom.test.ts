import { describe, expect, it } from 'vitest';

import {
    calculateFittedPublisherZoom,
    constrainPublisherZoom,
} from './usePublisherWorkspaceZoom';

describe('publisher workspace zoom', () => {
    it('constrains zoom to the supported range', () => {
        expect(constrainPublisherZoom(5)).toBe(25);
        expect(constrainPublisherZoom(175)).toBe(175);
        expect(constrainPublisherZoom(800)).toBe(400);
    });

    it('fits content into both available viewport dimensions', () => {
        expect(calculateFittedPublisherZoom(
            { width: 1000, height: 700 },
            { width: 1920, height: 1080 },
            100,
        )).toBeCloseTo(146.48, 1);

        expect(calculateFittedPublisherZoom(
            { width: 700, height: 1000 },
            { width: 600, height: 1200 },
            100,
        )).toBeCloseTo(234.38, 1);
    });

    it('uses the zoom limits for very small or very large content', () => {
        expect(calculateFittedPublisherZoom(
            { width: 1200, height: 800 },
            { width: 10, height: 10 },
        )).toBe(400);
        expect(calculateFittedPublisherZoom(
            { width: 100, height: 100 },
            { width: 10_000, height: 10_000 },
        )).toBe(25);
    });
});
