<script setup lang="ts">
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed, ref, watch } from 'vue';

import {
    createPublisherVariableExpression,
    publisherDataFormatterOptions,
    type PublisherDataField,
    type PublisherVariableTransform,
} from '../../domain/appointmentDataFields';
import DesignButton from '../design/DesignButton.vue';
import DesignDialog from '../design/DesignDialog.vue';

const props = defineProps<{
    fields: PublisherDataField[];
    open: boolean;
}>();

const emit = defineEmits<{
    apply: [expression: string];
    close: [];
}>();

type Condition = 'none' | 'empty' | 'not-empty' | 'equals' | 'not-equals' | 'contains';

const selectedFieldId = ref('');
const formatterIndex = ref(-1);
const fallback = ref('');
const condition = ref<Condition>('none');
const comparison = ref('');
const matchingOutput = ref('');
const otherOutput = ref('');
const selectedField = computed(() => props.fields.find(({ id }) => id === selectedFieldId.value) ?? props.fields[0] ?? null);
const formatterOptions = computed(() => selectedField.value ? publisherDataFormatterOptions(selectedField.value) : []);
const conditionNeedsComparison = computed(() => ['equals', 'not-equals', 'contains'].includes(condition.value));

const reset = () => {
    selectedFieldId.value = props.fields[0]?.id ?? '';
    formatterIndex.value = -1;
    fallback.value = '';
    condition.value = 'none';
    comparison.value = '';
    matchingOutput.value = '';
    otherOutput.value = '';
};

watch(() => props.open, (open) => { if (open) reset(); });
watch(selectedFieldId, () => { formatterIndex.value = -1; });

const apply = () => {
    if (!selectedField.value) return;
    const transforms: PublisherVariableTransform[] = [];
    const formatter = formatterOptions.value[formatterIndex.value]?.transform;
    if (formatter) transforms.push(formatter);
    if (fallback.value) transforms.push({ name: 'default', arguments: [fallback.value] });
    if (condition.value !== 'none') {
        const args = conditionNeedsComparison.value
            ? [condition.value, comparison.value, matchingOutput.value]
            : [condition.value, matchingOutput.value];
        if (otherOutput.value) args.push(otherOutput.value);
        transforms.push({ name: 'if', arguments: args });
    }
    emit('apply', createPublisherVariableExpression(selectedField.value.id, transforms));
    emit('close');
};
</script>

<template>
    <DesignDialog
        :open="open"
        title="Variable formatieren"
        description="Formate, Fallbacks und Bedingungen werden sicher in der Vorlage gespeichert."
        @close="emit('close')"
    >
        <template #icon><FontAwesomeIcon :icon="faWandMagicSparkles" /></template>
        <form class="publisher-variable-dialog" @submit.prevent="apply">
            <label class="inspector-field">
                Datenfeld
                <select v-model="selectedFieldId" required>
                    <option v-for="field in fields" :key="field.id" :value="field.id">{{ field.label }} · {{ field.value || 'leer' }}</option>
                </select>
            </label>
            <label v-if="formatterOptions.length" class="inspector-field">
                Ausgabeformat
                <select v-model.number="formatterIndex">
                    <option :value="-1">Originalwert</option>
                    <option v-for="(option, index) in formatterOptions" :key="`${option.transform.name}-${index}`" :value="index">{{ option.label }}</option>
                </select>
            </label>
            <label class="inspector-field">
                Fallback bei leerem Wert
                <input v-model="fallback" maxlength="256" placeholder="z. B. Ort folgt" />
            </label>
            <fieldset>
                <legend>Bedingte Ausgabe</legend>
                <label class="inspector-field">
                    Bedingung
                    <select v-model="condition">
                        <option value="none">Keine</option>
                        <option value="empty">Wert ist leer</option>
                        <option value="not-empty">Wert ist nicht leer</option>
                        <option value="equals">Wert ist gleich</option>
                        <option value="not-equals">Wert ist nicht gleich</option>
                        <option value="contains">Wert enthält</option>
                    </select>
                </label>
                <template v-if="condition !== 'none'">
                    <label v-if="conditionNeedsComparison" class="inspector-field">
                        Vergleichswert
                        <input v-model="comparison" maxlength="256" />
                    </label>
                    <div class="publisher-variable-dialog__outputs">
                        <label class="inspector-field">
                            Ausgabe, wenn erfüllt
                            <input v-model="matchingOutput" maxlength="256" placeholder="Leer lassen zum Ausblenden" />
                        </label>
                        <label class="inspector-field">
                            Sonst
                            <input v-model="otherOutput" maxlength="256" placeholder="Leer lassen für Originalwert" />
                        </label>
                    </div>
                </template>
            </fieldset>
        </form>
        <template #footer>
            <DesignButton variant="secondary" @click="emit('close')">Abbrechen</DesignButton>
            <DesignButton :disabled="!selectedField" @click="apply">Variable einsetzen</DesignButton>
        </template>
    </DesignDialog>
</template>

<style scoped>
.publisher-variable-dialog {
    display: grid;
    gap: 14px;
    padding: 18px;
}

.publisher-variable-dialog fieldset {
    display: grid;
    min-width: 0;
    margin: 0;
    padding: 14px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    gap: 12px;
}

.publisher-variable-dialog legend {
    padding: 0 5px;
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 800;
}

.publisher-variable-dialog__outputs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

@media (max-width: 560px) {
    .publisher-variable-dialog__outputs {
        grid-template-columns: 1fr;
    }
}
</style>
