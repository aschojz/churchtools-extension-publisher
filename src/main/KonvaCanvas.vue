<script setup lang="ts">
import { useEventListener } from '@vueuse/core';
import Konva from 'konva';
import { computed, onMounted, watch } from 'vue';
import { type KLayer } from '../publisher/types';
import { useStore } from '../store';

const props = defineProps<{
    variables: Record<string, string | number> | undefined;
    config: KLayer;
    index: number;
}>();

const store = useStore();
const publisher = computed(() => store.publishers?.[props.index]);

const replacedPlaceholdersInState = computed(() => {
    const stateCopy = JSON.parse(JSON.stringify(props.config)) as KLayer;
    const traverse = (obj: KLayer['children'][number]) => {
        replacePlaceholders(obj);
        if ('children' in obj) {
            obj.children.forEach(child => traverse(child));
        }
    };
    stateCopy.children.forEach(child => traverse(child));
    return stateCopy;
});

const replacePlaceholders = (obj: KLayer['children'][number]) => {
    if (obj.placeholders && props.variables) {
        for (const [key, value] of Object.entries(obj.placeholders)) {
            if (value in props.variables) {
                (obj as any)[key] = props.variables[value as keyof typeof props.variables];
            }
        }
    }
};

const updateShapesOnly = () => {
    // Performance optimization: Only update shapes instead of full re-initialization
    if (!publisher.value) return;
    
    const stateCopy = replacedPlaceholdersInState.value;
    
    // Update existing shapes instead of clearing and re-adding
    const shapes = publisher.value.state;
    if (shapes.length === stateCopy.children.length) {
        shapes.forEach((shape, index) => {
            const newState = stateCopy.children[index];
            if (newState.placeholders && props.variables) {
                replacePlaceholders(newState);
                // Update shape properties directly instead of recreating
                Object.entries(newState).forEach(([key, value]) => {
                    if (key !== 'type' && key !== 'placeholders' && key !== 'children' && key !== 'url') {
                        // Use Konva's setter methods (e.g., x(), y(), fill())
                        const shapeInstance = shape.shape as Konva.Shape | Konva.Group;
                        if (typeof shapeInstance[key as keyof typeof shapeInstance] === 'function') {
                            (shapeInstance[key as keyof typeof shapeInstance] as Function)(value);
                        }
                    }
                });
            }
        });
        publisher.value.defaultLayer.batchDraw();
    } else {
        // Full re-init only if shape count changed
        init();
    }
};

const init = () => {
    publisher.value?.clearAll();
    publisher.value?.init(document.getElementById(`container-${props.index}`) as HTMLDivElement, {
        height: replacedPlaceholdersInState.value.height,
        width: replacedPlaceholdersInState.value.width,
    });
    publisher.value?.loadState(replacedPlaceholdersInState.value);
};

// Performance optimization: Only update shapes on variable changes, not full re-init
watch(() => props.variables, () => updateShapesOnly(), { deep: true });
// Full re-init only on config changes (structure changes)
watch(() => props.config, () => init(), { deep: true });

watch(publisher, () => init(), { once: true });
onMounted(() => {
    useEventListener('k-selected', (e: CustomEvent<Konva.NodeConfig[]>) => {
        store.selection = e.detail;
    });
});
</script>
<template>
    <div
        class="m-auto flex items-center justify-center"
        style="width: calc(var(--width) + 160px); height: calc(var(--height) + 160px)"
        :style="`--width: ${replacedPlaceholdersInState.width}px; --height: ${replacedPlaceholdersInState.height}px;`"
    >
        <div
            :id="`container-${index}`"
            ref="canvasWrapperRef"
            class="bg-white"
            style="width: calc(var(--width)); height: calc(var(--height))"
        />
    </div>
</template>
