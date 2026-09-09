<script setup lang="ts">
import { faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import type { PublisherDesignTemplate } from '../../domain/publisherDesignTemplate';
import type { PublisherDocumentRecord } from '../../domain/publisherRepository';
import type { TemplateId } from '../../domain/templates';
import DesignDialog from '../design/DesignDialog.vue';
import TemplateInspector from './inspectors/TemplateInspector.vue';

defineProps<{
    activeDocumentId: string;
    designTemplates: PublisherDesignTemplate[];
    documentName: string;
    documents: PublisherDocumentRecord[];
    draftError: string;
    draftStatus: string;
    error: string;
    name: string;
    open: boolean;
    selectedDesignTemplateId: string;
    selectedTemplateId: TemplateId;
    storageMessage: string;
    storageStatus: string;
    status: string;
}>();

const emit = defineEmits<{
    applyDesign: [template: PublisherDesignTemplate];
    applyStandard: [templateId: TemplateId];
    close: [];
    deleteDesign: [template: PublisherDesignTemplate];
    deleteDocument: [document: PublisherDocumentRecord];
    newDocument: [];
    openDocument: [document: PublisherDocumentRecord];
    saveDocument: [];
    saveDesign: [template?: PublisherDesignTemplate];
    'update:documentName': [value: string];
    'update:name': [value: string];
}>();

</script>

<template>
    <DesignDialog
        :open="open"
        size="wide"
        title="Vorlagen und Dokumente"
        description="Layouts anwenden, als Vorlage sichern oder gespeicherte Dokumente öffnen."
        @close="emit('close')"
    >
        <template #icon><FontAwesomeIcon :icon="faTableColumns" aria-hidden="true" /></template>
        <TemplateInspector
            :active-document-id="activeDocumentId"
            :name="name"
            :design-templates="designTemplates"
            :document-name="documentName"
            :documents="documents"
            :draft-error="draftError"
            :draft-status="draftStatus"
            :error="error"
            :selected-design-template-id="selectedDesignTemplateId"
            :selected-template-id="selectedTemplateId"
            :storage-message="storageMessage"
            :storage-status="storageStatus"
            :status="status"
            @apply-design="emit('applyDesign', $event)"
            @apply-standard="emit('applyStandard', $event)"
            @delete-design="emit('deleteDesign', $event)"
            @delete-document="emit('deleteDocument', $event)"
            @new-document="emit('newDocument')"
            @open-document="emit('openDocument', $event)"
            @save-document="emit('saveDocument')"
            @save-design="emit('saveDesign', $event)"
            @update:document-name="emit('update:documentName', $event)"
            @update:name="emit('update:name', $event)"
        />
    </DesignDialog>
</template>
