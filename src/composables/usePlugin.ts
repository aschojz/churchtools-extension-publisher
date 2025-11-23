import { useCustomModuleQuery } from '@churchtools/utils';
import { computed } from 'vue';

export function usePlugin() {
    const { data, isPending } = useCustomModuleQuery(import.meta.env.VITE_KEY);
    const moduleId = computed(() => data.value?.id);

    return {
        moduleId,
        isPending,
    };
}
