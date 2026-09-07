<script setup lang="ts">
import { faFileExport, faImage, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed } from 'vue';

import type { PublisherPageExportSettings } from '../../domain/publisherExport';
import type { PublisherPage } from '../../domain/publisherPage';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

const props = defineProps<{
    busy: boolean;
    error: string;
    open: boolean;
    pages: PublisherPage[];
    progress: string;
    settings: PublisherPageExportSettings[];
}>();

const emit = defineEmits<{
    close: [];
    submit: [];
    updatePage: [pageId: string, change: Partial<Omit<PublisherPageExportSettings, 'pageId'>>];
}>();

const enabledCount = computed(() => props.settings.filter(({ enabled }) => enabled).length);
const settingsFor = (pageId: string) => props.settings.find((entry) => entry.pageId === pageId)!;
</script>

<template>
    <div v-if="open" class="publisher-page-dialog-backdrop" @click.self="!busy && emit('close')" @keydown.esc="!busy && emit('close')">
        <form class="publisher-page-dialog publisher-export-dialog" role="dialog" aria-modal="true" aria-labelledby="publisher-export-dialog-title" @submit.prevent="emit('submit')">
            <header>
                <div class="publisher-export-dialog__heading"><span><FontAwesomeIcon :icon="faFileExport" aria-hidden="true" /></span><div><h2 id="publisher-export-dialog-title">Seiten exportieren</h2><small>Format und Qualität lassen sich für jede Seite getrennt festlegen.</small></div></div>
                <DesignIconButton label="Dialog schließen" :disabled="busy" @click="emit('close')"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton>
            </header>

            <div class="publisher-export-dialog__pages">
                <article v-for="(page, pageIndex) in pages" :key="page.id" class="publisher-export-page" :class="{ 'is-disabled': !settingsFor(page.id).enabled }">
                    <label class="publisher-export-page__toggle">
                        <input type="checkbox" :checked="settingsFor(page.id).enabled" :disabled="busy" @change="emit('updatePage', page.id, { enabled: ($event.target as HTMLInputElement).checked })" />
                        <span><FontAwesomeIcon :icon="faImage" aria-hidden="true" /></span>
                        <strong>Seite {{ pageIndex + 1 }}</strong>
                        <small>{{ page.width }} × {{ page.height }} px</small>
                    </label>
                    <label class="inspector-field">Format
                        <select :value="settingsFor(page.id).format" :disabled="busy || !settingsFor(page.id).enabled" @change="emit('updatePage', page.id, { format: ($event.target as HTMLSelectElement).value as PublisherPageExportSettings['format'] })">
                            <option value="png">PNG · Transparenz</option>
                            <option value="jpeg">JPEG · kleinere Datei</option>
                        </select>
                    </label>
                    <label v-if="settingsFor(page.id).format === 'jpeg'" class="publisher-export-page__quality">
                        <span>Qualität <output>{{ settingsFor(page.id).jpegQuality }} %</output></span>
                        <input type="range" min="10" max="100" step="1" :value="settingsFor(page.id).jpegQuality" :disabled="busy || !settingsFor(page.id).enabled" @input="emit('updatePage', page.id, { jpegQuality: ($event.target as HTMLInputElement).valueAsNumber })" />
                    </label>
                    <p v-else>Transparente Bereiche bleiben erhalten.</p>
                </article>
            </div>

            <p class="publisher-export-dialog__note">JPEG unterstützt keine Transparenz; transparente Bereiche werden weiß exportiert. Alle Dateien werden gemeinsam als ZIP gespeichert.</p>
            <p v-if="error" class="local-draft__error" role="alert">{{ error }}</p>
            <footer>
                <span>{{ progress || `${enabledCount} von ${pages.length} Seiten ausgewählt` }}</span>
                <DesignButton variant="secondary" :disabled="busy" @click="emit('close')">Abbrechen</DesignButton>
                <DesignButton type="submit" :disabled="busy || enabledCount === 0">{{ busy ? 'Exportiere …' : 'ZIP exportieren' }}</DesignButton>
            </footer>
        </form>
    </div>
</template>
