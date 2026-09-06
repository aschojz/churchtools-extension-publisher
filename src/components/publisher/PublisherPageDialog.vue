<script setup lang="ts">
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

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
    <div v-if="open" class="publisher-page-dialog-backdrop" @click.self="emit('close')">
        <form class="publisher-page-dialog" @submit.prevent="emit('submit')">
            <header><div><h2>Neue Seite</h2></div><DesignIconButton label="Dialog schließen" @click="emit('close')">×</DesignIconButton></header>
            <label class="inspector-field">Format<select :value="preset" @change="emit('update:preset', ($event.target as HTMLSelectElement).value)"><option v-for="option in presets" :key="option.id" :value="option.id">{{ option.label }}</option><option value="custom">Benutzerdefiniert</option></select></label>
            <div class="publisher-page-dialog__dimensions">
                <label class="inspector-field">Breite in Pixeln<input type="number" min="64" max="8192" :value="width" @input="emit('update:width', value($event)); emit('update:preset', 'custom')" /></label>
                <label class="inspector-field">Höhe in Pixeln<input type="number" min="64" max="8192" :value="height" @input="emit('update:height', value($event)); emit('update:preset', 'custom')" /></label>
            </div>
            <p v-if="error" class="local-draft__error" role="alert">{{ error }}</p>
            <footer><DesignButton variant="secondary" @click="emit('close')">Abbrechen</DesignButton><DesignButton type="submit">Seite anlegen</DesignButton></footer>
        </form>
    </div>
</template>
