import type { EventTemplateProps } from './EventTemplateProps';

export type EditableTemplateField = string;
export type EventTemplateOverrides = Record<string, string>;

export const applyTemplateOverrides = (
    template: EventTemplateProps,
    overrides: EventTemplateOverrides,
): EventTemplateProps => ({
    ...template,
    ...overrides,
});

export const withTemplateOverride = (
    template: object,
    overrides: EventTemplateOverrides,
    field: string,
    value: string,
): EventTemplateOverrides => {
    const nextOverrides = { ...overrides };

    if (value === (template as Record<string, string | null>)[field]) {
        delete nextOverrides[field];
    } else {
        nextOverrides[field] = value;
    }

    return nextOverrides;
};
