<script setup lang="ts">
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { watch } from 'vue';

import type { EventTemplateProps } from '../../domain/EventTemplateProps';
import type { PublisherDataValues } from '../../domain/appointmentDataFields';
import type { SerializableLayoutState } from '../../domain/layoutHistory';
import type { PublisherCanvasExportOptions } from '../../domain/publisherExport';
import { pageShowsTemplateDecorations } from '../../domain/publisherPage';
import type { TemplateId } from '../../domain/templates';
import { usePublisherAppointmentsStore } from '../../stores/publisherAppointments';
import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import EventTemplate from '../EventTemplate.vue';
import DesignButton from '../design/DesignButton.vue';

const props = defineProps<{
    detailsError: boolean;
    detailsPending: boolean;
    dataValues: PublisherDataValues;
    draftId: string;
    exportError: string;
    imageStatus: 'idle' | 'loading' | 'loaded' | 'error';
    template: EventTemplateProps | null;
}>();

const emit = defineEmits<{
    activeTemplateChange: [instance: InstanceType<typeof EventTemplate> | null];
    imageStatusChange: [status: 'idle' | 'loading' | 'loaded' | 'error'];
    layoutStateChange: [pageId: string, templateId: TemplateId, state: SerializableLayoutState];
}>();

const documentStore = usePublisherDocumentStore();
const editorStore = usePublisherEditorStore();
const appointmentStore = usePublisherAppointmentsStore();
const { activePageId, pages } = storeToRefs(documentStore);
const {
    availableLayoutElements, canRedoLayout, canUndoLayout, layoutChanged, previewZoomPercent,
    selectedLayerPosition, selectedLayerTotal, selectedLayoutElementChanged,
    selectedLayoutGeometry, selectedLayoutGroupPath, selectedLayoutStyle,
    selectedLayoutTextContent, selectedLayoutTextMode, selectedLayoutVisualStyle, snapEnabled,
} = storeToRefs(editorStore);
const previewZoom = (value: number) => (value / 100) * 0.32;

const pageTemplateRefs = new Map<string, InstanceType<typeof EventTemplate>>();
const emitActiveTemplate = () => emit('activeTemplateChange', pageTemplateRefs.get(activePageId.value) ?? null);
const setPageTemplateRef = (pageId: string, instance: unknown) => {
    const templateInstance = instance as InstanceType<typeof EventTemplate> | null;
    if (templateInstance) pageTemplateRefs.set(pageId, templateInstance);
    else pageTemplateRefs.delete(pageId);
    if (pageId === activePageId.value) emitActiveTemplate();
};
watch(activePageId, (pageId) => {
    editorStore.activateCanvasPage(pageId);
    emitActiveTemplate();
}, { flush: 'post', immediate: true });
const isActive = (pageId: string) => pageId === activePageId.value;
const activatePage = (pageId: string) => {
    editorStore.activateCanvasPage(pageId);
    documentStore.activatePage(pageId);
};
const openAppointments = () => {
    appointmentStore.appointmentDialogOpen = true;
    editorStore.activeEditorTool = 'appointments';
};
const exportPage = async (pageId: string, options: PublisherCanvasExportOptions) => {
    const template = pageTemplateRefs.get(pageId);
    if (!template) throw new Error('Die Seite ist noch nicht bereit.');
    return await template.exportImage(options);
};
defineExpose({ exportPage });
</script>

<template>
    <div v-if="detailsPending" class="publisher-workspace__empty" role="status">Termindetails werden geladen …</div>
    <div v-else-if="detailsError" class="publisher-workspace__empty publisher-workspace__empty--error" role="alert">Die Termindetails konnten nicht geladen werden.</div>
    <div v-else-if="!template" class="publisher-workspace__empty">
        <div class="publisher-workspace__empty-icon"><FontAwesomeIcon :icon="faCalendarDays" aria-hidden="true" /></div>
        <h1>Erste Seite anlegen</h1><p>Wähle einen Termin aus ChurchTools. Die Seite wird anschließend direkt auf der Arbeitsfläche angezeigt.</p><DesignButton @click="openAppointments">Termin auswählen</DesignButton>
    </div>
    <div v-else class="publisher-workspace__canvas">
        <p v-if="imageStatus === 'error'" class="status-message status-message--warning publisher-workspace__message" role="status">Das Veranstaltungsbild konnte nicht geladen werden. Die Fallback-Fläche wird verwendet.</p>
        <p v-if="exportError" class="status-message status-message--error publisher-workspace__message" role="alert">{{ exportError }}</p>
        <article v-for="(page, pageIndex) in pages" :key="page.id" class="publisher-artboard" :class="{ 'is-active': isActive(page.id) }" @dragenter="activatePage(page.id)" @mousedown.capture="activatePage(page.id)">
            <header><span>Seite {{ pageIndex + 1 }}</span><strong>{{ page.width }} × {{ page.height }} px</strong></header>
            <EventTemplate
                :ref="(instance) => setPageTemplateRef(page.id, instance)"
                :document-height="page.height"
                :document-width="page.width"
                :data-values="dataValues"
                :draft-id="`${draftId}:${page.id}`"
                :image-focus="page.imageFocus[page.templateId]"
                :page-id="page.id"
                :preview-zoom="previewZoom(previewZoomPercent)"
                :template="template"
                :template-id="page.templateId"
                :snap-enabled="snapEnabled"
                :show-template-decorations="pageShowsTemplateDecorations(page)"
                @image-status="isActive(page.id) && emit('imageStatusChange', $event)"
                @history-change="(canUndo, canRedo) => { if (isActive(page.id)) { canUndoLayout = canUndo; canRedoLayout = canRedo; } }"
                @available-elements-change="isActive(page.id) && (availableLayoutElements = $event)"
                @layer-position-change="(position, total) => { if (isActive(page.id)) { selectedLayerPosition = position; selectedLayerTotal = total; } }"
                @layout-change="isActive(page.id) && (layoutChanged = $event)"
                @layout-state-change="(templateId, state) => emit('layoutStateChange', page.id, templateId, state)"
                @selection-group-change="(canGroup, canUngroup, depth) => isActive(page.id) && editorStore.updateLayoutGrouping(canGroup, canUngroup, depth)"
                @selection-group-path-change="isActive(page.id) && (selectedLayoutGroupPath = [...$event])"
                @selection-default-change="isActive(page.id) && (selectedLayoutElementChanged = $event)"
                @selection-geometry-change="isActive(page.id) && (selectedLayoutGeometry = $event)"
                @selection-style-change="isActive(page.id) && (selectedLayoutStyle = $event)"
                @selection-text-content-change="isActive(page.id) && (selectedLayoutTextContent = $event)"
                @selection-text-mode-change="isActive(page.id) && (selectedLayoutTextMode = $event)"
                @selection-visual-style-change="isActive(page.id) && (selectedLayoutVisualStyle = $event)"
            />
        </article>
    </div>
</template>
