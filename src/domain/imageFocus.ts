import type { TemplateId } from './templates';

export interface ImageFocus {
    x: number;
    y: number;
}

export type ImageFocusByTemplate = Record<TemplateId, ImageFocus>;

export interface ImageDimensions {
    width: number;
    height: number;
}

export const DEFAULT_IMAGE_FOCUS: ImageFocus = { x: 50, y: 50 };

export const createImageFocusByTemplate = (): ImageFocusByTemplate => ({
    split: { ...DEFAULT_IMAGE_FOCUS },
    poster: { ...DEFAULT_IMAGE_FOCUS },
});

export const clampImageFocus = ({ x, y }: ImageFocus): ImageFocus => ({
    x: Math.min(Math.max(x, 0), 100),
    y: Math.min(Math.max(y, 0), 100),
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

    if (imageRatio > frameRatio) {
        const width = image.height * frameRatio;
        return {
            x: (image.width - width) * (normalizedFocus.x / 100),
            y: 0,
            width,
            height: image.height,
        };
    }

    const height = image.width / frameRatio;
    return {
        x: 0,
        y: (image.height - height) * (normalizedFocus.y / 100),
        width: image.width,
        height,
    };
};
