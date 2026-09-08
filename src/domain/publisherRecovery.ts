import { parsePublisherDocumentRecord, type PublisherDocumentRecord } from './publisherRepository';

export const PUBLISHER_RECOVERY_STORAGE_KEY = 'churchtools-publisher:recovery';

interface PublisherRecoveryEnvelope {
    version: 1;
    document: PublisherDocumentRecord;
}

export const loadPublisherRecovery = (storage: Pick<Storage, 'getItem'>) => {
    const raw = storage.getItem(PUBLISHER_RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
        const envelope = parsed as Partial<PublisherRecoveryEnvelope>;
        if (envelope.version !== 1) return null;
        return parsePublisherDocumentRecord(envelope.document);
    } catch {
        return null;
    }
};

export const savePublisherRecovery = (
    storage: Pick<Storage, 'setItem'>,
    document: PublisherDocumentRecord,
) => {
    const envelope: PublisherRecoveryEnvelope = { version: 1, document };
    storage.setItem(PUBLISHER_RECOVERY_STORAGE_KEY, JSON.stringify(envelope));
};

export const clearPublisherRecovery = (storage: Pick<Storage, 'removeItem'>) =>
    storage.removeItem(PUBLISHER_RECOVERY_STORAGE_KEY);
