// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { LayoutLayerTreeNode } from '../domain/layoutEditing';
import CanvasSceneTree from './CanvasSceneTree.vue';

const nodes: LayoutLayerTreeNode[] = [{
    kind: 'group', id: 'speakers', elementIds: ['title'],
    children: [{ kind: 'element', id: 'title', elementId: 'title' }],
}];

describe('CanvasSceneTree repeat groups', () => {
    it('projects one scoped child tree per list item while keeping one editable group', () => {
        const wrapper = mount(CanvasSceneTree, {
            props: {
                dataValues: {
                    people: { value: 'Ada, Grace', values: ['Ada', 'Grace'], formatType: 'list' },
                },
                editorScale: 1,
                groupFrames: { speakers: { x: 10, y: 20, width: 100, height: 70 } },
                prototypeGroupFrames: { speakers: { x: 10, y: 20, width: 100, height: 30 } },
                groupRepeats: {
                    speakers: { sourceFieldId: 'people', itemAlias: 'person', axis: 'vertical', gap: 10 },
                },
                nodes,
                renderRevision: 'one',
            },
            slots: {
                element: '<template #element="scope"><span class="repeat-value">{{ scope.dataValues.person }}</span></template>',
            },
            global: {
                stubs: {
                    EditableLayoutGroup: { template: '<div class="editable-layout-group-stub"><slot /></div>' },
                    VGroup: { template: '<div class="konva-group-stub"><slot /></div>' },
                },
            },
        });

        expect(wrapper.findAll('.editable-layout-group-stub')).toHaveLength(1);
        expect(wrapper.findAll('.repeat-value').map((value) => value.text())).toEqual(['Ada', 'Grace']);
    });
});
