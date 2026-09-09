import { describe, expect, it } from 'vitest';

import { createImageFocusByTemplate } from './imageFocus';
import { loadPublisherRecovery, savePublisherRecovery } from './publisherRecovery';
import { PUBLISHER_DRAFT_VERSION } from './publisherDraft';
import { PUBLISHER_RECORD_VERSION, type PublisherDocumentRecord } from './publisherRepository';

describe('publisher recovery', () => {
    it('keeps only one validated recovery document', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const document: PublisherDocumentRecord = {
            version: PUBLISHER_RECORD_VERSION,
            id: 'document-1',
            name: 'Recovery',
            revision: 0,
            appointment: null,
            draft: {
                version: PUBLISHER_DRAFT_VERSION,
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
