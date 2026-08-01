export const DOCUMENT_WIDTH = 1920;
export const DOCUMENT_HEIGHT = 1080;

export const calculatePreviewScale = (containerWidth: number, zoomFactor = 1) =>
    Math.min(Math.max(containerWidth, 1) / DOCUMENT_WIDTH, 1) * Math.max(zoomFactor, 0.01);
