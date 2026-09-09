<script setup lang="ts">
import type Konva from 'konva';
import { computed } from 'vue';

import type { LayoutFrame, LayoutPoint } from '../domain/layoutEditing';
import type { LayoutGradient } from '../domain/layoutGradient';
import {
    layoutGradientCanvasGeometry,
    updateLayoutGradientPoint,
    updateLayoutGradientRadius,
    updateLayoutGradientStopOffset,
    type LayoutGradientCoordinateSpace,
} from '../domain/layoutGradientGeometry';
import { usePublisherImagePalettesStore } from '../stores/publisherImagePalettes';

const props = defineProps<{
    editorScale: number;
    frame: LayoutFrame;
    gradient: LayoutGradient;
    rotation: number;
    rotationOrigin?: LayoutPoint;
}>();

const emit = defineEmits<{
    editEnd: [];
    editStart: [];
    update: [gradient: LayoutGradient];
}>();

const imagePalettesStore = usePublisherImagePalettesStore();
const coordinateSpace = computed<LayoutGradientCoordinateSpace>(() => ({
    frame: props.frame,
    rotation: props.rotation,
    ...(props.rotationOrigin ? { rotationOrigin: props.rotationOrigin } : {}),
}));
const geometry = computed(() => layoutGradientCanvasGeometry(props.gradient, coordinateSpace.value));
const handleRadius = computed(() => 5 / props.editorScale);
const smallHandleRadius = computed(() => 4 / props.editorScale);
const strokeWidth = computed(() => 1.25 / props.editorScale);
const hitStrokeWidth = computed(() => 18 / props.editorScale);

const cancelBubble = (event: Konva.KonvaEventObject<Event>) => {
    event.cancelBubble = true;
};
const beginEdit = (event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    emit('editStart');
};
const pointFromEvent = (event: Konva.KonvaEventObject<DragEvent>): LayoutPoint => ({
    x: event.target.x(),
    y: event.target.y(),
});
const updatePoint = (target: 'start' | 'end', event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    emit('update', updateLayoutGradientPoint(props.gradient, coordinateSpace.value, target, pointFromEvent(event)));
};
const updateRadius = (target: 'start' | 'end', event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    emit('update', updateLayoutGradientRadius(props.gradient, coordinateSpace.value, target, pointFromEvent(event)));
};
const updateStop = (stopId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    emit('update', updateLayoutGradientStopOffset(props.gradient, coordinateSpace.value, stopId, pointFromEvent(event)));
};
const finishPointEdit = (target: 'start' | 'end', event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    updatePoint(target, event);
    emit('editEnd');
};
const finishRadiusEdit = (target: 'start' | 'end', event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    updateRadius(target, event);
    emit('editEnd');
};
const finishStopEdit = (stopId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    updateStop(stopId, event);
    emit('editEnd');
};
const stopMarkerPoint = (point: LayoutPoint) => {
    const delta = {
        x: geometry.value.guideEnd.x - geometry.value.guideStart.x,
        y: geometry.value.guideEnd.y - geometry.value.guideStart.y,
    };
    const length = Math.hypot(delta.x, delta.y);
    const offset = 12 / props.editorScale;
    return length > 0.001
        ? { x: point.x - delta.y / length * offset, y: point.y + delta.x / length * offset }
        : { x: point.x, y: point.y + offset };
};
const stopColor = (stopId: string) => {
    const stop = props.gradient.stops.find(({ id }) => id === stopId);
    return stop ? imagePalettesStore.resolveColor(stop.colorBinding, stop.color) : '#ffffff';
};
const radiusMarkerPoint = (center: LayoutPoint, handle: LayoutPoint) => {
    const delta = { x: handle.x - center.x, y: handle.y - center.y };
    const length = Math.hypot(delta.x, delta.y);
    const minimumLength = 14 / props.editorScale;
    if (length >= minimumLength) return handle;
    const guideDelta = {
        x: geometry.value.guideEnd.x - geometry.value.guideStart.x,
        y: geometry.value.guideEnd.y - geometry.value.guideStart.y,
    };
    const guideLength = Math.hypot(guideDelta.x, guideDelta.y);
    const direction = guideLength > 0.001
        ? { x: guideDelta.x / guideLength, y: guideDelta.y / guideLength }
        : { x: 1, y: 0 };
    return {
        x: center.x + direction.x * minimumLength,
        y: center.y + direction.y * minimumLength,
    };
};
</script>

<template>
    <v-group :config="{ name: 'publisher-gradient-handles' }">
        <v-line
            :config="{
                points: [geometry.guideStart.x, geometry.guideStart.y, geometry.guideEnd.x, geometry.guideEnd.y],
                stroke: '#2479c5',
                strokeWidth,
                dash: [6 / editorScale, 4 / editorScale],
                listening: false,
            }"
        />
        <template v-if="gradient.type === 'radial'">
            <v-circle
                :config="{
                    x: geometry.start.x,
                    y: geometry.start.y,
                    radius: gradient.startRadius * Math.max(frame.width, frame.height) / 100,
                    stroke: '#2479c5',
                    strokeWidth,
                    dash: [6 / editorScale, 4 / editorScale],
                    listening: false,
                }"
            />
            <v-circle
                :config="{
                    x: geometry.end.x,
                    y: geometry.end.y,
                    radius: gradient.endRadius * Math.max(frame.width, frame.height) / 100,
                    stroke: '#2479c5',
                    strokeWidth,
                    listening: false,
                }"
            />
            <v-circle
                :config="{ x: geometry.start.x, y: geometry.start.y, radius: smallHandleRadius, fill: '#ffffff', stroke: '#2479c5', strokeWidth, hitStrokeWidth, draggable: true }"
                @mousedown="cancelBubble"
                @touchstart="cancelBubble"
                @dragstart="beginEdit"
                @dragmove="updatePoint('start', $event)"
                @dragend="finishPointEdit('start', $event)"
            />
            <v-circle
                :config="{ x: geometry.end.x, y: geometry.end.y, radius: smallHandleRadius, fill: '#2479c5', stroke: '#ffffff', strokeWidth, hitStrokeWidth, draggable: true }"
                @mousedown="cancelBubble"
                @touchstart="cancelBubble"
                @dragstart="beginEdit"
                @dragmove="updatePoint('end', $event)"
                @dragend="finishPointEdit('end', $event)"
            />
            <v-rect
                :config="{ ...radiusMarkerPoint(geometry.start, geometry.startRadiusHandle), width: handleRadius * 2, height: handleRadius * 2, offsetX: handleRadius, offsetY: handleRadius, fill: '#ffffff', stroke: '#2479c5', strokeWidth, hitStrokeWidth, draggable: true }"
                @mousedown="cancelBubble"
                @touchstart="cancelBubble"
                @dragstart="beginEdit"
                @dragmove="updateRadius('start', $event)"
                @dragend="finishRadiusEdit('start', $event)"
            />
            <v-rect
                :config="{ ...radiusMarkerPoint(geometry.end, geometry.endRadiusHandle), width: handleRadius * 2, height: handleRadius * 2, offsetX: handleRadius, offsetY: handleRadius, fill: '#2479c5', stroke: '#ffffff', strokeWidth, hitStrokeWidth, draggable: true }"
                @mousedown="cancelBubble"
                @touchstart="cancelBubble"
                @dragstart="beginEdit"
                @dragmove="updateRadius('end', $event)"
                @dragend="finishRadiusEdit('end', $event)"
            />
        </template>
        <template v-else>
            <v-circle
                :config="{ x: geometry.start.x, y: geometry.start.y, radius: handleRadius, fill: '#ffffff', stroke: '#2479c5', strokeWidth, hitStrokeWidth, draggable: true }"
                @mousedown="cancelBubble"
                @touchstart="cancelBubble"
                @dragstart="beginEdit"
                @dragmove="updatePoint('start', $event)"
                @dragend="finishPointEdit('start', $event)"
            />
            <v-circle
                :config="{ x: geometry.end.x, y: geometry.end.y, radius: handleRadius, fill: '#2479c5', stroke: '#ffffff', strokeWidth, hitStrokeWidth, draggable: true }"
                @mousedown="cancelBubble"
                @touchstart="cancelBubble"
                @dragstart="beginEdit"
                @dragmove="updatePoint('end', $event)"
                @dragend="finishPointEdit('end', $event)"
            />
        </template>
        <v-regular-polygon
            v-for="stop in geometry.stops"
            :key="stop.id"
            :config="{
                ...stopMarkerPoint(stop.point),
                sides: 4,
                radius: handleRadius,
                rotation: 45,
                fill: stopColor(stop.id),
                stroke: '#ffffff',
                strokeWidth,
                hitStrokeWidth,
                shadowColor: '#000000',
                shadowBlur: 2 / editorScale,
                shadowOpacity: 0.5,
                draggable: true,
            }"
            @mousedown="cancelBubble"
            @touchstart="cancelBubble"
            @dragstart="beginEdit"
            @dragmove="updateStop(stop.id, $event)"
            @dragend="finishStopEdit(stop.id, $event)"
        />
    </v-group>
</template>
