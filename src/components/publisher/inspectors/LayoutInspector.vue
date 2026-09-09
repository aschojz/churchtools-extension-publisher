<script setup lang="ts">
import {
    faAlignCenter,
    faAlignLeft,
    faAlignRight,
    faBan,
    faBold,
    faItalic,
    faLock,
    faLockOpen,
    faListOl,
    faListUl,
    faSliders,
    faStrikethrough,
    faSync,
    faTrashCan,
    faUnderline,
    faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import type { EventTemplateProps } from '../../../domain/EventTemplateProps';
import {
    publisherDataValue,
    resolvePublisherPlaceholders,
    type PublisherDataValues,
} from '../../../domain/appointmentDataFields';
import {
    type ImagePaletteToken,
    type LayoutColorBinding,
} from '../../../domain/imagePalette';

import type {
    LayoutElementId,
    LayoutElementEffects,
    LayoutGeometry,
    LayoutLayerDragNode,
    LayoutLayerDropPlacement,
    LayoutTextStyle,
    LayoutTextMode,
    LayoutVisualStyle,
} from '../../../domain/layoutEditing';
import type { LayoutGradient } from '../../../domain/layoutGradient';
import {
    layoutFilterStackHasEnabled,
    normalizeLayoutFilterStack,
    type LayoutFilterStack,
} from '../../../domain/layoutFilters';
import {
    createLayoutLayerTree,
    layoutElementHasEffects,
    layoutElementLabel,
    normalizeLayoutElementEffects,
} from '../../../domain/layoutEditing';
import { usePublisherDocumentStore } from '../../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../../stores/publisherEditor';
import { PUBLISHER_DEFAULT_COLORS, usePublisherColorsStore } from '../../../stores/publisherColors';
import { usePublisherImagePalettesStore } from '../../../stores/publisherImagePalettes';
import DesignButton from '../../design/DesignButton.vue';
import DesignIconButton from '../../design/DesignIconButton.vue';
import DesignTabs from '../../design/DesignTabs.vue';
import LayoutLayerTree from '../../LayoutLayerTree.vue';
import LayoutEffectsDialog from '../LayoutEffectsDialog.vue';
import LayoutFiltersDialog from '../LayoutFiltersDialog.vue';
import LayoutGradientEditor from '../LayoutGradientEditor.vue';
import PublisherColorPicker from '../PublisherColorPicker.vue';
import PublisherImagePaletteSwatches from '../PublisherImagePaletteSwatches.vue';

const props = withDefaults(defineProps<{
    dataValues?: PublisherDataValues;
    template: EventTemplateProps;
}>(), { dataValues: () => ({}) });

const { activePage } = storeToRefs(usePublisherDocumentStore());
const imagePaletteStore = usePublisherImagePalettesStore();
const colorsStore = usePublisherColorsStore();
const { recentColors } = storeToRefs(colorsStore);
const { errors: imagePaletteErrors, palettes: imagePalettes, sources: imagePaletteSources, statuses: imagePaletteStatuses } = storeToRefs(imagePaletteStore);
const {
    availableLayoutElements, hasLayoutSelection, hasMultipleLayoutSelection,
    selectedLayoutElement, selectedLayoutElements, selectedLayoutGeometry, selectedLayoutGroupPath,
    selectedLayoutGroupDepth, selectedLayoutGroupId, selectedLayoutStyle, selectedLayoutTextMode, selectedLayoutVisualStyle,
} = storeToRefs(usePublisherEditorStore());
const canEditSelectedEffects = computed(() => hasLayoutSelection.value);
const layerTree = computed(() => {
    const state = activePage.value.layouts[activePage.value.templateId];
    return createLayoutLayerTree(
        state?.order ?? availableLayoutElements.value,
        state?.groups ?? [],
        state?.deleted ?? [],
    );
});
const activeLayout = computed(() => activePage.value.layouts[activePage.value.templateId]);
const effectElementIds = computed(() => Object.entries(activeLayout.value?.effects ?? {})
    .filter(([, effects]) => layoutElementHasEffects(effects))
    .map(([elementId]) => elementId));
const filterElementIds = computed(() => Object.entries(activeLayout.value?.filters ?? {})
    .filter(([, filters]) => layoutFilterStackHasEnabled(filters))
    .map(([elementId]) => elementId));
const hiddenElementIds = computed(() => activeLayout.value?.hidden ?? []);
const lockedElementIds = computed(() => activeLayout.value?.locked ?? []);
const repeatGroupIds = computed(() => activeLayout.value?.groups.flatMap((group) => {
    const ids: string[] = [];
    const visit = (candidate: typeof group) => {
        if (candidate.repeat) ids.push(candidate.id);
        candidate.children.forEach((child) => { if (typeof child !== 'string') visit(child); });
    };
    visit(group);
    return ids;
}) ?? []);
const selectionIsLocked = computed(() => selectedLayoutElements.value.length > 0 &&
    selectedLayoutElements.value.every((elementId) => lockedElementIds.value.includes(elementId)));
const selectionContainsLocked = computed(() => selectedLayoutElements.value.some((elementId) =>
    lockedElementIds.value.includes(elementId)));
const customElements = computed(() => activeLayout.value?.customElements ?? []);
const normalizedLayerText = (value: string) => value.replace(/\s+/g, ' ').trim();
const resolvedCustomText = (elementId: LayoutElementId) => {
    const element = customElements.value.find(({ id }) => id === elementId);
    return element?.kind === 'text'
        ? normalizedLayerText(resolvePublisherPlaceholders(element.text ?? '', props.dataValues))
        : '';
};
const elementLabels = computed<Record<LayoutElementId, string>>(() => Object.fromEntries(
    availableLayoutElements.value.map((elementId) => [
        elementId,
        elementId === 'title' ? normalizedLayerText(props.template.title) || 'Titel'
            : elementId === 'dateTime' ? normalizedLayerText([props.template.date, props.template.time].filter(Boolean).join(' · ')) || 'Datum/Uhrzeit'
                : elementId === 'location' ? normalizedLayerText(props.template.location) || 'Ort'
                    : resolvedCustomText(elementId) || customElements.value.find(({ id }) => id === elementId)?.name
                        || layoutElementLabel(elementId),
    ]),
) as Record<LayoutElementId, string>);
const elementPreviews = computed(() => Object.fromEntries(availableLayoutElements.value.map((elementId) => {
    const customElement = customElements.value.find(({ id }) => id === elementId);
    if (elementId === 'image' || customElement?.kind === 'image') {
        const imageSource = elementId === 'image'
            ? props.template.imageUrl ?? undefined
            : customElement?.dataBinding
                ? publisherDataValue(props.dataValues, customElement.dataBinding)
                : customElement?.imageSource;
        return [elementId, { kind: 'image' as const, ...(imageSource ? { imageSource } : {}) }];
    }
    const textStyle = activeLayout.value?.styles[elementId];
    if (textStyle) {
        return [elementId, {
            kind: 'text' as const,
            color: imagePaletteStore.resolveColor(textStyle.colorBinding, textStyle.color),
        }];
    }
    const visualStyle = activeLayout.value?.visualStyles[elementId];
    const kind = customElement?.kind === 'icon' ? 'icon' as const
        : customElement?.kind === 'qr' ? 'qr' as const : 'shape' as const;
    const color = visualStyle
        ? imagePaletteStore.resolveColor(
            customElement?.kind === 'line' ? visualStyle.strokeBinding : visualStyle.fillBinding,
            customElement?.kind === 'line' ? visualStyle.stroke : visualStyle.fill,
        )
        : undefined;
    return [elementId, { kind, ...(color ? { color } : {}) }];
})));
const selectedCustomElement = computed(() => activePage.value.layouts[activePage.value.templateId]?.customElements
    ?.find(({ id }) => id === selectedLayoutElement.value) ?? null);
const selectedQrElement = computed(() => selectedCustomElement.value?.kind === 'qr' ? selectedCustomElement.value : null);
const selectedLineElement = computed(() => selectedCustomElement.value?.kind === 'line' ? selectedCustomElement.value : null);

const emit = defineEmits<{
    deleteElements: [elementIds: LayoutElementId[]];
    drillIntoElement: [elementId: LayoutElementId];
    updateEffects: [targetIds: string[], effects: LayoutElementEffects];
    updateFilters: [targetIds: string[], filters: LayoutFilterStack];
    updateGradient: [field: 'color' | 'fill', gradient: LayoutGradient | null];
    moveLayer: [source: LayoutLayerDragNode, target: LayoutLayerDragNode, placement: LayoutLayerDropPlacement];
    restoreFontSize: [event: FocusEvent];
    restoreGeometry: [field: keyof LayoutGeometry, event: FocusEvent];
    selectElement: [elementId: LayoutElementId, event: MouseEvent];
    selectGroup: [groupId: string, event: MouseEvent];
    setFillColor: [color: string];
    setStaticColor: [field: 'color' | 'fill' | 'stroke', color: string];
    setTextColor: [color: string];
    setColorBinding: [field: 'color' | 'fill' | 'stroke', binding: LayoutColorBinding | null];
    toggleVisibility: [elementIds: LayoutElementId[]];
    toggleLock: [elementIds: LayoutElementId[]];
    updateGeometry: [field: keyof LayoutGeometry, event: Event];
    updateTextStyle: [field: keyof LayoutTextStyle, value: Event | string | number];
    updateTextMode: [mode: LayoutTextMode];
    updateQrOption: [field: 'qrValue' | 'qrBackground' | 'qrMargin' | 'qrErrorCorrection', value: string | number];
    updateVisualStyle: [field: keyof LayoutVisualStyle, event: Event];
}>();

const activeAppearanceTab = ref('fill');
const activeContentTab = ref('layers');
const appearanceTabs = [{ id: 'fill', label: 'Farbe' }, { id: 'stroke', label: 'Kontur' }];
const fillColorPickerTabs: ('color' | 'gradient')[] = ['color', 'gradient'];
const contentTabs = [
    { id: 'text', label: 'Text' },
    { id: 'paragraph', label: 'Absatz' },
    { id: 'layers', label: 'Ebenen' },
];
const effectsDialogOpen = ref(false);
const effectsDialogElementIds = ref<string[]>([]);
const effectsDialogValue = computed(() => normalizeLayoutElementEffects(
    activeLayout.value?.effects?.[effectsDialogElementIds.value[0] ?? ''],
));
const openEffectsDialog = (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    effectsDialogElementIds.value = [...targetIds];
    effectsDialogOpen.value = true;
};
const applyEffects = (effects: LayoutElementEffects) => {
    emit('updateEffects', effectsDialogElementIds.value, effects);
};
const filtersDialogOpen = ref(false);
const filtersDialogElementIds = ref<string[]>([]);
const filtersDialogValue = computed(() => normalizeLayoutFilterStack(
    activeLayout.value?.filters?.[filtersDialogElementIds.value[0] ?? ''],
));
const openFiltersDialog = (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    filtersDialogElementIds.value = [...targetIds];
    filtersDialogOpen.value = true;
};
const applyFilters = (filters: LayoutFilterStack) => {
    emit('updateFilters', filtersDialogElementIds.value, filters);
};
const selectedLayerEffects = computed(() => normalizeLayoutElementEffects(
    activeLayout.value?.effects?.[selectedLayoutGroupId.value ?? selectedLayoutElement.value ?? ''],
));
const selectedEffectTargetIds = computed(() => selectedLayoutGroupId.value
    ? [selectedLayoutGroupId.value]
    : selectedLayoutElements.value);
const updateLayerOpacity = (event: Event) => {
    if (!canEditSelectedEffects.value || selectionContainsLocked.value) return;
    const percent = (event.target as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(percent)) return;
    emit('updateEffects', selectedEffectTargetIds.value, {
        ...selectedLayerEffects.value,
        opacity: Math.min(1, Math.max(0, percent / 100)),
    });
};
const updateLayerBlendMode = (event: Event) => {
    if (!canEditSelectedEffects.value || selectionContainsLocked.value) return;
    emit('updateEffects', selectedEffectTargetIds.value, {
        ...selectedLayerEffects.value,
        blendMode: (event.target as HTMLSelectElement).value as LayoutElementEffects['blendMode'],
    });
};
const activeColorField = computed<'color' | 'fill' | 'stroke' | null>(() => {
    if (activeAppearanceTab.value === 'stroke') {
        return (selectedLayoutStyle.value || (selectedLayoutVisualStyle.value && !selectedQrElement.value)) ? 'stroke' : null;
    }
    if (selectedLayoutStyle.value) return 'color';
    if (selectedLayoutVisualStyle.value && !selectedLineElement.value) return 'fill';
    return null;
});
const activeColorBinding = computed(() => {
    if (activeColorField.value === 'color') return selectedLayoutStyle.value?.colorBinding;
    if (activeColorField.value === 'fill') return selectedLayoutVisualStyle.value?.fillBinding;
    if (activeColorField.value === 'stroke') return selectedLayoutStyle.value?.strokeBinding ?? selectedLayoutVisualStyle.value?.strokeBinding;
    return undefined;
});
const activeGradient = computed(() => activeColorField.value === 'color'
    ? selectedLayoutStyle.value?.colorGradient ?? null
    : activeColorField.value === 'fill' ? selectedLayoutVisualStyle.value?.fillGradient ?? null : null);
const activeGradientFallback = computed(() => activeColorField.value === 'color'
    ? selectedLayoutStyle.value?.color ?? '#ffffff'
    : selectedLayoutVisualStyle.value?.fill ?? '#69a7e8');
const applyExtractedColor = (color: string) => {
    if (activeColorField.value) emit('setStaticColor', activeColorField.value, color);
};
const bindImageColor = (imageId: string, token: ImagePaletteToken) => {
    if (activeColorField.value) emit('setColorBinding', activeColorField.value, { imageId, token });
};
const geometryFields: { id: keyof LayoutGeometry; label: string; title: string }[] = [
    { id: 'x', label: 'X', title: 'X-Position' }, { id: 'y', label: 'Y', title: 'Y-Position' },
    { id: 'width', label: 'B', title: 'Breite' }, { id: 'height', label: 'H', title: 'Höhe' },
    { id: 'rotation', label: 'R', title: 'Drehung' },
];
const geometryFieldIsDisabled = (field: keyof LayoutGeometry) =>
    !selectedLayoutGeometry.value ||
    selectionContainsLocked.value ||
    (selectedLayoutGroupDepth.value > 0 && (field === 'width' || field === 'height')) ||
    (selectedLayoutTextMode.value === 'graphic' && (field === 'width' || field === 'height')) ||
    (Boolean(selectedLineElement.value) && field === 'height');
const geometryFieldTitle = (field: typeof geometryFields[number]) => {
    if (!selectedLayoutGeometry.value) return `${field.title} – keine Auswahl`;
    if (selectedLayoutGroupDepth.value > 0 && (field.id === 'width' || field.id === 'height')) {
        return `${field.title} kann für Gruppen nicht direkt geändert werden.`;
    }
    if (selectedLayoutTextMode.value === 'graphic' && (field.id === 'width' || field.id === 'height')) {
        return 'Die Größe von Grafiktext wird über die Schriftgröße gesteuert.';
    }
    if (selectedLineElement.value && field.id === 'height') {
        return 'Die Höhe des Strichs wird über die Konturstärke gesteuert.';
    }
    return field.title;
};
const fontStyleIsActive = (style: 'bold' | 'italic') =>
    selectedLayoutStyle.value?.fontStyle.includes(style) ?? false;

const toggleFontStyle = (style: 'bold' | 'italic') => {
    const bold = style === 'bold' ? !fontStyleIsActive('bold') : fontStyleIsActive('bold');
    const italic = style === 'italic' ? !fontStyleIsActive('italic') : fontStyleIsActive('italic');
    const fontStyle: LayoutTextStyle['fontStyle'] = bold && italic
        ? 'bold italic'
        : bold ? 'bold' : italic ? 'italic' : 'normal';
    emit('updateTextStyle', 'fontStyle', fontStyle);
};

</script>

<template>
    <section id="layout-editor" class="publisher-inspector__content publisher-inspector__content--layout">
        <div class="inspector-fixed-block inspector-fixed-block--appearance">
            <DesignTabs v-model="activeAppearanceTab" label="Farbe und Kontur" :items="appearanceTabs" />
            <div class="inspector-fixed-block__scroll">
                <template v-if="activeAppearanceTab === 'fill'">
                    <div v-if="(selectedLayoutStyle || selectedLayoutVisualStyle) && !selectedLineElement" class="inspector-color-field">
                        <PublisherColorPicker
                            :model-value="selectedLayoutStyle?.color ?? selectedLayoutVisualStyle!.fill"
                            :color-binding="activeColorBinding"
                            :gradient="selectedQrElement ? null : activeGradient"
                            :tabs="selectedQrElement ? ['color'] : fillColorPickerTabs"
                            :label="selectedLayoutStyle ? 'Textfarbe' : 'Füllfarbe'"
                            :disabled="selectionContainsLocked"
                            :dynamic="!selectedQrElement"
                            @update:color-binding="activeColorField && emit('setColorBinding', activeColorField, $event)"
                            @update:model-value="selectedLayoutStyle ? emit('setTextColor', $event) : emit('setFillColor', $event)"
                        >
                            <template v-if="!selectedQrElement" #gradient>
                                <LayoutGradientEditor
                                    embedded
                                    :fallback-color="activeGradientFallback"
                                    :gradient="activeGradient"
                                    :disabled="selectionContainsLocked"
                                    @update="activeColorField && emit('updateGradient', activeColorField as 'color' | 'fill', $event)"
                                />
                            </template>
                        </PublisherColorPicker>
                        <span><strong>{{ activeColorBinding ? 'Fallback-Farbe' : selectedLayoutStyle ? 'Textfarbe' : selectedQrElement ? 'QR-Farbe' : 'Füllfarbe' }}</strong><small>{{ (selectedLayoutStyle?.color ?? selectedLayoutVisualStyle?.fill)?.toUpperCase() }}</small></span>
                    </div>
                    <p v-if="selectedLineElement" class="inspector-empty">Ein Strich besitzt keine Füllung. Farbe und Stärke bearbeitest du im Tab Kontur.</p>
                    <p v-else-if="selectedLayoutElement === 'image' || selectedLayoutElement?.startsWith('image-')" class="inspector-empty">Der Bildausschnitt bleibt proportional. Größe und Position bearbeitest du unter Transformieren.</p>
                    <p v-else-if="!selectedLayoutStyle && !selectedLayoutVisualStyle" class="inspector-empty">Wähle Text oder eine Form, um die Farbe zu bearbeiten.</p>
                    <section v-if="recentColors.length" class="inspector-recent-colors">
                        <strong>Zuletzt benutzt</strong>
                        <div class="inspector-swatches" aria-label="Zuletzt benutzte Farben">
                            <button
                                v-for="color in recentColors"
                                :key="color"
                                type="button"
                                :style="{ backgroundColor: color }"
                                :title="color.toUpperCase()"
                                :disabled="!activeColorField || selectionContainsLocked"
                                @click="applyExtractedColor(color)"
                            />
                        </div>
                    </section>
                    <div class="inspector-swatches" aria-label="Farbfelder"><button v-for="color in PUBLISHER_DEFAULT_COLORS" :key="color" type="button" :style="{ backgroundColor: color }" :title="color" :disabled="selectionContainsLocked || (!selectedLayoutStyle && !selectedLayoutVisualStyle) || Boolean(selectedLineElement)" @click="selectedLayoutStyle ? emit('setTextColor', color) : emit('setFillColor', color)" /></div>
                    <div v-if="selectedQrElement" class="inspector-qr-options">
                        <label class="inspector-color-field"><PublisherColorPicker :model-value="selectedQrElement.qrBackground ?? '#ffffff'" label="QR-Hintergrundfarbe" :disabled="selectionContainsLocked" @update:model-value="emit('updateQrOption', 'qrBackground', $event)" /><span><strong>Hintergrund</strong><small>{{ selectedQrElement.qrBackground?.toUpperCase() }}</small></span></label>
                        <div class="inspector-compact-fields">
                            <label class="inspector-field">Rand<input type="number" min="0" max="10" step="1" :value="selectedQrElement.qrMargin" @input="emit('updateQrOption', 'qrMargin', ($event.target as HTMLInputElement).valueAsNumber)" /></label>
                            <label class="inspector-field">Fehlerkorrektur<select :value="selectedQrElement.qrErrorCorrection" @change="emit('updateQrOption', 'qrErrorCorrection', ($event.target as HTMLSelectElement).value)"><option value="L">Niedrig</option><option value="M">Mittel</option><option value="Q">Hoch</option><option value="H">Sehr hoch</option></select></label>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <template v-if="selectedLayoutStyle"><label class="inspector-color-field"><PublisherColorPicker :model-value="selectedLayoutStyle.stroke" label="Textkonturfarbe" :disabled="selectionContainsLocked" @update:model-value="emit('setStaticColor', 'stroke', $event)" /><span><strong>{{ activeColorBinding ? 'Fallback-Farbe' : 'Textkontur' }}</strong><small>{{ selectedLayoutStyle.stroke.toUpperCase() }}</small></span></label><label class="inspector-field">Konturstärke<input type="number" min="0" max="100" step="1" :value="selectedLayoutStyle.strokeWidth" @input="emit('updateTextStyle', 'strokeWidth', $event)" /></label></template>
                    <template v-else-if="selectedLayoutVisualStyle && !selectedQrElement"><label class="inspector-color-field"><PublisherColorPicker :model-value="selectedLayoutVisualStyle.stroke" :label="selectedLineElement ? 'Strichfarbe' : 'Konturfarbe'" :disabled="selectionContainsLocked" @update:model-value="emit('setStaticColor', 'stroke', $event)" /><span><strong>{{ activeColorBinding ? 'Fallback-Farbe' : selectedLineElement ? 'Strichfarbe' : 'Konturfarbe' }}</strong><small>{{ selectedLayoutVisualStyle.stroke.toUpperCase() }}</small></span></label><label class="inspector-field">{{ selectedLineElement ? 'Strichstärke' : 'Konturstärke' }}<input type="number" min="0" max="100" step="1" :value="selectedLayoutVisualStyle.strokeWidth" @input="emit('updateVisualStyle', 'strokeWidth', $event)" /></label></template>
                    <p v-else-if="selectedQrElement" class="inspector-empty">QR-Codes haben keine Kontur. Farbe und Hintergrund bearbeitest du im Tab Farbe.</p>
                    <p v-else class="inspector-empty">Wähle Text oder eine Form, um die Kontur zu bearbeiten.</p>
                </template>
                <div v-if="imagePaletteSources.length" class="inspector-image-palettes">
                    <article v-for="source in imagePaletteSources" :key="source.id" class="inspector-image-palette">
                        <div class="inspector-image-palette__preview" :title="source.label">
                            <img :src="source.source" alt="" />
                        </div>
                        <div v-if="imagePalettes[source.id]" class="inspector-image-palette__colors">
                            <PublisherImagePaletteSwatches
                                :active-binding="activeColorBinding"
                                :disabled="!activeColorField || selectionContainsLocked"
                                dynamic
                                :image-id="source.id"
                                :image-label="source.label"
                                :palette="imagePalettes[source.id]!"
                                @clear-binding="activeColorField && emit('setColorBinding', activeColorField, null)"
                                @select-binding="bindImageColor(source.id, $event)"
                                @select-color="applyExtractedColor"
                            />
                        </div>
                        <div v-else class="inspector-image-palette__colors inspector-image-palette__colors--empty" aria-hidden="true">
                            <i v-for="index in 9" :key="index" />
                        </div>
                        <DesignIconButton
                            class="inspector-image-palette__sync"
                            :class="{ 'is-loading': imagePaletteStatuses[source.id] === 'loading' }"
                            size="compact"
                            :icon="faSync"
                            :label="imagePaletteStatuses[source.id] === 'loading' ? `${source.label} wird analysiert` : imagePalettes[source.id] ? `${source.label} erneut analysieren` : `${source.label} analysieren`"
                            :disabled="imagePaletteStatuses[source.id] === 'loading'"
                            @click="imagePaletteStore.analyze(source.id, true)"
                        />
                        <p v-if="imagePaletteErrors[source.id]" class="inspector-note inspector-note--error">{{ imagePaletteErrors[source.id] }}</p>
                    </article>
                </div>
            </div>
        </div>

        <div class="inspector-fixed-block inspector-fixed-block--content">
            <DesignTabs v-model="activeContentTab" label="Text und Ebenen" :items="contentTabs" />
            <div class="inspector-fixed-block__scroll" :class="{ 'inspector-fixed-block__scroll--layers': activeContentTab === 'layers' }">
                <template v-if="activeContentTab === 'text'">
                    <template v-if="selectedLayoutStyle">
                        <div v-if="selectedLayoutTextMode" class="inspector-control-group inspector-control-group--unlabeled" title="Textart">
                            <div class="inspector-toggle-row" role="group" aria-label="Textart">
                                <DesignButton size="compact" title="Grafiktext" :aria-pressed="selectedLayoutTextMode === 'graphic'" :variant="selectedLayoutTextMode === 'graphic' ? 'primary' : 'secondary'" @click="emit('updateTextMode', 'graphic')">Grafiktext</DesignButton>
                                <DesignButton size="compact" title="Rahmentext" :aria-pressed="selectedLayoutTextMode === 'frame'" :variant="selectedLayoutTextMode === 'frame' ? 'primary' : 'secondary'" @click="emit('updateTextMode', 'frame')">Rahmentext</DesignButton>
                            </div>
                        </div>
                        <label class="inspector-field inspector-field--control-only" title="Schriftart"><span class="sr-only">Schriftart</span><select aria-label="Schriftart" :value="selectedLayoutStyle.fontFamily" @change="emit('updateTextStyle', 'fontFamily', $event)"><option value="Lato, Arial, sans-serif">Lato</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Courier New</option></select></label>
                        <div class="inspector-compact-fields inspector-compact-fields--unlabeled">
                            <label class="inspector-field inspector-field--control-only" title="Schriftgröße"><span class="sr-only">Schriftgröße</span><input aria-label="Schriftgröße" title="Schriftgröße" type="number" min="12" max="240" step="1" :value="selectedLayoutStyle.fontSize" @blur="emit('restoreFontSize', $event)" @input="emit('updateTextStyle', 'fontSize', $event)" /></label>
                            <label class="inspector-field inspector-field--control-only" title="Zeichenabstand"><span class="sr-only">Zeichenabstand</span><input aria-label="Zeichenabstand" title="Zeichenabstand" type="number" min="-20" max="100" step="1" :value="selectedLayoutStyle.letterSpacing" @input="emit('updateTextStyle', 'letterSpacing', $event)" /></label>
                        </div>
                        <div class="inspector-control-group inspector-control-group--unlabeled" title="Schriftschnitt">
                            <div class="inspector-toggle-row" role="group" aria-label="Schriftschnitt">
                                <DesignIconButton toggle size="compact" label="Fett" :active="fontStyleIsActive('bold')" @click="toggleFontStyle('bold')"><FontAwesomeIcon :icon="faBold" aria-hidden="true" /></DesignIconButton>
                                <DesignIconButton toggle size="compact" label="Kursiv" :active="fontStyleIsActive('italic')" @click="toggleFontStyle('italic')"><FontAwesomeIcon :icon="faItalic" aria-hidden="true" /></DesignIconButton>
                            </div>
                        </div>
                        <div class="inspector-control-group inspector-control-group--unlabeled" title="Schreibweise">
                            <div class="inspector-toggle-row" role="group" aria-label="Schreibweise">
                                <DesignButton size="compact" title="Originalschreibweise" :aria-pressed="selectedLayoutStyle.textTransform === 'none'" :variant="selectedLayoutStyle.textTransform === 'none' ? 'primary' : 'secondary'" @click="emit('updateTextStyle', 'textTransform', 'none')">Aa</DesignButton>
                                <DesignButton size="compact" title="Großbuchstaben" :aria-pressed="selectedLayoutStyle.textTransform === 'uppercase'" :variant="selectedLayoutStyle.textTransform === 'uppercase' ? 'primary' : 'secondary'" @click="emit('updateTextStyle', 'textTransform', 'uppercase')">TT</DesignButton>
                                <DesignButton size="compact" title="Kapitälchen" :aria-pressed="selectedLayoutStyle.textTransform === 'smallCaps'" :variant="selectedLayoutStyle.textTransform === 'smallCaps' ? 'primary' : 'secondary'" @click="emit('updateTextStyle', 'textTransform', 'smallCaps')">Tᴛ</DesignButton>
                            </div>
                        </div>
                        <div class="inspector-control-grid">
                            <div class="inspector-control-group inspector-control-group--unlabeled" title="Unterstreichung">
                                <div class="inspector-toggle-row" role="group" aria-label="Unterstreichung">
                                    <DesignIconButton toggle size="compact" label="Keine Unterstreichung" :active="selectedLayoutStyle.underlineStyle === 'none'" @click="emit('updateTextStyle', 'underlineStyle', 'none')"><FontAwesomeIcon :icon="faBan" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Einfache Unterstreichung" :active="selectedLayoutStyle.underlineStyle === 'single'" @click="emit('updateTextStyle', 'underlineStyle', 'single')"><FontAwesomeIcon :icon="faUnderline" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Doppelte Unterstreichung" :active="selectedLayoutStyle.underlineStyle === 'double'" @click="emit('updateTextStyle', 'underlineStyle', 'double')"><span class="text-decoration-icon">U<span>2</span></span></DesignIconButton>
                                </div>
                            </div>
                            <div class="inspector-control-group inspector-control-group--unlabeled" title="Durchstreichung">
                                <div class="inspector-toggle-row" role="group" aria-label="Durchstreichung">
                                    <DesignIconButton toggle size="compact" label="Keine Durchstreichung" :active="selectedLayoutStyle.strikethroughStyle === 'none'" @click="emit('updateTextStyle', 'strikethroughStyle', 'none')"><FontAwesomeIcon :icon="faBan" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Einfache Durchstreichung" :active="selectedLayoutStyle.strikethroughStyle === 'single'" @click="emit('updateTextStyle', 'strikethroughStyle', 'single')"><FontAwesomeIcon :icon="faStrikethrough" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Doppelte Durchstreichung" :active="selectedLayoutStyle.strikethroughStyle === 'double'" @click="emit('updateTextStyle', 'strikethroughStyle', 'double')"><span class="text-decoration-icon">S<span>2</span></span></DesignIconButton>
                                </div>
                            </div>
                        </div>
                        <p v-if="hasMultipleLayoutSelection" class="inspector-note">Änderungen gelten für alle ausgewählten Elemente.</p>
                    </template>
                    <p v-else class="inspector-empty">Wähle ein Textelement, um die Zeichenformatierung zu bearbeiten.</p>
                </template>
                <template v-else-if="activeContentTab === 'paragraph'">
                    <template v-if="selectedLayoutStyle">
                        <div class="inspector-compact-fields">
                            <label class="inspector-field">Zeilenhöhe<input type="number" min="0.5" max="3" step="0.1" :value="selectedLayoutStyle.lineHeight" @input="emit('updateTextStyle', 'lineHeight', $event)" /></label>
                        </div>
                        <div class="inspector-control-grid">
                            <div class="inspector-control-group">
                                <span class="inspector-control-group__label">Ausrichtung</span>
                                <div class="inspector-toggle-row" role="group" aria-label="Textausrichtung">
                                    <DesignIconButton toggle size="compact" label="Linksbündig" :active="selectedLayoutStyle.align === 'left'" @click="emit('updateTextStyle', 'align', 'left')"><FontAwesomeIcon :icon="faAlignLeft" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Zentriert" :active="selectedLayoutStyle.align === 'center'" @click="emit('updateTextStyle', 'align', 'center')"><FontAwesomeIcon :icon="faAlignCenter" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Rechtsbündig" :active="selectedLayoutStyle.align === 'right'" @click="emit('updateTextStyle', 'align', 'right')"><FontAwesomeIcon :icon="faAlignRight" aria-hidden="true" /></DesignIconButton>
                                </div>
                            </div>
                            <div class="inspector-control-group">
                                <span class="inspector-control-group__label">Liste</span>
                                <div class="inspector-toggle-row" role="group" aria-label="Listenformat">
                                    <DesignIconButton toggle size="compact" label="Keine Liste" :active="selectedLayoutStyle.listStyle === 'none'" @click="emit('updateTextStyle', 'listStyle', 'none')"><FontAwesomeIcon :icon="faBan" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Aufzählung" :active="selectedLayoutStyle.listStyle === 'bullet'" @click="emit('updateTextStyle', 'listStyle', 'bullet')"><FontAwesomeIcon :icon="faListUl" aria-hidden="true" /></DesignIconButton>
                                    <DesignIconButton toggle size="compact" label="Nummerierung" :active="selectedLayoutStyle.listStyle === 'numbered'" @click="emit('updateTextStyle', 'listStyle', 'numbered')"><FontAwesomeIcon :icon="faListOl" aria-hidden="true" /></DesignIconButton>
                                </div>
                            </div>
                        </div>
                    </template>
                    <p v-else class="inspector-empty">Wähle ein Textelement, um die Absatzformatierung zu bearbeiten.</p>
                </template>
                <template v-else>
                    <div class="inspector-layer-appearance">
                        <label title="Deckkraft der ausgewählten Ebene"><span>Deckkraft</span><input type="number" min="0" max="100" step="1" :disabled="!canEditSelectedEffects || selectionContainsLocked" :value="Math.round(selectedLayerEffects.opacity * 100)" @input="updateLayerOpacity" /><span>%</span></label>
                        <select title="Mischmodus der ausgewählten Ebene" aria-label="Mischmodus" :disabled="!canEditSelectedEffects || selectionContainsLocked" :value="selectedLayerEffects.blendMode" @change="updateLayerBlendMode"><option value="source-over">Normal</option><option value="multiply">Multiplizieren</option><option value="screen">Negativ multiplizieren</option><option value="overlay">Ineinanderkopieren</option><option value="darken">Abdunkeln</option><option value="lighten">Aufhellen</option></select>
                    </div>
                    <LayoutLayerTree class="inspector-layer-list" aria-label="Ebenenliste" :effect-element-ids="effectElementIds" :filter-element-ids="filterElementIds" :element-labels="elementLabels" :element-previews="elementPreviews" :expanded-group-ids="selectedLayoutGroupPath" :hidden-element-ids="hiddenElementIds" :locked-element-ids="lockedElementIds" :nodes="layerTree" :repeat-group-ids="repeatGroupIds" :selected-element-ids="selectedLayoutElements" @drill-into-element="emit('drillIntoElement', $event)" @edit-effects="openEffectsDialog([$event])" @edit-filters="openFiltersDialog([$event])" @move-layer="(source, target, placement) => emit('moveLayer', source, target, placement)" @select-element="(elementId, event) => emit('selectElement', elementId, event)" @select-group="(groupId, event) => emit('selectGroup', groupId, event)" @toggle-visibility="emit('toggleVisibility', $event)" />
                </template>
            </div>
            <footer v-if="activeContentTab === 'layers'" class="inspector-layer-footer">
                <span>{{ selectedLayoutElements.length ? `${selectedLayoutElements.length} ausgewählt` : 'Keine Auswahl' }}</span>
                <div><DesignIconButton size="compact" label="Ebeneneffekte" :disabled="!canEditSelectedEffects || selectionContainsLocked" @click="openEffectsDialog(selectedEffectTargetIds)"><FontAwesomeIcon :icon="faWandMagicSparkles" aria-hidden="true" /></DesignIconButton><DesignIconButton size="compact" label="Ebenenfilter" :disabled="!canEditSelectedEffects || selectionContainsLocked" @click="openFiltersDialog(selectedEffectTargetIds)"><FontAwesomeIcon :icon="faSliders" aria-hidden="true" /></DesignIconButton><DesignIconButton size="compact" :label="selectionIsLocked ? 'Auswahl entsperren' : 'Auswahl sperren'" :disabled="!hasLayoutSelection" @click="emit('toggleLock', selectedLayoutElements)"><FontAwesomeIcon :icon="selectionIsLocked ? faLockOpen : faLock" aria-hidden="true" /></DesignIconButton><DesignIconButton variant="danger" size="compact" label="Auswahl löschen" :disabled="!hasLayoutSelection || selectionContainsLocked" @click="emit('deleteElements', selectedLayoutElements)"><FontAwesomeIcon :icon="faTrashCan" aria-hidden="true" /></DesignIconButton></div>
            </footer>
        </div>

        <div class="inspector-fixed-block inspector-fixed-block--transform">
            <div class="inspector-fixed-block__title">Transformieren</div>
            <div class="inspector-fixed-block__scroll">
                <div class="inspector-transform-grid"><label v-for="field in geometryFields" :key="field.id" :title="field.title">{{ field.label }}<input type="number" step="1" :aria-label="field.title" :value="selectedLayoutGeometry ? Math.round(selectedLayoutGeometry[field.id]) : ''" :disabled="geometryFieldIsDisabled(field.id)" :title="geometryFieldTitle(field)" @blur="emit('restoreGeometry', field.id, $event)" @input="emit('updateGeometry', field.id, $event)" /></label></div>
            </div>
        </div>
        <LayoutEffectsDialog :effects="effectsDialogValue" :open="effectsDialogOpen" :selection-count="effectsDialogElementIds.length" @apply="applyEffects" @close="effectsDialogOpen = false" />
        <LayoutFiltersDialog :filters="filtersDialogValue" :open="filtersDialogOpen" :selection-count="filtersDialogElementIds.length" @apply="applyFilters" @close="filtersDialogOpen = false" />
    </section>
</template>
