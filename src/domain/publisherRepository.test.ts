import { describe, expect, it } from 'vitest';

import { createImageFocusByTemplate } from './imageFocus';
import { createMemoryPublisherRepository, appointmentKeyFromReference, appointmentReferenceFromKey, parsePublisherDocumentRecord, PUBLISHER_RECORD_VERSION, type PublisherDocumentRecord } from './publisherRepository';
import { PUBLISHER_DRAFT_VERSION, type PublisherDraft } from './publisherDraft';

const createDraft = (): PublisherDraft => ({
    version: PUBLISHER_DRAFT_VERSION,
    selectedTemplateId: 'split',
    templateOverrides: {},
    layouts: {},
    imageFocus: createImageFocusByTemplate(),
    snapEnabled: true,
    previewZoomPercent: 100,
    updatedAt: '2026-09-07T10:00:00.000Z',
});

describe('publisher repository contract', () => {
    it('round-trips appointment references without losing the occurrence time', () => {
        const key = '42:2026-12-01T10:00:00Z';
        expect(appointmentKeyFromReference(appointmentReferenceFromKey(key))).toBe(key);
        expect(appointmentReferenceFromKey('invalid')).toBeNull();
    });

    it('detects conflicting document revisions', async () => {
        const repository = createMemoryPublisherRepository();
        const original: PublisherDocumentRecord = {
            version: PUBLISHER_RECORD_VERSION,
            id: 'document-1',
            name: 'Sonntag',
            revision: 0,
            appointment: appointmentReferenceFromKey('42:2026-12-01T10:00:00Z'),
            draft: createDraft(),
            createdAt: '2026-09-07T10:00:00.000Z',
            updatedAt: '2026-09-07T10:00:00.000Z',
        };
        const saved = await repository.saveDocument(original);
        expect(saved.revision).toBe(1);
        await expect(repository.saveDocument(original)).rejects.toMatchObject({ code: 'conflict' });
    });

    it('migrates version-one document records and drafts', () => {
        const draft = createDraft();
        const parsed = parsePublisherDocumentRecord({
            version: 1,
            id: 'legacy-document',
            name: 'Altes Dokument',
            revision: 3,
            appointment: null,
            draft: { ...draft, version: 1 },
            createdAt: '2026-09-07T10:00:00.000Z',
            updatedAt: '2026-09-07T10:00:00.000Z',
        });

        expect(parsed?.version).toBe(PUBLISHER_RECORD_VERSION);
        expect(parsed?.draft.version).toBe(PUBLISHER_DRAFT_VERSION);
    });
});
