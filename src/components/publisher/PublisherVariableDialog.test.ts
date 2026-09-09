// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PublisherVariableDialog from './PublisherVariableDialog.vue';

describe('PublisherVariableDialog', () => {
    it('creates a versioned expression from visual format, fallback and condition controls', async () => {
        const wrapper = mount(PublisherVariableDialog, {
            props: {
                open: true,
                fields: [{
                    id: 'signupGroupParticipants', label: 'Teilnehmende', type: 'text', value: '1234.5',
                    placeholder: '{{signupGroupParticipants}}', formatType: 'number', locale: 'de-DE',
                }],
            },
            global: { stubs: { teleport: true } },
        });

        await wrapper.findAll('select')[1]!.setValue('2');
        await wrapper.get('input[placeholder="z. B. Ort folgt"]').setValue('Noch offen');
        await wrapper.findAll('select')[2]!.setValue('equals');
        const inputs = wrapper.findAll('input');
        await inputs[1]!.setValue('1234.5');
        await inputs[2]!.setValue('Voll');
        await wrapper.findAll('button').find((button) => button.text() === 'Variable einsetzen')!.trigger('click');

        expect(wrapper.emitted('apply')).toEqual([[
            "{{signupGroupParticipants|v1|number:'decimal','2','2'|default:'Noch offen'|if:'equals','1234.5','Voll'}}",
        ]]);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });
});
