import { Group } from 'konva/lib/Group';
import { Brighten } from 'konva/lib/filters/Brighten';
import { Sepia } from 'konva/lib/filters/Sepia';
import { describe, expect, it } from 'vitest';

import { createLayoutFilterStack } from '../domain/layoutFilters';
import { configureLayoutKonvaFilterValues, layoutKonvaFilterFunctions } from './layoutKonvaFilters';

describe('Konva layout filter adapter', () => {
    it('keeps enabled filters in their configured render order', () => {
        const filters = createLayoutFilterStack();
        filters.find(({ type }) => type === 'sepia')!.enabled = true;
        filters.find(({ type }) => type === 'brightness')!.enabled = true;
        const sepia = filters.splice(filters.findIndex(({ type }) => type === 'sepia'), 1)[0]!;
        filters.unshift(sepia);

        const functions = layoutKonvaFilterFunctions(filters);
        expect(functions).toEqual([Sepia, Brighten]);
    });

    it('maps normalized filter values to Konva node attributes', () => {
        const filters = createLayoutFilterStack();
        const brightness = filters.find(({ type }) => type === 'brightness')!;
        const contrast = filters.find(({ type }) => type === 'contrast')!;
        const hsl = filters.find(({ type }) => type === 'hsl')!;
        const pixelate = filters.find(({ type }) => type === 'pixelate')!;
        const noise = filters.find(({ type }) => type === 'noise')!;
        Object.assign(brightness, { enabled: true, amount: 0.25 });
        Object.assign(contrast, { enabled: true, amount: 30 });
        Object.assign(hsl, { enabled: true, hue: 45, saturation: 0.4, luminance: -0.2 });
        Object.assign(pixelate, { enabled: true, size: 12 });
        Object.assign(noise, { enabled: true, amount: 0.15 });
        const node = new Group();

        configureLayoutKonvaFilterValues(node, filters);

        expect(node.getAttrs()).toMatchObject({
            brightness: 0.25,
            contrast: 30,
            hue: 45,
            saturation: 0.4,
            luminance: -0.2,
            pixelSize: 12,
            noise: 0.15,
        });
    });
});
