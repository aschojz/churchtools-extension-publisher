import { deleteConfirm } from '@churchtools/styleguide';
import {
    useCustomModuleDataCategoriesQuery,
    useCustomModuleDataCategoryMutations,
    useToasts,
} from '@churchtools/utils';
import { computed } from 'vue';
import { usePlugin } from './usePlugin';

export type PublisherTemplate = PublisherTemplateNew & {
    id: number;
};
type PublisherTemplateNew = {
    name: string;
    description?: string;
    width: number;
    height: number;
    meta: {
        createdDate: string;
        modifiedDate: string | undefined;
    };
};
export function useTemplates() {
    const { successToast } = useToasts();
    const { moduleId } = usePlugin();
    const { createDataCategory, deleteDataCategory, updateDataCategory } =
        useCustomModuleDataCategoryMutations<PublisherTemplate>(moduleId);

    const { data, isPending } = useCustomModuleDataCategoriesQuery<PublisherTemplate>(moduleId);
    const templates = computed(() => (data.value ?? []).filter(cat => cat.shorty.startsWith('template_')));
    const templatesMap = computed(() => Object.fromEntries(templates.value.map(t => [t.id, t])));

    const createTemplate = async (payload: PublisherTemplateNew) => {
        const lastId = templates.value[templates.value.length - 1]?.id ?? 0;
        await createDataCategory({
            ...payload,
            description: payload.description ?? '',
            customModuleId: moduleId.value!,
            shorty: `template_${lastId + 1}`,
            meta: {
                createdDate: new Date().toISOString(),
                modifiedDate: undefined,
            },
        });
        successToast('Template created');
    };

    const updateTemplate = async (template: Partial<PublisherTemplateNew> & { id: number }) => {
        const originalTemplate = templatesMap.value[template.id];
        updateDataCategory({ ...originalTemplate, ...template });
        successToast('Template updated');
    };

    const deleteTemplate = async (id: number) => {
        await deleteConfirm(`Soll das Template #${id} wirklich gelöscht werden?`);
        await deleteDataCategory(id);
        successToast('Template deleted');
    };

    return {
        templates,
        templatesMap,
        isPending,
        createTemplate,
        updateTemplate,
        deleteTemplate,
    };
}
