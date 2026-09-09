// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { PUBLISHER_DATA_TRANSFER_TYPE } from '../domain/appointmentDataFields';
import { useCanvasDataFieldDrop } from './useCanvasDataFieldDrop';

const dropEvent = (payload: object, clientX = 300, clientY = 180) => ({
    clientX,
    clientY,
    currentTarget: { getBoundingClientRect: () => ({ left: 20, top: 20 }) },
    dataTransfer: {
        getData: (type: string) => type === PUBLISHER_DATA_TRANSFER_TYPE ? JSON.stringify(payload) : '',
    },
}) as unknown as DragEvent;

describe('useCanvasDataFieldDrop', () => {
    it('turns a text field drop into a positioned frame-text insertion', () => {
        const addElement = vi.fn();
        const { handleDataFieldDrop } = useCanvasDataFieldDrop(() => 0.5, addElement);

        handleDataFieldDrop(dropEvent({ id: 'sermon', label: 'Predigt', type: 'text', value: 'Ada' }));

        expect(addElement).toHaveBeenCalledWith('text', expect.objectContaining({
            name: 'Predigt', text: '{{sermon}}', textMode: 'frame', dataBinding: 'sermon',
            position: { x: 300, y: 250 },
        }));
    });

    it('ignores invalid payloads and empty image fields', () => {
        const addElement = vi.fn();
        const { handleDataFieldDrop } = useCanvasDataFieldDrop(1, addElement);

        handleDataFieldDrop(dropEvent({ id: '../bad', label: 'Bad', type: 'text', value: 'x' }));
        handleDataFieldDrop(dropEvent({ id: 'image', label: 'Bild', type: 'image', value: '' }));

        expect(addElement).not.toHaveBeenCalled();
    });
});
