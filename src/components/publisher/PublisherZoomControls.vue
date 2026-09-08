<script setup lang="ts">
import { faCrosshairs, faExpand, faHand } from '@fortawesome/free-solid-svg-icons';

import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

defineProps<{
    canFitSelection: boolean;
    panActive: boolean;
    zoom: number;
}>();

const emit = defineEmits<{
    fitPage: [];
    fitSelection: [];
    showActualSize: [];
    togglePan: [];
    'update:zoom': [value: number];
}>();

const updateZoom = (event: Event) => {
    emit('update:zoom', Number((event.target as HTMLInputElement).value));
};
</script>

<template>
    <div class="publisher-zoom-controls" role="toolbar" aria-label="Ansicht und Zoom">
        <DesignIconButton
            size="compact"
            toggle
            :active="panActive"
            label="Arbeitsfläche verschieben (Leertaste)"
            :icon="faHand"
            @click="emit('togglePan')"
        />
        <DesignIconButton size="compact" label="Aktive Seite einpassen" :icon="faExpand" @click="emit('fitPage')" />
        <DesignIconButton
            size="compact"
            label="Auswahl einpassen"
            :disabled="!canFitSelection"
            :icon="faCrosshairs"
            @click="emit('fitSelection')"
        />
        <DesignButton size="compact" variant="ghost" title="Tatsächliche Größe anzeigen" @click="emit('showActualSize')">100 %</DesignButton>
        <label class="publisher-statusbar__zoom" for="preview-zoom">
            <span class="sr-only">Zoom</span>
            <input
                id="preview-zoom"
                :value="zoom"
                type="range"
                min="25"
                max="400"
                step="1"
                aria-label="Zoom"
                @input="updateZoom"
            />
            <output for="preview-zoom">{{ Math.round(zoom) }} %</output>
        </label>
    </div>
</template>
