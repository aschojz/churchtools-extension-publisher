import { describe, expect, it } from 'vitest';

import {
    parsePublisherColorPreferences,
    parsePublisherImagePalette,
    publisherImagePaletteCacheKey,
    serializePublisherColorPreferences,
    serializePublisherImagePalette,
} from './publisherColorCache';

describe('publisher color cache', () => {
    it('roundtrips versioned recent colors and rejects older structures', () => {
        const cached = serializePublisherColorPreferences(['#ABCDEF', 'invalid', '#123456']);

        expect(parsePublisherColorPreferences(cached)).toEqual(['#abcdef', '#123456']);
        expect(parsePublisherColorPreferences({ version: 0, recentColors: ['#abcdef'] })).toEqual([]);
    });

    it('roundtrips valid image palettes and validates semantic roles', () => {
        const cached = serializePublisherImagePalette({
            colors: [
                { id: 'one', label: 'Eins', hex: '#ABCDEF' },
                { id: 'two', label: 'Zwei', hex: '#123456' },
            ],
            primary: '#ABCDEF', background: '#123456', foreground: '#ABCDEF',
        });

        expect(parsePublisherImagePalette(cached)).toMatchObject({ primary: '#abcdef', background: '#123456' });
        expect(parsePublisherImagePalette({ ...cached, palette: { ...cached.palette, primary: '#ffffff' } })).toBeNull();
    });

    it('uses a stable source-derived key without storing the source itself', () => {
        const source = 'https://example.test/private/image.jpg?token=secret';
        const key = publisherImagePaletteCacheKey(source);

        expect(key).toBe(publisherImagePaletteCacheKey(source));
        expect(key).not.toContain(source);
        expect(key).not.toContain('secret');
    });
});
