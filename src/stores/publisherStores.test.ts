import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { LAYOUT_ELEMENT_IDS } from '../domain/layoutEditing';
import { usePublisherAppointmentsStore } from './publisherAppointments';
import { usePublisherDocumentStore } from './publisherDocument';
import { usePublisherEditorStore } from './publisherEditor';

describe('publisher stores', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('starts with an editable blank page and without opening appointment selection', () => {
        const appointments = usePublisherAppointmentsStore();
        const document = usePublisherDocumentStore();
        const editor = usePublisherEditorStore();

        expect(appointments.appointmentDialogOpen).toBe(false);
        expect(editor.activeEditorTool).toBe('layout');
        expect(document.pages).toHaveLength(1);
        expect(document.activePage.layouts.split?.deleted).toEqual(LAYOUT_ELEMENT_IDS);
    });

    it('can append a blank page with an independent size', () => {
        const document = usePublisherDocumentStore();

        const page = document.addPage(600, 600, 'split', true);

        expect(document.pages).toHaveLength(2);
        expect(document.activePageId).toBe(page.id);
        expect(document.activePage).toMatchObject({ width: 600, height: 600 });
        expect(document.activePage.layouts.split?.deleted).toEqual(LAYOUT_ELEMENT_IDS);
    });
});
