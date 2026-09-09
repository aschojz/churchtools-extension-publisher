import type Konva from 'konva';
import type { Box } from 'konva/lib/shapes/Transformer';
import { computed, nextTick, type Ref } from 'vue';
import type { VueKonvaRef } from 'vue-konva';

import { constrainTransformerFrame, type LayoutElementId } from '../domain/layoutEditing';

type TransformerPointerEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;

interface UseCanvasTransformerOptions {
    documentSize: Readonly<Ref<{ width: number; height: number }>>;
    elementIsLocked: (elementId: LayoutElementId) => boolean;
    getElementRotation: (elementId: LayoutElementId) => number;
    isExporting: Readonly<Ref<boolean>>;
    onAutoFitTextFrame: (axis: 'height' | 'width') => void;
    selectedElement: Readonly<Ref<LayoutElementId | null>>;
    selectedElementTouchesTopEdge: Readonly<Ref<boolean>>;
    selectedElements: Readonly<Ref<LayoutElementId[]>>;
    selectedGraphicText: Readonly<Ref<boolean>>;
    selectedGroupId: Readonly<Ref<string | null>>;
    selectedKeepsAspectRatio: Readonly<Ref<boolean>>;
    selectedLine: Readonly<Ref<boolean>>;
    snapEnabled: Readonly<Ref<boolean>>;
    stageRef: Ref<VueKonvaRef<Konva.Stage> | null>;
    transformerRef: Ref<VueKonvaRef<Konva.Transformer> | null>;
}

const ROTATION_SNAPS = Array.from({ length: 25 }, (_, index) => -180 + index * 15);

export const useCanvasTransformer = (options: UseCanvasTransformerOptions) => {
    const selectionContainsLockedElement = () => options.selectedElements.value.some(options.elementIsLocked);

    const handleTransformerDoubleClick = (event: TransformerPointerEvent) => {
        const anchorNames = event.target.name().split(/\s+/);
        if (anchorNames.includes('bottom-center')) {
            event.cancelBubble = true;
            options.onAutoFitTextFrame('height');
        } else if (anchorNames.includes('middle-right')) {
            event.cancelBubble = true;
            options.onAutoFitTextFrame('width');
        }
    };

    const transformerConfig = computed(() => ({
        rotateEnabled: Boolean(options.selectedGroupId.value) || options.selectedElements.value.length === 1,
        flipEnabled: false,
        keepRatio: options.selectedKeepsAspectRatio.value,
        enabledAnchors: options.selectedGroupId.value
            ? []
            : options.selectedElements.value.length === 1
                ? options.selectedLine.value
                    ? ['middle-left', 'middle-right']
                    : options.selectedKeepsAspectRatio.value
                        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                        : [
                            'top-left', 'top-center', 'top-right', 'middle-left', 'middle-right',
                            'bottom-left', 'bottom-center', 'bottom-right',
                        ]
                : [],
        anchorFill: '#ffffff',
        anchorStroke: '#2479c5',
        anchorSize: 7,
        anchorStrokeWidth: 1,
        anchorCornerRadius: 1.5,
        borderStroke: '#2479c5',
        borderStrokeWidth: 1,
        anchorStyleFunc: (anchor: Konva.Rect) => {
            anchor.hitStrokeWidth(22);
            const selectedElement = options.selectedElement.value;
            if (!options.selectedGroupId.value && options.selectedElements.value.length === 1 && selectedElement &&
                options.getElementRotation(selectedElement) % 360 === 0) {
                const stage = anchor.getStage();
                const position = anchor.getAbsolutePosition();
                const edgeThreshold = anchor.width() / 2 + anchor.strokeWidth();
                const anchorName = anchor.name();
                if (anchorName.includes('left') && position.x <= edgeThreshold) anchor.offsetX(0);
                if (anchorName.includes('right') && stage && stage.width() - position.x <= edgeThreshold) {
                    anchor.offsetX(anchor.width());
                }
                if (anchorName.includes('top') && position.y <= edgeThreshold) anchor.offsetY(0);
                if (anchorName.includes('bottom') && stage && stage.height() - position.y <= edgeThreshold) {
                    anchor.offsetY(anchor.height());
                }
            }
            anchor.off('.publisher-autofit');
            anchor.on('mousedown.publisher-autofit', (event) => {
                if ('detail' in event.evt && event.evt.detail >= 2) {
                    options.transformerRef.value?.getNode()?.stopTransform();
                    handleTransformerDoubleClick(event);
                }
            });
            anchor.on('mouseup.publisher-autofit', (event) => {
                if ('detail' in event.evt && event.evt.detail >= 2) handleTransformerDoubleClick(event);
            });
            anchor.on('dblclick.publisher-autofit dbltap.publisher-autofit', handleTransformerDoubleClick);
        },
        rotateAnchorOffset: options.selectedElementTouchesTopEdge.value ? -18 : 18,
        rotationSnaps: options.snapEnabled.value ? ROTATION_SNAPS : [],
        rotationSnapTolerance: 5,
        boundBoxFunc: (oldBox: Box, newBox: Box) => {
            const minimumSize = options.selectedGraphicText.value ? 12 : 1;
            return {
                ...newBox,
                ...constrainTransformerFrame(oldBox, newBox, minimumSize, options.documentSize.value),
            };
        },
    }));

    const syncTransformer = async () => {
        await nextTick();
        const transformer = options.transformerRef.value?.getNode();
        const stage = options.stageRef.value?.getNode();
        if (!transformer || !stage) return;

        const groupNode = options.selectedGroupId.value && !selectionContainsLockedElement()
            ? stage.findOne(`#editable-group-${options.selectedGroupId.value}`)
            : null;
        const selectedNodes = groupNode
            ? [groupNode]
            : options.selectedElements.value
                .filter((elementId) => !options.elementIsLocked(elementId))
                .map((elementId) => stage.findOne(`#editable-${elementId}`))
                .filter((node): node is Konva.Node => Boolean(node));
        transformer.nodes(!options.isExporting.value ? selectedNodes : []);
        transformer.getLayer()?.batchDraw();
    };

    return { handleTransformerDoubleClick, syncTransformer, transformerConfig };
};
