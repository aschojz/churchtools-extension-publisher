import { describe, expect, it } from 'vitest';

import { MAX_LOCAL_IMAGE_SIZE, validateLocalImage } from './localImageOverride';

describe('local image override', () => {
    it('accepts supported raster images within the size limit', () => {
        expect(validateLocalImage({ type: 'image/png', size: 2_000_000 })).toBeNull();
        expect(validateLocalImage({ type: 'image/jpeg', size: MAX_LOCAL_IMAGE_SIZE })).toBeNull();
        expect(validateLocalImage({ type: 'image/webp', size: 50_000 })).toBeNull();
    });

    it('rejects unsupported formats and oversized images', () => {
        expect(validateLocalImage({ type: 'image/svg+xml', size: 50_000 })).toContain('JPEG, PNG oder WebP');
        expect(validateLocalImage({ type: 'image/png', size: MAX_LOCAL_IMAGE_SIZE + 1 })).toContain('20 MB');
    });
});
