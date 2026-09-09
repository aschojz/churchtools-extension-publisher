import { clonePublisherPage, type PublisherPage } from './publisherPage';

export interface PublisherDocumentSnapshot {
    pages: PublisherPage[];
    activePageId: string;
}

export interface PublisherDocumentHistory {
    past: PublisherDocumentSnapshot[];
    future: PublisherDocumentSnapshot[];
}

export const MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH = 50;

export const createPublisherDocumentHistory = (): PublisherDocumentHistory => ({ past: [], future: [] });

export const clonePublisherDocumentSnapshot = (
    snapshot: PublisherDocumentSnapshot,
): PublisherDocumentSnapshot => ({
    pages: snapshot.pages.map((page) => clonePublisherPage(page)),
    activePageId: snapshot.activePageId,
});

const publisherDocumentSnapshotsEqual = (
    left: PublisherDocumentSnapshot,
    right: PublisherDocumentSnapshot,
) => JSON.stringify(left) === JSON.stringify(right);

export const commitPublisherDocumentHistory = (
    history: PublisherDocumentHistory,
    previousSnapshot: PublisherDocumentSnapshot,
    currentSnapshot: PublisherDocumentSnapshot,
): PublisherDocumentHistory => {
    if (publisherDocumentSnapshotsEqual(previousSnapshot, currentSnapshot)) return history;

    return {
        past: [
            ...history.past,
            clonePublisherDocumentSnapshot(previousSnapshot),
        ].slice(-MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
        future: [],
    };
};

export const undoPublisherDocumentHistory = (
    history: PublisherDocumentHistory,
    currentSnapshot: PublisherDocumentSnapshot,
): { history: PublisherDocumentHistory; snapshot: PublisherDocumentSnapshot } | null => {
    const snapshot = history.past.at(-1);
    if (!snapshot) return null;

    return {
        history: {
            past: history.past.slice(0, -1),
            future: [
                clonePublisherDocumentSnapshot(currentSnapshot),
                ...history.future,
            ].slice(0, MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
        },
        snapshot: clonePublisherDocumentSnapshot(snapshot),
    };
};

export const redoPublisherDocumentHistory = (
    history: PublisherDocumentHistory,
    currentSnapshot: PublisherDocumentSnapshot,
): { history: PublisherDocumentHistory; snapshot: PublisherDocumentSnapshot } | null => {
    const [snapshot, ...remainingFuture] = history.future;
    if (!snapshot) return null;

    return {
        history: {
            past: [
                ...history.past,
                clonePublisherDocumentSnapshot(currentSnapshot),
            ].slice(-MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
            future: remainingFuture,
        },
        snapshot: clonePublisherDocumentSnapshot(snapshot),
    };
};
