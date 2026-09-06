import { describe, expect, it } from 'vitest';

import type { EventTemplateProps } from './EventTemplateProps';
import { applyTemplateOverrides, withTemplateOverride } from './templateOverrides';

const sourceTemplate: EventTemplateProps = {
    title: 'Sommerfest',
    date: '15. August 2026',
    time: '19:30',
    location: 'Gemeindehaus',
    imageUrl: 'https://example.test/event.jpg',
};

describe('template overrides', () => {
    it('overrides individual display values without changing the source template', () => {
        const result = applyTemplateOverrides(sourceTemplate, { title: 'Fest für alle', time: '' });

        expect(result).toEqual({ ...sourceTemplate, title: 'Fest für alle', time: '' });
        expect(sourceTemplate.title).toBe('Sommerfest');
    });

    it('removes an override when the value matches the mapped source again', () => {
        const result = withTemplateOverride(
            sourceTemplate,
            { title: 'Fest für alle', location: 'Kirchplatz' },
            'title',
            'Sommerfest',
        );

        expect(result).toEqual({ location: 'Kirchplatz' });
    });

    it('supports appointment fields that are not part of the built-in template', () => {
        expect(withTemplateOverride(
            { subtitle: 'Original' },
            {},
            'subtitle',
            'Bearbeitet',
        )).toEqual({ subtitle: 'Bearbeitet' });
    });
});
