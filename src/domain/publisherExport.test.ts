import { describe, expect, it } from 'vitest';

import type { PublisherPage } from './publisherPage';
import {
    createPublisherExportSettings,
    publisherExportExtension,
    updatePublisherExportSettings,
} from './publisherExport';

const page = (id: string) => ({ id } as PublisherPage);

describe('publisher export settings', () => {
    it('creates serializable defaults for every page and preserves existing choices', () => {
        const initial = createPublisherExportSettings([page('one'), page('two')]);
        const changed = updatePublisherExportSettings(initial, 'two', { format: 'jpeg', jpegQuality: 72 });
        const synchronized = createPublisherExportSettings([page('two'), page('three')], changed);

        expect(synchronized).toEqual([
            { pageId: 'two', enabled: true, format: 'jpeg', jpegQuality: 72 },
            { pageId: 'three', enabled: true, format: 'png', jpegQuality: 90 },
        ]);
    });

    it('clamps JPEG quality and uses conventional filename extensions', () => {
        const settings = createPublisherExportSettings([page('one')]);
        expect(updatePublisherExportSettings(settings, 'one', { jpegQuality: 200 })[0]?.jpegQuality).toBe(100);
        expect(publisherExportExtension('jpeg')).toBe('jpg');
        expect(publisherExportExtension('png')).toBe('png');
    });
});
