import { DOCUMENT_HEIGHT, DOCUMENT_WIDTH } from '../utils/stageDimensions';

export const TEMPLATE_DEFINITION_FORMAT = 'churchtools-publisher-template';
export const TEMPLATE_DEFINITION_VERSION = 1;
export const BUILT_IN_TEMPLATE_IDS = ['split', 'poster'] as const;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 240;

export type BuiltInTemplateId = (typeof BUILT_IN_TEMPLATE_IDS)[number];
export type TemplateTextBinding = 'title' | 'dateTime' | 'location';

export interface TemplateFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TemplateTextElementDefinition {
    binding: TemplateTextBinding;
    frame: TemplateFrame;
    style: {
        fontSize: number;
        color: string;
    };
}

export type TemplateDecorationPlacement = 'behindImage' | 'overImage';
export type TemplateDecorationVisibility = 'always' | 'imageFallback';

interface TemplateDecorationBase {
    id: string;
    placement: TemplateDecorationPlacement;
    visibility: TemplateDecorationVisibility;
    frame: TemplateFrame;
}

export interface TemplateRectDecoration extends TemplateDecorationBase {
    type: 'rect';
    fill: string;
    opacity?: number;
    imageLoadedOpacity?: number;
}

export interface TemplateTextDecoration extends TemplateDecorationBase {
    type: 'text';
    text: string;
    fill: string;
    fontFamily: string;
    fontSize: number;
    fontStyle?: 'normal' | 'bold';
    letterSpacing?: number;
    align?: 'left' | 'center' | 'right';
}

export type TemplateDecoration = TemplateRectDecoration | TemplateTextDecoration;

export interface PublisherTemplateDefinition {
    format: typeof TEMPLATE_DEFINITION_FORMAT;
    version: typeof TEMPLATE_DEFINITION_VERSION;
    id: string;
    name: string;
    document: {
        width: number;
        height: number;
    };
    composition: {
        variant: BuiltInTemplateId;
        imageFrame: TemplateFrame;
        decorations: TemplateDecoration[];
    };
    elements: Record<TemplateTextBinding, TemplateTextElementDefinition>;
}

const textElement = (
    binding: TemplateTextBinding,
    frame: TemplateFrame,
    fontSize: number,
    color: string,
): TemplateTextElementDefinition => ({ binding, frame, style: { fontSize, color } });

const fullDocumentFrame = (): TemplateFrame => ({
    x: 0,
    y: 0,
    width: DOCUMENT_WIDTH,
    height: DOCUMENT_HEIGHT,
});

export const BUILT_IN_TEMPLATE_DEFINITIONS: Record<BuiltInTemplateId, PublisherTemplateDefinition> = {
    split: {
        format: TEMPLATE_DEFINITION_FORMAT,
        version: TEMPLATE_DEFINITION_VERSION,
        id: 'split',
        name: 'Geteilte Fläche',
        document: { width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT },
        composition: {
            variant: 'split',
            imageFrame: { x: 0, y: 0, width: 920, height: DOCUMENT_HEIGHT },
            decorations: [
                { id: 'background', type: 'rect', placement: 'behindImage', visibility: 'always', frame: fullDocumentFrame(), fill: '#172235' },
                { id: 'image-fallback', type: 'rect', placement: 'behindImage', visibility: 'always', frame: { x: 0, y: 0, width: 920, height: DOCUMENT_HEIGHT }, fill: '#d8c8ae' },
                { id: 'fallback-label', type: 'text', placement: 'behindImage', visibility: 'imageFallback', frame: { x: 110, y: 460, width: 700, height: 80 }, text: 'CHURCHTOOLS', align: 'center', fill: '#6e6252', fontFamily: 'Lato, Arial, sans-serif', fontSize: 42, fontStyle: 'bold', letterSpacing: 8 },
                { id: 'accent', type: 'rect', placement: 'overImage', visibility: 'always', frame: { x: 1030, y: 485, width: 120, height: 8 }, fill: '#f3b562' },
                { id: 'footer', type: 'text', placement: 'overImage', visibility: 'always', frame: { x: 1030, y: 955, width: 760, height: 40 }, text: 'CHURCHTOOLS PUBLISHER', fill: '#8190a5', fontFamily: 'Lato, Arial, sans-serif', fontSize: 22, fontStyle: 'bold', letterSpacing: 4 },
            ],
        },
        elements: {
            title: textElement('title', { x: 1030, y: 130, width: 760, height: 310 }, 88, '#ffffff'),
            dateTime: textElement('dateTime', { x: 1030, y: 555, width: 760, height: 80 }, 42, '#f3b562'),
            location: textElement('location', { x: 1030, y: 700, width: 760, height: 170 }, 36, '#d8dee8'),
        },
    },
    poster: {
        format: TEMPLATE_DEFINITION_FORMAT,
        version: TEMPLATE_DEFINITION_VERSION,
        id: 'poster',
        name: 'Bildposter',
        document: { width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT },
        composition: {
            variant: 'poster',
            imageFrame: { x: 0, y: 0, width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT },
            decorations: [
                { id: 'background', type: 'rect', placement: 'behindImage', visibility: 'always', frame: fullDocumentFrame(), fill: '#24364b' },
                { id: 'fallback-base', type: 'rect', placement: 'behindImage', visibility: 'imageFallback', frame: fullDocumentFrame(), fill: '#c99d5b' },
                { id: 'fallback-left', type: 'rect', placement: 'behindImage', visibility: 'imageFallback', frame: { x: 0, y: 0, width: 720, height: DOCUMENT_HEIGHT }, fill: '#18324b', opacity: 0.9 },
                { id: 'fallback-right', type: 'rect', placement: 'behindImage', visibility: 'imageFallback', frame: { x: 1420, y: 0, width: 500, height: DOCUMENT_HEIGHT }, fill: '#e9c98f', opacity: 0.7 },
                { id: 'overlay', type: 'rect', placement: 'overImage', visibility: 'always', frame: fullDocumentFrame(), fill: '#0e1928', opacity: 0.35, imageLoadedOpacity: 0.68 },
                { id: 'accent', type: 'rect', placement: 'overImage', visibility: 'always', frame: { x: 820, y: 610, width: 280, height: 8 }, fill: '#f3b562' },
                { id: 'footer', type: 'text', placement: 'overImage', visibility: 'always', frame: { x: 160, y: 960, width: 1600, height: 40 }, text: 'CHURCHTOOLS PUBLISHER', align: 'center', fill: '#dce3ed', fontFamily: 'Lato, Arial, sans-serif', fontSize: 22, fontStyle: 'bold', letterSpacing: 5 },
            ],
        },
        elements: {
            title: textElement('title', { x: 160, y: 150, width: 1600, height: 410 }, 112, '#ffffff'),
            dateTime: textElement('dateTime', { x: 160, y: 675, width: 1600, height: 80 }, 50, '#f7c77f'),
            location: textElement('location', { x: 260, y: 770, width: 1400, height: 120 }, 38, '#ffffff'),
        },
    },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositiveNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const parseFrame = (value: unknown, documentWidth: number, documentHeight: number): TemplateFrame | null => {
    if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number' ||
        !isPositiveNumber(value.width) || !isPositiveNumber(value.height) ||
        ![value.x, value.y].every(Number.isFinite) || value.x < 0 || value.y < 0 ||
        value.x + value.width > documentWidth || value.y + value.height > documentHeight) {
        return null;
    }
    return { x: value.x, y: value.y, width: value.width, height: value.height };
};

const isOpacity = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const parseDecoration = (
    value: unknown,
    documentWidth: number,
    documentHeight: number,
): TemplateDecoration | null => {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim() ||
        (value.placement !== 'behindImage' && value.placement !== 'overImage') ||
        (value.visibility !== 'always' && value.visibility !== 'imageFallback')) {
        return null;
    }
    const frame = parseFrame(value.frame, documentWidth, documentHeight);
    if (!frame || typeof value.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.fill)) {
        return null;
    }

    const base: TemplateDecorationBase = {
        id: value.id.trim(),
        placement: value.placement as TemplateDecorationPlacement,
        visibility: value.visibility as TemplateDecorationVisibility,
        frame,
    };
    if (value.type === 'rect') {
        if ((value.opacity !== undefined && !isOpacity(value.opacity)) ||
            (value.imageLoadedOpacity !== undefined && !isOpacity(value.imageLoadedOpacity))) {
            return null;
        }
        return {
            ...base,
            type: 'rect',
            fill: value.fill.toLowerCase(),
            ...(value.opacity === undefined ? {} : { opacity: value.opacity }),
            ...(value.imageLoadedOpacity === undefined ? {} : { imageLoadedOpacity: value.imageLoadedOpacity }),
        };
    }
    if (value.type !== 'text' || typeof value.text !== 'string' || !value.text ||
        typeof value.fontFamily !== 'string' || !value.fontFamily ||
        !isPositiveNumber(value.fontSize) || value.fontSize < MIN_FONT_SIZE || value.fontSize > MAX_FONT_SIZE ||
        (value.fontStyle !== undefined && value.fontStyle !== 'normal' && value.fontStyle !== 'bold') ||
        (value.letterSpacing !== undefined && (typeof value.letterSpacing !== 'number' ||
            !Number.isFinite(value.letterSpacing))) ||
        (value.align !== undefined && value.align !== 'left' && value.align !== 'center' && value.align !== 'right')) {
        return null;
    }
    return {
        ...base,
        type: 'text',
        text: value.text,
        fill: value.fill.toLowerCase(),
        fontFamily: value.fontFamily,
        fontSize: value.fontSize,
        ...(value.fontStyle === undefined ? {} : { fontStyle: value.fontStyle }),
        ...(value.letterSpacing === undefined ? {} : { letterSpacing: value.letterSpacing }),
        ...(value.align === undefined ? {} : { align: value.align }),
    };
};

export const parseTemplateDefinition = (value: string): PublisherTemplateDefinition | null => {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed) || parsed.format !== TEMPLATE_DEFINITION_FORMAT ||
            parsed.version !== TEMPLATE_DEFINITION_VERSION || typeof parsed.id !== 'string' ||
            !parsed.id.trim() || typeof parsed.name !== 'string' || !parsed.name.trim() ||
            !isRecord(parsed.document) || !isPositiveNumber(parsed.document.width) ||
            !isPositiveNumber(parsed.document.height) || !isRecord(parsed.composition) ||
            !BUILT_IN_TEMPLATE_IDS.includes(parsed.composition.variant as BuiltInTemplateId) ||
            !Array.isArray(parsed.composition.decorations) || !isRecord(parsed.elements)) {
            return null;
        }

        const document = { width: parsed.document.width, height: parsed.document.height };
        const imageFrame = parseFrame(parsed.composition.imageFrame, document.width, document.height);
        if (!imageFrame) {
            return null;
        }
        const decorations = parsed.composition.decorations.map((decoration) =>
            parseDecoration(decoration, document.width, document.height),
        );
        if (decorations.some((decoration) => !decoration) ||
            new Set(decorations.map((decoration) => decoration?.id)).size !== decorations.length) {
            return null;
        }

        const elements = {} as PublisherTemplateDefinition['elements'];
        for (const binding of ['title', 'dateTime', 'location'] as const) {
            const element = parsed.elements[binding];
            if (!isRecord(element) || element.binding !== binding || !isRecord(element.style) ||
                !isPositiveNumber(element.style.fontSize) || element.style.fontSize < MIN_FONT_SIZE ||
                element.style.fontSize > MAX_FONT_SIZE || typeof element.style.color !== 'string' ||
                !/^#[0-9a-f]{6}$/i.test(element.style.color)) {
                return null;
            }
            const frame = parseFrame(element.frame, document.width, document.height);
            if (!frame) {
                return null;
            }
            elements[binding] = {
                binding,
                frame,
                style: { fontSize: element.style.fontSize, color: element.style.color.toLowerCase() },
            };
        }

        return {
            format: TEMPLATE_DEFINITION_FORMAT,
            version: TEMPLATE_DEFINITION_VERSION,
            id: parsed.id.trim(),
            name: parsed.name.trim(),
            document,
            composition: {
                variant: parsed.composition.variant as BuiltInTemplateId,
                imageFrame,
                decorations: decorations as TemplateDecoration[],
            },
            elements,
        };
    } catch {
        return null;
    }
};

export const serializeTemplateDefinition = (definition: PublisherTemplateDefinition) =>
    JSON.stringify(definition, null, 2);
