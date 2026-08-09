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
    };
    elements: Record<TemplateTextBinding, TemplateTextElementDefinition>;
}

const textElement = (
    binding: TemplateTextBinding,
    frame: TemplateFrame,
    fontSize: number,
    color: string,
): TemplateTextElementDefinition => ({ binding, frame, style: { fontSize, color } });

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

export const parseTemplateDefinition = (value: string): PublisherTemplateDefinition | null => {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed) || parsed.format !== TEMPLATE_DEFINITION_FORMAT ||
            parsed.version !== TEMPLATE_DEFINITION_VERSION || typeof parsed.id !== 'string' ||
            !parsed.id.trim() || typeof parsed.name !== 'string' || !parsed.name.trim() ||
            !isRecord(parsed.document) || !isPositiveNumber(parsed.document.width) ||
            !isPositiveNumber(parsed.document.height) || !isRecord(parsed.composition) ||
            !BUILT_IN_TEMPLATE_IDS.includes(parsed.composition.variant as BuiltInTemplateId) ||
            !isRecord(parsed.elements)) {
            return null;
        }

        const document = { width: parsed.document.width, height: parsed.document.height };
        const imageFrame = parseFrame(parsed.composition.imageFrame, document.width, document.height);
        if (!imageFrame) {
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
            },
            elements,
        };
    } catch {
        return null;
    }
};

export const serializeTemplateDefinition = (definition: PublisherTemplateDefinition) =>
    JSON.stringify(definition, null, 2);
