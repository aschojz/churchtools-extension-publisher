import { describe, expect, it } from 'vitest';

import {
    createLayoutElementEffects,
    layoutElementHasEffects,
    normalizeLayoutElementEffects,
} from './layoutEditing';

describe('layout effects', () => {
    it('uses non-destructive defaults and recognizes each supported effect family', () => {
        const effects = createLayoutElementEffects();
        expect(layoutElementHasEffects(effects)).toBe(false);

        expect(layoutElementHasEffects({ ...effects, shadow: { ...effects.shadow, enabled: true } })).toBe(true);
        expect(layoutElementHasEffects({ ...effects, blur: { ...effects.blur, enabled: true } })).toBe(true);
        expect(layoutElementHasEffects({ ...effects, opacity: 0.5 })).toBe(true);
        expect(layoutElementHasEffects({ ...effects, blendMode: 'multiply' })).toBe(true);
    });

    it('normalizes older or partial effect data', () => {
        expect(normalizeLayoutElementEffects({
            shadow: { enabled: true, color: '#123456' },
        })).toMatchObject({
            shadow: {
                enabled: true,
                color: '#123456',
                blur: 16,
                offsetX: 8,
                offsetY: 8,
                opacity: 0.5,
                forStroke: true,
            },
            blur: { enabled: false, radius: 4 },
            opacity: 1,
            blendMode: 'source-over',
        });
    });
});
