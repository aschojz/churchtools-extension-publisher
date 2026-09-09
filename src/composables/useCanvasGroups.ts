import type { Ref } from 'vue';

import {
    applyLayoutGroupAutoLayout,
    flattenLayoutGroups,
    groupLayoutElements,
    isTextLayoutElement,
    layoutGroupAnchor,
    layoutGroupBounds,
    layoutGroupElementIds,
    moveLayoutOrderBlock,
    nestLayoutNodeInGroup,
    sortLayoutGroupChildren,
    ungroupLayoutElements,
    type LayoutDistributionAxis,
    type LayoutElementId,
    type LayoutFrame,
    type LayoutGroup,
    type LayoutGroupAutoLayout,
    type LayoutGroupRepeat,
    type LayoutGroups,
    type LayoutHorizontalOrigin,
    type LayoutLayerDragNode,
    type LayoutLayerDropPlacement,
    type LayoutVerticalOrigin,
} from '../domain/layoutEditing';
import type { LayoutFilters } from '../domain/layoutFilters';
import type { SerializableLayoutState } from '../domain/layoutHistory';

interface CanvasGroupLayout {
    deleted: SerializableLayoutState['deleted'];
    effects: NonNullable<SerializableLayoutState['effects']>;
    filters: LayoutFilters;
    groups: SerializableLayoutState['groups'];
    offsets: SerializableLayoutState['offsets'];
    order: SerializableLayoutState['order'];
    sizes: SerializableLayoutState['sizes'];
}

interface UseCanvasGroupsOptions {
    autoLayoutTextHeight: (elementId: LayoutElementId) => number | null;
    captureLayoutState: () => SerializableLayoutState;
    commitCurrentLayout: (previousState: SerializableLayoutState) => void;
    elementFrame: (elementId: LayoutElementId) => LayoutFrame;
    elementIsLocked: (elementId: LayoutElementId) => boolean;
    getBaseFrame: (elementId: LayoutElementId) => LayoutFrame;
    getLayout: () => CanvasGroupLayout;
    onLayoutChange: () => void;
    selectedElements: Readonly<Ref<LayoutElementId[]>>;
    selectedGroupId: Readonly<Ref<string | null>>;
    setEffects: (effects: NonNullable<SerializableLayoutState['effects']>) => void;
    setFilters: (filters: LayoutFilters) => void;
    setGroups: (groups: LayoutGroups) => void;
    setOrder: (order: LayoutElementId[]) => void;
    updateSelection: (elementIds: LayoutElementId[], groupId?: string | null) => void;
}

const updateLayoutGroup = (
    groups: LayoutGroups,
    groupId: string,
    update: (group: LayoutGroup) => LayoutGroup,
): LayoutGroups => groups.map((group) => group.id === groupId
    ? update(group)
    : {
        ...group,
        children: group.children.map((child) => typeof child === 'string'
            ? child
            : updateLayoutGroup([child], groupId, update)[0]!),
    });

export const useCanvasGroups = (options: UseCanvasGroupsOptions) => {
    let layoutGroupSequence = 0;
    const layout = () => options.getLayout();
    const currentElementFrames = () => Object.fromEntries(
        layout().order
            .filter((elementId) => !layout().deleted.includes(elementId))
            .map((elementId) => [elementId, options.elementFrame(elementId)]),
    ) as Partial<Record<LayoutElementId, LayoutFrame>>;

    const reflowAutoLayoutGroups = () => {
        const groups = layout().groups;
        const verticalTextIds = new Set(groups.flatMap((group) => flattenLayoutGroups([group]))
            .filter(({ autoLayout }) => autoLayout?.axis === 'vertical')
            .flatMap(layoutGroupElementIds)
            .filter(isTextLayoutElement));
        for (const elementId of verticalTextIds) {
            const height = options.autoLayoutTextHeight(elementId);
            if (height !== null) layout().sizes[elementId].height = height;
        }

        const reflowGroup = (
            group: LayoutGroup,
            frames: Partial<Record<LayoutElementId, LayoutFrame>>,
        ): Partial<Record<LayoutElementId, LayoutFrame>> => {
            let nextFrames = frames;
            for (const child of group.children) {
                if (typeof child !== 'string') nextFrames = reflowGroup(child, nextFrames);
            }
            return applyLayoutGroupAutoLayout(group, nextFrames);
        };
        let frames = currentElementFrames();
        for (const group of groups) frames = reflowGroup(group, frames);
        for (const [elementId, frame] of Object.entries(frames) as [LayoutElementId, LayoutFrame][]) {
            const baseFrame = options.getBaseFrame(elementId);
            layout().offsets[elementId] = { x: frame.x - baseFrame.x, y: frame.y - baseFrame.y };
            layout().sizes[elementId] = { width: frame.width, height: frame.height };
        }
    };

    const syncSelectedAutoLayoutAnchor = () => {
        const selectedGroupId = options.selectedGroupId.value;
        if (!selectedGroupId) return;
        const groups = layout().groups;
        const group = flattenLayoutGroups(groups).find(({ id }) => id === selectedGroupId);
        if (!group) return;
        const frames = currentElementFrames();
        const syncAnchors = (candidate: LayoutGroup): LayoutGroup => {
            const next = {
                ...candidate,
                children: candidate.children.map((child) => typeof child === 'string' ? child : syncAnchors(child)),
            };
            if (!next.autoLayout) return next;
            const bounds = layoutGroupBounds(next, frames);
            if (!bounds) return next;
            return {
                ...next,
                autoLayout: {
                    ...next.autoLayout,
                    anchor: layoutGroupAnchor(bounds, next.autoLayout.horizontalOrigin, next.autoLayout.verticalOrigin),
                },
            };
        };
        options.setGroups(updateLayoutGroup(groups, group.id, (candidate) => ({ ...syncAnchors(candidate) })));
    };

    const setSelectedGroupAutoLayout = (settings: {
        axis: LayoutDistributionAxis;
        gap: number;
        horizontalOrigin: LayoutHorizontalOrigin;
        verticalOrigin: LayoutVerticalOrigin;
    } | null) => {
        const selectedGroupId = options.selectedGroupId.value;
        if (!selectedGroupId) return;
        const groups = layout().groups;
        const selectedGroup = flattenLayoutGroups(groups).find(({ id }) => id === selectedGroupId);
        if (!selectedGroup) return;
        const previousState = options.captureLayoutState();
        if (!settings) {
            options.setGroups(updateLayoutGroup(groups, selectedGroup.id, ({ autoLayout: _, ...group }) => group));
        } else {
            const requestedGap = Number(settings.gap);
            const gap = Number.isFinite(requestedGap)
                ? Math.min(4096, Math.max(0, requestedGap))
                : selectedGroup.autoLayout?.gap ?? 8;
            const frames = currentElementFrames();
            const bounds = layoutGroupBounds(selectedGroup, frames);
            if (!bounds) return;
            const originChanged = selectedGroup.autoLayout && (
                selectedGroup.autoLayout.horizontalOrigin !== settings.horizontalOrigin ||
                selectedGroup.autoLayout.verticalOrigin !== settings.verticalOrigin ||
                selectedGroup.autoLayout.axis !== settings.axis
            );
            const anchor = !selectedGroup.autoLayout || originChanged
                ? layoutGroupAnchor(bounds, settings.horizontalOrigin, settings.verticalOrigin)
                : selectedGroup.autoLayout.anchor;
            const autoLayout: LayoutGroupAutoLayout = { ...settings, gap, anchor };
            options.setGroups(updateLayoutGroup(groups, selectedGroup.id, (group) => ({
                ...sortLayoutGroupChildren(group, frames, settings.axis),
                autoLayout,
            })));
            reflowAutoLayoutGroups();
        }
        options.commitCurrentLayout(previousState);
        options.updateSelection(options.selectedElements.value, selectedGroup.id);
        options.onLayoutChange();
    };

    const setSelectedGroupRepeat = (settings: LayoutGroupRepeat | null) => {
        const selectedGroupId = options.selectedGroupId.value;
        if (!selectedGroupId) return;
        const groups = layout().groups;
        const selectedGroup = flattenLayoutGroups(groups).find(({ id }) => id === selectedGroupId);
        if (!selectedGroup) return;
        const previousState = options.captureLayoutState();
        if (!settings) {
            options.setGroups(updateLayoutGroup(groups, selectedGroup.id, ({ repeat: _, ...group }) => group));
        } else {
            if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(settings.sourceFieldId) ||
                !/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(settings.itemAlias)) return;
            const requestedGap = Number(settings.gap);
            const repeat: LayoutGroupRepeat = {
                sourceFieldId: settings.sourceFieldId,
                itemAlias: settings.itemAlias,
                axis: settings.axis === 'horizontal' ? 'horizontal' : 'vertical',
                gap: Number.isFinite(requestedGap) ? Math.min(4096, Math.max(0, requestedGap)) : 8,
            };
            options.setGroups(updateLayoutGroup(groups, selectedGroup.id, (group) => ({ ...group, repeat })));
        }
        options.commitCurrentLayout(previousState);
        options.updateSelection(options.selectedElements.value, selectedGroup.id);
        options.onLayoutChange();
    };

    const pruneEffectsForCurrentTargets = () => {
        const validTargets = new Set<string>([
            ...layout().order,
            ...flattenLayoutGroups(layout().groups).map(({ id }) => id),
        ]);
        options.setEffects(Object.fromEntries(
            Object.entries(layout().effects).filter(([targetId]) => validTargets.has(targetId)),
        ));
        options.setFilters(Object.fromEntries(
            Object.entries(layout().filters).filter(([targetId]) => validTargets.has(targetId)),
        ));
    };

    const createLayoutGroupId = () => `group-${Date.now()}-${layoutGroupSequence++}`;
    const groupSelectedElements = () => {
        if (options.selectedElements.value.length < 2) return;
        const previousState = options.captureLayoutState();
        const currentGroups = layout().groups;
        const groupId = createLayoutGroupId();
        const nextGroups = groupLayoutElements(
            currentGroups,
            options.selectedElements.value,
            groupId,
            layout().order,
        );
        if (nextGroups === currentGroups) return;
        options.setGroups(nextGroups);
        pruneEffectsForCurrentTargets();
        options.commitCurrentLayout(previousState);
        options.updateSelection(options.selectedElements.value, groupId);
        options.onLayoutChange();
    };

    const ungroupSelectedElements = () => {
        if (options.selectedElements.value.length === 0) return;
        const previousState = options.captureLayoutState();
        const currentGroups = layout().groups;
        const nextGroups = ungroupLayoutElements(currentGroups, options.selectedElements.value);
        if (nextGroups.length === currentGroups.length &&
            nextGroups.every((group, index) => group === currentGroups[index])) return;
        options.setGroups(nextGroups);
        pruneEffectsForCurrentTargets();
        options.commitCurrentLayout(previousState);
        options.updateSelection(options.selectedElements.value);
        options.onLayoutChange();
    };

    const moveLayerNode = (
        source: LayoutLayerDragNode,
        target: LayoutLayerDragNode,
        placement: LayoutLayerDropPlacement,
    ) => {
        if (source.kind === target.kind && source.id === target.id) return;
        const groups = layout().groups;
        const sourceGroup = source.kind === 'group'
            ? flattenLayoutGroups(groups).find(({ id }) => id === source.id)
            : null;
        const targetGroup = target.kind === 'group'
            ? flattenLayoutGroups(groups).find(({ id }) => id === target.id)
            : null;
        const movingElementIds = sourceGroup ? layoutGroupElementIds(sourceGroup) : [source.id as LayoutElementId];
        const targetElementIds = targetGroup ? layoutGroupElementIds(targetGroup) : [target.id as LayoutElementId];
        if (movingElementIds.some((elementId) => targetElementIds.includes(elementId)) ||
            movingElementIds.some(options.elementIsLocked)) return;

        const previousState = options.captureLayoutState();
        options.setOrder(moveLayoutOrderBlock(layout().order, movingElementIds, targetElementIds, placement));
        if (placement === 'inside' && target.kind === 'group') {
            options.setGroups(nestLayoutNodeInGroup(groups, source, target.id));
            reflowAutoLayoutGroups();
        }
        options.commitCurrentLayout(previousState);
        const updatedTargetGroup = placement === 'inside' && target.kind === 'group'
            ? flattenLayoutGroups(layout().groups).find(({ id }) => id === target.id)
            : null;
        options.updateSelection(
            updatedTargetGroup ? layoutGroupElementIds(updatedTargetGroup) : movingElementIds,
            updatedTargetGroup?.id ?? sourceGroup?.id ?? null,
        );
        options.onLayoutChange();
    };

    return {
        groupSelectedElements,
        moveLayerNode,
        pruneEffectsForCurrentTargets,
        reflowAutoLayoutGroups,
        setSelectedGroupAutoLayout,
        setSelectedGroupRepeat,
        syncSelectedAutoLayoutAnchor,
        ungroupSelectedElements,
    };
};
