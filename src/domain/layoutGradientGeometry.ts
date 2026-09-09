import type { LayoutFrame, LayoutPoint } from './layoutEditing';
import { normalizeLayoutGradient, type LayoutGradient } from './layoutGradient';

export interface LayoutGradientCoordinateSpace {
    frame: LayoutFrame;
    rotation: number;
    rotationOrigin?: LayoutPoint;
}

export interface LayoutGradientCanvasGeometry {
    end: LayoutPoint;
    endRadiusHandle: LayoutPoint;
    guideEnd: LayoutPoint;
    guideStart: LayoutPoint;
    start: LayoutPoint;
    startRadiusHandle: LayoutPoint;
    stops: { id: string; point: LayoutPoint }[];
}

const rotatePoint = (point: LayoutPoint, origin: LayoutPoint, rotation: number): LayoutPoint => {
    const radians = rotation * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const relativeX = point.x - origin.x;
    const relativeY = point.y - origin.y;
    return {
        x: origin.x + relativeX * cosine - relativeY * sine,
        y: origin.y + relativeX * sine + relativeY * cosine,
    };
};

const rotationOrigin = ({ frame, rotationOrigin: origin }: LayoutGradientCoordinateSpace) =>
    origin ?? { x: frame.x, y: frame.y };

const unrotatedPercentPoint = (frame: LayoutFrame, x: number, y: number): LayoutPoint => ({
    x: frame.x + frame.width * x / 100,
    y: frame.y + frame.height * y / 100,
});

export const gradientPercentPointToDocument = (
    space: LayoutGradientCoordinateSpace,
    point: { x: number; y: number },
) => rotatePoint(
    unrotatedPercentPoint(space.frame, point.x, point.y),
    rotationOrigin(space),
    space.rotation,
);

export const documentPointToGradientPercent = (
    space: LayoutGradientCoordinateSpace,
    point: LayoutPoint,
) => {
    const local = rotatePoint(point, rotationOrigin(space), -space.rotation);
    return {
        x: (local.x - space.frame.x) / Math.max(1, space.frame.width) * 100,
        y: (local.y - space.frame.y) / Math.max(1, space.frame.height) * 100,
    };
};

const vectorUnit = (start: LayoutPoint, end: LayoutPoint): LayoutPoint => {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    return distance > 0.001
        ? { x: (end.x - start.x) / distance, y: (end.y - start.y) / distance }
        : { x: 1, y: 0 };
};

const interpolatePoint = (start: LayoutPoint, end: LayoutPoint, offset: number): LayoutPoint => ({
    x: start.x + (end.x - start.x) * offset,
    y: start.y + (end.y - start.y) * offset,
});

export const layoutGradientCanvasGeometry = (
    source: LayoutGradient,
    space: LayoutGradientCoordinateSpace,
): LayoutGradientCanvasGeometry => {
    const gradient = normalizeLayoutGradient(source);
    const unrotatedStart = unrotatedPercentPoint(space.frame, gradient.startX, gradient.startY);
    const unrotatedEnd = unrotatedPercentPoint(space.frame, gradient.endX, gradient.endY);
    const direction = vectorUnit(unrotatedStart, unrotatedEnd);
    const radiusScale = Math.max(space.frame.width, space.frame.height) / 100;
    const unrotatedStartRadiusHandle = {
        x: unrotatedStart.x + direction.x * gradient.startRadius * radiusScale,
        y: unrotatedStart.y + direction.y * gradient.startRadius * radiusScale,
    };
    const unrotatedEndRadiusHandle = {
        x: unrotatedEnd.x + direction.x * gradient.endRadius * radiusScale,
        y: unrotatedEnd.y + direction.y * gradient.endRadius * radiusScale,
    };
    const origin = rotationOrigin(space);
    const start = rotatePoint(unrotatedStart, origin, space.rotation);
    const end = rotatePoint(unrotatedEnd, origin, space.rotation);
    const startRadiusHandle = rotatePoint(unrotatedStartRadiusHandle, origin, space.rotation);
    const endRadiusHandle = rotatePoint(unrotatedEndRadiusHandle, origin, space.rotation);
    const guideStart = gradient.type === 'radial' ? startRadiusHandle : start;
    const guideEnd = gradient.type === 'radial' ? endRadiusHandle : end;
    return {
        start,
        end,
        startRadiusHandle,
        endRadiusHandle,
        guideStart,
        guideEnd,
        stops: gradient.stops.map((stop) => ({
            id: stop.id,
            point: interpolatePoint(guideStart, guideEnd, stop.offset),
        })),
    };
};

export const updateLayoutGradientPoint = (
    source: LayoutGradient,
    space: LayoutGradientCoordinateSpace,
    target: 'start' | 'end',
    point: LayoutPoint,
) => {
    const percentage = documentPointToGradientPercent(space, point);
    return normalizeLayoutGradient({
        ...source,
        ...(target === 'start'
            ? { startX: percentage.x, startY: percentage.y }
            : { endX: percentage.x, endY: percentage.y }),
    });
};

export const updateLayoutGradientRadius = (
    source: LayoutGradient,
    space: LayoutGradientCoordinateSpace,
    target: 'start' | 'end',
    point: LayoutPoint,
) => {
    const gradient = normalizeLayoutGradient(source);
    const localPoint = rotatePoint(point, rotationOrigin(space), -space.rotation);
    const center = target === 'start'
        ? unrotatedPercentPoint(space.frame, gradient.startX, gradient.startY)
        : unrotatedPercentPoint(space.frame, gradient.endX, gradient.endY);
    const radius = Math.hypot(localPoint.x - center.x, localPoint.y - center.y)
        / Math.max(1, Math.max(space.frame.width, space.frame.height)) * 100;
    return normalizeLayoutGradient({
        ...gradient,
        ...(target === 'start' ? { startRadius: radius } : { endRadius: radius }),
    });
};

export const updateLayoutGradientStopOffset = (
    source: LayoutGradient,
    space: LayoutGradientCoordinateSpace,
    stopId: string,
    point: LayoutPoint,
) => {
    const geometry = layoutGradientCanvasGeometry(source, space);
    const delta = {
        x: geometry.guideEnd.x - geometry.guideStart.x,
        y: geometry.guideEnd.y - geometry.guideStart.y,
    };
    const lengthSquared = delta.x ** 2 + delta.y ** 2;
    const offset = lengthSquared > 0.001
        ? Math.min(1, Math.max(0, (
            (point.x - geometry.guideStart.x) * delta.x +
            (point.y - geometry.guideStart.y) * delta.y
        ) / lengthSquared))
        : 0;
    return normalizeLayoutGradient({
        ...source,
        stops: source.stops.map((stop) => stop.id === stopId ? { ...stop, offset } : stop),
    });
};
