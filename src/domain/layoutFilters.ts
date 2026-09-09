export const LAYOUT_FILTER_TYPES = [
    'brightness',
    'contrast',
    'hsl',
    'grayscale',
    'sepia',
    'invert',
    'pixelate',
    'noise',
] as const;

export type LayoutFilterType = (typeof LAYOUT_FILTER_TYPES)[number];

interface LayoutFilterBase {
    enabled: boolean;
    type: LayoutFilterType;
}

export interface LayoutBrightnessFilter extends LayoutFilterBase {
    type: 'brightness';
    amount: number;
}

export interface LayoutContrastFilter extends LayoutFilterBase {
    type: 'contrast';
    amount: number;
}

export interface LayoutHslFilter extends LayoutFilterBase {
    type: 'hsl';
    hue: number;
    saturation: number;
    luminance: number;
}

export interface LayoutGrayscaleFilter extends LayoutFilterBase {
    type: 'grayscale';
}

export interface LayoutSepiaFilter extends LayoutFilterBase {
    type: 'sepia';
}

export interface LayoutInvertFilter extends LayoutFilterBase {
    type: 'invert';
}

export interface LayoutPixelateFilter extends LayoutFilterBase {
    type: 'pixelate';
    size: number;
}

export interface LayoutNoiseFilter extends LayoutFilterBase {
    type: 'noise';
    amount: number;
}

export type LayoutFilter =
    | LayoutBrightnessFilter
    | LayoutContrastFilter
    | LayoutHslFilter
    | LayoutGrayscaleFilter
    | LayoutSepiaFilter
    | LayoutInvertFilter
    | LayoutPixelateFilter
    | LayoutNoiseFilter;

export type LayoutFilterStack = LayoutFilter[];
export type LayoutFilters = Record<string, LayoutFilterStack>;

const clamp = (value: unknown, fallback: number, minimum: number, maximum: number) =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.min(maximum, Math.max(minimum, value))
        : fallback;

export const createLayoutFilter = (type: LayoutFilterType): LayoutFilter => {
    switch (type) {
        case 'brightness': return { type, enabled: false, amount: 0.15 };
        case 'contrast': return { type, enabled: false, amount: 20 };
        case 'hsl': return { type, enabled: false, hue: 0, saturation: 0, luminance: 0 };
        case 'grayscale': return { type, enabled: false };
        case 'sepia': return { type, enabled: false };
        case 'invert': return { type, enabled: false };
        case 'pixelate': return { type, enabled: false, size: 8 };
        case 'noise': return { type, enabled: false, amount: 0.2 };
    }
};

export const cloneLayoutFilter = (filter: LayoutFilter): LayoutFilter => ({ ...filter });

export const createLayoutFilterStack = (filters: LayoutFilterStack = []): LayoutFilterStack => {
    const normalized = normalizeLayoutFilterStack(filters);
    return [
        ...normalized.map(cloneLayoutFilter),
        ...LAYOUT_FILTER_TYPES
            .filter((type) => !normalized.some((filter) => filter.type === type))
            .map(createLayoutFilter),
    ];
};

export const normalizeLayoutFilter = (value: Partial<LayoutFilter> & { type: LayoutFilterType }): LayoutFilter => {
    const defaults = createLayoutFilter(value.type);
    const enabled = typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled;
    switch (value.type) {
        case 'brightness': return {
            type: value.type,
            enabled,
            amount: clamp('amount' in value ? value.amount : undefined, 0.15, -1, 1),
        };
        case 'contrast': return {
            type: value.type,
            enabled,
            amount: clamp('amount' in value ? value.amount : undefined, 20, -100, 100),
        };
        case 'hsl': return {
            type: value.type,
            enabled,
            hue: clamp('hue' in value ? value.hue : undefined, 0, -180, 180),
            saturation: clamp('saturation' in value ? value.saturation : undefined, 0, -1, 1),
            luminance: clamp('luminance' in value ? value.luminance : undefined, 0, -1, 1),
        };
        case 'pixelate': return {
            type: value.type,
            enabled,
            size: clamp('size' in value ? value.size : undefined, 8, 2, 200),
        };
        case 'noise': return {
            type: value.type,
            enabled,
            amount: clamp('amount' in value ? value.amount : undefined, 0.2, 0, 1),
        };
        case 'grayscale':
        case 'sepia':
        case 'invert':
            return { type: value.type, enabled };
    }
};

export const normalizeLayoutFilterStack = (value?: LayoutFilterStack | null): LayoutFilterStack => {
    if (!Array.isArray(value)) return [];
    const types = new Set<LayoutFilterType>();
    return value.flatMap((candidate) => {
        if (!candidate || !LAYOUT_FILTER_TYPES.includes(candidate.type) || types.has(candidate.type)) return [];
        types.add(candidate.type);
        return [normalizeLayoutFilter(candidate)];
    });
};

export const layoutFilterStackHasEnabled = (filters?: LayoutFilterStack | null) =>
    normalizeLayoutFilterStack(filters).some(({ enabled }) => enabled);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseLayoutFilterStack = (value: unknown): LayoutFilterStack | null => {
    if (!Array.isArray(value) || value.length > LAYOUT_FILTER_TYPES.length) return null;
    const filters: LayoutFilterStack = [];
    const types = new Set<LayoutFilterType>();
    for (const candidate of value) {
        if (!isRecord(candidate) || typeof candidate.type !== 'string' ||
            !LAYOUT_FILTER_TYPES.includes(candidate.type as LayoutFilterType) ||
            typeof candidate.enabled !== 'boolean' || types.has(candidate.type as LayoutFilterType)) return null;
        const type = candidate.type as LayoutFilterType;
        const numericFields = type === 'hsl'
            ? ['hue', 'saturation', 'luminance']
            : type === 'pixelate' ? ['size']
                : type === 'brightness' || type === 'contrast' || type === 'noise' ? ['amount'] : [];
        if (numericFields.some((field) => typeof candidate[field] !== 'number' || !Number.isFinite(candidate[field]))) {
            return null;
        }
        types.add(type);
        filters.push(normalizeLayoutFilter(candidate as Partial<LayoutFilter> & { type: LayoutFilterType }));
    }
    return filters;
};

export const moveLayoutFilter = (
    filters: LayoutFilterStack,
    type: LayoutFilterType,
    direction: -1 | 1,
): LayoutFilterStack => {
    const next = normalizeLayoutFilterStack(filters).map(cloneLayoutFilter);
    const index = next.findIndex((filter) => filter.type === type);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return next;
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    return next;
};
