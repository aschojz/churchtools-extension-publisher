<script setup lang="ts">
import { faDroplet, faLayerGroup, faMoon, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed, ref, watch } from 'vue';

import {
    createLayoutElementEffects,
    normalizeLayoutElementEffects,
    type LayoutElementEffects,
} from '../../domain/layoutEditing';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';

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
</script>

<template>
    <div v-if="open" class="publisher-page-dialog-backdrop publisher-effects-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form class="publisher-page-dialog publisher-effects-dialog" role="dialog" aria-modal="true" aria-labelledby="publisher-effects-dialog-title" @submit.prevent="applyEffects">
            <header>
                <div><h2 id="publisher-effects-dialog-title">Ebeneneffekte</h2><span>{{ selectionCount }} Ebene{{ selectionCount === 1 ? '' : 'n' }}</span></div>
                <DesignIconButton label="Dialog schließen" @click="emit('close')"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton>
            </header>

            <div class="publisher-effects-dialog__body">
                <nav aria-label="Effekte">
                    <button type="button" :class="{ 'is-active': activeSection === 'shadow' }" @click="activeSection = 'shadow'">
                        <FontAwesomeIcon :icon="faMoon" aria-hidden="true" /><span>Schlagschatten</span>
                        <input v-model="draft.shadow.enabled" type="checkbox" aria-label="Schlagschatten aktivieren" @click.stop />
                    </button>
                    <button type="button" :class="{ 'is-active': activeSection === 'blur' }" @click="activeSection = 'blur'">
                        <FontAwesomeIcon :icon="faDroplet" aria-hidden="true" /><span>Weichzeichnen</span>
                        <input v-model="draft.blur.enabled" type="checkbox" aria-label="Weichzeichnen aktivieren" @click.stop />
                    </button>
                    <button type="button" :class="{ 'is-active': activeSection === 'appearance' }" @click="activeSection = 'appearance'">
                        <FontAwesomeIcon :icon="faLayerGroup" aria-hidden="true" /><span>Darstellung</span>
                        <i :class="{ 'is-enabled': draft.opacity < 1 || draft.blendMode !== 'source-over' }" aria-hidden="true" />
                    </button>
                </nav>

                <section v-if="activeSection === 'shadow'" class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading"><div><strong>Schlagschatten</strong><small>Folgt dem sichtbaren Inhalt der Ebene.</small></div><label><input v-model="draft.shadow.enabled" type="checkbox" /> Aktiv</label></div>
                    <fieldset :disabled="!draft.shadow.enabled">
                        <label class="inspector-color-field"><input v-model="draft.shadow.color" type="color" aria-label="Schattenfarbe" /><span><strong>Farbe</strong><small>{{ draft.shadow.color.toUpperCase() }}</small></span></label>
                        <label class="publisher-effects-dialog__range"><span>Deckkraft</span><input v-model.number="shadowOpacityPercent" type="range" min="0" max="100" step="1" /><input v-model.number="shadowOpacityPercent" type="number" min="0" max="100" step="1" /><small>%</small></label>
                        <label class="publisher-effects-dialog__range"><span>Weichzeichnung</span><input v-model.number="draft.shadow.blur" type="range" min="0" max="200" step="1" /><input v-model.number="draft.shadow.blur" type="number" min="0" max="200" step="1" /><small>px</small></label>
                        <div class="publisher-effects-dialog__pair"><label>Versatz X<input v-model.number="draft.shadow.offsetX" type="number" min="-500" max="500" step="1" /></label><label>Versatz Y<input v-model.number="draft.shadow.offsetY" type="number" min="-500" max="500" step="1" /></label></div>
                        <label class="publisher-effects-dialog__check"><input v-model="draft.shadow.forStroke" type="checkbox" /> Kontur wirft ebenfalls Schatten</label>
                    </fieldset>
                </section>

                <section v-else-if="activeSection === 'blur'" class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading"><div><strong>Gaußsche Unschärfe</strong><small>Zeichnet den sichtbaren Ebeneninhalt weich.</small></div><label><input v-model="draft.blur.enabled" type="checkbox" /> Aktiv</label></div>
                    <fieldset :disabled="!draft.blur.enabled">
                        <label class="publisher-effects-dialog__range"><span>Radius</span><input v-model.number="draft.blur.radius" type="range" min="0" max="100" step="1" /><input v-model.number="draft.blur.radius" type="number" min="0" max="100" step="1" /><small>px</small></label>
                    </fieldset>
                </section>

                <section v-else class="publisher-effects-dialog__settings">
                    <div class="publisher-effects-dialog__heading"><div><strong>Darstellung</strong><small>Wirkt auf die komplette Ebene.</small></div></div>
                    <fieldset>
                        <label class="publisher-effects-dialog__range"><span>Deckkraft</span><input v-model.number="opacityPercent" type="range" min="0" max="100" step="1" /><input v-model.number="opacityPercent" type="number" min="0" max="100" step="1" /><small>%</small></label>
                        <label class="inspector-field">Mischmodus<select v-model="draft.blendMode"><option value="source-over">Normal</option><option value="multiply">Multiplizieren</option><option value="screen">Negativ multiplizieren</option><option value="overlay">Ineinanderkopieren</option><option value="darken">Abdunkeln</option><option value="lighten">Aufhellen</option></select></label>
                    </fieldset>
                </section>
            </div>

            <footer><DesignButton type="button" variant="danger" @click="removeEffects">Effekte entfernen</DesignButton><span /><DesignButton type="button" variant="secondary" @click="emit('close')">Abbrechen</DesignButton><DesignButton type="submit">Anwenden</DesignButton></footer>
        </form>
    </div>
</template>
