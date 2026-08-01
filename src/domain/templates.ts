export const TEMPLATE_OPTIONS = [
    { id: 'split', label: 'Geteilte Fläche' },
    { id: 'poster', label: 'Bildposter' },
] as const;

export type TemplateId = (typeof TEMPLATE_OPTIONS)[number]['id'];
