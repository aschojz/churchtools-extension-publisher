import {
    BUILT_IN_TEMPLATE_DEFINITIONS,
    BUILT_IN_TEMPLATE_IDS,
    type BuiltInTemplateId,
} from './templateDefinition';

export type TemplateId = BuiltInTemplateId;

export const TEMPLATE_OPTIONS = BUILT_IN_TEMPLATE_IDS.map((id) => ({
    id,
    label: BUILT_IN_TEMPLATE_DEFINITIONS[id].name,
}));
