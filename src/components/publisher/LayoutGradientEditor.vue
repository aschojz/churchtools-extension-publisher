<script setup lang="ts">
import { faAngleDown, faArrowRightArrowLeft, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import {
    createLayoutGradient,
    layoutGradientCss,
    normalizeLayoutGradient,
    type LayoutGradient,
    type LayoutGradientStop,
} from '../../domain/layoutGradient';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

const props = defineProps<{
    disabled?: boolean;
    fallbackColor: string;
    gradient: LayoutGradient | null;
}>();
const emit = defineEmits<{ update: [gradient: LayoutGradient | null] }>();

const updateGradient = (change: Partial<LayoutGradient>) => {
    if (!props.gradient) return;
    emit('update', normalizeLayoutGradient({ ...props.gradient, ...change }));
};
const updateNumber = (field: keyof LayoutGradient, event: Event) => {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(value)) updateGradient({ [field]: value });
};
const updateStop = (stopId: string, change: Partial<LayoutGradientStop>) => {
    if (!props.gradient) return;
    updateGradient({ stops: props.gradient.stops.map((stop) => stop.id === stopId ? { ...stop, ...change } : stop) });
};
const updateStopNumber = (stopId: string, field: 'offset' | 'opacity', event: Event) => {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(value)) return;
    updateStop(stopId, { [field]: value / 100 });
};
const addStop = () => {
    if (!props.gradient) return;
    const sorted = [...props.gradient.stops].sort((left, right) => left.offset - right.offset);
    let insertionOffset = 0.5;
    let largestGap = -1;
    for (let index = 1; index < sorted.length; index += 1) {
        const gap = sorted[index].offset - sorted[index - 1].offset;
        if (gap > largestGap) {
            largestGap = gap;
            insertionOffset = sorted[index - 1].offset + gap / 2;
        }
    }
    updateGradient({ stops: [...props.gradient.stops, {
        id: `gradient-stop-${Date.now()}`,
        offset: insertionOffset,
        color: props.fallbackColor,
        opacity: 1,
    }] });
};
const removeStop = (stopId: string) => {
    if (!props.gradient || props.gradient.stops.length <= 2) return;
    updateGradient({ stops: props.gradient.stops.filter(({ id }) => id !== stopId) });
};
const reverseStops = () => {
    if (!props.gradient) return;
    updateGradient({ stops: props.gradient.stops.map((stop) => ({ ...stop, offset: 1 - stop.offset })) });
};
</script>

<template>
    <div class="inspector-gradient-editor">
        <DesignButton v-if="!gradient" size="compact" variant="secondary" :disabled="disabled" @click="emit('update', createLayoutGradient(fallbackColor))">Verlauf hinzufügen</DesignButton>
        <details v-else open>
            <summary><span>Verlauf bearbeiten</span><FontAwesomeIcon :icon="faAngleDown" aria-hidden="true" /></summary>
            <div class="inspector-gradient-editor__body">
                <div class="inspector-gradient-editor__preview" :style="{ background: layoutGradientCss(gradient) }" />
                <div class="inspector-gradient-editor__topline">
                    <select aria-label="Verlaufstyp" :disabled="disabled" :value="gradient.type" @change="updateGradient({ type: ($event.target as HTMLSelectElement).value as LayoutGradient['type'] })"><option value="linear">Linear</option><option value="radial">Radial</option></select>
                    <DesignIconButton size="compact" label="Verlauf umkehren" :disabled="disabled" @click="reverseStops"><FontAwesomeIcon :icon="faArrowRightArrowLeft" aria-hidden="true" /></DesignIconButton>
                    <DesignButton size="compact" variant="secondary" :disabled="disabled" @click="emit('update', null)">Volltonfarbe</DesignButton>
                </div>
                <div class="inspector-gradient-editor__geometry">
                    <label title="Startpunkt X">X₁<input type="number" step="1" :disabled="disabled" :value="gradient.startX" @input="updateNumber('startX', $event)" /></label>
                    <label title="Startpunkt Y">Y₁<input type="number" step="1" :disabled="disabled" :value="gradient.startY" @input="updateNumber('startY', $event)" /></label>
                    <label title="Endpunkt X">X₂<input type="number" step="1" :disabled="disabled" :value="gradient.endX" @input="updateNumber('endX', $event)" /></label>
                    <label title="Endpunkt Y">Y₂<input type="number" step="1" :disabled="disabled" :value="gradient.endY" @input="updateNumber('endY', $event)" /></label>
                    <template v-if="gradient.type === 'radial'">
                        <label title="Startradius in Prozent">R₁<input type="number" min="0" step="1" :disabled="disabled" :value="gradient.startRadius" @input="updateNumber('startRadius', $event)" /></label>
                        <label title="Endradius in Prozent">R₂<input type="number" min="0" step="1" :disabled="disabled" :value="gradient.endRadius" @input="updateNumber('endRadius', $event)" /></label>
                    </template>
                </div>
                <div class="inspector-gradient-stops">
                    <div v-for="stop in gradient.stops" :key="stop.id" class="inspector-gradient-stop">
                        <input type="color" aria-label="Farbe des Verlaufspunkts" :disabled="disabled" :value="stop.color" @input="updateStop(stop.id, { color: ($event.target as HTMLInputElement).value })" />
                        <label title="Position"><span class="sr-only">Position</span><input type="number" min="0" max="100" step="1" :disabled="disabled" :value="Math.round(stop.offset * 100)" @input="updateStopNumber(stop.id, 'offset', $event)" /><span>%</span></label>
                        <label title="Deckkraft"><span class="sr-only">Deckkraft</span><input type="number" min="0" max="100" step="1" :disabled="disabled" :value="Math.round(stop.opacity * 100)" @input="updateStopNumber(stop.id, 'opacity', $event)" /><span>%</span></label>
                        <DesignIconButton size="compact" label="Verlaufspunkt löschen" :disabled="disabled || gradient.stops.length <= 2" @click="removeStop(stop.id)"><FontAwesomeIcon :icon="faTrashCan" aria-hidden="true" /></DesignIconButton>
                    </div>
                </div>
                <DesignButton size="compact" variant="secondary" :disabled="disabled" @click="addStop"><FontAwesomeIcon :icon="faPlus" aria-hidden="true" /> Verlaufspunkt</DesignButton>
            </div>
        </details>
    </div>
</template>
