<script setup lang="ts">
import {
    faCircle,
    faFont,
    faIcons,
    faImage,
    faMinus,
    faParagraph,
    faPlay,
    faQrcode,
    faSquare,
} from '@fortawesome/free-solid-svg-icons';
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
        <DesignIconButton
            label="Grafiktext hinzufügen"
            :disabled="disabled"
            :icon="faFont"
            @click="emit('addText', 'graphic')"
        />
        <DesignIconButton
            label="Rahmentext hinzufügen"
            :disabled="disabled"
            :icon="faParagraph"
            @click="emit('addText', 'frame')"
        />
        <DesignIconButton label="Bild hinzufügen" :disabled="disabled" :icon="faImage" @click="chooseImage" />
        <span class="publisher-toolrail__separator" aria-hidden="true" />
        <DesignIconButton
            label="Quadrat hinzufügen"
            :disabled="disabled"
            :icon="faSquare"
            @click="emit('add', 'rectangle')"
        />
        <DesignIconButton
            label="Kreis hinzufügen"
            :disabled="disabled"
            :icon="faCircle"
            @click="emit('add', 'circle')"
        />
        <DesignIconButton
            label="Dreieck hinzufügen"
            :disabled="disabled"
            :icon="faPlay"
            :rotation="270"
            @click="emit('add', 'triangle')"
        />
        <DesignIconButton label="Strich hinzufügen" :disabled="disabled" :icon="faMinus" @click="emit('add', 'line')" />
        <DesignIconButton
            label="Font-Awesome-Icon hinzufügen"
            :disabled="disabled"
            :active="iconMenuOpen"
            :icon="faIcons"
            toggle
            @click="iconMenuOpen = !iconMenuOpen"
        />
        <DesignIconButton label="QR-Code hinzufügen" :disabled="disabled" :icon="faQrcode" @click="emit('addQr')" />
        <div v-if="iconMenuOpen" class="publisher-toolrail__icon-menu" role="menu" aria-label="Icon auswählen">
            <button
                v-for="item in PUBLISHER_ICONS"
                :key="item.id"
                type="button"
                role="menuitem"
                :aria-label="`${item.label} hinzufügen`"
                :title="item.label"
                @click="chooseIcon(item.id)"
            >
                <FontAwesomeIcon :icon="item.icon" aria-hidden="true" />
            </button>
        </div>
        <input
            ref="imageInput"
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="disabled"
            @change="handleImage"
        />
    </div>
</template>
