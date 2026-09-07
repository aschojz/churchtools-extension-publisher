<script setup lang="ts">
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

withDefaults(
    defineProps<{
        active?: boolean;
        disabled?: boolean;
        label: string;
        size?: 'compact' | 'default';
        toggle?: boolean;
        type?: 'button' | 'submit' | 'reset';
        variant?: 'neutral' | 'danger';
        icon?: IconDefinition;
        rotation?: 90 | 180 | 270;
    }>(),
    {
        active: false,
        disabled: false,
        size: 'default',
        toggle: false,
        type: 'button',
        variant: 'neutral',
    },
);
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
    >
        <slot>
            <FontAwesomeIcon v-if="icon" :icon="icon" :rotation="rotation" aria-hidden="true" />
        </slot>
    </button>
</template>
