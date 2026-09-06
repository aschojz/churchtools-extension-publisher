<script setup lang="ts">
import { MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH, type PublisherDesignTemplate } from '../../../domain/publisherDesignTemplate';
import { TEMPLATE_OPTIONS, type TemplateId } from '../../../domain/templates';
import DesignButton from '../../design/DesignButton.vue';
import DesignFileButton from '../../design/DesignFileButton.vue';

defineProps<{
    designTemplates: PublisherDesignTemplate[];
    draftError: string;
    draftStatus: string;
    error: string;
    hasLocalDraft: boolean;
    name: string;
    selectedDesignTemplateId: string;
    selectedTemplateId: TemplateId;
    status: string;
}>();

const emit = defineEmits<{
    applyDesign: [template: PublisherDesignTemplate];
    applyStandard: [templateId: TemplateId];
    deleteDesign: [template: PublisherDesignTemplate];
    deleteDraft: [];
    exportDraft: [];
    importDraft: [event: Event];
    saveDesign: [template?: PublisherDesignTemplate];
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
            <h3>Meine Vorlagen</h3><p>Speichert nur die Gestaltung. Beim nächsten Termin werden dessen Inhalte eingesetzt.</p>
            <form class="design-template-create" @submit.prevent="emit('saveDesign')">
                <label class="inspector-field">Vorlagenname<input :value="name" :maxlength="MAX_PUBLISHER_DESIGN_TEMPLATE_NAME_LENGTH" placeholder="z. B. Sonntagsfolie" @input="emit('update:name', ($event.target as HTMLInputElement).value)" /></label>
                <DesignButton type="submit">Aktuelles Layout speichern</DesignButton>
            </form>
            <p v-if="status" class="local-draft__status" role="status">{{ status }}</p><p v-if="error" class="local-draft__error" role="alert">{{ error }}</p>
            <div v-if="designTemplates.length" class="design-template-list" aria-label="Gespeicherte Vorlagen">
                <article v-for="designTemplate in designTemplates" :key="designTemplate.id" :class="{ 'is-active': selectedDesignTemplateId === designTemplate.id }">
                    <div><strong>{{ designTemplate.name }}</strong><small>{{ TEMPLATE_OPTIONS.find(({ id }) => id === designTemplate.baseTemplateId)?.label }}</small></div><span v-if="selectedDesignTemplateId === designTemplate.id" class="design-template-list__active">Aktiv</span>
                    <div class="design-template-list__actions"><DesignButton variant="secondary" size="compact" @click="emit('applyDesign', designTemplate)">Anwenden</DesignButton><DesignButton variant="secondary" size="compact" @click="emit('saveDesign', designTemplate)">Aktualisieren</DesignButton><DesignButton variant="danger" size="compact" @click="emit('deleteDesign', designTemplate)">Löschen</DesignButton></div>
                </article>
            </div>
            <p v-else class="inspector-empty">Noch keine eigenen Vorlagen gespeichert.</p>
        </div>
        <div class="inspector-section">
            <h3>Lokaler Entwurf</h3><p>Änderungen werden automatisch in diesem Browser gespeichert.</p><p v-if="draftStatus" class="local-draft__status" role="status">{{ draftStatus }}</p><p v-if="draftError" class="local-draft__error" role="alert">{{ draftError }}</p>
            <div class="inspector-action-stack"><DesignButton variant="secondary" @click="emit('exportDraft')">Entwurf herunterladen</DesignButton><DesignFileButton class="local-draft__import" accept="application/json,.json" @change="emit('importDraft', $event)">Entwurf importieren</DesignFileButton><DesignButton variant="secondary" :disabled="!hasLocalDraft" @click="emit('deleteDraft')">Entwurf löschen</DesignButton></div>
        </div>
    </section>
</template>
