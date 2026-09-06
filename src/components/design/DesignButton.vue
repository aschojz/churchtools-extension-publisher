<script setup lang="ts">
withDefaults(defineProps<{
    block?: boolean;
    disabled?: boolean;
    size?: 'compact' | 'default';
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}>(), {
    block: false,
    disabled: false,
    size: 'default',
    type: 'button',
    variant: 'primary',
});
</script>

<template>
    <button
        :type="type"
        class="design-button"
        :class="[`design-button--${variant}`, `design-button--${size}`, { 'is-block': block }]"
        :disabled="disabled"
    >
        <span v-if="$slots.icon" class="design-button__icon" aria-hidden="true"><slot name="icon" /></span>
        <span><slot /></span>
    </button>
</template>
