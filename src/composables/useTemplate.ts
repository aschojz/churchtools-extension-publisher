import { deleteConfirm } from '@churchtools/styleguide';
import {
    useCustomModuleDataCategoryQuery,
    useCustomModuleDataValuesMutations,
    useCustomModuleDataValuesQuery,
} from '@churchtools/utils';
import { computed, ref, toValue, type MaybeRef } from 'vue';
import { usePlugin } from './usePlugin';
import type { PublisherTemplate } from './useTemplates';

export type PublisherTemplatePage = PublisherTemplatePageNew & {
    id: number;
};
export type PublisherTemplatePageNew = {
    name: string;
    description?: string;
    meta: {
        createdDate: string;
        modifiedDate: string | undefined;
    };
};

export function useTemplate(id: MaybeRef<number | null>) {
    const { moduleId } = usePlugin();

    const { createCustomDataValue, deleteCustomDataValue, updateCustomDataValue } =
        toValue(id) !== null
            ? useCustomModuleDataValuesMutations<PublisherTemplatePage>(moduleId, id as MaybeRef<number>)
            : {
                  createCustomDataValue: async () => {},
                  deleteCustomDataValue: async () => {},
                  updateCustomDataValue: async () => {},
              };

    const createSurveyEntry = async (template: PublisherTemplatePageNew) => {
        await createCustomDataValue({
            ...template,
            dataCategoryId: toValue(id)!,
            meta: {
                createdDate: new Date().toISOString(),
                modifiedDate: undefined,
            },
        });
    };
    const updateSurveyEntry = async (surveyEntry: PublisherTemplatePage & { id: number }) => {
        await updateCustomDataValue({
            dataCategoryId: toValue(id)!,
            ...surveyEntry,
            meta: {
                ...surveyEntry.meta,
                modifiedDate: new Date().toISOString(),
            },
        });
    };

    const { category: template, isPending } =
        toValue(id) !== null
            ? useCustomModuleDataCategoryQuery<PublisherTemplate>(moduleId, id as MaybeRef<number>)
            : { category: ref(undefined), isPending: ref(true) };

    const deleteSurveyEntry = async (entryId: number) => {
        const result = await deleteConfirm(`Soll der Eintrag #${entryId} wirklich gelöscht werden?`);
        if (result === 'ok') {
            await deleteCustomDataValue({ dataCategoryId: toValue(id)!, id: entryId });
        }
    };

    const { data } =
        toValue(id) !== null
            ? useCustomModuleDataValuesQuery<PublisherTemplatePage>(moduleId, id as MaybeRef<number>)
            : { data: ref(undefined) };
    const surveyEntries = computed(() => data.value ?? []);

    return { template, createSurveyEntry, surveyEntries, isPending, deleteSurveyEntry, updateSurveyEntry };
}
