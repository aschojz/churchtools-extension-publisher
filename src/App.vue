<script setup lang="ts">
import { InfoMessageContainer } from '@churchtools/styleguide';
import { useToasts } from '@churchtools/utils';
import { computed, ref } from 'vue';
import Publisher from './Publisher.vue';
import Start from './Start.vue';
import type { PublisherTemplate } from './composables/useTemplates';

const { toasts, removeToast } = useToasts();

const removeInfoMessage = (infoMessage: (typeof toasts.value)[0]) => removeToast(infoMessage.id);

const isDev = computed(() => import.meta.env.MODE === 'development');
const selectedTemplate = ref<PublisherTemplate | null>(null);
</script>

<template>
    <!-- is removed in build-mode -->
    <div v-if="isDev" class="navbar"></div>
    <Start v-if="!selectedTemplate" @select-template="selectedTemplate = $event" />
    <Publisher v-else />
    <div v-if="isDev">
        <InfoMessageContainer :messages="toasts" @close-info-message="removeInfoMessage" />
    </div>
</template>
<style scoped>
.navbar {
    height: 56px;
    background: #0e204b;
}
</style>
