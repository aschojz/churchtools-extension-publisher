<template>
    <div class="publisher-shell">
        <header class="publisher-shell__topbar">
            <slot name="topbar" />
        </header>

        <div v-if="$slots.contextbar" class="publisher-shell__contextbar">
            <slot name="contextbar" />
        </div>

        <div class="publisher-shell__body">
            <nav v-if="$slots.tools" class="publisher-shell__tools" aria-label="Werkzeuge">
                <slot name="tools" />
            </nav>

            <aside v-if="$slots.left" class="publisher-shell__left">
                <slot name="left" />
            </aside>

            <main class="publisher-shell__workspace" aria-label="Arbeitsbereich">
                <slot />
            </main>

            <aside v-if="$slots.right" class="publisher-shell__right">
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
    display: grid;
    min-height: 0;
    grid-template-columns: auto minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
    grid-template-areas: 'tools left workspace right';
    grid-row: 3;
}

.publisher-shell__tools {
    grid-area: tools;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
}

.publisher-shell__left {
    grid-area: left;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface-subtle);
}

.publisher-shell__workspace {
    min-width: 0;
    overflow: auto;
    grid-area: workspace;
    padding: clamp(24px, 5vw, 64px);
}

.publisher-shell__right {
    grid-area: right;
    border-left: 1px solid var(--color-border);
    background: var(--color-surface-subtle);
}

.publisher-shell__statusbar {
    min-height: 30px;
    grid-row: 4;
    border-top-width: 1px;
}

@media (max-width: 680px) {
    .publisher-shell {
        height: 100dvh;
    }

    .publisher-shell__workspace {
        padding: 18px 14px;
    }
}
</style>
