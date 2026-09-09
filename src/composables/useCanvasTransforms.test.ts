import type Konva from 'konva';
import { ref, type Ref } from 'vue';
import type { VueKonvaRef } from 'vue-konva';
import { describe, expect, it, vi } from 'vitest';

import type { LayoutElementId, LayoutFrame, LayoutGroups } from '../domain/layoutEditing';
import { cloneLayoutState, type SerializableLayoutState } from '../domain/layoutHistory';
import { useCanvasTransforms } from './useCanvasTransforms';

const createTransforms = (grouped = false) => {
    const frames: Record<string, LayoutFrame> = {
        title: { x: 10, y: 20, width: 100, height: 40 },
        dateTime: { x: 140, y: 80, width: 80, height: 30 },
    };
    const groups: LayoutGroups = grouped ? [{ id: 'group-1', children: ['title', 'dateTime'] }] : [];
    const layout: Pick<SerializableLayoutState, 'groups' | 'offsets' | 'order' | 'rotations' | 'sizes' | 'styles'> = {
        groups,
        offsets: { title: { x: 0, y: 0 }, dateTime: { x: 0, y: 0 } },
        order: ['title', 'dateTime'] as LayoutElementId[],
        rotations: { title: 0, dateTime: 0 },
        sizes: {
            title: { width: frames.title!.width, height: frames.title!.height },
            dateTime: { width: frames.dateTime!.width, height: frames.dateTime!.height },
        },
        styles: {},
    };
    const selectedElements = ref<LayoutElementId[]>(grouped ? ['title', 'dateTime'] : ['title']);
    const selectedGroupId = ref<string | null>(grouped ? 'group-1' : null);
    const commitCurrentLayout = vi.fn();
    const onLayoutChange = vi.fn();
    const baseFrame = (elementId: LayoutElementId) => frames[elementId]!;
    const elementFrame = (elementId: LayoutElementId): LayoutFrame => ({
        ...baseFrame(elementId),
        x: baseFrame(elementId).x + layout.offsets[elementId]!.x,
        y: baseFrame(elementId).y + layout.offsets[elementId]!.y,
        ...layout.sizes[elementId],
    });
    const captureLayoutState = (): SerializableLayoutState => cloneLayoutState({
        ...layout,
        visualStyles: {},
        deleted: [],
        hidden: [],
        locked: [],
        customElements: [],
        effects: {},
        filters: {},
    });
    const transforms = useCanvasTransforms({
        activeAlignmentGuides: ref([]),
        captureLayoutState,
        commitCurrentLayout,
        documentSize: ref({ width: 500, height: 400 }),
        elementFrame,
        elementIsLocked: () => false,
        getBaseFrame: baseFrame,
        getCustomElement: () => undefined,
        getLayout: () => layout,
        onLayoutChange,
        onSelectionDetailsChange: vi.fn(),
        reflowAutoLayoutGroups: vi.fn(),
        selectElement: vi.fn(),
        selectGroup: vi.fn(),
        selectedElement: ref(grouped ? 'dateTime' : 'title'),
        selectedElements,
        selectedGroupId,
        selectedGroupVisualBounds: (group) => {
            const groupFrames = group.children.map((id) => elementFrame(id as LayoutElementId));
            const x = Math.min(...groupFrames.map((frame) => frame.x));
            const y = Math.min(...groupFrames.map((frame) => frame.y));
            const right = Math.max(...groupFrames.map((frame) => frame.x + frame.width));
            const bottom = Math.max(...groupFrames.map((frame) => frame.y + frame.height));
            return { x, y, width: right - x, height: bottom - y };
        },
        setLayoutGroups: (value) => { layout.groups = value; },
        snapEnabled: ref(false),
        stageRef: ref(null) as Ref<VueKonvaRef<Konva.Stage> | null>,
        syncGraphicTextSize: vi.fn(),
        syncSelectedAutoLayoutAnchor: vi.fn(),
        syncTransformer: vi.fn(async () => undefined),
    });
    return { commitCurrentLayout, frames, layout, onLayoutChange, transforms };
};

describe('useCanvasTransforms', () => {
    it('nudges the selected elements as one undoable mutation', () => {
        const { commitCurrentLayout, layout, onLayoutChange, transforms } = createTransforms();

        transforms.nudgeSelectedElement(15, -5);

        expect(layout.offsets.title).toEqual({ x: 15, y: -5 });
        expect(commitCurrentLayout).toHaveBeenCalledOnce();
        expect(onLayoutChange).toHaveBeenCalledOnce();
    });

    it('moves a selected group from the transform inspector without changing its dimensions', () => {
        const { layout, transforms } = createTransforms(true);

        transforms.setSelectedElementGeometry('x', 30);

        expect(layout.offsets.title).toEqual({ x: 20, y: 0 });
        expect(layout.offsets.dateTime).toEqual({ x: 20, y: 0 });
        expect(layout.sizes.title).toEqual({ width: 100, height: 40 });
        expect(layout.sizes.dateTime).toEqual({ width: 80, height: 30 });
    });
});
