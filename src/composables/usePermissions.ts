import { usePermissions } from '@churchtools/utils';
import { computed } from 'vue';

export function usePublisherPermissions() {
    const { userAllowed } = usePermissions();

    const canCreateCategories = computed(() => userAllowed('publisher', 'create custom category'));
    const canViewCategories = computed(() => userAllowed('publisher', 'view custom category'));
    const canEditCategories = computed(() => userAllowed('publisher', 'edit custom category'));
    const canDeleteCategories = computed(() => userAllowed('publisher', 'delete custom category'));

    return {
        canCreateCategories,
        canViewCategories,
        canEditCategories,
        canDeleteCategories,
    };
}
