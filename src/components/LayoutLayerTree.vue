<script setup lang="ts">
import { ref } from 'vue';

import type { LayoutElementId, LayoutLayerTreeNode } from '../domain/layoutEditing';

const props = withDefaults(defineProps<{
    depth?: number;
    elementLabels: Record<LayoutElementId, string>;
    nodes: LayoutLayerTreeNode[];
    selectedElementIds: LayoutElementId[];
}>(), { depth: 0 });

const emit = defineEmits<{
    deleteElements: [elementIds: LayoutElementId[]];
    drillIntoElement: [elementId: LayoutElementId];
    selectElement: [elementId: LayoutElementId, event: MouseEvent];
    selectGroup: [groupId: string, event: MouseEvent];
}>();

const collapsedGroups = ref(new Set<string>());
const toggleGroup = (groupId: string) => {
    const next = new Set(collapsedGroups.value);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    collapsedGroups.value = next;
};
const groupIsSelected = (elementIds: LayoutElementId[]) =>
    elementIds.length > 0 && elementIds.every((elementId) => props.selectedElementIds.includes(elementId));
</script>

<template>
    <div class="inspector-layer-tree" :class="{ 'is-nested': depth > 0 }">
        <template v-for="node in nodes" :key="`${node.kind}-${node.id}`">
            <div
                v-if="node.kind === 'element'"
                class="inspector-layer-list__row"
                :class="{ 'is-selected': selectedElementIds.includes(node.elementId) }"
                :style="{ '--layer-depth': depth }"
            >
                <button
                    type="button"
                    class="inspector-layer-list__select"
                    :aria-pressed="selectedElementIds.includes(node.elementId)"
                    @click="emit('selectElement', node.elementId, $event)"
                    @dblclick="emit('drillIntoElement', node.elementId)"
                ><span class="inspector-layer-list__icon">{{ node.elementId === 'image' ? '▧' : ['background', 'accent'].includes(node.elementId) ? '◆' : 'T' }}</span><span>{{ elementLabels[node.elementId] }}</span><small>{{ node.elementId === 'image' ? 'Bild' : ['background', 'accent'].includes(node.elementId) ? 'Form' : 'Text' }}</small></button>
                <button type="button" class="inspector-layer-list__delete" :aria-label="`${elementLabels[node.elementId]} löschen`" title="Ebene löschen" @click="emit('deleteElements', [node.elementId])">×</button>
            </div>

            <div v-else class="inspector-layer-group" :style="{ '--layer-depth': depth }">
                <div class="inspector-layer-list__row inspector-layer-list__row--group" :class="{ 'is-selected': groupIsSelected(node.elementIds) }">
                    <button type="button" class="inspector-layer-group__toggle" :aria-label="collapsedGroups.has(node.id) ? 'Gruppe aufklappen' : 'Gruppe zuklappen'" :aria-expanded="!collapsedGroups.has(node.id)" @click="toggleGroup(node.id)">{{ collapsedGroups.has(node.id) ? '›' : '⌄' }}</button>
                    <button type="button" class="inspector-layer-list__select inspector-layer-list__select--group" :aria-pressed="groupIsSelected(node.elementIds)" @click="emit('selectGroup', node.id, $event)"><span class="inspector-layer-list__icon">▰</span><span>{{ depth === 0 ? 'Gruppe' : 'Untergruppe' }}</span><small>{{ node.elementIds.length }} Ebenen</small></button>
                    <button type="button" class="inspector-layer-list__delete" aria-label="Gruppe löschen" title="Gruppe samt Ebenen löschen" @click="emit('deleteElements', node.elementIds)">×</button>
                </div>
                <LayoutLayerTree
                    v-if="!collapsedGroups.has(node.id)"
                    :depth="depth + 1"
                    :element-labels="elementLabels"
                    :nodes="node.children"
                    :selected-element-ids="selectedElementIds"
                    @delete-elements="emit('deleteElements', $event)"
                    @drill-into-element="emit('drillIntoElement', $event)"
                    @select-element="(elementId, event) => emit('selectElement', elementId, event)"
                    @select-group="(groupId, event) => emit('selectGroup', groupId, event)"
                />
            </div>
        </template>
    </div>
</template>
