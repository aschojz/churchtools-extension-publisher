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
import {
    parsePublisherImagePalette,
    publisherImagePaletteCacheKey,
    serializePublisherImagePalette,
} from '../domain/publisherColorCache';
import { readPublisherBrowserCache, writePublisherBrowserCache } from '../infrastructure/publisherBrowserCache';

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
        const nextIds = new Set(unique.map(({ id }) => id));
        const trackedIds = new Set([
            ...Object.keys(previous),
            ...Object.keys(palettes.value),
            ...Object.keys(statuses.value),
            ...Object.keys(errors.value),
        ]);
        for (const imageId of trackedIds) {
            if (nextIds.has(imageId)) continue;
            delete palettes.value[imageId];
            delete statuses.value[imageId];
            delete errors.value[imageId];
            revision.value += 1;
        }
        for (const source of unique) {
            if (previous[source.id]?.source !== source.source) {
                delete palettes.value[source.id];
                statuses.value[source.id] = 'idle';
                delete errors.value[source.id];
                revision.value += 1;
                void readPublisherBrowserCache(publisherImagePaletteCacheKey(source.source)).then((cachedValue) => {
                    const cached = parsePublisherImagePalette(cachedValue);
                    if (!cached || sourceById.value[source.id]?.source !== source.source ||
                        statuses.value[source.id] !== 'idle') return;
                    palettes.value[source.id] = cached;
                    statuses.value[source.id] = 'ready';
                    revision.value += 1;
                });
            }
        }
        sources.value = unique;
    };

    const cachePalette = (imageId: string, palette: PublisherImagePalette) => {
        const source = sourceById.value[imageId];
        if (!source) return;
        void writePublisherBrowserCache(
            publisherImagePaletteCacheKey(source.source),
            serializePublisherImagePalette(palette),
        );
    };

    const analyze = async (imageId: string, force = false) => {
        const source = sourceById.value[imageId];
        if (!source || statuses.value[imageId] === 'loading') return;
        statuses.value[imageId] = 'loading';
        delete errors.value[imageId];
        const sourceUrl = source.source;
        try {
            if (!force) {
                const cached = parsePublisherImagePalette(await readPublisherBrowserCache(
                    publisherImagePaletteCacheKey(sourceUrl),
                ));
                if (cached && sourceById.value[imageId]?.source === sourceUrl) {
                    palettes.value[imageId] = cached;
                    statuses.value[imageId] = 'ready';
                    revision.value += 1;
                    return;
                }
            }
            const analyzer = Vibrant.from(sourceUrl).maxDimension(640).maxColorCount(64).quality(5).build();
            const extracted = await analyzer.getPalette();
            if (sourceById.value[imageId]?.source !== sourceUrl) return;
            const palette = createPublisherImagePalette(extracted, analyzer.result?.colors ?? []);
            if (palette.colors.length === 0) throw new Error('Keine Farben erkannt.');
            palettes.value[imageId] = palette;
            statuses.value[imageId] = 'ready';
            revision.value += 1;
            cachePalette(imageId, palette);
        } catch {
            if (sourceById.value[imageId]?.source !== sourceUrl) return;
            statuses.value[imageId] = 'error';
            errors.value[imageId] = 'Die Farben konnten nicht aus diesem Bild gelesen werden.';
        }
    };

    const resolveColor = (binding: LayoutColorBinding | undefined, fallback: string) =>
        resolvePaletteBinding(binding, fallback, palettes.value);

    const assignRole = (
        imageId: string,
        token: LayoutColorBinding['token'],
        color: string,
    ) => {
        const palette = palettes.value[imageId];
        const normalized = color.trim().toLowerCase();
        if (!palette || !palette.colors.some(({ hex }) => hex === normalized)) return false;
        if (palette[token] === normalized) return true;
        palettes.value[imageId] = { ...palette, [token]: normalized };
        revision.value += 1;
        cachePalette(imageId, palettes.value[imageId]!);
        return true;
    };

    return { analyze, assignRole, errors, palettes, resolveColor, revision, sources, statuses, syncSources };
});
