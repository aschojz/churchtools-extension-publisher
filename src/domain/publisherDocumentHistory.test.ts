import { describe, expect, it } from 'vitest';

import { cloneLayoutState } from './layoutHistory';
import { createBlankPublisherPage } from './publisherPage';
import {
    clonePublisherDocumentSnapshot,
    commitPublisherDocumentHistory,
    createPublisherDocumentHistory,
    MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH,
    recordPublisherDocumentHistorySnapshot,
    recordPublisherPageLayoutHistory,
    redoPublisherDocumentHistory,
    undoPublisherDocumentHistory,
    type PublisherDocumentSnapshot,
} from './publisherDocumentHistory';

const createSnapshot = (name = 'Seite 1'): PublisherDocumentSnapshot => {
    const page = createBlankPublisherPage(1920, 1080, 'split', name);
    return { pages: [page], activePageId: page.id };
};

describe('publisher document history', () => {
    it('clones pages deeply', () => {
        const snapshot = createSnapshot();
        const clone = clonePublisherDocumentSnapshot(snapshot);

        clone.pages[0]!.name = 'Geändert';
        clone.pages[0]!.layouts.split!.offsets.title = { x: 80, y: 40 };

        expect(snapshot.pages[0]!.name).toBe('Seite 1');
        expect(snapshot.pages[0]!.layouts.split!.offsets.title).toEqual({ x: 0, y: 0 });
    });

    it('undoes and redoes complete multi-page snapshots', () => {
        const previous = createSnapshot();
        const nextPage = createBlankPublisherPage(600, 600, 'poster', 'Quadrat');
        const current = {
            pages: [...previous.pages, nextPage],
            activePageId: nextPage.id,
        };
        const history = commitPublisherDocumentHistory(createPublisherDocumentHistory(), previous, current);

        const undone = undoPublisherDocumentHistory(history, current)!;
        expect(undone.entry).toMatchObject({ kind: 'document' });
        if (undone.entry.kind !== 'document') throw new Error('Expected a document snapshot.');
        expect(undone.entry.snapshot.pages).toHaveLength(1);
        expect(undone.entry.snapshot.activePageId).toBe(previous.activePageId);

        const redone = redoPublisherDocumentHistory(undone.history, undone.entry.snapshot)!;
        expect(redone.entry).toMatchObject({ kind: 'document' });
        if (redone.entry.kind !== 'document') throw new Error('Expected a document snapshot.');
        expect(redone.entry.snapshot.pages.map(({ name }) => name)).toEqual(['Seite 1', 'Quadrat']);
        expect(redone.entry.snapshot.activePageId).toBe(nextPage.id);
    });

    it('does not record unchanged snapshots', () => {
        const snapshot = createSnapshot();
        const history = commitPublisherDocumentHistory(
            createPublisherDocumentHistory(),
            snapshot,
            clonePublisherDocumentSnapshot(snapshot),
        );

        expect(history).toEqual({ past: [], future: [] });
    });

    it('takes ownership of an already detached snapshot without cloning it again', () => {
        const snapshot = createSnapshot();
        const history = recordPublisherDocumentHistorySnapshot(createPublisherDocumentHistory(), snapshot);

        expect(history.past[0]).toEqual({ kind: 'document', snapshot });
        expect(history.past[0]?.kind === 'document' && history.past[0].snapshot).toBe(snapshot);
        expect(history.future).toEqual([]);
    });

    it('stores and navigates a page-layout change without full document snapshots', () => {
        const current = createSnapshot();
        const page = current.pages[0]!;
        const previousState = cloneLayoutState(page.layouts.split!);
        page.layouts.split!.offsets.title = { x: 80, y: 40 };
        const history = recordPublisherPageLayoutHistory(
            createPublisherDocumentHistory(),
            page.id,
            'split',
            previousState,
            page.id,
        );

        expect(history.past[0]).toMatchObject({ kind: 'page-layout', pageId: page.id });
        const undone = undoPublisherDocumentHistory(history, clonePublisherDocumentSnapshot(current))!;
        expect(undone.entry.kind).toBe('page-layout');
        if (undone.entry.kind !== 'page-layout') throw new Error('Expected a page-layout entry.');
        expect(undone.entry.state.offsets.title).toEqual({ x: 0, y: 0 });

        const restored = clonePublisherDocumentSnapshot(current);
        restored.pages[0]!.layouts.split = cloneLayoutState(undone.entry.state);
        const redone = redoPublisherDocumentHistory(undone.history, restored)!;
        expect(redone.entry.kind).toBe('page-layout');
        if (redone.entry.kind !== 'page-layout') throw new Error('Expected a page-layout entry.');
        expect(redone.entry.state.offsets.title).toEqual({ x: 80, y: 40 });
    });

    it('keeps only the most recent snapshots', () => {
        let history = createPublisherDocumentHistory();
        let current = createSnapshot('Seite 0');

        for (let index = 1; index <= MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH + 4; index += 1) {
            const next = clonePublisherDocumentSnapshot(current);
            next.pages[0]!.name = `Seite ${index}`;
            history = commitPublisherDocumentHistory(history, current, next);
            current = next;
        }

        expect(history.past).toHaveLength(MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH);
        const firstEntry = history.past[0]!;
        expect(firstEntry.kind).toBe('document');
        if (firstEntry.kind !== 'document') throw new Error('Expected a document snapshot.');
        expect(firstEntry.snapshot.pages[0]!.name).toBe('Seite 4');
    });
});
