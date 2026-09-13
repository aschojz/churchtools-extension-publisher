import type { CustomModuleDataCategory, CustomModuleDataValue } from '../utils/ct-types';
import { describe, expect, it } from 'vitest';

import { createImageFocusByTemplate } from '../domain/imageFocus';
import { createBlankPublisherPage } from '../domain/publisherPage';
import type { PublisherDesignTemplate } from '../domain/publisherDesignTemplate';
import { PUBLISHER_RECORD_VERSION, type PublisherDocumentRecord } from '../domain/publisherRepository';
import { PUBLISHER_DRAFT_VERSION, type PublisherDraft } from '../domain/publisherDraft';
import { createCcmPublisherRepository, type PublisherCcmClient } from './ccmPublisherRepository';

const draft = (): PublisherDraft => ({
    version: PUBLISHER_DRAFT_VERSION,
    selectedTemplateId: 'split',
    templateOverrides: {},
    layouts: {},
    imageFocus: createImageFocusByTemplate(),
    snapEnabled: true,
    previewZoomPercent: 100,
    updatedAt: '2026-09-07T10:00:00.000Z',
});

const documentRecord = (): PublisherDocumentRecord => ({
    version: PUBLISHER_RECORD_VERSION,
    id: 'document-1',
    name: 'Freies Dokument',
    revision: 0,
    appointment: null,
    draft: draft(),
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T10:00:00.000Z',
});

const template = (): PublisherDesignTemplate => {
    const page = createBlankPublisherPage();
    return {
        id: 'template-1',
        name: 'Vorlage',
        pages: [page],
        activePageId: page.id,
        createdAt: '2026-09-07T10:00:00.000Z',
        updatedAt: '2026-09-07T10:00:00.000Z',
    };
};

const createClient = () => {
    const categories: CustomModuleDataCategory[] = [];
    const values = new Map<number, CustomModuleDataValue[]>();
    let nextCategoryId = 10;
    let nextValueId = 100;
    const client: PublisherCcmClient = {
        async get<T>(path: string) {
            if (path === '/custommodules') return [{ id: 7, shorty: 'publisher', name: 'Publisher' }] as T;
            if (path === '/custommodules/7/customdatacategories') return structuredClone(categories) as T;
            const categoryId = Number(path.match(/customdatacategories\/(\d+)\/customdatavalues$/)?.[1]);
            if (categoryId) return structuredClone(values.get(categoryId) ?? []) as T;
            throw new Error(`Unexpected GET ${path}`);
        },
        async post<T>(path: string, body: unknown) {
            if (path === '/custommodules/7/customdatacategories') {
                const category = { ...(body as CustomModuleDataCategory), id: nextCategoryId++ };
                categories.push(category);
                values.set(category.id, []);
                return structuredClone(category) as T;
            }
            const categoryId = Number(path.match(/customdatacategories\/(\d+)\/customdatavalues$/)?.[1]);
            if (categoryId) {
                const value = { ...(body as CustomModuleDataValue), id: nextValueId++ };
                values.get(categoryId)!.push(value);
                return structuredClone(value) as T;
            }
            throw new Error(`Unexpected POST ${path}`);
        },
        async put<T>(path: string, body: unknown) {
            const match = path.match(/customdatacategories\/(\d+)\/customdatavalues\/(\d+)$/);
            if (!match) throw new Error(`Unexpected PUT ${path}`);
            const [categoryId, valueId] = [Number(match[1]), Number(match[2])];
            const list = values.get(categoryId)!;
            list.splice(list.findIndex(({ id }) => id === valueId), 1, body as CustomModuleDataValue);
            return structuredClone(body) as T;
        },
        async deleteApi(path: string) {
            const match = path.match(/customdatacategories\/(\d+)\/customdatavalues\/(\d+)$/);
            if (!match) throw new Error(`Unexpected DELETE ${path}`);
            const [categoryId, valueId] = [Number(match[1]), Number(match[2])];
            values.set(categoryId, values.get(categoryId)!.filter(({ id }) => id !== valueId));
        },
    };
    return { categories, client, values };
};

describe('CCM publisher repository', () => {
    it('creates separate categories and persists documents and termin-neutral templates', async () => {
        const { categories, client, values } = createClient();
        const repository = createCcmPublisherRepository(client, 'publisher');

        const savedDocument = await repository.saveDocument(documentRecord());
        await repository.saveTemplate(template());

        expect(savedDocument.revision).toBe(1);
        expect(categories.map(({ shorty }) => shorty)).toEqual(['publisher_documents', 'publisher_templates']);
        expect([...values.values()].flatMap((entries) => entries).map(({ value }) => JSON.parse(value).envelopeVersion))
            .toEqual([2, 2]);
        expect(await repository.listDocuments()).toEqual([savedDocument]);
        expect((await repository.listTemplates())[0]).not.toHaveProperty('appointment');
    });

    it('isolates malformed values and detects remote revision conflicts', async () => {
        const { client, values } = createClient();
        const repository = createCcmPublisherRepository(client, 'publisher');
        const saved = await repository.saveDocument(documentRecord());
        const documentValues = [...values.values()][0]!;
        documentValues.push({ id: 999, dataCategoryId: documentValues[0]!.dataCategoryId, value: '{broken' });
        const envelope = JSON.parse(documentValues[0]!.value) as { revision: number };
        envelope.revision += 1;
        documentValues[0]!.value = JSON.stringify(envelope);

        expect(await repository.listDocuments()).toHaveLength(1);
        await expect(repository.saveDocument(saved)).rejects.toMatchObject({ code: 'conflict' });
    });

    it('maps CCM permission errors to a stable repository error', async () => {
        const deniedClient: PublisherCcmClient = {
            async get() {
                throw { response: { status: 403, data: { message: 'Forbidden' } } };
            },
            async post() { throw new Error('unexpected'); },
            async put() { throw new Error('unexpected'); },
            async deleteApi() { throw new Error('unexpected'); },
        };
        const repository = createCcmPublisherRepository(deniedClient, 'publisher');

        await expect(repository.listDocuments()).rejects.toMatchObject({ code: 'permission' });
    });
});
