export const MAX_LOCAL_IMAGE_SIZE = 20 * 1024 * 1024;

const SUPPORTED_LOCAL_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

export const validateLocalImage = ({ type, size }: Pick<File, 'type' | 'size'>): string | null => {
    if (!SUPPORTED_LOCAL_IMAGE_TYPES.has(type)) {
        return 'Bitte wähle ein Bild im Format JPEG, PNG oder WebP aus.';
    }

    if (size > MAX_LOCAL_IMAGE_SIZE) {
        return 'Das ausgewählte Bild darf höchstens 20 MB groß sein.';
    }

    return null;
};
