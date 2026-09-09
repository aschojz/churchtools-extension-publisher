// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { LayoutElementId, LayoutLayerTreeNode } from '../domain/layoutEditing';
import LayoutLayerTree from './LayoutLayerTree.vue';

const elementLabels: Record<LayoutElementId, string> = {
    background: 'Hintergrund',
    image: 'Bild',
    accent: 'Akzentform',
    title: 'Titel',
    dateTime: 'Datum/Uhrzeit',
    location: 'Ort',
};

const nestedNodes: LayoutLayerTreeNode[] = [{
    kind: 'group',
    id: 'outer',
    elementIds: ['title', 'dateTime', 'location'],
    children: [
        { kind: 'element', id: 'location', elementId: 'location' },
        {
            kind: 'group',
            id: 'inner',
            elementIds: ['title', 'dateTime'],
            children: [
                { kind: 'element', id: 'dateTime', elementId: 'dateTime' },
                { kind: 'element', id: 'title', elementId: 'title' },
            ],
        },
    ],
}];

describe('LayoutLayerTree', () => {
    it('renders nested groups and collapses every group level independently', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                elementLabels,
                nodes: nestedNodes,
                selectedElementIds: [],
            },
        });

        expect(wrapper.text()).toContain('Gruppe');
        expect(wrapper.text()).toContain('Untergruppe');
        expect(wrapper.text()).toContain('Titel');
        expect(wrapper.findAll('.inspector-layer-list__drag')).toHaveLength(5);

        await wrapper.get('button[aria-label="Gruppe zuklappen"]').trigger('click');
        expect(wrapper.text()).not.toContain('Untergruppe');
        expect(wrapper.text()).not.toContain('Titel');

        await wrapper.get('button[aria-label="Gruppe aufklappen"]').trigger('click');
        const toggles = wrapper.findAll('button[aria-label="Gruppe zuklappen"]');
        await toggles[1]!.trigger('click');
        expect(wrapper.text()).toContain('Untergruppe');
        expect(wrapper.text()).not.toContain('Titel');
    });

    it('emits complete group selections and non-destructive visibility changes', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                elementLabels,
                nodes: nestedNodes,
                selectedElementIds: [],
            },
        });

        await wrapper.findAll('.inspector-layer-list__select--group')[0]!.trigger('click');
        await wrapper.findAll('button[aria-label="Gruppe ausblenden"]')[0]!.trigger('click');

        expect(wrapper.emitted('selectGroup')?.[0]?.[0]).toBe('outer');
        expect(wrapper.emitted('toggleVisibility')?.[0]?.[0]).toEqual(['title', 'dateTime', 'location']);
    });

    it('expands collapsed ancestor groups when the canvas selects a nested element', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                elementLabels,
                nodes: nestedNodes,
                selectedElementIds: [],
                expandedGroupIds: [],
            },
        });

        await wrapper.get('button[aria-label="Gruppe zuklappen"]').trigger('click');
        expect(wrapper.text()).not.toContain('Titel');

        await wrapper.setProps({ selectedElementIds: ['title'], expandedGroupIds: ['outer', 'inner'] });
        expect(wrapper.text()).toContain('Titel');
    });

    it('shows the actual layer label without repeating its type', () => {
        const customLabels = {
            ...elementLabels,
            'image-photo': 'Foto',
            'shape-box': 'Rechteck',
            'icon-church': 'Kirche',
            'qr-link': 'Link QR',
        } as Record<LayoutElementId, string>;
        const nodes: LayoutLayerTreeNode[] = (['image-photo', 'shape-box', 'icon-church', 'qr-link'] as LayoutElementId[]).map((elementId) => ({
            kind: 'element' as const,
            id: elementId,
            elementId,
        }));
        const wrapper = mount(LayoutLayerTree, {
            props: { elementLabels: customLabels, nodes, selectedElementIds: [] },
        });

        expect(wrapper.text()).toContain('Foto');
        expect(wrapper.text()).toContain('Rechteck');
        expect(wrapper.text()).toContain('Kirche');
        expect(wrapper.text()).toContain('Link QR');
        expect(wrapper.find('small').exists()).toBe(false);
    });

    it('renders image previews and individual visibility controls', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                elementLabels,
                elementPreviews: { image: { kind: 'image', imageSource: 'data:image/png;base64,preview' } },
                hiddenElementIds: ['image'],
                nodes: [{ kind: 'element', id: 'image', elementId: 'image' }],
                selectedElementIds: [],
            },
        });

        expect(wrapper.get('.inspector-layer-list__icon img').attributes('src')).toBe('data:image/png;base64,preview');
        expect(wrapper.get('.inspector-layer-list__row').classes()).toContain('is-hidden');
        await wrapper.get('button[aria-label="Bild einblenden"]').trigger('click');
        expect(wrapper.emitted('toggleVisibility')).toEqual([[['image']]]);
    });

    it('marks configured effects and opens them from the layer row', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                effectElementIds: ['title'],
                elementLabels,
                nodes: [{ kind: 'element', id: 'title', elementId: 'title' }],
                selectedElementIds: [],
            },
        });

        await wrapper.get('[aria-label="Effekte von Titel bearbeiten"]').trigger('click');

        expect(wrapper.emitted('editEffects')).toEqual([['title']]);
    });

    it('marks effects on the group node without marking its children', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                effectElementIds: ['outer'],
                elementLabels,
                nodes: nestedNodes,
                selectedElementIds: ['title', 'dateTime', 'location'],
            },
        });

        await wrapper.get('[aria-label="Gruppeneffekte bearbeiten"]').trigger('click');

        expect(wrapper.emitted('editEffects')).toEqual([['outer']]);
        expect(wrapper.find('[aria-label="Effekte von Titel bearbeiten"]').exists()).toBe(false);
    });

    it('marks groups that are projected from repeatable data', () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                elementLabels,
                nodes: nestedNodes,
                repeatGroupIds: ['inner'],
                selectedElementIds: [],
            },
        });

        expect(wrapper.get('[title="Datenabhängige Wiederholung"]').text()).toContain('Datenabhängige Wiederholung');
    });

    it('emits an inside move when a drag handle is dropped onto a group', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: { elementLabels, nodes: nestedNodes, selectedElementIds: [] },
        });
        const values = new Map<string, string>();
        const dataTransfer = {
            effectAllowed: '', dropEffect: '',
            setData: (type: string, value: string) => values.set(type, value),
            getData: (type: string) => values.get(type) ?? '',
        };

        await wrapper.get('[aria-label="Ort verschieben"]').trigger('dragstart', { dataTransfer });
        await wrapper.findAll('.inspector-layer-list__row--group')[1]!.trigger('drop', { dataTransfer, clientY: 0 });

        expect(wrapper.emitted('moveLayer')).toEqual([[
            { kind: 'element', id: 'location' },
            { kind: 'group', id: 'inner' },
            'inside',
        ]]);
    });

    it('navigates the visible tree and collapses groups with arrow keys', async () => {
        const wrapper = mount(LayoutLayerTree, {
            attachTo: document.body,
            props: { elementLabels, nodes: nestedNodes, selectedElementIds: [] },
        });
        const group = wrapper.get('.inspector-layer-list__select--group');
        (group.element as HTMLElement).focus();

        await group.trigger('keydown', { key: 'ArrowRight' });
        expect(document.activeElement).toBe(wrapper.findAll('[data-layer-select]')[1]!.element);
        await group.trigger('keydown', { key: 'ArrowLeft' });
        expect(wrapper.text()).not.toContain('Titel');
        wrapper.unmount();
    });

    it('reorders and nests layers from the drag handle with Alt plus arrow keys', async () => {
        const nodes: LayoutLayerTreeNode[] = [
            nestedNodes[0]!,
            { kind: 'element', id: 'image', elementId: 'image' },
            { kind: 'element', id: 'accent', elementId: 'accent' },
        ];
        const wrapper = mount(LayoutLayerTree, {
            props: { elementLabels, nodes, selectedElementIds: [] },
        });
        const imageHandle = wrapper.get('[aria-label="Bild verschieben"]');

        await imageHandle.trigger('keydown', { altKey: true, key: 'ArrowDown' });
        await imageHandle.trigger('keydown', { altKey: true, key: 'ArrowRight' });

        expect(wrapper.emitted('moveLayer')).toEqual([
            [{ kind: 'element', id: 'image' }, { kind: 'element', id: 'accent' }, 'after'],
            [{ kind: 'element', id: 'image' }, { kind: 'group', id: 'outer' }, 'inside'],
        ]);
    });

    it('pulls a nested layer out of its direct group with Alt plus ArrowLeft and announces the move', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: { elementLabels, nodes: nestedNodes, selectedElementIds: [] },
        });
        const titleHandle = wrapper.get('[aria-label="Titel verschieben"]');

        await titleHandle.trigger('keydown', { altKey: true, key: 'ArrowLeft' });
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('moveLayer')).toContainEqual([
            { kind: 'element', id: 'title' },
            { kind: 'group', id: 'inner' },
            'outside',
        ]);
        expect(wrapper.get('[role="status"]').text()).toBe('Titel aus der Gruppe herausgezogen.');
    });
});
