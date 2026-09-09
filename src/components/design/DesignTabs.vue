<script setup lang="ts">
import { computed, useId } from 'vue';

const props = defineProps<{
    id?: string;
    label: string;
    items: { id: string; label: string }[];
    modelValue: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const generatedId = useId();
const tabsId = computed(() => props.id ?? `design-tabs-${generatedId}`);
const tabId = (itemId: string) => `${tabsId.value}-${itemId}-tab`;
const panelId = (itemId: string) => `${tabsId.value}-${itemId}-panel`;
const activate = (itemId: string, root?: HTMLElement) => {
    emit('update:modelValue', itemId);
    [...(root?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])]
        .find((element) => element.id === tabId(itemId))?.focus();
};
const handleKeydown = (event: KeyboardEvent) => {
    const index = props.items.findIndex(({ id }) => id === props.modelValue);
    if (index < 0) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % props.items.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + props.items.length) % props.items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = props.items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = props.items[nextIndex];
    if (next) activate(next.id, event.currentTarget as HTMLElement);
};
</script>

<template>
    <div :id="tabsId" class="design-tabs inspector-subtabs" role="tablist" :aria-label="label" @keydown="handleKeydown">
        <button
            v-for="item in items"
            :id="tabId(item.id)"
            :key="item.id"
            type="button"
            role="tab"
            :aria-controls="panelId(item.id)"
            :aria-selected="modelValue === item.id"
            :class="{ 'is-active': modelValue === item.id }"
            :tabindex="modelValue === item.id ? 0 : -1"
            @click="activate(item.id)"
        >{{ item.label }}</button>
    </div>
</template>
