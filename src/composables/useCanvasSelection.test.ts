import type Konva from 'konva';
import { computed, ref, type Ref } from 'vue';
import type { VueKonvaRef } from 'vue-konva';
import { describe, expect, it, vi } from 'vitest';

import type { LayoutElementId, LayoutGroups } from '../domain/layoutEditing';
import { useCanvasSelection } from './useCanvasSelection';

const createSelection = () => {
    const selectedElementIds = ref<LayoutElementId[]>([]);
    const selectedLayoutGroupId = ref<string | null>(null);
    const selectedElements = computed<LayoutElementId[]>({
        get: () => selectedElementIds.value,
        set: (value) => { selectedElementIds.value = value; },
    });
    const selectedGroupId = computed<string | null>({
        get: () => selectedLayoutGroupId.value,
        set: (value) => { selectedLayoutGroupId.value = value; },
    });
    const groups: LayoutGroups = [{
        id: 'outer',
        children: [{ id: 'inner', children: ['title', 'dateTime'] }, 'location'],
    }];
    const snapshots = vi.fn();
    const syncTransformer = vi.fn(async () => undefined);
    const selection = useCanvasSelection({
        elementIsLocked: () => false,
        getDeletedElements: () => [],
        getLayoutGroups: () => groups,
        getLayoutOrder: () => ['title', 'dateTime', 'location', 'image'],
        onSelectionDetailsChange: vi.fn(),
        onSelectionStateChange: snapshots,
        selectedElements,
        selectedGroupId,
        stageRef: ref(null) as Ref<VueKonvaRef<Konva.Stage> | null>,
        syncTransformer,
        transformerRef: ref(null) as Ref<VueKonvaRef<Konva.Transformer> | null>,
    });
    return { selectedElementIds, selectedLayoutGroupId, selection, snapshots, syncTransformer };
};

describe('useCanvasSelection', () => {
    it('selects nested groups from outside to inside and reports the inspector path', () => {
        const { selectedElementIds, selectedLayoutGroupId, selection, snapshots } = createSelection();

        selection.selectElement('dateTime');
        expect(selectedElementIds.value).toEqual(['title', 'dateTime', 'location']);
        expect(selectedLayoutGroupId.value).toBe('outer');
        expect(snapshots).toHaveBeenLastCalledWith(expect.objectContaining({
            elementId: 'location', groupDepth: 1, groupPath: ['outer', 'inner'],
        }));

        selection.drillIntoElement('dateTime');
        expect(selectedElementIds.value).toEqual(['title', 'dateTime']);
        expect(selectedLayoutGroupId.value).toBe('inner');
        expect(snapshots).toHaveBeenLastCalledWith(expect.objectContaining({ groupDepth: 2 }));

        selection.drillIntoElement('dateTime');
        expect(selectedElementIds.value).toEqual(['dateTime']);
        expect(selectedLayoutGroupId.value).toBeNull();
    });

    it('normalizes duplicate and unavailable ids before publishing selection state', () => {
        const { selectedElementIds, selection, snapshots, syncTransformer } = createSelection();

        selection.updateSelection(['title', 'title', 'unknown'] as LayoutElementId[]);

        expect(selectedElementIds.value).toEqual(['title']);
        expect(snapshots).toHaveBeenLastCalledWith(expect.objectContaining({
            elementId: 'title', elementIds: ['title'], layerPosition: 1, layerTotal: 4,
        }));
        expect(syncTransformer).toHaveBeenCalledOnce();
    });
});
