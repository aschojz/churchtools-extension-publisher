import type { SerializableLayoutState } from './layoutHistory';
import { createImageFocusByTemplate, type ImageFocusByTemplate } from './imageFocus';
import {
    createLayoutTextStyles,
    isHexColor,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
    type LayoutElementId,
    type LayoutTextStyles,
} from './layoutEditing';
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
    imageFocus: ImageFocusByTemplate;
    snapEnabled: boolean;
    previewZoomPercent: number;
    updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const parseLayoutStyles = (value: unknown, templateId: TemplateId): LayoutTextStyles | null => {
    if (value === undefined) {
        return createLayoutTextStyles(templateId);
    }
    if (!isRecord(value)) {
        return null;
    }

    const styles = createLayoutTextStyles(templateId);
    for (const elementId of ['title', 'dateTime', 'location'] as const) {
        const style = value[elementId];
        if (!isRecord(style) || !isFiniteNumber(style.fontSize) ||
            style.fontSize < MIN_FONT_SIZE || style.fontSize > MAX_FONT_SIZE ||
            typeof style.color !== 'string' || !isHexColor(style.color)) {
            return null;
        }
        styles[elementId] = { fontSize: style.fontSize, color: style.color.toLowerCase() };
    }
    return styles;
};

const parseLayoutState = (value: unknown, templateId: TemplateId): SerializableLayoutState | null => {
    if (!isRecord(value) || !isRecord(value.offsets) || !isRecord(value.sizes) ||
        !isRecord(value.rotations) || !Array.isArray(value.order)) {
        return null;
    }

    const offsets = value.offsets;
    const sizes = value.sizes;
    const rotations = value.rotations;
    const order = value.order;
    const elementIds = ['title', 'dateTime', 'location'] as const;
    const geometryIsValid = elementIds.every((elementId) => {
        const offset = offsets[elementId];
        const size = sizes[elementId];
        return isRecord(offset) && isFiniteNumber(offset.x) && isFiniteNumber(offset.y) &&
            isRecord(size) && isFiniteNumber(size.width) && isFiniteNumber(size.height) &&
            isFiniteNumber(rotations[elementId]);
    }) && order.length === elementIds.length &&
        elementIds.every((elementId) => order.includes(elementId));
    const styles = parseLayoutStyles(value.styles, templateId);
    if (!geometryIsValid || !styles) {
        return null;
    }

    return {
        offsets: offsets as SerializableLayoutState['offsets'],
        sizes: sizes as SerializableLayoutState['sizes'],
        rotations: rotations as SerializableLayoutState['rotations'],
        order: order as LayoutElementId[],
        styles,
    };
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

const parseImageFocus = (value: unknown): ImageFocusByTemplate | null => {
    if (value === undefined) {
        return createImageFocusByTemplate();
    }
    if (!isRecord(value)) {
        return null;
    }

    const focus = createImageFocusByTemplate();
    for (const templateId of ['split', 'poster'] as const) {
        const templateFocus = value[templateId];
        const zoom = isRecord(templateFocus) && templateFocus.zoom === undefined
            ? 100
            : isRecord(templateFocus) ? templateFocus.zoom : undefined;
        if (!isRecord(templateFocus) || !isFiniteNumber(templateFocus.x) ||
            !isFiniteNumber(templateFocus.y) || templateFocus.x < 0 || templateFocus.x > 100 ||
            templateFocus.y < 0 || templateFocus.y > 100 || !isFiniteNumber(zoom) ||
            zoom < 100 || zoom > 300) {
            return null;
        }
        focus[templateId] = { x: templateFocus.x, y: templateFocus.y, zoom };
    }
    return focus;
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
        const imageFocus = parseImageFocus(parsed.imageFocus);
        if (!templateOverrides || !imageFocus) {
            return null;
        }
        const layouts: PublisherDraft['layouts'] = {};
        for (const templateId of ['split', 'poster'] as const) {
            const layoutValue = parsed.layouts[templateId];
            const layout = parseLayoutState(layoutValue, templateId);
            if (layoutValue !== undefined && !layout) {
                return null;
            }
            if (layout) {
                layouts[templateId] = layout;
            }
        }

        return {
            version: PUBLISHER_DRAFT_VERSION,
            selectedTemplateId: parsed.selectedTemplateId,
            templateOverrides,
            layouts,
            imageFocus,
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

export const findPublisherDraftAppointmentKeys = (
    storage: Pick<Storage, 'getItem'>,
    appointmentKeys: Iterable<string>,
) => new Set(
    [...appointmentKeys].filter((appointmentKey) =>
        Boolean(loadPublisherDraft(storage, appointmentKey)),
    ),
);

export const savePublisherDraft = (
    storage: Pick<Storage, 'setItem'>,
    appointmentKey: string,
    draft: PublisherDraft,
) => storage.setItem(publisherDraftStorageKey(appointmentKey), JSON.stringify(draft));

export const deletePublisherDraft = (storage: Pick<Storage, 'removeItem'>, appointmentKey: string) =>
    storage.removeItem(publisherDraftStorageKey(appointmentKey));
