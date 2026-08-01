import type { SerializableLayoutState } from './layoutHistory';
import type { EventTemplateOverrides } from './templateOverrides';
import type { TemplateId } from './templates';

export const PUBLISHER_DRAFT_VERSION = 1;
const SUPPORTED_PREVIEW_ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];
export const publisherDraftStorageKey = (appointmentKey: string) =>
    `churchtools-publisher:draft:${appointmentKey}`;

export interface PublisherDraft {
    version: typeof PUBLISHER_DRAFT_VERSION;
    selectedTemplateId: TemplateId;
    templateOverrides: EventTemplateOverrides;
    layouts: Partial<Record<TemplateId, SerializableLayoutState>>;
    snapEnabled: boolean;
    previewZoomPercent: number;
    updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isLayoutState = (value: unknown): value is SerializableLayoutState => {
    if (!isRecord(value) || !isRecord(value.offsets) || !isRecord(value.sizes) ||
        !isRecord(value.rotations) || !Array.isArray(value.order)) {
        return false;
    }

    const offsets = value.offsets;
    const sizes = value.sizes;
    const rotations = value.rotations;
    const order = value.order;
    const elementIds = ['title', 'dateTime', 'location'] as const;
    return elementIds.every((elementId) => {
        const offset = offsets[elementId];
        const size = sizes[elementId];
        return isRecord(offset) && isFiniteNumber(offset.x) && isFiniteNumber(offset.y) &&
            isRecord(size) && isFiniteNumber(size.width) && isFiniteNumber(size.height) &&
            isFiniteNumber(rotations[elementId]);
    }) && order.length === elementIds.length &&
        elementIds.every((elementId) => order.includes(elementId));
};

const parseTemplateOverrides = (value: unknown): EventTemplateOverrides | null => {
    if (!isRecord(value)) {
        return null;
    }

    const overrides: EventTemplateOverrides = {};
    for (const field of ['title', 'date', 'time', 'location'] as const) {
        const fieldValue = value[field];
        if (fieldValue !== undefined && typeof fieldValue !== 'string') {
            return null;
        }
        if (typeof fieldValue === 'string') {
            overrides[field] = fieldValue;
        }
    }
    return overrides;
};

export const parsePublisherDraft = (value: string | null): PublisherDraft | null => {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed) || parsed.version !== PUBLISHER_DRAFT_VERSION ||
            (parsed.selectedTemplateId !== 'split' && parsed.selectedTemplateId !== 'poster') ||
            typeof parsed.snapEnabled !== 'boolean' || !isFiniteNumber(parsed.previewZoomPercent) ||
            !SUPPORTED_PREVIEW_ZOOM_LEVELS.includes(parsed.previewZoomPercent) ||
            typeof parsed.updatedAt !== 'string' || !isRecord(parsed.layouts)) {
            return null;
        }
        const templateOverrides = parseTemplateOverrides(parsed.templateOverrides);
        if (!templateOverrides) {
            return null;
        }
        const layouts: PublisherDraft['layouts'] = {};
        for (const templateId of ['split', 'poster'] as const) {
            const layout = parsed.layouts[templateId];
            if (layout !== undefined && !isLayoutState(layout)) {
                return null;
            }
            if (isLayoutState(layout)) {
                layouts[templateId] = layout;
            }
        }

        return {
            version: PUBLISHER_DRAFT_VERSION,
            selectedTemplateId: parsed.selectedTemplateId,
            templateOverrides,
            layouts,
            snapEnabled: parsed.snapEnabled,
            previewZoomPercent: parsed.previewZoomPercent,
            updatedAt: parsed.updatedAt,
        };
    } catch {
        return null;
    }
};

export const loadPublisherDraft = (storage: Pick<Storage, 'getItem'>, appointmentKey: string) =>
    parsePublisherDraft(storage.getItem(publisherDraftStorageKey(appointmentKey)));

export const savePublisherDraft = (
    storage: Pick<Storage, 'setItem'>,
    appointmentKey: string,
    draft: PublisherDraft,
) => storage.setItem(publisherDraftStorageKey(appointmentKey), JSON.stringify(draft));

export const deletePublisherDraft = (storage: Pick<Storage, 'removeItem'>, appointmentKey: string) =>
    storage.removeItem(publisherDraftStorageKey(appointmentKey));
