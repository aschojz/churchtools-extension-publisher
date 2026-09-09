<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { faAngleDown, faAngleRight, faEye, faEyeSlash, faFont, faGripVertical, faIcons, faImage, faLayerGroup, faLock, faQrcode, faRepeat, faShapes, faSliders, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import type {
    LayoutElementId,
    LayoutLayerDragNode,
    LayoutLayerDropPlacement,
    LayoutLayerTreeNode,
} from '../domain/layoutEditing';
import DesignIconButton from './design/DesignIconButton.vue';

const props = withDefaults(defineProps<{
    depth?: number;
    elementLabels: Record<LayoutElementId, string>;
    effectElementIds?: string[];
    filterElementIds?: string[];
    elementPreviews?: Partial<Record<LayoutElementId, {
        color?: string;
        imageSource?: string;
        kind: 'image' | 'text' | 'shape' | 'icon' | 'qr';
    }>>;
    expandedGroupIds?: string[];
    hiddenElementIds?: LayoutElementId[];
    lockedElementIds?: LayoutElementId[];
    nodes: LayoutLayerTreeNode[];
    repeatGroupIds?: string[];
    selectedElementIds: LayoutElementId[];
}>(), { depth: 0, effectElementIds: () => [], filterElementIds: () => [], elementPreviews: () => ({}), hiddenElementIds: () => [], lockedElementIds: () => [], repeatGroupIds: () => [] });

const emit = defineEmits<{
    drillIntoElement: [elementId: LayoutElementId];
    editEffects: [targetId: string];
    editFilters: [targetId: string];
    moveLayer: [source: LayoutLayerDragNode, target: LayoutLayerDragNode, placement: LayoutLayerDropPlacement];
    selectElement: [elementId: LayoutElementId, event: MouseEvent];
    selectGroup: [groupId: string, event: MouseEvent];
    toggleVisibility: [elementIds: LayoutElementId[]];
}>();

const collapsedGroups = ref(new Set<string>());
watch(
    () => props.expandedGroupIds,
    (groupIds) => {
        if (!groupIds?.length) return;
        const next = new Set(collapsedGroups.value);
        groupIds.forEach((groupId) => next.delete(groupId));
        collapsedGroups.value = next;
    },
    { deep: true, immediate: true },
);
const toggleGroup = (groupId: string) => {
    const next = new Set(collapsedGroups.value);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    collapsedGroups.value = next;
};
const groupIsSelected = (elementIds: LayoutElementId[]) =>
    elementIds.length > 0 && elementIds.every((elementId) => props.selectedElementIds.includes(elementId));
const elementIsHidden = (elementId: LayoutElementId) => props.hiddenElementIds.includes(elementId);
const elementIsLocked = (elementId: LayoutElementId) => props.lockedElementIds.includes(elementId);
const groupIsHidden = (elementIds: LayoutElementId[]) =>
    elementIds.length > 0 && elementIds.every(elementIsHidden);
const groupIsLocked = (elementIds: LayoutElementId[]) =>
    elementIds.length > 0 && elementIds.every(elementIsLocked);
const groupContainsLocked = (elementIds: LayoutElementId[]) => elementIds.some(elementIsLocked);
const elementPresentation = (elementId: LayoutElementId) => {
    if (elementId === 'image' || elementId.startsWith('image-')) return { icon: faImage, kind: 'Bild' };
    if (elementId.startsWith('icon-')) return { icon: faIcons, kind: 'Icon' };
    if (elementId.startsWith('qr-')) return { icon: faQrcode, kind: 'QR-Code' };
    if (['background', 'accent'].includes(elementId) || elementId.startsWith('shape-')) return { icon: faShapes, kind: 'Form' };
    return { icon: faFont, kind: 'Text' };
};
const previewStyle = (elementId: LayoutElementId) => {
    const color = props.elementPreviews[elementId]?.color;
    return color ? { '--layer-preview-color': color } : undefined;
};
const LAYER_DRAG_TYPE = 'application/x-churchtools-publisher-layer';
const activeDrop = ref<{ target: string; placement: LayoutLayerDropPlacement } | null>(null);
const startLayerDrag = (source: LayoutLayerDragNode, event: DragEvent) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(LAYER_DRAG_TYPE, JSON.stringify(source));
};
const dropPlacement = (target: LayoutLayerDragNode, event: DragEvent): LayoutLayerDropPlacement => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5;
    if (target.kind === 'group' && ratio >= 0.25 && ratio <= 0.75) return 'inside';
    return ratio < 0.5 ? 'before' : 'after';
};
const updateDrop = (target: LayoutLayerDragNode, event: DragEvent) => {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    activeDrop.value = { target: `${target.kind}-${target.id}`, placement: dropPlacement(target, event) };
};
const finishDrop = (target: LayoutLayerDragNode, event: DragEvent) => {
    const placement = dropPlacement(target, event);
    activeDrop.value = null;
    try {
        const source = JSON.parse(event.dataTransfer?.getData(LAYER_DRAG_TYPE) ?? '') as LayoutLayerDragNode;
        if ((source.kind === 'element' || source.kind === 'group') && typeof source.id === 'string') {
            emit('moveLayer', source, target, placement);
        }
    } catch {
        // Ignore drags from outside the layer inspector.
    }
};
const dropClass = (target: LayoutLayerDragNode) => {
    const state = activeDrop.value;
    return state?.target === `${target.kind}-${target.id}` ? `is-drop-${state.placement}` : '';
};
const dragNode = (node: LayoutLayerTreeNode): LayoutLayerDragNode => ({
    kind: node.kind,
    id: node.kind === 'element' ? node.elementId : node.id,
});
const moveLayerWithKeyboard = (node: LayoutLayerTreeNode, index: number, event: KeyboardEvent) => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowRight'].includes(event.key)) return;
    const source = dragNode(node);
    if (event.key === 'ArrowUp' && index > 0) {
        event.preventDefault();
        emit('moveLayer', source, dragNode(props.nodes[index - 1]!), 'before');
    } else if (event.key === 'ArrowDown' && index < props.nodes.length - 1) {
        event.preventDefault();
        emit('moveLayer', source, dragNode(props.nodes[index + 1]!), 'after');
    } else if (event.key === 'ArrowRight') {
        const previousGroup = props.nodes.slice(0, index).reverse().find(
            (candidate): candidate is Extract<LayoutLayerTreeNode, { kind: 'group' }> => candidate.kind === 'group',
        );
        if (previousGroup) {
            event.preventDefault();
            emit('moveLayer', source, { kind: 'group', id: previousGroup.id }, 'inside');
        }
    }
};
const parentGroupSelect = (row: HTMLElement, nodeKind: LayoutLayerTreeNode['kind']) => {
    const ownGroup = nodeKind === 'group'
        ? row.parentElement?.closest<HTMLElement>('.inspector-layer-group')
        : row.closest<HTMLElement>('.inspector-layer-group');
    if (!ownGroup) return null;
    const parentRow = [...ownGroup.children].find((child) =>
        child instanceof HTMLElement && child.classList.contains('inspector-layer-list__row'));
    return parentRow?.querySelector<HTMLButtonElement>('[data-layer-select]') ?? null;
};
const handleTreeNavigation = async (node: LayoutLayerTreeNode, event: KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.altKey) return;
    const current = event.currentTarget as HTMLButtonElement;
    const tree = current.closest<HTMLElement>('[role="tree"]');
    if (!tree) return;
    const buttons = [...tree.querySelectorAll<HTMLButtonElement>('[data-layer-select]')];
    const index = buttons.indexOf(current);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0
            : event.key === 'End' ? buttons.length - 1
                : Math.min(buttons.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
        buttons[nextIndex]?.focus();
        return;
    }
    if (node.kind === 'group') {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (collapsedGroups.value.has(node.id)) {
                toggleGroup(node.id);
                await nextTick();
            }
            const updatedButtons = [...tree.querySelectorAll<HTMLButtonElement>('[data-layer-select]')];
            updatedButtons[updatedButtons.indexOf(current) + 1]?.focus();
            return;
        }
        if (event.key === 'ArrowLeft' && !collapsedGroups.value.has(node.id)) {
            event.preventDefault();
            toggleGroup(node.id);
            return;
        }
    }
    if (event.key === 'ArrowLeft') {
        const parent = parentGroupSelect(current.closest('.inspector-layer-list__row')!, node.kind);
        if (parent) {
            event.preventDefault();
            parent.focus();
        }
    }
};
</script>

<template>
    <div class="inspector-layer-tree" :class="{ 'is-nested': depth > 0 }" :role="depth === 0 ? 'tree' : 'group'" :aria-label="depth === 0 ? 'Ebenen' : undefined">
        <span v-if="depth === 0" id="publisher-layer-keyboard-help" class="sr-only">Mit den Pfeiltasten navigieren und Gruppen auf- oder zuklappen. Mit Wahltaste beziehungsweise Alt und Pfeil nach oben oder unten verschieben, mit Wahltaste beziehungsweise Alt und Pfeil nach rechts in die vorherige Gruppe verschachteln.</span>
        <template v-for="(node, nodeIndex) in nodes" :key="`${node.kind}-${node.id}`">
            <div
                v-if="node.kind === 'element'"
                class="inspector-layer-list__row"
                :class="[{ 'is-selected': selectedElementIds.includes(node.elementId), 'is-hidden': elementIsHidden(node.elementId) }, dropClass({ kind: 'element', id: node.elementId })]"
                :style="{ '--layer-depth': depth }"
                role="treeitem"
                :aria-level="depth + 1"
                :aria-selected="selectedElementIds.includes(node.elementId)"
                @dragover.prevent.stop="updateDrop({ kind: 'element', id: node.elementId }, $event)"
                @dragleave.self="activeDrop = null"
                @drop.prevent.stop="finishDrop({ kind: 'element', id: node.elementId }, $event)"
            >
                <button type="button" class="inspector-layer-list__drag" :disabled="elementIsLocked(node.elementId)" :draggable="!elementIsLocked(node.elementId)" :aria-label="`${elementLabels[node.elementId]} verschieben`" aria-describedby="publisher-layer-keyboard-help" @dragstart="startLayerDrag({ kind: 'element', id: node.elementId }, $event)" @dragend="activeDrop = null" @keydown="moveLayerWithKeyboard(node, nodeIndex, $event)"><FontAwesomeIcon :icon="faGripVertical" aria-hidden="true" /></button>
                <button
                    type="button"
                    class="inspector-layer-list__select"
                    data-layer-select
                    :aria-pressed="selectedElementIds.includes(node.elementId)"
                    @click="emit('selectElement', node.elementId, $event)"
                    @dblclick="emit('drillIntoElement', node.elementId)"
                    @keydown="handleTreeNavigation(node, $event)"
                >
                    <span class="inspector-layer-list__icon" :class="`is-${elementPreviews[node.elementId]?.kind ?? elementPresentation(node.elementId).kind.toLowerCase()}`" :style="previewStyle(node.elementId)">
                        <img v-if="elementPreviews[node.elementId]?.imageSource" :src="elementPreviews[node.elementId]?.imageSource" alt="" />
                        <FontAwesomeIcon v-else :icon="elementPresentation(node.elementId).icon" aria-hidden="true" />
                    </span>
                    <span :title="elementLabels[node.elementId]">{{ elementLabels[node.elementId] }}</span>
                </button>
                <span class="inspector-layer-list__indicators">
                    <DesignIconButton v-if="effectElementIds.includes(node.elementId)" class="inspector-layer-list__effect" :label="`Effekte von ${elementLabels[node.elementId]} bearbeiten`" @click="emit('editEffects', node.elementId)"><FontAwesomeIcon :icon="faWandMagicSparkles" aria-hidden="true" /></DesignIconButton>
                    <DesignIconButton v-if="filterElementIds.includes(node.elementId)" class="inspector-layer-list__filter" :label="`Filter von ${elementLabels[node.elementId]} bearbeiten`" @click="emit('editFilters', node.elementId)"><FontAwesomeIcon :icon="faSliders" aria-hidden="true" /></DesignIconButton>
                </span>
                <span class="inspector-layer-list__lock" :title="elementIsLocked(node.elementId) ? 'Ebene ist gesperrt' : undefined"><FontAwesomeIcon v-if="elementIsLocked(node.elementId)" :icon="faLock" aria-hidden="true" /></span>
                <DesignIconButton class="inspector-layer-list__visibility" :label="elementIsHidden(node.elementId) ? `${elementLabels[node.elementId]} einblenden` : `${elementLabels[node.elementId]} ausblenden`" @click="emit('toggleVisibility', [node.elementId])"><FontAwesomeIcon :icon="elementIsHidden(node.elementId) ? faEyeSlash : faEye" aria-hidden="true" /></DesignIconButton>
            </div>

            <div v-else class="inspector-layer-group" :style="{ '--layer-depth': depth }" role="treeitem" :aria-level="depth + 1" :aria-expanded="!collapsedGroups.has(node.id)" :aria-selected="groupIsSelected(node.elementIds)">
                <div class="inspector-layer-list__row inspector-layer-list__row--group" :class="[{ 'is-selected': groupIsSelected(node.elementIds), 'is-hidden': groupIsHidden(node.elementIds) }, dropClass({ kind: 'group', id: node.id })]" @dragover.prevent.stop="updateDrop({ kind: 'group', id: node.id }, $event)" @dragleave.self="activeDrop = null" @drop.prevent.stop="finishDrop({ kind: 'group', id: node.id }, $event)">
                    <button type="button" class="inspector-layer-list__drag" :disabled="groupContainsLocked(node.elementIds)" :draggable="!groupContainsLocked(node.elementIds)" aria-label="Gruppe verschieben" aria-describedby="publisher-layer-keyboard-help" @dragstart="startLayerDrag({ kind: 'group', id: node.id }, $event)" @dragend="activeDrop = null" @keydown="moveLayerWithKeyboard(node, nodeIndex, $event)"><FontAwesomeIcon :icon="faGripVertical" aria-hidden="true" /></button>
                    <DesignIconButton class="inspector-layer-group__toggle" :label="collapsedGroups.has(node.id) ? 'Gruppe aufklappen' : 'Gruppe zuklappen'" :aria-expanded="!collapsedGroups.has(node.id)" @click="toggleGroup(node.id)"><FontAwesomeIcon :icon="collapsedGroups.has(node.id) ? faAngleRight : faAngleDown" aria-hidden="true" /></DesignIconButton>
                    <button type="button" class="inspector-layer-list__select inspector-layer-list__select--group" data-layer-select :aria-pressed="groupIsSelected(node.elementIds)" @click="emit('selectGroup', node.id, $event)" @keydown="handleTreeNavigation(node, $event)"><span class="inspector-layer-list__icon"><FontAwesomeIcon :icon="faLayerGroup" aria-hidden="true" /></span><span>{{ depth === 0 ? 'Gruppe' : 'Untergruppe' }}</span></button>
                    <span class="inspector-layer-list__indicators">
                        <span v-if="repeatGroupIds.includes(node.id)" class="inspector-layer-list__repeat" title="Datenabhängige Wiederholung"><FontAwesomeIcon :icon="faRepeat" aria-hidden="true" /><span class="sr-only">Datenabhängige Wiederholung</span></span>
                        <DesignIconButton v-if="effectElementIds.includes(node.id)" class="inspector-layer-list__effect" label="Gruppeneffekte bearbeiten" @click="emit('editEffects', node.id)"><FontAwesomeIcon :icon="faWandMagicSparkles" aria-hidden="true" /></DesignIconButton>
                        <DesignIconButton v-if="filterElementIds.includes(node.id)" class="inspector-layer-list__filter" label="Gruppenfilter bearbeiten" @click="emit('editFilters', node.id)"><FontAwesomeIcon :icon="faSliders" aria-hidden="true" /></DesignIconButton>
                    </span>
                    <span class="inspector-layer-list__lock" :title="groupContainsLocked(node.elementIds) ? groupIsLocked(node.elementIds) ? 'Gruppe ist gesperrt' : 'Gruppe enthält gesperrte Ebenen' : undefined"><FontAwesomeIcon v-if="groupContainsLocked(node.elementIds)" :icon="faLock" aria-hidden="true" /></span>
                    <DesignIconButton class="inspector-layer-list__visibility" :label="groupIsHidden(node.elementIds) ? 'Gruppe einblenden' : 'Gruppe ausblenden'" @click="emit('toggleVisibility', node.elementIds)"><FontAwesomeIcon :icon="groupIsHidden(node.elementIds) ? faEyeSlash : faEye" aria-hidden="true" /></DesignIconButton>
                </div>
                <LayoutLayerTree
                    v-if="!collapsedGroups.has(node.id)"
                    :depth="depth + 1"
                    :element-labels="elementLabels"
                    :effect-element-ids="effectElementIds"
                    :filter-element-ids="filterElementIds"
                    :element-previews="elementPreviews"
                    :expanded-group-ids="expandedGroupIds"
                    :hidden-element-ids="hiddenElementIds"
                    :locked-element-ids="lockedElementIds"
                    :nodes="node.children"
                    :repeat-group-ids="repeatGroupIds"
                    :selected-element-ids="selectedElementIds"
                    @drill-into-element="emit('drillIntoElement', $event)"
                    @edit-effects="emit('editEffects', $event)"
                    @edit-filters="emit('editFilters', $event)"
                    @move-layer="(source, target, placement) => emit('moveLayer', source, target, placement)"
                    @select-element="(elementId, event) => emit('selectElement', elementId, event)"
                    @select-group="(groupId, event) => emit('selectGroup', groupId, event)"
                    @toggle-visibility="emit('toggleVisibility', $event)"
                />
            </div>
        </template>
    </div>
</template>
