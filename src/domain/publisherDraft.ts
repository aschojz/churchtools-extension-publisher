import type { SerializableLayoutState } from './layoutHistory';
import { createImageFocusByTemplate, type ImageFocusByTemplate } from './imageFocus';
import {
    createLayoutTextStyles,
    createLayoutOffsets,
    createLayoutOrder,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutVisualStyles,
    createLayoutGroups,
    isHexColor,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
    type LayoutElementId,
    type LayoutGroup,
    type LayoutGroups,
    type LayoutTextStyles,
    type LayoutVisualStyles,
    LAYOUT_ELEMENT_IDS,
    SHAPE_LAYOUT_ELEMENT_IDS,
} from './layoutEditing';
import type { EventTemplateOverrides } from './templateOverrides';
import type { TemplateId } from './templates';
import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';

export const PUBLISHER_DRAFT_VERSION = 1;
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
    pages?: PublisherDraftPage[];
    activePageId?: string;
}

export interface PublisherDraftPage {
    id: string;
    width: number;
    height: number;
    templateId: TemplateId;
    layouts: Partial<Record<TemplateId, SerializableLayoutState>>;
    imageFocus: ImageFocusByTemplate;
}

export const isPublisherRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const isPublisherFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isRecord = isPublisherRecord;
const isFiniteNumber = isPublisherFiniteNumber;

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
        const fontFamily = style.fontFamily ?? styles[elementId].fontFamily;
        const fontStyle = style.fontStyle ?? styles[elementId].fontStyle;
        const lineHeight = style.lineHeight ?? styles[elementId].lineHeight;
        const letterSpacing = style.letterSpacing ?? styles[elementId].letterSpacing;
        const align = style.align ?? styles[elementId].align;
        const listStyle = style.listStyle ?? styles[elementId].listStyle;
        if (typeof fontFamily !== 'string' || !fontFamily.trim() ||
            !['normal', 'bold', 'italic', 'bold italic'].includes(String(fontStyle)) ||
            !isFiniteNumber(lineHeight) || lineHeight < 0.5 || lineHeight > 3 ||
            !isFiniteNumber(letterSpacing) || letterSpacing < -20 || letterSpacing > 100 ||
            !['left', 'center', 'right'].includes(String(align)) ||
            !['none', 'bullet', 'numbered'].includes(String(listStyle))) {
            return null;
        }
        styles[elementId] = {
            fontSize: style.fontSize,
            color: style.color.toLowerCase(),
            fontFamily: fontFamily.trim(),
            fontStyle: fontStyle as LayoutTextStyles[typeof elementId]['fontStyle'],
            lineHeight,
            letterSpacing,
            align: align as LayoutTextStyles[typeof elementId]['align'],
            listStyle: listStyle as LayoutTextStyles[typeof elementId]['listStyle'],
        };
    }
    return styles;
};

const parseLayoutVisualStyles = (value: unknown, templateId: TemplateId): LayoutVisualStyles | null => {
    if (value === undefined) {
        return createLayoutVisualStyles(templateId);
    }
    if (!isRecord(value)) {
        return null;
    }
    const styles = createLayoutVisualStyles(templateId);
    for (const elementId of SHAPE_LAYOUT_ELEMENT_IDS) {
        const style = value[elementId];
        if (!isRecord(style) || typeof style.fill !== 'string' || !isHexColor(style.fill) ||
            typeof style.stroke !== 'string' || !isHexColor(style.stroke) ||
            !isFiniteNumber(style.strokeWidth) || style.strokeWidth < 0 || style.strokeWidth > 100) {
            return null;
        }
        styles[elementId] = {
            fill: style.fill.toLowerCase(),
            stroke: style.stroke.toLowerCase(),
            strokeWidth: style.strokeWidth,
        };
    }
    return styles;
};

const parseLayoutGroups = (value: unknown): LayoutGroups | null => {
    if (value === undefined) {
        return createLayoutGroups();
    }
    if (!Array.isArray(value)) {
        return null;
    }
    const elementIds = new Set<LayoutElementId>();
    const groupIds = new Set<string>();
    const parseGroup = (candidate: unknown): LayoutGroup | null => {
        if (!isRecord(candidate) || typeof candidate.id !== 'string' || !candidate.id ||
            groupIds.has(candidate.id) || !Array.isArray(candidate.children) || candidate.children.length < 2) {
            return null;
        }
        groupIds.add(candidate.id);
        const children: LayoutGroup['children'] = [];
        for (const child of candidate.children) {
            if (typeof child === 'string' && LAYOUT_ELEMENT_IDS.includes(child as LayoutElementId)) {
                const elementId = child as LayoutElementId;
                if (elementIds.has(elementId)) {
                    return null;
                }
                elementIds.add(elementId);
                children.push(elementId);
                continue;
            }
            const group = parseGroup(child);
            if (!group) {
                return null;
            }
            children.push(group);
        }
        return { id: candidate.id, children };
    };
    const groups: LayoutGroups = [];
    for (const candidate of value) {
        const group = parseGroup(candidate);
        if (!group) {
            return null;
        }
        groups.push(group);
    }
    return groups;
};

export const parsePublisherLayoutState = (
    value: unknown,
    templateId: TemplateId,
    documentWidth = DOCUMENT_WIDTH,
    documentHeight = DOCUMENT_HEIGHT,
): SerializableLayoutState | null => {
    if (!isRecord(value) || !isRecord(value.offsets) || !isRecord(value.sizes) ||
        !isRecord(value.rotations) || !Array.isArray(value.order)) {
        return null;
    }

    const offsets = createLayoutOffsets();
    const sizes = createLayoutSizes(templateId);
    const rotations = createLayoutRotations();
    const order = value.order;
    const storedOffsets = value.offsets;
    const storedSizes = value.sizes;
    const storedRotations = value.rotations;
    const deleted = value.deleted === undefined
        ? []
        : Array.isArray(value.deleted)
            ? value.deleted.filter((elementId): elementId is LayoutElementId =>
                typeof elementId === 'string' && LAYOUT_ELEMENT_IDS.includes(elementId as LayoutElementId))
            : null;
    if (!deleted || (value.deleted !== undefined && deleted.length !== (value.deleted as unknown[]).length) ||
        new Set(deleted).size !== deleted.length) {
        return null;
    }
    const storedElementIds = LAYOUT_ELEMENT_IDS.filter((elementId) => storedOffsets[elementId] !== undefined);
    for (const elementId of LAYOUT_ELEMENT_IDS) {
        if (!storedElementIds.includes(elementId)) {
            sizes[elementId] = {
                width: sizes[elementId].width * documentWidth / DOCUMENT_WIDTH,
                height: sizes[elementId].height * documentHeight / DOCUMENT_HEIGHT,
            };
        }
    }
    const geometryIsValid = storedElementIds.every((elementId) => {
        const offset = storedOffsets[elementId];
        const size = storedSizes[elementId];
        return isRecord(offset) && isFiniteNumber(offset.x) && isFiniteNumber(offset.y) &&
            isRecord(size) && isFiniteNumber(size.width) && isFiniteNumber(size.height) &&
            isFiniteNumber(storedRotations[elementId]);
    });
    for (const elementId of storedElementIds) {
        const offset = storedOffsets[elementId] as { x: number; y: number };
        const size = storedSizes[elementId] as { width: number; height: number };
        offsets[elementId] = { x: offset.x, y: offset.y };
        sizes[elementId] = { width: size.width, height: size.height };
        rotations[elementId] = storedRotations[elementId] as number;
    }
    const parsedOrder = order.filter((elementId): elementId is LayoutElementId =>
        typeof elementId === 'string' && LAYOUT_ELEMENT_IDS.includes(elementId as LayoutElementId));
    const remainingElementIds = LAYOUT_ELEMENT_IDS.filter((elementId) => !deleted.includes(elementId));
    const orderIsValid = parsedOrder.length === order.length && new Set(parsedOrder).size === parsedOrder.length &&
        (parsedOrder.length === remainingElementIds.length &&
            remainingElementIds.every((elementId) => parsedOrder.includes(elementId)) ||
            (deleted.length === 0 && parsedOrder.length === 3 &&
                ['title', 'dateTime', 'location'].every((id) => parsedOrder.includes(id as LayoutElementId))));
    const restoredOrder = parsedOrder.length === remainingElementIds.length
        ? parsedOrder
        : [...createLayoutOrder().filter((id) => !deleted.includes(id) && !parsedOrder.includes(id)), ...parsedOrder];
    const styles = parseLayoutStyles(value.styles, templateId);
    const visualStyles = parseLayoutVisualStyles(value.visualStyles, templateId);
    const groups = parseLayoutGroups(value.groups);
    if (!geometryIsValid || !orderIsValid || !styles || !visualStyles || !groups) {
        return null;
    }

    return {
        offsets,
        sizes,
        rotations,
        order: restoredOrder,
        styles,
        visualStyles,
        groups,
        deleted,
    };
};

const parseLayoutState = parsePublisherLayoutState;

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

export const parsePublisherImageFocus = (value: unknown): ImageFocusByTemplate | null => parseImageFocus(value);

const parseDraftPage = (value: unknown): PublisherDraftPage | null => {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
        !isFiniteNumber(value.width) || !isFiniteNumber(value.height) ||
        value.width < 64 || value.height < 64 || value.width > 8192 || value.height > 8192 ||
        (value.templateId !== 'split' && value.templateId !== 'poster') || !isRecord(value.layouts)) {
        return null;
    }
    const imageFocus = parseImageFocus(value.imageFocus);
    if (!imageFocus) {
        return null;
    }
    const layouts: PublisherDraftPage['layouts'] = {};
    for (const templateId of ['split', 'poster'] as const) {
        const layoutValue = value.layouts[templateId];
        const layout = parsePublisherLayoutState(layoutValue, templateId, value.width, value.height);
        if (layoutValue !== undefined && !layout) {
            return null;
        }
        if (layout) {
            layouts[templateId] = layout;
        }
    }
    return {
        id: value.id,
        width: Math.round(value.width),
        height: Math.round(value.height),
        templateId: value.templateId,
        layouts,
        imageFocus,
    };
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
            parsed.previewZoomPercent < 25 || parsed.previewZoomPercent > 400 ||
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

        let pages: PublisherDraftPage[] | undefined;
        let activePageId: string | undefined;
        if (parsed.pages !== undefined) {
            if (!Array.isArray(parsed.pages) || parsed.pages.length === 0 || parsed.pages.length > 50) {
                return null;
            }
            pages = [];
            const pageIds = new Set<string>();
            for (const candidate of parsed.pages) {
                const page = parseDraftPage(candidate);
                if (!page || pageIds.has(page.id)) {
                    return null;
                }
                pageIds.add(page.id);
                pages.push(page);
            }
            if (typeof parsed.activePageId !== 'string' || !pageIds.has(parsed.activePageId)) {
                return null;
            }
            activePageId = parsed.activePageId;
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
            ...(pages ? { pages, activePageId } : {}),
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
