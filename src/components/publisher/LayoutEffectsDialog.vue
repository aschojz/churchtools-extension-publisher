<script setup lang="ts">
import { faDroplet, faLayerGroup, faMoon, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed, nextTick, ref, watch } from 'vue';

import {
    createLayoutElementEffects,
    normalizeLayoutElementEffects,
    type LayoutElementEffects,
} from '../../domain/layoutEditing';
import DesignButton from '../design/DesignButton.vue';
import DesignDialog from '../design/DesignDialog.vue';
import PublisherColorPicker from './PublisherColorPicker.vue';

const props = defineProps<{
    effects: LayoutElementEffects;
    open: boolean;
    selectionCount: number;
}>();

const emit = defineEmits<{
    apply: [effects: LayoutElementEffects];
    close: [];
}>();

type EffectSection = 'shadow' | 'blur' | 'appearance';
const effectSections: EffectSection[] = ['shadow', 'blur', 'appearance'];
const activeSection = ref<EffectSection>('shadow');
const draft = ref<LayoutElementEffects>(createLayoutElementEffects());
const cloneEffects = (effects: LayoutElementEffects) => ({
    ...effects,
    shadow: { ...effects.shadow },
    blur: { ...effects.blur },
});
watch(
    () => [props.open, props.effects] as const,
    ([open, effects]) => {
        if (open) draft.value = cloneEffects(normalizeLayoutElementEffects(effects));
    },
    { deep: true, immediate: true },
);

const opacityPercent = computed({
    get: () => Math.round(draft.value.opacity * 100),
    set: (value: number) => { draft.value.opacity = Math.min(1, Math.max(0, Number(value) / 100)); },
});
const shadowOpacityPercent = computed({
    get: () => Math.round(draft.value.shadow.opacity * 100),
    set: (value: number) => { draft.value.shadow.opacity = Math.min(1, Math.max(0, Number(value) / 100)); },
});
const removeEffects = () => {
    emit('apply', createLayoutElementEffects());
    emit('close');
};
const applyEffects = () => {
    emit('apply', cloneEffects(draft.value));
    emit('close');
};
const handleEffectTabKeydown = async (event: KeyboardEvent) => {
    const index = effectSections.indexOf(activeSection.value);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % effectSections.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + effectSections.length) % effectSections.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = effectSections.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activeSection.value = effectSections[nextIndex]!;
    await nextTick();
    document.getElementById(`publisher-effects-${activeSection.value}-tab`)?.focus();
};
</script>

<template>
    <DesignDialog
        :open="open"
        title="Ebeneneffekte"
        :description="`${selectionCount} Ebene${selectionCount === 1 ? '' : 'n'} ausgewählt`"
        panel-class="publisher-effects-dialog"
        body-class="publisher-effects-dialog__dialog-body"
        @close="emit('close')"
    >
        <template #icon><FontAwesomeIcon :icon="faWandMagicSparkles" /></template>
        <form id="publisher-effects-dialog-form" class="publisher-effects-dialog__form" @submit.prevent="applyEffects">
            <div class="publisher-effects-dialog__body">
                <nav role="tablist" aria-label="Effekte" aria-orientation="vertical" @keydown="handleEffectTabKeydown">
                    <div class="publisher-effects-dialog__nav-item" :class="{ 'is-active': activeSection === 'shadow' }">
                        <button id="publisher-effects-shadow-tab" :data-dialog-initial-focus="activeSection === 'shadow' ? '' : undefined" type="button" role="tab" aria-controls="publisher-effects-shadow-panel" :aria-selected="activeSection === 'shadow'" :tabindex="activeSection === 'shadow' ? 0 : -1" @click="activeSection = 'shadow'">
                            <FontAwesomeIcon :icon="faMoon" aria-hidden="true" /><span>Schlagschatten</span>
                        </button>
                        <input v-model="draft.shadow.enabled" type="checkbox" aria-label="Schlagschatten aktivieren" />
                    </div>
                    <div class="publisher-effects-dialog__nav-item" :class="{ 'is-active': activeSection === 'blur' }">
                        <button id="publisher-effects-blur-tab" :data-dialog-initial-focus="activeSection === 'blur' ? '' : undefined" type="button" role="tab" aria-controls="publisher-effects-blur-panel" :aria-selected="activeSection === 'blur'" :tabindex="activeSection === 'blur' ? 0 : -1" @click="activeSection = 'blur'">
                            <FontAwesomeIcon :icon="faDroplet" aria-hidden="true" /><span>Weichzeichnen</span>
                        </button>
                        <input v-model="draft.blur.enabled" type="checkbox" aria-label="Weichzeichnen aktivieren" />
                    </div>
                    <div class="publisher-effects-dialog__nav-item" :class="{ 'is-active': activeSection === 'appearance' }">
                        <button id="publisher-effects-appearance-tab" :data-dialog-initial-focus="activeSection === 'appearance' ? '' : undefined" type="button" role="tab" aria-controls="publisher-effects-appearance-panel" :aria-selected="activeSection === 'appearance'" :tabindex="activeSection === 'appearance' ? 0 : -1" @click="activeSection = 'appearance'">
                            <FontAwesomeIcon :icon="faLayerGroup" aria-hidden="true" /><span>Darstellung</span>
                        </button>
                        <i :class="{ 'is-enabled': draft.opacity < 1 || draft.blendMode !== 'source-over' }" aria-hidden="true" />
                    </div>
                </nav>

                <section v-if="activeSection === 'shadow'" id="publisher-effects-shadow-panel" role="tabpanel" aria-labelledby="publisher-effects-shadow-tab" class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading"><div><strong>Schlagschatten</strong><small>Folgt dem sichtbaren Inhalt der Ebene.</small></div><label><input v-model="draft.shadow.enabled" type="checkbox" /> Aktiv</label></div>
                    <fieldset :disabled="!draft.shadow.enabled">
                        <label class="inspector-color-field"><PublisherColorPicker v-model="draft.shadow.color" label="Schattenfarbe" :disabled="!draft.shadow.enabled" /><span><strong>Farbe</strong><small>{{ draft.shadow.color.toUpperCase() }}</small></span></label>
                        <label class="publisher-effects-dialog__range"><span>Deckkraft</span><input v-model.number="shadowOpacityPercent" type="range" min="0" max="100" step="1" /><input v-model.number="shadowOpacityPercent" type="number" min="0" max="100" step="1" /><small>%</small></label>
                        <label class="publisher-effects-dialog__range"><span>Weichzeichnung</span><input v-model.number="draft.shadow.blur" type="range" min="0" max="200" step="1" /><input v-model.number="draft.shadow.blur" type="number" min="0" max="200" step="1" /><small>px</small></label>
                        <div class="publisher-effects-dialog__pair"><label>Versatz X<input v-model.number="draft.shadow.offsetX" type="number" min="-500" max="500" step="1" /></label><label>Versatz Y<input v-model.number="draft.shadow.offsetY" type="number" min="-500" max="500" step="1" /></label></div>
                        <label class="publisher-effects-dialog__check"><input v-model="draft.shadow.forStroke" type="checkbox" /> Kontur wirft ebenfalls Schatten</label>
                    </fieldset>
                </section>

                <section v-else-if="activeSection === 'blur'" id="publisher-effects-blur-panel" role="tabpanel" aria-labelledby="publisher-effects-blur-tab" class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading"><div><strong>Gaußsche Unschärfe</strong><small>Zeichnet den sichtbaren Ebeneninhalt weich.</small></div><label><input v-model="draft.blur.enabled" type="checkbox" /> Aktiv</label></div>
                    <fieldset :disabled="!draft.blur.enabled">
                        <label class="publisher-effects-dialog__range"><span>Radius</span><input v-model.number="draft.blur.radius" type="range" min="0" max="100" step="1" /><input v-model.number="draft.blur.radius" type="number" min="0" max="100" step="1" /><small>px</small></label>
                    </fieldset>
                </section>

                <section v-else id="publisher-effects-appearance-panel" role="tabpanel" aria-labelledby="publisher-effects-appearance-tab" class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading"><div><strong>Darstellung</strong><small>Wirkt auf die komplette Ebene.</small></div></div>
                    <fieldset>
                        <label class="publisher-effects-dialog__range"><span>Deckkraft</span><input v-model.number="opacityPercent" type="range" min="0" max="100" step="1" /><input v-model.number="opacityPercent" type="number" min="0" max="100" step="1" /><small>%</small></label>
                        <label class="inspector-field">Mischmodus<select v-model="draft.blendMode"><option value="source-over">Normal</option><option value="multiply">Multiplizieren</option><option value="screen">Negativ multiplizieren</option><option value="overlay">Ineinanderkopieren</option><option value="darken">Abdunkeln</option><option value="lighten">Aufhellen</option></select></label>
                    </fieldset>
                </section>
            </div>
        </form>
        <template #footer><DesignButton type="button" variant="danger" @click="removeEffects">Effekte entfernen</DesignButton><span /><DesignButton type="button" variant="secondary" @click="emit('close')">Abbrechen</DesignButton><DesignButton type="submit" form="publisher-effects-dialog-form">Anwenden</DesignButton></template>
    </DesignDialog>
</template>

<style scoped>
.publisher-effects-dialog__form {
    min-height: 0;
    height: 100%;
}
</style>
