<script setup lang="ts">
import { faFileCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import DesignButton from '../design/DesignButton.vue';
import DesignDialog from '../design/DesignDialog.vue';

defineProps<{
    error: string;
    height: number;
    open: boolean;
    preset: string;
    presets: readonly { id: string; label: string; width: number; height: number }[];
    width: number;
}>();

const emit = defineEmits<{
    close: [];
    submit: [];
    'update:height': [value: number];
    'update:preset': [value: string];
    'update:width': [value: number];
}>();
const value = (event: Event) => Number((event.target as HTMLInputElement).value);
</script>

<template>
    <DesignDialog
        :open="open"
        title="Neue Seite"
        description="Format wählen oder eigene Pixelmaße eingeben."
        panel-class="publisher-page-dialog"
        @close="emit('close')"
    >
        <template #icon><FontAwesomeIcon :icon="faFileCirclePlus" /></template>
        <form id="publisher-page-dialog-form" class="publisher-page-dialog__form" @submit.prevent="emit('submit')">
            <label class="inspector-field">Format<select data-dialog-initial-focus :value="preset" @change="emit('update:preset', ($event.target as HTMLSelectElement).value)"><option v-for="option in presets" :key="option.id" :value="option.id">{{ option.label }}</option><option value="custom">Benutzerdefiniert</option></select></label>
            <div class="publisher-page-dialog__dimensions">
                <label class="inspector-field">Breite in Pixeln<input type="number" min="64" max="8192" :value="width" @input="emit('update:width', value($event)); emit('update:preset', 'custom')" /></label>
                <label class="inspector-field">Höhe in Pixeln<input type="number" min="64" max="8192" :value="height" @input="emit('update:height', value($event)); emit('update:preset', 'custom')" /></label>
            </div>
            <p v-if="error" class="local-draft__error" role="alert">{{ error }}</p>
        </form>
        <template #footer><DesignButton variant="secondary" @click="emit('close')">Abbrechen</DesignButton><DesignButton type="submit" form="publisher-page-dialog-form">Seite anlegen</DesignButton></template>
    </DesignDialog>
</template>

<style scoped>
.publisher-page-dialog__form {
    display: grid;
    padding: 18px;
    gap: 16px;
}
</style>
