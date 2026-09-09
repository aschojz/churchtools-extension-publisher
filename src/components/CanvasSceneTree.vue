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
import type { LayoutGroupRepeat } from '../domain/layoutEditing';
import { normalizeLayoutFilterStack, type LayoutFilters } from '../domain/layoutFilters';
import { createLayoutRepeatInstances } from '../domain/layoutRepeat';
import type { PublisherDataValues } from '../domain/appointmentDataFields';
import EditableLayoutGroup from './EditableLayoutGroup.vue';

const props = withDefaults(defineProps<{
    draggableGroupIds?: string[];
    editorScale: number;
    effects?: LayoutEffects;
    filters?: LayoutFilters;
    dataValues?: PublisherDataValues;
    groupFrames: Record<string, LayoutFrame>;
    groupRepeats?: Record<string, LayoutGroupRepeat>;
    instanceKey?: string;
    interactive?: boolean;
    lockedElementIds?: string[];
    nodes: LayoutLayerTreeNode[];
    origin?: LayoutPoint;
    prototypeGroupFrames?: Record<string, LayoutFrame>;
    renderRevision: string;
    selectedGroupId?: string | null;
    showEmptyRepeatPrototype?: boolean;
}>(), {
    dataValues: () => ({}),
    draggableGroupIds: () => [],
    effects: () => ({}),
    filters: () => ({}),
    groupRepeats: () => ({}),
    instanceKey: '',
    interactive: true,
    lockedElementIds: () => [],
    origin: () => ({ x: 0, y: 0 }),
    prototypeGroupFrames: () => ({}),
    selectedGroupId: null,
    showEmptyRepeatPrototype: false,
});
defineSlots<{
    element(props: { dataValues: PublisherDataValues; elementId: LayoutElementId; instanceKey: string; interactive: boolean; origin: LayoutPoint }): unknown;
    'before-element'(props: { dataValues: PublisherDataValues; elementId: LayoutElementId; instanceKey: string; interactive: boolean; origin: LayoutPoint }): unknown;
    'after-element'(props: { dataValues: PublisherDataValues; elementId: LayoutElementId; instanceKey: string; interactive: boolean; origin: LayoutPoint }): unknown;
}>();

const renderNodes = computed(() => [...props.nodes].reverse());
const localGroupFrame = (groupId: string) => {
    const frame = props.groupFrames[groupId];
    return frame ? { ...frame, x: frame.x - props.origin.x, y: frame.y - props.origin.y } : null;
};
const groupIsLocked = (elementIds: string[]) => elementIds.some((id) => props.lockedElementIds.includes(id));
const repeatInstances = (groupId: string) => {
    const repeat = props.groupRepeats[groupId];
    const frame = props.prototypeGroupFrames[groupId];
    return repeat && frame
        ? createLayoutRepeatInstances({ id: groupId, children: [], repeat }, frame, props.dataValues, props.showEmptyRepeatPrototype)
        : [];
};
const repeatInstancePosition = (groupId: string, offset: LayoutPoint) => {
    const prototype = props.prototypeGroupFrames[groupId]!;
    const frame = props.groupFrames[groupId]!;
    return { x: prototype.x + offset.x - frame.x, y: prototype.y + offset.y - frame.y };
};

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
            <slot name="before-element" :data-values="dataValues" :element-id="node.elementId" :instance-key="instanceKey" :interactive="interactive" :origin="origin" />
            <slot name="element" :data-values="dataValues" :element-id="node.elementId" :instance-key="instanceKey" :interactive="interactive" :origin="origin" />
            <slot name="after-element" :data-values="dataValues" :element-id="node.elementId" :instance-key="instanceKey" :interactive="interactive" :origin="origin" />
        </template>
        <EditableLayoutGroup
            v-else-if="localGroupFrame(node.id)"
            :draggable="interactive && draggableGroupIds.includes(node.id)"
            :editor-scale="editorScale"
            :effects="normalizeLayoutElementEffects(effects[node.id])"
            :filters="normalizeLayoutFilterStack(filters[node.id])"
            :frame="localGroupFrame(node.id)!"
            :group-id="node.id"
            :instance-key="instanceKey"
            :interactive="interactive"
            :locked="groupIsLocked(node.elementIds)"
            :render-revision="renderRevision"
            :selected="interactive && selectedGroupId === node.id"
            @drag-start="(groupId, event) => emit('groupDragStart', groupId, event)"
            @dragging="(groupId, event) => emit('groupDragging', groupId, event)"
            @move="(groupId, event) => emit('groupMove', groupId, event)"
            @transform="(groupId, event) => emit('groupTransform', groupId, event)"
        >
            <template v-if="groupRepeats[node.id]">
                <v-group
                    v-for="instance in repeatInstances(node.id)"
                    :key="instance.key"
                    :config="{ ...repeatInstancePosition(node.id, instance.offset), listening: interactive && instance.index === 0 }"
                >
                    <CanvasSceneTree
                        :data-values="instance.dataValues"
                        :draggable-group-ids="draggableGroupIds"
                        :editor-scale="editorScale"
                        :effects="effects"
                        :filters="filters"
                        :group-frames="groupFrames"
                        :group-repeats="groupRepeats"
                        :instance-key="instance.index === 0 ? instanceKey : `${instanceKey}-${instance.key}`"
                        :interactive="interactive && instance.index === 0"
                        :locked-element-ids="lockedElementIds"
                        :nodes="node.children"
                        :origin="prototypeGroupFrames[node.id]"
                        :prototype-group-frames="prototypeGroupFrames"
                        :render-revision="renderRevision"
                        :selected-group-id="selectedGroupId"
                        :show-empty-repeat-prototype="showEmptyRepeatPrototype"
                        @group-drag-start="(groupId, event) => emit('groupDragStart', groupId, event)"
                        @group-dragging="(groupId, event) => emit('groupDragging', groupId, event)"
                        @group-move="(groupId, event) => emit('groupMove', groupId, event)"
                        @group-transform="(groupId, event) => emit('groupTransform', groupId, event)"
                    >
                        <template #element="slotProps"><slot name="element" v-bind="slotProps" /></template>
                        <template #before-element="slotProps"><slot name="before-element" v-bind="slotProps" /></template>
                        <template #after-element="slotProps"><slot name="after-element" v-bind="slotProps" /></template>
                    </CanvasSceneTree>
                </v-group>
            </template>
            <CanvasSceneTree
                v-else
                :data-values="dataValues"
                :draggable-group-ids="draggableGroupIds"
                :editor-scale="editorScale"
                :effects="effects"
                :filters="filters"
                :group-frames="groupFrames"
                :group-repeats="groupRepeats"
                :instance-key="instanceKey"
                :interactive="interactive"
                :locked-element-ids="lockedElementIds"
                :nodes="node.children"
                :origin="groupFrames[node.id]"
                :prototype-group-frames="prototypeGroupFrames"
                :render-revision="renderRevision"
                :selected-group-id="selectedGroupId"
                :show-empty-repeat-prototype="showEmptyRepeatPrototype"
                @group-drag-start="(groupId, event) => emit('groupDragStart', groupId, event)"
                @group-dragging="(groupId, event) => emit('groupDragging', groupId, event)"
                @group-move="(groupId, event) => emit('groupMove', groupId, event)"
                @group-transform="(groupId, event) => emit('groupTransform', groupId, event)"
            >
                <template #element="slotProps"><slot name="element" v-bind="slotProps" /></template>
                <template #before-element="slotProps"><slot name="before-element" v-bind="slotProps" /></template>
                <template #after-element="slotProps"><slot name="after-element" v-bind="slotProps" /></template>
            </CanvasSceneTree>
        </EditableLayoutGroup>
    </template>
</template>
