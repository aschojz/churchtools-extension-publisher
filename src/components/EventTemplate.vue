<script setup lang="ts">
import type Konva from 'konva';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import EditableTextElement from './EditableTextElement.vue';
import type { EventTemplateProps } from '../domain/EventTemplateProps';
import {
    clampLayoutPosition,
    createLayoutOffsets,
    type LayoutElementId,
    type LayoutFrame,
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
}>();

const emit = defineEmits<{
    imageStatus: [status: ImageStatus];
    layoutChange: [changed: boolean];
    selectionChange: [elementId: LayoutElementId | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<VueKonvaRef<Konva.Stage> | null>(null);
const containerWidth = ref(DOCUMENT_WIDTH);
const image = shallowRef<HTMLImageElement | null>(null);
const imageStatus = ref<ImageStatus>('idle');
const selectedElement = ref<LayoutElementId | null>(null);
const isExporting = ref(false);
const layoutOffsets = ref<Record<TemplateId, ReturnType<typeof createLayoutOffsets>>>({
    split: createLayoutOffsets(),
    poster: createLayoutOffsets(),
});
let resizeObserver: ResizeObserver | undefined;

const previewScale = computed(() => calculatePreviewScale(containerWidth.value));
const stageConfig = computed(() => ({
    width: DOCUMENT_WIDTH * previewScale.value,
    height: DOCUMENT_HEIGHT * previewScale.value,
    scaleX: previewScale.value,
    scaleY: previewScale.value,
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
const currentLayoutChanged = computed(() =>
    Object.values(layoutOffsets.value[props.templateId]).some(({ x, y }) => x !== 0 || y !== 0),
);

const elementFrame = (elementId: LayoutElementId): LayoutFrame => {
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const offset = layoutOffsets.value[props.templateId][elementId];
    return {
        ...baseFrame,
        x: baseFrame.x + offset.x,
        y: baseFrame.y + offset.y,
    };
};

const selectElement = (elementId: LayoutElementId) => {
    selectedElement.value = elementId;
    emit('selectionChange', elementId);
};

const handleStagePointer = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const editableGroup = event.target.findAncestor('.editable-element', true);
    const elementId = editableGroup?.getAttr('layoutElementId') as LayoutElementId | undefined;

    if (elementId) {
        selectElement(elementId);
    }
};

const moveElement = (elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>) => {
    const baseFrame = TEMPLATE_ELEMENT_FRAMES[props.templateId][elementId];
    const position = clampLayoutPosition(event.target.position(), baseFrame);
    event.target.position(position);
    layoutOffsets.value[props.templateId][elementId] = {
        x: position.x - baseFrame.x,
        y: position.y - baseFrame.y,
    };
    emit('layoutChange', currentLayoutChanged.value);
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
        baseFrame,
    );
    layoutOffsets.value[props.templateId][elementId] = {
        x: position.x - baseFrame.x,
        y: position.y - baseFrame.y,
    };
    emit('layoutChange', currentLayoutChanged.value);
};

const resetLayout = () => {
    layoutOffsets.value[props.templateId] = createLayoutOffsets();
    selectedElement.value = null;
    emit('selectionChange', null);
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
        emit('selectionChange', null);
        emit('layoutChange', currentLayoutChanged.value);
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
        await nextTick();
        stage.size({ width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT });
        stage.scale({ x: 1, y: 1 });
        stage.draw();
        return stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    } finally {
        isExporting.value = false;
        stage.size({ width: previewState.width, height: previewState.height });
        stage.scale({ x: previewState.scaleX, y: previewState.scaleY });
        stage.draw();
    }
};

defineExpose({ exportPng, nudgeSelectedElement, resetLayout, selectElement });
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
                <EditableTextElement
                    element-id="title"
                    :frame="elementFrame('title')"
                    :selected="selectedElement === 'title' && !isExporting"
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
                    @move="moveElement"
                />
                <v-rect :config="{ x: 1030, y: 485, width: 120, height: 8, fill: '#f3b562' }" />
                <EditableTextElement
                    element-id="dateTime"
                    :frame="elementFrame('dateTime')"
                    :selected="selectedElement === 'dateTime' && !isExporting"
                    :text-config="{
                        text: dateAndTime,
                        fill: '#f3b562',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 42,
                        fontStyle: 'bold',
                        lineHeight: 1.25,
                    }"
                    @move="moveElement"
                />
                <EditableTextElement
                    v-if="template.location"
                    element-id="location"
                    :frame="elementFrame('location')"
                    :selected="selectedElement === 'location' && !isExporting"
                    :text-config="{
                        text: template.location,
                        fill: '#d8dee8',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 36,
                        lineHeight: 1.35,
                        wrap: 'word',
                        ellipsis: true,
                    }"
                    @move="moveElement"
                />
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
                <EditableTextElement
                    element-id="title"
                    :frame="elementFrame('title')"
                    :selected="selectedElement === 'title' && !isExporting"
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
                    @move="moveElement"
                />
                <v-rect :config="{ x: 820, y: 610, width: 280, height: 8, fill: '#f3b562' }" />
                <EditableTextElement
                    element-id="dateTime"
                    :frame="elementFrame('dateTime')"
                    :selected="selectedElement === 'dateTime' && !isExporting"
                    :text-config="{
                        text: dateAndTime,
                        align: 'center',
                        fill: '#f7c77f',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 50,
                        fontStyle: 'bold',
                    }"
                    @move="moveElement"
                />
                <EditableTextElement
                    v-if="template.location"
                    element-id="location"
                    :frame="elementFrame('location')"
                    :selected="selectedElement === 'location' && !isExporting"
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
                    @move="moveElement"
                />
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
        </v-stage>
    </div>
</template>
