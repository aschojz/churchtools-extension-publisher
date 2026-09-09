import type { PublisherImagePalette } from './imagePalette';

export const PUBLISHER_COLOR_PREFERENCES_CACHE_KEY = 'publisher:color-preferences:v1';
export const PUBLISHER_COLOR_PREFERENCES_VERSION = 1;
export const PUBLISHER_IMAGE_PALETTE_CACHE_VERSION = 1;

interface PublisherColorPreferencesCache {
    version: typeof PUBLISHER_COLOR_PREFERENCES_VERSION;
    recentColors: string[];
}

interface PublisherImagePaletteCache {
    version: typeof PUBLISHER_IMAGE_PALETTE_CACHE_VERSION;
    palette: PublisherImagePalette;
}

const normalizeHex = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : null;

export const serializePublisherColorPreferences = (recentColors: string[]): PublisherColorPreferencesCache => ({
    version: PUBLISHER_COLOR_PREFERENCES_VERSION,
    recentColors: recentColors.map(normalizeHex).filter((color): color is string => Boolean(color)).slice(0, 12),
});

export const parsePublisherColorPreferences = (value: unknown): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const candidate = value as Partial<PublisherColorPreferencesCache>;
    if (candidate.version !== PUBLISHER_COLOR_PREFERENCES_VERSION || !Array.isArray(candidate.recentColors)) return [];
    return serializePublisherColorPreferences(candidate.recentColors).recentColors;
};

const sourceHash = (source: string) => {
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

export const publisherImagePaletteCacheKey = (source: string) =>
    `publisher:image-palette:v${PUBLISHER_IMAGE_PALETTE_CACHE_VERSION}:${sourceHash(source)}`;

export const serializePublisherImagePalette = (palette: PublisherImagePalette): PublisherImagePaletteCache => ({
    version: PUBLISHER_IMAGE_PALETTE_CACHE_VERSION,
    palette: {
        colors: palette.colors.slice(0, 9).map((color) => ({ ...color, hex: color.hex.toLowerCase() })),
        primary: palette.primary.toLowerCase(),
        background: palette.background.toLowerCase(),
        foreground: palette.foreground.toLowerCase(),
    },
});

export const parsePublisherImagePalette = (value: unknown): PublisherImagePalette | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Partial<PublisherImagePaletteCache>;
    if (candidate.version !== PUBLISHER_IMAGE_PALETTE_CACHE_VERSION || !candidate.palette) return null;
    const colors = candidate.palette.colors;
    if (!Array.isArray(colors) || colors.length === 0 || colors.length > 9) return null;
    const normalizedColors = colors.flatMap((color) => {
        const hex = normalizeHex(color?.hex);
        return hex && typeof color?.id === 'string' && typeof color?.label === 'string'
            ? [{ id: color.id, label: color.label, hex }]
            : [];
    });
    const primary = normalizeHex(candidate.palette.primary);
    const background = normalizeHex(candidate.palette.background);
    const foreground = normalizeHex(candidate.palette.foreground);
    if (normalizedColors.length !== colors.length || !primary || !background || !foreground) return null;
    if (![primary, background, foreground].every((role) => normalizedColors.some(({ hex }) => hex === role))) return null;
    return { colors: normalizedColors, primary, background, foreground };
};
