export type ImagePaletteToken = 'primary' | 'background' | 'foreground';

export interface LayoutColorBinding {
    imageId: string;
    token: ImagePaletteToken;
}

export interface PublisherImagePaletteSource {
    id: string;
    label: string;
    source: string;
}

export interface PublisherImagePaletteColor {
    id: string;
    label: string;
    hex: string;
}

export interface PublisherImagePalette {
    colors: PublisherImagePaletteColor[];
    primary: string;
    background: string;
    foreground: string;
}

export interface ImagePaletteSwatchLike {
    hex: string;
}

export type ImagePaletteSwatches = Partial<Record<
    'Vibrant' | 'Muted' | 'DarkVibrant' | 'DarkMuted' | 'LightVibrant' | 'LightMuted',
    ImagePaletteSwatchLike | null
>>;

const swatchDefinitions = [
    ['Vibrant', 'Kräftig'],
    ['DarkVibrant', 'Kräftig dunkel'],
    ['LightVibrant', 'Kräftig hell'],
    ['Muted', 'Gedämpft'],
    ['DarkMuted', 'Gedämpft dunkel'],
    ['LightMuted', 'Gedämpft hell'],
] as const;

const expandHex = (hex: string) => {
    const normalized = hex.trim().toLowerCase();
    return /^#[0-9a-f]{3}$/.test(normalized)
        ? `#${normalized.slice(1).split('').map((part) => `${part}${part}`).join('')}`
        : normalized;
};

const luminance = (hex: string) => {
    const value = expandHex(hex);
    const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
        .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
};

export const colorContrastRatio = (left: string, right: string) => {
    const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (values[0]! + 0.05) / (values[1]! + 0.05);
};

const firstHex = (swatches: ImagePaletteSwatches, ids: (keyof ImagePaletteSwatches)[], fallback: string) =>
    ids.map((id) => swatches[id]?.hex).find(Boolean)?.toLowerCase() ?? fallback;

export const createPublisherImagePalette = (swatches: ImagePaletteSwatches): PublisherImagePalette => {
    const colors = swatchDefinitions.flatMap(([id, label]) => {
        const hex = swatches[id]?.hex?.toLowerCase();
        return hex ? [{ id, label, hex }] : [];
    }).filter((color, index, entries) => entries.findIndex(({ hex }) => hex === color.hex) === index);
    const primary = firstHex(swatches, ['Vibrant', 'Muted', 'DarkVibrant', 'LightVibrant'], '#69a7e8');
    const background = firstHex(swatches, ['DarkMuted', 'DarkVibrant', 'Muted', 'Vibrant'], primary);
    const imageForeground = firstHex(
        swatches,
        luminance(background) < 0.4
            ? ['LightVibrant', 'LightMuted']
            : ['DarkVibrant', 'DarkMuted'],
        '',
    );
    const neutralForeground = colorContrastRatio(background, '#ffffff') >= colorContrastRatio(background, '#000000')
        ? '#ffffff'
        : '#000000';
    const foreground = imageForeground && colorContrastRatio(background, imageForeground) >= 4.5
        ? imageForeground
        : neutralForeground;
    return { colors, primary, background, foreground };
};

export const imagePaletteTokenLabel = (token: ImagePaletteToken) => ({
    primary: 'Primär',
    background: 'Hintergrund',
    foreground: 'Vordergrund',
}[token]);

export const resolvePaletteBinding = (
    binding: LayoutColorBinding | undefined,
    fallback: string,
    palettes: Record<string, PublisherImagePalette | undefined>,
) => binding ? palettes[binding.imageId]?.[binding.token] ?? fallback : fallback;

export const isLayoutColorBinding = (value: unknown): value is LayoutColorBinding => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.imageId === 'string' && candidate.imageId.length > 0 && candidate.imageId.length <= 200 &&
        ['primary', 'background', 'foreground'].includes(String(candidate.token));
};
