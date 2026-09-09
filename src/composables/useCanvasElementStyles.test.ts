import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import {
    createCustomTextStyle,
    type LayoutCustomElement,
    type LayoutElementId,
    type LayoutTextStyles,
    type LayoutVisualStyles,
} from '../domain/layoutEditing';
import { cloneLayoutState, type SerializableLayoutState } from '../domain/layoutHistory';
import { useCanvasElementStyles } from './useCanvasElementStyles';

describe('useCanvasElementStyles', () => {
    it('updates text colors and line contours through one style command boundary', () => {
        const customElements: LayoutCustomElement[] = [
            { id: 'text-1', kind: 'text', name: 'Text', text: 'Text', frame: { x: 0, y: 0, width: 100, height: 30 } },
            { id: 'shape-line-1', kind: 'line', name: 'Linie', frame: { x: 0, y: 50, width: 100, height: 4 } },
        ];
        const textStyle = createCustomTextStyle();
        textStyle.colorGradient = {
            type: 'linear', startX: 0, startY: 50, endX: 100, endY: 50, startRadius: 0, endRadius: 50,
            stops: [{ id: 'one', offset: 0, color: '#ffffff', opacity: 1 }],
        };
        const layout = {
            customElements,
            effects: {},
            filters: {},
            groups: [],
            order: ['text-1', 'shape-line-1'] as LayoutElementId[],
            sizes: { 'text-1': { width: 100, height: 30 }, 'shape-line-1': { width: 100, height: 4 } },
            styles: { 'text-1': textStyle } as LayoutTextStyles,
            visualStyles: { 'shape-line-1': { fill: '#000000', stroke: '#000000', strokeWidth: 4 } } as LayoutVisualStyles,
        };
        const selectedElements = ref<LayoutElementId[]>(['text-1']);
        const selectedElement = ref<LayoutElementId | null>('text-1');
        const rememberColor = vi.fn();
        const capture = (): SerializableLayoutState => cloneLayoutState({
            ...layout,
            offsets: { 'text-1': { x: 0, y: 0 }, 'shape-line-1': { x: 0, y: 0 } },
            rotations: { 'text-1': 0, 'shape-line-1': 0 },
            deleted: [],
        });
        const styles = useCanvasElementStyles({
            captureLayoutState: capture,
            commitCurrentLayout: vi.fn(),
            elementIsLocked: () => false,
            getActiveCanvasGradient: () => null,
            getCustomElement: (id) => layout.customElements.find((element) => element.id === id),
            getLayout: () => layout,
            loadCustomQr: vi.fn(),
            onLayoutChange: vi.fn(),
            onSelectionDetailsChange: vi.fn(),
            reflowAutoLayoutGroups: vi.fn(),
            rememberColor,
            selectedElement,
            selectedElements,
            setCustomElements: (value) => { layout.customElements = value; },
            setEffects: (value) => { layout.effects = value; },
            setFilters: (value) => { layout.filters = value; },
            setStyles: (value) => { layout.styles = value; },
            syncGraphicTextSize: vi.fn(),
            syncTransformer: vi.fn(async () => undefined),
        });

        styles.setSelectedElementStaticColor('color', '#ABCDEF');
        expect(layout.styles['text-1']?.color).toBe('#abcdef');
        expect(layout.styles['text-1']?.colorGradient).toBeUndefined();
        expect(rememberColor).toHaveBeenCalledWith('#abcdef');

        selectedElements.value = ['shape-line-1'];
        selectedElement.value = 'shape-line-1';
        styles.setSelectedElementVisualStyle('strokeWidth', 11);
        expect(layout.visualStyles['shape-line-1']?.strokeWidth).toBe(11);
        expect(layout.sizes['shape-line-1']?.height).toBe(11);
    });
});
