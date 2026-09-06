<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { usePublisherDocumentStore } from '../../stores/publisherDocument';
import { usePublisherEditorStore } from '../../stores/publisherEditor';
import DesignButton from '../design/DesignButton.vue';
import DesignIconButton from '../design/DesignIconButton.vue';
import DesignPanelHeader from '../design/DesignPanelHeader.vue';

defineProps<{
    previewTitle: string | null;
}>();

const documentStore = usePublisherDocumentStore();
const editorStore = usePublisherEditorStore();
const { activePageId, pages } = storeToRefs(documentStore);

const emit = defineEmits<{
    add: [];
    remove: [pageId: string];
}>();
const activatePage = (pageId: string) => {
    documentStore.activatePage(pageId);
    editorStore.clearSelectionState();
};
</script>

<template>
    <section class="publisher-pages" aria-labelledby="pages-heading">
        <DesignPanelHeader heading="Seiten" heading-id="pages-heading">
            <template #action><DesignIconButton class="publisher-panel-heading__action" label="Seite hinzufügen" @click="emit('add')">＋</DesignIconButton></template>
        </DesignPanelHeader>
        <article v-for="(page, pageIndex) in pages" :key="page.id" class="publisher-page-entry">
            <button type="button" class="publisher-page-card" :class="{ 'is-active': activePageId === page.id }" :aria-current="activePageId === page.id ? 'page' : undefined" @click="activatePage(page.id)">
                <span class="publisher-page-card__number">{{ pageIndex + 1 }}</span>
                <span class="publisher-page-card__preview" :class="previewTitle ? `is-${page.templateId}` : 'is-empty'" :style="{ aspectRatio: `${page.width} / ${page.height}` }">
                    <span v-if="previewTitle" class="publisher-page-card__preview-title">{{ previewTitle }}</span><span v-else class="publisher-page-card__preview-empty">Leere Seite</span>
                </span>
                <strong>Seite {{ pageIndex + 1 }}</strong><small>{{ page.width }} × {{ page.height }} px</small>
            </button>
            <DesignIconButton v-if="pages.length > 1" class="publisher-page-entry__delete" variant="danger" :label="`Seite ${pageIndex + 1} löschen`" @click="emit('remove', page.id)">×</DesignIconButton>
        </article>
        <DesignButton class="publisher-pages__add" variant="ghost" @click="emit('add')">＋ Seite hinzufügen</DesignButton>
    </section>
</template>
