<script setup lang="ts">
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import DesignButton from './DesignButton.vue';
import DesignDialog from './DesignDialog.vue';

withDefaults(defineProps<{
    confirmLabel?: string;
    description: string;
    open: boolean;
    title: string;
}>(), { confirmLabel: 'Löschen' });

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
    <DesignDialog :open="open" :title="title" :description="description" @close="emit('close')">
        <template #icon><FontAwesomeIcon :icon="faTriangleExclamation" aria-hidden="true" /></template>
        <div class="design-confirm-dialog__content">
            <p>Diese Aktion betrifft den dauerhaft gespeicherten Eintrag und kann nicht über Rückgängig wiederhergestellt werden.</p>
        </div>
        <template #footer>
            <DesignButton variant="secondary" @click="emit('close')">Abbrechen</DesignButton>
            <DesignButton variant="danger" @click="emit('confirm')">{{ confirmLabel }}</DesignButton>
        </template>
    </DesignDialog>
</template>
