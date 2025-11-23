<script setup lang="ts">
import type { FAIcon } from '@churchtools/utils';
import { ref, watch } from 'vue';

const { inputType = 'text', modelValue } = defineProps<{
    modelValue: string | number | undefined;
    icon: FAIcon;
    inputType?: 'text' | 'number' | 'color';
    max?: number;
    min?: number;
}>();
const emit = defineEmits<{
    (e: 'update:model-value', value: string | number): void;
    (e: 'change'): void;
    (e: 'input'): void;
}>();
const internValue = ref<string | number | undefined>(modelValue);
watch(
    () => modelValue,
    newValue => {
        internValue.value = newValue;
    },
);
watch(internValue, newValue => {
    emit('update:model-value', newValue as string | number);
});

const onInput = (event: InputEvent) => {
    if (inputType === 'color') {
        internValue.value = (event.target as HTMLInputElement).value;
        emit('change');
    }
};
</script>
<template>
    <label class="flex items-center gap-1">
        <span class="w-4 text-center"><i :class="icon"></i></span>
        <input
            v-model="internValue"
            class="w-16 grow rounded border px-1"
            :max="max"
            :min="min"
            :type="inputType"
            @change="emit('change')"
            @input="onInput"
        />
    </label>
</template>
