import { describe, expect, it } from 'vitest';

import {
    alignLayoutGeometry,
    applyLayoutGroupAutoLayout,
    calculateAlignmentSnap,
    calculateSelectionDragSnap,
    clampLayoutPosition,
    constrainLayoutGeometry,
    constrainLayoutDelta,
    constrainTransformerFrame,
    constrainFontSize,
    createCanvasStackOrder,
    createCustomTextStyle,
    createCustomVisualStyle,
    createLayoutCustomElement,
    createLayoutLayerTree,
    createLayoutOrder,
    expandLayoutSelection,
    findLayoutGroupDepth,
    groupLayoutElements,
    createLayoutOffsets,
    createLayoutRotations,
    createLayoutSizes,
    createLayoutTextStyles,
    createLayoutVisualStyles,
    distributeLayoutFrames,
    isHexColor,
    layoutElementLabel,
    keepRotatedFrameInDocument,
    layoutFramesIntersect,
    layoutGroupElementIds,
    layoutGroupAnchor,
    layoutGroupBounds,
    resolveLayoutSelectionTarget,
    normalizeRotation,
    moveLayoutElementInOrder,
    moveLayoutOrderBlock,
    nestLayoutNodeInGroup,
    resizeLayoutFrame,
    resizeLayoutFrameProportionally,
    resetLayoutElementState,
    snapLayoutPoint,
    snapLayoutSize,
    snapRotation,
    sortLayoutGroupChildren,
    ungroupLayoutElements,
} from './layoutEditing';
import type { LayoutGroup } from './layoutEditing';

describe('layout editing', () => {
    it('uses a supplied recent color for new text and visual styles', () => {
        expect(createCustomTextStyle('#123456').color).toBe('#123456');
        expect(createCustomVisualStyle('#abcdef').fill).toBe('#abcdef');
    });

    it('creates centered, uniquely identifiable custom elements', () => {
        const text = createLayoutCustomElement('text', { width: 1920, height: 1080 });
        const circle = createLayoutCustomElement('circle', { width: 600, height: 600 });
        const line = createLayoutCustomElement('line', { width: 600, height: 600 });

        expect(text).toMatchObject({ kind: 'text', name: 'Neuer Text', text: 'Neuer Text', textMode: 'graphic' });
        expect(text.id).toMatch(/^text-/);
        expect(circle).toMatchObject({ kind: 'circle', name: 'Kreis', frame: { width: 260, height: 260 } });
        expect(circle.id).toMatch(/^shape-circle-/);
        expect(line).toMatchObject({ kind: 'line', name: 'Strich', frame: { width: 300, height: 4 } });
        expect(line.id).toMatch(/^shape-line-/);
        expect(layoutElementLabel(text.id)).toBe('Text');
        expect(layoutElementLabel(circle.id)).toBe('Kreis');
        expect(layoutElementLabel(line.id)).toBe('Strich');
    });

    it('creates data-bound elements at a requested drop position', () => {
        const text = createLayoutCustomElement('text', { width: 600, height: 600 }, {
            name: 'Titel', text: '{{title}}', dataBinding: 'title', position: { x: 75, y: 90 },
        });

        expect(text).toMatchObject({
            name: 'Titel', text: '{{title}}', textMode: 'graphic', dataBinding: 'title', frame: { x: 75, y: 90 },
        });
    });

    it('creates explicit frame text for dynamic content', () => {
        const text = createLayoutCustomElement('text', { width: 1920, height: 1080 }, {
            text: '{{title}}', textMode: 'frame', dataBinding: 'title',
        });

        expect(text.textMode).toBe('frame');
    });

    it('creates persistable icon and QR-code elements', () => {
        const icon = createLayoutCustomElement('icon', { width: 1920, height: 1080 }, { iconName: 'church' });
        const qr = createLayoutCustomElement('qr', { width: 1920, height: 1080 }, { qrValue: '{{link}}', dataBinding: 'link' });

        expect(icon).toMatchObject({ kind: 'icon', iconName: 'church', frame: { width: 180, height: 180 } });
        expect(qr).toMatchObject({
            kind: 'qr', qrValue: '{{link}}', dataBinding: 'link', qrBackground: '#ffffff',
            qrMargin: 2, qrErrorCorrection: 'M', frame: { width: 260, height: 260 },
        });
    });

    it('creates independent zero offsets for all editable elements', () => {
        const offsets = createLayoutOffsets();

        expect(offsets).toEqual({
            background: { x: 0, y: 0 },
            image: { x: 0, y: 0 },
            accent: { x: 0, y: 0 },
            title: { x: 0, y: 0 },
            dateTime: { x: 0, y: 0 },
            location: { x: 0, y: 0 },
        });
        expect(offsets.title).not.toBe(offsets.location);
    });

    it('keeps a moved element inside the document', () => {
        const frame = { x: 0, y: 0, width: 760, height: 310 };

        expect(clampLayoutPosition({ x: -50, y: 900 }, frame)).toEqual({ x: 0, y: 770 });
        expect(clampLayoutPosition({ x: 1400, y: 20 }, frame)).toEqual({ x: 1160, y: 20 });
    });

    it('keeps a multi-selection together when movement reaches a document edge', () => {
        const frames = [
            { x: 100, y: 50, width: 300, height: 100 },
            { x: 1600, y: 900, width: 300, height: 100 },
        ];

        expect(constrainLayoutDelta(frames, { x: 80, y: 120 })).toEqual({ x: 20, y: 80 });
        expect(constrainLayoutDelta(frames, { x: -200, y: -80 })).toEqual({ x: -100, y: -50 });
        expect(constrainLayoutDelta([], { x: 20, y: 20 })).toEqual({ x: 0, y: 0 });
    });

    it('snaps a grouped selection from its shared bounds instead of the dragged child', () => {
        const frames = [
            { x: 103, y: 95, width: 100, height: 80 },
            { x: 228, y: 95, width: 100, height: 80 },
        ];

        expect(calculateSelectionDragSnap(
            frames,
            { x: 14, y: 7 },
            [],
            true,
            0,
            { width: 1000, height: 1000 },
        )).toEqual({ offset: { x: 17, y: 5 }, guides: [] });
    });

    it('detects elements touched by a selection rectangle', () => {
        const selection = { x: 100, y: 100, width: 200, height: 150 };

        expect(layoutFramesIntersect(selection, { x: 250, y: 200, width: 100, height: 100 })).toBe(true);
        expect(layoutFramesIntersect(selection, { x: 300, y: 250, width: 50, height: 50 })).toBe(true);
        expect(layoutFramesIntersect(selection, { x: 301, y: 251, width: 50, height: 50 })).toBe(false);
    });

    it('allows small resized elements while retaining document bounds', () => {
        const frame = { x: 1500, y: 900, width: 300, height: 100 };

        expect(resizeLayoutFrame(frame, { width: 10, height: 10 })).toEqual({
            ...frame,
            width: 10,
            height: 10,
        });
        expect(resizeLayoutFrame(frame, { width: 900, height: 500 })).toEqual({
            ...frame,
            width: 420,
            height: 180,
        });
    });

    it('keeps icons and QR-code frames proportional while respecting document bounds', () => {
        expect(resizeLayoutFrameProportionally(
            { x: 100, y: 50, width: 200, height: 200 },
            { width: 400, height: 260 },
            { width: 600, height: 500 },
        )).toEqual({ x: 100, y: 50, width: 400, height: 400 });

        expect(resizeLayoutFrameProportionally(
            { x: 400, y: 300, width: 200, height: 200 },
            { width: 500, height: 500 },
            { width: 600, height: 500 },
        )).toEqual({ x: 400, y: 300, width: 200, height: 200 });
    });

    it('keeps transformer handles responsive at document edges', () => {
        const oldFrame = { x: 0, y: 0, width: 400, height: 200 };

        expect(constrainTransformerFrame(oldFrame, { x: -30, y: 0, width: 430, height: 200 }, 50, { width: 600, height: 400 }))
            .toEqual({ x: 0, y: 0, width: 400, height: 200 });
        expect(constrainTransformerFrame(oldFrame, { x: 40, y: 0, width: 360, height: 200 }, 50, { width: 600, height: 400 }))
            .toEqual({ x: 40, y: 0, width: 360, height: 200 });
        expect(constrainTransformerFrame(oldFrame, { x: 0, y: 0, width: 650, height: 200 }, 50, { width: 600, height: 400 }))
            .toEqual({ x: 0, y: 0, width: 600, height: 200 });
    });

    it('constrains exact geometry values to a valid document frame', () => {
        expect(
            constrainLayoutGeometry({ x: 1100, y: 130, width: 760, height: 310, rotation: 0 }),
        ).toEqual({ x: 1100, y: 130, width: 760, height: 310, rotation: 0 });
        expect(
            constrainLayoutGeometry({ x: -20, y: 1040, width: 2500, height: 10, rotation: 360 }),
        ).toEqual({ x: 0, y: 1040, width: 1920, height: 10, rotation: 0 });
    });

    it('rejects non-finite or impossible rotated geometry', () => {
        expect(
            constrainLayoutGeometry({ x: 0, y: 0, width: Number.NaN, height: 100, rotation: 0 }),
        ).toBeNull();
        expect(
            constrainLayoutGeometry({ x: 0, y: 0, width: 1600, height: 410, rotation: 90 }),
        ).toBeNull();
    });

    it('normalizes rotation and shifts rotated bounds back into the document', () => {
        expect(normalizeRotation(190)).toBe(-170);
        expect(normalizeRotation(-190)).toBe(170);

        const result = keepRotatedFrameInDocument(
            { x: 1800, y: 100, width: 200, height: 100 },
            45,
        );

        expect(result?.rotation).toBe(45);
        expect(result?.frame.x).toBeLessThan(1800);
    });

    it('rejects a rotation whose bounding box cannot fit into the document', () => {
        expect(
            keepRotatedFrameInDocument(
                { x: 0, y: 0, width: 1600, height: 410 },
                90,
            ),
        ).toBeNull();
    });

    it('snaps positions, sizes and rotations only when enabled', () => {
        expect(snapLayoutPoint({ x: 113, y: 129 }, true)).toEqual({ x: 120, y: 120 });
        expect(snapLayoutSize({ width: 753, height: 307 }, true)).toEqual({ width: 760, height: 300 });
        expect(snapRotation(22, true)).toBe(15);
        expect(snapRotation(22, false)).toBe(22);
    });

    it('moves elements through a serializable layer order without crossing its bounds', () => {
        const initialOrder = createLayoutOrder();
        const movedOrder = moveLayoutElementInOrder(initialOrder, 'title', 1);

        expect(movedOrder).toEqual(['background', 'image', 'accent', 'dateTime', 'title', 'location']);
        expect(initialOrder).toEqual(['background', 'image', 'accent', 'title', 'dateTime', 'location']);
        expect(moveLayoutElementInOrder(initialOrder, 'background', -1)).toBe(initialOrder);
    });

    it('uses the inspector hierarchy as the global editable canvas stack', () => {
        const order = ['background', 'title', 'image', 'accent', 'dateTime', 'location'] as const;

        expect(createCanvasStackOrder([...order], [], true)).toEqual([
            'background', 'title', 'decoration-behind', 'image', 'decoration-over', 'accent', 'dateTime', 'location',
        ]);
        expect(createCanvasStackOrder([...order], ['title'], false)).toEqual([
            'background', 'decoration-behind', 'image', 'decoration-over', 'accent', 'dateTime',
        ]);
    });

    it('reorders layer blocks in the top-first inspector direction', () => {
        const order = createLayoutOrder();

        expect(moveLayoutOrderBlock(order, ['background'], ['title'], 'before')).toEqual([
            'image', 'accent', 'title', 'background', 'dateTime', 'location',
        ]);
        expect(moveLayoutOrderBlock(order, ['location'], ['title'], 'after')).toEqual([
            'background', 'image', 'accent', 'location', 'title', 'dateTime',
        ]);
    });

    it('nests an element or existing group by dropping it into another group', () => {
        const groups: LayoutGroup[] = [
            { id: 'heading', children: ['title', 'accent'] },
            { id: 'details', children: ['dateTime', 'location'] },
        ];

        expect(nestLayoutNodeInGroup(groups, { kind: 'element', id: 'image' }, 'heading')).toEqual([
            { id: 'heading', children: ['title', 'accent', 'image'] },
            { id: 'details', children: ['dateTime', 'location'] },
        ]);
        expect(nestLayoutNodeInGroup(groups, { kind: 'group', id: 'details' }, 'heading')).toEqual([
            { id: 'heading', children: ['title', 'accent', { id: 'details', children: ['dateTime', 'location'] }] },
        ]);
    });

    it('creates nested groups and removes only their outermost level', () => {
        const inner = groupLayoutElements([], ['title', 'dateTime'], 'inner');
        const nested = groupLayoutElements(inner, ['title', 'dateTime', 'location'], 'outer');

        expect(nested).toEqual([{
            id: 'outer',
            children: [
                { id: 'inner', children: ['title', 'dateTime'] },
                'location',
            ],
        }]);
        expect(layoutGroupElementIds(nested[0]!)).toEqual(['title', 'dateTime', 'location']);
        expect(findLayoutGroupDepth(nested, 'outer')).toBe(1);
        expect(findLayoutGroupDepth(nested, 'inner')).toBe(2);
        expect(expandLayoutSelection(nested, ['dateTime'])).toEqual(['title', 'dateTime', 'location']);
        expect(resolveLayoutSelectionTarget(nested, 'dateTime', null, false)).toEqual({
            elementIds: ['title', 'dateTime', 'location'], groupId: 'outer',
        });
        expect(resolveLayoutSelectionTarget(nested, 'dateTime', 'outer', true)).toEqual({
            elementIds: ['title', 'dateTime'], groupId: 'inner',
        });
        expect(resolveLayoutSelectionTarget(nested, 'dateTime', 'inner', true)).toEqual({
            elementIds: ['dateTime'], groupId: null,
        });
        expect(ungroupLayoutElements(nested, ['title', 'dateTime', 'location']))
            .toEqual([{ id: 'inner', children: ['title', 'dateTime'] }]);
        expect(ungroupLayoutElements(nested, ['title', 'dateTime'])).toEqual([{
            id: 'outer', children: ['title', 'dateTime', 'location'],
        }]);
    });

    it('reflows group children with a fixed gap around the configured origin', () => {
        const frames = {
            title: { x: 100, y: 100, width: 300, height: 60 },
            accent: { x: 100, y: 180, width: 300, height: 4 },
            dateTime: { x: 100, y: 200, width: 200, height: 30 },
        };
        const group: LayoutGroup = {
            id: 'flow',
            children: ['dateTime', 'title', 'accent'],
            autoLayout: {
                axis: 'vertical' as const,
                gap: 8,
                horizontalOrigin: 'center' as const,
                verticalOrigin: 'top' as const,
                anchor: { x: 250, y: 100 },
            },
        };
        const sorted = sortLayoutGroupChildren(group, frames, 'vertical');
        const result = applyLayoutGroupAutoLayout(sorted, frames);

        expect(sorted.children).toEqual(['title', 'accent', 'dateTime']);
        expect(result.title).toEqual({ x: 100, y: 100, width: 300, height: 60 });
        expect(result.accent).toEqual({ x: 100, y: 168, width: 300, height: 4 });
        expect(result.dateTime).toEqual({ x: 150, y: 180, width: 200, height: 30 });
        const bounds = layoutGroupBounds(sorted, result)!;
        expect(layoutGroupAnchor(bounds, 'center', 'top')).toEqual({ x: 250, y: 100 });

        const afterTitleWraps = applyLayoutGroupAutoLayout(sorted, {
            ...result,
            title: { ...result.title!, height: 120 },
        });
        expect(afterTitleWraps.accent?.y).toBe(228);
        expect(afterTitleWraps.dateTime?.y).toBe(240);
        expect(layoutGroupAnchor(layoutGroupBounds(sorted, afterTitleWraps)!, 'center', 'top'))
            .toEqual({ x: 250, y: 100 });
    });

    it('distributes three or more elements with equal visual gaps', () => {
        const result = distributeLayoutFrames({
            title: { x: 0, y: 0, width: 100, height: 30 },
            accent: { x: 180, y: 0, width: 20, height: 30 },
            dateTime: { x: 400, y: 0, width: 100, height: 30 },
        }, 'horizontal');

        expect(result.title?.x).toBe(0);
        expect(result.accent?.x).toBe(240);
        expect(result.dateTime?.x).toBe(400);
    });

    it('builds a top-first recursive layer tree for nested groups', () => {
        const groups = groupLayoutElements(
            groupLayoutElements([], ['title', 'dateTime'], 'inner'),
            ['title', 'dateTime', 'location'],
            'outer',
        );

        expect(createLayoutLayerTree(createLayoutOrder(), groups, ['accent'])).toEqual([
            {
                kind: 'group',
                id: 'outer',
                elementIds: ['location', 'dateTime', 'title'],
                children: [
                    { kind: 'element', id: 'location', elementId: 'location' },
                    {
                        kind: 'group',
                        id: 'inner',
                        elementIds: ['dateTime', 'title'],
                        children: [
                            { kind: 'element', id: 'dateTime', elementId: 'dateTime' },
                            { kind: 'element', id: 'title', elementId: 'title' },
                        ],
                    },
                ],
            },
            { kind: 'element', id: 'image', elementId: 'image' },
            { kind: 'element', id: 'background', elementId: 'background' },
        ]);
    });

    it('resets only the selected element geometry and default layer position', () => {
        const state = {
            offsets: {
                ...createLayoutOffsets(),
                title: { x: 40, y: 20 },
                dateTime: { x: 15, y: 10 },
                location: { x: 0, y: 0 },
            },
            sizes: {
                ...createLayoutSizes('split'),
                title: { width: 500, height: 200 },
                dateTime: { width: 400, height: 60 },
                location: { width: 760, height: 170 },
            },
            rotations: { ...createLayoutRotations(), title: 30, dateTime: 15, location: 0 },
            order: ['background', 'image', 'accent', 'dateTime', 'location', 'title'] as const,
            styles: {
                ...createLayoutTextStyles('split'),
                title: { ...createLayoutTextStyles('split').title, fontSize: 120, color: '#123456' },
            },
            visualStyles: createLayoutVisualStyles('split'),
        };

        const reset = resetLayoutElementState('split', 'title', {
            ...state,
            order: [...state.order],
        });

        expect(reset.offsets.title).toEqual({ x: 0, y: 0 });
        expect(reset.sizes.title).toEqual({ width: 760, height: 310 });
        expect(reset.rotations.title).toBe(0);
        expect(reset.order).toEqual(['background', 'image', 'accent', 'title', 'dateTime', 'location']);
        expect(reset.styles.title).toEqual(createLayoutTextStyles('split').title);
        expect(reset.offsets.dateTime).toEqual(state.offsets.dateTime);
        expect(reset.sizes.dateTime).toEqual(state.sizes.dateTime);
        expect(reset.rotations.dateTime).toBe(15);
    });

    it('validates text color and constrains font sizes', () => {
        expect(isHexColor('#12aBcF')).toBe(true);
        expect(isHexColor('red')).toBe(false);
        expect(constrainFontSize(8)).toBe(12);
        expect(constrainFontSize(88.6)).toBe(89);
        expect(constrainFontSize(500)).toBe(240);
    });

    it('snaps matching element edges and reports visual alignment guides', () => {
        expect(
            calculateAlignmentSnap(
                { x: 98, y: 207, width: 100, height: 60 },
                [{ x: 200, y: 300, width: 200, height: 100 }],
            ),
        ).toEqual({
            offset: { x: 2, y: 0 },
            guides: [{ orientation: 'vertical', position: 200 }],
        });
    });

    it('snaps element centers to the document center', () => {
        expect(calculateAlignmentSnap({ x: 906, y: 506, width: 100, height: 60 }, [])).toEqual({
            offset: { x: 4, y: 4 },
            guides: [
                { orientation: 'vertical', position: 960 },
                { orientation: 'horizontal', position: 540 },
            ],
        });
    });

    it('aligns unrotated geometry to document edges and centers', () => {
        const geometry = { x: 300, y: 200, width: 600, height: 300, rotation: 0 };

        expect(alignLayoutGeometry(geometry, 'left')?.x).toBe(0);
        expect(alignLayoutGeometry(geometry, 'horizontalCenter')?.x).toBe(660);
        expect(alignLayoutGeometry(geometry, 'right')?.x).toBe(1320);
        expect(alignLayoutGeometry(geometry, 'top')?.y).toBe(0);
        expect(alignLayoutGeometry(geometry, 'verticalCenter')?.y).toBe(390);
        expect(alignLayoutGeometry(geometry, 'bottom')?.y).toBe(780);
    });

    it('aligns the visible bounds of rotated geometry', () => {
        const aligned = alignLayoutGeometry(
            { x: 500, y: 300, width: 400, height: 200, rotation: 45 },
            'left',
        );

        expect(aligned).not.toBeNull();
        expect(aligned?.x).toBeCloseTo(200 * Math.sin(Math.PI / 4));
    });
});
