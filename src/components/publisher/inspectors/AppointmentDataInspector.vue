<script setup lang="ts">
import {
    faCalendarDays,
    faClock,
    faFont,
    faGripVertical,
    faImage,
    faLink,
    faPen,
    faPlus,
    faQrcode,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { computed, nextTick, ref } from 'vue';

import {
    PUBLISHER_DATA_TRANSFER_TYPE,
    type PublisherDataField,
} from '../../../domain/appointmentDataFields';
import type { ImageFocus } from '../../../domain/imageFocus';
import { usePublisherAppointmentsStore } from '../../../stores/publisherAppointments';
import DesignButton from '../../design/DesignButton.vue';
import DesignIconButton from '../../design/DesignIconButton.vue';

const props = defineProps<{
    error: string;
    focus: ImageFocus;
    overriddenFields: string[];
    replacementName: string;
    replacementUrl: string | null;
}>();

const emit = defineEmits<{
    insertField: [field: PublisherDataField];
    insertQrField: [field: PublisherDataField];
    openAppointments: [];
    resetField: [fieldId: string];
    resetImage: [];
    updateField: [fieldId: string, value: string];
    updateFocus: [field: keyof ImageFocus, event: Event];
    updateImage: [event: Event];
}>();

const { dataFields, selectedAppointmentKey } = storeToRefs(usePublisherAppointmentsStore());
const editingFieldId = ref<string | null>(null);
const editingValue = ref('');
const editorInput = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const editingField = computed(() => dataFields.value.find(({ id }) => id === editingFieldId.value) ?? null);

const fieldSummary = (field: PublisherDataField) => {
    if (field.type === 'image') {
        return props.replacementName || 'Bild vorhanden';
    }
    return field.value || 'Kein Wert';
};
const fieldIcon = (field: PublisherDataField) => {
    if (field.type === 'image') return faImage;
    if (field.formatType === 'date') return faCalendarDays;
    if (field.formatType === 'time') return faClock;
    if (field.formatType === 'url') return faLink;
    return faFont;
};

const openEditor = (field: PublisherDataField) => {
    editingFieldId.value = field.id;
    editingValue.value = field.value;
    void nextTick(() => editorInput.value?.focus());
};

const closeEditor = () => {
    editingFieldId.value = null;
    editingValue.value = '';
};

const saveEditor = () => {
    const field = editingField.value;
    if (!field || field.type !== 'text') return;
    emit('updateField', field.id, editingValue.value);
    closeEditor();
};

const resetEditor = () => {
    const field = editingField.value;
    if (!field) return;
    if (field.type === 'image') emit('resetImage');
    else emit('resetField', field.id);
    closeEditor();
};

const startFieldDrag = (field: PublisherDataField, event: DragEvent) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(PUBLISHER_DATA_TRANSFER_TYPE, JSON.stringify({
        id: field.id,
        label: field.label,
        type: field.type,
        value: field.value,
    }));
    event.dataTransfer.setData('text/plain', field.placeholder);
};
</script>

<template>
    <section id="data-editor" class="publisher-inspector__content publisher-data-inspector">
        <div v-if="!selectedAppointmentKey" class="inspector-section">
            <p>Wähle einen Termin, um seine verfügbaren Datenfelder zu laden.</p>
            <DesignButton @click="emit('openAppointments')">Termin auswählen</DesignButton>
        </div>

        <div v-else class="publisher-data-fields">
            <div class="publisher-data-fields__toolbar">
                <span>Ausgewählter Termin</span>
                <DesignButton size="compact" variant="secondary" @click="emit('openAppointments')">Anderen Termin wählen</DesignButton>
            </div>
            <p class="publisher-data-fields__hint">Ziehe ein Feld auf die Seite oder füge es über den Plus-Button mittig ein.</p>
            <article v-for="field in dataFields" :key="field.id" class="publisher-data-field" :class="[`is-${field.type}`, field.formatType ? `is-${field.formatType}` : '']">
                <div class="publisher-data-field__heading">
                    <span
                        class="publisher-data-field__drag"
                        draggable="true"
                        :aria-label="`${field.label} auf die Seite ziehen`"
                        :title="`${field.label} auf die Seite ziehen`"
                        @dragstart="startFieldDrag(field, $event)"
                    ><FontAwesomeIcon :icon="faGripVertical" aria-hidden="true" /></span>
                    <span class="publisher-data-field__type">
                        <img v-if="field.type === 'image' && field.value" :src="field.value" alt="" />
                        <FontAwesomeIcon v-else :icon="fieldIcon(field)" aria-hidden="true" />
                    </span>
                    <div class="publisher-data-field__summary">
                        <div class="publisher-data-field__title"><strong>{{ field.label }}</strong><span>{{ field.placeholder }}</span></div>
                        <p :title="field.value">{{ fieldSummary(field) }}</p>
                    </div>
                    <div class="publisher-data-field__actions">
                        <DesignIconButton size="compact" :label="`${field.label} bearbeiten`" @click="openEditor(field)"><FontAwesomeIcon :icon="faPen" aria-hidden="true" /></DesignIconButton>
                        <DesignIconButton size="compact" :label="`${field.label} auf der Seite einfügen`" @click="emit('insertField', field)"><FontAwesomeIcon :icon="faPlus" aria-hidden="true" /></DesignIconButton>
                        <DesignIconButton v-if="field.formatType === 'url'" size="compact" :label="`${field.label} als QR-Code einfügen`" @click="emit('insertQrField', field)"><FontAwesomeIcon :icon="faQrcode" aria-hidden="true" /></DesignIconButton>
                    </div>
                </div>
            </article>
            <p v-if="dataFields.length === 0" class="inspector-empty">Dieser Termin liefert keine verwendbaren Felder.</p>
        </div>

        <div v-if="editingField" class="publisher-page-dialog-backdrop" @click.self="closeEditor" @keydown.esc="closeEditor">
            <form class="publisher-page-dialog publisher-data-dialog" role="dialog" aria-modal="true" aria-labelledby="publisher-data-dialog-title" @submit.prevent="saveEditor">
                <header>
                    <div><h2 id="publisher-data-dialog-title">{{ editingField.label }} bearbeiten</h2><span>{{ editingField.placeholder }}</span></div>
                    <DesignIconButton label="Dialog schließen" @click="closeEditor"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton>
                </header>

                <template v-if="editingField.type === 'text'">
                    <label class="inspector-field" :for="`publisher-data-${editingField.id}`">
                        Wert
                        <textarea
                            v-if="editingField.multiline"
                            :id="`publisher-data-${editingField.id}`"
                            ref="editorInput"
                            v-model="editingValue"
                            rows="5"
                        />
                        <input v-else :id="`publisher-data-${editingField.id}`" ref="editorInput" v-model="editingValue" />
                    </label>
                </template>

                <template v-else>
                    <div class="publisher-data-dialog__image">
                        <img :src="editingField.value" alt="Vorschau des Terminbilds" />
                        <label class="design-button design-button--secondary">Bild ersetzen<input hidden type="file" accept="image/jpeg,image/png,image/webp" @change="emit('updateImage', $event)" /></label>
                    </div>
                    <p v-if="replacementName" class="local-image-override__selection" role="status">{{ replacementName }}</p>
                    <p v-if="error" class="local-image-override__error" role="alert">{{ error }}</p>
                    <div class="inspector-range-fields publisher-data-dialog__focus">
                        <label>Horizontal <output>{{ focus.x }} %</output><input type="range" min="0" max="100" :value="focus.x" @input="emit('updateFocus', 'x', $event)" /></label>
                        <label>Vertikal <output>{{ focus.y }} %</output><input type="range" min="0" max="100" :value="focus.y" @input="emit('updateFocus', 'y', $event)" /></label>
                        <label>Zoom <output>{{ focus.zoom }} %</output><input type="range" min="100" max="300" step="5" :value="focus.zoom" @input="emit('updateFocus', 'zoom', $event)" /></label>
                    </div>
                </template>

                <footer>
                    <DesignButton
                        v-if="editingField.type === 'image' ? replacementUrl : overriddenFields.includes(editingField.id)"
                        variant="ghost"
                        size="compact"
                        class="publisher-data-dialog__reset"
                        @click="resetEditor"
                    >Original wiederherstellen</DesignButton>
                    <DesignButton variant="secondary" @click="closeEditor">Abbrechen</DesignButton>
                    <DesignButton v-if="editingField.type === 'text'" type="submit">Übernehmen</DesignButton>
                    <DesignButton v-else @click="closeEditor">Fertig</DesignButton>
                </footer>
            </form>
        </div>
    </section>
</template>
