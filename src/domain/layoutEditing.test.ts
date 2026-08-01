import { describe, expect, it } from 'vitest';

import { clampLayoutPosition, createLayoutOffsets } from './layoutEditing';

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
});
