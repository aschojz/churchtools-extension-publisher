import type { EventTemplateProps } from './EventTemplateProps';

export type EditableTemplateField = 'title' | 'date' | 'time' | 'location';
export type EventTemplateOverrides = Partial<Pick<EventTemplateProps, EditableTemplateField>>;

export const applyTemplateOverrides = (
    template: EventTemplateProps,
    overrides: EventTemplateOverrides,
): EventTemplateProps => ({
    ...template,
    ...overrides,
});

export const withTemplateOverride = (
    template: EventTemplateProps,
    overrides: EventTemplateOverrides,
    field: EditableTemplateField,
    value: string,
): EventTemplateOverrides => {
    const nextOverrides = { ...overrides };

    if (value === template[field]) {
        delete nextOverrides[field];
    } else {
        nextOverrides[field] = value;
    }

    return nextOverrides;
};
