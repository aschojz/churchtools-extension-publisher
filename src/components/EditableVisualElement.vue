<script setup lang="ts">
import type Konva from 'konva';
import { Blur } from 'konva/lib/filters/Blur';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { LayoutElementEffects, LayoutElementId, LayoutFrame } from '../domain/layoutEditing';

const props = defineProps<{
    elementId: LayoutElementId;
    editorScale: number;
    effects: LayoutElementEffects;
    frame: LayoutFrame;
    imageConfig?: Konva.ImageConfig | null;
    locked: boolean;
    pathConfig?: Konva.PathConfig | null;
    rotation: number;
    selected: boolean;
    shape?: 'rectangle' | 'circle' | 'triangle' | 'line';
    visualConfig?: Konva.RectConfig | null;
}>();

const effectGroupRef = ref<VueKonvaRef<Konva.Group> | null>(null);
const effectLayerConfig = computed(() => ({
    opacity: props.effects.opacity,
    globalCompositeOperation: props.effects.blendMode,
}));
const shadowConfig = computed<Konva.ShapeConfig>(() => props.effects.shadow.enabled ? {
    shadowEnabled: true,
    shadowColor: props.effects.shadow.color,
    shadowBlur: props.effects.shadow.blur,
    shadowOffsetX: props.effects.shadow.offsetX,
    shadowOffsetY: props.effects.shadow.offsetY,
    shadowOpacity: props.effects.shadow.opacity,
    shadowForStrokeEnabled: props.effects.shadow.forStroke,
} : { shadowEnabled: false });

const syncBlur = async () => {
    await nextTick();
    const node = effectGroupRef.value?.getNode();
    if (!node) return;
    node.clearCache();
    node.filters([]);
    node.blurRadius(0);
    if (props.effects.blur.enabled && props.effects.blur.radius > 0) {
        const radius = props.effects.blur.radius;
        node.cache({ pixelRatio: 1, offset: Math.ceil(radius * 2) });
        node.filters([Blur]);
        node.blurRadius(radius);
    }
    node.getLayer()?.batchDraw();
};
watch(() => [
    props.effects.blur.enabled, props.effects.blur.radius,
    props.frame.width, props.frame.height,
    props.visualConfig?.fill, props.visualConfig?.stroke, props.visualConfig?.strokeWidth,
    props.pathConfig?.data, props.imageConfig?.image,
], syncBlur, { immediate: true });
onBeforeUnmount(() => effectGroupRef.value?.getNode()?.clearCache());

const emit = defineEmits<{
    dragStart: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    dragging: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    move: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    resize: [elementId: LayoutElementId, event: Konva.KonvaEventObject<Event>];
}>();
</script>

<template>
    <v-group
        :config="{
            x: frame.x,
            y: frame.y,
            draggable: !locked,
            id: `editable-${elementId}`,
            name: 'editable-element',
            layoutElementId: elementId,
            rotation,
        }"
        @dragstart="emit('dragStart', elementId, $event)"
        @dragmove="emit('dragging', elementId, $event)"
        @dragend="emit('move', elementId, $event)"
        @transformend="emit('resize', elementId, $event)"
    >
        <v-group ref="effectGroupRef" :config="effectLayerConfig">
            <v-image
                v-if="imageConfig"
                :config="{ ...imageConfig, ...shadowConfig, x: 0, y: 0, width: frame.width, height: frame.height, listening: false }"
            />
            <v-path v-else-if="pathConfig" :config="{ ...pathConfig, ...shadowConfig, listening: false }" />
            <v-ellipse
                v-else-if="visualConfig && shape === 'circle'"
                :config="{ ...visualConfig, ...shadowConfig, x: frame.width / 2, y: frame.height / 2, radiusX: frame.width / 2, radiusY: frame.height / 2, listening: false }"
            />
            <v-regular-polygon
                v-else-if="visualConfig && shape === 'triangle'"
                :config="{ ...visualConfig, ...shadowConfig, x: frame.width / 2, y: frame.height / 2, radius: Math.min(frame.width, frame.height) / 2, sides: 3, rotation: -90, listening: false }"
            />
            <v-line
                v-else-if="visualConfig && shape === 'line'"
                :config="{ ...shadowConfig, points: [0, frame.height / 2, frame.width, frame.height / 2], stroke: visualConfig.stroke, strokeWidth: visualConfig.strokeWidth, lineCap: 'butt', listening: false }"
            />
            <v-rect
                v-else-if="visualConfig"
                :config="{ ...visualConfig, ...shadowConfig, x: 0, y: 0, width: frame.width, height: frame.height, listening: false }"
            />
        </v-group>
        <v-rect
            :config="{
                x: 0,
                y: 0,
                width: frame.width,
                height: frame.height,
                fill: 'rgba(0, 0, 0, 0.001)',
                stroke: selected ? '#4da3ff' : undefined,
                strokeWidth: 1.5 / editorScale,
                dash: [6 / editorScale, 4 / editorScale],
            }"
        />
    </v-group>
</template>
