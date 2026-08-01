<script setup lang="ts">
import type Konva from 'konva';

import type { LayoutElementId, LayoutFrame } from '../domain/layoutEditing';

const props = defineProps<{
    elementId: LayoutElementId;
    frame: LayoutFrame;
    rotation: number;
    selected: boolean;
    textConfig: Konva.TextConfig;
    zIndex: number;
}>();

const emit = defineEmits<{
    move: [elementId: LayoutElementId, event: Konva.KonvaEventObject<DragEvent>];
    resize: [elementId: LayoutElementId, event: Konva.KonvaEventObject<Event>];
}>();

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
            draggable: true,
            id: `editable-${elementId}`,
            name: 'editable-element',
            layoutElementId: elementId,
            rotation,
            zIndex,
        }"
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
                strokeWidth: 6,
                dash: [18, 12],
            }"
        />
        <v-text :config="{ ...textConfig, x: 0, y: 0, width: frame.width, height: frame.height, listening: false }" />
    </v-group>
</template>
