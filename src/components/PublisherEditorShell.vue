<script setup lang="ts">
import { faFileLines, faSliders, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { nextTick, onBeforeUnmount, onMounted, ref, useSlots } from 'vue';

import DesignIconButton from './design/DesignIconButton.vue';

type Drawer = 'left' | 'right';
const slots = useSlots();
const openDrawer = ref<Drawer | null>(null);
const compactViewport = ref(false);
const leftTrigger = ref<InstanceType<typeof DesignIconButton> | null>(null);
const rightTrigger = ref<InstanceType<typeof DesignIconButton> | null>(null);
const leftClose = ref<InstanceType<typeof DesignIconButton> | null>(null);
const rightClose = ref<InstanceType<typeof DesignIconButton> | null>(null);

const buttonElement = (component: InstanceType<typeof DesignIconButton> | null) =>
    component?.$el instanceof HTMLButtonElement ? component.$el : null;
const setDrawer = async (drawer: Drawer) => {
    if (openDrawer.value === drawer) {
        closeDrawer();
        return;
    }
    openDrawer.value = drawer;
    await nextTick();
    buttonElement(drawer === 'left' ? leftClose.value : rightClose.value)?.focus();
};
const closeDrawer = () => {
    const previous = openDrawer.value;
    openDrawer.value = null;
    if (previous) void nextTick(() => buttonElement(previous === 'left' ? leftTrigger.value : rightTrigger.value)?.focus());
};
const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !openDrawer.value) return;
    event.preventDefault();
    closeDrawer();
};
let compactQuery: MediaQueryList | null = null;
const syncCompactViewport = () => {
    compactViewport.value = compactQuery?.matches ?? false;
    if (!compactViewport.value) openDrawer.value = null;
};
onMounted(() => {
    if (typeof window.matchMedia !== 'function') return;
    compactQuery = window.matchMedia('(max-width: 1100px)');
    syncCompactViewport();
    compactQuery.addEventListener('change', syncCompactViewport);
});
onBeforeUnmount(() => compactQuery?.removeEventListener('change', syncCompactViewport));
</script>

<template>
    <div class="publisher-shell" @keydown.capture="handleKeydown">
        <header class="publisher-shell__topbar">
            <slot name="topbar" />
        </header>

        <div v-if="$slots.contextbar" class="publisher-shell__contextbar">
            <slot name="contextbar" />
        </div>

        <div class="publisher-shell__body" :class="{ 'has-open-drawer': openDrawer }">
            <div v-if="slots.left || slots.right" class="publisher-shell__drawer-actions" role="toolbar" aria-label="Seitenbereiche">
                <DesignIconButton
                    v-if="slots.left"
                    ref="leftTrigger"
                    label="Seitenübersicht öffnen"
                    toggle
                    :active="openDrawer === 'left'"
                    aria-controls="publisher-pages-drawer"
                    :aria-expanded="openDrawer === 'left'"
                    @click="setDrawer('left')"
                ><FontAwesomeIcon :icon="faFileLines" aria-hidden="true" /></DesignIconButton>
                <DesignIconButton
                    v-if="slots.right"
                    ref="rightTrigger"
                    label="Eigenschaften öffnen"
                    toggle
                    :active="openDrawer === 'right'"
                    aria-controls="publisher-inspector-drawer"
                    :aria-expanded="openDrawer === 'right'"
                    @click="setDrawer('right')"
                ><FontAwesomeIcon :icon="faSliders" aria-hidden="true" /></DesignIconButton>
            </div>
            <button v-if="openDrawer" type="button" class="publisher-shell__drawer-backdrop" aria-label="Seitenbereich schließen" @click="closeDrawer" />
            <nav v-if="$slots.tools" class="publisher-shell__tools" aria-label="Werkzeuge">
                <slot name="tools" />
            </nav>

            <aside v-if="$slots.left" id="publisher-pages-drawer" class="publisher-shell__left" :class="{ 'is-open': openDrawer === 'left' }" aria-label="Seitenübersicht" :aria-hidden="compactViewport ? openDrawer !== 'left' : undefined" :inert="compactViewport && openDrawer !== 'left'">
                <div class="publisher-shell__drawer-heading"><strong>Seiten</strong><DesignIconButton ref="leftClose" label="Seitenübersicht schließen" @click="closeDrawer"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton></div>
                <slot name="left" />
            </aside>

            <main class="publisher-shell__workspace" aria-label="Arbeitsbereich">
                <slot />
            </main>

            <aside v-if="$slots.right" id="publisher-inspector-drawer" class="publisher-shell__right" :class="{ 'is-open': openDrawer === 'right' }" aria-label="Eigenschaften" :aria-hidden="compactViewport ? openDrawer !== 'right' : undefined" :inert="compactViewport && openDrawer !== 'right'">
                <div class="publisher-shell__drawer-heading"><strong>Eigenschaften</strong><DesignIconButton ref="rightClose" label="Eigenschaften schließen" @click="closeDrawer"><FontAwesomeIcon :icon="faXmark" aria-hidden="true" /></DesignIconButton></div>
                <slot name="right" />
            </aside>
        </div>

        <footer v-if="$slots.statusbar" class="publisher-shell__statusbar">
            <slot name="statusbar" />
        </footer>
    </div>
</template>

<style scoped>
.publisher-shell {
    display: grid;
    height: 100vh;
    min-width: 320px;
    overflow: hidden;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    background: var(--color-page);
    color: var(--color-text);
}

.publisher-shell__topbar,
.publisher-shell__contextbar,
.publisher-shell__statusbar {
    position: relative;
    z-index: 2;
    border-color: var(--color-border);
    background: var(--color-surface);
}

.publisher-shell__topbar {
    min-height: 64px;
    grid-row: 1;
    border-bottom-width: 1px;
}

.publisher-shell__contextbar {
    min-height: 42px;
    grid-row: 2;
    border-bottom-width: 1px;
}

.publisher-shell__body {
    position: relative;
    display: grid;
    min-height: 0;
    grid-template-columns: 54px 220px minmax(320px, 1fr) 350px;
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: 'tools left workspace right';
    grid-row: 3;
}

.publisher-shell__drawer-actions,
.publisher-shell__drawer-heading,
.publisher-shell__drawer-backdrop {
    display: none;
}

.publisher-shell__tools {
    position: relative;
    z-index: 3;
    min-height: 0;
    overflow: visible;
    grid-area: tools;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
}

.publisher-shell__left {
    min-height: 0;
    overflow: hidden;
    grid-area: left;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface-subtle);
}

.publisher-shell__workspace {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    grid-area: workspace;
}

.publisher-shell__right {
    min-height: 0;
    overflow: hidden;
    grid-area: right;
    border-left: 1px solid var(--color-border);
    background: var(--color-surface-subtle);
}

.publisher-shell__statusbar {
    min-height: 30px;
    grid-row: 4;
    border-top-width: 1px;
}

@media (max-width: 1100px) {
    .publisher-shell {
        height: 100dvh;
    }

    .publisher-shell__body {
        grid-template-columns: 54px minmax(280px, 1fr);
        grid-template-areas: 'tools workspace';
    }

    .publisher-shell__left,
    .publisher-shell__right {
        position: absolute;
        z-index: 7;
        top: 0;
        bottom: 0;
        display: flex;
        overflow: hidden;
        visibility: hidden;
        flex-direction: column;
        box-shadow: 0 18px 55px rgb(0 0 0 / 38%);
        transition: transform 160ms ease, visibility 160ms;
    }

    .publisher-shell__left {
        left: 54px;
        width: min(260px, calc(100% - 54px));
        transform: translateX(-105%);
    }

    .publisher-shell__right {
        right: 0;
        width: min(350px, calc(100% - 54px));
        transform: translateX(105%);
    }

    .publisher-shell__left.is-open,
    .publisher-shell__right.is-open {
        visibility: visible;
        transform: translateX(0);
    }

    .publisher-shell__left :deep(.publisher-pages),
    .publisher-shell__right :deep(.publisher-inspector) {
        width: 100%;
        flex: 1 1 auto;
    }

    .publisher-shell__drawer-actions {
        position: absolute;
        z-index: 6;
        top: 8px;
        left: 64px;
        display: flex;
        padding: 3px;
        border: 1px solid var(--color-border-control);
        border-radius: 8px;
        background: var(--color-surface);
        box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
        gap: 3px;
    }

    .publisher-shell__body.has-open-drawer .publisher-shell__drawer-actions {
        visibility: hidden;
    }

    .publisher-shell__drawer-heading {
        display: flex;
        min-height: 42px;
        padding: 4px 8px 4px 12px;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        align-items: center;
        justify-content: space-between;
    }

    .publisher-shell__drawer-heading strong {
        font-size: 12px;
    }

    .publisher-shell__drawer-backdrop {
        position: absolute;
        z-index: 5;
        inset: 0;
        display: block;
        padding: 0;
        border: 0;
        background: rgb(0 0 0 / 32%);
        cursor: default;
    }
}

@media (max-width: 680px) {
    .publisher-shell__body {
        grid-template-columns: 48px minmax(272px, 1fr);
    }

    .publisher-shell__left {
        left: 48px;
        width: min(260px, calc(100% - 48px));
    }

    .publisher-shell__right {
        width: min(350px, calc(100% - 48px));
    }

    .publisher-shell__drawer-actions {
        left: 56px;
    }
}
</style>
