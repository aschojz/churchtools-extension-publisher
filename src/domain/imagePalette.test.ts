import { describe, expect, it } from 'vitest';

import {
    colorContrastRatio,
    createPublisherImagePalette,
    isLayoutColorBinding,
    resolvePaletteBinding,
} from './imagePalette';

describe('image palettes', () => {
    it('creates semantic colors and deduplicated swatches from an extracted palette', () => {
        const palette = createPublisherImagePalette({
            Vibrant: { hex: '#f05a28' },
            DarkVibrant: { hex: '#552211' },
            LightVibrant: { hex: '#ffd28a' },
            Muted: { hex: '#aa7766' },
            DarkMuted: { hex: '#2a2422' },
            LightMuted: { hex: '#ffd28a' },
        });

        expect(palette.primary).toBe('#f05a28');
        expect(palette.background).toBe('#2a2422');
        expect(palette.colors).toHaveLength(5);
        expect(colorContrastRatio(palette.background, palette.foreground)).toBeGreaterThanOrEqual(4.5);
    });

    it('resolves bindings only after their image palette is available', () => {
        const binding = { imageId: 'data:image', token: 'primary' } as const;
        expect(resolvePaletteBinding(binding, '#123456', {})).toBe('#123456');
        expect(resolvePaletteBinding(binding, '#123456', {
            'data:image': { colors: [], primary: '#abcdef', background: '#111111', foreground: '#ffffff' },
        })).toBe('#abcdef');
        expect(isLayoutColorBinding(binding)).toBe(true);
        expect(isLayoutColorBinding({ imageId: '', token: 'primary' })).toBe(false);
    });
});
