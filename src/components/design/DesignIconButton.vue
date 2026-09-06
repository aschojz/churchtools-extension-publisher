<script setup lang="ts">
withDefaults(defineProps<{
    active?: boolean;
    disabled?: boolean;
    label: string;
    size?: 'compact' | 'default';
    toggle?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'neutral' | 'danger';
}>(), {
    active: false,
    disabled: false,
    size: 'default',
    toggle: false,
    type: 'button',
    variant: 'neutral',
});
</script>

<template>
    <button
        :type="type"
        class="design-icon-button"
        :class="[`design-icon-button--${variant}`, `design-icon-button--${size}`, { 'is-active': active }]"
        :aria-label="label"
        :aria-pressed="toggle ? active : undefined"
        :disabled="disabled"
        :title="label"
    ><slot /></button>
</template>
