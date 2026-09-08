<script setup lang="ts">
import { MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH, type PublisherDesignTemplate } from '../../../domain/publisherDesignTemplate';
import type { PublisherDocumentRecord } from '../../../domain/publisherRepository';
import { TEMPLATE_OPTIONS, type TemplateId } from '../../../domain/templates';
import DesignButton from '../../design/DesignButton.vue';

defineProps<{
    activeDocumentId: string;
    designTemplates: PublisherDesignTemplate[];
    documentName: string;
    documents: PublisherDocumentRecord[];
    draftError: string;
    draftStatus: string;
    error: string;
    name: string;
    selectedDesignTemplateId: string;
    selectedTemplateId: TemplateId;
    storageMessage: string;
    storageStatus: string;
    status: string;
}>();

const emit = defineEmits<{
    applyDesign: [template: PublisherDesignTemplate];
    applyStandard: [templateId: TemplateId];
    deleteDesign: [template: PublisherDesignTemplate];
    deleteDocument: [document: PublisherDocumentRecord];
    newDocument: [];
    openDocument: [document: PublisherDocumentRecord];
    saveDocument: [];
    saveDesign: [template?: PublisherDesignTemplate];
    'update:documentName': [value: string];
    'update:name': [value: string];
}>();
</script>

<template>
    <section id="templates-editor" class="publisher-inspector__content">
        <div class="inspector-section">
            <h3>Standardvorlagen</h3><p>Die bisherigen Designs sind Startpunkte für eine eigene Vorlage.</p>
            <div class="standard-template-list">
                <button v-for="option in TEMPLATE_OPTIONS" :key="option.id" type="button" :class="{ 'is-active': selectedTemplateId === option.id && !selectedDesignTemplateId }" @click="emit('applyStandard', option.id)"><span :class="`is-${option.id}`" aria-hidden="true" /><strong>{{ option.label }}</strong><small>Auf aktive Seite anwenden</small></button>
            </div>
        </div>
        <div class="inspector-section">
            <h3>Meine Vorlagen</h3><p>Speichert alle Seiten, Größen und Gestaltungseinstellungen. Beim nächsten Termin werden dessen Inhalte eingesetzt.</p>
            <form class="design-template-create" @submit.prevent="emit('saveDesign')">
                <label class="inspector-field">Vorlagenname<input :value="name" :maxlength="MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH" placeholder="z. B. Sonntagsfolie" @input="emit('update:name', ($event.target as HTMLInputElement).value)" /></label>
                <DesignButton type="submit">Aktuelles Dokument speichern</DesignButton>
            </form>
            <p v-if="status" class="local-draft__status" role="status">{{ status }}</p><p v-if="error" class="local-draft__error" role="alert">{{ error }}</p>
            <div v-if="designTemplates.length" class="design-template-list" aria-label="Gespeicherte Vorlagen">
                <article v-for="designTemplate in designTemplates" :key="designTemplate.id" :class="{ 'is-active': selectedDesignTemplateId === designTemplate.id }">
                    <div><strong>{{ designTemplate.name }}</strong><small>{{ designTemplate.pages.length }} Seite{{ designTemplate.pages.length === 1 ? '' : 'n' }} · {{ designTemplate.pages.map(({ width, height }) => `${width} × ${height}`).join(', ') }}</small></div><span v-if="selectedDesignTemplateId === designTemplate.id" class="design-template-list__active">Aktiv</span>
                    <div class="design-template-list__actions"><DesignButton variant="secondary" size="compact" @click="emit('applyDesign', designTemplate)">Anwenden</DesignButton><DesignButton variant="secondary" size="compact" @click="emit('saveDesign', designTemplate)">Aktualisieren</DesignButton><DesignButton variant="danger" size="compact" @click="emit('deleteDesign', designTemplate)">Löschen</DesignButton></div>
                </article>
            </div>
            <p v-else class="inspector-empty">Noch keine eigenen Vorlagen gespeichert.</p>
        </div>
        <div class="inspector-section">
            <h3>Dokumente</h3><p>Dokumente werden automatisch in ChurchTools gespeichert und können optional mit einem Termin verbunden sein.</p>
            <form class="design-template-create" @submit.prevent="emit('saveDocument')">
                <label class="inspector-field">Dokumentname<input :value="documentName" maxlength="80" placeholder="Unbenanntes Dokument" @input="emit('update:documentName', ($event.target as HTMLInputElement).value)" /></label>
                <DesignButton type="submit" :disabled="storageStatus === 'saving'">Jetzt speichern</DesignButton>
                <DesignButton variant="secondary" :disabled="storageStatus === 'saving'" @click="emit('newDocument')">Neues Dokument</DesignButton>
            </form>
            <p class="local-draft__status" role="status">{{ storageMessage }}</p>
            <p v-if="draftStatus && draftStatus !== storageMessage" class="local-draft__status" role="status">{{ draftStatus }}</p>
            <p v-if="draftError" class="local-draft__error" role="alert">{{ draftError }}</p>
            <div v-if="documents.length" class="design-template-list" aria-label="Gespeicherte Dokumente">
                <article v-for="document in documents" :key="document.id" :class="{ 'is-active': activeDocumentId === document.id }">
                    <div>
                        <strong>{{ document.name }}</strong>
                        <small>{{ document.appointment ? `Termin ${document.appointment.appointmentId} · ${document.appointment.occurrenceStart}` : 'Ohne Termin' }}</small>
                    </div>
                    <span v-if="activeDocumentId === document.id" class="design-template-list__active">Geöffnet</span>
                    <div class="design-template-list__actions">
                        <DesignButton variant="secondary" size="compact" :disabled="storageStatus === 'saving' || activeDocumentId === document.id" @click="emit('openDocument', document)">Öffnen</DesignButton>
                        <DesignButton variant="danger" size="compact" @click="emit('deleteDocument', document)">Löschen</DesignButton>
                    </div>
                </article>
            </div>
            <p v-else class="inspector-empty">Noch keine Dokumente in ChurchTools gespeichert.</p>
        </div>
    </section>
</template>
