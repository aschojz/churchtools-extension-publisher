import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
    parsePublisherColorPreferences,
    PUBLISHER_COLOR_PREFERENCES_CACHE_KEY,
    serializePublisherColorPreferences,
} from '../domain/publisherColorCache';
import { readPublisherBrowserCache, writePublisherBrowserCache } from '../infrastructure/publisherBrowserCache';

const MAX_RECENT_COLORS = 12;
export const PUBLISHER_DEFAULT_COLORS = [
    '#FFFFFF', '#E9EEF4', '#C7D0DA', '#8795A5', '#465466', '#17202A', '#000000',
    '#1E3A5F', '#2768AD', '#69A7E8', '#22A6B3', '#2AB7A9', '#22A06B', '#7CB342',
    '#F2C94C', '#F5A623', '#E76F51', '#D64545', '#C23B7A', '#7B61A8',
];
const normalizeColor = (color: string) => /^#[0-9a-f]{6}$/i.test(color.trim())
    ? color.trim().toLowerCase()
    : null;

export const usePublisherColorsStore = defineStore('publisherColors', () => {
    const recentColors = ref<string[]>([]);
    let localRevision = 0;
    const lastUsedColor = computed(() => recentColors.value[0] ?? null);

    void readPublisherBrowserCache(PUBLISHER_COLOR_PREFERENCES_CACHE_KEY).then((cached) => {
        if (localRevision > 0) return;
        recentColors.value = parsePublisherColorPreferences(cached);
    });

    const rememberColor = (color: string) => {
        const normalized = normalizeColor(color);
        if (!normalized) return;
        localRevision += 1;
        recentColors.value = [
            normalized,
            ...recentColors.value.filter((candidate) => candidate !== normalized),
        ].slice(0, MAX_RECENT_COLORS);
        void writePublisherBrowserCache(
            PUBLISHER_COLOR_PREFERENCES_CACHE_KEY,
            serializePublisherColorPreferences(recentColors.value),
        );
    };

    return { lastUsedColor, recentColors, rememberColor };
});
