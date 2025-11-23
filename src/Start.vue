<script setup lang="ts">
import { ContentWrapper } from '@churchtools/styleguide';
import { CtIcon, tx } from '@churchtools/utils';
import { emit } from 'process';
import { computed, ref } from 'vue';
import { ComponentProps } from 'vue-component-type-helpers';
import DialogAddTemplate from './components/DialogAddTemplate.vue';
import PreviewCard from './components/PreviewCard.vue';
import { usePublisherPermissions } from './composables/usePermissions';
import { useTemplates, type PublisherTemplate } from './composables/useTemplates';

const emit = defineEmits<{
    (e: 'select-template', template: PublisherTemplate): void;
}>();

const { templates } = useTemplates();
const { canCreateCategories } = usePublisherPermissions();
const actions = computed(() => {
    const actions: ComponentProps<typeof ContentWrapper>['actions'] = [];
    if (canCreateCategories.value) {
        actions.push({
            icon: CtIcon.ADD,
            label: tx('Vorlage erstellen'),
            onClick: () => (newTemplateIsOpen.value = true),
        });
    }
    return actions;
});

const newTemplateIsOpen = ref(false);
</script>
<template>
    <ContentWrapper :actions="actions" icon="fas fa-paintbrush" :max-width="true" :title="tx('Publisher')">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <PreviewCard
                v-for="template in templates"
                :key="template.id"
                :editable="true"
                :template="template"
                @click="emit('select-template', template)"
            ></PreviewCard>
        </div>
        <DialogAddTemplate v-if="newTemplateIsOpen" @close="newTemplateIsOpen = false" />
    </ContentWrapper>
</template>
<style scoped>
.container__canvas {
    box-shadow: 0 0 15px 2px rgba(0, 0, 0, 0.4);
}
</style>
