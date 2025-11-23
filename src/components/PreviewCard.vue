<script setup lang="ts">
import { Button, Card } from '@churchtools/styleguide';
import { CtColor, CtIcon } from '@churchtools/utils';
import { computed } from 'vue';
const props = defineProps<{
    template: {
        name: string;
        description: string;
        width: number;
        height: number;
    };
    editable?: boolean;
    orientation?: 'portrait' | 'landscape';
}>();
const emit = defineEmits<{
    (e: 'click'): void;
}>();

const width = computed(() => (props.orientation === 'landscape' ? props.template.width : props.template.height));
const height = computed(() => (props.orientation === 'landscape' ? props.template.height : props.template.width));
</script>
<template>
    <Card
        class="group cursor-pointer overflow-hidden hover:shadow-lg"
        style="--card-py: 8px; --card-px: 16px"
        @click="emit('click')"
    >
        <template #hero>
            <div class="bg-basic-b-bright flex h-72 items-center justify-center overflow-hidden md:h-56 lg:h-32">
                <div class="h-full max-h-2/3 w-full max-w-2/3">
                    <slot>
                        <div
                            class="preview__card bg-basic-b-pale m-auto max-h-full max-w-full"
                            :style="`aspect-ratio: ${width} / ${height}`"
                        >
                            <img
                                class="h-full w-full object-contain"
                                :src="`https://picsum.photos/id/51/${width}/${height}`"
                            />
                        </div>
                    </slot>
                </div>
            </div>
        </template>
        <div class="flex justify-between gap-2">
            <div>
                <div class="text-body-m-emphasized">{{ template.name }}</div>
                <div class="text-body-m text-basic-tertiary">{{ template.description }}</div>
            </div>
            <div>
                <Button
                    v-if="editable"
                    class="opacity-0 group-hover:opacity-100"
                    :color="CtColor.BASIC"
                    :icon="CtIcon.EDIT"
                    size="S"
                    :text="true"
                />
                <Button
                    :color="CtColor.ACCENT"
                    icon="fas fa-angle-right"
                    size="S"
                    :text="true"
                    @click="emit('click')"
                />
            </div>
        </div>
    </Card>
</template>
<style scoped>
.preview__card {
    box-shadow: 0 0 15px 2px rgba(0, 0, 0, 0.4);
}
</style>
