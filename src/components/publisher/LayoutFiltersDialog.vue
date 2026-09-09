<script setup lang="ts">
import {
    faArrowDown,
    faArrowUp,
    faArrowsRotate,
    faBorderAll,
    faCircleHalfStroke,
    faImage,
    faPalette,
    faSun,
    faWaveSquare,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed, nextTick, ref, watch } from 'vue';

import {
    createLayoutFilterStack,
    moveLayoutFilter,
    normalizeLayoutFilterStack,
    type LayoutBrightnessFilter,
    type LayoutContrastFilter,
    type LayoutFilterStack,
    type LayoutFilterType,
    type LayoutHslFilter,
    type LayoutNoiseFilter,
    type LayoutPixelateFilter,
} from '../../domain/layoutFilters';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

const props = defineProps<{
    filters: LayoutFilterStack;
    open: boolean;
    selectionCount: number;
}>();

const emit = defineEmits<{
    apply: [filters: LayoutFilterStack];
    close: [];
}>();

const filterDefinitions = [
    { type: 'brightness', label: 'Helligkeit', icon: faSun },
    { type: 'contrast', label: 'Kontrast', icon: faCircleHalfStroke },
    { type: 'hsl', label: 'Farbton / Sättigung', icon: faPalette },
    { type: 'grayscale', label: 'Graustufen', icon: faCircleHalfStroke },
    { type: 'sepia', label: 'Sepia', icon: faImage },
    { type: 'invert', label: 'Invertieren', icon: faArrowsRotate },
    { type: 'pixelate', label: 'Pixelieren', icon: faBorderAll },
    { type: 'noise', label: 'Rauschen', icon: faWaveSquare },
] as const;

const activeType = ref<LayoutFilterType>('brightness');
const draft = ref<LayoutFilterStack>(createLayoutFilterStack());
const dialogRef = ref<HTMLFormElement | null>(null);
let restoreFocus: HTMLElement | null = null;

const filterOfType = <FilterType extends LayoutFilterType>(type: FilterType) =>
    draft.value.find((filter) => filter.type === type) as Extract<LayoutFilterStack[number], { type: FilterType }>;
const brightnessFilter = computed(() => filterOfType('brightness') as LayoutBrightnessFilter);
const contrastFilter = computed(() => filterOfType('contrast') as LayoutContrastFilter);
const hslFilter = computed(() => filterOfType('hsl') as LayoutHslFilter);
const pixelateFilter = computed(() => filterOfType('pixelate') as LayoutPixelateFilter);
const noiseFilter = computed(() => filterOfType('noise') as LayoutNoiseFilter);
const activeFilter = computed(() => filterOfType(activeType.value));
const activeIndex = computed(() => draft.value.findIndex(({ type }) => type === activeType.value));
const activeLabel = computed(() => filterDefinitions.find(({ type }) => type === activeType.value)?.label ?? 'Filter');
const orderedFilterDefinitions = computed(() => draft.value.flatMap((filter) => {
    const definition = filterDefinitions.find(({ type }) => type === filter.type);
    return definition ? [definition] : [];
}));

const brightnessPercent = computed({
    get: () => Math.round(brightnessFilter.value.amount * 100),
    set: (value: number) => { brightnessFilter.value.amount = Number(value) / 100; },
});
const saturationPercent = computed({
    get: () => Math.round(hslFilter.value.saturation * 100),
    set: (value: number) => { hslFilter.value.saturation = Number(value) / 100; },
});
const luminancePercent = computed({
    get: () => Math.round(hslFilter.value.luminance * 100),
    set: (value: number) => { hslFilter.value.luminance = Number(value) / 100; },
});
const noisePercent = computed({
    get: () => Math.round(noiseFilter.value.amount * 100),
    set: (value: number) => { noiseFilter.value.amount = Number(value) / 100; },
});

watch(
    () => props.open,
    async (open) => {
        if (open) {
            restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            draft.value = createLayoutFilterStack(props.filters);
            activeType.value = props.filters.find(({ enabled }) => enabled)?.type ?? 'brightness';
            await nextTick();
            dialogRef.value?.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
        } else {
            restoreFocus?.focus();
            restoreFocus = null;
        }
    },
    { immediate: true },
);

const toggleFilter = (type: LayoutFilterType, enabled: boolean) => {
    filterOfType(type).enabled = enabled;
};
const moveActiveFilter = (direction: -1 | 1) => {
    draft.value = moveLayoutFilter(draft.value, activeType.value, direction);
};
const removeFilters = () => {
    emit('apply', []);
    emit('close');
};
const applyFilters = () => {
    emit('apply', normalizeLayoutFilterStack(draft.value));
    emit('close');
};
const handleDialogKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        emit('close');
        return;
    }
    if (event.key !== 'Tab' || !dialogRef.value) return;
    const focusable = [...dialogRef.value.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hidden);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};
</script>

<template>
    <div v-if="open" class="publisher-page-dialog-backdrop publisher-effects-dialog-backdrop" @click.self="emit('close')" @keydown="handleDialogKeydown">
        <form ref="dialogRef" class="publisher-page-dialog publisher-effects-dialog publisher-filters-dialog" role="dialog" aria-modal="true" aria-labelledby="publisher-filters-dialog-title" @submit.prevent="applyFilters">
            <header>
                <div><h2 id="publisher-filters-dialog-title">Ebenenfilter</h2><span>{{ selectionCount }} Ebene{{ selectionCount === 1 ? '' : 'n' }}</span></div>
                <DesignIconButton data-dialog-initial-focus label="Dialog schließen" @click="emit('close')"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton>
            </header>

            <div class="publisher-effects-dialog__body">
                <nav aria-label="Filterreihenfolge">
                    <div v-for="definition in orderedFilterDefinitions" :key="definition.type" class="publisher-filters-dialog__nav-item" :class="{ 'is-active': activeType === definition.type }">
                        <button type="button" :aria-pressed="activeType === definition.type" @click="activeType = definition.type">
                            <FontAwesomeIcon :icon="definition.icon" aria-hidden="true" /><span>{{ definition.label }}</span>
                        </button>
                        <input :checked="filterOfType(definition.type).enabled" type="checkbox" :aria-label="`${definition.label} aktivieren`" @change="toggleFilter(definition.type, ($event.target as HTMLInputElement).checked)" />
                    </div>
                </nav>

                <section class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading">
                        <div><strong>{{ activeLabel }}</strong><small>Wirkt ausschließlich auf die ausgewählte Ebene oder Gruppe.</small></div>
                        <div class="publisher-filters-dialog__order">
                            <DesignIconButton size="compact" label="Filter nach oben verschieben" :disabled="activeIndex <= 0" @click="moveActiveFilter(-1)"><FontAwesomeIcon :icon="faArrowUp" aria-hidden="true" /></DesignIconButton>
                            <DesignIconButton size="compact" label="Filter nach unten verschieben" :disabled="activeIndex >= draft.length - 1" @click="moveActiveFilter(1)"><FontAwesomeIcon :icon="faArrowDown" aria-hidden="true" /></DesignIconButton>
                            <label><input :checked="activeFilter.enabled" type="checkbox" @change="toggleFilter(activeType, ($event.target as HTMLInputElement).checked)" /> Aktiv</label>
                        </div>
                    </div>

                    <fieldset :disabled="!activeFilter.enabled">
                        <template v-if="activeType === 'brightness'">
                            <label class="publisher-effects-dialog__range"><span>Helligkeit</span><input v-model.number="brightnessPercent" type="range" min="-100" max="100" step="1" /><input v-model.number="brightnessPercent" type="number" min="-100" max="100" step="1" /><small>%</small></label>
                        </template>
                        <template v-else-if="activeType === 'contrast'">
                            <label class="publisher-effects-dialog__range"><span>Kontrast</span><input v-model.number="contrastFilter.amount" type="range" min="-100" max="100" step="1" /><input v-model.number="contrastFilter.amount" type="number" min="-100" max="100" step="1" /><small>%</small></label>
                        </template>
                        <template v-else-if="activeType === 'hsl'">
                            <label class="publisher-effects-dialog__range"><span>Farbton</span><input v-model.number="hslFilter.hue" type="range" min="-180" max="180" step="1" /><input v-model.number="hslFilter.hue" type="number" min="-180" max="180" step="1" /><small>°</small></label>
                            <label class="publisher-effects-dialog__range"><span>Sättigung</span><input v-model.number="saturationPercent" type="range" min="-100" max="100" step="1" /><input v-model.number="saturationPercent" type="number" min="-100" max="100" step="1" /><small>%</small></label>
                            <label class="publisher-effects-dialog__range"><span>Helligkeit</span><input v-model.number="luminancePercent" type="range" min="-100" max="100" step="1" /><input v-model.number="luminancePercent" type="number" min="-100" max="100" step="1" /><small>%</small></label>
                        </template>
                        <template v-else-if="activeType === 'pixelate'">
                            <label class="publisher-effects-dialog__range"><span>Pixelgröße</span><input v-model.number="pixelateFilter.size" type="range" min="2" max="200" step="1" /><input v-model.number="pixelateFilter.size" type="number" min="2" max="200" step="1" /><small>px</small></label>
                        </template>
                        <template v-else-if="activeType === 'noise'">
                            <label class="publisher-effects-dialog__range"><span>Stärke</span><input v-model.number="noisePercent" type="range" min="0" max="100" step="1" /><input v-model.number="noisePercent" type="number" min="0" max="100" step="1" /><small>%</small></label>
                        </template>
                        <p v-else class="publisher-filters-dialog__description">Dieser Filter benötigt keine weiteren Einstellungen.</p>
                    </fieldset>
                </section>
            </div>

            <footer><DesignButton type="button" variant="danger" @click="removeFilters">Filter entfernen</DesignButton><span /><DesignButton type="button" variant="secondary" @click="emit('close')">Abbrechen</DesignButton><DesignButton type="submit">Anwenden</DesignButton></footer>
        </form>
    </div>
</template>

<style scoped>
.publisher-filters-dialog__nav-item {
    display: grid;
    min-height: 42px;
    padding-right: 9px;
    border: 1px solid transparent;
    border-radius: 7px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
}

.publisher-filters-dialog__nav-item:hover {
    background: var(--color-surface-muted);
}

.publisher-filters-dialog__nav-item.is-active {
    border-color: var(--color-accent);
    background: var(--color-surface-accent-strong);
}

.publisher-filters-dialog__nav-item > button {
    display: grid;
    min-width: 0;
    min-height: 40px;
    padding: 8px 9px;
    border: 0;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 7px;
    align-items: center;
    text-align: left;
}

.publisher-filters-dialog__nav-item.is-active > button {
    color: var(--color-text);
}

.publisher-filters-dialog__nav-item > button span {
    overflow: hidden;
    font-size: 12px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.publisher-filters-dialog__order {
    display: flex;
    align-items: center;
    gap: 5px;
}

.publisher-filters-dialog__order > label {
    display: flex;
    margin-left: 5px;
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 800;
    gap: 7px;
    align-items: center;
}

.publisher-filters-dialog__description {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 12px;
}

@media (max-width: 680px) {
    .publisher-filters-dialog .publisher-effects-dialog__body > nav {
        display: grid;
        max-height: 190px;
        overflow: auto;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .publisher-filters-dialog__nav-item {
        min-width: 0;
    }
}
</style>
