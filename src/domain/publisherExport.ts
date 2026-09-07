import type { PublisherPage } from './publisherPage';

export type PublisherExportFormat = 'png' | 'jpeg';

export interface PublisherPageExportSettings {
    pageId: string;
    enabled: boolean;
    format: PublisherExportFormat;
    jpegQuality: number;
}

export interface PublisherCanvasExportOptions {
    format: PublisherExportFormat;
    quality: number;
}

export const createPublisherExportSettings = (
    pages: PublisherPage[],
    current: PublisherPageExportSettings[] = [],
): PublisherPageExportSettings[] => pages.map((page) => {
    const existing = current.find(({ pageId }) => pageId === page.id);
    return existing ? { ...existing } : {
        pageId: page.id,
        enabled: true,
        format: 'png',
        jpegQuality: 90,
    };
});

export const updatePublisherExportSettings = (
    settings: PublisherPageExportSettings[],
    pageId: string,
    change: Partial<Omit<PublisherPageExportSettings, 'pageId'>>,
) => settings.map((entry) => entry.pageId === pageId ? {
    ...entry,
    ...change,
    jpegQuality: Math.min(100, Math.max(10, Math.round(change.jpegQuality ?? entry.jpegQuality))),
} : entry);

export const publisherExportExtension = (format: PublisherExportFormat) => format === 'jpeg' ? 'jpg' : 'png';
