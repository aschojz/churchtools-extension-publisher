import { describe, expect, it } from 'vitest';

import {
    calculatePreviewScale,
    DOCUMENT_HEIGHT,
    DOCUMENT_WIDTH,
} from './stageDimensions';

describe('stage dimensions', () => {
    it('scales the preview down without changing its aspect ratio', () => {
        const scale = calculatePreviewScale(960);

        expect(scale).toBe(0.5);
        expect(DOCUMENT_WIDTH * scale).toBe(960);
        expect(DOCUMENT_HEIGHT * scale).toBe(540);
    });

    it('does not enlarge the preview beyond the document size', () => {
        expect(calculatePreviewScale(2560)).toBe(1);
    });

    it('keeps fixed document dimensions independent from the preview', () => {
        expect(DOCUMENT_WIDTH).toBe(1920);
        expect(DOCUMENT_HEIGHT).toBe(1080);
    });
});
