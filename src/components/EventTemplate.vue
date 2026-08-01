<script setup lang="ts">
import type Konva from 'konva';
import type { VueKonvaRef } from 'vue-konva';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import type { EventTemplateProps } from '../domain/EventTemplateProps';
import {
    calculatePreviewScale,
    DOCUMENT_HEIGHT,
    DOCUMENT_WIDTH,
} from '../utils/stageDimensions';

type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

const props = defineProps<{
    template: EventTemplateProps;
}>();

const emit = defineEmits<{
    imageStatus: [status: ImageStatus];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<VueKonvaRef<Konva.Stage> | null>(null);
const containerWidth = ref(DOCUMENT_WIDTH);
const image = shallowRef<HTMLImageElement | null>(null);
const imageStatus = ref<ImageStatus>('idle');
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

    const frameWidth = 920;
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
    width: 920,
    height: DOCUMENT_HEIGHT,
    crop: imageCrop.value,
}));

const dateAndTime = computed(() => [props.template.date, props.template.time].filter(Boolean).join(' · '));

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
        stage.size({ width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT });
        stage.scale({ x: 1, y: 1 });
        stage.draw();
        return stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    } finally {
        stage.size({ width: previewState.width, height: previewState.height });
        stage.scale({ x: previewState.scaleX, y: previewState.scaleY });
        stage.draw();
    }
};

defineExpose({ exportPng });
</script>

<template>
    <div ref="containerRef" class="template-preview">
        <v-stage ref="stageRef" :config="stageConfig">
            <v-layer>
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
                <v-text
                    :config="{
                        x: 1030,
                        y: 130,
                        width: 760,
                        height: 310,
                        text: template.title,
                        fill: '#ffffff',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 88,
                        fontStyle: 'bold',
                        lineHeight: 1.08,
                        wrap: 'word',
                        ellipsis: true,
                    }"
                />
                <v-rect :config="{ x: 1030, y: 485, width: 120, height: 8, fill: '#f3b562' }" />
                <v-text
                    :config="{
                        x: 1030,
                        y: 555,
                        width: 760,
                        text: dateAndTime,
                        fill: '#f3b562',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 42,
                        fontStyle: 'bold',
                        lineHeight: 1.25,
                    }"
                />
                <v-text
                    v-if="template.location"
                    :config="{
                        x: 1030,
                        y: 700,
                        width: 760,
                        height: 170,
                        text: template.location,
                        fill: '#d8dee8',
                        fontFamily: 'Lato, Arial, sans-serif',
                        fontSize: 36,
                        lineHeight: 1.35,
                        wrap: 'word',
                        ellipsis: true,
                    }"
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
        </v-stage>
    </div>
</template>
