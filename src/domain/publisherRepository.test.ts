import { describe, expect, it } from 'vitest';

import { createImageFocusByTemplate } from './imageFocus';
import { createMemoryPublisherRepository, appointmentKeyFromReference, appointmentReferenceFromKey } from './publisherRepository';
import type { PublisherDraft } from './publisherDraft';

const createDraft = (): PublisherDraft => ({
    version: 1,
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
        const original = {
            version: 1 as const,
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
});
