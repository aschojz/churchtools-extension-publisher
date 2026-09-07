<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import type EventTemplate from './components/EventTemplate.vue';
import PublisherAppointmentPanel from './components/PublisherAppointmentPanel.vue';
import PublisherEditorShell from './components/PublisherEditorShell.vue';
import PublisherContextBar from './components/publisher/PublisherContextBar.vue';
import PublisherExportDialog from './components/publisher/PublisherExportDialog.vue';
import PublisherPageDialog from './components/publisher/PublisherPageDialog.vue';
import PublisherPagesPanel from './components/publisher/PublisherPagesPanel.vue';
import PublisherInspectorShell from './components/publisher/PublisherInspectorShell.vue';
import PublisherToolRail from './components/publisher/PublisherToolRail.vue';
import PublisherTopbar from './components/publisher/PublisherTopbar.vue';
import PublisherWorkspaceContent from './components/publisher/PublisherWorkspaceContent.vue';
import AppointmentInspector from './components/publisher/inspectors/AppointmentInspector.vue';
import AppointmentDataInspector from './components/publisher/inspectors/AppointmentDataInspector.vue';
import LayoutInspector from './components/publisher/inspectors/LayoutInspector.vue';
import TemplateInspector from './components/publisher/inspectors/TemplateInspector.vue';
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
import { createImageFocusByTemplate, type ImageFocus } from './domain/imageFocus';
import type { LayoutCustomElementKind, LayoutTextMode } from './domain/layoutEditing';
import type { PublisherIconName } from './domain/publisherIcons';
import { cloneLayoutState, type SerializableLayoutState } from './domain/layoutHistory';
import { validateLocalImage } from './domain/localImageOverride';
import {
    deletePublisherDraft,
    loadPublisherDraft,
    PUBLISHER_DRAFT_VERSION,
    savePublisherDraft,
    type PublisherDraft,
} from './domain/publisherDraft';
import {
    deletePublisherDesignTemplate,
    loadPublisherDesignTemplates,
    MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH,
    savePublisherDesignTemplate,
    type PublisherDesignTemplate,
} from './domain/publisherDesignTemplate';
import {
    belongsToAppointment,
    createPublisherDraftFile,
    parsePublisherDraftFile,
    serializePublisherDraftFile,
} from './domain/publisherDraftFile';
import { createPublisherPage } from './domain/publisherPage';
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
const { activePage, activePageId, draftLayouts, imageFocusByTemplate, pages, selectedTemplateId } = storeToRefs(documentStore);
const {
    activeEditorTool, canRedoLayout, canUndoLayout, hasLayoutSelection,
    previewZoomPercent, selectedLayoutElements, snapEnabled,
} = storeToRefs(editorStore);
const templateRef = shallowRef<InstanceType<typeof EventTemplate> | null>(null);
const workspaceContentRef = shallowRef<InstanceType<typeof PublisherWorkspaceContent> | null>(null);
const imageStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');
const exportError = ref('');
const exportSuccess = ref('');
let exportSuccessTimeout: ReturnType<typeof setTimeout> | null = null;
const showExportSuccess = (message: string) => {
    if (exportSuccessTimeout) clearTimeout(exportSuccessTimeout);
    exportSuccess.value = message;
    exportSuccessTimeout = setTimeout(() => {
        exportSuccess.value = '';
        exportSuccessTimeout = null;
    }, 3500);
};
const templateOverrides = ref<EventTemplateOverrides>({});
const replacementImageUrl = ref<string | null>(null);
const replacementImageName = ref('');
const replacementImageError = ref('');
const {
    handleWorkspaceWheel,
    setWorkspaceElement,
} = usePublisherWorkspaceZoom();
let zoomSaveTimeout: ReturnType<typeof setTimeout> | null = null;
const draftRevision = ref(0);
const draftStatus = ref('');
const draftError = ref('');
const hasLocalDraft = ref(false);
const restoringDraft = ref(false);
const draftIndexRevision = ref(0);
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
} = usePublisherAppointments(window.localStorage, draftIndexRevision, userLanguage, userTimeZone);
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
const exportDialogOpen = ref(false);
const exportBusy = ref(false);
const exportProgress = ref('');
const exportSettings = ref<PublisherPageExportSettings[]>([]);
const loadedDesignTemplates = loadPublisherDesignTemplates(window.localStorage);
const designTemplates = ref<PublisherDesignTemplate[]>(loadedDesignTemplates ?? []);
const selectedDesignTemplateId = ref('');
const designTemplateName = ref('');
const designTemplateStatus = ref('');
const designTemplateError = ref(
    loadedDesignTemplates === null ? 'Die gespeicherten Vorlagen konnten nicht gelesen werden.' : '',
);
const layoutStep = computed(() => (snapEnabled.value ? 20 : 5));
interface EditorTool {
    id: EditorToolId;
    targetId: string;
    label: string;
    requiresTemplate: boolean;
}
const editorTools = [
    { id: 'appointments', targetId: 'appointments-editor', label: 'Termine', requiresTemplate: false },
    { id: 'templates', targetId: 'templates-editor', label: 'Vorlagen', requiresTemplate: true },
    { id: 'data', targetId: 'data-editor', label: 'Termindaten', requiresTemplate: true },
    { id: 'layout', targetId: 'layout-editor', label: 'Layout', requiresTemplate: true },
] as const satisfies readonly EditorTool[];
const {
    alignLayoutElement,
    changeSelectedLayer,
    clearLayoutSelection,
    deleteLayoutElements,
    nudgeLayoutElement,
    redoLayout,
    resetSelectedLayoutElement,
    restoreSelectedFontSizeInput,
    restoreSelectedLayoutGeometryInput,
    selectLayoutElement,
    selectLayoutGroup,
    undoLayout,
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
    if (pages.value.length <= 1) {
        return;
    }
    const pageIndex = pages.value.findIndex(({ id }) => id === pageId);
    pages.value = pages.value.filter(({ id }) => id !== pageId);
    if (activePageId.value === pageId) {
        activePageId.value = pages.value[Math.max(0, pageIndex - 1)]!.id;
    }
    saveCurrentDraft();
};

const templateProps = computed(() => {
    const propsWithOverrides = applyTemplateOverrides(mappedTemplateProps.value ?? {
        title: '', date: '', time: '', location: '', imageUrl: null,
    }, templateOverrides.value);
    return replacementImageUrl.value
        ? { ...propsWithOverrides, imageUrl: replacementImageUrl.value }
        : propsWithOverrides;
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
    value: field.id === 'image' && replacementImageUrl.value
        ? replacementImageUrl.value
        : templateOverrides.value[field.id] ?? field.value,
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
const hasTemplateOverrides = computed(
    () => Object.keys(templateOverrides.value).length > 0 || Boolean(replacementImageUrl.value),
);

const activateEditorTool = async (tool: EditorTool) => {
    if (tool.id === 'appointments') {
        activeEditorTool.value = tool.id;
        appointmentDialogOpen.value = true;
        return;
    }
    if (tool.requiresTemplate && !templateProps.value) {
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
    if (!templateProps.value) return;
    templateRef.value?.addElement(kind);
    activeEditorTool.value = 'layout';
};

const addLayoutText = (textMode: LayoutTextMode) => {
    if (!templateProps.value) return;
    templateRef.value?.addElement('text', { textMode });
    activeEditorTool.value = 'layout';
};

const addLayoutIcon = (iconName: PublisherIconName) => {
    if (!templateProps.value) return;
    templateRef.value?.addElement('icon', { iconName, name: 'Icon' });
    activeEditorTool.value = 'layout';
};

const addLayoutQr = () => {
    if (!templateProps.value) return;
    templateRef.value?.addElement('qr', { qrValue: 'https://church.tools', name: 'QR-Code' });
    activeEditorTool.value = 'layout';
};

const addLayoutImage = (file: File) => {
    const validationError = validateLocalImage(file);
    if (validationError) {
        exportError.value = validationError;
        return;
    }
    const reader = new FileReader();
    reader.onerror = () => { exportError.value = 'Das Bild konnte nicht gelesen werden.'; };
    reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        templateRef.value?.addElement('image', { imageSource: reader.result, name: file.name });
        activeEditorTool.value = 'layout';
        exportError.value = '';
    };
    reader.readAsDataURL(file);
};

const closeAppointmentDialog = () => {
    appointmentDialogOpen.value = false;
    if (activeEditorTool.value === 'appointments') {
        activeEditorTool.value = selectedAppointmentKey.value ? 'templates' : 'layout';
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

const saveCurrentDraft = () => {
    if (!selectedAppointmentKey.value || restoringDraft.value) {
        return;
    }

    try {
        const wasLocalDraft = hasLocalDraft.value;
        savePublisherDraft(window.localStorage, selectedAppointmentKey.value, currentPublisherDraft());
        hasLocalDraft.value = true;
        if (!wasLocalDraft) {
            draftIndexRevision.value += 1;
        }
        draftStatus.value = 'Lokaler Entwurf gespeichert.';
        draftError.value = '';
    } catch {
        draftError.value = 'Der lokale Entwurf konnte nicht gespeichert werden.';
    }
};

const revokeReplacementImage = (defer = true) => {
    const previousUrl = replacementImageUrl.value;
    replacementImageUrl.value = null;
    replacementImageName.value = '';
    replacementImageError.value = '';

    if (previousUrl) {
        if (defer) {
            void nextTick(() => URL.revokeObjectURL(previousUrl));
        } else {
            URL.revokeObjectURL(previousUrl);
        }
    }
};

const updateReplacementImage = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
        return;
    }

    const validationError = validateLocalImage(file);
    if (validationError) {
        replacementImageError.value = validationError;
        return;
    }

    const previousUrl = replacementImageUrl.value;
    replacementImageUrl.value = URL.createObjectURL(file);
    replacementImageName.value = file.name;
    replacementImageError.value = '';
    exportError.value = '';
    exportSuccess.value = '';
    if (previousUrl) {
        void nextTick(() => URL.revokeObjectURL(previousUrl));
    }
};

watch(selectedAppointmentKey, () => {
    restoringDraft.value = true;
    exportError.value = '';
    exportSuccess.value = '';
    imageStatus.value = 'idle';
    revokeReplacementImage();
    try {
        const draft = selectedAppointmentKey.value
            ? loadPublisherDraft(window.localStorage, selectedAppointmentKey.value)
            : null;
        templateOverrides.value = draft?.templateOverrides ?? {};
        hasLocalDraft.value = Boolean(draft);
        draftStatus.value = selectedAppointmentKey.value
            ? 'Termindaten aktualisiert. Das aktuelle Layout wurde beibehalten.'
            : '';
        draftError.value = '';
    } catch {
        templateOverrides.value = {};
        hasLocalDraft.value = false;
        draftError.value = 'Gespeicherte Terminanpassungen konnten nicht geladen werden. Das Layout wurde beibehalten.';
    }
    void nextTick(() => {
        restoringDraft.value = false;
    });
});

watch(selectedTemplateId, () => {
    exportError.value = '';
    exportSuccess.value = '';
    saveCurrentDraft();
});

watch(snapEnabled, saveCurrentDraft);
watch(previewZoomPercent, () => {
    if (zoomSaveTimeout) {
        clearTimeout(zoomSaveTimeout);
    }
    zoomSaveTimeout = setTimeout(() => {
        zoomSaveTimeout = null;
        saveCurrentDraft();
    }, 300);
});

const updateTemplateOverride = (field: EditableTemplateField, value: string) => {
    templateOverrides.value = withTemplateOverride(
        originalAppointmentDataValues.value,
        templateOverrides.value,
        field,
        value,
    );
    exportError.value = '';
    exportSuccess.value = '';
    saveCurrentDraft();
};

const insertAppointmentDataField = (field: PublisherDataField) => {
    if (field.type === 'image') {
        if (!field.value) return;
        templateRef.value?.addElement('image', { imageSource: field.value, name: field.label, dataBinding: field.id });
    } else {
        templateRef.value?.addElement('text', {
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
    templateRef.value?.addElement('qr', {
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

const resetTemplateOverrides = () => {
    templateOverrides.value = {};
    revokeReplacementImage();
    saveCurrentDraft();
};

const updatePageDraftLayout = (pageId: string, templateId: TemplateId, state: SerializableLayoutState) => {
    const page = pages.value.find(({ id }) => id === pageId);
    if (!page) {
        return;
    }
    page.layouts = { ...page.layouts, [templateId]: cloneLayoutState(state) };
    saveCurrentDraft();
};

const createDesignTemplateId = () =>
    typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `template-${Date.now().toString(36)}`;

const applyStandardTemplate = (templateId: TemplateId) => {
    restoringDraft.value = true;
    activePage.value.templateId = templateId;
    activePage.value.layouts = {};
    activePage.value.imageFocus = createImageFocusByTemplate();
    selectedDesignTemplateId.value = '';
    draftRevision.value += 1;
    designTemplateStatus.value = 'Standardvorlage angewendet.';
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
};

const persistCurrentDesignAsTemplate = (existing?: PublisherDesignTemplate) => {
    const layout = templateRef.value?.getLayoutState();
    const name = (existing?.name ?? designTemplateName.value).trim();
    if (!layout || !templateProps.value) {
        designTemplateError.value = 'Die aktuelle Seite ist noch nicht bereit.';
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
        baseTemplateId: selectedTemplateId.value,
        layout: cloneLayoutState(layout),
        imageFocus: { ...imageFocusByTemplate.value[selectedTemplateId.value] },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };

    try {
        designTemplates.value = savePublisherDesignTemplate(window.localStorage, designTemplate);
        selectedDesignTemplateId.value = designTemplate.id;
        designTemplateName.value = '';
        designTemplateStatus.value = existing
            ? `Vorlage „${designTemplate.name}“ aktualisiert.`
            : `Vorlage „${designTemplate.name}“ gespeichert.`;
        designTemplateError.value = '';
    } catch (error) {
        console.error('Vorlage konnte nicht gespeichert werden.', error);
        designTemplateError.value = error instanceof Error
            ? error.message
            : 'Die Vorlage konnte nicht gespeichert werden.';
    }
};

const applyDesignTemplate = (designTemplate: PublisherDesignTemplate) => {
    restoringDraft.value = true;
    selectedDesignTemplateId.value = designTemplate.id;
    selectedTemplateId.value = designTemplate.baseTemplateId;
    draftLayouts.value = {
        ...draftLayouts.value,
        [designTemplate.baseTemplateId]: cloneLayoutState(designTemplate.layout),
    };
    imageFocusByTemplate.value = {
        ...imageFocusByTemplate.value,
        [designTemplate.baseTemplateId]: { ...designTemplate.imageFocus },
    };
    draftRevision.value += 1;
    designTemplateStatus.value = `Vorlage „${designTemplate.name}“ angewendet.`;
    designTemplateError.value = '';
    void nextTick(() => {
        restoringDraft.value = false;
        saveCurrentDraft();
    });
};

const removeDesignTemplate = (designTemplate: PublisherDesignTemplate) => {
    try {
        designTemplates.value = deletePublisherDesignTemplate(window.localStorage, designTemplate.id);
        if (selectedDesignTemplateId.value === designTemplate.id) {
            selectedDesignTemplateId.value = '';
        }
        designTemplateStatus.value = `Vorlage „${designTemplate.name}“ gelöscht.`;
        designTemplateError.value = '';
    } catch {
        designTemplateError.value = 'Die Vorlage konnte nicht gelöscht werden.';
    }
};

const deleteLocalDraft = () => {
    if (!selectedAppointmentKey.value) {
        return;
    }

    restoringDraft.value = true;
    try {
        deletePublisherDraft(window.localStorage, selectedAppointmentKey.value);
        templateOverrides.value = {};
        const resetPage = createPublisherPage();
        pages.value = [resetPage];
        activePageId.value = resetPage.id;
        snapEnabled.value = true;
        previewZoomPercent.value = 100;
        hasLocalDraft.value = false;
        draftIndexRevision.value += 1;
        draftStatus.value = 'Lokaler Entwurf gelöscht.';
        draftError.value = '';
        revokeReplacementImage();
        draftRevision.value += 1;
    } catch {
        draftError.value = 'Der lokale Entwurf konnte nicht gelöscht werden.';
    }
    void nextTick(() => {
        restoringDraft.value = false;
    });
};

const isTextEntryTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'));

const handleEditorShortcut = (event: KeyboardEvent) => {
    if (isTextEntryTarget(event.target)) {
        return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && hasLayoutSelection.value) {
        event.preventDefault();
        templateRef.value?.deleteSelectedElements();
        return;
    }

    const shortcut = resolveEditorShortcut(event, hasLayoutSelection.value);
    if (!shortcut) {
        return;
    }
    if (shortcut.type === 'undo' && !canUndoLayout.value) {
        return;
    }
    if (shortcut.type === 'redo' && !canRedoLayout.value) {
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
            undoLayout();
            break;
        case 'redo':
            redoLayout();
            break;
        case 'clearSelection':
            clearLayoutSelection();
            break;
        case 'group':
            templateRef.value?.groupSelectedElements();
            break;
        case 'ungroup':
            templateRef.value?.ungroupSelectedElements();
            break;
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleEditorShortcut);
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEditorShortcut);
    if (zoomSaveTimeout) clearTimeout(zoomSaveTimeout);
    if (exportSuccessTimeout) clearTimeout(exportSuccessTimeout);
    revokeReplacementImage(false);
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
    exportSuccess.value = '';
    saveCurrentDraft();
};

const resetImageFocus = () => {
    imageFocusByTemplate.value = {
        ...imageFocusByTemplate.value,
        [selectedTemplateId.value]: { x: 50, y: 50, zoom: 100 },
    };
    exportError.value = '';
    exportSuccess.value = '';
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

const exportDraftFile = () => {
    if (!selectedAppointmentKey.value || !selectedAppointmentId.value) {
        return;
    }

    try {
        const file = createPublisherDraftFile(
            selectedAppointmentKey.value,
            currentPublisherDraft(),
        );
        const blob = new Blob([serializePublisherDraftFile(file)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const download = document.createElement('a');
        download.href = downloadUrl;
        download.download = `publisher-entwurf-${selectedAppointmentId.value}.json`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
        draftStatus.value = 'Entwurf als JSON exportiert.';
        draftError.value = '';
    } catch {
        draftError.value = 'Der Entwurf konnte nicht exportiert werden.';
    }
};

const importDraftFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !selectedAppointmentKey.value) {
        return;
    }
    if (file.size > 1024 * 1024) {
        draftError.value = 'Die Entwurfsdatei darf höchstens 1 MB groß sein.';
        return;
    }

    try {
        const imported = parsePublisherDraftFile(await file.text());
        if (!imported) {
            throw new Error('invalid');
        }
        if (!belongsToAppointment(imported, selectedAppointmentKey.value)) {
            draftError.value = 'Die Entwurfsdatei gehört zu einem anderen Kalendertermin.';
            return;
        }

        restoringDraft.value = true;
        const wasLocalDraft = hasLocalDraft.value;
        savePublisherDraft(window.localStorage, selectedAppointmentKey.value, imported.draft);
        templateOverrides.value = { ...imported.draft.templateOverrides };
        if (imported.draft.pages?.length && imported.draft.activePageId) {
            pages.value = imported.draft.pages.map((page) => ({
                ...page,
                layouts: Object.fromEntries(Object.entries(page.layouts).map(([templateId, state]) => [
                    templateId,
                    state ? cloneLayoutState(state) : state,
                ])),
                imageFocus: {
                    split: { ...page.imageFocus.split },
                    poster: { ...page.imageFocus.poster },
                },
            }));
            activePageId.value = imported.draft.activePageId;
        } else {
            const importedPage = createPublisherPage();
            importedPage.templateId = imported.draft.selectedTemplateId;
            importedPage.layouts = Object.fromEntries(
                Object.entries(imported.draft.layouts).map(([templateId, state]) => [
                    templateId,
                    state ? cloneLayoutState(state) : state,
                ]),
            );
            importedPage.imageFocus = {
                split: { ...imported.draft.imageFocus.split },
                poster: { ...imported.draft.imageFocus.poster },
            };
            pages.value = [importedPage];
            activePageId.value = importedPage.id;
        }
        snapEnabled.value = imported.draft.snapEnabled;
        previewZoomPercent.value = imported.draft.previewZoomPercent;
        hasLocalDraft.value = true;
        if (!wasLocalDraft) {
            draftIndexRevision.value += 1;
        }
        draftStatus.value = 'Entwurf aus JSON importiert.';
        draftError.value = '';
        exportError.value = '';
        exportSuccess.value = '';
        revokeReplacementImage();
        draftRevision.value += 1;
    } catch {
        draftError.value = 'Die Entwurfsdatei ist ungültig oder nicht kompatibel.';
    } finally {
        void nextTick(() => {
            restoringDraft.value = false;
        });
    }
};

const openExportDialog = () => {
    exportSettings.value = createPublisherExportSettings(pages.value, exportSettings.value);
    exportError.value = '';
    exportSuccess.value = '';
    exportProgress.value = '';
    exportDialogOpen.value = true;
};

const updateExportPage = (pageId: string, change: Partial<Omit<PublisherPageExportSettings, 'pageId'>>) => {
    exportSettings.value = updatePublisherExportSettings(exportSettings.value, pageId, change);
};

const exportPages = async () => {
    const selectedSettings = exportSettings.value.filter(({ enabled }) => enabled);
    if (!templateProps.value || selectedSettings.length === 0 || exportBusy.value) return;
    exportError.value = '';
    exportSuccess.value = '';
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
                `seite-${pageIndex + 1}-${page.width}x${page.height}-${titleSlug}.${extension}`,
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
        showExportSuccess(`${selectedSettings.length} Seite${selectedSettings.length === 1 ? '' : 'n'} als ZIP exportiert.`);
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
            <div v-if="exportSuccess" class="publisher-toast publisher-toast--success" role="status">{{ exportSuccess }}</div>
        </Transition>
        <template #topbar>
            <PublisherTopbar
                :document-title="selectedAppointment?.appointment.base.title ?? 'Unbenannt'"
                :export-disabled="!templateProps"
                :has-template="Boolean(templateProps)"
                @activate="activateEditorToolById"
                @export="openExportDialog"
                @redo="redoLayout"
                @undo="undoLayout"
            />
        </template>

        <template #contextbar>
            <PublisherContextBar
                :has-image="Boolean(templateProps?.imageUrl)"
                :has-template="Boolean(templateProps)"
                :has-template-overrides="hasTemplateOverrides"
                @align="alignLayoutElement"
                @change-layer="changeSelectedLayer"
                @distribute="templateRef?.distributeSelectedElements($event)"
                @group="templateRef?.groupSelectedElements()"
                @reset-image-focus="resetImageFocus"
                @reset-selection="resetSelectedLayoutElement"
                @reset-template-overrides="resetTemplateOverrides"
                @set-group-auto-layout="templateRef?.setSelectedGroupAutoLayout($event)"
                @ungroup="templateRef?.ungroupSelectedElements()"
                @update-qr-content="templateRef?.setSelectedQrOptions('qrValue', $event)"
                @update-text-content="updateSelectedTextContent"
            />
        </template>

        <template #tools>
            <PublisherToolRail :disabled="!templateProps" @add="addLayoutElement" @add-icon="addLayoutIcon" @add-image="addLayoutImage" @add-qr="addLayoutQr" @add-text="addLayoutText" />
        </template>

        <template #left>
            <PublisherPagesPanel :preview-title="templateProps?.title || null" @add="pageDialogOpen = true" @remove="removePage" />
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

        <section :ref="setWorkspaceElement" class="publisher-workspace" @wheel="handleWorkspaceWheel($event, Boolean(templateProps))">
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
                <TemplateInspector
                    v-if="activeEditorTool === 'templates'"
                    v-model:name="designTemplateName"
                    :design-templates="designTemplates"
                    :draft-error="draftError"
                    :draft-status="draftStatus"
                    :error="designTemplateError"
                    :has-local-draft="hasLocalDraft"
                    :selected-design-template-id="selectedDesignTemplateId"
                    :selected-template-id="selectedTemplateId"
                    :status="designTemplateStatus"
                    @apply-design="applyDesignTemplate"
                    @apply-standard="applyStandardTemplate"
                    @delete-design="removeDesignTemplate"
                    @delete-draft="deleteLocalDraft"
                    @export-draft="exportDraftFile"
                    @import-draft="importDraftFile"
                    @save-design="persistCurrentDesignAsTemplate"
                />
                <AppointmentDataInspector
                    v-else-if="activeEditorTool === 'data'"
                    :error="replacementImageError"
                    :focus="imageFocusByTemplate[selectedTemplateId]"
                    :overridden-fields="Object.keys(templateOverrides) as EditableTemplateField[]"
                    :replacement-name="replacementImageName"
                    :replacement-url="replacementImageUrl"
                    @insert-field="insertAppointmentDataField"
                    @insert-qr-field="insertAppointmentQrField"
                    @load-related-source="loadRelatedDataSource"
                    @open-appointments="appointmentDialogOpen = true"
                    @reset-field="resetTemplateOverride"
                    @reset-image="revokeReplacementImage()"
                    @update-field="updateTemplateOverride"
                    @update-focus="updateImageFocus"
                    @update-image="updateReplacementImage"
                />
                <LayoutInspector
                    v-else-if="activeEditorTool === 'layout'"
                    :data-values="appointmentDataValues"
                    :template="templateProps"
                    @delete-elements="deleteLayoutElements"
                    @drill-into-element="templateRef?.drillIntoElement($event)"
                    @move-layer="(source, target, placement) => templateRef?.moveLayerNode(source, target, placement)"
                    @restore-font-size="restoreSelectedFontSizeInput"
                    @restore-geometry="restoreSelectedLayoutGeometryInput"
                    @select-element="selectLayoutElement"
                    @select-group="selectLayoutGroup"
                    @set-color-binding="(field, binding) => templateRef?.setSelectedElementColorBinding(field, binding)"
                    @set-fill-color="templateRef?.setSelectedElementStaticColor('fill', $event)"
                    @set-static-color="(field, color) => templateRef?.setSelectedElementStaticColor(field, color)"
                    @set-text-color="templateRef?.setSelectedElementStaticColor('color', $event)"
                    @toggle-lock="templateRef?.toggleElementsLock($event)"
                    @toggle-visibility="templateRef?.toggleElementsVisibility($event)"
                    @update-geometry="updateSelectedLayoutGeometry"
                    @update-effects="(elementIds, effects) => templateRef?.setElementEffects(elementIds, effects)"
                    @update-gradient="(field, gradient) => templateRef?.setSelectedElementGradient(field, gradient)"
                    @update-text-style="updateSelectedTextStyle"
                    @update-text-mode="templateRef?.setSelectedCustomTextMode($event)"
                    @update-qr-option="(field, value) => templateRef?.setSelectedQrOptions(field, value)"
                    @update-visual-style="updateSelectedVisualStyle"
                />
                <AppointmentInspector v-else @open="appointmentDialogOpen = true" />
            </PublisherInspectorShell>
        </template>

        <template #statusbar>
            <div class="publisher-statusbar">
                <span>{{ `${templateProps.title || 'Leere Seite'} · Seite ${pages.indexOf(activePage) + 1} · ${activePage.width} × ${activePage.height} px` }}</span>
                <span v-if="hasLayoutSelection">{{ selectedLayoutElements.length }} Element{{ selectedLayoutElements.length === 1 ? '' : 'e' }} ausgewählt</span>
                <label class="publisher-statusbar__zoom" for="preview-zoom">
                    <span class="sr-only">Zoom</span>
                    <input id="preview-zoom" v-model.number="previewZoomPercent" type="range" min="25" max="400" step="5" aria-label="Zoom" />
                    <output for="preview-zoom">{{ Math.round(previewZoomPercent) }} %</output>
                </label>
            </div>
        </template>
    </PublisherEditorShell>
</template>
