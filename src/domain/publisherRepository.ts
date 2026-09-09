import { parsePublisherDesignTemplate, type PublisherDesignTemplate } from './publisherDesignTemplate';
import { parsePublisherDraft, type PublisherDraft } from './publisherDraft';

export const PUBLISHER_RECORD_VERSION = 3;

export interface PublisherAppointmentReference {
    appointmentId: number;
    occurrenceStart: string;
}

export interface PublisherDocumentRecord {
    version: typeof PUBLISHER_RECORD_VERSION;
    id: string;
    name: string;
    revision: number;
    appointment: PublisherAppointmentReference | null;
    draft: PublisherDraft;
    createdAt: string;
    updatedAt: string;
}

export interface PublisherRepository {
    listDocuments(): Promise<PublisherDocumentRecord[]>;
    saveDocument(document: PublisherDocumentRecord): Promise<PublisherDocumentRecord>;
    deleteDocument(documentId: string): Promise<void>;
    listTemplates(): Promise<PublisherDesignTemplate[]>;
    saveTemplate(template: PublisherDesignTemplate): Promise<PublisherDesignTemplate>;
    deleteTemplate(templateId: string): Promise<void>;
}

export type PublisherRepositoryErrorCode =
    | 'conflict'
    | 'invalid'
    | 'offline'
    | 'permission'
    | 'unavailable';

export class PublisherRepositoryError extends Error {
    constructor(
        public readonly code: PublisherRepositoryErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'PublisherRepositoryError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const createPublisherRecordId = () =>
    typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `publisher-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const appointmentReferenceFromKey = (appointmentKey: string): PublisherAppointmentReference | null => {
    const separatorIndex = appointmentKey.indexOf(':');
    if (separatorIndex <= 0) return null;
    const appointmentId = Number(appointmentKey.slice(0, separatorIndex));
    const occurrenceStart = appointmentKey.slice(separatorIndex + 1);
    if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !occurrenceStart) return null;
    return { appointmentId, occurrenceStart };
};

export const appointmentKeyFromReference = (reference: PublisherAppointmentReference | null) =>
    reference ? `${reference.appointmentId}:${reference.occurrenceStart}` : '';

export const parsePublisherDocumentRecord = (value: unknown): PublisherDocumentRecord | null => {
    if (!isRecord(value) || ![1, 2, PUBLISHER_RECORD_VERSION].includes(Number(value.version))) return null;
    const candidate = value.version === PUBLISHER_RECORD_VERSION
        ? value
        : { ...value, version: PUBLISHER_RECORD_VERSION };
    if (typeof candidate.id !== 'string' || !candidate.id ||
        typeof candidate.name !== 'string' || !candidate.name.trim() || typeof candidate.revision !== 'number' ||
        !Number.isInteger(candidate.revision) || candidate.revision < 0 || typeof candidate.createdAt !== 'string' ||
        typeof candidate.updatedAt !== 'string') return null;
    let appointment: PublisherAppointmentReference | null = null;
    if (candidate.appointment !== null) {
        if (!isRecord(candidate.appointment) || typeof candidate.appointment.appointmentId !== 'number' ||
            !Number.isInteger(candidate.appointment.appointmentId) || candidate.appointment.appointmentId <= 0 ||
            typeof candidate.appointment.occurrenceStart !== 'string' || !candidate.appointment.occurrenceStart) return null;
        appointment = {
            appointmentId: candidate.appointment.appointmentId,
            occurrenceStart: candidate.appointment.occurrenceStart,
        };
    }
    const draft = parsePublisherDraft(JSON.stringify(candidate.draft));
    if (!draft) return null;
    return {
        version: PUBLISHER_RECORD_VERSION,
        id: candidate.id,
        name: candidate.name.trim(),
        revision: candidate.revision,
        appointment,
        draft,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
    };
};

export const parsePublisherTemplateRecord = (value: unknown) => parsePublisherDesignTemplate(value);

export const createMemoryPublisherRepository = (): PublisherRepository => {
    let documents: PublisherDocumentRecord[] = [];
    let templates: PublisherDesignTemplate[] = [];
    return {
        async listDocuments() {
            return structuredClone(documents);
        },
        async saveDocument(document) {
            const existing = documents.find(({ id }) => id === document.id);
            if (existing && existing.revision !== document.revision) {
                throw new PublisherRepositoryError('conflict', 'Das Dokument wurde zwischenzeitlich geändert.');
            }
            const saved = structuredClone({ ...document, revision: document.revision + 1 });
            documents = [saved, ...documents.filter(({ id }) => id !== saved.id)];
            return structuredClone(saved);
        },
        async deleteDocument(documentId) {
            documents = documents.filter(({ id }) => id !== documentId);
        },
        async listTemplates() {
            return structuredClone(templates);
        },
        async saveTemplate(template) {
            const saved = structuredClone(template);
            templates = [saved, ...templates.filter(({ id }) => id !== saved.id)];
            return structuredClone(saved);
        },
        async deleteTemplate(templateId) {
            templates = templates.filter(({ id }) => id !== templateId);
        },
    };
};
