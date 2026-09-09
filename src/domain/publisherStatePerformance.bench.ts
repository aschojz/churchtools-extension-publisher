import { bench, describe } from 'vitest';

import {
    createCustomTextStyle,
    createCustomVisualStyle,
    createLayoutElementEffects,
    type LayoutCustomElement,
    type LayoutElementId,
    type LayoutGroup,
} from './layoutEditing';
import { cloneLayoutState } from './layoutHistory';
import { clonePublisherPage, createBlankPublisherPage, type PublisherPage } from './publisherPage';
import {
    clonePublisherDocumentSnapshot,
    commitPublisherDocumentHistory,
    createPublisherDocumentHistory,
    type PublisherDocumentSnapshot,
} from './publisherDocumentHistory';
import { PUBLISHER_DRAFT_VERSION, type PublisherDraft } from './publisherDraft';
import { savePublisherRecovery } from './publisherRecovery';
import { PUBLISHER_RECORD_VERSION, type PublisherDocumentRecord } from './publisherRepository';

const PAGE_COUNT = 16;
const ELEMENTS_PER_PAGE = 96;

const fillLargeLayout = (page: PublisherPage, pageIndex: number) => {
    const layout = page.layouts[page.templateId]!;
    const elements: LayoutCustomElement[] = [];
    const groups: LayoutGroup[] = [];

    for (let elementIndex = 0; elementIndex < ELEMENTS_PER_PAGE; elementIndex += 1) {
        const text = elementIndex % 3 !== 2;
        const id = `${text ? 'text' : 'shape-rectangle'}-benchmark-${pageIndex}-${elementIndex}` as LayoutElementId;
        const frame = {
            x: elementIndex % 8 * 220,
            y: Math.floor(elementIndex / 8) * 82,
            width: text ? 200 : 180,
            height: text ? 64 : 56,
        };
        elements.push({
            id,
            kind: text ? 'text' : 'rectangle',
            name: `Element ${pageIndex + 1}.${elementIndex + 1}`,
            frame,
            ...(text ? {
                text: `{{title | fallback:Termin}} · wiederverwendbarer Inhalt ${elementIndex + 1}`,
                textMode: 'frame' as const,
                dataBinding: 'title',
            } : {}),
        });
        layout.offsets[id] = { x: 0, y: 0 };
        layout.sizes[id] = { width: frame.width, height: frame.height };
        layout.rotations[id] = elementIndex % 9 === 0 ? 3 : 0;
        layout.order.push(id);
        if (text) layout.styles[id] = createCustomTextStyle(elementIndex % 2 ? '#f8fafc' : '#dbeafe');
        else layout.visualStyles[id] = createCustomVisualStyle(elementIndex % 2 ? '#2563eb' : '#0f766e');
        if (elementIndex % 12 === 0) {
            layout.effects![id] = {
                ...createLayoutElementEffects(),
                shadow: {
                    ...createLayoutElementEffects().shadow,
                    enabled: true,
                },
            };
        }
    }

    for (let groupIndex = 0; groupIndex < ELEMENTS_PER_PAGE / 12; groupIndex += 1) {
        groups.push({
            id: `group-benchmark-${pageIndex}-${groupIndex}`,
            children: elements.slice(groupIndex * 12, groupIndex * 12 + 12).map(({ id }) => id),
            rotation: groupIndex % 2 ? 0 : 2,
            autoLayout: {
                axis: 'vertical',
                gap: 8,
                horizontalOrigin: 'left',
                verticalOrigin: 'top',
                anchor: { x: groupIndex * 24, y: groupIndex * 32 },
            },
        });
    }

    layout.customElements = elements;
    layout.groups = groups;
};

const createLargeSnapshot = (): PublisherDocumentSnapshot => {
    const pages = Array.from({ length: PAGE_COUNT }, (_, pageIndex) => {
        const page = createBlankPublisherPage(
            pageIndex % 2 ? 1080 : 1920,
            pageIndex % 2 ? 1080 : 1080,
            'split',
            `Seite ${pageIndex + 1}`,
        );
        page.id = `benchmark-page-${pageIndex + 1}`;
        fillLargeLayout(page, pageIndex);
        return page;
    });
    return { pages, activePageId: pages[0]!.id };
};

const createLargeRecord = (snapshot: PublisherDocumentSnapshot): PublisherDocumentRecord => {
    const pages = snapshot.pages.map((page) => clonePublisherPage(page));
    const firstPage = pages[0]!;
    const draft: PublisherDraft = {
        version: PUBLISHER_DRAFT_VERSION,
        selectedTemplateId: firstPage.templateId,
        templateOverrides: {},
        layouts: Object.fromEntries(Object.entries(firstPage.layouts).map(([id, layout]) => [
            id,
            layout ? cloneLayoutState(layout) : layout,
        ])),
        imageFocus: structuredClone(firstPage.imageFocus),
        snapEnabled: true,
        previewZoomPercent: 100,
        updatedAt: '2026-09-09T12:00:00.000Z',
        pages,
        activePageId: firstPage.id,
    };
    return {
        version: PUBLISHER_RECORD_VERSION,
        id: 'benchmark-document',
        name: 'Großes Benchmark-Dokument',
        revision: 0,
        appointment: null,
        draft,
        createdAt: draft.updatedAt,
        updatedAt: draft.updatedAt,
    };
};

const snapshot = createLargeSnapshot();
const changedSnapshot = clonePublisherDocumentSnapshot(snapshot);
changedSnapshot.pages[0]!.layouts.split!.offsets[changedSnapshot.pages[0]!.layouts.split!.order[0]!] = { x: 1, y: 0 };
const record = createLargeRecord(snapshot);
let serializedRecovery = '';
const storage = { setItem: (_key: string, value: string) => { serializedRecovery = value; } };

describe(`publisher state (${PAGE_COUNT} pages × ${ELEMENTS_PER_PAGE} elements)`, () => {
    bench('clone complete document snapshot', () => {
        clonePublisherDocumentSnapshot(snapshot);
    }, { time: 500, iterations: 5 });

    bench('commit one changed complete-document history snapshot', () => {
        commitPublisherDocumentHistory(createPublisherDocumentHistory(), snapshot, changedSnapshot);
    }, { time: 500, iterations: 5 });

    bench('serialize complete recovery document', () => {
        savePublisherRecovery(storage, record);
        if (!serializedRecovery) throw new Error('Recovery serialization failed.');
    }, { time: 500, iterations: 5 });
});
