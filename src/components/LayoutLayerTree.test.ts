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

        await wrapper.get('button[aria-label="Gruppe zuklappen"]').trigger('click');
        expect(wrapper.text()).not.toContain('Untergruppe');
        expect(wrapper.text()).not.toContain('Titel');

        await wrapper.get('button[aria-label="Gruppe aufklappen"]').trigger('click');
        const toggles = wrapper.findAll('button[aria-label="Gruppe zuklappen"]');
        await toggles[1]!.trigger('click');
        expect(wrapper.text()).toContain('Untergruppe');
        expect(wrapper.text()).not.toContain('Titel');
    });

    it('emits complete group selections and deletions', async () => {
        const wrapper = mount(LayoutLayerTree, {
            props: {
                elementLabels,
                nodes: nestedNodes,
                selectedElementIds: [],
            },
        });

        await wrapper.findAll('.inspector-layer-list__select--group')[0]!.trigger('click');
        await wrapper.findAll('button[aria-label="Gruppe löschen"]')[0]!.trigger('click');

        expect(wrapper.emitted('selectGroup')?.[0]?.[0]).toBe('outer');
        expect(wrapper.emitted('deleteElements')?.[0]?.[0]).toEqual(['title', 'dateTime', 'location']);
    });
});
