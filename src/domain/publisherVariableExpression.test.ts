import { describe, expect, it } from 'vitest';

import {
    createPublisherVariableExpression,
    parsePublisherVariableExpression,
    resolvePublisherPlaceholders,
} from './publisherVariableExpression';

describe('publisher variable expressions', () => {
    it('parses and serializes bounded version-one pipelines', () => {
        const expression = createPublisherVariableExpression('location', [
            { name: 'trim', arguments: [] },
            { name: 'default', arguments: ["Ort folgt's"] },
        ]);

        expect(expression).toBe("{{location|v1|trim|default:'Ort folgt\\'s'}}");
        expect(parsePublisherVariableExpression(expression)).toEqual({
            fieldId: 'location',
            version: 1,
            transforms: [
                { name: 'trim', arguments: [] },
                { name: 'default', arguments: ["Ort folgt's"] },
            ],
        });
        expect(parsePublisherVariableExpression('{{location|v2|trim}}')).toBeNull();
    });

    it('keeps legacy placeholders compatible and accepts readable quoted syntax', () => {
        const values = {
            date: {
                value: '15. August 2026', formatType: 'date' as const,
                rawValue: '2026-08-15T17:30:00Z', locale: 'de-DE', timeZone: 'Europe/Berlin',
            },
        };

        expect(resolvePublisherPlaceholders('{{date|date:DD.MM.YYYY}}', values)).toBe('15.08.2026');
        expect(resolvePublisherPlaceholders("{{ date | v1 | date:'D. MMM' | upper }}", values)).toBe('15. AUG');
    });

    it('uses explicit fallbacks for empty and unavailable variables', () => {
        expect(resolvePublisherPlaceholders(
            "{{location|v1|trim|default:'Ort folgt'}} / {{missing|v1|default:'Noch offen'}}",
            { location: '   ' },
        )).toBe('Ort folgt / Noch offen');
        expect(resolvePublisherPlaceholders('{{missing}}', {})).toBe('{{missing}}');
    });

    it('supports predefined conditions without evaluating code', () => {
        const values = { canceled: 'Ja', title: 'Familiengottesdienst' };

        expect(resolvePublisherPlaceholders(
            "{{canceled|v1|if:'equals','Ja','ABGESAGT',''}}",
            values,
        )).toBe('ABGESAGT');
        expect(resolvePublisherPlaceholders(
            "{{title|v1|if:'contains','Familie','Für Familien'}}",
            values,
        )).toBe('Für Familien');
        expect(resolvePublisherPlaceholders(
            "{{title|v1|if:'contains','Jugend','Jugendabend'}}",
            values,
        )).toBe('Familiengottesdienst');
    });

    it('formats locale-aware decimals, currency and percentages', () => {
        const values = {
            seats: { value: '1234,5', rawValue: '1234.5', formatType: 'number' as const, locale: 'de-DE' },
            ratio: { value: '0.875', formatType: 'number' as const, locale: 'de-DE' },
        };

        expect(resolvePublisherPlaceholders("{{seats|v1|number:'decimal','2','2'}}", values)).toBe('1.234,50');
        expect(resolvePublisherPlaceholders("{{seats|v1|number:'currency','EUR','2','2'}}", values))
            .toMatch(/^1\.234,50\s€$/);
        expect(resolvePublisherPlaceholders("{{ratio|v1|number:'percent','0','1'}}", values)).toBe('87,5 %');
    });

    it('preserves malformed or unsupported-version expressions', () => {
        expect(resolvePublisherPlaceholders('{{title|v2|upper}}', { title: 'Fest' })).toBe('{{title|v2|upper}}');
        expect(resolvePublisherPlaceholders("{{title|v1|default:'offen}}", { title: '' })).toBe("{{title|v1|default:'offen}}");
    });
});
