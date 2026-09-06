<script setup lang="ts">
import { faCaretUp, faCircle, faFont, faIcons, faImage, faMinus, faParagraph, faQrcode, faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { ref } from 'vue';

import type { LayoutCustomElementKind, LayoutTextMode } from '../../domain/layoutEditing';
import { PUBLISHER_ICONS, type PublisherIconName } from '../../domain/publisherIcons';
import DesignIconButton from '../design/DesignIconButton.vue';

defineProps<{ disabled: boolean }>();
const emit = defineEmits<{
    add: [kind: Exclude<LayoutCustomElementKind, 'image' | 'text'>];
    addImage: [file: File];
    addIcon: [iconName: PublisherIconName];
    addQr: [];
    addText: [mode: LayoutTextMode];
}>();
const imageInput = ref<HTMLInputElement | null>(null);
const iconMenuOpen = ref(false);
const chooseImage = () => imageInput.value?.click();
const handleImage = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) emit('addImage', file);
    input.value = '';
};
const chooseIcon = (iconName: PublisherIconName) => {
    emit('addIcon', iconName);
    iconMenuOpen.value = false;
};
</script>

<template>
    <div class="publisher-toolrail" role="toolbar" aria-label="Elemente hinzufügen">
        <DesignIconButton label="Grafiktext hinzufügen" :disabled="disabled" @click="emit('addText', 'graphic')"><FontAwesomeIcon :icon="faFont" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="Rahmentext hinzufügen" :disabled="disabled" @click="emit('addText', 'frame')"><FontAwesomeIcon :icon="faParagraph" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="Bild hinzufügen" :disabled="disabled" @click="chooseImage"><FontAwesomeIcon :icon="faImage" aria-hidden="true" /></DesignIconButton>
        <span class="publisher-toolrail__separator" aria-hidden="true" />
        <DesignIconButton label="Quadrat hinzufügen" :disabled="disabled" @click="emit('add', 'rectangle')"><FontAwesomeIcon :icon="faSquare" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="Kreis hinzufügen" :disabled="disabled" @click="emit('add', 'circle')"><FontAwesomeIcon :icon="faCircle" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="Dreieck hinzufügen" :disabled="disabled" @click="emit('add', 'triangle')"><FontAwesomeIcon :icon="faCaretUp" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="Strich hinzufügen" :disabled="disabled" @click="emit('add', 'line')"><FontAwesomeIcon :icon="faMinus" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="Font-Awesome-Icon hinzufügen" :disabled="disabled" :active="iconMenuOpen" toggle @click="iconMenuOpen = !iconMenuOpen"><FontAwesomeIcon :icon="faIcons" aria-hidden="true" /></DesignIconButton>
        <DesignIconButton label="QR-Code hinzufügen" :disabled="disabled" @click="emit('addQr')"><FontAwesomeIcon :icon="faQrcode" aria-hidden="true" /></DesignIconButton>
        <div v-if="iconMenuOpen" class="publisher-toolrail__icon-menu" role="menu" aria-label="Icon auswählen">
            <button v-for="item in PUBLISHER_ICONS" :key="item.id" type="button" role="menuitem" :aria-label="`${item.label} hinzufügen`" :title="item.label" @click="chooseIcon(item.id)"><FontAwesomeIcon :icon="item.icon" aria-hidden="true" /></button>
        </div>
        <input ref="imageInput" hidden type="file" accept="image/jpeg,image/png,image/webp" :disabled="disabled" @change="handleImage" />
    </div>
</template>
