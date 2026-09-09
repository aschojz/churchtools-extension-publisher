import type {
    ApiError,
    CustomModule,
    CustomModuleDataCategory,
    CustomModuleDataCategoryCreate,
    CustomModuleDataValue,
    CustomModuleDataValueCreate,
} from '@churchtools/api-types';

import {
    PUBLISHER_RECORD_VERSION,
    PublisherRepositoryError,
    parsePublisherDocumentRecord,
    parsePublisherTemplateRecord,
    type PublisherRepository,
} from '../domain/publisherRepository';

export interface PublisherCcmClient {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    put<T>(path: string, body: unknown): Promise<T>;
    deleteApi(path: string): Promise<unknown>;
}

type EntityKind = 'document' | 'template';

interface StoredEnvelope {
    envelopeVersion: 1 | 2;
    entityKind: EntityKind;
    entityId: string;
    revision: number;
    payload: unknown;
}

const CATEGORY_DEFINITIONS = {
    document: {
        shorty: 'publisher_documents',
        name: 'Publisher-Dokumente',
        description: 'Gespeicherte Arbeitsdokumente des Publishers',
    },
    template: {
        shorty: 'publisher_templates',
        name: 'Publisher-Vorlagen',
        description: 'Terminunabhängige Dokumentvorlagen des Publishers',
    },
} as const;

const apiStatus = (error: unknown) =>
    typeof error === 'object' && error !== null && 'response' in error
        ? (error as ApiError).response?.status
        : undefined;

const repositoryError = (error: unknown, fallback: string) => {
    if (error instanceof PublisherRepositoryError) return error;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return new PublisherRepositoryError('offline', 'ChurchTools ist derzeit nicht erreichbar.', { cause: error });
    }
    const status = apiStatus(error);
    if (status === 401 || status === 403) {
        return new PublisherRepositoryError('permission', 'Für diesen Speicherbereich fehlt die Berechtigung.', { cause: error });
    }
    if (status === 409 || status === 412) {
        return new PublisherRepositoryError('conflict', 'Der Datensatz wurde zwischenzeitlich geändert.', { cause: error });
    }
    return new PublisherRepositoryError('unavailable', fallback, { cause: error });
};

const parseEnvelope = (value: string): StoredEnvelope | null => {
    try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
        const candidate = parsed as Partial<StoredEnvelope>;
        if ((candidate.envelopeVersion !== 1 && candidate.envelopeVersion !== 2) || !['document', 'template'].includes(String(candidate.entityKind)) ||
            typeof candidate.entityId !== 'string' || !candidate.entityId || typeof candidate.revision !== 'number' ||
            !Number.isInteger(candidate.revision) || candidate.revision < 1) return null;
        return candidate as StoredEnvelope;
    } catch {
        return null;
    }
};

export const createCcmPublisherRepository = (
    client: PublisherCcmClient,
    moduleShorty: string,
): PublisherRepository => {
    let modulePromise: Promise<CustomModule> | null = null;
    let categoriesPromise: Promise<CustomModuleDataCategory[]> | null = null;
    const templateRevisions = new Map<string, number>();

    const getModule = async () => {
        modulePromise ??= client.get<CustomModule[]>('/custommodules').then((modules) => {
            const module = modules.find(({ shorty }) => shorty === moduleShorty);
            if (!module) {
                throw new PublisherRepositoryError(
                    'unavailable',
                    `Das Custom Module „${moduleShorty}“ wurde nicht gefunden.`,
                );
            }
            return module;
        });
        try {
            return await modulePromise;
        } catch (error) {
            modulePromise = null;
            throw error;
        }
    };

    const getCategories = async (refresh = false) => {
        if (refresh) categoriesPromise = null;
        const module = await getModule();
        categoriesPromise ??= client.get<CustomModuleDataCategory[]>(
            `/custommodules/${module.id}/customdatacategories`,
        );
        try {
            return await categoriesPromise;
        } catch (error) {
            categoriesPromise = null;
            throw error;
        }
    };

    const categoryFor = async (kind: EntityKind, create: boolean) => {
        const definition = CATEGORY_DEFINITIONS[kind];
        const existing = (await getCategories()).find(({ shorty }) => shorty === definition.shorty);
        if (existing || !create) return existing;
        const module = await getModule();
        const payload: CustomModuleDataCategoryCreate = {
            customModuleId: module.id,
            ...definition,
            data: JSON.stringify({ publisherSchemaVersion: PUBLISHER_RECORD_VERSION, entityKind: kind }),
        };
        const created = await client.post<CustomModuleDataCategory>(
            `/custommodules/${module.id}/customdatacategories`,
            payload,
        );
        await getCategories(true);
        return created;
    };

    const valuesFor = async (kind: EntityKind, createCategory = false) => {
        const module = await getModule();
        const category = await categoryFor(kind, createCategory);
        if (!category) return { category: null, values: [] as CustomModuleDataValue[] };
        const values = await client.get<CustomModuleDataValue[]>(
            `/custommodules/${module.id}/customdatacategories/${category.id}/customdatavalues`,
        );
        return { category, values };
    };

    const saveEnvelope = async (kind: EntityKind, entityId: string, revision: number, payload: unknown) => {
        const module = await getModule();
        const { category, values } = await valuesFor(kind, true);
        if (!category) throw new PublisherRepositoryError('unavailable', 'Der Speicherbereich konnte nicht angelegt werden.');
        const existingValue = values.find(({ value }) => parseEnvelope(value)?.entityId === entityId);
        const existingEnvelope = existingValue ? parseEnvelope(existingValue.value) : null;
        const serverRevision = existingEnvelope?.revision ?? 0;
        if (serverRevision !== revision) {
            throw new PublisherRepositoryError('conflict', 'Der Datensatz wurde in einer anderen Sitzung geändert.');
        }
        const envelope: StoredEnvelope = {
            envelopeVersion: 2,
            entityKind: kind,
            entityId,
            revision: revision + 1,
            payload,
        };
        const path = `/custommodules/${module.id}/customdatacategories/${category.id}/customdatavalues`;
        if (existingValue) {
            await client.put<CustomModuleDataValue>(`${path}/${existingValue.id}`, {
                id: existingValue.id,
                dataCategoryId: category.id,
                value: JSON.stringify(envelope),
            });
        } else {
            const body: CustomModuleDataValueCreate = {
                dataCategoryId: category.id,
                value: JSON.stringify(envelope),
            };
            await client.post<CustomModuleDataValue>(path, body);
        }
        return envelope.revision;
    };

    const deleteEntity = async (kind: EntityKind, entityId: string) => {
        const module = await getModule();
        const { category, values } = await valuesFor(kind);
        if (!category) return;
        const existing = values.find(({ value }) => parseEnvelope(value)?.entityId === entityId);
        if (!existing) return;
        await client.deleteApi(
            `/custommodules/${module.id}/customdatacategories/${category.id}/customdatavalues/${existing.id}`,
        );
    };

    return {
        async listDocuments() {
            try {
                const { values } = await valuesFor('document');
                return values.flatMap(({ value }) => {
                    const envelope = parseEnvelope(value);
                    if (!envelope || envelope.entityKind !== 'document') return [];
                    const record = parsePublisherDocumentRecord(envelope.payload);
                    if (!record || record.id !== envelope.entityId) return [];
                    return [{ ...record, revision: envelope.revision }];
                }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
            } catch (error) {
                throw repositoryError(error, 'Dokumente konnten nicht aus ChurchTools geladen werden.');
            }
        },
        async saveDocument(document) {
            try {
                const parsed = parsePublisherDocumentRecord(document);
                if (!parsed) throw new PublisherRepositoryError('invalid', 'Das Dokument enthält ungültige Daten.');
                const nextRevision = await saveEnvelope('document', parsed.id, parsed.revision, parsed);
                return { ...parsed, revision: nextRevision };
            } catch (error) {
                throw repositoryError(error, 'Das Dokument konnte nicht in ChurchTools gespeichert werden.');
            }
        },
        async deleteDocument(documentId) {
            try {
                await deleteEntity('document', documentId);
            } catch (error) {
                throw repositoryError(error, 'Das Dokument konnte nicht gelöscht werden.');
            }
        },
        async listTemplates() {
            try {
                const { values } = await valuesFor('template');
                return values.flatMap(({ value }) => {
                    const envelope = parseEnvelope(value);
                    if (!envelope || envelope.entityKind !== 'template') return [];
                    const template = parsePublisherTemplateRecord(envelope.payload);
                    if (!template || template.id !== envelope.entityId) return [];
                    templateRevisions.set(template.id, envelope.revision);
                    return [template];
                }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
            } catch (error) {
                throw repositoryError(error, 'Vorlagen konnten nicht aus ChurchTools geladen werden.');
            }
        },
        async saveTemplate(template) {
            try {
                const parsed = parsePublisherTemplateRecord(template);
                if (!parsed) throw new PublisherRepositoryError('invalid', 'Die Vorlage enthält ungültige Daten.');
                const revision = templateRevisions.get(parsed.id) ?? 0;
                const nextRevision = await saveEnvelope('template', parsed.id, revision, parsed);
                templateRevisions.set(parsed.id, nextRevision);
                return parsed;
            } catch (error) {
                throw repositoryError(error, 'Die Vorlage konnte nicht in ChurchTools gespeichert werden.');
            }
        },
        async deleteTemplate(templateId) {
            try {
                await deleteEntity('template', templateId);
                templateRevisions.delete(templateId);
            } catch (error) {
                throw repositoryError(error, 'Die Vorlage konnte nicht gelöscht werden.');
            }
        },
    };
};
