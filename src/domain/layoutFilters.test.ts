import { describe, expect, it } from 'vitest';

import {
    createLayoutFilterStack,
    layoutFilterStackHasEnabled,
    moveLayoutFilter,
    normalizeLayoutFilterStack,
    parseLayoutFilterStack,
} from './layoutFilters';

describe('layout filters', () => {
    it('creates each supported filter once in a stable default order', () => {
        const filters = createLayoutFilterStack();

        expect(filters.map(({ type }) => type)).toEqual([
            'brightness', 'contrast', 'hsl', 'grayscale', 'sepia', 'invert', 'pixelate', 'noise',
        ]);
        expect(layoutFilterStackHasEnabled(filters)).toBe(false);
    });

    it('normalizes values and preserves the explicit filter order', () => {
        const filters = normalizeLayoutFilterStack([
            { type: 'noise', enabled: true, amount: 4 },
            { type: 'brightness', enabled: true, amount: -4 },
            { type: 'contrast', enabled: true, amount: 250 },
        ]);

        expect(filters).toEqual([
            { type: 'noise', enabled: true, amount: 1 },
            { type: 'brightness', enabled: true, amount: -1 },
            { type: 'contrast', enabled: true, amount: 100 },
        ]);
        expect(layoutFilterStackHasEnabled(filters)).toBe(true);
    });

    it('rejects malformed persisted stacks instead of partially discarding data', () => {
        expect(parseLayoutFilterStack([{ type: 'contrast', enabled: true }])).toBeNull();
        expect(parseLayoutFilterStack([
            { type: 'invert', enabled: true },
            { type: 'invert', enabled: false },
        ])).toBeNull();
        expect(parseLayoutFilterStack([{ type: 'unknown', enabled: true }])).toBeNull();
    });

    it('reorders filters without mutating the original stack', () => {
        const filters = createLayoutFilterStack();
        const moved = moveLayoutFilter(filters, 'contrast', -1);

        expect(moved.slice(0, 2).map(({ type }) => type)).toEqual(['contrast', 'brightness']);
        expect(filters.slice(0, 2).map(({ type }) => type)).toEqual(['brightness', 'contrast']);
    });
});
