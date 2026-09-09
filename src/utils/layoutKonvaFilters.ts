import type Konva from 'konva';
import type { Filter } from 'konva/lib/Node';
import { Brighten } from 'konva/lib/filters/Brighten';
import { Contrast } from 'konva/lib/filters/Contrast';
import { Grayscale } from 'konva/lib/filters/Grayscale';
import { HSL } from 'konva/lib/filters/HSL';
import { Invert } from 'konva/lib/filters/Invert';
import { Noise } from 'konva/lib/filters/Noise';
import { Pixelate } from 'konva/lib/filters/Pixelate';
import { Sepia } from 'konva/lib/filters/Sepia';

import { normalizeLayoutFilterStack, type LayoutFilterStack, type LayoutFilterType } from '../domain/layoutFilters';

const FILTERS: Record<LayoutFilterType, Filter> = {
    brightness: Brighten,
    contrast: Contrast,
    hsl: HSL,
    grayscale: Grayscale,
    sepia: Sepia,
    invert: Invert,
    pixelate: Pixelate,
    noise: Noise,
};

export const layoutKonvaFilterFunctions = (filters: LayoutFilterStack) =>
    normalizeLayoutFilterStack(filters)
        .filter(({ enabled }) => enabled)
        .map(({ type }) => FILTERS[type]!);

export const configureLayoutKonvaFilterValues = (node: Konva.Node, filters: LayoutFilterStack) => {
    node.brightness(0);
    node.contrast(0);
    node.hue(0);
    node.saturation(0);
    node.luminance(0);
    node.pixelSize(8);
    node.noise(0);

    for (const filter of normalizeLayoutFilterStack(filters)) {
        if (!filter.enabled) continue;
        switch (filter.type) {
            case 'brightness': node.brightness(filter.amount); break;
            case 'contrast': node.contrast(filter.amount); break;
            case 'hsl':
                node.hue(filter.hue);
                node.saturation(filter.saturation);
                node.luminance(filter.luminance);
                break;
            case 'pixelate': node.pixelSize(filter.size); break;
            case 'noise': node.noise(filter.amount); break;
            case 'grayscale':
            case 'sepia':
            case 'invert':
                break;
        }
    }
};
