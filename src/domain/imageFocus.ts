import type { TemplateId } from './templates';

export interface ImageFocus {
    x: number;
    y: number;
    zoom: number;
}

export type ImageFocusByTemplate = Record<TemplateId, ImageFocus>;

export interface ImageDimensions {
    width: number;
    height: number;
}

export const DEFAULT_IMAGE_FOCUS: ImageFocus = { x: 50, y: 50, zoom: 100 };

export const createImageFocusByTemplate = (): ImageFocusByTemplate => ({
    split: { ...DEFAULT_IMAGE_FOCUS },
    poster: { ...DEFAULT_IMAGE_FOCUS },
});

export const clampImageFocus = ({ x, y, zoom }: ImageFocus): ImageFocus => ({
    x: Math.min(Math.max(x, 0), 100),
    y: Math.min(Math.max(y, 0), 100),
    zoom: Math.min(Math.max(zoom, 100), 300),
});

export const calculateCoverCrop = (
    image: ImageDimensions,
    frame: ImageDimensions,
    focus: ImageFocus,
) => {
    if (image.width <= 0 || image.height <= 0 || frame.width <= 0 || frame.height <= 0) {
        return null;
    }

    const normalizedFocus = clampImageFocus(focus);
    const imageRatio = image.width / image.height;
    const frameRatio = frame.width / frame.height;

    const baseWidth = imageRatio > frameRatio ? image.height * frameRatio : image.width;
    const baseHeight = imageRatio > frameRatio ? image.height : image.width / frameRatio;
    const zoomFactor = normalizedFocus.zoom / 100;
    const width = baseWidth / zoomFactor;
    const height = baseHeight / zoomFactor;
    return {
        x: (image.width - width) * (normalizedFocus.x / 100),
        y: (image.height - height) * (normalizedFocus.y / 100),
        width,
        height,
    };
};
