import { describe, expect, it } from 'vitest';

import { createLayoutOffsets, createLayoutOrder, createLayoutRotations, createLayoutSizes } from './layoutEditing';
import {
    commitLayoutHistory,
    createLayoutHistory,
    redoLayoutHistory,
    type SerializableLayoutState,
    undoLayoutHistory,
} from './layoutHistory';

const createState = (): SerializableLayoutState => ({
    offsets: createLayoutOffsets(),
    sizes: createLayoutSizes('split'),
    rotations: createLayoutRotations(),
    order: createLayoutOrder(),
});

describe('layout history', () => {
    it('commits independent snapshots and clears the redo stack', () => {
        const initial = createState();
        const moved = createState();
        moved.offsets.title.x = 20;
        const history = commitLayoutHistory(createLayoutHistory(), initial, moved);

        initial.offsets.title.x = 500;
        expect(history.past[0]?.offsets.title.x).toBe(0);
        expect(history.future).toEqual([]);
    });

    it('undoes and redoes a layout state', () => {
        const initial = createState();
        const moved = createState();
        moved.offsets.title.x = 20;
        const history = commitLayoutHistory(createLayoutHistory(), initial, moved);
        const undone = undoLayoutHistory(history, moved);

        expect(undone?.state.offsets.title.x).toBe(0);
        const redone = undone && redoLayoutHistory(undone.history, undone.state);
        expect(redone?.state.offsets.title.x).toBe(20);
    });

    it('does not record unchanged states', () => {
        const state = createState();
        const history = createLayoutHistory();

        expect(commitLayoutHistory(history, state, state)).toBe(history);
        expect(undoLayoutHistory(history, state)).toBeNull();
    });
});
