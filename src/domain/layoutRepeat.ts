import type { PublisherDataValues } from './appointmentDataFields';
import type { LayoutFrame, LayoutGroup, LayoutGroups, LayoutPoint } from './layoutEditing';

export const MAX_LAYOUT_REPEAT_ITEMS = 100;

export interface LayoutRepeatInstance {
    dataValues: PublisherDataValues;
    index: number;
    key: string;
    offset: LayoutPoint;
}

export interface LayoutRepeatProjection {
    groupFrames: Record<string, LayoutFrame>;
    prototypeFrames: Record<string, LayoutFrame>;
    repeatCounts: Record<string, number>;
}

const groupListValues = (sourceFieldId: string, dataValues: PublisherDataValues) => {
    const candidate = dataValues[sourceFieldId];
    if (!candidate || typeof candidate === 'string') return [];
    return candidate.formatType === 'list'
        ? (candidate.values ?? []).map((value) => value.trim()).filter(Boolean).slice(0, MAX_LAYOUT_REPEAT_ITEMS)
        : [];
};

export const createLayoutRepeatInstances = (
    group: LayoutGroup,
    frame: LayoutFrame,
    dataValues: PublisherDataValues,
    showEmptyPrototype = false,
): LayoutRepeatInstance[] => {
    if (!group.repeat) return [];
    const values = groupListValues(group.repeat.sourceFieldId, dataValues);
    const entries = values.length > 0 ? values : showEmptyPrototype ? ['Beispiel'] : [];
    return entries.map((value, index) => ({
        index,
        key: `${group.id}-repeat-${index}`,
        offset: group.repeat!.axis === 'horizontal'
            ? { x: index * (frame.width + group.repeat!.gap), y: 0 }
            : { x: 0, y: index * (frame.height + group.repeat!.gap) },
        dataValues: {
            ...dataValues,
            [group.repeat!.sourceFieldId]: value,
            [group.repeat!.itemAlias]: value,
            [`${group.repeat!.itemAlias}Index`]: String(index + 1),
        },
    }));
};

const frameUnion = (frames: LayoutFrame[]) => {
    if (frames.length === 0) return null;
    const x = Math.min(...frames.map((frame) => frame.x));
    const y = Math.min(...frames.map((frame) => frame.y));
    const right = Math.max(...frames.map((frame) => frame.x + frame.width));
    const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
    return { x, y, width: right - x, height: bottom - y };
};

export const createLayoutRepeatProjection = (
    groups: LayoutGroups,
    elementFrames: Record<string, LayoutFrame>,
    dataValues: PublisherDataValues,
): LayoutRepeatProjection => {
    const groupFrames: Record<string, LayoutFrame> = {};
    const prototypeFrames: Record<string, LayoutFrame> = {};
    const repeatCounts: Record<string, number> = {};

    const projectGroup = (group: LayoutGroup): LayoutFrame | null => {
        const childFrames = group.children.flatMap((child): LayoutFrame[] => {
            if (typeof child === 'string') return elementFrames[child] ? [elementFrames[child]!] : [];
            const frame = projectGroup(child);
            return frame ? [frame] : [];
        });
        const prototype = frameUnion(childFrames);
        if (!prototype) return null;
        prototypeFrames[group.id] = prototype;
        const count = group.repeat ? groupListValues(group.repeat.sourceFieldId, dataValues).length : 0;
        repeatCounts[group.id] = count;
        const visibleCount = Math.max(1, count);
        const frame = group.repeat?.axis === 'horizontal'
            ? { ...prototype, width: prototype.width * visibleCount + group.repeat.gap * (visibleCount - 1) }
            : group.repeat?.axis === 'vertical'
                ? { ...prototype, height: prototype.height * visibleCount + group.repeat.gap * (visibleCount - 1) }
                : prototype;
        groupFrames[group.id] = frame;
        return frame;
    };

    groups.forEach(projectGroup);
    return { groupFrames, prototypeFrames, repeatCounts };
};
