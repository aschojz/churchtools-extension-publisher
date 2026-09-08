import { describe, expect, it } from 'vitest';

import { createImageFocusByTemplate } from './imageFocus';
import { loadPublisherRecovery, savePublisherRecovery } from './publisherRecovery';

describe('publisher recovery', () => {
    it('keeps only one validated recovery document', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const document = {
            version: 1 as const,
            id: 'document-1',
            name: 'Recovery',
            revision: 0,
            appointment: null,
            draft: {
                version: 1 as const,
                selectedTemplateId: 'split' as const,
                templateOverrides: {},
                layouts: {},
                imageFocus: createImageFocusByTemplate(),
                snapEnabled: true,
                previewZoomPercent: 100,
                updatedAt: '2026-09-07T10:00:00.000Z',
            },
            createdAt: '2026-09-07T10:00:00.000Z',
            updatedAt: '2026-09-07T10:00:00.000Z',
        };
        savePublisherRecovery(storage, document);
        expect(loadPublisherRecovery(storage)).toEqual(document);
    });
});
