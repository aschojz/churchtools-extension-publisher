<script setup lang="ts">
import type Konva from 'konva';
import type { Box } from 'konva/lib/shapes/Transformer';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import EditableTextElement from './EditableTextElement.vue';
import type { EventTemplateProps } from '../domain/EventTemplateProps';
import {
    calculateAlignmentSnap,
    clampLayoutPosition,
    createLayoutOrder,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutSizes,
    keepRotatedFrameInDocument,
    type AlignmentGuide,
    type LayoutElementId,
    type LayoutFrame,
    moveLayoutElementInOrder,
    resizeLayoutFrame,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
    TEMPLATE_ELEMENT_FRAMES,
} from '../domain/layoutEditing';
import type { TemplateId } from '../domain/templates';
import {
    calculatePreviewScale,
    DOCUMENT_HEIGHT,
    DOCUMENT_WIDTH,
} from '../utils/stageDimensions';

type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

const props = defineProps<{
    template: EventTemplateProps;
    templateId: TemplateId;
    snapEnabled: boolean;
}>();

const emit = defineEmits<{
    imageStatus: [status: ImageStatus];
    layoutChange: [changed: boolean];
    layerPositionChange: [position: number, total: number];
    selectionChange: [elementId: LayoutElementId | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<VueKonvaRef<Konva.Stage> | null>(null);
const transformerRef = ref<VueKonvaRef<Konva.Transformer> | null>(null);
const containerWidth = ref(DOCUMENT_WIDTH);
const image = shallowRef<HTMLImageElement | null>(null);
const imageStatus = ref<ImageStatus>('idle');
const selectedElement = ref<LayoutElementId | null>(null);
const isExporting = ref(false);
const activeAlignmentGuides = ref<AlignmentGuide[]>([]);
const layoutOffsets = ref<Record<TemplateId, ReturnType<typeof createLayoutOffsets>>>({
    split: createLayoutOffsets(),
    poster: createLayoutOffsets(),
});
const layoutSizes = ref<Record<TemplateId, ReturnType<typeof createLayoutSizes>>>({
    split: createLayoutSizes('split'),
    poster: createLayoutSizes('poster'),
});
const layoutRotations = ref<Record<TemplateId, ReturnType<typeof createLayoutRotations>>>({
    split: createLayoutRotations(),
    poster: createLayoutRotations(),
});
const layoutOrder = ref<Record<TemplateId, ReturnType<typeof createLayoutOrder>>>({
    split: createLayoutOrder(),
    poster: createLayoutOrder(),
});
let resizeObserver: ResizeObserver | undefined;

const previewScale = computed(() => calculatePreviewScale(containerWidth.value));
const stageConfig = computed(() => ({
    width: DOCUMENT_WIDTH * previewScale.value,
    height: DOCUMENT_HEIGHT * previewScale.value,
    scaleX: previewScale.value,
    scaleY: previewScale.value,
}));
const transformerConfig = computed(() => ({
    rotateEnabled: true,
    flipEnabled: false,
    keepRatio: false,
    enabledAnchors: ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
    anchorFill: '#ffffff',
    anchorStroke: '#2479c5',
    anchorSize: 18,
    borderStroke: '#2479c5',
    borderStrokeWidth: 4,
    rotateAnchorOffset: 45,
    rotationSnaps: props.snapEnabled
        ? [-180, -165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
        : [],
    rotationSnapTolerance: 5,
    boundBoxFunc: (oldBox: Box, newBox: Box) => {
        const insideDocument =
            newBox.x >= 0 &&
            newBox.y >= 0 &&
            newBox.x + newBox.width <= DOCUMENT_WIDTH &&
            newBox.y + newBox.height <= DOCUMENT_HEIGHT;
        return newBox.width >= 120 && newBox.height >= 50 && insideDocument ? newBox : oldBox;
    },
}));

const imageCrop = computed(() => {
    if (!image.value) {
        return undefined;
    }

    const frameWidth = props.templateId === 'split' ? 920 : DOCUMENT_WIDTH;
    const frameHeight = DOCUMENT_HEIGHT;
    const imageRatio = image.value.naturalWidth / image.value.naturalHeight;
    const frameRatio = frameWidth / frameHeight;

    if (imageRatio > frameRatio) {
        const cropWidth = image.value.naturalHeight * frameRatio;
        return {
            x: (image.value.naturalWidth - cropWidth) / 2,
            y: 0,
            width: cropWidth,
            height: image.value.naturalHeight,
        };
    }

    const cropHeight = image.value.naturalWidth / frameRatio;
    return {
        x: 0,
        y: (image.value.naturalHeight - cropHeight) / 2,
        width: image.value.naturalWidth,
        height: cropHeight,
    };
});

const imageConfig = computed(() => ({
    image: image.value ?? undefined,
    x: 0,
    y: 0,
    width: props.templateId === 'split' ? 920 : DOCUMENT_WIDTH,
    height: DOCUMENT_HEIGHT,
    crop: imageCrop.value,
}));

const dateAndTime = computed(() => [props.template.date, props.template.time].filter(Boolean).join(' · '));
const currentLayoutChanged = computed(() => {
    const geometryChanged = (
        Object.entries(layoutOffsets.value[props.templateId]) as [LayoutElementId, { x: number; y: number }][]
    ).some(
        ([elementId, { x, y }]) => {
            const size = layoutSizes.value[props.templateId][elementId];
            const base = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
            const rotation = layoutRotations.value[props.templateId][elementId];
            return x !== 0 || y !== 0 || size.width !== base.width || size.height !== base.height || rotation !== 0;
        },
    );
    const defaultOrder = createLayoutOrder();
    const orderChanged = layoutOrder.value[props.templateId].some(
        (elementId, index) => elementId !== defaultOrder[index],
    );
    return geometryChanged || orderChanged;
});

const elementFrame = (elementId: LayoutElementId): LayoutFrame => {
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const offset = layoutOffsets.value[props.templateId][elementId];
    const size = layoutSizes.value[props.templateId][elementId];
    return {
        ...baseFrame,
        x: baseFrame.x + offset.x,
        y: baseFrame.y + offset.y,
        width: size.width,
        height: size.height,
    };
};

const syncTransformer = async () => {
    await nextTick();
    const transformer = transformerRef.value?.getNode();
    const stage = stageRef.value?.getNode();
    if (!transformer || !stage) {
        return;
    }

    const selectedNode = selectedElement.value
        ? stage.findOne(`#editable-${selectedElement.value}`)
        : undefined;
    transformer.nodes(selectedNode && !isExporting.value ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
};

const emitLayerPosition = () => {
    if (!selectedElement.value) {
        emit('layerPositionChange', 0, 0);
        return;
    }

    const order = layoutOrder.value[props.templateId];
    emit('layerPositionChange', order.indexOf(selectedElement.value) + 1, order.length);
};

const selectElement = (elementId: LayoutElementId) => {
    selectedElement.value = elementId;
    emit('selectionChange', elementId);
    emitLayerPosition();
    void syncTransformer();
};

const handleStagePointer = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const editableGroup = event.target.findAncestor('.editable-element', true);
    const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;

    if (elementId) {
        selectElement(elementId);
    }
};

const alignElementWhileDragging = (elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const parent = node.getParent();
    const stage = stageRef.value?.getNode();
    if (!parent || !stage) {
        return;
    }

    const targetFrames = createLayoutOrder()
        .filter((candidateId) => candidateId !== elementId)
        .map((candidateId) => stage.findOne(`#editable-${candidateId}`))
        .filter((candidate): candidate is Konva.Node => Boolean(candidate))
        .map((candidate) => candidate.getClientRect({ relativeTo: parent, skipStroke: true }));
    const frame = node.getClientRect({ relativeTo: parent, skipStroke: true });
    const alignment = calculateAlignmentSnap(frame, targetFrames);

    node.position({
        x: node.x() + alignment.offset.x,
        y: node.y() + alignment.offset.y,
    });
    activeAlignmentGuides.value = alignment.guides;
};

const moveElement = (elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>) => {
    activeAlignmentGuides.value = [];
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const position = clampLayoutPosition(
        snapLayoutPoint(event.target.position(), props.snapEnabled),
        elementFrame(elementId),
    );
    event.target.position(position);
    layoutOffsets.value[props.templateId][elementId] = {
        x: position.x - baseFrame.x,
        y: position.y - baseFrame.y,
    };
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const resizeElement = (elementId: LayoutElementId, event: Konva.KonvaEventObject<Event>) => {
    const node = event.target;
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const currentFrame = elementFrame(elementId);
    const snappedPosition = snapLayoutPoint({ x: node.x(), y: node.y() }, props.snapEnabled);
    const resizedFrame = resizeLayoutFrame(
        { ...currentFrame, ...snappedPosition },
        snapLayoutSize(
            {
                width: currentFrame.width * Math.abs(node.scaleX()),
                height: currentFrame.height * Math.abs(node.scaleY()),
            },
            props.snapEnabled,
        ),
    );
    const rotatedLayout = keepRotatedFrameInDocument(
        resizedFrame,
        snapRotation(node.rotation(), props.snapEnabled),
    );

    if (!rotatedLayout) {
        node.scale({ x: 1, y: 1 });
        node.position({ x: currentFrame.x, y: currentFrame.y });
        node.rotation(layoutRotations.value[props.templateId][elementId]);
        void syncTransformer();
        return;
    }

    node.scale({ x: 1, y: 1 });
    node.position({ x: rotatedLayout.frame.x, y: rotatedLayout.frame.y });
    node.rotation(rotatedLayout.rotation);
    layoutOffsets.value[props.templateId][elementId] = {
        x: rotatedLayout.frame.x - baseFrame.x,
        y: rotatedLayout.frame.y - baseFrame.y,
    };
    layoutSizes.value[props.templateId][elementId] = {
        width: rotatedLayout.frame.width,
        height: rotatedLayout.frame.height,
    };
    layoutRotations.value[props.templateId][elementId] = rotatedLayout.rotation;
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const nudgeSelectedElement = (deltaX: number, deltaY: number) => {
    if (!selectedElement.value) {
        return;
    }

    const elementId = selectedElement.value;
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const currentFrame = elementFrame(elementId);
    const position = clampLayoutPosition(
        { x: currentFrame.x + deltaX, y: currentFrame.y + deltaY },
        currentFrame,
    );
    layoutOffsets.value[props.templateId][elementId] = {
        x: position.x - baseFrame.x,
        y: position.y - baseFrame.y,
    };
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const resizeSelectedElement = (deltaWidth: number, deltaHeight: number) => {
    if (!selectedElement.value) {
        return;
    }

    const elementId = selectedElement.value;
    const resizedFrame = resizeLayoutFrame(elementFrame(elementId), {
        width: elementFrame(elementId).width + deltaWidth,
        height: elementFrame(elementId).height + deltaHeight,
    });
    layoutSizes.value[props.templateId][elementId] = {
        width: resizedFrame.width,
        height: resizedFrame.height,
    };
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const rotateSelectedElement = (deltaRotation: number) => {
    if (!selectedElement.value) {
        return;
    }

    const elementId = selectedElement.value;
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const rotatedLayout = keepRotatedFrameInDocument(
        elementFrame(elementId),
        layoutRotations.value[props.templateId][elementId] + deltaRotation,
    );
    if (!rotatedLayout) {
        return;
    }

    layoutOffsets.value[props.templateId][elementId] = {
        x: rotatedLayout.frame.x - baseFrame.x,
        y: rotatedLayout.frame.y - baseFrame.y,
    };
    layoutRotations.value[props.templateId][elementId] = rotatedLayout.rotation;
    emit('layoutChange', currentLayoutChanged.value);
    void syncTransformer();
};

const changeSelectedLayer = (direction: -1 | 1) => {
    if (!selectedElement.value) {
        return;
    }

    const currentOrder = layoutOrder.value[props.templateId];
    const nextOrder = moveLayoutElementInOrder(currentOrder, selectedElement.value, direction);
    if (nextOrder === currentOrder) {
        return;
    }

    layoutOrder.value[props.templateId] = nextOrder;
    emit('layoutChange', currentLayoutChanged.value);
    emitLayerPosition();
    void syncTransformer();
};

const resetLayout = () => {
    layoutOffsets.value[props.templateId] = createLayoutOffsets();
    layoutSizes.value[props.templateId] = createLayoutSizes(props.templateId);
    layoutRotations.value[props.templateId] = createLayoutRotations();
    layoutOrder.value[props.templateId] = createLayoutOrder();
    selectedElement.value = null;
    activeAlignmentGuides.value = [];
    emit('selectionChange', null);
    emitLayerPosition();
    emit('layoutChange', false);
};

watch(
    () => props.template.imageUrl,
    (imageUrl, _, onCleanup) => {
        image.value = null;

        if (!imageUrl) {
            imageStatus.value = 'idle';
            return;
        }

        imageStatus.value = 'loading';
        const nextImage = new Image();
        nextImage.crossOrigin = 'anonymous';
        nextImage.onload = () => {
            image.value = nextImage;
            imageStatus.value = 'loaded';
        };
        nextImage.onerror = () => {
            image.value = null;
            imageStatus.value = 'error';
        };
        nextImage.src = imageUrl;

        onCleanup(() => {
            nextImage.onload = null;
            nextImage.onerror = null;
        });
    },
    { immediate: true },
);

watch(imageStatus, (status) => emit('imageStatus', status), { immediate: true });
watch(
    () => props.templateId,
    () => {
        selectedElement.value = null;
        activeAlignmentGuides.value = [];
        emit('selectionChange', null);
        emitLayerPosition();
        emit('layoutChange', currentLayoutChanged.value);
        void syncTransformer();
    },
);

onMounted(() => {
    if (!containerRef.value) {
        return;
    }

    resizeObserver = new ResizeObserver(([entry]) => {
        if (entry) {
            containerWidth.value = entry.contentRect.width;
        }
    });
    resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());

const exportPng = async () => {
    await document.fonts.ready;

    if (imageStatus.value === 'loading') {
        throw new Error('Das Veranstaltungsbild wird noch geladen.');
    }

    const stage = stageRef.value?.getNode();
    if (!stage) {
        throw new Error('Die Vorschau ist noch nicht bereit.');
    }

    const previewState = {
        width: stage.width(),
        height: stage.height(),
        scaleX: stage.scaleX(),
        scaleY: stage.scaleY(),
    };

    try {
        isExporting.value = true;
        await syncTransformer();
        stage.size({ width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT });
        stage.scale({ x: 1, y: 1 });
        stage.draw();
        return stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    } finally {
        isExporting.value = false;
        stage.size({ width: previewState.width, height: previewState.height });
        stage.scale({ x: previewState.scaleX, y: previewState.scaleY });
        await syncTransformer();
        stage.draw();
    }
};

defineExpose({
    changeSelectedLayer,
    exportPng,
    nudgeSelectedElement,
    resetLayout,
    resizeSelectedElement,
    rotateSelectedElement,
    selectElement,
});
</script>

<template>
    <div ref="containerRef" class="template-preview">
        <v-stage ref="stageRef" :config="stageConfig" @mousedown="handleStagePointer" @touchstart="handleStagePointer">
            <v-layer v-if="templateId === 'split'">
                <v-rect :config="{ x: 0, y: 0, width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT, fill: '#172235' }" />
                <v-rect :config="{ x: 0, y: 0, width: 920, height: DOCUMENT_HEIGHT, fill: '#d8c8ae' }" />
                <v-image v-if="imageStatus === 'loaded'" :config="imageConfig" />
                <v-text
                    v-else
                    :config="{
                        x: 110,
                        y: 460,
                        width: 700,
                        text: 'CHURCHTOOLS',
                        align: 'center',
                        fill: '#6e6252',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 42,
                        fontStyle: 'bold',
                        letterSpacing: 8,
                    }"
                />
                <v-rect :config="{ x: 1030, y: 485, width: 120, height: 8, fill: '#f3b562' }" />
                <v-group>
                <EditableTextElement
                    element-id="title"
                    :frame="elementFrame('title')"
                    :rotation="layoutRotations[templateId].title"
                    :selected="selectedElement === 'title' && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('title')"
                    :text-config="{
                        text: template.title,
                        fill: '#ffffff',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 88,
                        fontStyle: 'bold',
                        lineHeight: 1.08,
                        wrap: 'word',
                        ellipsis: true,
                    }"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                <EditableTextElement
                    element-id="dateTime"
                    :frame="elementFrame('dateTime')"
                    :rotation="layoutRotations[templateId].dateTime"
                    :selected="selectedElement === 'dateTime' && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('dateTime')"
                    :text-config="{
                        text: dateAndTime,
                        fill: '#f3b562',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 42,
                        fontStyle: 'bold',
                        lineHeight: 1.25,
                    }"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                <EditableTextElement
                    v-if="template.location"
                    element-id="location"
                    :frame="elementFrame('location')"
                    :rotation="layoutRotations[templateId].location"
                    :selected="selectedElement === 'location' && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('location')"
                    :text-config="{
                        text: template.location,
                        fill: '#d8dee8',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 36,
                        lineHeight: 1.35,
                        wrap: 'word',
                        ellipsis: true,
                    }"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                </v-group>
                <v-text
                    :config="{
                        x: 1030,
                        y: 955,
                        width: 760,
                        text: 'CHURCHTOOLS PUBLISHER',
                        fill: '#8190a5',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 22,
                        fontStyle: 'bold',
                        letterSpacing: 4,
                    }"
                />
            </v-layer>
            <v-layer v-else>
                <v-rect :config="{ x: 0, y: 0, width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT, fill: '#24364b' }" />
                <v-image v-if="imageStatus === 'loaded'" :config="imageConfig" />
                <template v-else>
                    <v-rect :config="{ x: 0, y: 0, width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT, fill: '#c99d5b' }" />
                    <v-rect :config="{ x: 0, y: 0, width: 720, height: DOCUMENT_HEIGHT, fill: '#18324b', opacity: 0.9 }" />
                    <v-rect :config="{ x: 1420, y: 0, width: 500, height: DOCUMENT_HEIGHT, fill: '#e9c98f', opacity: 0.7 }" />
                </template>
                <v-rect
                    :config="{
                        x: 0,
                        y: 0,
                        width: DOCUMENT_WIDTH,
                        height: DOCUMENT_HEIGHT,
                        fill: '#0e1928',
                        opacity: imageStatus === 'loaded' ? 0.68 : 0.35,
                    }"
                />
                <v-rect :config="{ x: 820, y: 610, width: 280, height: 8, fill: '#f3b562' }" />
                <v-group>
                <EditableTextElement
                    element-id="title"
                    :frame="elementFrame('title')"
                    :rotation="layoutRotations[templateId].title"
                    :selected="selectedElement === 'title' && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('title')"
                    :text-config="{
                        text: template.title,
                        align: 'center',
                        fill: '#ffffff',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 112,
                        fontStyle: 'bold',
                        lineHeight: 1.05,
                        wrap: 'word',
                        ellipsis: true,
                    }"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                <EditableTextElement
                    element-id="dateTime"
                    :frame="elementFrame('dateTime')"
                    :rotation="layoutRotations[templateId].dateTime"
                    :selected="selectedElement === 'dateTime' && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('dateTime')"
                    :text-config="{
                        text: dateAndTime,
                        align: 'center',
                        fill: '#f7c77f',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 50,
                        fontStyle: 'bold',
                    }"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                <EditableTextElement
                    v-if="template.location"
                    element-id="location"
                    :frame="elementFrame('location')"
                    :rotation="layoutRotations[templateId].location"
                    :selected="selectedElement === 'location' && !isExporting"
                    :z-index="layoutOrder[templateId].indexOf('location')"
                    :text-config="{
                        text: template.location,
                        align: 'center',
                        fill: '#ffffff',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 38,
                        lineHeight: 1.3,
                        wrap: 'word',
                        ellipsis: true,
                    }"
                    @dragging="alignElementWhileDragging"
                    @move="moveElement"
                    @resize="resizeElement"
                />
                </v-group>
                <v-text
                    :config="{
                        x: 160,
                        y: 960,
                        width: 1600,
                        text: 'CHURCHTOOLS PUBLISHER',
                        align: 'center',
                        fill: '#dce3ed',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 22,
                        fontStyle: 'bold',
                        letterSpacing: 5,
                    }"
                />
            </v-layer>
            <v-layer v-if="!isExporting" :config="{ listening: false }">
                <v-line
                    v-for="guide in activeAlignmentGuides"
                    :key="`${guide.orientation}-${guide.position}`"
                    :config="{
                        points: guide.orientation === 'vertical'
                            ? [guide.position, 0, guide.position, DOCUMENT_HEIGHT]
                            : [0, guide.position, DOCUMENT_WIDTH, guide.position],
                        stroke: '#ee3d8f',
                        strokeWidth: 4,
                        dash: [18, 12],
                    }"
                />
            </v-layer>
            <v-layer>
                <v-transformer ref="transformerRef" :config="transformerConfig" />
            </v-layer>
        </v-stage>
    </div>
</template>
