<script setup lang="ts">
import type { AppointmentCalculatedWithIncludes } from '@churchtools/api-types';
import { useAppointmentQuery, useCalendarsQuery } from '@churchtools/vue-query';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import EventTemplate from './components/EventTemplate.vue';
import PublisherEditorShell from './components/PublisherEditorShell.vue';
import { useAppointmentsQuery } from './composables/useAppointmentsQuery';
import { isAppointmentWithinDays, matchesAppointmentFilters } from './domain/appointmentFilters';
import { resolveEditorShortcut } from './domain/editorShortcuts';
import { createImageFocusByTemplate, type ImageFocus } from './domain/imageFocus';
import { mapAppointmentToTemplateProps } from './domain/mapAppointmentToTemplateProps';
import type {
    LayoutAlignment,
    LayoutElementId,
    LayoutGeometry,
    LayoutTextStyle,
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
const appointmentFilterReferenceDate = new Date();
const templateRef = ref<InstanceType<typeof EventTemplate> | null>(null);
const imageStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');
const exportError = ref('');
const exportSuccess = ref('');
const templateOverrides = ref<EventTemplateOverrides>({});
const replacementImageUrl = ref<string | null>(null);
const replacementImageName = ref('');
const replacementImageError = ref('');
const selectedTemplateId = ref<TemplateId>('split');
const layoutChanged = ref(false);
const canUndoLayout = ref(false);
const canRedoLayout = ref(false);
const selectedLayoutElement = ref<LayoutElementId | null>(null);
const selectedLayoutElements = ref<LayoutElementId[]>([]);
const selectedLayoutGeometry = ref<(LayoutGeometry & { elementId: LayoutElementId }) | null>(null);
const selectedLayoutStyle = ref<(LayoutTextStyle & { elementId: LayoutElementId }) | null>(null);
const selectedLayoutElementChanged = ref(false);
const canGroupLayoutSelection = ref(false);
const canUngroupLayoutSelection = ref(false);
const selectedLayoutGroupDepth = ref(0);
const selectedLayerPosition = ref(0);
const selectedLayerTotal = ref(0);
const snapEnabled = ref(true);
const previewZoomPercent = ref(100);
const previewZoomOptions = [50, 75, 100, 125, 150, 200] as const;
const draftLayouts = ref<Partial<Record<TemplateId, SerializableLayoutState>>>({});
const draftRevision = ref(0);
const draftStatus = ref('');
const draftError = ref('');
const hasLocalDraft = ref(false);
const restoringDraft = ref(false);
const draftIndexRevision = ref(0);
const imageFocusByTemplate = ref(createImageFocusByTemplate());
const layoutStep = computed(() => (snapEnabled.value ? 20 : 5));
const rotationStep = computed(() => (snapEnabled.value ? 15 : 5));
const hasLayoutSelection = computed(() => selectedLayoutElements.value.length > 0);
const hasMultipleLayoutSelection = computed(() => selectedLayoutElements.value.length > 1);
const layoutElementLabels: Record<LayoutElementId, string> = {
    title: 'Titel',
    dateTime: 'Datum/Uhrzeit',
    location: 'Ort',
};
const layoutGeometryFields: { id: keyof LayoutGeometry; label: string }[] = [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'width', label: 'Breite' },
    { id: 'height', label: 'Höhe' },
    { id: 'rotation', label: 'Drehung' },
];

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
        selectedTemplateId.value = draft?.selectedTemplateId ?? 'split';
        draftLayouts.value = draft?.layouts ?? {};
        imageFocusByTemplate.value = draft?.imageFocus ?? createImageFocusByTemplate();
        snapEnabled.value = draft?.snapEnabled ?? true;
        previewZoomPercent.value = draft?.previewZoomPercent ?? 100;
        hasLocalDraft.value = Boolean(draft);
        draftStatus.value = draft ? 'Lokaler Entwurf geladen.' : '';
        draftError.value = '';
    } catch {
        templateOverrides.value = {};
        draftLayouts.value = {};
        imageFocusByTemplate.value = createImageFocusByTemplate();
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

watch([snapEnabled, previewZoomPercent], saveCurrentDraft);

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

const updateDraftLayout = (templateId: TemplateId, state: SerializableLayoutState) => {
    draftLayouts.value = { ...draftLayouts.value, [templateId]: cloneLayoutState(state) };
    saveCurrentDraft();
};

const deleteLocalDraft = () => {
    if (!selectedAppointmentKey.value) {
        return;
    }

    restoringDraft.value = true;
    try {
        deletePublisherDraft(window.localStorage, selectedAppointmentKey.value);
        templateOverrides.value = {};
        selectedTemplateId.value = 'split';
        draftLayouts.value = {};
        imageFocusByTemplate.value = createImageFocusByTemplate();
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

const isTextEntryTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'));

const handleEditorShortcut = (event: KeyboardEvent) => {
    if (isTextEntryTarget(event.target)) {
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
    revokeReplacementImage(false);
});

const resizeLayoutElement = (deltaWidth: number, deltaHeight: number) => {
    templateRef.value?.resizeSelectedElement(deltaWidth, deltaHeight);
};

const rotateLayoutElement = (deltaRotation: number) => {
    templateRef.value?.rotateSelectedElement(deltaRotation);
};

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
    const value = field === 'fontSize' ? input.valueAsNumber : input.value;
    templateRef.value?.setSelectedElementTextStyle(field, value);
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
        selectedTemplateId.value = imported.draft.selectedTemplateId;
        draftLayouts.value = Object.fromEntries(
            Object.entries(imported.draft.layouts).map(([templateId, state]) => [
                templateId,
                state ? cloneLayoutState(state) : state,
            ]),
        );
        imageFocusByTemplate.value = {
            split: { ...imported.draft.imageFocus.split },
            poster: { ...imported.draft.imageFocus.poster },
        };
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

        if (exportedSize.width !== 1920 || exportedSize.height !== 1080) {
            throw new Error(`Unerwartete Exportgröße: ${exportedSize.width} × ${exportedSize.height} Pixel.`);
        }

        const downloadUrl = URL.createObjectURL(pngBlob);
        const download = document.createElement('a');
        download.href = downloadUrl;
        download.download = `veranstaltung-${selectedAppointmentId.value}-${slugify(templateProps.value.title) || 'termin'}.png`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
        exportSuccess.value = 'PNG mit 1920 × 1080 Pixeln wurde erstellt.';
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
                    <strong>{{ selectedAppointment?.appointment.base.title ?? 'Kein Termin gewählt' }}</strong>
                </div>
                <div class="publisher-topbar__actions" role="toolbar" aria-label="Globale Aktionen">
                    <button
                        type="button"
                        class="publisher-topbar__icon-button"
                        title="Rückgängig"
                        aria-label="Rückgängig"
                        :disabled="!canUndoLayout"
                        @click="undoLayout"
                    >
                        ↶
                    </button>
                    <button
                        type="button"
                        class="publisher-topbar__icon-button"
                        title="Wiederholen"
                        aria-label="Wiederholen"
                        :disabled="!canRedoLayout"
                        @click="redoLayout"
                    >
                        ↷
                    </button>
                    <button
                        type="button"
                        class="publisher-topbar__export"
                        :disabled="!templateProps || imageStatus === 'loading'"
                        @click="exportPng"
                    >
                        {{ imageStatus === 'loading' ? 'Bild wird geladen …' : 'PNG exportieren' }}
                    </button>
                </div>
                <label class="theme-picker">
                    Darstellung
                    <select v-model="themePreference">
                        <option value="system">System</option>
                        <option value="light">Hell</option>
                        <option value="dark">Dunkel</option>
                    </select>
                </label>
            </div>
        </template>

        <section class="publisher-card">
            <header class="publisher-card__header">
                <div>
                    <p class="publisher-card__eyebrow">ChurchTools Publisher</p>
                    <h1>Publisher</h1>
                    <p>Wähle einen Kalendertermin für das spätere Testlayout aus.</p>
                </div>
            </header>

            <div class="appointment-picker">
                <p v-if="isLoading" class="status-message" role="status">Termine werden geladen …</p>

                <p v-else-if="loadingError" class="status-message status-message--error" role="alert">
                    Die Kalendertermine konnten nicht geladen werden. Prüfe Anmeldung und Berechtigungen.
                </p>

                <p v-else-if="sortedAppointments.length === 0" class="status-message" role="status">
                    In den nächsten zwölf Monaten wurden keine sichtbaren Termine gefunden.
                </p>

                <template v-else>
                    <div class="appointment-picker__filters">
                        <label>
                            Termine durchsuchen
                            <input
                                v-model="appointmentSearch"
                                type="search"
                                placeholder="Titel oder Kalender"
                            />
                        </label>
                        <label>
                            Kalender filtern
                            <select v-model="selectedCalendarFilter">
                                <option value="">Alle Kalender</option>
                                <option v-for="calendar in sortedCalendars" :key="calendar.id" :value="String(calendar.id)">
                                    {{ calendar.nameTranslated }}
                                </option>
                            </select>
                        </label>
                        <label>
                            Zeitraum
                            <select v-model="selectedAppointmentRange">
                                <option value="">Nächste 12 Monate</option>
                                <option value="30">Nächste 30 Tage</option>
                                <option value="90">Nächste 90 Tage</option>
                                <option value="365">Nächste 365 Tage</option>
                            </select>
                        </label>
                    </div>

                    <div class="appointment-picker__filter-summary">
                        <p class="appointment-picker__result-count" role="status">
                            <template v-if="filteredAppointments.length">
                                {{ filteredAppointments.length }} von {{ sortedAppointments.length }} Terminen
                            </template>
                            <template v-else>Keine passenden Termine gefunden.</template>
                        </p>
                        <div class="appointment-picker__filter-actions">
                            <label class="appointment-picker__draft-filter">
                                <input v-model="onlyAppointmentsWithDraft" type="checkbox" />
                                Nur Termine mit Entwurf
                            </label>
                            <button
                                v-if="hasAppointmentFilters"
                                type="button"
                                class="appointment-picker__reset"
                                @click="resetAppointmentFilters"
                            >
                                Filter zurücksetzen
                            </button>
                        </div>
                    </div>

                    <label for="appointment">Kalendertermin</label>
                    <select id="appointment" v-model="selectedAppointmentKey" :disabled="filteredAppointments.length === 0">
                        <option value="">Bitte Termin auswählen</option>
                        <option
                            v-for="appointment in filteredAppointments"
                            :key="appointmentKey(appointment)"
                            :value="appointmentKey(appointment)"
                        >
                            {{ appointmentLabel(appointment) }}
                        </option>
                    </select>
                </template>
            </div>

            <p v-if="appointmentDetailsPending" class="status-message template-status" role="status">
                Termindetails werden geladen …
            </p>

            <p v-else-if="appointmentDetailsError" class="status-message status-message--error template-status" role="alert">
                Die Termindetails konnten nicht geladen werden.
            </p>

            <section v-else-if="templateProps" class="template-section" aria-live="polite">
                <div class="template-picker">
                    <div>
                        <label for="template">Template</label>
                        <p>Das Template ändert nur die Gestaltung; Termin und Inhaltsanpassungen bleiben erhalten.</p>
                    </div>
                    <select id="template" v-model="selectedTemplateId">
                        <option v-for="option in TEMPLATE_OPTIONS" :key="option.id" :value="option.id">
                            {{ option.label }}
                        </option>
                    </select>
                </div>

                <div class="local-draft">
                    <div>
                        <strong>Lokaler Entwurf</strong>
                        <p>Text, Layout und Editoreinstellungen werden automatisch nur in diesem Browser gespeichert.</p>
                        <p v-if="draftStatus" class="local-draft__status" role="status">{{ draftStatus }}</p>
                        <p v-if="draftError" class="local-draft__error" role="alert">{{ draftError }}</p>
                    </div>
                    <div class="local-draft__actions">
                        <button type="button" class="button button--secondary" @click="exportDraftFile">
                            Entwurf herunterladen
                        </button>
                        <label class="button button--secondary local-draft__import">
                            Entwurf importieren
                            <input type="file" accept="application/json,.json" @change="importDraftFile" />
                        </label>
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!hasLocalDraft"
                            @click="deleteLocalDraft"
                        >
                            Lokalen Entwurf löschen
                        </button>
                    </div>
                </div>

                <form class="template-overrides" @submit.prevent>
                    <div class="template-overrides__header">
                        <div>
                            <h2>Inhalte anpassen</h2>
                            <p>Änderungen gelten nur für diesen Export und verändern den ChurchTools-Termin nicht.</p>
                        </div>
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!hasTemplateOverrides"
                            @click="resetTemplateOverrides"
                        >
                            Alle zurücksetzen
                        </button>
                    </div>

                    <div class="template-overrides__grid">
                        <div class="template-field template-field--wide">
                            <label for="override-title">Titel</label>
                            <textarea
                                id="override-title"
                                rows="2"
                                :value="templateFieldValue('title')"
                                @input="updateTemplateOverride('title', $event)"
                            />
                            <button
                                v-if="templateOverrides.title !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('title')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field">
                            <label for="override-date">Datum</label>
                            <input
                                id="override-date"
                                :value="templateFieldValue('date')"
                                @input="updateTemplateOverride('date', $event)"
                            />
                            <button
                                v-if="templateOverrides.date !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('date')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field">
                            <label for="override-time">Uhrzeit</label>
                            <input
                                id="override-time"
                                :value="templateFieldValue('time')"
                                @input="updateTemplateOverride('time', $event)"
                            />
                            <button
                                v-if="templateOverrides.time !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('time')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field template-field--wide">
                            <label for="override-location">Ort</label>
                            <input
                                id="override-location"
                                :value="templateFieldValue('location')"
                                @input="updateTemplateOverride('location', $event)"
                            />
                            <button
                                v-if="templateOverrides.location !== undefined"
                                type="button"
                                class="template-field__reset"
                                @click="resetTemplateOverride('location')"
                            >
                                Original wiederherstellen
                            </button>
                        </div>

                        <div class="template-field template-field--wide local-image-override">
                            <label for="override-image">Veranstaltungsbild</label>
                            <input
                                id="override-image"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                @change="updateReplacementImage"
                            />
                            <p class="template-field__help">
                                JPEG, PNG oder WebP bis 20 MB. Das Bild bleibt lokal und wird nicht zu ChurchTools hochgeladen.
                            </p>
                            <p v-if="replacementImageName" class="local-image-override__selection" role="status">
                                Lokales Bild: {{ replacementImageName }}
                            </p>
                            <p v-if="replacementImageError" class="local-image-override__error" role="alert">
                                {{ replacementImageError }}
                            </p>
                            <button
                                v-if="replacementImageUrl"
                                type="button"
                                class="template-field__reset"
                                @click="revokeReplacementImage()"
                            >
                                Originalbild wiederherstellen
                            </button>
                        </div>
                    </div>
                </form>

                <div v-if="templateProps.imageUrl" class="image-focus-controls">
                    <div class="image-focus-controls__header">
                        <div>
                            <h2>Bildausschnitt</h2>
                            <p>Verschiebe den Fokuspunkt des Cover-Zuschnitts für das aktuelle Template.</p>
                        </div>
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="imageFocusByTemplate[selectedTemplateId].x === 50 && imageFocusByTemplate[selectedTemplateId].y === 50 && imageFocusByTemplate[selectedTemplateId].zoom === 100"
                            @click="resetImageFocus"
                        >
                            Bildausschnitt zurücksetzen
                        </button>
                    </div>
                    <div class="image-focus-controls__sliders">
                        <label>
                            Horizontal
                            <input
                                type="range"
                                min="0"
                                max="100"
                                :value="imageFocusByTemplate[selectedTemplateId].x"
                                aria-label="Bildfokus horizontal"
                                @input="updateImageFocus('x', $event)"
                            />
                            <output>{{ imageFocusByTemplate[selectedTemplateId].x }} %</output>
                        </label>
                        <label>
                            Vertikal
                            <input
                                type="range"
                                min="0"
                                max="100"
                                :value="imageFocusByTemplate[selectedTemplateId].y"
                                aria-label="Bildfokus vertikal"
                                @input="updateImageFocus('y', $event)"
                            />
                            <output>{{ imageFocusByTemplate[selectedTemplateId].y }} %</output>
                        </label>
                        <label>
                            Zoom
                            <input
                                type="range"
                                min="100"
                                max="300"
                                step="5"
                                :value="imageFocusByTemplate[selectedTemplateId].zoom"
                                aria-label="Bildzoom"
                                @input="updateImageFocus('zoom', $event)"
                            />
                            <output>{{ imageFocusByTemplate[selectedTemplateId].zoom }} %</output>
                        </label>
                    </div>
                </div>

                <div class="layout-controls">
                    <div>
                        <h2>Layout anpassen</h2>
                        <p>Wähle ein oder mehrere Elemente aus. Strg/Cmd- oder Umschalt-Klick erweitert die Auswahl; auf freier Vorschaufläche kannst du einen Auswahlrahmen ziehen.</p>
                        <p class="layout-controls__shortcuts">
                            Tastatur: Pfeiltasten verschieben alle ausgewählten Elemente, Strg/Cmd+G gruppiert, Strg/Cmd+Umschalt+G hebt die ausgewählte Gruppenebene auf, Escape leert die Auswahl.
                        </p>
                        <label class="layout-controls__snap">
                            <input v-model="snapEnabled" type="checkbox" />
                            Am 20-Pixel-Raster und an 15°-Winkeln ausrichten
                        </label>
                        <p v-if="hasLayoutSelection" class="layout-controls__selection" role="status">
                            Ausgewählt{{ selectedLayoutGroupDepth ? ` · Gruppe Ebene ${selectedLayoutGroupDepth}` : '' }}:
                            {{ selectedLayoutElements.map((elementId) => layoutElementLabels[elementId]).join(', ') }}
                        </p>
                        <div v-if="hasLayoutSelection" class="layout-controls__grouping" aria-label="Elemente gruppieren">
                            <button
                                type="button"
                                :disabled="!canGroupLayoutSelection"
                                @click="templateRef?.groupSelectedElements()"
                            >
                                Gruppieren
                            </button>
                            <button
                                type="button"
                                :disabled="!canUngroupLayoutSelection"
                                @click="templateRef?.ungroupSelectedElements()"
                            >
                                Gruppenebene aufheben
                            </button>
                        </div>
                        <button
                            v-if="hasLayoutSelection"
                            type="button"
                            class="layout-controls__element-reset"
                            :disabled="!selectedLayoutElementChanged"
                            @click="resetSelectedLayoutElement"
                        >
                            {{ hasMultipleLayoutSelection ? 'Ausgewählte Elemente zurücksetzen' : 'Ausgewähltes Element zurücksetzen' }}
                        </button>
                        <div class="layout-controls__elements" aria-label="Layoutelement auswählen">
                            <button
                                v-for="(label, elementId) in layoutElementLabels"
                                :key="elementId"
                                type="button"
                                :aria-pressed="selectedLayoutElements.includes(elementId)"
                                :class="{ 'is-selected': selectedLayoutElements.includes(elementId) }"
                                @click="selectLayoutElement(elementId, $event)"
                                @dblclick="templateRef?.drillIntoElement(elementId)"
                            >
                                {{ label }}
                            </button>
                        </div>
                        <div v-if="hasLayoutSelection" class="layout-controls__directions" aria-label="Element verschieben">
                            <button type="button" aria-label="Nach links verschieben" @click="nudgeLayoutElement(-layoutStep, 0)">←</button>
                            <button type="button" aria-label="Nach oben verschieben" @click="nudgeLayoutElement(0, -layoutStep)">↑</button>
                            <button type="button" aria-label="Nach unten verschieben" @click="nudgeLayoutElement(0, layoutStep)">↓</button>
                            <button type="button" aria-label="Nach rechts verschieben" @click="nudgeLayoutElement(layoutStep, 0)">→</button>
                        </div>
                        <div v-if="hasLayoutSelection" class="layout-controls__sizes" aria-label="Elementgröße ändern">
                            <button type="button" @click="resizeLayoutElement(-layoutStep, 0)">Schmaler</button>
                            <button type="button" @click="resizeLayoutElement(layoutStep, 0)">Breiter</button>
                            <button type="button" @click="resizeLayoutElement(0, -layoutStep)">Flacher</button>
                            <button type="button" @click="resizeLayoutElement(0, layoutStep)">Höher</button>
                        </div>
                        <div v-if="hasLayoutSelection" class="layout-controls__rotations" aria-label="Element drehen">
                            <button type="button" @click="rotateLayoutElement(-rotationStep)">−{{ rotationStep }}° drehen</button>
                            <button type="button" @click="rotateLayoutElement(rotationStep)">+{{ rotationStep }}° drehen</button>
                        </div>
                        <fieldset v-if="selectedLayoutGeometry" class="layout-controls__geometry">
                            <legend>Exakte Werte</legend>
                            <label v-for="field in layoutGeometryFields" :key="field.id">
                                {{ field.label }}
                                <input
                                    type="number"
                                    step="1"
                                    :aria-label="`Exakter Wert: ${field.label}`"
                                    :value="Math.round(selectedLayoutGeometry[field.id])"
                                    @blur="restoreSelectedLayoutGeometryInput(field.id, $event)"
                                    @input="updateSelectedLayoutGeometry(field.id, $event)"
                                />
                            </label>
                        </fieldset>
                        <fieldset v-if="selectedLayoutStyle" class="layout-controls__style">
                            <legend>Typografie</legend>
                            <p v-if="hasMultipleLayoutSelection" class="layout-controls__multi-hint">
                                Änderungen werden auf alle ausgewählten Elemente angewendet.
                            </p>
                            <label>
                                Schriftgröße
                                <input
                                    type="number"
                                    min="12"
                                    max="240"
                                    step="1"
                                    aria-label="Schriftgröße"
                                    :value="selectedLayoutStyle.fontSize"
                                    @blur="restoreSelectedFontSizeInput"
                                    @input="updateSelectedTextStyle('fontSize', $event)"
                                />
                            </label>
                            <label>
                                Textfarbe
                                <input
                                    type="color"
                                    aria-label="Textfarbe"
                                    :value="selectedLayoutStyle.color"
                                    @input="updateSelectedTextStyle('color', $event)"
                                />
                            </label>
                        </fieldset>
                        <div v-if="hasLayoutSelection" class="layout-controls__alignment" aria-label="Element ausrichten">
                            <span>Ausrichten:</span>
                            <button type="button" aria-label="Links ausrichten" @click="alignLayoutElement('left')">Links</button>
                            <button type="button" aria-label="Horizontal zentrieren" @click="alignLayoutElement('horizontalCenter')">Mitte X</button>
                            <button type="button" aria-label="Rechts ausrichten" @click="alignLayoutElement('right')">Rechts</button>
                            <button type="button" aria-label="Oben ausrichten" @click="alignLayoutElement('top')">Oben</button>
                            <button type="button" aria-label="Vertikal zentrieren" @click="alignLayoutElement('verticalCenter')">Mitte Y</button>
                            <button type="button" aria-label="Unten ausrichten" @click="alignLayoutElement('bottom')">Unten</button>
                        </div>
                        <div v-if="selectedLayoutElement && !hasMultipleLayoutSelection" class="layout-controls__layers" aria-label="Ebenenreihenfolge ändern">
                            <span>Ebene {{ selectedLayerPosition }} von {{ selectedLayerTotal }}</span>
                            <button
                                type="button"
                                :disabled="selectedLayerPosition <= 1"
                                @click="changeSelectedLayer(-1)"
                            >
                                Nach hinten
                            </button>
                            <button
                                type="button"
                                :disabled="selectedLayerPosition >= selectedLayerTotal"
                                @click="changeSelectedLayer(1)"
                            >
                                Nach vorne
                            </button>
                        </div>
                    </div>
                    <div class="layout-controls__actions">
                        <button
                            type="button"
                            class="button button--secondary"
                            :disabled="!layoutChanged"
                            @click="resetLayout"
                        >
                            Layout zurücksetzen
                        </button>
                    </div>
                </div>

                <div class="template-section__header">
                    <div>
                        <p class="appointment-summary__label">Vorschau · 1920 × 1080 px</p>
                        <h2>{{ templateProps.title }}</h2>
                    </div>
                    <div class="template-section__actions">
                        <label class="preview-zoom" for="preview-zoom">
                            Vorschauzoom
                            <select id="preview-zoom" v-model.number="previewZoomPercent">
                                <option v-for="zoom in previewZoomOptions" :key="zoom" :value="zoom">
                                    {{ zoom }} %
                                </option>
                            </select>
                        </label>
                    </div>
                </div>

                <p v-if="imageStatus === 'error'" class="status-message status-message--warning" role="status">
                    Das Veranstaltungsbild konnte nicht geladen werden. Für Vorschau und Export wird die Fallback-Fläche verwendet.
                </p>
                <p v-if="exportError" class="status-message status-message--error" role="alert">{{ exportError }}</p>
                <p v-if="exportSuccess" class="status-message status-message--success" role="status">
                    {{ exportSuccess }}
                </p>

                <EventTemplate
                    ref="templateRef"
                    :draft-id="`${selectedAppointmentKey}:${draftRevision}`"
                    :image-focus="imageFocusByTemplate[selectedTemplateId]"
                    :initial-layouts="draftLayouts"
                    :preview-zoom="previewZoomPercent / 100"
                    :template="templateProps"
                    :template-id="selectedTemplateId"
                    :snap-enabled="snapEnabled"
                    @image-status="imageStatus = $event"
                    @history-change="updateLayoutHistory"
                    @layer-position-change="updateLayerPosition"
                    @layout-change="layoutChanged = $event"
                    @layout-state-change="updateDraftLayout"
                    @selection-change="selectedLayoutElement = $event"
                    @selection-ids-change="selectedLayoutElements = $event"
                    @selection-group-change="updateLayoutGrouping"
                    @selection-default-change="selectedLayoutElementChanged = $event"
                    @selection-geometry-change="selectedLayoutGeometry = $event"
                    @selection-style-change="selectedLayoutStyle = $event"
                />
            </section>
        </section>

        <template #statusbar>
            <div class="publisher-statusbar">
                <span>{{ templateProps ? `${templateProps.title} · 1920 × 1080 px` : 'Kein Termin ausgewählt' }}</span>
                <span>Aktive Sprache: {{ userLanguage }}</span>
            </div>
        </template>
    </PublisherEditorShell>
</template>
