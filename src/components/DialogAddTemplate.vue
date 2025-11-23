<script setup lang="ts">
import { DialogLarge, SectionHeader } from '@churchtools/styleguide';
import { CtColor, CtIcon, tx } from '@churchtools/utils';
import { ref } from 'vue';
import PreviewCard from './PreviewCard.vue';

type Preset = {
    name: string;
    width: number;
    height: number;
    description: string;
};
const presets: { title: string; items: Preset[] }[] = [
    {
        title: tx('Video und Web'),
        items: [
            {
                name: 'QHD',
                width: 2560,
                height: 1440,
                description: '2560 x 1440 Pixel',
            },
            {
                name: 'FHD',
                width: 1920,
                height: 1080,
                description: '1920 x 1080 Pixel',
            },
            {
                name: 'HD',
                width: 1280,
                height: 720,
                description: '1280 x 720 Pixel',
            },
        ],
    },
    {
        title: tx('Soziale Medien'),
        items: [
            {
                name: 'Instagram Post',
                width: 1080,
                height: 1080,
                description: '1080 x 1080 Pixel',
            },
            {
                name: 'Instagram Story',
                width: 1920,
                height: 1080,
                description: '1080 x 1920 Pixel',
            },
        ],
    },
    {
        title: tx('Seitengrößen für Druck'),
        items: [
            {
                name: 'A4',
                width: 3508,
                height: 2480,
                description: '297 x 210 mm bei 300 DPI',
            },
            {
                name: 'A5',
                width: 2480,
                height: 1748,
                description: '148 x 210 mm bei 300 DPI',
            },
            {
                name: 'A6',
                width: 1748,
                height: 1240,
                description: '105 x 148 mm bei 300 DPI',
            },
        ],
    },
];

const orientation = ref<'portrait' | 'landscape'>('landscape');

const onSelect = (preset: Preset) => {
    console.log('Selected preset:', preset);
};
</script>
<template>
    <DialogLarge
        :context="tx('Publisher')"
        :header="{
            icon: CtIcon.ADD,
            title: tx('Seite erstellen'),
            actions: [
                {
                    icon: 'fa fa-file',
                    outlined: true,
                    color: orientation === 'portrait' ? CtColor.ACCENT : CtColor.BASIC,
                    onClick: () => (orientation = 'portrait'),
                },
                {
                    icon: 'fa fa-file fa-rotate-270',
                    outlined: true,
                    color: orientation === 'landscape' ? CtColor.ACCENT : CtColor.BASIC,
                    onClick: () => (orientation = 'landscape'),
                },
            ],
        }"
        :hide-footer="true"
    >
        <div class="gap-between-sections">
            <div v-for="(section, index) in presets" :key="index">
                <SectionHeader :title="section.title" />
                <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <PreviewCard
                        v-for="preset in section.items"
                        :key="preset.name"
                        :orientation="orientation"
                        :template="preset"
                        @click="onSelect(preset)"
                    />
                </div>
            </div>
        </div>
    </DialogLarge>
</template>
