<script setup lang="ts">
import type Konva from 'konva';
import { Blur } from 'konva/lib/filters/Blur';
import type { VueKonvaRef } from 'vue-konva';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import {
    layoutElementHasEffects,
    type LayoutElementEffects,
    type LayoutFrame,
} from '../domain/layoutEditing';
import { layoutFilterStackHasEnabled, type LayoutFilterStack } from '../domain/layoutFilters';
import { configureLayoutKonvaFilterValues, layoutKonvaFilterFunctions } from '../utils/layoutKonvaFilters';

const props = withDefaults(defineProps<{
    draggable: boolean;
    editorScale: number;
    effects: LayoutElementEffects;
    filters: LayoutFilterStack;
    frame: LayoutFrame;
    groupId: string;
    instanceKey?: string;
    interactive?: boolean;
    locked: boolean;
    renderRevision: string;
    selected: boolean;
}>(), { instanceKey: '', interactive: true });

const effectGroupRef = ref<VueKonvaRef<Konva.Group> | null>(null);
const effectConfig = computed(() => ({
    name: 'editable-layout-group-effect',
    opacity: props.effects.opacity,
    globalCompositeOperation: props.effects.blendMode,
    shadowEnabled: props.effects.shadow.enabled,
    shadowColor: props.effects.shadow.color,
    shadowBlur: props.effects.shadow.blur,
    shadowOffsetX: props.effects.shadow.offsetX,
    shadowOffsetY: props.effects.shadow.offsetY,
    shadowOpacity: props.effects.shadow.opacity,
}));

const syncCompositeEffects = async () => {
    await nextTick();
    const node = effectGroupRef.value?.getNode();
    if (!node) return;
    node.clearCache();
    node.filters([]);
    node.blurRadius(0);
    configureLayoutKonvaFilterValues(node, props.filters);
    const blurEnabled = props.effects.blur.enabled && props.effects.blur.radius > 0;
    const hasRasterEffects = layoutElementHasEffects(props.effects) && (props.effects.shadow.enabled || blurEnabled);
    const hasFilters = layoutFilterStackHasEnabled(props.filters);
    if (hasRasterEffects || hasFilters) {
        const padding = Math.ceil(Math.max(
            blurEnabled ? props.effects.blur.radius * 2 : 0,
            props.effects.shadow.enabled
                ? props.effects.shadow.blur * 2 + Math.max(Math.abs(props.effects.shadow.offsetX), Math.abs(props.effects.shadow.offsetY))
                : 0,
        ));
        node.cache({
            x: -padding,
            y: -padding,
            width: props.frame.width + padding * 2,
            height: props.frame.height + padding * 2,
            pixelRatio: 1,
        });
        const filters = [
            ...(blurEnabled ? [Blur] : []),
            ...layoutKonvaFilterFunctions(props.filters),
        ];
        if (filters.length > 0) {
            node.filters(filters);
        }
        if (blurEnabled) {
            node.blurRadius(props.effects.blur.radius);
        }
    }
    node.getLayer()?.batchDraw();
};

watch(() => [props.effects, props.filters, props.frame.width, props.frame.height, props.renderRevision], syncCompositeEffects, {
    deep: true,
    immediate: true,
});
onBeforeUnmount(() => effectGroupRef.value?.getNode()?.clearCache());

const emit = defineEmits<{
    dragStart: [groupId: string, event: Konva.KonvaEventObject<DragEvent>];
    dragging: [groupId: string, event: Konva.KonvaEventObject<DragEvent>];
    move: [groupId: string, event: Konva.KonvaEventObject<DragEvent>];
    transform: [groupId: string, event: Konva.KonvaEventObject<Event>];
}>();
const emitGroupEvent = (
    name: 'dragStart' | 'dragging' | 'move',
    event: Konva.KonvaEventObject<DragEvent>,
) => {
    event.cancelBubble = true;
    if (name === 'dragStart') emit('dragStart', props.groupId, event);
    else if (name === 'dragging') emit('dragging', props.groupId, event);
    else emit('move', props.groupId, event);
};
const emitTransform = (event: Konva.KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    emit('transform', props.groupId, event);
};
</script>

<template>
    <v-group
        :config="{
            x: frame.x + frame.width / 2,
            y: frame.y + frame.height / 2,
            offsetX: frame.width / 2,
            offsetY: frame.height / 2,
            width: frame.width,
            height: frame.height,
            draggable: draggable && !locked,
            id: `editable-group-${groupId}${instanceKey}`,
            name: 'editable-layout-group',
            layoutGroupId: interactive ? groupId : undefined,
            listening: interactive,
        }"
        @dragstart="emitGroupEvent('dragStart', $event)"
        @dragmove="emitGroupEvent('dragging', $event)"
        @dragend="emitGroupEvent('move', $event)"
        @transformend="emitTransform"
    >
        <v-group ref="effectGroupRef" :config="effectConfig">
            <slot />
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
                listening: false,
            }"
        />
    </v-group>
</template>
