import type { Ref } from 'vue';

import type { LayoutColorBinding } from '../domain/imagePalette';
import { normalizeLayoutGradient, type LayoutGradient } from '../domain/layoutGradient';
import {
    cloneLayoutFilter,
    normalizeLayoutFilterStack,
    type LayoutFilterStack,
    type LayoutFilters,
} from '../domain/layoutFilters';
import {
    constrainFontSize,
    constrainLetterSpacing,
    constrainLineHeight,
    flattenLayoutGroups,
    isHexColor,
    isShapeLayoutElement,
    isTextLayoutElement,
    layoutElementHasEffects,
    layoutGroupElementIds,
    normalizeLayoutElementEffects,
    type LayoutCustomElement,
    type LayoutElementEffects,
    type LayoutElementId,
    type LayoutGroups,
    type LayoutTextMode,
    type LayoutTextStyle,
    type LayoutTextStyles,
    type LayoutVisualStyle,
} from '../domain/layoutEditing';
import type { SerializableLayoutState } from '../domain/layoutHistory';

export type LayoutColorField = 'color' | 'fill' | 'stroke';

interface CanvasStyleLayout {
    customElements: LayoutCustomElement[];
    effects: NonNullable<SerializableLayoutState['effects']>;
    filters: LayoutFilters;
    groups: LayoutGroups;
    order: LayoutElementId[];
    sizes: SerializableLayoutState['sizes'];
    styles: LayoutTextStyles;
    visualStyles: SerializableLayoutState['visualStyles'];
}

interface ActiveCanvasGradient {
    elementId: LayoutElementId;
    field: 'color' | 'fill';
}

interface UseCanvasElementStylesOptions {
    captureLayoutState: () => SerializableLayoutState;
    commitCurrentLayout: (previousState: SerializableLayoutState) => void;
    elementIsLocked: (elementId: LayoutElementId) => boolean;
    getActiveCanvasGradient: () => ActiveCanvasGradient | null;
    getCustomElement: (elementId: LayoutElementId) => LayoutCustomElement | undefined;
    getLayout: () => CanvasStyleLayout;
    loadCustomQr: (element: LayoutCustomElement) => void;
    onLayoutChange: () => void;
    onSelectionDetailsChange: () => void;
    reflowAutoLayoutGroups: () => void;
    rememberColor: (color: string) => void;
    selectedElement: Readonly<Ref<LayoutElementId | null>>;
    selectedElements: Readonly<Ref<LayoutElementId[]>>;
    setCustomElements: (elements: LayoutCustomElement[]) => void;
    setEffects: (effects: NonNullable<SerializableLayoutState['effects']>) => void;
    setFilters: (filters: LayoutFilters) => void;
    setStyles: (styles: LayoutTextStyles) => void;
    syncGraphicTextSize: (elementId: LayoutElementId) => void;
    syncTransformer: () => Promise<void>;
}

export const useCanvasElementStyles = (options: UseCanvasElementStylesOptions) => {
    let activeGradientEdit: {
        elementId: LayoutElementId;
        field: 'color' | 'fill';
        previousState: SerializableLayoutState;
    } | null = null;
    const layout = () => options.getLayout();
    const selectionContainsLockedElement = () => options.selectedElements.value.some(options.elementIsLocked);
    const finishMutation = (previousState: SerializableLayoutState, details = false) => {
        options.commitCurrentLayout(previousState);
        options.onLayoutChange();
        if (details) options.onSelectionDetailsChange();
    };

    const setSelectedElementTextStyle = (field: keyof LayoutTextStyle, value: number | string) => {
        const selectedElement = options.selectedElement.value;
        if (options.selectedElements.value.length === 0 || selectionContainsLockedElement() || !selectedElement ||
            !isTextLayoutElement(selectedElement)) return;
        const currentStyle = layout().styles[selectedElement];
        const nextValue = field === 'fontSize'
            ? constrainFontSize(Number(value))
            : field === 'lineHeight'
                ? constrainLineHeight(Number(value))
                : field === 'letterSpacing'
                    ? constrainLetterSpacing(Number(value))
                    : field === 'strokeWidth'
                        ? Number(value)
                        : field === 'color' || field === 'stroke'
                            ? String(value).toLowerCase()
                            : String(value);
        const nextStyle = { ...currentStyle, [field]: nextValue } as LayoutTextStyle;
        if (!Number.isFinite(nextStyle.fontSize) || !isHexColor(nextStyle.color) || !isHexColor(nextStyle.stroke) ||
            !Number.isFinite(nextStyle.strokeWidth) || nextStyle.strokeWidth < 0 || nextStyle.strokeWidth > 100 ||
            !nextStyle.fontFamily.trim() || !['normal', 'bold', 'italic', 'bold italic'].includes(nextStyle.fontStyle) ||
            !Number.isFinite(nextStyle.lineHeight) || !Number.isFinite(nextStyle.letterSpacing) ||
            !['left', 'center', 'right'].includes(nextStyle.align) ||
            !['none', 'bullet', 'numbered'].includes(nextStyle.listStyle) ||
            !['none', 'uppercase', 'smallCaps'].includes(nextStyle.textTransform) ||
            !['none', 'single', 'double'].includes(nextStyle.underlineStyle) ||
            !['none', 'single', 'double'].includes(nextStyle.strikethroughStyle)) {
            options.onSelectionDetailsChange();
            return;
        }

        const previousState = options.captureLayoutState();
        options.setStyles(options.selectedElements.value.reduce(
            (styles, elementId) => isTextLayoutElement(elementId)
                ? { ...styles, [elementId]: { ...styles[elementId], [field]: nextStyle[field] } }
                : styles,
            layout().styles,
        ));
        if (field === 'color') {
            options.selectedElements.value.filter(isTextLayoutElement).forEach((elementId) => {
                delete layout().styles[elementId].colorGradient;
            });
        }
        options.selectedElements.value.forEach(options.syncGraphicTextSize);
        options.reflowAutoLayoutGroups();
        finishMutation(previousState);
    };

    const setSelectedElementVisualStyle = (field: keyof LayoutVisualStyle, value: number | string) => {
        const shapeId = options.selectedElement.value;
        if (selectionContainsLockedElement() || !shapeId || !isShapeLayoutElement(shapeId)) return;
        const nextValue = field === 'strokeWidth' ? Number(value) : String(value).toLowerCase();
        if ((field === 'strokeWidth' && (!Number.isFinite(nextValue) || Number(nextValue) < 0 || Number(nextValue) > 100)) ||
            (field !== 'strokeWidth' && !isHexColor(String(nextValue)))) {
            options.onSelectionDetailsChange();
            return;
        }
        const previousState = options.captureLayoutState();
        layout().visualStyles[shapeId] = { ...layout().visualStyles[shapeId], [field]: nextValue };
        if (field === 'fill') delete layout().visualStyles[shapeId].fillGradient;
        const customElement = options.getCustomElement(shapeId);
        if (customElement?.kind === 'line' && field === 'strokeWidth') {
            layout().sizes[shapeId].height = Math.max(1, Number(nextValue));
        }
        if (customElement?.kind === 'qr') options.loadCustomQr(customElement);
        finishMutation(previousState);
    };

    const setSelectedElementColorBinding = (field: LayoutColorField, binding: LayoutColorBinding | null) => {
        if (options.selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
        const previousState = options.captureLayoutState();
        if (field === 'color' || (field === 'stroke' && options.selectedElements.value.some(isTextLayoutElement))) {
            const bindingField = field === 'color' ? 'colorBinding' : 'strokeBinding';
            for (const elementId of options.selectedElements.value.filter(isTextLayoutElement)) {
                const style = layout().styles[elementId];
                if (!style) continue;
                if (binding) style[bindingField] = { ...binding };
                else delete style[bindingField];
                if (binding && field === 'color') delete style.colorGradient;
            }
        } else {
            const bindingField = field === 'fill' ? 'fillBinding' : 'strokeBinding';
            for (const elementId of options.selectedElements.value.filter(isShapeLayoutElement)) {
                const style = layout().visualStyles[elementId];
                if (!style) continue;
                if (binding) style[bindingField] = { ...binding };
                else delete style[bindingField];
                if (binding && field === 'fill') delete style.fillGradient;
                const element = options.getCustomElement(elementId);
                if (element?.kind === 'qr') options.loadCustomQr(element);
            }
        }
        finishMutation(previousState);
    };

    const setSelectedElementStaticColor = (field: LayoutColorField, color: string) => {
        const normalized = color.toLowerCase();
        if (!isHexColor(normalized) || options.selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
        const previousState = options.captureLayoutState();
        if (field === 'color' || (field === 'stroke' && options.selectedElements.value.some(isTextLayoutElement))) {
            const bindingField = field === 'color' ? 'colorBinding' : 'strokeBinding';
            for (const elementId of options.selectedElements.value.filter(isTextLayoutElement)) {
                const style = layout().styles[elementId];
                if (!style) continue;
                style[field] = normalized;
                delete style[bindingField];
                if (field === 'color') delete style.colorGradient;
            }
        } else {
            const bindingField = field === 'fill' ? 'fillBinding' : 'strokeBinding';
            for (const elementId of options.selectedElements.value.filter(isShapeLayoutElement)) {
                const style = layout().visualStyles[elementId];
                if (!style) continue;
                style[field] = normalized;
                delete style[bindingField];
                if (field === 'fill') delete style.fillGradient;
                const element = options.getCustomElement(elementId);
                if (element?.kind === 'qr') options.loadCustomQr(element);
            }
        }
        finishMutation(previousState);
        options.rememberColor(normalized);
    };

    const setSelectedElementGradient = (field: 'color' | 'fill', gradient: LayoutGradient | null) => {
        if (options.selectedElements.value.length === 0 || selectionContainsLockedElement()) return;
        const previousState = options.captureLayoutState();
        if (field === 'color') {
            for (const elementId of options.selectedElements.value.filter(isTextLayoutElement)) {
                const style = layout().styles[elementId];
                if (!style) continue;
                if (gradient) {
                    style.colorGradient = normalizeLayoutGradient(gradient);
                    delete style.colorBinding;
                } else delete style.colorGradient;
            }
        } else {
            for (const elementId of options.selectedElements.value.filter(isShapeLayoutElement)) {
                const element = options.getCustomElement(elementId);
                if (element?.kind === 'qr' || element?.kind === 'line') continue;
                const style = layout().visualStyles[elementId];
                if (!style) continue;
                if (gradient) {
                    style.fillGradient = normalizeLayoutGradient(gradient);
                    delete style.fillBinding;
                } else delete style.fillGradient;
            }
        }
        finishMutation(previousState);
    };

    const beginCanvasGradientEdit = () => {
        const active = options.getActiveCanvasGradient();
        if (!active || activeGradientEdit) return;
        activeGradientEdit = { ...active, previousState: options.captureLayoutState() };
    };

    const updateCanvasGradient = (gradient: LayoutGradient) => {
        const edit = activeGradientEdit;
        if (!edit || options.elementIsLocked(edit.elementId)) return;
        const normalized = normalizeLayoutGradient(gradient);
        if (edit.field === 'color' && isTextLayoutElement(edit.elementId)) {
            const style = layout().styles[edit.elementId];
            if (!style) return;
            style.colorGradient = normalized;
            delete style.colorBinding;
        } else if (edit.field === 'fill' && isShapeLayoutElement(edit.elementId)) {
            const style = layout().visualStyles[edit.elementId];
            if (!style) return;
            style.fillGradient = normalized;
            delete style.fillBinding;
        }
        options.onSelectionDetailsChange();
    };

    const finishCanvasGradientEdit = () => {
        const edit = activeGradientEdit;
        if (!edit) return;
        activeGradientEdit = null;
        finishMutation(edit.previousState);
    };

    const setSelectedElementTextContent = (value: string) => {
        const elementId = options.selectedElement.value;
        if (!elementId || options.elementIsLocked(elementId) || !elementId.startsWith('text-')) return;
        const previousState = options.captureLayoutState();
        options.setCustomElements(layout().customElements.map((element) => element.id === elementId
            ? { ...element, text: value, name: element.dataBinding ? element.name : value.trim() || 'Text' }
            : element));
        options.syncGraphicTextSize(elementId);
        options.reflowAutoLayoutGroups();
        finishMutation(previousState);
    };

    const setSelectedCustomTextMode = (mode: LayoutTextMode) => {
        if ((mode !== 'graphic' && mode !== 'frame') || options.selectedElements.value.length === 0 ||
            selectionContainsLockedElement()) return;
        const customTextIds = options.selectedElements.value.filter((elementId) =>
            options.getCustomElement(elementId)?.kind === 'text');
        if (customTextIds.length === 0) return;
        const previousState = options.captureLayoutState();
        const ids = new Set(customTextIds);
        options.setCustomElements(layout().customElements.map((element) =>
            ids.has(element.id) ? { ...element, textMode: mode } : element));
        if (mode === 'graphic') customTextIds.forEach(options.syncGraphicTextSize);
        options.reflowAutoLayoutGroups();
        finishMutation(previousState, true);
        void options.syncTransformer();
    };

    const setSelectedQrOptions = (
        field: 'qrValue' | 'qrBackground' | 'qrMargin' | 'qrErrorCorrection',
        value: string | number,
    ) => {
        const elementId = options.selectedElement.value;
        const element = elementId ? options.getCustomElement(elementId) : null;
        if (!element || element.kind !== 'qr') return;
        const nextValue = field === 'qrMargin' ? Number(value) : String(value);
        if ((field === 'qrMargin' && (!Number.isFinite(nextValue) || Number(nextValue) < 0 || Number(nextValue) > 10)) ||
            (field === 'qrBackground' && !isHexColor(String(nextValue))) ||
            (field === 'qrErrorCorrection' && !['L', 'M', 'Q', 'H'].includes(String(nextValue))) ||
            (field === 'qrValue' && String(nextValue).length > 10_000)) return;
        const previousState = options.captureLayoutState();
        let updated: LayoutCustomElement | null = null;
        options.setCustomElements(layout().customElements.map((candidate) => {
            if (candidate.id !== elementId) return candidate;
            if (field === 'qrValue') {
                const { dataBinding: _, ...unboundCandidate } = candidate;
                updated = { ...unboundCandidate, qrValue: String(nextValue) };
            } else updated = { ...candidate, [field]: nextValue };
            return updated;
        }));
        if (updated) options.loadCustomQr(updated);
        finishMutation(previousState);
    };

    const setElementEffects = (targetIds: string[], effects: LayoutElementEffects) => {
        const groupsById = new Map(flattenLayoutGroups(layout().groups).map((group) => [group.id, group]));
        const existingIds = targetIds.filter((targetId) => {
            const group = groupsById.get(targetId);
            return group
                ? !layoutGroupElementIds(group).some(options.elementIsLocked)
                : layout().order.includes(targetId as LayoutElementId) && !options.elementIsLocked(targetId as LayoutElementId);
        });
        if (existingIds.length === 0) return;
        const previousState = options.captureLayoutState();
        const nextEffects = { ...layout().effects };
        const normalized = normalizeLayoutElementEffects(effects);
        for (const elementId of existingIds) {
            if (layoutElementHasEffects(normalized)) {
                nextEffects[elementId] = {
                    ...normalized,
                    shadow: { ...normalized.shadow },
                    blur: { ...normalized.blur },
                };
            } else delete nextEffects[elementId];
        }
        options.setEffects(nextEffects);
        finishMutation(previousState);
    };

    const setElementFilters = (targetIds: string[], filters: LayoutFilterStack) => {
        const groupsById = new Map(flattenLayoutGroups(layout().groups).map((group) => [group.id, group]));
        const existingIds = targetIds.filter((targetId) => {
            const group = groupsById.get(targetId);
            return group
                ? !layoutGroupElementIds(group).some(options.elementIsLocked)
                : layout().order.includes(targetId as LayoutElementId) && !options.elementIsLocked(targetId as LayoutElementId);
        });
        if (existingIds.length === 0) return;
        const previousState = options.captureLayoutState();
        const nextFilters = { ...layout().filters };
        const normalized = normalizeLayoutFilterStack(filters);
        for (const targetId of existingIds) {
            if (normalized.some(({ enabled }) => enabled)) nextFilters[targetId] = normalized.map(cloneLayoutFilter);
            else delete nextFilters[targetId];
        }
        options.setFilters(nextFilters);
        finishMutation(previousState);
    };

    return {
        beginCanvasGradientEdit,
        finishCanvasGradientEdit,
        setElementEffects,
        setElementFilters,
        setSelectedCustomTextMode,
        setSelectedElementColorBinding,
        setSelectedElementGradient,
        setSelectedElementStaticColor,
        setSelectedElementTextContent,
        setSelectedElementTextStyle,
        setSelectedElementVisualStyle,
        setSelectedQrOptions,
        updateCanvasGradient,
    };
};
