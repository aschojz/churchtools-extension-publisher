<script setup lang="ts">
defineProps<{
    label: string;
    items: { id: string; label: string }[];
    modelValue: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
    <div class="design-tabs inspector-subtabs" role="tablist" :aria-label="label">
        <button
            v-for="item in items"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="modelValue === item.id"
            :class="{ 'is-active': modelValue === item.id }"
            @click="emit('update:modelValue', item.id)"
        >{{ item.label }}</button>
    </div>
</template>
