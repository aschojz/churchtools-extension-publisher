export const DOCUMENT_WIDTH = 1920;
export const DOCUMENT_HEIGHT = 1080;

export const calculatePreviewScale = (
    containerWidth: number,
    zoomFactor = 1,
    documentWidth = DOCUMENT_WIDTH,
) => Math.min(Math.max(containerWidth, 1) / Math.max(documentWidth, 1), 1) * Math.max(zoomFactor, 0.01);
