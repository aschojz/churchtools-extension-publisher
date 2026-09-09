<script setup lang="ts">
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed, ref } from 'vue';

import {
    imagePaletteTokenLabel,
    type ImagePaletteToken,
    type LayoutColorBinding,
    type PublisherImagePalette,
} from '../../domain/imagePalette';
import { usePublisherImagePalettesStore } from '../../stores/publisherImagePalettes';

const props = withDefaults(defineProps<{
    activeBinding?: LayoutColorBinding;
    disabled?: boolean;
    dynamic?: boolean;
    imageId: string;
    imageLabel: string;
    palette: PublisherImagePalette;
}>(), {
    activeBinding: undefined,
    disabled: false,
    dynamic: false,
});

const emit = defineEmits<{
    clearBinding: [];
    selectBinding: [token: ImagePaletteToken];
    selectColor: [color: string];
}>();

const paletteStore = usePublisherImagePalettesStore();
const roleTokens: ImagePaletteToken[] = ['primary', 'background', 'foreground'];
const assignmentToken = ref<ImagePaletteToken | null>(null);
const boundColor = computed(() => props.activeBinding?.imageId === props.imageId
    ? props.palette[props.activeBinding.token]
    : null);
const rolesForColor = (color: string) => roleTokens.filter((token) => props.palette[token] === color);
const roleClass = (token: ImagePaletteToken) => `is-${token}`;
const chooseRole = (token: ImagePaletteToken) => {
    assignmentToken.value = assignmentToken.value === token ? null : token;
};
const selectSwatch = (color: string) => {
    if (assignmentToken.value) {
        paletteStore.assignRole(props.imageId, assignmentToken.value, color);
        assignmentToken.value = null;
        return;
    }
    if (!props.disabled) emit('selectColor', color);
};
</script>

<template>
    <div class="publisher-image-palette-swatches" @keydown.esc="assignmentToken = null">
        <div class="publisher-image-palette-swatches__toolbar" aria-label="Rollen der Bildfarben festlegen">
            <button
                v-for="token in roleTokens"
                :key="token"
                type="button"
                :class="roleClass(token)"
                :aria-label="`${imagePaletteTokenLabel(token)}farbe festlegen`"
                :aria-pressed="assignmentToken === token"
                :title="`${imagePaletteTokenLabel(token)}farbe festlegen, dann ein Farbfeld wählen`"
                @click="chooseRole(token)"
            >
                <FontAwesomeIcon v-if="token === 'primary'" :icon="faStar" aria-hidden="true" />
                <i v-else class="publisher-image-palette-swatches__role" :class="roleClass(token)" aria-hidden="true" />
            </button>
            <button
                v-if="dynamic && activeBinding?.imageId === imageId"
                type="button"
                class="publisher-image-palette-swatches__unbind"
                aria-label="Dynamische Bildfarbe lösen"
                @click="emit('clearBinding')"
            >Lösen</button>
        </div>
        <div class="publisher-image-palette-swatches__grid" :aria-label="`Extrahierte Farben aus ${imageLabel}`">
            <span
                v-for="color in palette.colors"
                :key="color.id"
                class="publisher-image-palette-swatches__item"
                :class="{ 'is-bound': boundColor === color.hex }"
            >
                <button
                    type="button"
                    class="publisher-image-palette-swatches__color"
                    :style="{ backgroundColor: color.hex }"
                    :title="assignmentToken ? `${imagePaletteTokenLabel(assignmentToken)}farbe auf ${color.hex.toUpperCase()} setzen` : `${color.label}: ${color.hex.toUpperCase()}`"
                    :aria-label="assignmentToken ? `${imagePaletteTokenLabel(assignmentToken)}farbe auf ${color.hex.toUpperCase()} setzen` : `${color.label}: ${color.hex.toUpperCase()}`"
                    :disabled="disabled && !assignmentToken"
                    @click="selectSwatch(color.hex)"
                />
                <span v-if="rolesForColor(color.hex).length" class="publisher-image-palette-swatches__markers">
                    <button
                        v-for="token in rolesForColor(color.hex)"
                        :key="token"
                        type="button"
                        :class="roleClass(token)"
                        :aria-label="`${imagePaletteTokenLabel(token)} aus ${imageLabel} dynamisch verwenden`"
                        :aria-pressed="activeBinding?.imageId === imageId && activeBinding?.token === token"
                        :disabled="disabled || !dynamic"
                        :title="`${imagePaletteTokenLabel(token)} dynamisch verwenden`"
                        @click="emit('selectBinding', token)"
                    >
                        <FontAwesomeIcon v-if="token === 'primary'" :icon="faStar" aria-hidden="true" />
                        <i v-else class="publisher-image-palette-swatches__role" :class="roleClass(token)" aria-hidden="true" />
                    </button>
                </span>
            </span>
        </div>
    </div>
</template>
