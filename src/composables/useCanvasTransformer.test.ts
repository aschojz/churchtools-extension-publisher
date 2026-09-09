import type Konva from 'konva';
import type { Box } from 'konva/lib/shapes/Transformer';
import { ref, type Ref } from 'vue';
import type { VueKonvaRef } from 'vue-konva';
import { describe, expect, it, vi } from 'vitest';

import type { LayoutElementId } from '../domain/layoutEditing';
import { useCanvasTransformer } from './useCanvasTransformer';

const createTransformer = () => {
    const selectedElements = ref<LayoutElementId[]>(['shape-line-1']);
    const selectedGroupId = ref<string | null>(null);
    const selectedLine = ref(true);
    const selectedKeepsAspectRatio = ref(false);
    const snapEnabled = ref(false);
    const result = useCanvasTransformer({
        documentSize: ref({ width: 600, height: 400 }),
        elementIsLocked: () => false,
        getElementRotation: () => 0,
        isExporting: ref(false),
        onAutoFitTextFrame: vi.fn(),
        selectedElement: ref<LayoutElementId | null>('shape-line-1'),
        selectedElementTouchesTopEdge: ref(false),
        selectedElements,
        selectedGraphicText: ref(false),
        selectedGroupId,
        selectedKeepsAspectRatio,
        selectedLine,
        snapEnabled,
        stageRef: ref(null) as Ref<VueKonvaRef<Konva.Stage> | null>,
        transformerRef: ref(null) as Ref<VueKonvaRef<Konva.Transformer> | null>,
    });
    return { result, selectedGroupId, selectedKeepsAspectRatio, selectedLine, snapEnabled };
};

describe('useCanvasTransformer', () => {
    it('uses the element-specific handle set and switches groups to rotation-only', () => {
        const { result, selectedGroupId, selectedKeepsAspectRatio, selectedLine } = createTransformer();
        const config = result.transformerConfig.value as {
            enabledAnchors: string[];
            keepRatio: boolean;
            rotateEnabled: boolean;
        };

        expect(config.enabledAnchors).toEqual(['middle-left', 'middle-right']);
        selectedLine.value = false;
        selectedKeepsAspectRatio.value = true;
        expect((result.transformerConfig.value as typeof config).enabledAnchors)
            .toEqual(['top-left', 'top-right', 'bottom-left', 'bottom-right']);

        selectedGroupId.value = 'group-1';
        expect(result.transformerConfig.value).toMatchObject({ enabledAnchors: [], rotateEnabled: true });
    });

    it('only enables rotation snapping when document snapping is active', () => {
        const { result, snapEnabled } = createTransformer();

        expect((result.transformerConfig.value as { rotationSnaps: number[] }).rotationSnaps).toEqual([]);
        snapEnabled.value = true;
        expect((result.transformerConfig.value as { rotationSnaps: number[] }).rotationSnaps)
            .toEqual(expect.arrayContaining([-180, 0, 180]));
    });

    it('rejects transformed frames that violate the document minimum bounds', () => {
        const { result } = createTransformer();
        const boundBox = (result.transformerConfig.value as {
            boundBoxFunc: (oldBox: Box, newBox: Box) => Box;
        }).boundBoxFunc;

        const previous = { x: 10, y: 10, width: 20, height: 20, rotation: 0 };
        expect(boundBox(
            previous,
            { x: -20, y: -30, width: 0, height: 0, rotation: 0 },
        )).toEqual(previous);
    });
});
