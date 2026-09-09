<script setup lang="ts">
import type Konva from 'konva';
import { computed } from 'vue';

import {
    normalizeLayoutElementEffects,
    type LayoutElementId,
    type LayoutEffects,
    type LayoutFrame,
    type LayoutLayerTreeNode,
    type LayoutPoint,
} from '../domain/layoutEditing';
import { normalizeLayoutFilterStack, type LayoutFilters } from '../domain/layoutFilters';
import EditableLayoutGroup from './EditableLayoutGroup.vue';

const props = withDefaults(defineProps<{
    draggableGroupIds?: string[];
    editorScale: number;
    effects?: LayoutEffects;
    filters?: LayoutFilters;
    groupFrames: Record<string, LayoutFrame>;
    lockedElementIds?: string[];
    nodes: LayoutLayerTreeNode[];
    origin?: LayoutPoint;
    renderRevision: string;
    selectedGroupId?: string | null;
}>(), {
    draggableGroupIds: () => [],
    effects: () => ({}),
    filters: () => ({}),
    lockedElementIds: () => [],
    origin: () => ({ x: 0, y: 0 }),
    selectedGroupId: null,
});
defineSlots<{
    element(props: { elementId: LayoutElementId; origin: LayoutPoint }): unknown;
    'before-element'(props: { elementId: LayoutElementId; origin: LayoutPoint }): unknown;
    'after-element'(props: { elementId: LayoutElementId; origin: LayoutPoint }): unknown;
}>();

const renderNodes = computed(() => [...props.nodes].reverse());
const localGroupFrame = (groupId: string) => {
    const frame = props.groupFrames[groupId];
    return frame ? { ...frame, x: frame.x - props.origin.x, y: frame.y - props.origin.y } : null;
};
const groupIsLocked = (elementIds: string[]) => elementIds.some((id) => props.lockedElementIds.includes(id));

const emit = defineEmits<{
    groupDragStart: [groupId: string, event: Konva.KonvaEventObject<DragEvent>];
    groupDragging: [groupId: string, event: Konva.KonvaEventObject<DragEvent>];
    groupMove: [groupId: string, event: Konva.KonvaEventObject<DragEvent>];
    groupTransform: [groupId: string, event: Konva.KonvaEventObject<Event>];
}>();
</script>

<template>
    <template v-for="node in renderNodes" :key="`${node.kind}-${node.id}`">
        <template v-if="node.kind === 'element'">
            <slot name="before-element" :element-id="node.elementId" :origin="origin" />
            <slot name="element" :element-id="node.elementId" :origin="origin" />
            <slot name="after-element" :element-id="node.elementId" :origin="origin" />
        </template>
        <EditableLayoutGroup
            v-else-if="localGroupFrame(node.id)"
            :draggable="draggableGroupIds.includes(node.id)"
            :editor-scale="editorScale"
            :effects="normalizeLayoutElementEffects(effects[node.id])"
            :filters="normalizeLayoutFilterStack(filters[node.id])"
            :frame="localGroupFrame(node.id)!"
            :group-id="node.id"
            :locked="groupIsLocked(node.elementIds)"
            :render-revision="renderRevision"
            :selected="selectedGroupId === node.id"
            @drag-start="(groupId, event) => emit('groupDragStart', groupId, event)"
            @dragging="(groupId, event) => emit('groupDragging', groupId, event)"
            @move="(groupId, event) => emit('groupMove', groupId, event)"
            @transform="(groupId, event) => emit('groupTransform', groupId, event)"
        >
            <CanvasSceneTree
                :draggable-group-ids="draggableGroupIds"
                :editor-scale="editorScale"
                :effects="effects"
                :filters="filters"
                :group-frames="groupFrames"
                :locked-element-ids="lockedElementIds"
                :nodes="node.children"
                :origin="groupFrames[node.id]"
                :render-revision="renderRevision"
                :selected-group-id="selectedGroupId"
                @group-drag-start="(groupId, event) => emit('groupDragStart', groupId, event)"
                @group-dragging="(groupId, event) => emit('groupDragging', groupId, event)"
                @group-move="(groupId, event) => emit('groupMove', groupId, event)"
                @group-transform="(groupId, event) => emit('groupTransform', groupId, event)"
            >
                <template #element="{ elementId, origin: elementOrigin }">
                    <slot name="element" :element-id="elementId" :origin="elementOrigin" />
                </template>
                <template #before-element="{ elementId, origin: elementOrigin }">
                    <slot name="before-element" :element-id="elementId" :origin="elementOrigin" />
                </template>
                <template #after-element="{ elementId, origin: elementOrigin }">
                    <slot name="after-element" :element-id="elementId" :origin="elementOrigin" />
                </template>
            </CanvasSceneTree>
        </EditableLayoutGroup>
    </template>
</template>
