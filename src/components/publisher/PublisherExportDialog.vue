<script setup lang="ts">
import { faFileExport, faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed } from 'vue';

import type { PublisherPageExportSettings } from '../../domain/publisherExport';
import type { PublisherPage } from '../../domain/publisherPage';
import DesignButton from '../design/DesignButton.vue';
import DesignDialog from '../design/DesignDialog.vue';

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
    <DesignDialog
        :open="open"
        :close-disabled="busy"
        title="Seiten exportieren"
        description="Format und Qualität lassen sich für jede Seite getrennt festlegen."
        panel-class="publisher-export-dialog"
        body-class="publisher-export-dialog__dialog-body"
        @close="emit('close')"
    >
        <template #icon><FontAwesomeIcon :icon="faFileExport" /></template>
        <form id="publisher-export-dialog-form" class="publisher-export-dialog__form" @submit.prevent="emit('submit')">
            <div class="publisher-export-dialog__pages">
                <article v-for="page in pages" :key="page.id" class="publisher-export-page" :class="{ 'is-disabled': !settingsFor(page.id).enabled }">
                    <label class="publisher-export-page__toggle">
                        <input type="checkbox" :checked="settingsFor(page.id).enabled" :disabled="busy" @change="emit('updatePage', page.id, { enabled: ($event.target as HTMLInputElement).checked })" />
                        <span><FontAwesomeIcon :icon="faImage" aria-hidden="true" /></span>
                        <strong>{{ page.name }}</strong>
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
        </form>
        <template #footer>
            <span aria-live="polite">{{ progress || `${enabledCount} von ${pages.length} Seiten ausgewählt` }}</span>
            <DesignButton variant="secondary" :disabled="busy" @click="emit('close')">Abbrechen</DesignButton>
            <DesignButton type="submit" form="publisher-export-dialog-form" :disabled="busy || enabledCount === 0">{{ busy ? 'Exportiere …' : 'ZIP exportieren' }}</DesignButton>
        </template>
    </DesignDialog>
</template>

<style scoped>
.publisher-export-dialog__form {
    display: grid;
    min-height: 0;
    height: 100%;
    grid-template-rows: minmax(0, 1fr) auto auto;
}
</style>
