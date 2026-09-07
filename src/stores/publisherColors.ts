import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const MAX_RECENT_COLORS = 12;
export const PUBLISHER_DEFAULT_COLORS = ['#FFFFFF', '#E9EEF4', '#17202A', '#2768AD', '#69A7E8', '#22A06B', '#F5A623', '#D64545'];
const normalizeColor = (color: string) => /^#[0-9a-f]{6}$/i.test(color.trim())
    ? color.trim().toLowerCase()
    : null;

export const usePublisherColorsStore = defineStore('publisherColors', () => {
    const recentColors = ref<string[]>([]);
    const lastUsedColor = computed(() => recentColors.value[0] ?? null);

    const rememberColor = (color: string) => {
        const normalized = normalizeColor(color);
        if (!normalized) return;
        recentColors.value = [
            normalized,
            ...recentColors.value.filter((candidate) => candidate !== normalized),
        ].slice(0, MAX_RECENT_COLORS);
    };

    return { lastUsedColor, recentColors, rememberColor };
});
