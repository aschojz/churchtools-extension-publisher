import type {
    LayoutElementId,
    LayoutOffsets,
    LayoutGroups,
    LayoutGroup,
    LayoutOrder,
    LayoutRotations,
    LayoutSizes,
    LayoutTextStyles,
    LayoutVisualStyles,
} from './layoutEditing';

export interface SerializableLayoutState {
    offsets: LayoutOffsets;
    sizes: LayoutSizes;
    rotations: LayoutRotations;
    order: LayoutOrder;
    styles: LayoutTextStyles;
    visualStyles: LayoutVisualStyles;
    groups: LayoutGroups;
    deleted: LayoutElementId[];
}

export interface LayoutHistory {
    past: SerializableLayoutState[];
    future: SerializableLayoutState[];
}

export const MAX_LAYOUT_HISTORY_LENGTH = 50;

export const createLayoutHistory = (): LayoutHistory => ({ past: [], future: [] });

const cloneLayoutGroup = (group: LayoutGroup): LayoutGroup => ({
    id: group.id,
    children: group.children.map((child) => typeof child === 'string' ? child : cloneLayoutGroup(child)),
});

export const cloneLayoutState = (state: SerializableLayoutState): SerializableLayoutState => ({
    offsets: {
        background: { ...state.offsets.background },
        image: { ...state.offsets.image },
        accent: { ...state.offsets.accent },
        title: { ...state.offsets.title },
        dateTime: { ...state.offsets.dateTime },
        location: { ...state.offsets.location },
    },
    sizes: {
        background: { ...state.sizes.background },
        image: { ...state.sizes.image },
        accent: { ...state.sizes.accent },
        title: { ...state.sizes.title },
        dateTime: { ...state.sizes.dateTime },
        location: { ...state.sizes.location },
    },
    rotations: { ...state.rotations },
    order: [...state.order],
    styles: {
        title: { ...state.styles.title },
        dateTime: { ...state.styles.dateTime },
        location: { ...state.styles.location },
    },
    visualStyles: {
        background: { ...state.visualStyles.background },
        accent: { ...state.visualStyles.accent },
    },
    groups: state.groups.map(cloneLayoutGroup),
    deleted: [...state.deleted],
});

const layoutStatesEqual = (left: SerializableLayoutState, right: SerializableLayoutState) =>
    JSON.stringify(left) === JSON.stringify(right);

export const commitLayoutHistory = (
    history: LayoutHistory,
    previousState: SerializableLayoutState,
    currentState: SerializableLayoutState,
): LayoutHistory => {
    if (layoutStatesEqual(previousState, currentState)) {
        return history;
    }

    return {
        past: [...history.past, cloneLayoutState(previousState)].slice(-MAX_LAYOUT_HISTORY_LENGTH),
        future: [],
    };
};

export const undoLayoutHistory = (
    history: LayoutHistory,
    currentState: SerializableLayoutState,
): { history: LayoutHistory; state: SerializableLayoutState } | null => {
    const state = history.past.at(-1);
    if (!state) {
        return null;
    }

    return {
        history: {
            past: history.past.slice(0, -1),
            future: [cloneLayoutState(currentState), ...history.future].slice(0, MAX_LAYOUT_HISTORY_LENGTH),
        },
        state: cloneLayoutState(state),
    };
};

export const redoLayoutHistory = (
    history: LayoutHistory,
    currentState: SerializableLayoutState,
): { history: LayoutHistory; state: SerializableLayoutState } | null => {
    const [state, ...remainingFuture] = history.future;
    if (!state) {
        return null;
    }

    return {
        history: {
            past: [...history.past, cloneLayoutState(currentState)].slice(-MAX_LAYOUT_HISTORY_LENGTH),
            future: remainingFuture,
        },
        state: cloneLayoutState(state),
    };
};
