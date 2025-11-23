<script setup lang="ts">
import { ref, toRef } from 'vue';
import { useTemplate } from './composables/useTemplate';
import Header from './main/Header.vue';
import Main from './main/Main.vue';
import SidebarRight from './main/SidebarRight.vue';

const props = defineProps<{
    id: string;
}>();

const variables = ref<Record<string, string | number> | undefined>(undefined);
const scale = ref(0.5);

const { template } = useTemplate(toRef(() => parseInt(props.id)));
</script>
<template>
    <div v-if="template" class="publisher-grid">
        <Header
            class="col-span-2"
            :template="template"
            @data-loaded="variables = $event"
            @scale="scale = Number($event)"
        />
        <Main :scale="scale" :style="`--scale: ${scale}`" :variables="variables" />
        <SidebarRight />
    </div>
</template>
<style scoped>
.publisher-grid {
    display: grid;
    grid-template-rows: 56px auto;
    grid-template-columns: 1fr 300px;
    height: 100%;
}
</style>
