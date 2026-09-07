import { describe, expect, it } from 'vitest';

import { LAYOUT_ELEMENT_IDS, createLayoutGroups, createLayoutOffsets, createLayoutOrder, createLayoutRotations, createLayoutSizes, createLayoutTextStyles, createLayoutVisualStyles } from './layoutEditing';
import { createBlankPublisherPage, createPublisherPage, createStandardPublisherLayout, pageShowsTemplateDecorations } from './publisherPage';

describe('publisher page', () => {
    it('creates independent pages with the requested dimensions and template', () => {
        const first = createPublisherPage(600, 600, 'poster');
        const second = createPublisherPage(1920, 300, 'split');

        expect(first).toMatchObject({ width: 600, height: 600, templateId: 'poster', layouts: {} });
        expect(second).toMatchObject({ width: 1920, height: 300, templateId: 'split', layouts: {} });
        expect(first.id).not.toBe(second.id);
        expect(first.imageFocus).not.toBe(second.imageFocus);
    });

    it('does not reveal standard decorations when appointment data is loaded into a blank page', () => {
        const page = createPublisherPage();
        page.layouts.split = {
            offsets: createLayoutOffsets(),
            sizes: createLayoutSizes('split'),
            rotations: createLayoutRotations(),
            order: createLayoutOrder(),
            styles: createLayoutTextStyles('split'),
            visualStyles: createLayoutVisualStyles('split'),
            groups: createLayoutGroups(),
            deleted: [...LAYOUT_ELEMENT_IDS],
            customElements: [],
        };

        expect(pageShowsTemplateDecorations(page)).toBe(false);
        page.layouts.split.deleted = ['title'];
        expect(pageShowsTemplateDecorations(page)).toBe(true);
    });

    it('creates blank and standard layouts in the actual page dimensions', () => {
        const blank = createBlankPublisherPage(600, 600, 'poster');
        const standard = createStandardPublisherLayout('poster', 600, 600);

        expect(blank.layouts.poster?.sizes.background).toEqual({ width: 600, height: 600 });
        expect(blank.layouts.poster?.order).toEqual([]);
        expect(standard.sizes.background).toEqual({ width: 600, height: 600 });
        expect(standard.order).toEqual(LAYOUT_ELEMENT_IDS);
        expect(standard.styles.location.fontSize).toBeGreaterThanOrEqual(12);
    });
});
