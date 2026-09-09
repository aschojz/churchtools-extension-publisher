import { clonePublisherPage, type PublisherPage } from './publisherPage';
import { cloneLayoutState, type SerializableLayoutState } from './layoutHistory';
import type { TemplateId } from './templates';

export interface PublisherDocumentSnapshot {
    pages: PublisherPage[];
    activePageId: string;
}

export interface PublisherDocumentHistorySnapshotEntry {
    kind: 'document';
    snapshot: PublisherDocumentSnapshot;
}

export interface PublisherPageLayoutHistoryEntry {
    kind: 'page-layout';
    pageId: string;
    templateId: TemplateId;
    state: SerializableLayoutState;
    activePageId: string;
}

export type PublisherDocumentHistoryEntry =
    | PublisherDocumentHistorySnapshotEntry
    | PublisherPageLayoutHistoryEntry;

export interface PublisherDocumentHistory {
    past: PublisherDocumentHistoryEntry[];
    future: PublisherDocumentHistoryEntry[];
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

/**
 * Records an already detached snapshot and takes ownership of it. This avoids a
 * second full-document clone on editor actions that captured their before-state
 * before mutating the Pinia document.
 */
export const recordPublisherDocumentHistorySnapshot = (
    history: PublisherDocumentHistory,
    previousSnapshot: PublisherDocumentSnapshot,
): PublisherDocumentHistory => ({
    past: [
        ...history.past,
        { kind: 'document', snapshot: previousSnapshot } satisfies PublisherDocumentHistorySnapshotEntry,
    ].slice(-MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
    future: [],
});

export const recordPublisherPageLayoutHistory = (
    history: PublisherDocumentHistory,
    pageId: string,
    templateId: TemplateId,
    previousState: SerializableLayoutState,
    activePageId: string,
): PublisherDocumentHistory => ({
    past: [
        ...history.past,
        {
            kind: 'page-layout',
            pageId,
            templateId,
            state: cloneLayoutState(previousState),
            activePageId,
        } satisfies PublisherPageLayoutHistoryEntry,
    ].slice(-MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
    future: [],
});

export const commitPublisherDocumentHistory = (
    history: PublisherDocumentHistory,
    previousSnapshot: PublisherDocumentSnapshot,
    currentSnapshot: PublisherDocumentSnapshot,
): PublisherDocumentHistory => {
    if (publisherDocumentSnapshotsEqual(previousSnapshot, currentSnapshot)) return history;

    return recordPublisherDocumentHistorySnapshot(
        history,
        clonePublisherDocumentSnapshot(previousSnapshot),
    );
};

const inverseHistoryEntry = (
    entry: PublisherDocumentHistoryEntry,
    currentSnapshot: PublisherDocumentSnapshot,
): PublisherDocumentHistoryEntry | null => {
    if (entry.kind === 'document') {
        return { kind: 'document', snapshot: currentSnapshot };
    }
    const currentState = currentSnapshot.pages
        .find(({ id }) => id === entry.pageId)
        ?.layouts[entry.templateId];
    return currentState ? {
        kind: 'page-layout',
        pageId: entry.pageId,
        templateId: entry.templateId,
        state: currentState,
        activePageId: currentSnapshot.activePageId,
    } : null;
};

export const undoPublisherDocumentHistory = (
    history: PublisherDocumentHistory,
    currentSnapshot: PublisherDocumentSnapshot,
): { history: PublisherDocumentHistory; entry: PublisherDocumentHistoryEntry } | null => {
    const entry = history.past.at(-1);
    if (!entry) return null;
    const inverse = inverseHistoryEntry(entry, currentSnapshot);
    if (!inverse) return null;

    return {
        history: {
            past: history.past.slice(0, -1),
            future: [
                inverse,
                ...history.future,
            ].slice(0, MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
        },
        entry,
    };
};

export const redoPublisherDocumentHistory = (
    history: PublisherDocumentHistory,
    currentSnapshot: PublisherDocumentSnapshot,
): { history: PublisherDocumentHistory; entry: PublisherDocumentHistoryEntry } | null => {
    const [entry, ...remainingFuture] = history.future;
    if (!entry) return null;
    const inverse = inverseHistoryEntry(entry, currentSnapshot);
    if (!inverse) return null;

    return {
        history: {
            past: [
                ...history.past,
                inverse,
            ].slice(-MAX_PUBLISHER_DOCUMENT_HISTORY_LENGTH),
            future: remainingFuture,
        },
        entry,
    };
};
