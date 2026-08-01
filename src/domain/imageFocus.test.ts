import { describe, expect, it } from 'vitest';

import { calculateCoverCrop, clampImageFocus, createImageFocusByTemplate } from './imageFocus';

describe('image focus', () => {
    it('creates independent centered focus values for both templates', () => {
        const focus = createImageFocusByTemplate();

        expect(focus).toEqual({ split: { x: 50, y: 50 }, poster: { x: 50, y: 50 } });
        expect(focus.split).not.toBe(focus.poster);
    });

    it('uses horizontal focus for a wide cover image', () => {
        expect(
            calculateCoverCrop(
                { width: 2400, height: 1200 },
                { width: 1000, height: 1000 },
                { x: 25, y: 80 },
            ),
        ).toEqual({ x: 300, y: 0, width: 1200, height: 1200 });
    });

    it('uses vertical focus for a tall cover image', () => {
        expect(
            calculateCoverCrop(
                { width: 1000, height: 2000 },
                { width: 1000, height: 500 },
                { x: 20, y: 75 },
            ),
        ).toEqual({ x: 0, y: 1125, width: 1000, height: 500 });
    });

    it('clamps focus values and rejects invalid dimensions', () => {
        expect(clampImageFocus({ x: -10, y: 120 })).toEqual({ x: 0, y: 100 });
        expect(
            calculateCoverCrop(
                { width: 0, height: 100 },
                { width: 50, height: 50 },
                { x: 50, y: 50 },
            ),
        ).toBeNull();
    });
});
