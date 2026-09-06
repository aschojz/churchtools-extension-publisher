import { Vibrant } from 'node-vibrant/browser';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
    createPublisherImagePalette,
    resolvePaletteBinding,
    type LayoutColorBinding,
    type PublisherImagePalette,
    type PublisherImagePaletteSource,
} from '../domain/imagePalette';

export type PublisherImagePaletteStatus = 'idle' | 'loading' | 'ready' | 'error';

export const usePublisherImagePalettesStore = defineStore('publisherImagePalettes', () => {
    const sources = ref<PublisherImagePaletteSource[]>([]);
    const palettes = ref<Record<string, PublisherImagePalette | undefined>>({});
    const statuses = ref<Record<string, PublisherImagePaletteStatus | undefined>>({});
    const errors = ref<Record<string, string | undefined>>({});
    const revision = ref(0);
    const sourceById = computed(() => Object.fromEntries(sources.value.map((source) => [source.id, source])));

    const syncSources = (nextSources: PublisherImagePaletteSource[]) => {
        const unique = nextSources.filter((source, index, entries) => source.source &&
            entries.findIndex(({ id }) => id === source.id) === index);
        const previous = sourceById.value;
        for (const source of unique) {
            if (previous[source.id]?.source !== source.source) {
                delete palettes.value[source.id];
                statuses.value[source.id] = 'idle';
                delete errors.value[source.id];
                revision.value += 1;
            }
        }
        sources.value = unique;
    };

    const analyze = async (imageId: string) => {
        const source = sourceById.value[imageId];
        if (!source || statuses.value[imageId] === 'loading') return;
        statuses.value[imageId] = 'loading';
        delete errors.value[imageId];
        const sourceUrl = source.source;
        try {
            const extracted = await Vibrant.from(sourceUrl).maxDimension(640).quality(5).getPalette();
            if (sourceById.value[imageId]?.source !== sourceUrl) return;
            const palette = createPublisherImagePalette(extracted);
            if (palette.colors.length === 0) throw new Error('Keine Farben erkannt.');
            palettes.value[imageId] = palette;
            statuses.value[imageId] = 'ready';
            revision.value += 1;
        } catch {
            if (sourceById.value[imageId]?.source !== sourceUrl) return;
            statuses.value[imageId] = 'error';
            errors.value[imageId] = 'Die Farben konnten nicht aus diesem Bild gelesen werden.';
        }
    };

    const resolveColor = (binding: LayoutColorBinding | undefined, fallback: string) =>
        resolvePaletteBinding(binding, fallback, palettes.value);

    return { analyze, errors, palettes, resolveColor, revision, sources, statuses, syncSources };
});
