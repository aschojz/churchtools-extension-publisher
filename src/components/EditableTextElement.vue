<script setup lang="ts">
import type Konva from 'konva';
import { Blur } from 'konva/lib/filters/Blur';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { LayoutElementEffects, LayoutElementId, LayoutFrame } from '../domain/layoutEditing';
import { layoutFilterStackHasEnabled, type LayoutFilterStack } from '../domain/layoutFilters';
import { configureLayoutKonvaFilterValues, layoutKonvaFilterFunctions } from '../utils/layoutKonvaFilters';

const props = withDefaults(defineProps<{
    elementId: LayoutElementId;
    editorScale: number;
    effects: LayoutElementEffects;
    filters: LayoutFilterStack;
    decorationLines: Konva.LineConfig[];
    frame: LayoutFrame;
    graphicText: boolean;
    instanceKey?: string;
    interactive?: boolean;
    locked: boolean;
    rotation: number;
    selected: boolean;
    textConfig: Konva.TextConfig;
}>(), { instanceKey: '', interactive: true });

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

const syncFilters = async () => {
    await nextTick();
    const node = effectGroupRef.value?.getNode();
    if (!node) return;
    node.clearCache();
    node.filters([]);
    node.blurRadius(0);
    configureLayoutKonvaFilterValues(node, props.filters);
    const blurEnabled = props.effects.blur.enabled && props.effects.blur.radius > 0;
    const filters = [
        ...(blurEnabled ? [Blur] : []),
        ...layoutKonvaFilterFunctions(props.filters),
    ];
    if (blurEnabled || layoutFilterStackHasEnabled(props.filters)) {
        const radius = props.effects.blur.radius;
        node.cache({ pixelRatio: 1, offset: blurEnabled ? Math.ceil(radius * 2) : 0 });
        node.filters(filters);
        if (blurEnabled) node.blurRadius(radius);
    }
    node.getLayer()?.batchDraw();
};
watch(() => [
    props.effects.blur.enabled, props.effects.blur.radius,
    props.filters,
    props.frame.width, props.frame.height,
    props.textConfig.text, props.textConfig.fill, props.textConfig.stroke,
    props.textConfig.strokeWidth, props.textConfig.fontSize, props.textConfig.fontFamily,
    props.textConfig.fontStyle, props.textConfig.lineHeight, props.textConfig.letterSpacing,
], syncFilters, { deep: true, immediate: true });
onBeforeUnmount(() => effectGroupRef.value?.getNode()?.clearCache());

const emit = defineEmits<{
    dragStart: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    dragging: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    move: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    resize: [elementId: LayoutElementId, event: Konva.KonvaEventObject<Event>];
}>();

const startDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    emit('dragStart', props.elementId, event);
};

const handleDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    emit('dragging', props.elementId, event);
};

const finishDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    emit('move', props.elementId, event);
};

const finishTransform = (event: Konva.KonvaEventObject<Event>) => {
    emit('resize', props.elementId, event);
};
</script>

<template>
    <v-group
        :config="{
            x: frame.x,
            y: frame.y,
            draggable: interactive && !locked,
            id: `editable-${elementId}${instanceKey}`,
            name: 'editable-element',
            layoutElementId: interactive ? elementId : undefined,
            listening: interactive,
            rotation,
        }"
        @dragstart="startDrag"
        @dragmove="handleDrag"
        @dragend="finishDrag"
        @transformend="finishTransform"
    >
        <v-rect
            :config="{
                x: 0,
                y: 0,
                width: frame.width,
                height: frame.height,
                fill: 'rgba(0, 0, 0, 0.01)',
                stroke: selected ? '#4da3ff' : undefined,
                strokeWidth: 1.5 / editorScale,
                dash: [6 / editorScale, 4 / editorScale],
            }"
        />
        <v-group ref="effectGroupRef" :config="effectLayerConfig">
            <v-text
                :config="graphicText
                    ? { ...textConfig, ...shadowConfig, x: 0, y: 0, listening: false }
                    : { ...textConfig, ...shadowConfig, x: 0, y: 0, width: frame.width, height: frame.height, listening: false }"
            />
            <v-line v-for="(line, index) in decorationLines" :key="index" :config="{ ...line, ...shadowConfig, listening: false }" />
        </v-group>
    </v-group>
</template>
