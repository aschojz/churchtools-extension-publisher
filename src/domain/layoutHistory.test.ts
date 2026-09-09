import { describe, expect, it } from 'vitest';

import {
    createLayoutOffsets,
    createLayoutElementEffects,
    createLayoutOrder,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
} from './layoutEditing';
import {
    commitLayoutHistory,
    createLayoutHistory,
    redoLayoutHistory,
    type SerializableLayoutState,
    undoLayoutHistory,
} from './layoutHistory';
import { createLayoutFilterStack } from './layoutFilters';

const createState = (): SerializableLayoutState => ({
    offsets: createLayoutOffsets(),
    sizes: createLayoutSizes('split'),
    rotations: createLayoutRotations(),
    order: createLayoutOrder(),
    styles: createLayoutTextStyles('split'),
    visualStyles: createLayoutVisualStyles('split'),
    groups: [],
    deleted: [],
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

    it('includes text styles in undo and redo snapshots', () => {
        const initial = createState();
        const styled = createState();
        styled.styles.title = { ...styled.styles.title, fontSize: 120, color: '#123456' };
        const history = commitLayoutHistory(createLayoutHistory(), initial, styled);
        const undone = undoLayoutHistory(history, styled);

        expect(undone?.state.styles.title).toEqual(createLayoutTextStyles('split').title);
        const redone = undone && redoLayoutHistory(undone.history, undone.state);
        expect(redone?.state.styles.title).toEqual({
            ...createLayoutTextStyles('split').title,
            fontSize: 120,
            color: '#123456',
        });
    });

    it('deep-clones nested groups in history snapshots', () => {
        const initial = createState();
        const grouped = createState();
        grouped.groups = [{
            id: 'outer',
            rotation: 30,
            repeat: { sourceFieldId: 'eventService-12', itemAlias: 'person', axis: 'vertical', gap: 8 },
            children: [{ id: 'inner', children: ['title', 'dateTime'] }, 'location'],
        }];
        const history = commitLayoutHistory(createLayoutHistory(), initial, grouped);
        const undone = undoLayoutHistory(history, grouped);
        const redone = undone && redoLayoutHistory(undone.history, undone.state);

        grouped.groups[0]!.children.splice(0, 1);
        expect(redone?.state.groups[0]?.children).toHaveLength(2);
        expect(redone?.state.groups[0]?.rotation).toBe(30);
        expect(redone?.state.groups[0]?.repeat?.sourceFieldId).toBe('eventService-12');
    });

    it('includes deleted layers in undo snapshots', () => {
        const initial = createState();
        const deleted = createState();
        deleted.deleted = ['title'];
        deleted.order = deleted.order.filter((elementId) => elementId !== 'title');
        const history = commitLayoutHistory(createLayoutHistory(), initial, deleted);

        expect(undoLayoutHistory(history, deleted)?.state.deleted).toEqual([]);
    });

    it('deep-clones layer effects in history snapshots', () => {
        const initial = createState();
        const styled = createState();
        const effects = createLayoutElementEffects();
        effects.shadow.enabled = true;
        styled.effects = { title: effects };
        const history = commitLayoutHistory(createLayoutHistory(), initial, styled);
        const undone = undoLayoutHistory(history, styled);
        const redone = undone && redoLayoutHistory(undone.history, undone.state);

        effects.shadow.blur = 99;
        expect(redone?.state.effects?.title?.shadow.blur).toBe(16);
    });

    it('deep-clones ordered layer filters in history snapshots', () => {
        const initial = createState();
        const styled = createState();
        const filters = createLayoutFilterStack();
        filters[0]!.enabled = true;
        styled.filters = { title: filters };
        const history = commitLayoutHistory(createLayoutHistory(), initial, styled);
        const undone = undoLayoutHistory(history, styled);
        const redone = undone && redoLayoutHistory(undone.history, undone.state);

        filters[0]!.enabled = false;
        expect(redone?.state.filters?.title?.[0]).toMatchObject({ type: 'brightness', enabled: true });
    });
});
