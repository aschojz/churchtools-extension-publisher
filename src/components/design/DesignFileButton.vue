<script setup lang="ts">
withDefaults(defineProps<{
    accept?: string;
    variant?: 'primary' | 'secondary';
}>(), { accept: undefined, variant: 'secondary' });

const emit = defineEmits<{ change: [event: Event] }>();
</script>

<template>
    <label class="design-button design-file-button" :class="`design-button--${variant}`">
        <span><slot /></span>
        <input type="file" :accept="accept" @change="emit('change', $event)" />
    </label>
</template>
