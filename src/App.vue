<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import type EventTemplate from './components/EventTemplate.vue';
import PublisherAppointmentPanel from './components/PublisherAppointmentPanel.vue';
import PublisherEditorShell from './components/PublisherEditorShell.vue';
import DesignConfirmDialog from './components/design/DesignConfirmDialog.vue';
import PublisherContextBar from './components/publisher/PublisherContextBar.vue';
import PublisherExportDialog from './components/publisher/PublisherExportDialog.vue';
import PublisherPageDialog from './components/publisher/PublisherPageDialog.vue';
import PublisherPagesPanel from './components/publisher/PublisherPagesPanel.vue';
import PublisherInspectorShell from './components/publisher/PublisherInspectorShell.vue';
import PublisherToolRail from './components/publisher/PublisherToolRail.vue';
import PublisherTopbar from './components/publisher/PublisherTopbar.vue';
import PublisherTemplatesDialog from './components/publisher/PublisherTemplatesDialog.vue';
import PublisherWorkspaceContent from './components/publisher/PublisherWorkspaceContent.vue';
import PublisherZoomControls from './components/publisher/PublisherZoomControls.vue';
import AppointmentInspector from './components/publisher/inspectors/AppointmentInspector.vue';
import AppointmentDataInspector from './components/publisher/inspectors/AppointmentDataInspector.vue';
import LayoutInspector from './components/publisher/inspectors/LayoutInspector.vue';
import { useLayoutSelection } from './composables/useLayoutSelection';
import { useAppointmentRelatedData } from './composables/useAppointmentRelatedData';
import { usePublisherAppointments } from './composables/usePublisherAppointments';
import { usePublisherWorkspaceZoom } from './composables/usePublisherWorkspaceZoom';
import { resolveEditorShortcut } from './domain/editorShortcuts';
import {
    PUBLISHER_APPOINTMENT_FIELD_IDS,
    createAppointmentDataFields,
    publisherDataValue,
    type PublisherDataField,
} from './domain/appointmentDataFields';
import type { PublisherImagePaletteSource } from './domain/imagePalette';
import type { ImageFocus } from './domain/imageFocus';
import type { LayoutCustomElementKind, LayoutTextMode } from './domain/layoutEditing';
import type { PublisherIconName } from './domain/publisherIcons';
import { cloneLayoutState, type SerializableLayoutState } from './domain/layoutHistory';
import {
    PUBLISHER_DRAFT_VERSION,
    type PublisherDraft,
} from './domain/publisherDraft';
import {
    MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH,
    type PublisherDesignTemplate,
} from './domain/publisherDesignTemplate';
import {
    appointmentKeyFromReference,
    appointmentReferenceFromKey,
    createMemoryPublisherRepository,
    createPublisherRecordId,
    PUBLISHER_RECORD_VERSION,
    type PublisherDocumentRecord,
} from './domain/publisherRepository';
import { loadPublisherRecovery, savePublisherRecovery } from './domain/publisherRecovery';
import {
    publisherStorageFailure,
    publisherStorageSupportsAutosave,
    type PublisherStorageStatus,
} from './domain/publisherStorageState';
import { clonePublisherPage, createBlankPublisherPage, createPublisherPage } from './domain/publisherPage';
import {
    createPublisherExportSettings,
    publisherExportExtension,
    updatePublisherExportSettings,
    type PublisherPageExportSettings,
} from './domain/publisherExport';
import {
    applyTemplateOverrides,
    type EditableTemplateField,
    type EventTemplateOverrides,
    withTemplateOverride,
} from './domain/templateOverrides';
import type { TemplateId } from './domain/templates';
import { createCcmPublisherRepository } from './infrastructure/ccmPublisherRepository';
import { usePublisherDocumentStore } from './stores/publisherDocument';
import { usePublisherEditorStore, type EditorToolId } from './stores/publisherEditor';
import { usePublisherAppointmentsStore } from './stores/publisherAppointments';
import { usePublisherImagePalettesStore } from './stores/publisherImagePalettes';

const userLanguage = window.settings?.language ?? navigator.language;
const userTimeZone = window.settings?.timezone;
const documentStore = usePublisherDocumentStore();
const editorStore = usePublisherEditorStore();
const appointmentStore = usePublisherAppointmentsStore();
const imagePaletteStore = usePublisherImagePalettesStore();
const publisherRepository = import.meta.env.VITE_E2E === 'true'
    ? createMemoryPublisherRepository()
    : createCcmPublisherRepository(churchtoolsClient, import.meta.env.VITE_KEY);
const recoveredDocument = loadPublisherRecovery(window.localStorage);
const {
    activePage, activePageId, canRedoDocument, canUndoDocument, draftLayouts,
    imageFocusByTemplate, pages, selectedTemplateId,
} = storeToRefs(documentStore);
const {
    activeEditorTool, hasLayoutSelection,
    panToolEnabled, previewZoomPercent, selectedLayoutElements, selectedLayoutGeometry, snapEnabled,
} = storeToRefs(editorStore);
const templateRef = shallowRef<InstanceType<typeof EventTemplate> | null>(null);
const workspaceContentRef = shallowRef<InstanceType<typeof PublisherWorkspaceContent> | null>(null);
const imageStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');
const exportError = ref('');
const toast = ref<{ message: string; tone: 'info' | 'success' } | null>(null);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
const showToast = (message: string, tone: 'info' | 'success' = 'info') => {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.value = { message, tone };
    toastTimeout = setTimeout(() => {
        toast.value = null;
        toastTimeout = null;
    }, 3500);
};
const templateOverrides = ref<EventTemplateOverrides>(recoveredDocument?.draft.templateOverrides ?? {});
const {
    fitWorkspacePage,
    fitWorkspaceSelection,
    handleWorkspacePointerDown,
    handleWorkspacePointerMove,
    handleWorkspaceWheel,
    isPanning,
    panReady,
    setWorkspaceElement,
    showActualSize,
    stopWorkspacePan,
} = usePublisherWorkspaceZoom();
const activePageSize = () => ({ width: activePage.value.width, height: activePage.value.height });
const fitActivePage = () => fitWorkspacePage(activePage.value.id, activePageSize());
const fitActiveSelection = () => {
    if (!selectedLayoutGeometry.value) return;
    return fitWorkspaceSelection(activePage.value.id, selectedLayoutGeometry.value, activePageSize());
};
const showWorkspaceActualSize = () => showActualSize(
    activePage.value.id,
    activePageSize(),
    selectedLayoutGeometry.value,
);
const draftRevision = ref(0);
const draftStatus = ref('');
const draftError = ref('');
const restoringDraft = ref(false);
const documents = ref<PublisherDocumentRecord[]>([]);
const designTemplates = ref<PublisherDesignTemplate[]>([]);
const activeDocumentId = ref(recoveredDocument?.id ?? createPublisherRecordId());
const activeDocumentRevision = ref(recoveredDocument?.revision ?? 0);
const activeDocumentCreatedAt = ref(recoveredDocument?.createdAt ?? new Date().toISOString());
const documentName = ref(recoveredDocument?.name ?? 'Unbenanntes Dokument');
const storageStatus = ref<PublisherStorageStatus>('loading');
const storageMessage = ref('ChurchTools-Speicher wird geladen …');
let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let saveQueued = false;
const appointmentDocumentKeys = computed(() => new Set(
    documents.value.map(({ appointment }) => appointmentKeyFromReference(appointment)).filter(Boolean),
));
const {
    appointmentCalendarOptions,
    appointmentDetails,
    appointmentDetailsArePending,
    appointmentDetailsError,
    appointmentDialogOpen,
    appointmentPanelOptions,
    isLoading,
    loadingError,
    mappedTemplateProps,
    selectedAppointment,
    selectedAppointmentId,
    selectedAppointmentKey,
    totalAppointmentCount,
} = usePublisherAppointments(appointmentDocumentKeys, userLanguage, userTimeZone);
const {
    loadRelatedDataSource,
    relatedDataFields,
    relatedDataSources,
} = useAppointmentRelatedData(
    () => appointmentDetails.value ?? undefined,
    () => selectedAppointmentKey.value,
    userLanguage,
    userTimeZone,
);
const pageDialogOpen = ref(false);
const newPagePreset = ref('1920x1080');
const newPageWidth = ref(1920);
const newPageHeight = ref(1080);
const pageCreationError = ref('');
const templateDialogOpen = ref(false);
const exportDialogOpen = ref(false);
const exportBusy = ref(false);
const exportProgress = ref('');
const exportSettings = ref<PublisherPageExportSettings[]>([]);
const selectedDesignTemplateId = ref('');
const designTemplateName = ref('');
const designTemplateStatus = ref('');
const designTemplateError = ref('');
const pendingDeletion = ref<
    { kind: 'template'; item: PublisherDesignTemplate } |
    { kind: 'document'; item: PublisherDocumentRecord } |
    null
>(null);
const layoutStep = computed(() => (snapEnabled.value ? 20 : 5));
interface EditorTool {
    id: EditorToolId;
    targetId: string;
    label: string;
}
const editorTools = [
    { id: 'appointments', targetId: 'appointments-editor', label: 'Termine' },
    { id: 'data', targetId: 'data-editor', label: 'Termindaten' },
    { id: 'layout', targetId: 'layout-editor', label: 'Layout' },
] as const satisfies readonly EditorTool[];
const {
    alignLayoutElement,
    changeSelectedLayer,
    clearLayoutSelection,
    deleteLayoutElements,
    nudgeLayoutElement,
    restoreSelectedFontSizeInput,
    restoreSelectedLayoutGeometryInput,
    selectLayoutElement,
    selectLayoutGroup,
    updateSelectedLayoutGeometry,
    updateSelectedTextContent,
    updateSelectedTextStyle,
    updateSelectedVisualStyle,
} = useLayoutSelection(templateRef, () => { activeEditorTool.value = 'layout'; });
const pageSizePresets = [
    { id: '1920x1080', label: 'Full HD · 1920 × 1080', width: 1920, height: 1080 },
    { id: '1080x1080', label: 'Quadrat · 1080 × 1080', width: 1080, height: 1080 },
    { id: '600x600', label: 'Quadrat kompakt · 600 × 600', width: 600, height: 600 },
    { id: '1920x300', label: 'Banner · 1920 × 300', width: 1920, height: 300 },
] as const;

const updateNewPagePreset = () => {
    const preset = pageSizePresets.find(({ id }) => id === newPagePreset.value);
    if (preset) {
        newPageWidth.value = preset.width;
        newPageHeight.value = preset.height;
    }
};

const addPage = () => {
    const width = Math.round(newPageWidth.value);
    const height = Math.round(newPageHeight.value);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64 || width > 8192 || height > 8192) {
        pageCreationError.value = 'Breite und Höhe müssen zwischen 64 und 8192 Pixeln liegen.';
        return;
    }
    documentStore.addPage(width, height, selectedTemplateId.value);
    pageDialogOpen.value = false;
    pageCreationError.value = '';
    draftRevision.value += 1;
    saveCurrentDraft();
};

const removePage = (pageId: string) => {
    if (!documentStore.removePage(pageId)) return;
    editorStore.activateCanvasPage(activePageId.value);
    saveCurrentDraft();
};

const duplicatePage = (pageId: string) => {
    const duplicate = documentStore.duplicatePage(pageId);
    if (!duplicate) return;
    const sourceThumbnail = editorStore.pageThumbnails[pageId];
    if (sourceThumbnail) editorStore.setPageThumbnail(duplicate.id, sourceThumbnail);
    editorStore.activateCanvasPage(duplicate.id);
    saveCurrentDraft();
};

const renamePage = (pageId: string, name: string) => {
    if (documentStore.renamePage(pageId, name)) saveCurrentDraft();
};

const reorderPage = (pageId: string, targetPageId: string, placement: 'before' | 'after') => {
    if (documentStore.movePage(pageId, targetPageId, placement)) saveCurrentDraft();
};

const templateProps = computed(() => {
    return applyTemplateOverrides(mappedTemplateProps.value ?? {
        title: '', date: '', time: '', location: '', imageUrl: null,
    }, templateOverrides.value);
});
const originalAppointmentDataFields = computed(() => [
    ...(appointmentDetails.value
        ? createAppointmentDataFields(appointmentDetails.value, { locale: userLanguage, timeZone: userTimeZone })
        : []),
    ...relatedDataFields.value,
]);
const originalAppointmentDataValues = computed(() => Object.fromEntries(
    originalAppointmentDataFields.value.map(({ id, value }) => [id, value]),
));
const appointmentDataFields = computed(() => originalAppointmentDataFields.value.map((field) => ({
    ...field,
    value: templateOverrides.value[field.id] ?? field.value,
})));
const appointmentDataValues = computed(() => Object.fromEntries(
    [
        ...PUBLISHER_APPOINTMENT_FIELD_IDS.map((id) => [id, ''] as const),
        ...appointmentDataFields.value.map((field) => [field.id, {
            value: field.value,
            formatType: field.formatType,
            rawValue: field.rawValue,
            locale: field.locale,
            timeZone: field.timeZone,
            values: field.values ? [...field.values] : undefined,
        }] as const),
    ],
));
watch(appointmentDataFields, (fields) => { appointmentStore.dataFields = fields; }, { immediate: true });
watch(relatedDataSources, (sources) => { appointmentStore.relatedDataSources = sources; }, { immediate: true });
const imagePaletteSources = computed<PublisherImagePaletteSource[]>(() => {
    const sources: PublisherImagePaletteSource[] = [];
    for (const page of pages.value) {
        const layout = page.layouts[page.templateId];
        if (!layout) continue;
        const visibleElementIds = new Set(layout.order.filter((elementId) => !layout.deleted.includes(elementId)));
        if (visibleElementIds.has('image') && templateProps.value.imageUrl &&
            !sources.some(({ id }) => id === 'data:image')) {
            sources.push({ id: 'data:image', label: 'Terminbild', source: templateProps.value.imageUrl });
        }
        for (const element of layout.customElements ?? []) {
            if (element.kind !== 'image' || !visibleElementIds.has(element.id)) continue;
            const source = element.dataBinding
                ? publisherDataValue(appointmentDataValues.value, element.dataBinding)
                : element.imageSource ?? '';
            if (!source) continue;
            const id = element.dataBinding ? `data:${element.dataBinding}` : element.id;
            if (!sources.some((candidate) => candidate.id === id)) {
                sources.push({ id, label: element.name, source });
            }
        }
    }
    return sources;
});
const dynamicPaletteImageIds = computed(() => {
    const ids = new Set<string>();
    for (const page of pages.value) {
        for (const layout of Object.values(page.layouts)) {
            if (!layout) continue;
            Object.values(layout.styles).forEach((style) => {
                if (style.colorBinding) ids.add(style.colorBinding.imageId);
                style.colorGradient?.stops.forEach((stop) => stop.colorBinding && ids.add(stop.colorBinding.imageId));
            });
            Object.values(layout.visualStyles).forEach((style) => {
                if (style.fillBinding) ids.add(style.fillBinding.imageId);
                if (style.strokeBinding) ids.add(style.strokeBinding.imageId);
                style.fillGradient?.stops.forEach((stop) => stop.colorBinding && ids.add(stop.colorBinding.imageId));
            });
        }
    }
    return [...ids];
});
watch([imagePaletteSources, dynamicPaletteImageIds], ([sources, boundImageIds]) => {
    imagePaletteStore.syncSources(sources);
    for (const imageId of boundImageIds) {
        if (imagePaletteStore.statuses[imageId] === 'idle') void imagePaletteStore.analyze(imageId);
    }
}, { immediate: true, deep: true });
const activateEditorTool = async (tool: EditorTool) => {
    if (tool.id === 'appointments') {
        activeEditorTool.value = tool.id;
        appointmentDialogOpen.value = true;
        return;
    }
    activeEditorTool.value = tool.id;
    await nextTick();
    const inspector = document.getElementById(tool.targetId);
    if (inspector) inspector.scrollTop = 0;
};

const activateEditorToolById = (toolId: EditorToolId) => {
    const tool = editorTools.find(({ id }) => id === toolId);
    if (tool) void activateEditorTool(tool);
};

const addLayoutElement = (kind: Exclude<LayoutCustomElementKind, 'image' | 'text'>) => {
    templateRef.value?.commands.addElement(kind);
    activeEditorTool.value = 'layout';
};

const addLayoutText = (textMode: LayoutTextMode) => {
    templateRef.value?.commands.addElement('text', { textMode });
    activeEditorTool.value = 'layout';
};

const addLayoutIcon = (iconName: PublisherIconName) => {
    templateRef.value?.commands.addElement('icon', { iconName, name: 'Icon' });
    activeEditorTool.value = 'layout';
};

const addLayoutQr = () => {
    templateRef.value?.commands.addElement('qr', { qrValue: 'https://church.tools', name: 'QR-Code' });
    activeEditorTool.value = 'layout';
};

const showImageUploadPlaceholder = () => {
    showToast('Eigene Bilder können bald über ChurchTools hochgeladen werden.');
};

const closeAppointmentDialog = () => {
    appointmentDialogOpen.value = false;
    if (activeEditorTool.value === 'appointments') {
        activeEditorTool.value = 'layout';
    }
};

const currentPublisherDraft = (): PublisherDraft => ({
    version: PUBLISHER_DRAFT_VERSION,
    selectedTemplateId: selectedTemplateId.value,
    templateOverrides: { ...templateOverrides.value },
    layouts: Object.fromEntries(
        Object.entries(draftLayouts.value).map(([templateId, state]) => [
            templateId,
            state ? cloneLayoutState(state) : state,
        ]),
    ),
    imageFocus: {
        split: { ...imageFocusByTemplate.value.split },
        poster: { ...imageFocusByTemplate.value.poster },
    },
    snapEnabled: snapEnabled.value,
    previewZoomPercent: previewZoomPercent.value,
    updatedAt: new Date().toISOString(),
    pages: pages.value.map((page) => ({
        id: page.id,
        name: page.name,
        width: page.width,
        height: page.height,
        templateId: page.templateId,
        layouts: Object.fromEntries(
            Object.entries(page.layouts).map(([templateId, state]) => [
                templateId,
                state ? cloneLayoutState(state) : state,
            ]),
        ),
        imageFocus: {
            split: { ...page.imageFocus.split },
            poster: { ...page.imageFocus.poster },
        },
    })),
    activePageId: activePageId.value,
});

const currentPublisherDocument = (): PublisherDocumentRecord => {
    const now = new Date().toISOString();
    return {
        version: PUBLISHER_RECORD_VERSION,
        id: activeDocumentId.value,
        name: documentName.value.trim() || 'Unbenanntes Dokument',
        revision: activeDocumentRevision.value,
        appointment: appointmentReferenceFromKey(selectedAppointmentKey.value),
        draft: currentPublisherDraft(),
        createdAt: activeDocumentCreatedAt.value,
        updatedAt: now,
    };
};

const updateDocumentList = (document: PublisherDocumentRecord) => {
    documents.value = [document, ...documents.value.filter(({ id }) => id !== document.id)]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

const setStorageFailure = (error: unknown, fallback: string) => {
    const failure = publisherStorageFailure(error, fallback);
    if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = null;
    }
    storageStatus.value = failure.status;
    storageMessage.value = failure.message;
    draftError.value = failure.showAsError ? failure.message : '';
    if (!failure.showAsError) draftStatus.value = 'Änderungen sind lokal zur Wiederherstellung gesichert.';
};

const persistCurrentDocument = async (): Promise<boolean> => {
    if (restoringDraft.value) return false;
    if (saveInFlight) {
        saveQueued = true;
        return false;
    }
    saveInFlight = true;
    storageStatus.value = 'saving';
    storageMessage.value = 'Dokument wird in ChurchTools gespeichert …';
    try {
        const saved = await publisherRepository.saveDocument(currentPublisherDocument());
        activeDocumentRevision.value = saved.revision;
        activeDocumentCreatedAt.value = saved.createdAt;
        updateDocumentList(saved);
        savePublisherRecovery(window.localStorage, saved);
        storageStatus.value = 'saved';
        storageMessage.value = 'In ChurchTools gespeichert.';
        draftStatus.value = storageMessage.value;
        draftError.value = '';
        return true;
    } catch (error) {
        setStorageFailure(error, 'Das Dokument konnte nicht gespeichert werden.');
        return false;
    } finally {
        saveInFlight = false;
        if (saveQueued) {
            saveQueued = false;
            if (publisherStorageSupportsAutosave(storageStatus.value)) void persistCurrentDocument();
        }
    }
};

const saveCurrentDraft = () => {
    if (restoringDraft.value) return;
    const recovery = currentPublisherDocument();
    let recoverySaved = true;
    try {
        savePublisherRecovery(window.localStorage, recovery);
    } catch {
        recoverySaved = false;
    }
    if (!publisherStorageSupportsAutosave(storageStatus.value)) {
        if (!recoverySaved) {
            storageStatus.value = 'error';
            storageMessage.value = 'Weder ChurchTools noch die lokale Wiederherstellungskopie stehen zum Speichern zur Verfügung.';
            draftError.value = storageMessage.value;
            return;
        }
        draftStatus.value = 'Änderungen sind lokal zur Wiederherstellung gesichert.';
        return;
    }
    storageStatus.value = 'dirty';
    storageMessage.value = 'Ungespeicherte Änderungen.';
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
        autosaveTimeout = null;
        if (publisherStorageSupportsAutosave(storageStatus.value)) void persistCurrentDocument();
    }, 800);
};

watch(selectedAppointmentKey, () => {
    if (restoringDraft.value) return;
    restoringDraft.value = true;
    exportError.value = '';
    toast.value = null;
    imageStatus.value = 'idle';
    templateOverrides.value = {};
    if (documentName.value === 'Unbenanntes Dokument' && selectedAppointment.value?.appointment.base.title) {
        documentName.value = selectedAppointment.value.appointment.base.title;
    }
    draftStatus.value = selectedAppointmentKey.value
        ? 'Termindaten aktualisiert. Das aktuelle Layout wurde beibehalten.'
        : 'Terminbezug entfernt. Das aktuelle Layout wurde beibehalten.';
    draftError.value = '';
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
});

watch(selectedTemplateId, () => {
    exportError.value = '';
    toast.value = null;
    saveCurrentDraft();
});

watch(snapEnabled, saveCurrentDraft);
watch(previewZoomPercent, saveCurrentDraft);

const updateTemplateOverride = (field: EditableTemplateField, value: string) => {
    templateOverrides.value = withTemplateOverride(
        originalAppointmentDataValues.value,
        templateOverrides.value,
        field,
        value,
    );
    exportError.value = '';
    toast.value = null;
    saveCurrentDraft();
};

const insertAppointmentDataField = (field: PublisherDataField) => {
    if (field.type === 'image') {
        if (!field.value) return;
        templateRef.value?.commands.addElement('image', {
            imageSource: field.value,
            name: field.label,
            dataBinding: field.id,
        });
    } else {
        templateRef.value?.commands.addElement('text', {
            text: field.placeholder,
            textMode: 'frame',
            name: field.label,
            dataBinding: field.id,
        });
    }
    activeEditorTool.value = 'layout';
};

const insertAppointmentQrField = (field: PublisherDataField) => {
    if (field.formatType !== 'url' || !field.value) return;
    templateRef.value?.commands.addElement('qr', {
        qrValue: field.placeholder,
        name: `${field.label} · QR-Code`,
        dataBinding: field.id,
    });
    activeEditorTool.value = 'layout';
};

const resetTemplateOverride = (field: EditableTemplateField) => {
    const nextOverrides = { ...templateOverrides.value };
    delete nextOverrides[field];
    templateOverrides.value = nextOverrides;
    saveCurrentDraft();
};

const applyPublisherDraft = (draft: PublisherDraft) => {
    templateOverrides.value = { ...draft.templateOverrides };
    if (draft.pages?.length && draft.activePageId) {
        const restoredPages = draft.pages.map((page, pageIndex) => ({
            ...page,
            name: page.name?.trim() || `Seite ${pageIndex + 1}`,
            layouts: Object.fromEntries(Object.entries(page.layouts).map(([templateId, state]) => [
                templateId,
                state ? cloneLayoutState(state) : state,
            ])),
            imageFocus: {
                split: { ...page.imageFocus.split },
                poster: { ...page.imageFocus.poster },
            },
        }));
        documentStore.replacePages(restoredPages, draft.activePageId);
        editorStore.activateCanvasPage(draft.activePageId);
    } else {
        const restoredPage = createPublisherPage();
        restoredPage.templateId = draft.selectedTemplateId;
        restoredPage.layouts = Object.fromEntries(
            Object.entries(draft.layouts).map(([templateId, state]) => [
                templateId,
                state ? cloneLayoutState(state) : state,
            ]),
        );
        restoredPage.imageFocus = {
            split: { ...draft.imageFocus.split },
            poster: { ...draft.imageFocus.poster },
        };
        documentStore.replacePages([restoredPage], restoredPage.id);
        editorStore.activateCanvasPage(restoredPage.id);
    }
    snapEnabled.value = draft.snapEnabled;
    previewZoomPercent.value = draft.previewZoomPercent;
    draftRevision.value += 1;
};

const openStoredDocument = async (document: PublisherDocumentRecord) => {
    if (document.id !== activeDocumentId.value && storageStatus.value === 'dirty' &&
        !await persistCurrentDocument()) return;
    if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = null;
    }
    restoringDraft.value = true;
    activeDocumentId.value = document.id;
    activeDocumentRevision.value = document.revision;
    activeDocumentCreatedAt.value = document.createdAt;
    documentName.value = document.name;
    selectedAppointmentKey.value = appointmentKeyFromReference(document.appointment);
    applyPublisherDraft(document.draft);
    savePublisherRecovery(window.localStorage, document);
    storageStatus.value = 'saved';
    storageMessage.value = 'Dokument aus ChurchTools geöffnet.';
    draftStatus.value = storageMessage.value;
    draftError.value = '';
    void nextTick(() => {
        restoringDraft.value = false;
    });
};

const createNewDocument = async (skipSave = false) => {
    if (!skipSave && storageStatus.value === 'dirty' && !await persistCurrentDocument()) return;
    restoringDraft.value = true;
    const page = createBlankPublisherPage();
    documentStore.replacePages([page], page.id);
    editorStore.activateCanvasPage(page.id);
    templateOverrides.value = {};
    selectedAppointmentKey.value = '';
    activeDocumentId.value = createPublisherRecordId();
    activeDocumentRevision.value = 0;
    activeDocumentCreatedAt.value = new Date().toISOString();
    documentName.value = 'Unbenanntes Dokument';
    snapEnabled.value = true;
    previewZoomPercent.value = 100;
    draftRevision.value += 1;
    storageStatus.value = 'dirty';
    storageMessage.value = 'Neues, noch nicht gespeichertes Dokument.';
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
};

const updatePageDraftLayout = (pageId: string, templateId: TemplateId, state: SerializableLayoutState) => {
    if (!documentStore.pageById(pageId)?.layouts[templateId] || !state) return;
    saveCurrentDraft();
};

const createDesignTemplateId = () =>
    typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `template-${Date.now().toString(36)}`;

const applyStandardTemplate = (templateId: TemplateId) => {
    restoringDraft.value = true;
    documentStore.replaceActivePageTemplate(templateId);
    selectedDesignTemplateId.value = '';
    draftRevision.value += 1;
    designTemplateStatus.value = 'Standardvorlage angewendet.';
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
};

const persistCurrentDesignAsTemplate = async (existing?: PublisherDesignTemplate) => {
    const name = (existing?.name ?? designTemplateName.value).trim();
    if (pages.value.length === 0) {
        designTemplateError.value = 'Das aktuelle Dokument enthält keine Seite.';
        return;
    }
    if (!name) {
        designTemplateError.value = 'Bitte gib der Vorlage einen Namen.';
        return;
    }

    const now = new Date().toISOString();
    const designTemplate: PublisherDesignTemplate = {
        id: existing?.id ?? createDesignTemplateId(),
        name: name.slice(0, MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH),
        pages: pages.value.map((page) => clonePublisherPage(page)),
        activePageId: activePageId.value,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };

    try {
        const saved = await publisherRepository.saveTemplate(designTemplate);
        designTemplates.value = [saved, ...designTemplates.value.filter(({ id }) => id !== saved.id)]
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        selectedDesignTemplateId.value = saved.id;
        designTemplateName.value = '';
        designTemplateStatus.value = existing
            ? `Vorlage „${saved.name}“ in ChurchTools aktualisiert.`
            : `Vorlage „${saved.name}“ in ChurchTools gespeichert.`;
        designTemplateError.value = '';
    } catch (error) {
        console.error('Vorlage konnte nicht gespeichert werden.', error);
        setStorageFailure(error, 'Die Vorlage konnte nicht gespeichert werden.');
        designTemplateError.value = error instanceof Error
            ? error.message
            : 'Die Vorlage konnte nicht gespeichert werden.';
    }
};

const applyDesignTemplate = (designTemplate: PublisherDesignTemplate) => {
    restoringDraft.value = true;
    selectedDesignTemplateId.value = designTemplate.id;
    const activeTemplatePageIndex = designTemplate.pages.findIndex(({ id }) => id === designTemplate.activePageId);
    const instantiatedPages = designTemplate.pages.map((page) => clonePublisherPage(page, true));
    const nextActivePageId = instantiatedPages[Math.max(0, activeTemplatePageIndex)]!.id;
    documentStore.replacePagesWithHistory(instantiatedPages, nextActivePageId);
    editorStore.activateCanvasPage(nextActivePageId);
    draftRevision.value += 1;
    designTemplateStatus.value = `Vorlage „${designTemplate.name}“ angewendet.`;
    designTemplateError.value = '';
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
};

const removeDesignTemplate = async (designTemplate: PublisherDesignTemplate) => {
    try {
        await publisherRepository.deleteTemplate(designTemplate.id);
        designTemplates.value = designTemplates.value.filter(({ id }) => id !== designTemplate.id);
        if (selectedDesignTemplateId.value === designTemplate.id) {
            selectedDesignTemplateId.value = '';
        }
        designTemplateStatus.value = `Vorlage „${designTemplate.name}“ gelöscht.`;
        designTemplateError.value = '';
    } catch (error) {
        setStorageFailure(error, 'Die Vorlage konnte nicht gelöscht werden.');
        designTemplateError.value = storageMessage.value;
    }
};

const deleteStoredDocument = async (document: PublisherDocumentRecord) => {
    try {
        await publisherRepository.deleteDocument(document.id);
        documents.value = documents.value.filter(({ id }) => id !== document.id);
        draftStatus.value = `Dokument „${document.name}“ gelöscht.`;
        draftError.value = '';
        if (activeDocumentId.value === document.id) void createNewDocument(true);
    } catch (error) {
        setStorageFailure(error, 'Das Dokument konnte nicht gelöscht werden.');
    }
};

const requestDesignTemplateDeletion = (designTemplate: PublisherDesignTemplate) => {
    pendingDeletion.value = { kind: 'template', item: designTemplate };
};

const requestStoredDocumentDeletion = (document: PublisherDocumentRecord) => {
    pendingDeletion.value = { kind: 'document', item: document };
};

const confirmPendingDeletion = () => {
    const deletion = pendingDeletion.value;
    if (!deletion) return;
    pendingDeletion.value = null;
    if (deletion.kind === 'template') void removeDesignTemplate(deletion.item);
    else void deleteStoredDocument(deletion.item);
};

const isTextEntryTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'));

const navigateDocumentHistory = (direction: 'undo' | 'redo') => {
    restoringDraft.value = true;
    const changed = direction === 'undo'
        ? documentStore.undoDocument()
        : documentStore.redoDocument();
    if (!changed) {
        restoringDraft.value = false;
        return;
    }

    selectedDesignTemplateId.value = '';
    editorStore.activateCanvasPage(activePageId.value);
    editorStore.clearSelectionState();
    draftRevision.value += 1;
    exportError.value = '';
    toast.value = null;
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
};

const undoDocument = () => navigateDocumentHistory('undo');
const redoDocument = () => navigateDocumentHistory('redo');

const handleEditorShortcut = (event: KeyboardEvent) => {
    if (isTextEntryTarget(event.target)) {
        return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && hasLayoutSelection.value) {
        event.preventDefault();
        templateRef.value?.commands.deleteSelectedElements();
        return;
    }

    const shortcut = resolveEditorShortcut(event, hasLayoutSelection.value);
    if (!shortcut) {
        return;
    }
    if (shortcut.type === 'undo' && !canUndoDocument.value) {
        return;
    }
    if (shortcut.type === 'redo' && !canRedoDocument.value) {
        return;
    }

    event.preventDefault();
    switch (shortcut.type) {
        case 'move':
            nudgeLayoutElement(
                shortcut.deltaXFactor * layoutStep.value,
                shortcut.deltaYFactor * layoutStep.value,
            );
            break;
        case 'undo':
            undoDocument();
            break;
        case 'redo':
            redoDocument();
            break;
        case 'clearSelection':
            clearLayoutSelection();
            break;
        case 'group':
            templateRef.value?.commands.groupSelectedElements();
            break;
        case 'ungroup':
            templateRef.value?.commands.ungroupSelectedElements();
            break;
    }
};

const storageStatusLabel = computed(() => ({
    conflict: 'Speicherkonflikt',
    dirty: 'Ungespeichert',
    error: 'Speicherfehler',
    loading: 'Speicher wird geladen',
    local: 'Lokal gesichert',
    offline: 'Offline · lokal gesichert',
    permission: 'Keine Speicherberechtigung',
    saved: 'In ChurchTools gespeichert',
    saving: 'Speichert …',
})[storageStatus.value]);

const loadPublisherStorage = async () => {
    storageStatus.value = 'loading';
    storageMessage.value = 'Dokumente und Vorlagen werden aus ChurchTools geladen …';
    try {
        const [loadedDocuments, loadedTemplates] = await Promise.all([
            publisherRepository.listDocuments(),
            publisherRepository.listTemplates(),
        ]);
        documents.value = loadedDocuments;
        designTemplates.value = loadedTemplates;
        const remoteActive = loadedDocuments.find(({ id }) => id === activeDocumentId.value);
        if (recoveredDocument && remoteActive && remoteActive.revision > recoveredDocument.revision) {
            storageStatus.value = 'conflict';
            storageMessage.value = 'Für das wiederhergestellte Dokument liegt in ChurchTools eine neuere Version vor. Der lokale Stand bleibt zur Wiederherstellung erhalten.';
        } else if (recoveredDocument) {
            storageStatus.value = 'dirty';
            storageMessage.value = 'Wiederhergestellter Stand wird gespeichert …';
            saveCurrentDraft();
        } else {
            storageStatus.value = 'dirty';
            storageMessage.value = 'Neues, noch nicht gespeichertes Dokument.';
        }
        draftError.value = '';
    } catch (error) {
        setStorageFailure(error, 'Der ChurchTools-Speicher konnte nicht geladen werden.');
    }
};

const handleOnline = () => { void loadPublisherStorage(); };
const handleOffline = () => {
    storageStatus.value = 'offline';
    storageMessage.value = 'Offline. Änderungen sind lokal zur Wiederherstellung gesichert.';
};

const saveDocumentNow = () => {
    if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = null;
    }
    void persistCurrentDocument();
};

const updateDocumentName = (value: string) => {
    documentName.value = value;
    saveCurrentDraft();
};

onMounted(() => {
    window.addEventListener('keydown', handleEditorShortcut);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (recoveredDocument) openStoredDocument(recoveredDocument);
    void loadPublisherStorage();
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEditorShortcut);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    if (toastTimeout) clearTimeout(toastTimeout);
});

const updateImageFocus = (field: keyof ImageFocus, event: Event) => {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(value)) {
        return;
    }

    imageFocusByTemplate.value = {
        ...imageFocusByTemplate.value,
        [selectedTemplateId.value]: {
            ...imageFocusByTemplate.value[selectedTemplateId.value],
            [field]: value,
        },
    };
    exportError.value = '';
    toast.value = null;
    saveCurrentDraft();
};

const resetImageFocus = () => {
    imageFocusByTemplate.value = {
        ...imageFocusByTemplate.value,
        [selectedTemplateId.value]: { x: 50, y: 50, zoom: 100 },
    };
    exportError.value = '';
    toast.value = null;
    saveCurrentDraft();
};

const slugify = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

const openExportDialog = () => {
    exportSettings.value = createPublisherExportSettings(pages.value, exportSettings.value);
    exportError.value = '';
    toast.value = null;
    exportProgress.value = '';
    exportDialogOpen.value = true;
};

const updateExportPage = (pageId: string, change: Partial<Omit<PublisherPageExportSettings, 'pageId'>>) => {
    exportSettings.value = updatePublisherExportSettings(exportSettings.value, pageId, change);
};

const exportPages = async () => {
    const selectedSettings = exportSettings.value.filter(({ enabled }) => enabled);
    if (selectedSettings.length === 0 || exportBusy.value) return;
    exportError.value = '';
    toast.value = null;
    exportBusy.value = true;

    try {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const titleSlug = slugify(templateProps.value.title) || 'layout';
        for (const [exportIndex, settings] of selectedSettings.entries()) {
            const pageIndex = pages.value.findIndex(({ id }) => id === settings.pageId);
            const page = pages.value[pageIndex];
            if (!page) continue;
            exportProgress.value = `Seite ${exportIndex + 1} von ${selectedSettings.length} wird gerendert …`;
            const dataUrl = await workspaceContentRef.value?.exportPage(page.id, {
                format: settings.format,
                quality: settings.jpegQuality / 100,
            });
            if (!dataUrl) throw new Error(`Seite ${pageIndex + 1} ist noch nicht bereit.`);
            const imageBlob = await (await fetch(dataUrl)).blob();
            const exportedImage = await createImageBitmap(imageBlob);
            const exportedSize = { width: exportedImage.width, height: exportedImage.height };
            exportedImage.close();
            if (exportedSize.width !== page.width || exportedSize.height !== page.height) {
                throw new Error(`Seite ${pageIndex + 1} hat eine unerwartete Exportgröße: ${exportedSize.width} × ${exportedSize.height} Pixel.`);
            }
            const extension = publisherExportExtension(settings.format);
            zip.file(
                `${String(pageIndex + 1).padStart(2, '0')}-${slugify(page.name) || `seite-${pageIndex + 1}`}-${page.width}x${page.height}-${titleSlug}.${extension}`,
                imageBlob,
            );
        }
        exportProgress.value = 'ZIP-Datei wird erstellt …';
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const download = document.createElement('a');
        download.href = downloadUrl;
        download.download = `publisher-${selectedAppointmentId.value ?? 'frei'}-${titleSlug}.zip`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
        exportDialogOpen.value = false;
        showToast(`${selectedSettings.length} Seite${selectedSettings.length === 1 ? '' : 'n'} als ZIP exportiert.`, 'success');
    } catch (error) {
        exportError.value = error instanceof Error ? error.message : 'Der Export ist fehlgeschlagen.';
    } finally {
        exportBusy.value = false;
        exportProgress.value = '';
    }
};
</script>

<template>
    <PublisherEditorShell>
        <Transition name="publisher-toast">
            <div v-if="toast" class="publisher-toast" :class="`publisher-toast--${toast.tone}`" role="status">{{ toast.message }}</div>
        </Transition>
        <template #topbar>
            <PublisherTopbar
                :document-title="documentName"
                @activate="activateEditorToolById"
                @export="openExportDialog"
                @open-templates="templateDialogOpen = true"
                @redo="redoDocument"
                @undo="undoDocument"
            />
        </template>

        <template #contextbar>
            <PublisherContextBar
                :has-image="Boolean(templateProps.imageUrl)"
                @align="alignLayoutElement"
                @change-layer="changeSelectedLayer"
                @distribute="templateRef?.commands.distributeSelectedElements($event)"
                @group="templateRef?.commands.groupSelectedElements()"
                @reset-image-focus="resetImageFocus"
                @set-group-auto-layout="templateRef?.commands.setSelectedGroupAutoLayout($event)"
                @set-group-repeat="templateRef?.commands.setSelectedGroupRepeat($event)"
                @ungroup="templateRef?.commands.ungroupSelectedElements()"
                @update-qr-content="templateRef?.commands.setSelectedQrOptions('qrValue', $event)"
                @update-text-content="updateSelectedTextContent"
            />
        </template>

        <template #tools>
            <PublisherToolRail @add="addLayoutElement" @add-icon="addLayoutIcon" @add-image="showImageUploadPlaceholder" @add-qr="addLayoutQr" @add-text="addLayoutText" />
        </template>

        <template #left>
            <PublisherPagesPanel
                @add="pageDialogOpen = true"
                @duplicate="duplicatePage"
                @remove="removePage"
                @rename="renamePage"
                @reorder="reorderPage"
            />
        </template>

        <PublisherAppointmentPanel
            :appointments="appointmentPanelOptions"
            :calendars="appointmentCalendarOptions"
            :has-error="Boolean(loadingError)"
            :is-loading="isLoading"
            :total-count="totalAppointmentCount"
            @close="closeAppointmentDialog"
        />

        <PublisherPageDialog
            v-model:height="newPageHeight"
            v-model:preset="newPagePreset"
            v-model:width="newPageWidth"
            :error="pageCreationError"
            :open="pageDialogOpen"
            :presets="pageSizePresets"
            @close="pageDialogOpen = false"
            @submit="addPage"
            @update:preset="updateNewPagePreset"
        />

        <PublisherExportDialog
            :busy="exportBusy"
            :error="exportError"
            :open="exportDialogOpen"
            :pages="pages"
            :progress="exportProgress"
            :settings="exportSettings"
            @close="exportDialogOpen = false"
            @submit="exportPages"
            @update-page="updateExportPage"
        />

        <PublisherTemplatesDialog
            :active-document-id="activeDocumentId"
            v-model:name="designTemplateName"
            :design-templates="designTemplates"
            :document-name="documentName"
            :documents="documents"
            :draft-error="draftError"
            :draft-status="draftStatus"
            :error="designTemplateError"
            :open="templateDialogOpen"
            :selected-design-template-id="selectedDesignTemplateId"
            :selected-template-id="selectedTemplateId"
            :storage-message="storageMessage"
            :storage-status="storageStatus"
            :status="designTemplateStatus"
            @apply-design="applyDesignTemplate($event); templateDialogOpen = false"
            @apply-standard="applyStandardTemplate($event); templateDialogOpen = false"
            @close="templateDialogOpen = false"
            @delete-design="requestDesignTemplateDeletion"
            @delete-document="requestStoredDocumentDeletion"
            @new-document="createNewDocument"
            @open-document="openStoredDocument"
            @save-document="saveDocumentNow"
            @save-design="persistCurrentDesignAsTemplate"
            @update:document-name="updateDocumentName"
        />

        <DesignConfirmDialog
            :open="Boolean(pendingDeletion)"
            :title="pendingDeletion?.kind === 'template' ? 'Vorlage löschen?' : 'Dokument löschen?'"
            :description="pendingDeletion ? `„${pendingDeletion.item.name}“ wird dauerhaft aus ChurchTools gelöscht.` : ''"
            @close="pendingDeletion = null"
            @confirm="confirmPendingDeletion"
        />

        <section
            :ref="setWorkspaceElement"
            class="publisher-workspace"
            :class="{ 'is-pan-ready': panReady, 'is-panning': isPanning }"
            @wheel="handleWorkspaceWheel($event, true)"
            @pointerdown.capture="handleWorkspacePointerDown($event, true)"
            @pointermove="handleWorkspacePointerMove"
            @pointerup="stopWorkspacePan"
            @pointercancel="stopWorkspacePan"
            @lostpointercapture="stopWorkspacePan"
        >
            <PublisherWorkspaceContent
                ref="workspaceContentRef"
                :details-error="Boolean(appointmentDetailsError)"
                :details-pending="appointmentDetailsArePending"
                :data-values="appointmentDataValues"
                :draft-id="`document:${draftRevision}`"
                :export-error="exportError"
                :image-status="imageStatus"
                :template="templateProps"
                @active-template-change="templateRef = $event"
                @image-status-change="imageStatus = $event"
                @layout-state-change="updatePageDraftLayout"
            />
        </section>

        <template #right>
            <PublisherInspectorShell>
                <AppointmentDataInspector
                    v-if="activeEditorTool === 'data'"
                    error=""
                    :focus="imageFocusByTemplate[selectedTemplateId]"
                    :overridden-fields="Object.keys(templateOverrides) as EditableTemplateField[]"
                    replacement-name=""
                    :replacement-url="null"
                    @insert-field="insertAppointmentDataField"
                    @insert-qr-field="insertAppointmentQrField"
                    @load-related-source="loadRelatedDataSource"
                    @open-appointments="appointmentDialogOpen = true"
                    @reset-field="resetTemplateOverride"
                    @reset-image="resetTemplateOverride('image')"
                    @update-field="updateTemplateOverride"
                    @update-focus="updateImageFocus"
                    @update-image="showImageUploadPlaceholder"
                />
                <LayoutInspector
                    v-else-if="activeEditorTool === 'layout'"
                    :data-values="appointmentDataValues"
                    :template="templateProps"
                    @delete-elements="deleteLayoutElements"
                    @drill-into-element="templateRef?.commands.drillIntoElement($event)"
                    @move-layer="(source, target, placement) => templateRef?.commands.moveLayerNode(source, target, placement)"
                    @restore-font-size="restoreSelectedFontSizeInput"
                    @restore-geometry="restoreSelectedLayoutGeometryInput"
                    @select-element="selectLayoutElement"
                    @select-group="selectLayoutGroup"
                    @set-color-binding="(field, binding) => templateRef?.commands.setSelectedElementColorBinding(field, binding)"
                    @set-fill-color="templateRef?.commands.setSelectedElementStaticColor('fill', $event)"
                    @set-static-color="(field, color) => templateRef?.commands.setSelectedElementStaticColor(field, color)"
                    @set-text-color="templateRef?.commands.setSelectedElementStaticColor('color', $event)"
                    @toggle-lock="templateRef?.commands.toggleElementsLock($event)"
                    @toggle-visibility="templateRef?.commands.toggleElementsVisibility($event)"
                    @update-geometry="updateSelectedLayoutGeometry"
                    @update-effects="(elementIds, effects) => templateRef?.commands.setElementEffects(elementIds, effects)"
                    @update-filters="(elementIds, filters) => templateRef?.commands.setElementFilters(elementIds, filters)"
                    @update-gradient="(field, gradient) => templateRef?.commands.setSelectedElementGradient(field, gradient)"
                    @update-text-style="updateSelectedTextStyle"
                    @update-text-mode="templateRef?.commands.setSelectedCustomTextMode($event)"
                    @update-qr-option="(field, value) => templateRef?.commands.setSelectedQrOptions(field, value)"
                    @update-visual-style="updateSelectedVisualStyle"
                />
                <AppointmentInspector v-else @open="appointmentDialogOpen = true" />
            </PublisherInspectorShell>
        </template>

        <template #statusbar>
            <div class="publisher-statusbar">
                <span>{{ `${templateProps.title || 'Leere Seite'} · ${activePage.name} · ${activePage.width} × ${activePage.height} px` }}</span>
                <span v-if="hasLayoutSelection">{{ selectedLayoutElements.length }} Element{{ selectedLayoutElements.length === 1 ? '' : 'e' }} ausgewählt</span>
                <span class="publisher-statusbar__storage" :class="`is-${storageStatus}`" :title="storageMessage" role="status">{{ storageStatusLabel }}</span>
                <PublisherZoomControls
                    :can-fit-selection="Boolean(selectedLayoutGeometry)"
                    :pan-active="panReady"
                    :zoom="previewZoomPercent"
                    @fit-page="fitActivePage"
                    @fit-selection="fitActiveSelection"
                    @show-actual-size="showWorkspaceActualSize"
                    @toggle-pan="panToolEnabled = !panToolEnabled"
                    @update:zoom="previewZoomPercent = $event"
                />
            </div>
        </template>
    </PublisherEditorShell>
</template>
