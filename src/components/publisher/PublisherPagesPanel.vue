<script setup lang="ts">
import { faCopy, faGripVertical, faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { storeToRefs } from 'pinia';
import { nextTick, ref } from 'vue';

import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';
import DesignPanelHeader from '../design/DesignPanelHeader.vue';

const documentStore = usePublisherDocumentStore();
const editorStore = usePublisherEditorStore();
const { activePageId, pages } = storeToRefs(documentStore);
const { pageThumbnails } = storeToRefs(editorStore);

const emit = defineEmits<{
    add: [];
    duplicate: [pageId: string];
    remove: [pageId: string];
    rename: [pageId: string, name: string];
    reorder: [pageId: string, targetPageId: string, placement: 'before' | 'after'];
}>();

const editingPageId = ref<string | null>(null);
const editedPageName = ref('');
const draggedPageId = ref<string | null>(null);
const dropTarget = ref<{ pageId: string; placement: 'before' | 'after' } | null>(null);

const activatePage = (pageId: string) => {
    editorStore.activateCanvasPage(pageId);
    documentStore.activatePage(pageId);
};

const beginRename = (pageId: string, name: string) => {
    activatePage(pageId);
    editingPageId.value = pageId;
    editedPageName.value = name;
    void nextTick(() => {
        const input = document.querySelector<HTMLInputElement>('[data-page-name-input]');
        input?.focus();
        input?.select();
    });
};

const finishRename = () => {
    const pageId = editingPageId.value;
    if (!pageId) return;
    const name = editedPageName.value.trim();
    if (name) emit('rename', pageId, name);
    editingPageId.value = null;
};

const cancelRename = () => {
    editingPageId.value = null;
};

const startPageDrag = (pageId: string, event: DragEvent) => {
    draggedPageId.value = pageId;
    activatePage(pageId);
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
};

const updateDropTarget = (pageId: string, event: DragEvent) => {
    if (!draggedPageId.value || draggedPageId.value === pageId) {
        dropTarget.value = null;
        return;
    }
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropTarget.value = {
        pageId,
        placement: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
    };
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
};

const dropPage = (targetPageId: string, event: DragEvent) => {
    const pageId = draggedPageId.value || event.dataTransfer?.getData('text/plain');
    const placement = dropTarget.value?.pageId === targetPageId ? dropTarget.value.placement : 'before';
    if (pageId && pageId !== targetPageId) emit('reorder', pageId, targetPageId, placement);
    draggedPageId.value = null;
    dropTarget.value = null;
};

const finishPageDrag = () => {
    draggedPageId.value = null;
    dropTarget.value = null;
};

const movePageByKeyboard = (pageIndex: number, direction: -1 | 1) => {
    const page = pages.value[pageIndex];
    const target = pages.value[pageIndex + direction];
    if (!page || !target) return;
    emit('reorder', page.id, target.id, direction < 0 ? 'before' : 'after');
};
</script>

<template>
    <section class="publisher-pages" aria-labelledby="pages-heading">
        <DesignPanelHeader heading="Seiten" heading-id="pages-heading">
            <template #action>
                <DesignIconButton class="publisher-panel-heading__action" label="Seite hinzufügen" :icon="faPlus" @click="emit('add')" />
            </template>
        </DesignPanelHeader>
        <div class="publisher-pages__list">
            <article
                v-for="(page, pageIndex) in pages"
                :key="page.id"
                class="publisher-page-entry"
                :class="{
                    'is-dragging': draggedPageId === page.id,
                    'is-drop-before': dropTarget?.pageId === page.id && dropTarget.placement === 'before',
                    'is-drop-after': dropTarget?.pageId === page.id && dropTarget.placement === 'after',
                }"
                @dragover.prevent="updateDropTarget(page.id, $event)"
                @drop.prevent="dropPage(page.id, $event)"
            >
                <button
                    type="button"
                    class="publisher-page-card"
                    :class="{ 'is-active': activePageId === page.id }"
                    :aria-current="activePageId === page.id ? 'page' : undefined"
                    @click="activatePage(page.id)"
                >
                    <span class="publisher-page-card__number">{{ pageIndex + 1 }}</span>
                    <span
                        class="publisher-page-card__preview is-empty"
                        :style="{ '--publisher-page-aspect': String(page.width / page.height), aspectRatio: `${page.width} / ${page.height}` }"
                    >
                        <img v-if="pageThumbnails[page.id]" :src="pageThumbnails[page.id]" alt="" draggable="false" />
                        <span v-else class="publisher-page-card__preview-empty">Vorschau wird erstellt</span>
                    </span>
                    <span class="publisher-page-card__meta">
                        <input
                            v-if="editingPageId === page.id"
                            v-model="editedPageName"
                            :data-page-name-input="page.id"
                            maxlength="80"
                            aria-label="Seitenname"
                            @blur="finishRename"
                            @click.stop
                            @keydown.enter.prevent="finishRename"
                            @keydown.esc.prevent="cancelRename"
                        />
                        <strong v-else @dblclick.stop="beginRename(page.id, page.name)">{{ page.name }}</strong>
                        <small>{{ page.width }} × {{ page.height }} px</small>
                    </span>
                </button>
                <button
                    type="button"
                    class="publisher-page-entry__drag"
                    draggable="true"
                    :aria-label="`${page.name} verschieben`"
                    :title="`${page.name} verschieben`"
                    @dragstart="startPageDrag(page.id, $event)"
                    @dragend="finishPageDrag"
                    @keydown.up.prevent="movePageByKeyboard(pageIndex, -1)"
                    @keydown.down.prevent="movePageByKeyboard(pageIndex, 1)"
                ><FontAwesomeIcon :icon="faGripVertical" aria-hidden="true" /></button>
                <div class="publisher-page-entry__actions">
                    <DesignIconButton size="compact" :label="`${page.name} umbenennen`" :icon="faPen" @click="beginRename(page.id, page.name)" />
                    <DesignIconButton size="compact" :label="`${page.name} duplizieren`" :icon="faCopy" @click="emit('duplicate', page.id)" />
                    <DesignIconButton v-if="pages.length > 1" size="compact" variant="danger" :label="`${page.name} löschen`" :icon="faTrashCan" @click="emit('remove', page.id)" />
                </div>
            </article>
        </div>
        <DesignButton class="publisher-pages__add" variant="ghost" @click="emit('add')">
            <template #icon><FontAwesomeIcon :icon="faPlus" /></template>
            Seite hinzufügen
        </DesignButton>
    </section>
</template>
