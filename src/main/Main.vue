<script setup lang="ts">
import { onMounted } from 'vue';
import { useFonts } from '../composables/useFont';
import { Publisher } from '../publisher';
import type { KLayer } from '../publisher/state';
import { useStore } from '../store';
import KonvaCanvas from './KonvaCanvas.vue';

const props = defineProps<{
    variables: Record<string, string | number> | undefined;
    scale: number;
}>();

const { font } = useFonts();
const state: KLayer[] = [
    {
        type: 'layer',
        children: [
            {
                type: 'image',
                x: 0,
                y: 0,
                width: 1080,
                height: 1080,
                fill: '#dddddd',
                url: 'https://picsum.photos/1080',
                placeholders: { url: 'image' },
            },
            {
                placeholders: { fill: 'backgroundColor' },
                type: 'rect',
                x: 1080,
                y: 0,
                width: 840,
                height: 1080,
                fill: '#333333',
            },
            {
                type: 'group',
                x: 1080,
                y: 850,
                children: [
                    {
                        placeholders: { fill: 'primaryColor' },
                        type: 'circle',
                        radius: 150,
                        fill: '#888888',
                        shadowColor: '#000',
                        shadowBlur: 16,
                        shadowOffset: { x: 5, y: 5 },
                        shadowOpacity: 0.3,
                    },
                    {
                        placeholders: { text: 'date' },
                        type: 'text',
                        text: '00.00.',
                        x: -150,
                        y: -150 + 80,
                        width: 300,
                        align: 'center',
                        ...font({ size: 95, style: 'bold-condensed', color: '255,255,255' }),
                    },
                    {
                        placeholders: { text: 'time' },
                        type: 'text',
                        text: '00:00 Uhr',
                        x: -150,
                        y: -150 + 170,
                        width: 300,
                        align: 'center',
                        ...font({ size: 49, style: 'regular', color: '255,255,255' }),
                    },
                ],
            },
            {
                type: 'group',
                x: 1080 + 60,
                y: 400,
                children: [
                    {
                        placeholders: { text: 'title', fill: 'primaryColor' },
                        type: 'text',
                        text: 'Title Here',
                        ...font({ size: 80, style: 'regular' }),
                        fill: '#888888',
                        fontSize: 80,
                        upperCase: true,
                    },
                    {
                        placeholders: { text: 'subtitle' },
                        type: 'text',
                        y: 80,
                        text: 'Subtitle Here',
                        ...font({ size: 80, style: 'regular' }),
                    },
                    {
                        placeholders: { text: 'subtitle' },
                        type: 'text',
                        y: 160,
                        text: 'Subtitle Here',
                        ...font({ size: 80, style: 'regular' }),
                    },
                ],
            },
        ],
        width: 1920,
        height: 1080,
    },
    {
        type: 'layer',
        children: [
            {
                type: 'image',
                x: 840,
                y: 0,
                width: 1080,
                height: 1080,
                fill: '#dddddd',
                url: 'https://picsum.photos/1080',
                placeholders: { url: 'image' },
            },
            {
                placeholders: { fill: 'backgroundColor' },
                type: 'rect',
                x: 0,
                y: 0,
                width: 840,
                height: 1080,
                fill: '#333333',
            },
            {
                type: 'group',
                x: 840,
                y: 850,
                children: [
                    {
                        placeholders: { fill: 'primaryColor' },
                        type: 'circle',
                        radius: 150,
                        fill: '#888888',
                        shadowColor: '#000',
                        shadowBlur: 16,
                        shadowOffset: { x: 5, y: 5 },
                        shadowOpacity: 0.3,
                    },
                    {
                        placeholders: { text: 'date' },
                        type: 'text',
                        text: '00.00.',
                        x: -150,
                        y: -150 + 80,
                        width: 300,
                        align: 'center',
                        ...font({ size: 95, style: 'bold-condensed', color: '255,255,255' }),
                    },
                    {
                        placeholders: { text: 'time' },
                        type: 'text',
                        text: '00:00 Uhr',
                        x: -150,
                        y: -150 + 170,
                        width: 300,
                        align: 'center',
                        ...font({ size: 49, style: 'regular', color: '255,255,255' }),
                    },
                ],
            },
            {
                type: 'group',
                x: 0 + 60,
                y: 400,
                children: [
                    {
                        placeholders: { text: 'title', fill: 'primaryColor' },
                        type: 'text',
                        text: 'Title Here',
                        ...font({ size: 80, style: 'regular' }),
                        fill: '#888888',
                        fontSize: 80,
                        upperCase: true,
                    },
                    {
                        placeholders: { text: 'subtitle' },
                        type: 'text',
                        y: 80,
                        text: 'Subtitle Here',
                        ...font({ size: 80, style: 'regular' }),
                    },
                ],
            },
        ],
        width: 1920,
        height: 1080,
    },
];
const store = useStore();
onMounted(() => {
    for (let i = 0; i < state.length; i++) {
        store.publishers ??= [];
        store.publishers[i] = new Publisher();
    }
    const main = document.getElementsByClassName('publisher__main')[0];
    const mainWidth = main.getClientRects()[0].width;
    const width = main.childNodes.item(1).getClientRects()[0].width;
    main.scrollLeft = (width / props.scale - mainWidth) / 2;
});
</script>
<template>
    <div class="bg-basic-bright publisher__main">
        <KonvaCanvas
            v-for="(canva, index) in state"
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
