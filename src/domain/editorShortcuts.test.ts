import { describe, expect, it } from 'vitest';

import { resolveEditorShortcut } from './editorShortcuts';

const keyboardEvent = (overrides: Partial<KeyboardEvent>): KeyboardEvent => ({
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
} as KeyboardEvent);

describe('editor shortcuts', () => {
    it('maps arrow keys to movement and shift to a larger step', () => {
        expect(resolveEditorShortcut(keyboardEvent({ key: 'ArrowLeft' }), true)).toEqual({
            type: 'move', deltaXFactor: -1, deltaYFactor: 0,
        });
        expect(resolveEditorShortcut(keyboardEvent({ key: 'ArrowDown', shiftKey: true }), true)).toEqual({
            type: 'move', deltaXFactor: 0, deltaYFactor: 5,
        });
    });

    it('does not move without a selected element', () => {
        expect(resolveEditorShortcut(keyboardEvent({ key: 'ArrowRight' }), false)).toBeNull();
    });

    it('supports undo and both common redo shortcuts', () => {
        expect(resolveEditorShortcut(keyboardEvent({ key: 'z', metaKey: true }), false)).toEqual({ type: 'undo' });
        expect(resolveEditorShortcut(keyboardEvent({ key: 'z', ctrlKey: true, shiftKey: true }), false)).toEqual({ type: 'redo' });
        expect(resolveEditorShortcut(keyboardEvent({ key: 'y', ctrlKey: true }), false)).toEqual({ type: 'redo' });
    });

    it('maps escape to clearing the selection', () => {
        expect(resolveEditorShortcut(keyboardEvent({ key: 'Escape' }), true)).toEqual({ type: 'clearSelection' });
        expect(resolveEditorShortcut(keyboardEvent({ key: 'Escape' }), false)).toBeNull();
    });

    it('maps the common grouping shortcuts when elements are selected', () => {
        expect(resolveEditorShortcut(keyboardEvent({ key: 'g', metaKey: true }), true)).toEqual({ type: 'group' });
        expect(resolveEditorShortcut(keyboardEvent({ key: 'G', ctrlKey: true, shiftKey: true }), true))
            .toEqual({ type: 'ungroup' });
        expect(resolveEditorShortcut(keyboardEvent({ key: 'g', metaKey: true }), false)).toBeNull();
    });
});
