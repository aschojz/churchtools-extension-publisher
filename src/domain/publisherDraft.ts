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
    createCustomTextStyle,
    createCustomVisualStyle,
    flattenLayoutGroups,
    isHexColor,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
    type LayoutElementId,
    type LayoutEffects,
    type LayoutCustomElement,
    type LayoutGroup,
    type LayoutGroups,
    type LayoutTextStyle,
    type LayoutTextStyles,
    type LayoutVisualStyles,
    normalizeLayoutElementEffects,
    normalizeRotation,
    LAYOUT_ELEMENT_IDS,
    SHAPE_LAYOUT_ELEMENT_IDS,
    TEXT_LAYOUT_ELEMENT_IDS,
} from './layoutEditing';
import type { EventTemplateOverrides } from './templateOverrides';
import { isLayoutColorBinding } from './imagePalette';
import type { TemplateId } from './templates';
import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';
import { isPublisherIconName } from './publisherIcons';
import { normalizeLayoutGradient, type LayoutGradient } from './layoutGradient';

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

const parseLayoutGradient = (value: unknown): LayoutGradient | null => {
    if (!isRecord(value) || !['linear', 'radial'].includes(String(value.type)) ||
        !isFiniteNumber(value.startX) || !isFiniteNumber(value.startY) ||
        !isFiniteNumber(value.endX) || !isFiniteNumber(value.endY) ||
        !isFiniteNumber(value.startRadius) || !isFiniteNumber(value.endRadius) ||
        !Array.isArray(value.stops) || value.stops.length < 2 || value.stops.length > 32) return null;
    const stops = value.stops.map((stop) => isRecord(stop) && typeof stop.id === 'string' && stop.id &&
        isFiniteNumber(stop.offset) && stop.offset >= 0 && stop.offset <= 1 &&
        typeof stop.color === 'string' && isHexColor(stop.color) &&
        isFiniteNumber(stop.opacity) && stop.opacity >= 0 && stop.opacity <= 1 &&
        (stop.colorBinding === undefined || isLayoutColorBinding(stop.colorBinding))
        ? {
            id: stop.id,
            offset: stop.offset,
            color: stop.color,
            opacity: stop.opacity,
            ...(isLayoutColorBinding(stop.colorBinding) ? { colorBinding: { ...stop.colorBinding } } : {}),
        }
        : null);
    if (stops.some((stop) => !stop) || new Set(stops.map((stop) => stop!.id)).size !== stops.length) return null;
    return normalizeLayoutGradient({
        type: value.type as LayoutGradient['type'],
        startX: value.startX,
        startY: value.startY,
        endX: value.endX,
        endY: value.endY,
        startRadius: value.startRadius,
        endRadius: value.endRadius,
        stops: stops as LayoutGradient['stops'],
    });
};
const isFiniteNumber = isPublisherFiniteNumber;

const parseLayoutCustomElements = (value: unknown): LayoutCustomElement[] | null => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 100) return null;
    const ids = new Set<string>();
    const elements: LayoutCustomElement[] = [];
    for (const candidate of value) {
        if (!isRecord(candidate) || typeof candidate.id !== 'string' || ids.has(candidate.id) ||
            typeof candidate.kind !== 'string' ||
            !['text', 'image', 'rectangle', 'circle', 'triangle', 'line', 'icon', 'qr'].includes(candidate.kind) ||
            typeof candidate.name !== 'string' || !candidate.name.trim() || !isRecord(candidate.frame)) {
            return null;
        }
        const expectedPrefix = candidate.kind === 'text' ? 'text-' : candidate.kind === 'image'
            ? 'image-' : candidate.kind === 'icon' ? 'icon-' : candidate.kind === 'qr' ? 'qr-' : `shape-${candidate.kind}-`;
        const frame = candidate.frame;
        if (!candidate.id.startsWith(expectedPrefix) ||
            ![frame.x, frame.y, frame.width, frame.height].every(isFiniteNumber) ||
            Number(frame.width) <= 0 || Number(frame.height) <= 0 ||
            (candidate.kind === 'text' && typeof candidate.text !== 'string') ||
            (candidate.textMode !== undefined && candidate.textMode !== 'graphic' && candidate.textMode !== 'frame') ||
            (candidate.kind === 'icon' && !isPublisherIconName(candidate.iconName)) ||
            (candidate.kind === 'qr' && (
                typeof candidate.qrValue !== 'string' || candidate.qrValue.length > 10_000 ||
                typeof candidate.qrBackground !== 'string' || !isHexColor(candidate.qrBackground) ||
                !isFiniteNumber(candidate.qrMargin) || candidate.qrMargin < 0 || candidate.qrMargin > 10 ||
                !['L', 'M', 'Q', 'H'].includes(String(candidate.qrErrorCorrection))
            )) ||
            (candidate.dataBinding !== undefined && (typeof candidate.dataBinding !== 'string' ||
                !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(candidate.dataBinding))) ||
            (candidate.kind === 'image' && (typeof candidate.imageSource !== 'string' ||
                !/^(data:image\/(?:jpeg|png|webp);base64,|https?:\/\/)/i.test(candidate.imageSource)))) {
            return null;
        }
        ids.add(candidate.id);
        elements.push({
            id: candidate.id as LayoutElementId,
            kind: candidate.kind as LayoutCustomElement['kind'],
            name: candidate.name.trim(),
            frame: { x: Number(frame.x), y: Number(frame.y), width: Number(frame.width), height: Number(frame.height) },
            ...(candidate.kind === 'text'
                ? { text: candidate.text as string, textMode: candidate.textMode === 'graphic' ? 'graphic' : 'frame' }
                : {}),
            ...(candidate.kind === 'image' ? { imageSource: candidate.imageSource as string } : {}),
            ...(typeof candidate.dataBinding === 'string' ? { dataBinding: candidate.dataBinding } : {}),
            ...(candidate.kind === 'icon' && isPublisherIconName(candidate.iconName)
                ? { iconName: candidate.iconName }
                : {}),
            ...(candidate.kind === 'qr' ? {
                qrValue: candidate.qrValue as string,
                qrBackground: String(candidate.qrBackground).toLowerCase(),
                qrMargin: Number(candidate.qrMargin),
                qrErrorCorrection: candidate.qrErrorCorrection as NonNullable<LayoutCustomElement['qrErrorCorrection']>,
            } : {}),
        });
    }
    return elements;
};

const parseLayoutStyles = (
    value: unknown,
    templateId: TemplateId,
    customElements: LayoutCustomElement[],
): LayoutTextStyles | null => {
    if (value === undefined) {
        return {
            ...createLayoutTextStyles(templateId),
            ...Object.fromEntries(customElements.filter(({ kind }) => kind === 'text')
                .map(({ id }) => [id, createCustomTextStyle()])),
        };
    }
    if (!isRecord(value)) {
        return null;
    }

    const styles = createLayoutTextStyles(templateId);
    const textElementIds = [
        ...TEXT_LAYOUT_ELEMENT_IDS,
        ...customElements.filter(({ kind }) => kind === 'text').map(({ id }) => id),
    ];
    for (const elementId of textElementIds) {
        const style = value[elementId];
        if (style === undefined && !LAYOUT_ELEMENT_IDS.includes(elementId as never)) {
            styles[elementId] = createCustomTextStyle();
            continue;
        }
        if (!isRecord(style) || !isFiniteNumber(style.fontSize) ||
            style.fontSize < MIN_FONT_SIZE || style.fontSize > MAX_FONT_SIZE ||
            typeof style.color !== 'string' || !isHexColor(style.color)) {
            return null;
        }
        const defaultStyle = styles[elementId] ?? createCustomTextStyle();
        const stroke = style.stroke ?? defaultStyle.stroke;
        const strokeWidth = style.strokeWidth ?? defaultStyle.strokeWidth;
        const fontFamily = style.fontFamily ?? defaultStyle.fontFamily;
        const fontStyle = style.fontStyle ?? defaultStyle.fontStyle;
        const lineHeight = style.lineHeight ?? defaultStyle.lineHeight;
        const letterSpacing = style.letterSpacing ?? defaultStyle.letterSpacing;
        const align = style.align ?? defaultStyle.align;
        const listStyle = style.listStyle ?? defaultStyle.listStyle;
        const textTransform = style.textTransform ?? defaultStyle.textTransform;
        const underlineStyle = style.underlineStyle ?? defaultStyle.underlineStyle;
        const strikethroughStyle = style.strikethroughStyle ?? defaultStyle.strikethroughStyle;
        const colorBinding = style.colorBinding;
        const strokeBinding = style.strokeBinding;
        const colorGradient = style.colorGradient === undefined ? null : parseLayoutGradient(style.colorGradient);
        if (typeof fontFamily !== 'string' || !fontFamily.trim() ||
            typeof stroke !== 'string' || !isHexColor(stroke) ||
            !isFiniteNumber(strokeWidth) || strokeWidth < 0 || strokeWidth > 100 ||
            !['normal', 'bold', 'italic', 'bold italic'].includes(String(fontStyle)) ||
            !isFiniteNumber(lineHeight) || lineHeight < 0.5 || lineHeight > 3 ||
            !isFiniteNumber(letterSpacing) || letterSpacing < -20 || letterSpacing > 100 ||
            !['left', 'center', 'right'].includes(String(align)) ||
            !['none', 'bullet', 'numbered'].includes(String(listStyle)) ||
            !['none', 'uppercase', 'smallCaps'].includes(String(textTransform)) ||
            !['none', 'single', 'double'].includes(String(underlineStyle)) ||
            !['none', 'single', 'double'].includes(String(strikethroughStyle)) ||
            (colorBinding !== undefined && !isLayoutColorBinding(colorBinding)) ||
            (strokeBinding !== undefined && !isLayoutColorBinding(strokeBinding)) ||
            (style.colorGradient !== undefined && !colorGradient)) {
            return null;
        }
        styles[elementId] = {
            fontSize: style.fontSize,
            color: style.color.toLowerCase(),
            stroke: stroke.toLowerCase(),
            strokeWidth,
            fontFamily: fontFamily.trim(),
            fontStyle: fontStyle as LayoutTextStyle['fontStyle'],
            lineHeight,
            letterSpacing,
            align: align as LayoutTextStyle['align'],
            listStyle: listStyle as LayoutTextStyle['listStyle'],
            textTransform: textTransform as LayoutTextStyle['textTransform'],
            underlineStyle: underlineStyle as LayoutTextStyle['underlineStyle'],
            strikethroughStyle: strikethroughStyle as LayoutTextStyle['strikethroughStyle'],
            ...(isLayoutColorBinding(colorBinding) ? { colorBinding: { ...colorBinding } } : {}),
            ...(isLayoutColorBinding(strokeBinding) ? { strokeBinding: { ...strokeBinding } } : {}),
            ...(colorGradient ? { colorGradient } : {}),
        };
    }
    return styles;
};

const parseLayoutVisualStyles = (
    value: unknown,
    templateId: TemplateId,
    customElements: LayoutCustomElement[],
): LayoutVisualStyles | null => {
    if (value === undefined) {
        return {
            ...createLayoutVisualStyles(templateId),
            ...Object.fromEntries(customElements.filter(({ kind }) => ['rectangle', 'circle', 'triangle', 'line', 'icon', 'qr'].includes(kind))
                .map(({ id }) => [id, createCustomVisualStyle()])),
        };
    }
    if (!isRecord(value)) {
        return null;
    }
    const styles = createLayoutVisualStyles(templateId);
    const shapeElementIds = [
        ...SHAPE_LAYOUT_ELEMENT_IDS,
        ...customElements.filter(({ kind }) => ['rectangle', 'circle', 'triangle', 'line', 'icon', 'qr'].includes(kind)).map(({ id }) => id),
    ];
    for (const elementId of shapeElementIds) {
        const style = value[elementId];
        if (style === undefined && !LAYOUT_ELEMENT_IDS.includes(elementId as never)) {
            styles[elementId] = createCustomVisualStyle();
            continue;
        }
        if (!isRecord(style) || typeof style.fill !== 'string' || !isHexColor(style.fill) ||
            typeof style.stroke !== 'string' || !isHexColor(style.stroke) ||
            !isFiniteNumber(style.strokeWidth) || style.strokeWidth < 0 || style.strokeWidth > 100 ||
            (style.fillBinding !== undefined && !isLayoutColorBinding(style.fillBinding)) ||
            (style.strokeBinding !== undefined && !isLayoutColorBinding(style.strokeBinding))) {
            return null;
        }
        const fillGradient = style.fillGradient === undefined ? null : parseLayoutGradient(style.fillGradient);
        if (style.fillGradient !== undefined && !fillGradient) return null;
        styles[elementId] = {
            fill: style.fill.toLowerCase(),
            stroke: style.stroke.toLowerCase(),
            strokeWidth: style.strokeWidth,
            ...(isLayoutColorBinding(style.fillBinding) ? { fillBinding: { ...style.fillBinding } } : {}),
            ...(isLayoutColorBinding(style.strokeBinding) ? { strokeBinding: { ...style.strokeBinding } } : {}),
            ...(fillGradient ? { fillGradient } : {}),
        };
    }
    return styles;
};

const parseLayoutGroups = (value: unknown, validElementIds = new Set<LayoutElementId>(LAYOUT_ELEMENT_IDS)): LayoutGroups | null => {
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
            if (typeof child === 'string' && validElementIds.has(child as LayoutElementId)) {
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
        if (candidate.rotation !== undefined && !isFiniteNumber(candidate.rotation)) return null;
        let autoLayout: LayoutGroup['autoLayout'];
        if (candidate.autoLayout !== undefined) {
            const layout = candidate.autoLayout;
            if (!isRecord(layout) || (layout.axis !== 'horizontal' && layout.axis !== 'vertical') ||
                !isFiniteNumber(layout.gap) || layout.gap < 0 || layout.gap > 4096 ||
                !['left', 'center', 'right'].includes(String(layout.horizontalOrigin)) ||
                !['top', 'center', 'bottom'].includes(String(layout.verticalOrigin)) ||
                !isRecord(layout.anchor) || !isFiniteNumber(layout.anchor.x) || !isFiniteNumber(layout.anchor.y)) {
                return null;
            }
            autoLayout = {
                axis: layout.axis,
                gap: layout.gap,
                horizontalOrigin: layout.horizontalOrigin as NonNullable<LayoutGroup['autoLayout']>['horizontalOrigin'],
                verticalOrigin: layout.verticalOrigin as NonNullable<LayoutGroup['autoLayout']>['verticalOrigin'],
                anchor: { x: layout.anchor.x, y: layout.anchor.y },
            };
        }
        return {
            id: candidate.id,
            children,
            ...(autoLayout ? { autoLayout } : {}),
            ...(candidate.rotation !== undefined ? { rotation: normalizeRotation(candidate.rotation) } : {}),
        };
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

const parseLayoutEffects = (value: unknown, validElementIds: Set<string>): LayoutEffects | null => {
    if (value === undefined) return {};
    if (!isRecord(value)) return null;
    const effects: LayoutEffects = {};
    for (const [elementId, candidate] of Object.entries(value)) {
        if (!validElementIds.has(elementId) || !isRecord(candidate) ||
            (candidate.shadow !== undefined && !isRecord(candidate.shadow)) ||
            (candidate.blur !== undefined && !isRecord(candidate.blur)) ||
            (candidate.opacity !== undefined && !isFiniteNumber(candidate.opacity)) ||
            (candidate.blendMode !== undefined && typeof candidate.blendMode !== 'string')) return null;
        effects[elementId] = normalizeLayoutElementEffects(candidate);
    }
    return effects;
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
    const customElements = parseLayoutCustomElements(value.customElements);
    if (!customElements) return null;
    const allElementIds = [...LAYOUT_ELEMENT_IDS, ...customElements.map(({ id }) => id)];
    const validElementIds = new Set<LayoutElementId>(allElementIds);
    const order = value.order;
    const storedOffsets = value.offsets;
    const storedSizes = value.sizes;
    const storedRotations = value.rotations;
    const deleted = value.deleted === undefined
        ? []
        : Array.isArray(value.deleted)
            ? value.deleted.filter((elementId): elementId is LayoutElementId =>
                typeof elementId === 'string' && validElementIds.has(elementId as LayoutElementId))
            : null;
    if (!deleted || (value.deleted !== undefined && deleted.length !== (value.deleted as unknown[]).length) ||
        new Set(deleted).size !== deleted.length) {
        return null;
    }
    const hidden = value.hidden === undefined
        ? []
        : Array.isArray(value.hidden)
            ? value.hidden.filter((elementId): elementId is LayoutElementId =>
                typeof elementId === 'string' && validElementIds.has(elementId as LayoutElementId))
            : null;
    if (!hidden || (value.hidden !== undefined && hidden.length !== (value.hidden as unknown[]).length) ||
        new Set(hidden).size !== hidden.length) {
        return null;
    }
    const locked = value.locked === undefined
        ? []
        : Array.isArray(value.locked)
            ? value.locked.filter((elementId): elementId is LayoutElementId =>
                typeof elementId === 'string' && validElementIds.has(elementId as LayoutElementId))
            : null;
    if (!locked || (value.locked !== undefined && locked.length !== (value.locked as unknown[]).length) ||
        new Set(locked).size !== locked.length) {
        return null;
    }
    const storedElementIds = allElementIds.filter((elementId) => storedOffsets[elementId] !== undefined);
    for (const elementId of LAYOUT_ELEMENT_IDS) {
        if (!storedElementIds.includes(elementId)) {
            sizes[elementId] = {
                width: sizes[elementId].width * documentWidth / DOCUMENT_WIDTH,
                height: sizes[elementId].height * documentHeight / DOCUMENT_HEIGHT,
            };
        }
    }
    for (const element of customElements) {
        if (!storedElementIds.includes(element.id)) return null;
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
        typeof elementId === 'string' && validElementIds.has(elementId as LayoutElementId));
    const remainingElementIds = allElementIds.filter((elementId) => !deleted.includes(elementId));
    const visibleParsedOrder = parsedOrder.filter((elementId) => !deleted.includes(elementId));
    const orderIsValid = parsedOrder.length === order.length && new Set(parsedOrder).size === parsedOrder.length &&
        (visibleParsedOrder.length === remainingElementIds.length &&
            remainingElementIds.every((elementId) => visibleParsedOrder.includes(elementId)) ||
            (deleted.length === 0 && parsedOrder.length === 3 &&
                ['title', 'dateTime', 'location'].every((id) => parsedOrder.includes(id as LayoutElementId))));
    const restoredOrder = visibleParsedOrder.length === remainingElementIds.length
        ? visibleParsedOrder
        : [...createLayoutOrder().filter((id) => !deleted.includes(id) && !parsedOrder.includes(id)), ...parsedOrder];
    const styles = parseLayoutStyles(value.styles, templateId, customElements);
    const visualStyles = parseLayoutVisualStyles(value.visualStyles, templateId, customElements);
    const groups = parseLayoutGroups(value.groups, validElementIds);
    const effectTargetIds = new Set<string>([
        ...validElementIds,
        ...flattenLayoutGroups(groups ?? []).map(({ id }) => id),
    ]);
    const effects = parseLayoutEffects(value.effects, effectTargetIds);
    if (!geometryIsValid || !orderIsValid || !styles || !visualStyles || !groups || !effects) {
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
        ...(value.hidden !== undefined ? { hidden } : {}),
        ...(value.locked !== undefined ? { locked } : {}),
        ...(value.customElements !== undefined ? { customElements } : {}),
        ...(value.effects !== undefined ? { effects } : {}),
    };
};

const parseLayoutState = parsePublisherLayoutState;

const parseTemplateOverrides = (value: unknown): EventTemplateOverrides | null => {
    if (!isRecord(value)) {
        return null;
    }

    const entries = Object.entries(value);
    if (entries.length > 50) return null;
    const overrides: EventTemplateOverrides = {};
    for (const [field, fieldValue] of entries) {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(field) || typeof fieldValue !== 'string' || fieldValue.length > 100_000) {
            return null;
        }
        overrides[field] = fieldValue;
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
