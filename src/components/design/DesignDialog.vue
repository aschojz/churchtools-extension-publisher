<script setup lang="ts">
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

import DesignIconButton from './DesignIconButton.vue';

const props = withDefaults(defineProps<{
    description?: string;
    open: boolean;
    size?: 'default' | 'wide';
    title: string;
}>(), {
    description: '',
    size: 'default',
});

const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement | null>(null);
const dark = ref(false);
let returnFocus: HTMLElement | null = null;
const titleId = useId();

const focusableElements = () => [...(dialog.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
) ?? [])].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

const close = () => emit('close');
const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableElements();
    if (focusable.length === 0) {
        event.preventDefault();
        dialog.value?.focus();
        return;
    }
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

watch(() => props.open, async (open) => {
    if (open) {
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dark.value = Boolean(returnFocus?.closest('.dark'));
        await nextTick();
        (focusableElements()[0] ?? dialog.value)?.focus();
    } else if (returnFocus) {
        await nextTick();
        returnFocus.focus();
        returnFocus = null;
    }
}, { immediate: true });

onBeforeUnmount(() => returnFocus?.focus());
</script>

<template>
    <Teleport to="body">
        <div v-if="open" class="design-dialog-backdrop" :class="{ dark }" @click.self="close">
            <section
                ref="dialog"
                class="design-dialog"
                :class="`design-dialog--${size}`"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="titleId"
                tabindex="-1"
                @keydown="handleKeydown"
            >
                <header class="design-dialog__header">
                    <div class="design-dialog__heading">
                        <span v-if="$slots.icon" class="design-dialog__icon" aria-hidden="true"><slot name="icon" /></span>
                        <div><h2 :id="titleId">{{ title }}</h2><small v-if="description">{{ description }}</small></div>
                    </div>
                    <DesignIconButton label="Dialog schließen" @click="close"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton>
                </header>
                <div class="design-dialog__body"><slot /></div>
                <footer v-if="$slots.footer" class="design-dialog__footer"><slot name="footer" /></footer>
            </section>
        </div>
    </Teleport>
</template>
