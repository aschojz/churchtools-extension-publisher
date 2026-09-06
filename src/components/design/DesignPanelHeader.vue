<script setup lang="ts">
defineProps<{
    eyebrow?: string;
    heading: string;
    headingId?: string;
}>();
</script>

<template>
    <header class="publisher-panel-heading">
        <div>
            <span v-if="eyebrow">{{ eyebrow }}</span>
            <h2 :id="headingId">{{ heading }}</h2>
        </div>
        <slot name="action" />
    </header>
</template>
