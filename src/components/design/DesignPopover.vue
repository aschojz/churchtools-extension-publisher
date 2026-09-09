<script setup lang="ts">
import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

const props = withDefaults(defineProps<{
    align?: 'start' | 'end';
    disabled?: boolean;
    label: string;
    panelClass?: string;
    width?: number;
}>(), {
    align: 'end',
    disabled: false,
    panelClass: '',
    width: 320,
});

const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const dark = ref(false);
const panelId = useId();

const focusableElements = () => [...(panel.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
) ?? [])].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

const updatePosition = () => {
    if (!open.value || !trigger.value || !panel.value) return;
    const margin = 8;
    const gap = 6;
    const triggerBounds = trigger.value.getBoundingClientRect();
    const width = Math.min(props.width, Math.max(160, window.innerWidth - margin * 2));
    const measuredHeight = panel.value.scrollHeight || panel.value.getBoundingClientRect().height || 320;
    const roomBelow = window.innerHeight - triggerBounds.bottom - gap - margin;
    const roomAbove = triggerBounds.top - gap - margin;
    const above = roomBelow < Math.min(measuredHeight, 160) && roomAbove > roomBelow;
    const availableHeight = Math.max(100, above ? roomAbove : roomBelow);
    const renderedHeight = Math.min(measuredHeight, availableHeight);
    const preferredLeft = props.align === 'end' ? triggerBounds.right - width : triggerBounds.left;
    const left = Math.min(Math.max(margin, preferredLeft), Math.max(margin, window.innerWidth - width - margin));
    const top = above
        ? Math.max(margin, triggerBounds.top - gap - renderedHeight)
        : Math.min(window.innerHeight - margin - renderedHeight, triggerBounds.bottom + gap);
    panelStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(width)}px`,
        maxHeight: `${Math.round(availableHeight)}px`,
    };
};

const close = (restoreFocus = false) => {
    if (!open.value) return;
    open.value = false;
    if (restoreFocus) void nextTick(() => trigger.value?.focus());
};

const toggle = async () => {
    if (props.disabled) return;
    open.value = !open.value;
    if (!open.value) return;
    dark.value = Boolean(trigger.value?.closest('.dark'));
    await nextTick();
    updatePosition();
    focusableElements()[0]?.focus();
};

const handlePointerDown = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!open.value || trigger.value?.contains(target) || panel.value?.contains(target)) return;
    close();
};

const handleKeydown = (event: KeyboardEvent) => {
    if (!open.value || event.key !== 'Escape') return;
    const openPanels = [...document.querySelectorAll('.design-popover__panel')];
    if (openPanels.at(-1) !== panel.value) return;
    event.preventDefault();
    close(true);
};

onMounted(() => {
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
});

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handlePointerDown);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
});

watch(() => props.disabled, (disabled) => { if (disabled) close(); });
</script>

<template>
    <div class="design-popover" :class="{ 'is-open': open }">
        <button
            ref="trigger"
            type="button"
            class="design-popover__trigger"
            aria-haspopup="dialog"
            :aria-controls="panelId"
            :aria-expanded="open"
            :disabled="disabled"
            @click="toggle"
        >
            <slot name="trigger"><span>{{ label }}</span><FontAwesomeIcon :icon="faAngleDown" aria-hidden="true" /></slot>
        </button>
        <Teleport to="body">
            <div
                v-if="open"
                :id="panelId"
                ref="panel"
                class="design-popover__panel"
                :class="[panelClass, { dark }]"
                :style="panelStyle"
                role="dialog"
                :aria-label="label"
            ><slot :close="close" /></div>
        </Teleport>
    </div>
</template>
