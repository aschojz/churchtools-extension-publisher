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

const emit = defineEmits<{
    add: [kind: Exclude<LayoutCustomElementKind, 'image' | 'text'>];
    addImage: [];
    addIcon: [iconName: PublisherIconName];
    addQr: [];
    addText: [mode: LayoutTextMode];
}>();
const iconMenuOpen = ref(false);
const chooseIcon = (iconName: PublisherIconName) => {
    emit('addIcon', iconName);
    iconMenuOpen.value = false;
};
</script>

<template>
    <div class="publisher-toolrail" role="toolbar" aria-label="Elemente hinzufügen">
        <DesignIconButton
            label="Grafiktext hinzufügen"
            :icon="faFont"
            @click="emit('addText', 'graphic')"
        />
        <DesignIconButton
            label="Rahmentext hinzufügen"
            :icon="faParagraph"
            @click="emit('addText', 'frame')"
        />
        <DesignIconButton label="Bild hinzufügen" :icon="faImage" @click="emit('addImage')" />
        <span class="publisher-toolrail__separator" aria-hidden="true" />
        <DesignIconButton
            label="Quadrat hinzufügen"
            :icon="faSquare"
            @click="emit('add', 'rectangle')"
        />
        <DesignIconButton
            label="Kreis hinzufügen"
            :icon="faCircle"
            @click="emit('add', 'circle')"
        />
        <DesignIconButton
            label="Dreieck hinzufügen"
            :icon="faPlay"
            :rotation="270"
            @click="emit('add', 'triangle')"
        />
        <DesignIconButton label="Strich hinzufügen" :icon="faMinus" @click="emit('add', 'line')" />
        <DesignIconButton
            label="Font-Awesome-Icon hinzufügen"
            :active="iconMenuOpen"
            :icon="faIcons"
            toggle
            @click="iconMenuOpen = !iconMenuOpen"
        />
        <DesignIconButton label="QR-Code hinzufügen" :icon="faQrcode" @click="emit('addQr')" />
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
    </div>
</template>
