import { describe, expect, it } from 'vitest';

import { createImageFocusByTemplate } from './imageFocus';
import {
    belongsToAppointment,
    createPublisherDraftFile,
    parsePublisherDraftFile,
    serializePublisherDraftFile,
} from './publisherDraftFile';
import { PUBLISHER_DRAFT_VERSION, type PublisherDraft } from './publisherDraft';

const draft: PublisherDraft = {
    version: PUBLISHER_DRAFT_VERSION,
    selectedTemplateId: 'poster',
    templateOverrides: { title: 'Portabler Titel' },
    layouts: {},
    imageFocus: createImageFocusByTemplate(),
    snapEnabled: true,
    previewZoomPercent: 125,
    updatedAt: '2026-08-09T10:00:00.000Z',
};

describe('publisher draft file', () => {
    it('round-trips a valid versioned draft file', () => {
        const file = createPublisherDraftFile('42:2026-08-10T10:00:00Z', draft);
        const parsed = parsePublisherDraftFile(serializePublisherDraftFile(file));

        expect(parsed).toEqual(file);
        expect(parsed && belongsToAppointment(parsed, '42:2026-08-10T10:00:00Z')).toBe(true);
        expect(parsed && belongsToAppointment(parsed, '99:other-start')).toBe(false);
    });

    it('rejects malformed, unsupported and invalid draft files', () => {
        expect(parsePublisherDraftFile('{invalid')).toBeNull();
        expect(parsePublisherDraftFile(JSON.stringify({
            ...createPublisherDraftFile('42:start', draft),
            fileVersion: 99,
        }))).toBeNull();
        expect(parsePublisherDraftFile(JSON.stringify({
            ...createPublisherDraftFile('42:start', draft),
            draft: { ...draft, previewZoomPercent: 999 },
        }))).toBeNull();
    });

    it('migrates version-one file envelopes and nested version-two drafts', () => {
        const parsed = parsePublisherDraftFile(JSON.stringify({
            ...createPublisherDraftFile('42:start', draft),
            fileVersion: 1,
            draft: { ...draft, version: 2 },
        }));

        expect(parsed?.fileVersion).toBe(2);
        expect(parsed?.draft.version).toBe(PUBLISHER_DRAFT_VERSION);
    });
});
