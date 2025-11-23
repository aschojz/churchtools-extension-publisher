import ColorThief from 'colorthief';
import { ref } from 'vue';

export default function useImage() {
    const colors = ref<string[]>([]);
    const dominantColor = ref('');

    const getColorsFromImage = (imageEl?: HTMLImageElement): Promise<void> => {
        colors.value = [];
        dominantColor.value = '';
        return new Promise((resolve, reject) => {
            if (imageEl) {
                const handleExtract = () => {
                    try {
                        extractColors(imageEl);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                if (imageEl.complete) {
                    handleExtract();
                } else {
                    imageEl.addEventListener('load', handleExtract, { once: true });
                    imageEl.addEventListener('error', reject, { once: true });
                }
            } else {
                resolve();
            }
        });
    };

    const rgbToHex = (rgbArray: number[]) =>
        '#' +
        rgbArray
            .map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            })
            .join('');

    const extractColors = (image: HTMLElement) => {
        const colorThief = new ColorThief();
        const color = colorThief.getColor(image);
        const palette = colorThief.getPalette(image, 15);
        dominantColor.value = rgbToHex(color);
        colors.value = palette.map((c: number[]) => rgbToHex(c));
    };

    return { colors, dominantColor, getColorsFromImage };
}
