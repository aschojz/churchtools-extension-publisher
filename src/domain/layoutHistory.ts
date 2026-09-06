import type {
    LayoutElementId,
    LayoutEffects,
    LayoutCustomElement,
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
    hidden?: LayoutElementId[];
    locked?: LayoutElementId[];
    customElements?: LayoutCustomElement[];
    effects?: LayoutEffects;
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
    ...(group.autoLayout ? { autoLayout: { ...group.autoLayout, anchor: { ...group.autoLayout.anchor } } } : {}),
    ...(group.rotation !== undefined ? { rotation: group.rotation } : {}),
});

export const cloneLayoutState = (state: SerializableLayoutState): SerializableLayoutState => ({
    offsets: Object.fromEntries(Object.entries(state.offsets).map(([id, offset]) => [id, { ...offset }])),
    sizes: Object.fromEntries(Object.entries(state.sizes).map(([id, size]) => [id, { ...size }])),
    rotations: { ...state.rotations },
    order: [...state.order],
    styles: Object.fromEntries(Object.entries(state.styles).map(([id, style]) => [id, {
        ...style,
        ...(style.colorGradient ? { colorGradient: { ...style.colorGradient, stops: style.colorGradient.stops.map((stop) => ({ ...stop })) } } : {}),
        ...(style.colorBinding ? { colorBinding: { ...style.colorBinding } } : {}),
        ...(style.strokeBinding ? { strokeBinding: { ...style.strokeBinding } } : {}),
    }])),
    visualStyles: Object.fromEntries(Object.entries(state.visualStyles).map(([id, style]) => [id, {
        ...style,
        ...(style.fillGradient ? { fillGradient: { ...style.fillGradient, stops: style.fillGradient.stops.map((stop) => ({ ...stop })) } } : {}),
        ...(style.fillBinding ? { fillBinding: { ...style.fillBinding } } : {}),
        ...(style.strokeBinding ? { strokeBinding: { ...style.strokeBinding } } : {}),
    }])),
    groups: state.groups.map(cloneLayoutGroup),
    deleted: [...state.deleted],
    ...(state.hidden ? { hidden: [...state.hidden] } : {}),
    ...(state.locked ? { locked: [...state.locked] } : {}),
    ...(state.customElements
        ? { customElements: state.customElements.map((element) => ({ ...element, frame: { ...element.frame } })) }
        : {}),
    ...(state.effects
        ? { effects: Object.fromEntries(Object.entries(state.effects).map(([id, effects]) => [id, {
            ...effects,
            shadow: { ...effects.shadow },
            blur: { ...effects.blur },
        }])) }
        : {}),
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
