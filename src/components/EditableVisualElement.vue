<script setup lang="ts">
import type Konva from 'konva';

import type { LayoutElementId, LayoutFrame } from '../domain/layoutEditing';

const props = defineProps<{
    elementId: LayoutElementId;
    editorScale: number;
    frame: LayoutFrame;
    imageConfig?: Konva.ImageConfig | null;
    rotation: number;
    selected: boolean;
    visualConfig?: Konva.RectConfig | null;
    zIndex: number;
}>();

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
            draggable: true,
            id: `editable-${elementId}`,
            name: 'editable-element',
            layoutElementId: elementId,
            rotation,
            zIndex,
        }"
        @dragstart="emit('dragStart', elementId, $event)"
        @dragmove="emit('dragging', elementId, $event)"
        @dragend="emit('move', elementId, $event)"
        @transformend="emit('resize', elementId, $event)"
    >
        <v-image
            v-if="imageConfig"
            :config="{ ...imageConfig, x: 0, y: 0, width: frame.width, height: frame.height, listening: false }"
        />
        <v-rect
            v-else-if="visualConfig"
            :config="{ ...visualConfig, x: 0, y: 0, width: frame.width, height: frame.height, listening: false }"
        />
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
