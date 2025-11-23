<script setup lang="ts">
import { ref } from 'vue';
import Header from './main/Header.vue';
import Main from './main/Main.vue';
import SidebarRight from './main/SidebarRight.vue';

const variables = ref<Record<string, string | number> | undefined>(undefined);
const scale = ref(0.5);
</script>
<template>
    <div class="publisher-grid">
        <Header class="col-span-2" @data-loaded="variables = $event" @scale="scale = Number($event)" />
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
