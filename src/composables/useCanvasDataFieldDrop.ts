import { toValue, type MaybeRefOrGetter } from 'vue';

import {
    parsePublisherDataTransfer,
    PUBLISHER_DATA_TRANSFER_TYPE,
} from '../domain/appointmentDataFields';
import type { LayoutCustomElementKind, LayoutTextMode } from '../domain/layoutEditing';

interface CanvasDroppedElementOptions {
    dataBinding?: string;
    imageSource?: string;
    name?: string;
    position?: { x: number; y: number };
    text?: string;
    textMode?: LayoutTextMode;
}

export const useCanvasDataFieldDrop = (
    previewScale: MaybeRefOrGetter<number>,
    addElement: (kind: LayoutCustomElementKind, options: CanvasDroppedElementOptions) => void,
) => {
    const handleDataFieldDrop = (event: DragEvent) => {
        const transferred = parsePublisherDataTransfer(
            event.dataTransfer?.getData(PUBLISHER_DATA_TRANSFER_TYPE) ?? '',
        );
        if (!transferred || (transferred.type === 'image' && !transferred.value)) return;
        const bounds = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect();
        const scale = toValue(previewScale);
        if (!bounds || !Number.isFinite(scale) || scale <= 0) return;
        const preferredOffset = transferred.type === 'image' ? { x: 240, y: 160 } : { x: 260, y: 70 };
        addElement(transferred.type, {
            name: transferred.label,
            imageSource: transferred.type === 'image' ? transferred.value : undefined,
            text: transferred.type === 'text' ? `{{${transferred.id}}}` : undefined,
            textMode: transferred.type === 'text' ? 'frame' : undefined,
            dataBinding: transferred.id,
            position: {
                x: (event.clientX - bounds.left) / scale - preferredOffset.x,
                y: (event.clientY - bounds.top) / scale - preferredOffset.y,
            },
        });
    };

    return { handleDataFieldDrop };
};
