import { describe, expect, it } from 'vitest';

import type { LayoutGroup } from './layoutEditing';
import { createLayoutRepeatInstances, createLayoutRepeatProjection, MAX_LAYOUT_REPEAT_ITEMS } from './layoutRepeat';

const group: LayoutGroup = {
    id: 'speakers',
    children: ['title', 'accent'],
    repeat: { sourceFieldId: 'eventService-12', itemAlias: 'person', axis: 'vertical', gap: 8 },
};

describe('layout repeat projection', () => {
    it('creates a scoped canvas instance for every list entry', () => {
        const frame = { x: 20, y: 40, width: 200, height: 50 };
        const values = {
            'eventService-12': {
                value: 'Ada Lovelace, Grace Hopper', values: ['Ada Lovelace', 'Grace Hopper'],
                formatType: 'list' as const,
            },
        };

        const instances = createLayoutRepeatInstances(group, frame, values);

        expect(instances.map(({ offset }) => offset)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 58 }]);
        expect(instances[1]?.dataValues).toMatchObject({
            'eventService-12': 'Grace Hopper', person: 'Grace Hopper', personIndex: '2',
        });
    });

    it('expands group and ancestor bounds without mutating prototype frames', () => {
        const outer: LayoutGroup = { id: 'outer', children: [group, 'location'] };
        const projection = createLayoutRepeatProjection([outer], {
            title: { x: 20, y: 40, width: 200, height: 30 },
            accent: { x: 20, y: 75, width: 200, height: 5 },
            location: { x: 20, y: 200, width: 200, height: 30 },
        }, {
            'eventService-12': { value: 'A, B, C', values: ['A', 'B', 'C'], formatType: 'list' },
        });

        expect(projection.prototypeFrames.speakers).toEqual({ x: 20, y: 40, width: 200, height: 40 });
        expect(projection.groupFrames.speakers).toEqual({ x: 20, y: 40, width: 200, height: 136 });
        expect(projection.groupFrames.outer).toEqual({ x: 20, y: 40, width: 200, height: 190 });
    });

    it('bounds untrusted list sizes and keeps an editable empty prototype', () => {
        const many = Array.from({ length: MAX_LAYOUT_REPEAT_ITEMS + 20 }, (_, index) => `Person ${index}`);
        const values = { list: { value: '', values: many, formatType: 'list' as const } };
        const repeated = { ...group, repeat: { ...group.repeat!, sourceFieldId: 'list' } };

        expect(createLayoutRepeatInstances(repeated, { x: 0, y: 0, width: 10, height: 10 }, values)).toHaveLength(100);
        expect(createLayoutRepeatInstances(group, { x: 0, y: 0, width: 10, height: 10 }, {}, true)[0])
            .toMatchObject({ dataValues: { person: 'Beispiel', personIndex: '1' } });
    });
});
