import { describe, expect, it } from 'vitest';

import { createBlankPublisherPage } from './publisherPage';
import {
    clonePublisherDocumentSnapshot,
    commitPublisherDocumentHistory,
    createPublisherDocumentHistory,
    MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH,
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
        expect(undone.snapshot.pages).toHaveLength(1);
        expect(undone.snapshot.activePageId).toBe(previous.activePageId);

        const redone = redoPublisherDocumentHistory(undone.history, undone.snapshot)!;
        expect(redone.snapshot.pages.map(({ name }) => name)).toEqual(['Seite 1', 'Quadrat']);
        expect(redone.snapshot.activePageId).toBe(nextPage.id);
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
        expect(history.past[0]!.pages[0]!.name).toBe('Seite 4');
    });
});
