<script setup lang="ts">
import { LoadingDots } from '@churchtools/styleguide';
import { nextTick, onMounted, toRef, watch } from 'vue';
import { useTemplate } from '../composables/useTemplate';
import type { PublisherTemplate } from '../composables/useTemplates';
import { Publisher } from '../publisher';
import { useStore } from '../store';
import KonvaCanvas from './KonvaCanvas.vue';

const props = defineProps<{
    variables: Record<string, string | number> | undefined;
    scale: number;
    template: PublisherTemplate;
}>();

const store = useStore();
onMounted(() => init());
const init = () => {
    if (templatePages.value.length) {
        for (let i = 0; i < templatePages.value.length; i++) {
            store.publishers ??= [];
            store.publishers[i] = new Publisher();
        }
        nextTick(() => {
            const main = document.getElementsByClassName('publisher__main')[0];
            const mainWidth = main.getClientRects()[0].width;
            const width = main.childNodes.item(1).getClientRects()[0].width;
            main.scrollLeft = (width / props.scale - mainWidth) / 2;
        });
    }
};

const { templatePages, isPendingPages } = useTemplate(toRef(() => props.template.id));
watch(templatePages, () => init());
</script>
<template>
    <div class="bg-basic-bright publisher__main">
        <LoadingDots v-if="isPendingPages || !templatePages.length" />
        <KonvaCanvas
            v-for="(canva, index) in templatePages"
            v-else
            :key="index"
            :config="canva"
            :index="index"
            style="transform: scale(var(--scale))"
            :variables="variables"
        />
    </div>
</template>
<style scoped>
.publisher__main {
    max-height: calc(100vh - 56px - 56px);
    overflow: auto;
}
</style>
