<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { nextTick, onBeforeUnmount, watch } from 'vue';

import type { EventTemplateProps } from '../../domain/EventTemplateProps';
import type { PublisherDataValues } from '../../domain/appointmentDataFields';
import type { SerializableLayoutState } from '../../domain/layoutHistory';
import type { PublisherCanvasExportOptions } from '../../domain/publisherExport';
import { pageShowsTemplateDecorations } from '../../domain/publisherPage';
import type { TemplateId } from '../../domain/templates';
import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import EventTemplate from '../EventTemplate.vue';

const props = defineProps<{
    detailsError: boolean;
    detailsPending: boolean;
    dataValues: PublisherDataValues;
    draftId: string;
    exportError: string;
    imageStatus: 'idle' | 'loading' | 'loaded' | 'error';
    template: EventTemplateProps;
}>();

const emit = defineEmits<{
    activeTemplateChange: [instance: InstanceType<typeof EventTemplate> | null];
    imageStatusChange: [status: 'idle' | 'loading' | 'loaded' | 'error'];
    layoutStateChange: [pageId: string, templateId: TemplateId, state: SerializableLayoutState];
}>();

const documentStore = usePublisherDocumentStore();
const editorStore = usePublisherEditorStore();
const { activePageId, pages } = storeToRefs(documentStore);
const {
    availableLayoutElements, layoutChanged, previewZoomPercent,
    selectedLayerPosition, selectedLayerTotal,
    selectedLayoutGeometry, selectedLayoutGroupPath, selectedLayoutStyle,
    selectedLayoutTextContent, selectedLayoutTextMode, selectedLayoutVisualStyle, snapEnabled,
} = storeToRefs(editorStore);
const previewZoom = (value: number) => (value / 100) * 0.32;

const pageTemplateRefs = new Map<string, InstanceType<typeof EventTemplate>>();
const thumbnailTimers = new Map<string, ReturnType<typeof setTimeout>>();
const thumbnailRendering = new Set<string>();
const thumbnailPending = new Set<string>();
const renderPageThumbnail = async (pageId: string) => {
    const templateInstance = pageTemplateRefs.get(pageId);
    if (!templateInstance) return;
    if (thumbnailRendering.has(pageId)) {
        thumbnailPending.add(pageId);
        return;
    }
    thumbnailRendering.add(pageId);
    try {
        const source = await templateInstance.renderThumbnail();
        if (source) editorStore.setPageThumbnail(pageId, source);
    } catch {
        // The full-size canvas remains usable when a browser cannot rasterize a preview.
    } finally {
        thumbnailRendering.delete(pageId);
        if (thumbnailPending.delete(pageId)) schedulePageThumbnail(pageId, 0);
    }
};
const schedulePageThumbnail = (pageId: string, delay = 120) => {
    const existing = thumbnailTimers.get(pageId);
    if (existing) clearTimeout(existing);
    thumbnailTimers.set(pageId, setTimeout(() => {
        thumbnailTimers.delete(pageId);
        void renderPageThumbnail(pageId);
    }, delay));
};
const scheduleAllPageThumbnails = () => {
    for (const { id } of pages.value) schedulePageThumbnail(id);
};
const emitActiveTemplate = () => emit('activeTemplateChange', pageTemplateRefs.get(activePageId.value) ?? null);
const setPageTemplateRef = (pageId: string, instance: unknown) => {
    const templateInstance = instance as InstanceType<typeof EventTemplate> | null;
    if (templateInstance) {
        pageTemplateRefs.set(pageId, templateInstance);
        void nextTick(() => schedulePageThumbnail(pageId, 40));
    } else {
        pageTemplateRefs.delete(pageId);
    }
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
const exportPage = async (pageId: string, options: PublisherCanvasExportOptions) => {
    const template = pageTemplateRefs.get(pageId);
    if (!template) throw new Error('Die Seite ist noch nicht bereit.');
    return await template.exportImage(options);
};
const handleLayoutStateChange = (pageId: string, templateId: TemplateId, state: SerializableLayoutState) => {
    emit('layoutStateChange', pageId, templateId, state);
    schedulePageThumbnail(pageId);
};
const handleImageStatus = (pageId: string, status: 'idle' | 'loading' | 'loaded' | 'error') => {
    if (isActive(pageId)) emit('imageStatusChange', status);
    if (status === 'loaded' || status === 'error') schedulePageThumbnail(pageId, 40);
};
watch(
    () => [props.dataValues, props.template],
    () => void nextTick(scheduleAllPageThumbnails),
    { deep: true, flush: 'post' },
);
watch(
    () => pages.value.map(({ id }) => id),
    (pageIds) => editorStore.retainPageThumbnails(pageIds),
    { immediate: true },
);
onBeforeUnmount(() => {
    for (const timer of thumbnailTimers.values()) clearTimeout(timer);
});
defineExpose({ exportPage });
</script>

<template>
    <div class="publisher-workspace__canvas">
        <p v-if="detailsPending" class="status-message publisher-workspace__message" role="status">Termindetails werden geladen … Das Layout bleibt bearbeitbar.</p>
        <p v-if="detailsError" class="status-message status-message--warning publisher-workspace__message" role="alert">Die Termindetails konnten nicht geladen werden. Das Layout bleibt unverändert.</p>
        <p v-if="imageStatus === 'error'" class="status-message status-message--warning publisher-workspace__message" role="status">Das Veranstaltungsbild konnte nicht geladen werden. Die Fallback-Fläche wird verwendet.</p>
        <p v-if="exportError" class="status-message status-message--error publisher-workspace__message" role="alert">{{ exportError }}</p>
        <article v-for="page in pages" :key="page.id" class="publisher-artboard" :class="{ 'is-active': isActive(page.id) }" :data-page-id="page.id" @dragenter="activatePage(page.id)" @mousedown.capture="activatePage(page.id)">
            <header><span>{{ page.name }}</span><strong>{{ page.width }} × {{ page.height }} px</strong></header>
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
                @image-status="handleImageStatus(page.id, $event)"
                @available-elements-change="isActive(page.id) && (availableLayoutElements = $event)"
                @layer-position-change="(position, total) => { if (isActive(page.id)) { selectedLayerPosition = position; selectedLayerTotal = total; } }"
                @layout-change="isActive(page.id) && (layoutChanged = $event)"
                @layout-state-change="(templateId, state) => handleLayoutStateChange(page.id, templateId, state)"
                @render-content-change="schedulePageThumbnail(page.id, 40)"
                @selection-group-change="(canGroup, canUngroup, depth) => isActive(page.id) && editorStore.updateLayoutGrouping(canGroup, canUngroup, depth)"
                @selection-group-path-change="isActive(page.id) && (selectedLayoutGroupPath = [...$event])"
                @selection-geometry-change="isActive(page.id) && (selectedLayoutGeometry = $event)"
                @selection-style-change="isActive(page.id) && (selectedLayoutStyle = $event)"
                @selection-text-content-change="isActive(page.id) && (selectedLayoutTextContent = $event)"
                @selection-text-mode-change="isActive(page.id) && (selectedLayoutTextMode = $event)"
                @selection-visual-style-change="isActive(page.id) && (selectedLayoutVisualStyle = $event)"
            />
        </article>
    </div>
</template>
