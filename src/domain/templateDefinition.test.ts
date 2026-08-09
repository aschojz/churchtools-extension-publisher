import { describe, expect, it } from 'vitest';

import {
    BUILT_IN_TEMPLATE_DEFINITIONS,
    parseTemplateDefinition,
    serializeTemplateDefinition,
} from './templateDefinition';

describe('template definition', () => {
    it.each(['split', 'poster'] as const)('round-trips the built-in %s template', (templateId) => {
        const definition = BUILT_IN_TEMPLATE_DEFINITIONS[templateId];

        expect(parseTemplateDefinition(serializeTemplateDefinition(definition))).toEqual(definition);
    });

    it('rejects unsupported versions and elements outside the document', () => {
        const definition = BUILT_IN_TEMPLATE_DEFINITIONS.split;
        expect(parseTemplateDefinition(JSON.stringify({ ...definition, version: 2 }))).toBeNull();
        expect(parseTemplateDefinition(JSON.stringify({
            ...definition,
            elements: {
                ...definition.elements,
                title: {
                    ...definition.elements.title,
                    frame: { ...definition.elements.title.frame, x: 1900 },
                },
            },
        }))).toBeNull();
    });

    it('rejects invalid bindings and colors', () => {
        const definition = BUILT_IN_TEMPLATE_DEFINITIONS.poster;
        expect(parseTemplateDefinition(JSON.stringify({
            ...definition,
            elements: {
                ...definition.elements,
                title: {
                    ...definition.elements.title,
                    binding: 'location',
                    style: { ...definition.elements.title.style, color: 'white' },
                },
            },
        }))).toBeNull();
    });

    it('rejects text sizes outside the editor limits', () => {
        const definition = BUILT_IN_TEMPLATE_DEFINITIONS.split;
        expect(parseTemplateDefinition(JSON.stringify({
            ...definition,
            elements: {
                ...definition.elements,
                title: {
                    ...definition.elements.title,
                    style: { ...definition.elements.title.style, fontSize: 500 },
                },
            },
        }))).toBeNull();
    });

    it('rejects invalid or duplicate decoration layers', () => {
        const definition = BUILT_IN_TEMPLATE_DEFINITIONS.poster;
        expect(parseTemplateDefinition(JSON.stringify({
            ...definition,
            composition: {
                ...definition.composition,
                decorations: definition.composition.decorations.map((decoration) =>
                    decoration.id === 'overlay' ? { ...decoration, opacity: 2 } : decoration,
                ),
            },
        }))).toBeNull();
        expect(parseTemplateDefinition(JSON.stringify({
            ...definition,
            composition: {
                ...definition.composition,
                decorations: [
                    definition.composition.decorations[0],
                    definition.composition.decorations[0],
                ],
            },
        }))).toBeNull();
    });
});
