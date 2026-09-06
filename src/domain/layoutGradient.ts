import type { LayoutFrame } from './layoutEditing';

export type LayoutGradientType = 'linear' | 'radial';

export interface LayoutGradientStop {
    id: string;
    offset: number;
    color: string;
    opacity: number;
}

export interface LayoutGradient {
    type: LayoutGradientType;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startRadius: number;
    endRadius: number;
    stops: LayoutGradientStop[];
}

const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export const createLayoutGradient = (color = '#69a7e8'): LayoutGradient => ({
    type: 'linear',
    startX: 0,
    startY: 50,
    endX: 100,
    endY: 50,
    startRadius: 0,
    endRadius: 50,
    stops: [
        { id: 'gradient-stop-0', offset: 0, color, opacity: 1 },
        { id: 'gradient-stop-1', offset: 1, color: '#ffffff', opacity: 1 },
    ],
});

export const normalizeLayoutGradient = (gradient: LayoutGradient): LayoutGradient => ({
    type: gradient.type === 'radial' ? 'radial' : 'linear',
    startX: clamp(gradient.startX, -1000, 1000),
    startY: clamp(gradient.startY, -1000, 1000),
    endX: clamp(gradient.endX, -1000, 1000),
    endY: clamp(gradient.endY, -1000, 1000),
    startRadius: clamp(gradient.startRadius, 0, 1000),
    endRadius: clamp(gradient.endRadius, 0, 1000),
    stops: gradient.stops
        .map((stop, index) => ({
            id: stop.id || `gradient-stop-${index}`,
            offset: clamp(stop.offset, 0, 1),
            color: /^#[0-9a-f]{6}$/i.test(stop.color) ? stop.color.toLowerCase() : '#000000',
            opacity: clamp(stop.opacity, 0, 1),
        }))
        .sort((left, right) => left.offset - right.offset),
});

const colorWithOpacity = (color: string, opacity: number) => {
    const value = color.replace('#', '');
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

export const layoutGradientCss = (gradient: LayoutGradient) => {
    const normalized = normalizeLayoutGradient(gradient);
    const stops = normalized.stops.map((stop) =>
        `${colorWithOpacity(stop.color, stop.opacity)} ${Math.round(stop.offset * 100)}%`).join(', ');
    return normalized.type === 'radial'
        ? `radial-gradient(circle, ${stops})`
        : `linear-gradient(90deg, ${stops})`;
};

export const layoutGradientFillConfig = (gradient: LayoutGradient, frame: LayoutFrame) => {
    const normalized = normalizeLayoutGradient(gradient);
    const point = (x: number, y: number) => ({ x: frame.width * x / 100, y: frame.height * y / 100 });
    const colorStops = normalized.stops.flatMap((stop) => [
        stop.offset,
        colorWithOpacity(stop.color, stop.opacity),
    ]);
    if (normalized.type === 'radial') {
        const radiusScale = Math.max(frame.width, frame.height) / 100;
        return {
            fill: undefined,
            fillRadialGradientStartPoint: point(normalized.startX, normalized.startY),
            fillRadialGradientEndPoint: point(normalized.endX, normalized.endY),
            fillRadialGradientStartRadius: normalized.startRadius * radiusScale,
            fillRadialGradientEndRadius: normalized.endRadius * radiusScale,
            fillRadialGradientColorStops: colorStops,
        };
    }
    return {
        fill: undefined,
        fillLinearGradientStartPoint: point(normalized.startX, normalized.startY),
        fillLinearGradientEndPoint: point(normalized.endX, normalized.endY),
        fillLinearGradientColorStops: colorStops,
    };
};
