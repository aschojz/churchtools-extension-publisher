<script setup lang="ts">
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import {
    publisherPlaceholderOptions,
    resolvePublisherPlaceholders,
} from '../../domain/appointmentDataFields';
import type {
    LayoutAlignment,
    LayoutDistributionAxis,
    LayoutGroupRepeat,
    LayoutHorizontalOrigin,
    LayoutVerticalOrigin,
} from '../../domain/layoutEditing';
import {
    findLayoutGroupDepth,
    flattenLayoutGroups,
    layoutElementLabel,
    layoutGroupElementIds,
} from '../../domain/layoutEditing';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import { usePublisherAppointmentsStore } from '../../stores/publisherAppointments';
import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';
import DesignPopover from '../design/DesignPopover.vue';
import PublisherVariableDialog from './PublisherVariableDialog.vue';

const props = defineProps<{
    hasImage: boolean;
}>();

const editorStore = usePublisherEditorStore();
const { activePage } = storeToRefs(usePublisherDocumentStore());
const { dataFields } = storeToRefs(usePublisherAppointmentsStore());
const {
    activeEditorTool, activeEditorToolLabel, canGroupLayoutSelection, canUngroupLayoutSelection,
    hasLayoutSelection, hasMultipleLayoutSelection, selectedLayoutElement,
    selectedLayerPosition, selectedLayerTotal, selectedLayoutElements, selectedLayoutGroupDepth,
    selectedLayoutTextContent, snapEnabled,
} = storeToRefs(editorStore);
const selectedCustomElement = computed(() => activePage.value.layouts[activePage.value.templateId]?.customElements
    ?.find(({ id }) => id === selectedLayoutElement.value) ?? null);
const selectedQrElement = computed(() => selectedCustomElement.value?.kind === 'qr' ? selectedCustomElement.value : null);
const selectedQrContent = computed(() => selectedQrElement.value?.dataBinding
    ? dataFields.value.find(({ id }) => id === selectedQrElement.value?.dataBinding)?.value ?? selectedQrElement.value.qrValue
    : selectedQrElement.value?.qrValue ?? '');
const hasEditableContent = computed(() => activeEditorTool.value === 'layout' && !hasMultipleLayoutSelection.value && (
    selectedQrElement.value !== null || selectedLayoutTextContent.value !== null
));
const placeholderOptions = computed(() => dataFields.value
    .filter(({ type }) => type === 'text')
    .map((field) => publisherPlaceholderOptions(field)[0]));
const formatterOptions = computed(() => dataFields.value
    .filter(({ formatType }) => formatType === 'date' || formatType === 'time' || formatType === 'list' || formatType === 'number')
    .flatMap((field) => publisherPlaceholderOptions(field).slice(1).map((option) => ({
        label: `${field.label}: ${resolvePublisherPlaceholders(option.placeholder, { [field.id]: field })}`,
        placeholder: option.placeholder,
    }))));
const repeatableFields = computed(() => dataFields.value.filter(({ formatType, values }) =>
    formatType === 'list' && Boolean(values)));
const selectionLabel = computed(() => {
    const customElements = activePage.value.layouts[activePage.value.templateId]?.customElements ?? [];
    return `${selectedLayoutGroupDepth.value ? `Gruppe ${selectedLayoutGroupDepth.value} · ` : ''}${selectedLayoutElements.value.map((elementId) =>
        customElements.find(({ id }) => id === elementId)?.name ?? layoutElementLabel(elementId)).join(', ')}`;
});
const selectedGroup = computed(() => flattenLayoutGroups(
    activePage.value.layouts[activePage.value.templateId]?.groups ?? [],
).find((group) =>
    findLayoutGroupDepth(activePage.value.layouts[activePage.value.templateId]?.groups ?? [], group.id) === selectedLayoutGroupDepth.value &&
    layoutGroupElementIds(group).length === selectedLayoutElements.value.length &&
    layoutGroupElementIds(group).every((elementId) => selectedLayoutElements.value.includes(elementId)),
));
const groupAutoLayout = computed(() => selectedGroup.value?.autoLayout ?? {
    axis: 'vertical' as const,
    gap: 8,
    horizontalOrigin: 'left' as const,
    verticalOrigin: 'top' as const,
});
const groupRepeat = computed<LayoutGroupRepeat>(() => selectedGroup.value?.repeat ?? {
    sourceFieldId: repeatableFields.value[0]?.id ?? '',
    itemAlias: 'item',
    axis: 'vertical',
    gap: 8,
});
const variableDialogOpen = ref(false);

const emit = defineEmits<{
    align: [alignment: LayoutAlignment];
    changeLayer: [direction: -1 | 1];
    distribute: [axis: LayoutDistributionAxis];
    group: [];
    resetImageFocus: [];
    setGroupAutoLayout: [settings: {
        axis: LayoutDistributionAxis;
        gap: number;
        horizontalOrigin: LayoutHorizontalOrigin;
        verticalOrigin: LayoutVerticalOrigin;
    } | null];
    setGroupRepeat: [settings: LayoutGroupRepeat | null];
    ungroup: [];
    updateQrContent: [value: string];
    updateTextContent: [value: string];
}>();

const updateSnap = (event: Event) => { snapEnabled.value = (event.target as HTMLInputElement).checked; };
const updateAutoLayout = (
    field: 'axis' | 'gap' | 'horizontalOrigin' | 'verticalOrigin',
    value: string | number,
) => emit('setGroupAutoLayout', {
    axis: field === 'axis' ? value as LayoutDistributionAxis : groupAutoLayout.value.axis,
    gap: field === 'gap' ? Number(value) : groupAutoLayout.value.gap,
    horizontalOrigin: field === 'horizontalOrigin' ? value as LayoutHorizontalOrigin : groupAutoLayout.value.horizontalOrigin,
    verticalOrigin: field === 'verticalOrigin' ? value as LayoutVerticalOrigin : groupAutoLayout.value.verticalOrigin,
});
const updateGroupRepeat = (field: keyof LayoutGroupRepeat, value: string | number) => emit('setGroupRepeat', {
    ...groupRepeat.value,
    [field]: field === 'gap' ? Number(value) : value,
});
const updateContent = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    if (selectedQrElement.value) emit('updateQrContent', value);
    else emit('updateTextContent', value);
};
const insertTextPlaceholder = (placeholder: string) => {
    if (selectedLayoutTextContent.value === null) return;
    const current = selectedLayoutTextContent.value;
    emit('updateTextContent', `${current}${current && !current.endsWith(' ') ? ' ' : ''}${placeholder}`);
};
const insertPlaceholder = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    if (select.value) insertTextPlaceholder(select.value);
    select.value = '';
};
const insertFormatter = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    if (select.value && selectedLayoutTextContent.value !== null) {
        emit('updateTextContent', select.value);
    }
    select.value = '';
};
const applyVariableExpression = (expression: string) => emit('updateTextContent', expression);
const placeholderLabel = (fieldId: string) => `{{${fieldId}}}`;
</script>

<template>
    <div class="publisher-contextbar">
        <div class="publisher-contextbar__selection" :class="{ 'has-content': hasEditableContent }" role="status">
            <strong>{{ hasLayoutSelection ? selectionLabel : activeEditorTool !== 'appointments' ? activeEditorToolLabel : 'Keine Auswahl' }}</strong>
        </div>
        <div v-if="hasEditableContent" class="publisher-contextbar__content" aria-label="Inhalt der Auswahl">
            <label class="sr-only" for="publisher-context-content">{{ selectedQrElement ? 'QR-Inhalt' : 'Textinhalt' }}</label>
            <input
                id="publisher-context-content"
                type="text"
                :aria-label="selectedQrElement ? 'QR-Inhalt' : 'Textinhalt'"
                :value="selectedQrElement ? selectedQrContent : selectedLayoutTextContent ?? ''"
                @input="updateContent"
            />
            <template v-if="!selectedQrElement && placeholderOptions.length">
                <select aria-label="Terminplatzhalter einfügen" value="" @change="insertPlaceholder">
                    <option value="">Platzhalter</option>
                    <option v-for="option in placeholderOptions" :key="option.placeholder" :value="option.placeholder">{{ option.label }}</option>
                </select>
            </template>
            <select v-if="!selectedQrElement && formatterOptions.length" aria-label="Datum, Uhrzeit, Liste oder Zahl formatieren" value="" @change="insertFormatter">
                <option value="">Formatierung</option>
                <option v-for="option in formatterOptions" :key="option.placeholder" :value="option.placeholder">{{ option.label }}</option>
            </select>
            <DesignIconButton
                v-if="!selectedQrElement && placeholderOptions.length"
                size="compact"
                label="Variable mit Fallback oder Bedingung einsetzen"
                @click="variableDialogOpen = true"
            ><FontAwesomeIcon :icon="faWandMagicSparkles" aria-hidden="true" /></DesignIconButton>
        </div>
        <div v-if="hasLayoutSelection" class="publisher-contextbar__actions" aria-label="Kontextaktionen für Auswahl">
            <DesignPopover label="Ebenen" :width="310" class="publisher-alignment-popover publisher-layer-popover" panel-class="publisher-alignment-popover__panel publisher-layer-popover__panel">
                    <section>
                        <strong>Reihenfolge und Gruppen</strong>
                        <small v-if="selectedLayoutElement && !hasMultipleLayoutSelection">Ebene {{ selectedLayerPosition }} von {{ selectedLayerTotal }}</small>
                        <div class="publisher-alignment-popover__buttons" role="group" aria-label="Ebenenaktionen">
                            <DesignButton variant="secondary" size="compact" :disabled="!selectedLayoutElement || hasMultipleLayoutSelection || selectedLayerPosition <= 1" @click="emit('changeLayer', -1)">Nach hinten</DesignButton>
                            <DesignButton variant="secondary" size="compact" :disabled="!selectedLayoutElement || hasMultipleLayoutSelection || selectedLayerPosition >= selectedLayerTotal" @click="emit('changeLayer', 1)">Nach vorne</DesignButton>
                            <DesignButton variant="secondary" size="compact" :disabled="!canGroupLayoutSelection" @click="emit('group')">Gruppieren</DesignButton>
                            <DesignButton variant="secondary" size="compact" :disabled="!canUngroupLayoutSelection" @click="emit('ungroup')">Gruppe lösen</DesignButton>
                        </div>
                    </section>
            </DesignPopover>
            <DesignPopover label="Ausrichtung" :width="430" class="publisher-alignment-popover" panel-class="publisher-alignment-popover__panel">
                    <section>
                        <strong>Horizontal ausrichten</strong>
                        <div class="publisher-alignment-popover__buttons" role="group" aria-label="Horizontal ausrichten">
                            <DesignButton v-for="action in ([['left', 'Links'], ['horizontalCenter', 'Mitte'], ['right', 'Rechts']] as const)" :key="action[0]" variant="secondary" size="compact" @click="emit('align', action[0])">{{ action[1] }}</DesignButton>
                            <DesignButton variant="secondary" size="compact" :disabled="selectedLayoutElements.length < 3" @click="emit('distribute', 'horizontal')">Verteilen</DesignButton>
                        </div>
                    </section>
                    <section>
                        <strong>Vertikal ausrichten</strong>
                        <div class="publisher-alignment-popover__buttons" role="group" aria-label="Vertikal ausrichten">
                            <DesignButton v-for="action in ([['top', 'Oben'], ['verticalCenter', 'Mitte'], ['bottom', 'Unten']] as const)" :key="action[0]" variant="secondary" size="compact" @click="emit('align', action[0])">{{ action[1] }}</DesignButton>
                            <DesignButton variant="secondary" size="compact" :disabled="selectedLayoutElements.length < 3" @click="emit('distribute', 'vertical')">Verteilen</DesignButton>
                        </div>
                    </section>
                    <section class="publisher-alignment-popover__auto-layout">
                        <label class="publisher-alignment-popover__toggle"><input type="checkbox" :checked="Boolean(selectedGroup?.autoLayout)" :disabled="!selectedGroup" @change="($event.target as HTMLInputElement).checked ? updateAutoLayout('axis', groupAutoLayout.axis) : emit('setGroupAutoLayout', null)" /> Automatisches Gruppenlayout</label>
                        <template v-if="selectedGroup?.autoLayout">
                            <div class="publisher-alignment-popover__setting"><span>Richtung</span><div class="publisher-alignment-popover__buttons"><DesignButton size="compact" :variant="groupAutoLayout.axis === 'vertical' ? 'primary' : 'secondary'" @click="updateAutoLayout('axis', 'vertical')">Vertikal</DesignButton><DesignButton size="compact" :variant="groupAutoLayout.axis === 'horizontal' ? 'primary' : 'secondary'" @click="updateAutoLayout('axis', 'horizontal')">Horizontal</DesignButton></div></div>
                            <label class="publisher-alignment-popover__setting"><span>Abstand</span><input type="number" min="0" max="4096" step="1" :value="groupAutoLayout.gap" @input="updateAutoLayout('gap', ($event.target as HTMLInputElement).valueAsNumber)" /><small>px</small></label>
                            <div class="publisher-alignment-popover__setting"><span>Ursprung</span><div class="publisher-origin-grid" role="group" aria-label="Ursprung der automatischen Gruppe"><button v-for="origin in ([['left', 'top'], ['center', 'top'], ['right', 'top'], ['left', 'center'], ['center', 'center'], ['right', 'center'], ['left', 'bottom'], ['center', 'bottom'], ['right', 'bottom']] as const)" :key="`${origin[0]}-${origin[1]}`" type="button" :class="{ 'is-active': groupAutoLayout.horizontalOrigin === origin[0] && groupAutoLayout.verticalOrigin === origin[1] }" :aria-label="`Ursprung ${origin[0]} ${origin[1]}`" @click="emit('setGroupAutoLayout', { ...groupAutoLayout, horizontalOrigin: origin[0], verticalOrigin: origin[1] })" /></div></div>
                        </template>
                        <p v-else-if="!selectedGroup">Gruppiere die Elemente zuerst, um einen dauerhaften Abstand und Reflow zu aktivieren.</p>
                    </section>
                    <section class="publisher-alignment-popover__auto-layout">
                        <label class="publisher-alignment-popover__toggle"><input type="checkbox" :checked="Boolean(selectedGroup?.repeat)" :disabled="!selectedGroup || repeatableFields.length === 0" @change="($event.target as HTMLInputElement).checked ? emit('setGroupRepeat', groupRepeat) : emit('setGroupRepeat', null)" /> Gruppe aus Liste wiederholen</label>
                        <template v-if="selectedGroup?.repeat">
                            <label class="publisher-alignment-popover__setting"><span>Datenquelle</span><select :value="groupRepeat.sourceFieldId" @change="updateGroupRepeat('sourceFieldId', ($event.target as HTMLSelectElement).value)"><option v-for="field in repeatableFields" :key="field.id" :value="field.id">{{ field.label }} ({{ field.values?.length ?? 0 }})</option></select></label>
                            <div class="publisher-alignment-popover__setting"><span>Richtung</span><div class="publisher-alignment-popover__buttons"><DesignButton size="compact" :variant="groupRepeat.axis === 'vertical' ? 'primary' : 'secondary'" @click="updateGroupRepeat('axis', 'vertical')">Vertikal</DesignButton><DesignButton size="compact" :variant="groupRepeat.axis === 'horizontal' ? 'primary' : 'secondary'" @click="updateGroupRepeat('axis', 'horizontal')">Horizontal</DesignButton></div></div>
                            <label class="publisher-alignment-popover__setting"><span>Abstand</span><input type="number" min="0" max="4096" step="1" :value="groupRepeat.gap" @input="updateGroupRepeat('gap', ($event.target as HTMLInputElement).valueAsNumber)" /><small>px</small></label>
                            <label class="publisher-alignment-popover__setting"><span>Alias</span><input :value="groupRepeat.itemAlias" maxlength="32" pattern="[a-zA-Z][a-zA-Z0-9_-]*" @change="updateGroupRepeat('itemAlias', ($event.target as HTMLInputElement).value)" /><small>{{ placeholderLabel(groupRepeat.itemAlias) }}</small></label>
                            <p>Die Gruppe wird für höchstens 100 Listeneinträge gerendert. {{ placeholderLabel(groupRepeat.sourceFieldId) }} und {{ placeholderLabel(groupRepeat.itemAlias) }} enthalten jeweils den aktuellen Eintrag.</p>
                        </template>
                        <p v-else-if="repeatableFields.length === 0">Lade zuerst ein Datenfeld mit mehreren Werten, zum Beispiel einen Dienst mit mehreren Personen.</p>
                    </section>
            </DesignPopover>
        </div>
        <div v-else-if="activeEditorTool === 'data' && hasImage" class="publisher-contextbar__actions">
            <DesignButton variant="ghost" size="compact" @click="emit('resetImageFocus')">Bildausschnitt zentrieren</DesignButton>
        </div>
        <div v-else class="publisher-contextbar__hint">{{ activeEditorTool === 'layout' ? 'Element auf der Seite oder in der Ebenenliste auswählen' : 'Einstellungen im rechten Bedienfeld' }}</div>
        <label class="publisher-contextbar__toggle" title="Richtet Position, Größe und Drehung beim Verschieben an Seitenrändern, anderen Elementen und sinnvollen Rasterwerten aus."><input type="checkbox" :checked="snapEnabled" @change="updateSnap" /> Einrasten</label>
    </div>
    <PublisherVariableDialog
        :fields="dataFields.filter(({ type }) => type === 'text')"
        :open="variableDialogOpen"
        @apply="applyVariableExpression"
        @close="variableDialogOpen = false"
    />
</template>
