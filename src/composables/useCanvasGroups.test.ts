import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import type { LayoutElementId, LayoutFrame, LayoutGroups } from '../domain/layoutEditing';
import { cloneLayoutState, type SerializableLayoutState } from '../domain/layoutHistory';
import { useCanvasGroups } from './useCanvasGroups';

describe('useCanvasGroups', () => {
    it('groups the selection and applies auto-layout as undoable mutations', () => {
        const bases: Record<string, LayoutFrame> = {
            title: { x: 10, y: 20, width: 100, height: 40 },
            dateTime: { x: 140, y: 80, width: 80, height: 30 },
        };
        const layout = {
            deleted: [] as LayoutElementId[],
            effects: {},
            filters: {},
            groups: [] as LayoutGroups,
            offsets: { title: { x: 0, y: 0 }, dateTime: { x: 0, y: 0 } } as Record<string, { x: number; y: number }>,
            order: ['title', 'dateTime'] as LayoutElementId[],
            sizes: { title: { width: 100, height: 40 }, dateTime: { width: 80, height: 30 } } as Record<string, { width: number; height: number }>,
        };
        const selectedElements = ref<LayoutElementId[]>(['title', 'dateTime']);
        const selectedGroupId = ref<string | null>(null);
        const commits = vi.fn();
        const capture = (): SerializableLayoutState => cloneLayoutState({
            ...layout,
            rotations: { title: 0, dateTime: 0 },
            styles: {},
            visualStyles: {},
            customElements: [],
        });
        const elementFrame = (elementId: LayoutElementId) => ({
            ...bases[elementId]!,
            x: bases[elementId]!.x + layout.offsets[elementId]!.x,
            y: bases[elementId]!.y + layout.offsets[elementId]!.y,
            ...layout.sizes[elementId],
        });
        const groups = useCanvasGroups({
            autoLayoutTextHeight: () => null,
            captureLayoutState: capture,
            commitCurrentLayout: commits,
            elementFrame,
            elementIsLocked: () => false,
            getBaseFrame: (elementId) => bases[elementId]!,
            getLayout: () => layout,
            onLayoutChange: vi.fn(),
            selectedElements,
            selectedGroupId,
            setEffects: (value) => { layout.effects = value; },
            setFilters: (value) => { layout.filters = value; },
            setGroups: (value) => { layout.groups = value; },
            setOrder: (value) => { layout.order = value; },
            updateSelection: (elementIds, groupId = null) => {
                selectedElements.value = elementIds;
                selectedGroupId.value = groupId;
            },
        });

        groups.groupSelectedElements();
        expect(layout.groups).toHaveLength(1);
        expect(layout.groups[0]).toMatchObject({ children: ['title', 'dateTime'] });
        expect(selectedGroupId.value).toMatch(/^group-/);

        groups.setSelectedGroupAutoLayout({
            axis: 'vertical', gap: 8, horizontalOrigin: 'left', verticalOrigin: 'top',
        });
        expect(layout.groups[0]?.autoLayout).toMatchObject({ axis: 'vertical', gap: 8 });
        expect(elementFrame('dateTime').y).toBe(elementFrame('title').y + elementFrame('title').height + 8);
        expect(commits).toHaveBeenCalledTimes(2);
    });
});
