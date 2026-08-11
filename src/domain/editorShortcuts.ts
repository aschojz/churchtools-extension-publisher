export type EditorShortcut =
    | { type: 'clearSelection' }
    | { type: 'group' }
    | { type: 'move'; deltaXFactor: number; deltaYFactor: number }
    | { type: 'redo' }
    | { type: 'undo' }
    | { type: 'ungroup' };

type ShortcutKeyboardEvent = Pick<KeyboardEvent, 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>;

export const resolveEditorShortcut = (
    event: ShortcutKeyboardEvent,
    hasSelection: boolean,
): EditorShortcut | null => {
    const key = event.key.toLowerCase();
    const commandKey = event.ctrlKey || event.metaKey;

    if (commandKey && key === 'z') {
        return event.shiftKey ? { type: 'redo' } : { type: 'undo' };
    }
    if (commandKey && key === 'y') {
        return { type: 'redo' };
    }
    if (commandKey && key === 'g' && hasSelection) {
        return event.shiftKey ? { type: 'ungroup' } : { type: 'group' };
    }
    if (event.key === 'Escape') {
        return hasSelection ? { type: 'clearSelection' } : null;
    }
    if (!hasSelection || commandKey) {
        return null;
    }

    const factor = event.shiftKey ? 5 : 1;
    switch (event.key) {
        case 'ArrowLeft':
            return { type: 'move', deltaXFactor: -factor, deltaYFactor: 0 };
        case 'ArrowRight':
            return { type: 'move', deltaXFactor: factor, deltaYFactor: 0 };
        case 'ArrowUp':
            return { type: 'move', deltaXFactor: 0, deltaYFactor: -factor };
        case 'ArrowDown':
            return { type: 'move', deltaXFactor: 0, deltaYFactor: factor };
        default:
            return null;
    }
};
