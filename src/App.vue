<script setup lang="ts">
import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { useAppointmentQuery, useCalendarsQuery } from '@churchtools/vue-query';
import {
    faCalendarDays,
    faFont,
    faImage,
    faObjectGroup,
    faRotateLeft,
    faRotateRight,
    faTableColumns,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import EventTemplate from './components/EventTemplate.vue';
import LayoutLayerTree from './components/LayoutLayerTree.vue';
import PublisherAppointmentPanel from './components/PublisherAppointmentPanel.vue';
import PublisherEditorShell from './components/PublisherEditorShell.vue';
import { useAppointmentsQuery } from './composables/useAppointmentsQuery';
import { isAppointmentWithinDays, matchesAppointmentFilters } from './domain/appointmentFilters';
import { resolveEditorShortcut } from './domain/editorShortcuts';
import { createImageFocusByTemplate, type ImageFocus } from './domain/imageFocus';
import { mapAppointmentToTemplateProps } from './domain/mapAppointmentToTemplateProps';
import {
    LAYOUT_ELEMENT_IDS,
    createLayoutLayerTree,
    type LayoutAlignment,
    type LayoutElementId,
    type LayoutGeometry,
    type LayoutTextStyle,
    type LayoutVisualStyle,
} from './domain/layoutEditing';
import { cloneLayoutState, type SerializableLayoutState } from './domain/layoutHistory';
import { validateLocalImage } from './domain/localImageOverride';
import {
    deletePublisherDraft,
    findPublisherDraftAppointmentKeys,
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
import {
    applyTemplateOverrides,
    type EditableTemplateField,
    type EventTemplateOverrides,
    withTemplateOverride,
} from './domain/templateOverrides';
import { TEMPLATE_OPTIONS, type TemplateId } from './domain/templates';
import {
    loadThemePreference,
    resolveTheme,
    saveThemePreference,
    type ThemePreference,
} from './domain/theme';

const userLanguage = window.settings?.language ?? navigator.language;
const userTimeZone = window.settings?.timezone;
const colorSchemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
const themePreference = ref<ThemePreference>(loadThemePreference(window.localStorage));
const systemPrefersDark = ref(colorSchemeQuery?.matches ?? false);
const resolvedTheme = computed(() => resolveTheme(themePreference.value, systemPrefersDark.value));
const selectedAppointmentKey = ref('');
const appointmentSearch = ref('');
const selectedCalendarFilter = ref('');
const selectedAppointmentRange = ref('');
const onlyAppointmentsWithDraft = ref(false);
const appointmentDialogOpen = ref(true);
const appointmentFilterReferenceDate = new Date();
interface PublisherPage {
    id: string;
    width: number;
    height: number;
    templateId: TemplateId;
    layouts: Partial<Record<TemplateId, SerializableLayoutState>>;
    imageFocus: ReturnType<typeof createImageFocusByTemplate>;
}
const createPageId = () => typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const createPublisherPage = (width = 1920, height = 1080, templateId: TemplateId = 'split'): PublisherPage => ({
    id: createPageId(),
    width,
    height,
    templateId,
    layouts: {},
    imageFocus: createImageFocusByTemplate(),
});
const initialPage = createPublisherPage();
const pages = ref<PublisherPage[]>([initialPage]);
const activePageId = ref(initialPage.id);
const activePage = computed(() => pages.value.find(({ id }) => id === activePageId.value) ?? pages.value[0]!);
const pageTemplateRefs = new Map<string, InstanceType<typeof EventTemplate>>();
const pageTemplateRefRevision = ref(0);
const setPageTemplateRef = (pageId: string, instance: unknown) => {
    const templateInstance = instance as InstanceType<typeof EventTemplate> | null;
    if (templateInstance && pageTemplateRefs.get(pageId) !== templateInstance) {
        pageTemplateRefs.set(pageId, templateInstance);
        pageTemplateRefRevision.value += 1;
    } else if (!templateInstance && pageTemplateRefs.delete(pageId)) {
        pageTemplateRefRevision.value += 1;
    }
};
const templateRef = computed(() => {
    pageTemplateRefRevision.value;
    return pageTemplateRefs.get(activePageId.value) ?? null;
});
const imageStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');
const exportError = ref('');
const exportSuccess = ref('');
const templateOverrides = ref<EventTemplateOverrides>({});
const replacementImageUrl = ref<string | null>(null);
const replacementImageName = ref('');
const replacementImageError = ref('');
const selectedTemplateId = computed<TemplateId>({
    get: () => activePage.value.templateId,
    set: (templateId) => { activePage.value.templateId = templateId; },
});
const layoutChanged = ref(false);
const canUndoLayout = ref(false);
const canRedoLayout = ref(false);
const selectedLayoutElement = ref<LayoutElementId | null>(null);
const selectedLayoutElements = ref<LayoutElementId[]>([]);
const selectedLayoutGeometry = ref<(LayoutGeometry & { elementId: LayoutElementId }) | null>(null);
const selectedLayoutStyle = ref<(LayoutTextStyle & { elementId: LayoutElementId }) | null>(null);
const selectedLayoutVisualStyle = ref<(LayoutVisualStyle & { elementId: LayoutElementId }) | null>(null);
const selectedLayoutElementChanged = ref(false);
const canGroupLayoutSelection = ref(false);
const canUngroupLayoutSelection = ref(false);
const selectedLayoutGroupDepth = ref(0);
const selectedLayerPosition = ref(0);
const selectedLayerTotal = ref(0);
const snapEnabled = ref(true);
const previewZoomPercent = ref(100);
const previewZoomOptions = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400] as const;
const displayedPreviewZoomOptions = computed(() =>
    [...new Set<number>([...previewZoomOptions, previewZoomPercent.value])].sort((left, right) => left - right));
const workspaceZoomScale = computed(() => (previewZoomPercent.value / 100) * 0.32);
const workspaceRef = ref<HTMLElement | null>(null);
const availableLayoutElements = ref<LayoutElementId[]>([...LAYOUT_ELEMENT_IDS]);
const layoutLayerTree = computed(() => {
    const state = activePage.value.layouts[activePage.value.templateId];
    return createLayoutLayerTree(
        state?.order ?? availableLayoutElements.value,
        state?.groups ?? [],
        state?.deleted ?? [],
    );
});
let zoomAnimationFrame: number | null = null;
let zoomSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingTrackpadZoom: { value: number; clientX: number; clientY: number } | null = null;
const draftLayouts = computed<Partial<Record<TemplateId, SerializableLayoutState>>>({
    get: () => activePage.value.layouts,
    set: (layouts) => { activePage.value.layouts = layouts; },
});
const draftRevision = ref(0);
const draftStatus = ref('');
const draftError = ref('');
const hasLocalDraft = ref(false);
const restoringDraft = ref(false);
const draftIndexRevision = ref(0);
const imageFocusByTemplate = computed({
    get: () => activePage.value.imageFocus,
    set: (imageFocus) => { activePage.value.imageFocus = imageFocus; },
});
const pageDialogOpen = ref(false);
const newPagePreset = ref('1920x1080');
const newPageWidth = ref(1920);
const newPageHeight = ref(1080);
const pageCreationError = ref('');
const loadedDesignTemplates = loadPublisherDesignTemplates(window.localStorage);
const designTemplates = ref<PublisherDesignTemplate[]>(loadedDesignTemplates ?? []);
const selectedDesignTemplateId = ref('');
const designTemplateName = ref('');
const designTemplateStatus = ref('');
const designTemplateError = ref(
    loadedDesignTemplates === null ? 'Die gespeicherten Vorlagen konnten nicht gelesen werden.' : '',
);
const selectedDesignTemplate = computed(
    () => designTemplates.value.find(({ id }) => id === selectedDesignTemplateId.value) ?? null,
);
const layoutStep = computed(() => (snapEnabled.value ? 20 : 5));
const hasLayoutSelection = computed(() => selectedLayoutElements.value.length > 0);
const hasMultipleLayoutSelection = computed(() => selectedLayoutElements.value.length > 1);
const layoutElementLabels: Record<LayoutElementId, string> = {
    background: 'Hintergrund',
    image: 'Bild',
    accent: 'Akzentform',
    title: 'Titel',
    dateTime: 'Datum/Uhrzeit',
    location: 'Ort',
};
const editorTools = [
    { id: 'appointments', targetId: 'appointments-editor', label: 'Termine', icon: faCalendarDays, requiresTemplate: false },
    { id: 'templates', targetId: 'templates-editor', label: 'Vorlagen', icon: faTableColumns, requiresTemplate: true },
    { id: 'content', targetId: 'content-editor', label: 'Inhalte', icon: faFont, requiresTemplate: true },
    { id: 'image', targetId: 'image-editor', label: 'Bild', icon: faImage, requiresTemplate: true },
    { id: 'layout', targetId: 'layout-editor', label: 'Layout', icon: faObjectGroup, requiresTemplate: true },
] as const;
type EditorToolId = typeof editorTools[number]['id'];
const activeEditorTool = ref<EditorToolId>('appointments');
type LayoutInspectorTab = 'text' | 'paragraph' | 'layers';
const activeLayoutInspectorTab = ref<LayoutInspectorTab>('layers');
const activeAppearanceTab = ref<'fill' | 'stroke'>('fill');
const activeEditorToolLabel = computed(
    () => editorTools.find(({ id }) => id === activeEditorTool.value)?.label ?? 'Werkzeug',
);
const layoutGeometryFields: { id: keyof LayoutGeometry; label: string }[] = [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'width', label: 'Breite' },
    { id: 'height', label: 'Höhe' },
    { id: 'rotation', label: 'Drehung' },
];
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

const activatePage = (pageId: string) => {
    activePageId.value = pageId;
    selectedLayoutElement.value = null;
    selectedLayoutElements.value = [];
    selectedLayoutGeometry.value = null;
    selectedLayoutStyle.value = null;
    selectedLayoutVisualStyle.value = null;
    const page = pages.value.find(({ id }) => id === pageId);
    const deleted = page?.layouts[page.templateId]?.deleted ?? [];
    availableLayoutElements.value = LAYOUT_ELEMENT_IDS.filter((elementId) => !deleted.includes(elementId));
};

const addPage = () => {
    const width = Math.round(newPageWidth.value);
    const height = Math.round(newPageHeight.value);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64 || width > 8192 || height > 8192) {
        pageCreationError.value = 'Breite und Höhe müssen zwischen 64 und 8192 Pixeln liegen.';
        return;
    }
    const page = createPublisherPage(width, height, selectedTemplateId.value);
    pages.value = [...pages.value, page];
    activePageId.value = page.id;
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

const { data: calendars, error: calendarsError, isPending: calendarsPending } = useCalendarsQuery();
const calendarIds = computed(() => calendars.value?.map(({ id }) => id) ?? []);
const {
    data: appointments,
    error: appointmentsError,
    isPending: appointmentsPending,
} = useAppointmentsQuery(calendarIds);

const appointmentKey = ({ appointment }: AppointmentCalculatedWithIncludes) =>
    `${appointment.base.id}:${appointment.calculated.startDate}`;

const sortedAppointments = computed(() =>
    [...(appointments.value ?? [])].sort((left, right) =>
        left.appointment.calculated.startDate.localeCompare(right.appointment.calculated.startDate),
    ),
);
const sortedCalendars = computed(() =>
    [...(calendars.value ?? [])].sort((left, right) =>
        left.nameTranslated.localeCompare(right.nameTranslated, userLanguage),
    ),
);
const draftAppointmentKeys = computed(() => {
    draftIndexRevision.value;
    try {
        return findPublisherDraftAppointmentKeys(
            window.localStorage,
            sortedAppointments.value.map(appointmentKey),
        );
    } catch {
        return new Set<string>();
    }
});
const filteredAppointments = computed(() =>
    sortedAppointments.value.filter(({ appointment }) => {
        const matchesTextAndCalendar = matchesAppointmentFilters(
            {
                title: appointment.base.title,
                calendarId: String(appointment.base.calendar.id),
                calendarName: appointment.base.calendar.nameTranslated,
            },
            appointmentSearch.value,
            selectedCalendarFilter.value,
        );
        const rangeDays = selectedAppointmentRange.value
            ? Number(selectedAppointmentRange.value)
            : null;
        const key = `${appointment.base.id}:${appointment.calculated.startDate}`;
        return (!onlyAppointmentsWithDraft.value || draftAppointmentKeys.value.has(key)) &&
            matchesTextAndCalendar && isAppointmentWithinDays(
            appointment.calculated.startDate,
            rangeDays,
            appointmentFilterReferenceDate,
        );
    }),
);
const hasAppointmentFilters = computed(() =>
    Boolean(
        appointmentSearch.value || selectedCalendarFilter.value || selectedAppointmentRange.value ||
        onlyAppointmentsWithDraft.value,
    ),
);

const selectedAppointment = computed(
    () => sortedAppointments.value.find((appointment) => appointmentKey(appointment) === selectedAppointmentKey.value),
);
const selectedAppointmentId = computed(() => selectedAppointment.value?.appointment.base.id);
const selectedStartDate = computed(() => selectedAppointment.value?.appointment.calculated.startDate.slice(0, 10));
const {
    data: appointmentDetails,
    error: appointmentDetailsError,
    isFetching: appointmentDetailsPending,
} = useAppointmentQuery(
    () => selectedAppointmentId.value,
    () => selectedStartDate.value,
);

const mappedTemplateProps = computed(() => {
    if (!appointmentDetails.value) {
        return null;
    }

    return mapAppointmentToTemplateProps(appointmentDetails.value.appointment, {
        locale: userLanguage,
        timeZone: userTimeZone,
    });
});

const templateProps = computed(() => {
    if (!mappedTemplateProps.value) {
        return null;
    }

    const propsWithOverrides = applyTemplateOverrides(mappedTemplateProps.value, templateOverrides.value);
    return replacementImageUrl.value
        ? { ...propsWithOverrides, imageUrl: replacementImageUrl.value }
        : propsWithOverrides;
});
const hasTemplateOverrides = computed(
    () => Object.keys(templateOverrides.value).length > 0 || Boolean(replacementImageUrl.value),
);

const activateEditorTool = async (tool: typeof editorTools[number]) => {
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
    document.getElementById(tool.targetId)?.scrollIntoView({ block: 'start' });
};

const closeAppointmentDialog = () => {
    appointmentDialogOpen.value = false;
    if (selectedAppointmentKey.value) {
        activeEditorTool.value = 'templates';
    }
};

const isLoading = computed(() => calendarsPending.value || appointmentsPending.value);
const loadingError = computed(() => calendarsError.value ?? appointmentsError.value);

watch(
    [appointmentSearch, selectedCalendarFilter, selectedAppointmentRange, onlyAppointmentsWithDraft, draftIndexRevision],
    () => {
        if (selectedAppointmentKey.value && !filteredAppointments.value.some(
            (appointment) => appointmentKey(appointment) === selectedAppointmentKey.value,
        )) {
            selectedAppointmentKey.value = '';
        }
    },
);

const resetAppointmentFilters = () => {
    appointmentSearch.value = '';
    selectedCalendarFilter.value = '';
    selectedAppointmentRange.value = '';
    onlyAppointmentsWithDraft.value = false;
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
        const reusableTemplate = selectedDesignTemplate.value;
        templateOverrides.value = draft?.templateOverrides ?? {};
        if (draft?.pages?.length && draft.activePageId) {
            pages.value = draft.pages.map((page) => ({
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
            activePageId.value = draft.activePageId;
        } else if (draft) {
            const legacyPage = createPublisherPage();
            legacyPage.templateId = draft.selectedTemplateId;
            legacyPage.layouts = draft.layouts;
            legacyPage.imageFocus = draft.imageFocus;
            pages.value = [legacyPage];
            activePageId.value = legacyPage.id;
        } else if (reusableTemplate && pages.value.length === 1) {
            activePage.value.templateId = reusableTemplate.baseTemplateId;
            activePage.value.layouts = { [reusableTemplate.baseTemplateId]: cloneLayoutState(reusableTemplate.layout) };
            activePage.value.imageFocus = {
                ...createImageFocusByTemplate(),
                [reusableTemplate.baseTemplateId]: { ...reusableTemplate.imageFocus },
            };
        }
        snapEnabled.value = draft?.snapEnabled ?? true;
        previewZoomPercent.value = draft?.previewZoomPercent ?? 100;
        hasLocalDraft.value = Boolean(draft);
        draftStatus.value = draft
            ? 'Lokaler Entwurf geladen.'
            : pages.value.length > 1
                ? 'Mehrseitenlayout auf den neuen Termin angewendet.'
                : reusableTemplate ? `Vorlage „${reusableTemplate.name}“ auf den neuen Termin angewendet.` : '';
        if (draft) {
            selectedDesignTemplateId.value = '';
        }
        draftError.value = '';
    } catch {
        templateOverrides.value = {};
        const fallbackPage = createPublisherPage();
        pages.value = [fallbackPage];
        activePageId.value = fallbackPage.id;
        hasLocalDraft.value = false;
        draftIndexRevision.value += 1;
        draftError.value = 'Der lokale Entwurf konnte nicht geladen werden.';
    }
    draftRevision.value += 1;
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

const templateFieldValue = (field: EditableTemplateField) =>
    templateOverrides.value[field] ?? mappedTemplateProps.value?.[field] ?? '';

const updateTemplateOverride = (field: EditableTemplateField, event: Event) => {
    if (!mappedTemplateProps.value) {
        return;
    }

    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    templateOverrides.value = withTemplateOverride(
        mappedTemplateProps.value,
        templateOverrides.value,
        field,
        value,
    );
    exportError.value = '';
    exportSuccess.value = '';
    saveCurrentDraft();
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

const resetLayout = () => {
    templateRef.value?.resetLayout();
};

const resetSelectedLayoutElement = () => {
    templateRef.value?.resetSelectedElement();
};

const undoLayout = () => {
    templateRef.value?.undoLayout();
};

const redoLayout = () => {
    templateRef.value?.redoLayout();
};

const updateLayoutHistory = (canUndo: boolean, canRedo: boolean) => {
    canUndoLayout.value = canUndo;
    canRedoLayout.value = canRedo;
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
    } catch {
        designTemplateError.value = 'Die Vorlage konnte nicht gespeichert werden.';
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

const clearLayoutSelection = () => {
    templateRef.value?.clearSelection();
};

const handleWorkspaceWheel = (event: WheelEvent) => {
    if ((!event.ctrlKey && !event.metaKey) || !templateProps.value || !workspaceRef.value) {
        return;
    }
    event.preventDefault();
    const workspace = workspaceRef.value;
    const deltaPixels = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? workspace.clientHeight : 1);
    const previousTarget = pendingTrackpadZoom?.value ?? previewZoomPercent.value;
    const zoomFactor = Math.exp(-deltaPixels * 0.004);
    const nextZoom = Math.round(Math.min(400, Math.max(25, previousTarget * zoomFactor)) * 100) / 100;
    pendingTrackpadZoom = { value: nextZoom, clientX: event.clientX, clientY: event.clientY };
    if (zoomAnimationFrame !== null) {
        return;
    }
    zoomAnimationFrame = requestAnimationFrame(() => {
        zoomAnimationFrame = null;
        const pending = pendingTrackpadZoom;
        pendingTrackpadZoom = null;
        if (!pending || !workspaceRef.value) {
            return;
        }
        const currentWorkspace = workspaceRef.value;
        const previousZoom = previewZoomPercent.value;
        const bounds = currentWorkspace.getBoundingClientRect();
        const pointerX = pending.clientX - bounds.left;
        const pointerY = pending.clientY - bounds.top;
        const contentX = currentWorkspace.scrollLeft + pointerX;
        const contentY = currentWorkspace.scrollTop + pointerY;
        previewZoomPercent.value = pending.value;
        void nextTick(() => {
            const ratio = pending.value / previousZoom;
            currentWorkspace.scrollLeft = contentX * ratio - pointerX;
            currentWorkspace.scrollTop = contentY * ratio - pointerY;
        });
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

const selectLayoutElement = (elementId: LayoutElementId, event: MouseEvent) => {
    templateRef.value?.selectElement(elementId, event.ctrlKey || event.metaKey || event.shiftKey);
};

const deleteLayoutElements = (elementIds: LayoutElementId[]) => {
    templateRef.value?.deleteElements(elementIds);
};

const selectLayoutGroup = (groupId: string, event: MouseEvent) => {
    templateRef.value?.selectGroup(groupId, event.ctrlKey || event.metaKey || event.shiftKey);
};

watch(selectedLayoutElements, (elementIds) => {
    if (elementIds.length > 0) {
        activeEditorTool.value = 'layout';
    }
});

const nudgeLayoutElement = (deltaX: number, deltaY: number) => {
    templateRef.value?.nudgeSelectedElement(deltaX, deltaY);
};

const updateLayoutGrouping = (canGroup: boolean, canUngroup: boolean, groupDepth: number) => {
    canGroupLayoutSelection.value = canGroup;
    canUngroupLayoutSelection.value = canUngroup;
    selectedLayoutGroupDepth.value = groupDepth;
};

const updateSystemTheme = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches;
};

watch(themePreference, (preference) => saveThemePreference(window.localStorage, preference));
watch(resolvedTheme, (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}, { immediate: true });

onMounted(() => {
    window.addEventListener('keydown', handleEditorShortcut);
    colorSchemeQuery?.addEventListener('change', updateSystemTheme);
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEditorShortcut);
    colorSchemeQuery?.removeEventListener('change', updateSystemTheme);
    if (zoomAnimationFrame !== null) cancelAnimationFrame(zoomAnimationFrame);
    if (zoomSaveTimeout) clearTimeout(zoomSaveTimeout);
    revokeReplacementImage(false);
});

const alignLayoutElement = (alignment: LayoutAlignment) => {
    templateRef.value?.alignSelectedElement(alignment);
};

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

const updateSelectedLayoutGeometry = (field: keyof LayoutGeometry, event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!Number.isFinite(input.valueAsNumber)) {
        return;
    }

    templateRef.value?.setSelectedElementGeometry(field, input.valueAsNumber);
};

const restoreSelectedLayoutGeometryInput = (field: keyof LayoutGeometry, event: FocusEvent) => {
    const input = event.target as HTMLInputElement;
    const currentValue = selectedLayoutGeometry.value?.[field];
    input.value = currentValue === undefined ? '' : String(Math.round(currentValue));
};

const updateSelectedTextStyle = (field: keyof LayoutTextStyle, event: Event) => {
    const input = event.target as HTMLInputElement;
    const value = ['fontSize', 'lineHeight', 'letterSpacing'].includes(field)
        ? input.valueAsNumber
        : input.value;
    templateRef.value?.setSelectedElementTextStyle(field, value);
};

const updateSelectedVisualStyle = (field: keyof LayoutVisualStyle, event: Event) => {
    const input = event.target as HTMLInputElement;
    const value = field === 'strokeWidth' ? input.valueAsNumber : input.value;
    templateRef.value?.setSelectedElementVisualStyle(field, value);
};

const restoreSelectedFontSizeInput = (event: FocusEvent) => {
    const input = event.target as HTMLInputElement;
    input.value = selectedLayoutStyle.value ? String(selectedLayoutStyle.value.fontSize) : '';
};

const changeSelectedLayer = (direction: -1 | 1) => {
    templateRef.value?.changeSelectedLayer(direction);
};

const updateLayerPosition = (position: number, total: number) => {
    selectedLayerPosition.value = position;
    selectedLayerTotal.value = total;
};

const formatAppointmentDate = ({ appointment }: AppointmentCalculatedWithIncludes) => {
    const { base, calculated } = appointment;
    const options: Intl.DateTimeFormatOptions = base.allDay
        ? { dateStyle: 'full' }
        : { dateStyle: 'medium', timeStyle: 'short' };

    if (userTimeZone) {
        options.timeZone = userTimeZone;
    }

    return new Intl.DateTimeFormat(userLanguage, options).format(new Date(calculated.startDate));
};

const appointmentLabel = (appointment: AppointmentCalculatedWithIncludes) => {
    const { base } = appointment.appointment;
    const draftLabel = draftAppointmentKeys.value.has(appointmentKey(appointment)) ? ' — Entwurf' : '';
    return `${base.title} — ${formatAppointmentDate(appointment)} — ${base.calendar.nameTranslated}${draftLabel}`;
};
const appointmentPanelOptions = computed(() => filteredAppointments.value.map((appointment) => ({
    key: appointmentKey(appointment),
    label: appointmentLabel(appointment),
})));
const appointmentCalendarOptions = computed(() => sortedCalendars.value.map((calendar) => ({
    id: String(calendar.id),
    label: calendar.nameTranslated,
})));

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

const exportPng = async () => {
    exportError.value = '';
    exportSuccess.value = '';

    try {
        const dataUrl = await templateRef.value?.exportPng();
        if (!dataUrl || !templateProps.value || !selectedAppointmentId.value) {
            throw new Error('Die Vorschau ist noch nicht bereit.');
        }

        const pngBlob = await (await fetch(dataUrl)).blob();
        const exportedImage = await createImageBitmap(pngBlob);
        const exportedSize = { width: exportedImage.width, height: exportedImage.height };
        exportedImage.close();

        if (exportedSize.width !== activePage.value.width || exportedSize.height !== activePage.value.height) {
            throw new Error(`Unerwartete Exportgröße: ${exportedSize.width} × ${exportedSize.height} Pixel.`);
        }

        const downloadUrl = URL.createObjectURL(pngBlob);
        const download = document.createElement('a');
        download.href = downloadUrl;
        download.download = `veranstaltung-${selectedAppointmentId.value}-seite-${pages.value.indexOf(activePage.value) + 1}-${slugify(templateProps.value.title) || 'termin'}.png`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
        exportSuccess.value = `PNG mit ${activePage.value.width} × ${activePage.value.height} Pixeln wurde erstellt.`;
    } catch (error) {
        exportError.value = error instanceof Error ? error.message : 'Der PNG-Export ist fehlgeschlagen.';
    }
};
</script>

<template>
    <PublisherEditorShell>
        <template #topbar>
            <div class="publisher-topbar">
                <div class="publisher-topbar__brand">
                    <span>ChurchTools</span>
                    <strong>Publisher</strong>
                </div>
                <div class="publisher-topbar__document">
                    <span>Dokument</span>
                    <strong>{{ selectedAppointment?.appointment.base.title ?? 'Neues Dokument' }}</strong>
                </div>
                <div class="publisher-topbar__actions" role="toolbar" aria-label="Globale Aktionen">
                    <button type="button" class="publisher-topbar__icon-button" title="Rückgängig" aria-label="Rückgängig" :disabled="!canUndoLayout" @click="undoLayout">
                        <FontAwesomeIcon :icon="faRotateLeft" aria-hidden="true" />
                    </button>
                    <button type="button" class="publisher-topbar__icon-button" title="Wiederholen" aria-label="Wiederholen" :disabled="!canRedoLayout" @click="redoLayout">
                        <FontAwesomeIcon :icon="faRotateRight" aria-hidden="true" />
                    </button>
                    <button type="button" class="publisher-topbar__export" :disabled="!templateProps || imageStatus === 'loading'" @click="exportPng">
                        {{ imageStatus === 'loading' ? 'Bild wird geladen …' : 'Als PNG exportieren' }}
                    </button>
                </div>
                <label class="theme-picker theme-picker--compact">
                    <span class="sr-only">Darstellung</span>
                    <select v-model="themePreference" aria-label="Darstellung">
                        <option value="system">System</option>
                        <option value="light">Hell</option>
                        <option value="dark">Dunkel</option>
                    </select>
                </label>
            </div>
        </template>

        <template #contextbar>
            <div class="publisher-contextbar">
                <div class="publisher-contextbar__selection" role="status">
                    <span>{{ hasLayoutSelection ? 'Auswahl' : 'Werkzeug' }}</span>
                    <strong v-if="hasLayoutSelection">
                        {{ selectedLayoutGroupDepth ? `Gruppe ${selectedLayoutGroupDepth} · ` : '' }}{{ selectedLayoutElements.map((elementId) => layoutElementLabels[elementId]).join(', ') }}
                    </strong>
                    <strong v-else-if="activeEditorTool !== 'appointments'">{{ activeEditorToolLabel }}</strong>
                    <strong v-else>Keine Auswahl</strong>
                </div>

                <div v-if="hasLayoutSelection" class="publisher-contextbar__actions" aria-label="Kontextaktionen für Auswahl">
                    <button type="button" :disabled="!selectedLayoutElementChanged" @click="resetSelectedLayoutElement">Zurücksetzen</button>
                    <button type="button" :disabled="!canGroupLayoutSelection" @click="templateRef?.groupSelectedElements()">Gruppieren</button>
                    <button type="button" :disabled="!canUngroupLayoutSelection" @click="templateRef?.ungroupSelectedElements()">Gruppe lösen</button>
                    <span class="publisher-contextbar__separator" aria-hidden="true" />
                    <button type="button" @click="alignLayoutElement('left')">Links</button>
                    <button type="button" @click="alignLayoutElement('horizontalCenter')">Mitte X</button>
                    <button type="button" @click="alignLayoutElement('right')">Rechts</button>
                    <button type="button" @click="alignLayoutElement('top')">Oben</button>
                    <button type="button" @click="alignLayoutElement('verticalCenter')">Mitte Y</button>
                    <button type="button" @click="alignLayoutElement('bottom')">Unten</button>
                </div>
                <div v-else-if="activeEditorTool === 'content'" class="publisher-contextbar__actions">
                    <button type="button" :disabled="!hasTemplateOverrides" @click="resetTemplateOverrides">Alle Inhalte zurücksetzen</button>
                </div>
                <div v-else-if="activeEditorTool === 'image' && templateProps?.imageUrl" class="publisher-contextbar__actions">
                    <button type="button" @click="resetImageFocus">Bildausschnitt zentrieren</button>
                </div>
                <div v-else class="publisher-contextbar__hint">
                    {{ activeEditorTool === 'layout' ? 'Element auf der Seite oder in der Ebenenliste auswählen' : 'Einstellungen im rechten Bedienfeld' }}
                </div>

                <label class="publisher-contextbar__toggle">
                    <input v-model="snapEnabled" type="checkbox" :disabled="!templateProps" />
                    Einrasten
                </label>
                <label class="publisher-contextbar__zoom" for="preview-zoom">
                    <span class="sr-only">Zoom</span>
                    <select id="preview-zoom" v-model.number="previewZoomPercent" :disabled="!templateProps" aria-label="Zoom">
                        <option v-for="zoom in displayedPreviewZoomOptions" :key="zoom" :value="zoom">{{ zoom }} %</option>
                    </select>
                </label>
            </div>
        </template>

        <template #tools>
            <div class="publisher-toolrail">
                <button
                    v-for="tool in editorTools"
                    :key="tool.id"
                    type="button"
                    :title="tool.label"
                    :aria-label="tool.label"
                    :aria-pressed="tool.id === 'appointments' ? appointmentDialogOpen : activeEditorTool === tool.id"
                    :class="{ 'is-active': tool.id === 'appointments' ? appointmentDialogOpen : activeEditorTool === tool.id }"
                    :disabled="tool.requiresTemplate && !templateProps"
                    @click="activateEditorTool(tool)"
                >
                    <FontAwesomeIcon :icon="tool.icon" aria-hidden="true" />
                </button>
            </div>
        </template>

        <template #left>
            <section class="publisher-pages" aria-labelledby="pages-heading">
                <header class="publisher-panel-heading">
                    <div>
                        <span>Dokument</span>
                        <h2 id="pages-heading">Seiten</h2>
                    </div>
                    <button type="button" class="publisher-panel-heading__action" title="Seite hinzufügen" @click="pageDialogOpen = true">＋</button>
                </header>
                <article v-for="(page, pageIndex) in pages" :key="page.id" class="publisher-page-entry">
                    <button
                        type="button"
                        class="publisher-page-card"
                        :class="{ 'is-active': activePageId === page.id }"
                        :aria-current="activePageId === page.id ? 'page' : undefined"
                        @click="activatePage(page.id)"
                    >
                        <span class="publisher-page-card__number">{{ pageIndex + 1 }}</span>
                        <span class="publisher-page-card__preview" :class="`is-${page.templateId}`" :style="{ aspectRatio: `${page.width} / ${page.height}` }">
                            <span v-if="templateProps" class="publisher-page-card__preview-title">{{ templateProps.title }}</span>
                            <span v-else class="publisher-page-card__preview-empty">Termin wählen</span>
                        </span>
                        <strong>Seite {{ pageIndex + 1 }}</strong>
                        <small>{{ page.width }} × {{ page.height }} px</small>
                    </button>
                    <button v-if="pages.length > 1" type="button" class="publisher-page-entry__delete" :aria-label="`Seite ${pageIndex + 1} löschen`" @click="removePage(page.id)">×</button>
                </article>
                <button type="button" class="publisher-pages__add" @click="pageDialogOpen = true">＋ Seite hinzufügen</button>
            </section>
        </template>

        <PublisherAppointmentPanel
            v-model:search="appointmentSearch"
            v-model:selected-calendar="selectedCalendarFilter"
            v-model:selected-range="selectedAppointmentRange"
            v-model:only-drafts="onlyAppointmentsWithDraft"
            v-model:selected-appointment-key="selectedAppointmentKey"
            :appointments="appointmentPanelOptions"
            :calendars="appointmentCalendarOptions"
            :has-error="Boolean(loadingError)"
            :has-filters="hasAppointmentFilters"
            :is-loading="isLoading"
            :open="appointmentDialogOpen"
            :total-count="sortedAppointments.length"
            @close="closeAppointmentDialog"
            @reset-filters="resetAppointmentFilters"
        />

        <div v-if="pageDialogOpen" class="publisher-page-dialog-backdrop" @click.self="pageDialogOpen = false">
            <form class="publisher-page-dialog" @submit.prevent="addPage">
                <header>
                    <div><span>Dokument</span><h2>Neue Seite</h2></div>
                    <button type="button" aria-label="Dialog schließen" @click="pageDialogOpen = false">×</button>
                </header>
                <label class="inspector-field">
                    Format
                    <select v-model="newPagePreset" @change="updateNewPagePreset">
                        <option v-for="preset in pageSizePresets" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
                        <option value="custom">Benutzerdefiniert</option>
                    </select>
                </label>
                <div class="publisher-page-dialog__dimensions">
                    <label class="inspector-field">Breite in Pixeln<input v-model.number="newPageWidth" type="number" min="64" max="8192" @input="newPagePreset = 'custom'" /></label>
                    <label class="inspector-field">Höhe in Pixeln<input v-model.number="newPageHeight" type="number" min="64" max="8192" @input="newPagePreset = 'custom'" /></label>
                </div>
                <p v-if="pageCreationError" class="local-draft__error" role="alert">{{ pageCreationError }}</p>
                <footer><button type="button" class="button button--secondary" @click="pageDialogOpen = false">Abbrechen</button><button type="submit" class="button">Seite anlegen</button></footer>
            </form>
        </div>

        <section ref="workspaceRef" class="publisher-workspace" @wheel="handleWorkspaceWheel">
            <div v-if="appointmentDetailsPending" class="publisher-workspace__empty" role="status">Termindetails werden geladen …</div>
            <div v-else-if="appointmentDetailsError" class="publisher-workspace__empty publisher-workspace__empty--error" role="alert">Die Termindetails konnten nicht geladen werden.</div>
            <div v-else-if="!templateProps" class="publisher-workspace__empty">
                <div class="publisher-workspace__empty-icon"><FontAwesomeIcon :icon="faCalendarDays" aria-hidden="true" /></div>
                <h1>Erste Seite anlegen</h1>
                <p>Wähle einen Termin aus ChurchTools. Die Seite wird anschließend direkt auf der Arbeitsfläche angezeigt.</p>
                <button type="button" class="button" @click="appointmentDialogOpen = true; activeEditorTool = 'appointments'">Termin auswählen</button>
            </div>
            <template v-else>
                <div class="publisher-workspace__canvas">
                    <p v-if="imageStatus === 'error'" class="status-message status-message--warning publisher-workspace__message" role="status">Das Veranstaltungsbild konnte nicht geladen werden. Die Fallback-Fläche wird verwendet.</p>
                    <p v-if="exportError" class="status-message status-message--error publisher-workspace__message" role="alert">{{ exportError }}</p>
                    <p v-if="exportSuccess" class="status-message status-message--success publisher-workspace__message" role="status">{{ exportSuccess }}</p>
                    <article
                        v-for="(page, pageIndex) in pages"
                        :key="page.id"
                        class="publisher-artboard"
                        :class="{ 'is-active': activePageId === page.id }"
                        @mousedown.capture="activatePage(page.id)"
                    >
                        <header><span>Seite {{ pageIndex + 1 }}</span><strong>{{ page.width }} × {{ page.height }} px</strong></header>
                    <EventTemplate
                            :ref="(instance) => setPageTemplateRef(page.id, instance)"
                            :document-height="page.height"
                            :document-width="page.width"
                            :draft-id="`${selectedAppointmentKey}:${page.id}:${draftRevision}`"
                            :image-focus="page.imageFocus[page.templateId]"
                            :initial-layouts="page.layouts"
                            :preview-zoom="workspaceZoomScale"
                        :template="templateProps"
                            :template-id="page.templateId"
                        :snap-enabled="snapEnabled"
                            @image-status="page.id === activePageId && (imageStatus = $event)"
                            @history-change="(canUndo, canRedo) => page.id === activePageId && updateLayoutHistory(canUndo, canRedo)"
                            @available-elements-change="page.id === activePageId && (availableLayoutElements = $event)"
                            @layer-position-change="(position, total) => page.id === activePageId && updateLayerPosition(position, total)"
                            @layout-change="page.id === activePageId && (layoutChanged = $event)"
                            @layout-state-change="(templateId, state) => updatePageDraftLayout(page.id, templateId, state)"
                            @selection-change="page.id === activePageId && (selectedLayoutElement = $event)"
                            @selection-ids-change="page.id === activePageId && (selectedLayoutElements = $event)"
                            @selection-group-change="(canGroup, canUngroup, depth) => page.id === activePageId && updateLayoutGrouping(canGroup, canUngroup, depth)"
                            @selection-default-change="page.id === activePageId && (selectedLayoutElementChanged = $event)"
                            @selection-geometry-change="page.id === activePageId && (selectedLayoutGeometry = $event)"
                            @selection-style-change="page.id === activePageId && (selectedLayoutStyle = $event)"
                            @selection-visual-style-change="page.id === activePageId && (selectedLayoutVisualStyle = $event)"
                    />
                    </article>
                </div>
            </template>
        </section>

        <template #right>
            <aside class="publisher-inspector" :aria-label="`${activeEditorToolLabel}-Einstellungen`">
                <header class="publisher-panel-heading publisher-inspector__heading">
                    <div>
                        <span>Eigenschaften</span>
                        <h2>{{ activeEditorToolLabel }}</h2>
                    </div>
                </header>

                <section v-if="activeEditorTool === 'templates'" id="templates-editor" class="publisher-inspector__content">
                    <div class="inspector-section">
                        <h3>Standardvorlagen</h3>
                        <p>Die bisherigen Designs sind Startpunkte für eine eigene Vorlage.</p>
                        <div class="standard-template-list">
                            <button v-for="option in TEMPLATE_OPTIONS" :key="option.id" type="button" :class="{ 'is-active': selectedTemplateId === option.id && !selectedDesignTemplateId }" @click="applyStandardTemplate(option.id)">
                                <span :class="`is-${option.id}`" aria-hidden="true" /><strong>{{ option.label }}</strong><small>Auf aktive Seite anwenden</small>
                            </button>
                        </div>
                    </div>
                    <div class="inspector-section">
                        <h3>Meine Vorlagen</h3>
                        <p>Speichert nur die Gestaltung. Beim nächsten Termin werden dessen Inhalte eingesetzt.</p>
                        <form class="design-template-create" @submit.prevent="persistCurrentDesignAsTemplate()">
                            <label class="inspector-field">
                                Vorlagenname
                                <input
                                    v-model="designTemplateName"
                                    :maxlength="MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH"
                                    placeholder="z. B. Sonntagsfolie"
                                />
                            </label>
                            <button type="submit" class="button">Aktuelles Layout speichern</button>
                        </form>
                        <p v-if="designTemplateStatus" class="local-draft__status" role="status">{{ designTemplateStatus }}</p>
                        <p v-if="designTemplateError" class="local-draft__error" role="alert">{{ designTemplateError }}</p>
                        <div v-if="designTemplates.length" class="design-template-list" aria-label="Gespeicherte Vorlagen">
                            <article
                                v-for="designTemplate in designTemplates"
                                :key="designTemplate.id"
                                :class="{ 'is-active': selectedDesignTemplateId === designTemplate.id }"
                            >
                                <div>
                                    <strong>{{ designTemplate.name }}</strong>
                                    <small>{{ TEMPLATE_OPTIONS.find(({ id }) => id === designTemplate.baseTemplateId)?.label }}</small>
                                </div>
                                <span v-if="selectedDesignTemplateId === designTemplate.id" class="design-template-list__active">Aktiv</span>
                                <div class="design-template-list__actions">
                                    <button type="button" @click="applyDesignTemplate(designTemplate)">Anwenden</button>
                                    <button type="button" @click="persistCurrentDesignAsTemplate(designTemplate)">Aktualisieren</button>
                                    <button type="button" class="is-danger" @click="removeDesignTemplate(designTemplate)">Löschen</button>
                                </div>
                            </article>
                        </div>
                        <p v-else class="inspector-empty">Noch keine eigenen Vorlagen gespeichert.</p>
                    </div>
                    <div class="inspector-section">
                        <h3>Lokaler Entwurf</h3>
                        <p>Änderungen werden automatisch in diesem Browser gespeichert.</p>
                        <p v-if="draftStatus" class="local-draft__status" role="status">{{ draftStatus }}</p>
                        <p v-if="draftError" class="local-draft__error" role="alert">{{ draftError }}</p>
                        <div class="inspector-action-stack">
                            <button type="button" class="button button--secondary" @click="exportDraftFile">Entwurf herunterladen</button>
                            <label class="button button--secondary local-draft__import">Entwurf importieren<input type="file" accept="application/json,.json" @change="importDraftFile" /></label>
                            <button type="button" class="button button--secondary" :disabled="!hasLocalDraft" @click="deleteLocalDraft">Entwurf löschen</button>
                        </div>
                    </div>
                </section>

                <form v-else-if="activeEditorTool === 'content'" id="content-editor" class="publisher-inspector__content" @submit.prevent>
                    <div class="inspector-section">
                        <h3>Textinhalt</h3>
                        <p>Die Änderungen gelten nur für diesen Entwurf.</p>
                        <div class="inspector-fields">
                            <label class="inspector-field">Titel<textarea rows="3" :value="templateFieldValue('title')" @input="updateTemplateOverride('title', $event)" /></label>
                            <button v-if="templateOverrides.title !== undefined" type="button" class="inspector-link" @click="resetTemplateOverride('title')">Originaltitel wiederherstellen</button>
                            <label class="inspector-field">Datum<input :value="templateFieldValue('date')" @input="updateTemplateOverride('date', $event)" /></label>
                            <button v-if="templateOverrides.date !== undefined" type="button" class="inspector-link" @click="resetTemplateOverride('date')">Originaldatum wiederherstellen</button>
                            <label class="inspector-field">Uhrzeit<input :value="templateFieldValue('time')" @input="updateTemplateOverride('time', $event)" /></label>
                            <button v-if="templateOverrides.time !== undefined" type="button" class="inspector-link" @click="resetTemplateOverride('time')">Originalzeit wiederherstellen</button>
                            <label class="inspector-field">Ort<input :value="templateFieldValue('location')" @input="updateTemplateOverride('location', $event)" /></label>
                            <button v-if="templateOverrides.location !== undefined" type="button" class="inspector-link" @click="resetTemplateOverride('location')">Originalort wiederherstellen</button>
                        </div>
                    </div>
                </form>

                <section v-else-if="activeEditorTool === 'image'" id="image-editor" class="publisher-inspector__content">
                    <div class="inspector-section">
                        <h3>Bildquelle</h3>
                        <label class="inspector-field">Veranstaltungsbild<input type="file" accept="image/jpeg,image/png,image/webp" @change="updateReplacementImage" /></label>
                        <p>JPEG, PNG oder WebP bis 20 MB. Das Bild bleibt lokal.</p>
                        <p v-if="replacementImageName" class="local-image-override__selection" role="status">{{ replacementImageName }}</p>
                        <p v-if="replacementImageError" class="local-image-override__error" role="alert">{{ replacementImageError }}</p>
                        <button v-if="replacementImageUrl" type="button" class="inspector-link" @click="revokeReplacementImage()">Originalbild wiederherstellen</button>
                    </div>
                    <div v-if="templateProps?.imageUrl" class="inspector-section">
                        <h3>Bildausschnitt</h3>
                        <div class="inspector-range-fields">
                            <label>Horizontal <output>{{ imageFocusByTemplate[selectedTemplateId].x }} %</output><input type="range" min="0" max="100" :value="imageFocusByTemplate[selectedTemplateId].x" @input="updateImageFocus('x', $event)" /></label>
                            <label>Vertikal <output>{{ imageFocusByTemplate[selectedTemplateId].y }} %</output><input type="range" min="0" max="100" :value="imageFocusByTemplate[selectedTemplateId].y" @input="updateImageFocus('y', $event)" /></label>
                            <label>Zoom <output>{{ imageFocusByTemplate[selectedTemplateId].zoom }} %</output><input type="range" min="100" max="300" step="5" :value="imageFocusByTemplate[selectedTemplateId].zoom" @input="updateImageFocus('zoom', $event)" /></label>
                        </div>
                    </div>
                </section>

                <section v-else-if="activeEditorTool === 'layout'" id="layout-editor" class="publisher-inspector__content publisher-inspector__content--layout">
                    <div class="inspector-fixed-block inspector-fixed-block--appearance">
                        <div class="inspector-subtabs">
                            <button type="button" :class="{ 'is-active': activeAppearanceTab === 'fill' }" @click="activeAppearanceTab = 'fill'">Farbe</button>
                            <button type="button" :class="{ 'is-active': activeAppearanceTab === 'stroke' }" @click="activeAppearanceTab = 'stroke'">Kontur</button>
                        </div>
                        <div class="inspector-fixed-block__scroll">
                        <template v-if="activeAppearanceTab === 'fill'">
                            <label v-if="selectedLayoutStyle || selectedLayoutVisualStyle" class="inspector-color-field">
                                <input v-if="selectedLayoutStyle" type="color" aria-label="Textfarbe" :value="selectedLayoutStyle.color" @input="updateSelectedTextStyle('color', $event)" />
                                <input v-else type="color" aria-label="Füllfarbe" :value="selectedLayoutVisualStyle!.fill" @input="updateSelectedVisualStyle('fill', $event)" />
                                <span><strong>{{ selectedLayoutStyle ? 'Textfarbe' : 'Füllfarbe' }}</strong><small>{{ (selectedLayoutStyle?.color ?? selectedLayoutVisualStyle?.fill)?.toUpperCase() }}</small></span>
                            </label>
                            <p v-else-if="selectedLayoutElement === 'image'" class="inspector-empty">Der Bildausschnitt bleibt proportional. Weitere Einstellungen findest du im Bild-Werkzeug.</p>
                            <p v-else class="inspector-empty">Wähle Text oder eine Form, um die Farbe zu bearbeiten.</p>
                            <div class="inspector-swatches" aria-label="Farbfelder">
                                <button v-for="color in ['#FFFFFF', '#E9EEF4', '#17202A', '#2768AD', '#69A7E8', '#22A06B', '#F5A623', '#D64545']" :key="color" type="button" :style="{ backgroundColor: color }" :title="color" :disabled="!selectedLayoutStyle && !selectedLayoutVisualStyle" @click="selectedLayoutStyle ? templateRef?.setSelectedElementTextStyle('color', color) : templateRef?.setSelectedElementVisualStyle('fill', color)" />
                            </div>
                        </template>
                        <template v-else>
                            <template v-if="selectedLayoutVisualStyle">
                                <label class="inspector-color-field"><input type="color" aria-label="Konturfarbe" :value="selectedLayoutVisualStyle.stroke" @input="updateSelectedVisualStyle('stroke', $event)" /><span><strong>Konturfarbe</strong><small>{{ selectedLayoutVisualStyle.stroke.toUpperCase() }}</small></span></label>
                                <label class="inspector-field">Konturstärke<input type="number" min="0" max="100" step="1" :value="selectedLayoutVisualStyle.strokeWidth" @input="updateSelectedVisualStyle('strokeWidth', $event)" /></label>
                            </template>
                            <p v-else class="inspector-empty">Wähle eine Form, um ihre Kontur zu bearbeiten.</p>
                        </template>
                        </div>
                    </div>

                    <div class="inspector-fixed-block inspector-fixed-block--content">
                        <div class="inspector-subtabs" role="tablist" aria-label="Text und Ebenen">
                            <button type="button" role="tab" :aria-selected="activeLayoutInspectorTab === 'text'" :class="{ 'is-active': activeLayoutInspectorTab === 'text' }" @click="activeLayoutInspectorTab = 'text'">Text</button>
                            <button type="button" role="tab" :aria-selected="activeLayoutInspectorTab === 'paragraph'" :class="{ 'is-active': activeLayoutInspectorTab === 'paragraph' }" @click="activeLayoutInspectorTab = 'paragraph'">Absatz</button>
                            <button type="button" role="tab" :aria-selected="activeLayoutInspectorTab === 'layers'" :class="{ 'is-active': activeLayoutInspectorTab === 'layers' }" @click="activeLayoutInspectorTab = 'layers'">Ebenen</button>
                        </div>
                        <div class="inspector-fixed-block__scroll">
                        <template v-if="activeLayoutInspectorTab === 'text'">
                            <template v-if="selectedLayoutStyle">
                                <label class="inspector-field">Schriftgröße<input type="number" min="12" max="240" step="1" :value="selectedLayoutStyle.fontSize" @blur="restoreSelectedFontSizeInput" @input="updateSelectedTextStyle('fontSize', $event)" /></label>
                                <label class="inspector-field">Schriftart<select :value="selectedLayoutStyle.fontFamily" @change="updateSelectedTextStyle('fontFamily', $event)"><option value="Lato, Arial, sans-serif">Lato</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Courier New</option></select></label>
                                <label class="inspector-field">Schriftschnitt<select :value="selectedLayoutStyle.fontStyle" @change="updateSelectedTextStyle('fontStyle', $event)"><option value="normal">Normal</option><option value="bold">Fett</option><option value="italic">Kursiv</option><option value="bold italic">Fett kursiv</option></select></label>
                                <label class="inspector-field">Zeichenabstand<input type="number" min="-20" max="100" step="1" :value="selectedLayoutStyle.letterSpacing" @input="updateSelectedTextStyle('letterSpacing', $event)" /></label>
                                <p v-if="hasMultipleLayoutSelection" class="inspector-note">Änderungen gelten für alle ausgewählten Elemente.</p>
                            </template>
                            <p v-else class="inspector-empty">Wähle ein Textelement, um die Zeichenformatierung zu bearbeiten.</p>
                        </template>
                        <template v-else-if="activeLayoutInspectorTab === 'paragraph'">
                            <template v-if="selectedLayoutStyle">
                                <label class="inspector-field">Zeilenhöhe<input type="number" min="0.5" max="3" step="0.1" :value="selectedLayoutStyle.lineHeight" @input="updateSelectedTextStyle('lineHeight', $event)" /></label>
                                <label class="inspector-field">Ausrichtung<select :value="selectedLayoutStyle.align" @change="updateSelectedTextStyle('align', $event)"><option value="left">Linksbündig</option><option value="center">Zentriert</option><option value="right">Rechtsbündig</option></select></label>
                                <label class="inspector-field">Liste<select :value="selectedLayoutStyle.listStyle" @change="updateSelectedTextStyle('listStyle', $event)"><option value="none">Keine Liste</option><option value="bullet">Aufzählung</option><option value="numbered">Nummerierung</option></select></label>
                            </template>
                            <p v-else class="inspector-empty">Wähle ein Textelement, um die Absatzformatierung zu bearbeiten.</p>
                        </template>
                        <template v-else>
                        <LayoutLayerTree
                            class="inspector-layer-list"
                            aria-label="Ebenenliste"
                            :element-labels="layoutElementLabels"
                            :nodes="layoutLayerTree"
                            :selected-element-ids="selectedLayoutElements"
                            @delete-elements="deleteLayoutElements"
                            @drill-into-element="templateRef?.drillIntoElement($event)"
                            @select-element="selectLayoutElement"
                            @select-group="selectLayoutGroup"
                        />
                        <div v-if="selectedLayoutElement && !hasMultipleLayoutSelection" class="inspector-inline-actions">
                            <span>Ebene {{ selectedLayerPosition }} / {{ selectedLayerTotal }}</span>
                            <button type="button" :disabled="selectedLayerPosition <= 1" @click="changeSelectedLayer(-1)">Nach hinten</button>
                            <button type="button" :disabled="selectedLayerPosition >= selectedLayerTotal" @click="changeSelectedLayer(1)">Nach vorne</button>
                        </div>
                        <div v-if="hasLayoutSelection" class="inspector-inline-actions">
                            <button type="button" :disabled="!canGroupLayoutSelection" @click="templateRef?.groupSelectedElements()">Gruppieren</button>
                            <button type="button" :disabled="!canUngroupLayoutSelection" @click="templateRef?.ungroupSelectedElements()">Gruppe lösen</button>
                        </div>
                        </template>
                        </div>
                    </div>

                    <div class="inspector-fixed-block inspector-fixed-block--transform">
                        <div class="inspector-fixed-block__title">Transformieren</div>
                        <div class="inspector-fixed-block__scroll">
                        <h3>Transformieren</h3>
                        <div v-if="selectedLayoutGeometry" class="inspector-transform-grid">
                            <label v-for="field in layoutGeometryFields" :key="field.id">{{ field.label }}<input type="number" step="1" :value="Math.round(selectedLayoutGeometry[field.id])" @blur="restoreSelectedLayoutGeometryInput(field.id, $event)" @input="updateSelectedLayoutGeometry(field.id, $event)" /></label>
                        </div>
                        <p v-else class="inspector-empty">Keine Auswahl</p>
                        <button type="button" class="button button--secondary" :disabled="!layoutChanged" @click="resetLayout">Gesamtes Layout zurücksetzen</button>
                        </div>
                    </div>
                </section>

                <section v-else class="publisher-inspector__content">
                    <div class="inspector-section">
                        <h3>Terminauswahl</h3>
                        <p>Öffne die Terminauswahl, um ein Dokument anzulegen oder den aktuellen Termin zu wechseln.</p>
                        <button type="button" class="button" @click="appointmentDialogOpen = true">Termin auswählen</button>
                    </div>
                </section>
            </aside>
        </template>

        <template #statusbar>
            <div class="publisher-statusbar">
                <span>{{ templateProps ? `${templateProps.title} · Seite ${pages.indexOf(activePage) + 1} · ${activePage.width} × ${activePage.height} px` : 'Kein Termin ausgewählt' }}</span>
                <span>{{ hasLayoutSelection ? `${selectedLayoutElements.length} Element${selectedLayoutElements.length === 1 ? '' : 'e'} ausgewählt` : `${previewZoomPercent} %` }}</span>
            </div>
        </template>
    </PublisherEditorShell>
</template>
