<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { Button, LoadingDots } from '@churchtools/styleguide';
import { CtColor, type Appointment } from '@churchtools/utils';
import { nextTick, onMounted, ref } from 'vue';
import useImage from '../composables/useImage';
import type { PublisherTemplate } from '../composables/useTemplates';
import { useStore } from '../store';
import { createCustomDataValue } from '../utils/kv-store';

const props = defineProps<{
    template: PublisherTemplate;
}>();
const emit = defineEmits<{
    (e: 'data-loaded', appointment: Record<string, string | number>): void;
    (e: 'scale', value: string): void;
}>();

const data = ref<Appointment[]>([]);
onMounted(async () => {
    data.value = await churchtoolsClient.get<Appointment[]>(
        `/calendars/appointments?calendar_ids[]=3&from=2025-11-21&to=2025-11-28`,
    );
});

const { dominantColor, colors, getColorsFromImage } = useImage();
const isLoading = ref(false);
const afterLoadData = (event: Event) => {
    isLoading.value = true;
    const index = Number((event.target as HTMLSelectElement).value);
    variables.value.title = data.value[index].base.title;
    variables.value.description = data.value[index].base.description;
    variables.value.subtitle = data.value[index].base.subtitle || '';
    variables.value.link = '';
    const startDate = new Date(data.value[index].calculated.startDate);
    variables.value.date = `${startDate.getDate()}.${(startDate.getMonth() + 1).toString().padStart(2, '0')}.`;
    variables.value.time = `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')} Uhr`;
    variables.value.image = `${data.value[index].base.image?.imageUrl}?w=1080&h=1080&fit=crop`;
    nextTick(async () => {
        await getColorsFromImage(document.getElementById('image'));
        variables.value.primaryColor = dominantColor.value;
        variables.value.backgroundColor = colors.value[1] || colors.value[0];
        emit('data-loaded', variables.value);
        isLoading.value = false;
    });
};

const variables = ref<Record<string, string | number>>({});

const store = useStore();
const onSave = async () => {
    const state = store.publishers?.map(publisher => publisher.getState());
    state?.forEach(template => {
        createCustomDataValue({
            dataCategoryId: props.template.id,
            value: JSON.stringify(template),
        });
    });
};
</script>
<template>
    <div class="bg-basic-b-pale sticky top-0 left-0 z-10 flex w-full items-center justify-between gap-2 px-4 py-2">
        <div class="text-display-s">{{ template.name }}</div>
        <div class="flex items-center gap-4">
            <select class="rounded border px-1" @input="afterLoadData">
                <option v-for="(d, index) in data" :key="index" :value="index">
                    {{ d.base.title }} · {{ d.calculated.startDate }}
                </option>
            </select>
            <LoadingDots v-if="isLoading" :color="CtColor.BASIC" size="S" />
            <input
                max="1"
                min="0.1"
                :model-value="0.5"
                step="0.01"
                type="range"
                @input="emit('scale', $event.target.value)"
            />
            <Button size="S" @click="onSave">Speichern</Button>
            <img v-if="variables.image" v-show="false" id="image" crossOrigin="anonymous" :src="variables.image" />
        </div>
    </div>
</template>
