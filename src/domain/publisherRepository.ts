import { parsePublisherDesignTemplate, type PublisherDesignTemplate } from './publisherDesignTemplate';
import { parsePublisherDraft, type PublisherDraft } from './publisherDraft';

export const PUBLISHER_RECORD_VERSION = 1;

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
    if (!isRecord(value) || value.version !== PUBLISHER_RECORD_VERSION || typeof value.id !== 'string' || !value.id ||
        typeof value.name !== 'string' || !value.name.trim() || typeof value.revision !== 'number' ||
        !Number.isInteger(value.revision) || value.revision < 0 || typeof value.createdAt !== 'string' ||
        typeof value.updatedAt !== 'string') return null;
    let appointment: PublisherAppointmentReference | null = null;
    if (value.appointment !== null) {
        if (!isRecord(value.appointment) || typeof value.appointment.appointmentId !== 'number' ||
            !Number.isInteger(value.appointment.appointmentId) || value.appointment.appointmentId <= 0 ||
            typeof value.appointment.occurrenceStart !== 'string' || !value.appointment.occurrenceStart) return null;
        appointment = {
            appointmentId: value.appointment.appointmentId,
            occurrenceStart: value.appointment.occurrenceStart,
        };
    }
    const draft = parsePublisherDraft(JSON.stringify(value.draft));
    if (!draft) return null;
    return {
        version: PUBLISHER_RECORD_VERSION,
        id: value.id,
        name: value.name.trim(),
        revision: value.revision,
        appointment,
        draft,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
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
