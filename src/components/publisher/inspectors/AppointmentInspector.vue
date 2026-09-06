<script setup lang="ts">
import DesignButton from '../../design/DesignButton.vue';

const emit = defineEmits<{ open: [] }>();
</script>

<template>
    <section class="publisher-inspector__content"><div class="inspector-section"><h3>Terminauswahl</h3><p>Öffne die Terminauswahl, um ein Dokument anzulegen oder den aktuellen Termin zu wechseln.</p><DesignButton @click="emit('open')">Termin auswählen</DesignButton></div></section>
</template>
