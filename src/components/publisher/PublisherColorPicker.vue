<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

import { layoutGradientCss, type LayoutGradient } from '../../domain/layoutGradient';
import { type ImagePaletteToken, type LayoutColorBinding } from '../../domain/imagePalette';
import { PUBLISHER_DEFAULT_COLORS, usePublisherColorsStore } from '../../stores/publisherColors';
import { usePublisherImagePalettesStore } from '../../stores/publisherImagePalettes';
import PublisherImagePaletteSwatches from './PublisherImagePaletteSwatches.vue';

type PublisherColorPickerTab = 'color' | 'gradient';
const props = withDefaults(defineProps<{
    disabled?: boolean;
    colorBinding?: LayoutColorBinding;
    dynamic?: boolean;
    gradient?: LayoutGradient | null;
    label?: string;
    modelValue: string;
    size?: 'compact' | 'default';
    tabs?: PublisherColorPickerTab[];
}>(), {
    disabled: false,
    colorBinding: undefined,
    dynamic: false,
    gradient: null,
    label: 'Farbe auswählen',
    size: 'default',
    tabs: () => ['color'],
});
const emit = defineEmits<{
    'update:colorBinding': [binding: LayoutColorBinding | null];
    'update:modelValue': [color: string];
}>();

const popoverId = useId();
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const popover = ref<HTMLElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});
const dark = ref(false);
const activeTab = ref<PublisherColorPickerTab>('color');
const colorsStore = usePublisherColorsStore();
const { recentColors } = storeToRefs(colorsStore);
const imagePalettesStore = usePublisherImagePalettesStore();
const { palettes, sources } = storeToRefs(imagePalettesStore);
const availableTabs = computed<PublisherColorPickerTab[]>(() => {
    const tabs = props.tabs.filter((tab, index, entries) =>
        (tab === 'color' || tab === 'gradient') && entries.indexOf(tab) === index);
    return tabs.length ? tabs : ['color'];
});
const previewStyle = computed(() => ({
    background: props.gradient
        ? layoutGradientCss(props.gradient, imagePalettesStore.resolveColor)
        : imagePalettesStore.resolveColor(props.colorBinding, props.modelValue),
}));
const normalizeColor = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
const updatePopoverPosition = () => {
    if (!open.value || !trigger.value || !popover.value) return;
    const viewportMargin = 8;
    const gap = 6;
    const rect = trigger.value.getBoundingClientRect();
    const preferredWidth = availableTabs.value.includes('gradient') ? 360 : 300;
    const width = Math.min(preferredWidth, Math.max(160, window.innerWidth - viewportMargin * 2));
    const measuredHeight = popover.value.scrollHeight || 480;
    const roomBelow = window.innerHeight - rect.bottom - gap - viewportMargin;
    const roomAbove = rect.top - gap - viewportMargin;
    const placeAbove = roomBelow < Math.min(measuredHeight, 140) && roomAbove > roomBelow;
    const availableHeight = Math.max(100, placeAbove ? roomAbove : roomBelow);
    const renderedHeight = Math.min(measuredHeight, availableHeight);
    const left = Math.min(
        Math.max(viewportMargin, rect.left),
        Math.max(viewportMargin, window.innerWidth - width - viewportMargin),
    );
    const top = placeAbove
        ? Math.max(viewportMargin, rect.top - gap - renderedHeight)
        : Math.min(window.innerHeight - viewportMargin - renderedHeight, rect.bottom + gap);
    popoverStyle.value = {
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${Math.round(width)}px`,
        maxHeight: `${Math.round(availableHeight)}px`,
    };
};
const closePopover = (restoreFocus = false) => {
    if (!open.value) return;
    open.value = false;
    if (restoreFocus) void nextTick(() => trigger.value?.focus());
};
const togglePopover = async () => {
    if (props.disabled) return;
    open.value = !open.value;
    if (!open.value) return;
    activeTab.value = props.gradient && availableTabs.value.includes('gradient')
        ? 'gradient'
        : availableTabs.value[0] ?? 'color';
    dark.value = Boolean(trigger.value?.closest('.dark'));
    await nextTick();
    updatePopoverPosition();
};
const selectColor = (color: string) => {
    if (props.disabled) return;
    const normalized = normalizeColor(color);
    if (!normalized) return;
    emit('update:modelValue', normalized);
    colorsStore.rememberColor(normalized);
    closePopover(true);
};
const selectNativeColor = (event: Event) => selectColor((event.target as HTMLInputElement).value);
const selectBinding = (imageId: string, token: ImagePaletteToken) => {
    if (props.disabled || !props.dynamic) return;
    emit('update:colorBinding', { imageId, token });
    closePopover(true);
};
const clearBinding = () => {
    if (props.disabled || !props.dynamic) return;
    emit('update:colorBinding', null);
    closePopover(true);
};
const handlePointerDown = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!open.value || trigger.value?.contains(target) || popover.value?.contains(target) ||
        (target instanceof Element && target.closest('.publisher-color-picker__popover'))) return;
    closePopover();
};
const handleKeyDown = (event: KeyboardEvent) => {
    if (open.value && event.key === 'Escape') {
        const openPopovers = [...document.querySelectorAll('.publisher-color-picker__popover')];
        if (openPopovers.at(-1) !== popover.value) return;
        event.preventDefault();
        closePopover(true);
    }
};
onMounted(() => {
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('scroll', updatePopoverPosition, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePopoverPosition);
});
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handlePointerDown);
    document.removeEventListener('scroll', updatePopoverPosition, true);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', updatePopoverPosition);
});
watch(() => props.disabled, (disabled) => { if (disabled) closePopover(); });
watch(availableTabs, (tabs) => {
    if (!tabs.includes(activeTab.value)) activeTab.value = tabs[0] ?? 'color';
});
</script>

<template>
    <div class="publisher-color-picker" :class="[`publisher-color-picker--${size}`, { 'is-open': open }]">
        <button
            ref="trigger"
            type="button"
            :aria-label="label"
            aria-haspopup="dialog"
            :aria-expanded="open"
            :aria-controls="popoverId"
            :disabled="disabled"
            :title="label"
            @click="togglePopover"
        ><i :style="previewStyle" /></button>
        <Teleport to="body">
            <div
                v-if="open"
                :id="popoverId"
                ref="popover"
                class="publisher-color-picker__popover"
                :class="{ dark }"
                :style="popoverStyle"
                role="dialog"
                :aria-label="label"
            >
                <nav v-if="availableTabs.length > 1" class="publisher-color-picker__tabs" role="tablist" aria-label="Farbmodus">
                    <button v-if="availableTabs.includes('color')" type="button" role="tab" :aria-selected="activeTab === 'color'" @click="activeTab = 'color'">Farbe &amp; Farbfelder</button>
                    <button v-if="availableTabs.includes('gradient')" type="button" role="tab" :aria-selected="activeTab === 'gradient'" @click="activeTab = 'gradient'">Verlauf</button>
                </nav>
                <div v-if="activeTab === 'color'" class="publisher-color-picker__pane" role="tabpanel">
                    <label class="publisher-color-picker__native">
                        <input type="color" :aria-label="`${label} mit Farbwähler`" :value="modelValue" @change="selectNativeColor" />
                        <code>{{ modelValue.toUpperCase() }}</code>
                    </label>
                    <section>
                        <strong>Standard</strong>
                        <div class="publisher-color-picker__swatches">
                            <button v-for="color in PUBLISHER_DEFAULT_COLORS" :key="color" type="button" :style="{ backgroundColor: color }" :title="color" :aria-label="color" @click="selectColor(color)" />
                        </div>
                    </section>
                    <section v-if="recentColors.length">
                        <strong>Zuletzt benutzt</strong>
                        <div class="publisher-color-picker__swatches">
                            <button v-for="color in recentColors" :key="color" type="button" :style="{ backgroundColor: color }" :title="color.toUpperCase()" :aria-label="color.toUpperCase()" @click="selectColor(color)" />
                        </div>
                    </section>
                    <section v-for="source in sources" v-show="palettes[source.id]" :key="source.id">
                        <strong>Bildfarben</strong>
                        <div class="publisher-color-picker__image-palette">
                            <img :src="source.source" alt="" :title="source.label" />
                            <PublisherImagePaletteSwatches
                                v-if="palettes[source.id]"
                                :active-binding="colorBinding"
                                :disabled="disabled"
                                :dynamic="dynamic"
                                :image-id="source.id"
                                :image-label="source.label"
                                :palette="palettes[source.id]!"
                                @clear-binding="clearBinding"
                                @select-binding="selectBinding(source.id, $event)"
                                @select-color="selectColor"
                            />
                        </div>
                    </section>
                </div>
                <div v-else class="publisher-color-picker__pane publisher-color-picker__pane--gradient" role="tabpanel">
                    <slot name="gradient" />
                </div>
            </div>
        </Teleport>
    </div>
</template>
