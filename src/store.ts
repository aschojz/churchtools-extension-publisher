import Konva from 'konva';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Publisher } from './publisher';

export const useStore = defineStore('publisher', () => {
    const currentPage = ref('');

    const publishers = ref<Publisher[]>();
    const selection = ref<Konva.NodeConfig[]>([]);

    const expandedLayers = ref<string[]>([]);
    const hiddenLayers = ref<string[]>([]);
    const currentLayer = ref('');

    const stage = ref<Konva.Stage>();
    const layer = ref<Konva.Layer>();
    const transformer = ref<Konva.Transformer>();

    return {
        currentPage,
        expandedLayers,
        hiddenLayers,
        currentLayer,
        publishers,
        stage,
        layer,
        selection,
        transformer,
    };
});
