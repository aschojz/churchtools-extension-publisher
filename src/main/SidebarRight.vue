<script setup lang="ts">
import type Konva from 'konva';
import type { Group } from 'konva/lib/Group';
import type { Node, NodeConfig } from 'konva/lib/Node';
import type { Shape, ShapeConfig } from 'konva/lib/Shape';
import { computed, ref, watch } from 'vue';
import PublisherInput from '../components/PublisherInput.vue';
import { useStore } from '../store';

const store = useStore();

const currentPublisher = computed(() => store.publishers?.[0]);

const layers = computed(() => {
    return transformItems(currentPublisher.value?.stage?.children[0].getLayer().children ?? []);
});

const selectedLayer = computed(() => {
    const nodes = currentPublisher.value?.transformer?.nodes();
    return nodes?.length === 1 ? nodes[0] : null;
});

type TransformedItem = {
    type: string;
    name: string;
    children?: TransformedItem[];
    item?: Group | Shape<ShapeConfig>;
    selected: boolean;
};
const transformItems = (items: (Group | Shape<ShapeConfig>)[]): TransformedItem[] => {
    return items
        .filter(item => item.className !== 'Transformer')
        .map(item => {
            if ('children' in item) {
                return {
                    item,
                    type: item.attrs.type,
                    name: 'Group',
                    children: transformItems(item.children),
                    selected: selectedLayer.value?._id === item._id,
                };
            }
            const name = item.className === 'Text' ? `${item.className}: ${item.text()}` : item.className;
            return {
                type: item.attrs.type,
                name,
                item,
                selected: selectedLayer.value?._id === item._id,
            };
        });
};
const select = (layer: TransformedItem) => {
    currentPublisher.value?.transformer?.nodes([layer.item]);
};
const variables = ref<{
    x: number | undefined;
    y: number | undefined;
    width: number | undefined;
    height: number | undefined;
    radius: number | undefined;
    rotation: number | undefined;
    fontFamily: string | undefined;
    fontSize: number | undefined;
    fill: string | CanvasGradient | undefined;
    opacity: number | undefined;
}>({
    x: undefined,
    y: undefined,
    width: undefined,
    height: undefined,
    radius: undefined,
    rotation: undefined,
    fontFamily: undefined,
    fontSize: undefined,
    fill: undefined,
    opacity: 100,
});
const resetVariables = () => {
    variables.value = {
        x: undefined,
        y: undefined,
        width: undefined,
        height: undefined,
        radius: undefined,
        rotation: undefined,
        fontFamily: undefined,
        fontSize: undefined,
        fill: undefined,
        opacity: 100,
    };
};
watch(
    () => currentPublisher.value?.transformer?.nodes(),
    () => {
        if (!selectedLayer.value) {
            return;
        }
        resetVariables();
        variables.value.x = selectedLayer.value.x();
        variables.value.y = selectedLayer.value.y();
        variables.value.rotation = selectedLayer.value.rotation() ? selectedLayer.value.rotation() : 0;
        if (isRect(selectedLayer.value) || isCircle(selectedLayer.value) || isText(selectedLayer.value)) {
            variables.value.fill = selectedLayer.value.fill();
            variables.value.opacity = selectedLayer.value.opacity() * 100;
        }
        if (isText(selectedLayer.value)) {
            variables.value.fontSize = selectedLayer.value.fontSize ? selectedLayer.value.fontSize() : 0;
            variables.value.fontFamily = selectedLayer.value.fontFamily();
        } else if (isCircle(selectedLayer.value)) {
            variables.value.radius = selectedLayer.value.radius() ? selectedLayer.value.radius() : 0;
        } else if (!isGroup(selectedLayer.value)) {
            variables.value.width = selectedLayer.value.width() ? selectedLayer.value.width() : 0;
            variables.value.height = selectedLayer.value.height() ? selectedLayer.value.height() : 0;
        }
    },
);
const isText = (n: Node<NodeConfig> | null): n is Konva.Text => n?.attrs.type === 'text';
const isCircle = (n: Node<NodeConfig> | null): n is Konva.Circle => n?.attrs.type === 'circle';
const isRect = (n: Node<NodeConfig> | null): n is Konva.Rect => n?.attrs.type === 'rect';
// const isImage = (n: Node<NodeConfig> | null): n is Konva.Image => n?.attrs.type === 'image';
const isGroup = (n: Node<NodeConfig> | null): n is Konva.Group => n?.attrs.type === 'group';

const setChanges = () => {
    if (selectedLayer.value) {
        if (variables.value.x !== undefined) {
            selectedLayer.value.x(variables.value.x);
        }
        if (variables.value.y !== undefined) {
            selectedLayer.value.y(variables.value.y);
        }
        if (variables.value.width !== undefined) {
            selectedLayer.value.width(variables.value.width);
        }
        if (variables.value.height !== undefined) {
            selectedLayer.value.height(variables.value.height);
        }
        if (variables.value.rotation !== undefined) {
            selectedLayer.value.rotation(variables.value.rotation);
        }
        if (variables.value.radius !== undefined && isCircle(selectedLayer.value)) {
            selectedLayer.value.radius(variables.value.radius);
        }
        if (variables.value.fontSize !== undefined && isText(selectedLayer.value)) {
            selectedLayer.value.fontSize(variables.value.fontSize);
        }
        if (variables.value.fontFamily !== undefined && isText(selectedLayer.value)) {
            selectedLayer.value.fontFamily(variables.value.fontFamily);
        }
        if (
            variables.value.fill !== undefined &&
            (isRect(selectedLayer.value) || isCircle(selectedLayer.value) || isText(selectedLayer.value))
        ) {
            selectedLayer.value.fill(variables.value.fill);
        }
        if (variables.value.opacity !== undefined) {
            selectedLayer.value.opacity((variables.value.opacity as number) / 100);
        }
    }
};
</script>
<template>
    <div class="flex flex-col justify-between">
        <div>
            <div v-for="(layer, index) in layers" :key="index">
                <div
                    class="border-basic-divider border-b border-solid px-2 py-1"
                    :class="{ 'bg-info-b-pale': layer.selected }"
                    @click="select(layer)"
                >
                    {{ layer.name }}
                </div>
                <div v-if="layer.type === 'group'" class="ps-4">
                    <div
                        v-for="(child, idx) in layer.children"
                        :key="idx"
                        class="border-basic-divider border-b border-solid px-2 py-1"
                        :class="{ 'bg-info-b-pale': child.selected }"
                        @click="select(child)"
                    >
                        <div>{{ child.name }}</div>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="selectedLayer" class="flex flex-col gap-4 px-3 py-2">
            <div class="border-basic-divider border-b">
                <div class="flex gap-3 pb-3">
                    <PublisherInput
                        v-model="variables.fill"
                        class="basis-1/2"
                        icon="fas fa-fill"
                        inputType="color"
                        @change="setChanges"
                    />
                    <PublisherInput
                        v-model="variables.opacity"
                        class="basis-1/2"
                        icon="fas fa-circle-dashed"
                        inputType="number"
                        :max="100"
                        :min="0"
                        @change="setChanges"
                    />
                </div>
                <div class="flex gap-3 pb-3">
                    <PublisherInput
                        v-model="variables.fontSize"
                        class="basis-1/2"
                        icon="fas fa-text-size"
                        inputType="number"
                        @change="setChanges"
                    />
                    <label class="flex basis-1/2 items-center gap-1">
                        <span class="w-4 text-center"><i class="fa fa-font"></i></span>
                        <select
                            v-model="variables.fontFamily"
                            class="w-16 grow rounded border px-1"
                            @change="setChanges"
                        >
                            <option value="MyriadPro-Light">MyriadPro Light</option>
                            <option value="Myriad Pro">MyriadPro Regular</option>
                            <option value="MyriadPro-Bold">MyriadPro Bold</option>
                            <option value="MyriadPro-LightCond">MyriadPro Condensed Light</option>
                            <option value="MyriadPro-Cond">MyriadPro Condensed</option>
                            <option value="MyriadPro-BoldCond">MyriadPro Condensed Bold</option>
                        </select>
                    </label>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <div class="flex gap-3">
                    <PublisherInput
                        v-model="variables.x"
                        class="basis-1/2"
                        icon="fas fa-x"
                        inputType="number"
                        @change="setChanges"
                    />
                    <PublisherInput
                        v-model="variables.y"
                        class="basis-1/2"
                        icon="fas fa-y"
                        inputType="number"
                        @change="setChanges"
                    />
                </div>
                <div class="flex gap-3">
                    <PublisherInput
                        v-model="variables.width"
                        class="basis-1/2"
                        icon="fas fa-w"
                        inputType="number"
                        @change="setChanges"
                    />
                    <PublisherInput
                        v-model="variables.height"
                        class="basis-1/2"
                        icon="fas fa-h"
                        inputType="number"
                        @change="setChanges"
                    />
                </div>
                <div class="flex gap-3">
                    <PublisherInput
                        v-model="variables.radius"
                        class="basis-1/2"
                        icon="fas fa-r"
                        inputType="number"
                        @change="setChanges"
                    />
                    <PublisherInput
                        v-model="variables.rotation"
                        class="basis-1/2"
                        icon="fas fa-n"
                        inputType="number"
                        @change="setChanges"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
