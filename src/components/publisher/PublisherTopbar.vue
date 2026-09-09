<script setup lang="ts">
import {
    faDatabase,
    faFileExport,
    faObjectGroup,
    faRotateLeft,
    faRotateRight,
    faTableColumns,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';

import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

defineProps<{
    documentTitle: string;
}>();

const { activeEditorTool } = storeToRefs(usePublisherEditorStore());
const { canRedoDocument, canUndoDocument } = storeToRefs(usePublisherDocumentStore());

const emit = defineEmits<{
    activate: [tool: 'data' | 'layout'];
    export: [];
    openTemplates: [];
    redo: [];
    undo: [];
}>();
</script>

<template>
    <div class="publisher-topbar">
        <div class="publisher-topbar__brand"><strong>Publisher</strong></div>
        <nav class="publisher-topbar__primary" aria-label="Dokumentwerkzeuge">
            <DesignButton size="compact" variant="ghost" aria-haspopup="dialog" @click="emit('openTemplates')"><template #icon><FontAwesomeIcon :icon="faTableColumns" /></template>Vorlagen</DesignButton>
        </nav>
        <div class="publisher-topbar__document"><strong>{{ documentTitle }}</strong></div>
        <div class="publisher-topbar__actions" role="toolbar" aria-label="Globale Aktionen">
            <DesignIconButton class="publisher-topbar__icon-button" label="Rückgängig" :disabled="!canUndoDocument" @click="emit('undo')"><FontAwesomeIcon :icon="faRotateLeft" aria-hidden="true" /></DesignIconButton>
            <DesignIconButton class="publisher-topbar__icon-button" label="Wiederholen" :disabled="!canRedoDocument" @click="emit('redo')"><FontAwesomeIcon :icon="faRotateRight" aria-hidden="true" /></DesignIconButton>
            <span class="publisher-topbar__separator" aria-hidden="true" />
            <DesignIconButton class="publisher-topbar__icon-button" toggle label="Termindaten" :active="activeEditorTool === 'data'" @click="emit('activate', 'data')"><FontAwesomeIcon :icon="faDatabase" aria-hidden="true" /></DesignIconButton>
            <DesignIconButton class="publisher-topbar__icon-button" toggle label="Layout" :active="activeEditorTool === 'layout'" @click="emit('activate', 'layout')"><FontAwesomeIcon :icon="faObjectGroup" aria-hidden="true" /></DesignIconButton>
            <span class="publisher-topbar__separator" aria-hidden="true" />
            <DesignButton class="publisher-topbar__export" @click="emit('export')"><template #icon><FontAwesomeIcon :icon="faFileExport" aria-hidden="true" /></template>Exportieren</DesignButton>
        </div>
    </div>
</template>
