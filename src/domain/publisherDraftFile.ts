import { parsePublisherDraft, type PublisherDraft } from './publisherDraft';

export const PUBLISHER_DRAFT_FILE_FORMAT = 'churchtools-publisher-draft';
export const PUBLISHER_DRAFT_FILE_VERSION = 1;

export interface PublisherDraftFile {
    format: typeof PUBLISHER_DRAFT_FILE_FORMAT;
    fileVersion: typeof PUBLISHER_DRAFT_FILE_VERSION;
    sourceAppointmentKey: string;
    exportedAt: string;
    draft: PublisherDraft;
}

export const createPublisherDraftFile = (
    sourceAppointmentKey: string,
    draft: PublisherDraft,
): PublisherDraftFile => ({
    format: PUBLISHER_DRAFT_FILE_FORMAT,
    fileVersion: PUBLISHER_DRAFT_FILE_VERSION,
    sourceAppointmentKey,
    exportedAt: new Date().toISOString(),
    draft,
});

export const serializePublisherDraftFile = (file: PublisherDraftFile) =>
    JSON.stringify(file, null, 2);

export const belongsToAppointment = (
    file: PublisherDraftFile,
    appointmentKey: string,
) => file.sourceAppointmentKey === appointmentKey;

export const parsePublisherDraftFile = (value: string): PublisherDraftFile | null => {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const candidate = parsed as Record<string, unknown>;
        if (candidate.format !== PUBLISHER_DRAFT_FILE_FORMAT ||
            candidate.fileVersion !== PUBLISHER_DRAFT_FILE_VERSION ||
            typeof candidate.sourceAppointmentKey !== 'string' || !candidate.sourceAppointmentKey ||
            typeof candidate.exportedAt !== 'string') {
            return null;
        }

        const draft = parsePublisherDraft(JSON.stringify(candidate.draft));
        if (!draft) {
            return null;
        }

        return {
            format: PUBLISHER_DRAFT_FILE_FORMAT,
            fileVersion: PUBLISHER_DRAFT_FILE_VERSION,
            sourceAppointmentKey: candidate.sourceAppointmentKey,
            exportedAt: candidate.exportedAt,
            draft,
        };
    } catch {
        return null;
    }
};
