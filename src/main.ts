import { churchtoolsClient } from '@churchtools/churchtools-client';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import VueKonva from 'vue-konva/core';
import { createPinia } from 'pinia';

import 'konva/lib/shapes/Image';
import 'konva/lib/shapes/Line';
import 'konva/lib/shapes/Path';
import 'konva/lib/shapes/Ellipse';
import 'konva/lib/shapes/RegularPolygon';
import 'konva/lib/shapes/Rect';
import 'konva/lib/shapes/Text';
import 'konva/lib/shapes/Transformer';
import 'konva/lib/Group';

import App from './App.vue';
import './styles.css';

// only import reset.css in development mode to keep the production bundle small and to simulate CT environment
if (import.meta.env.MODE === 'development') {
    import('./utils/reset.css');
}

const baseUrl = window.settings?.base_url ?? import.meta.env.VITE_BASE_URL;
churchtoolsClient.setBaseUrl(baseUrl);

const username = import.meta.env.VITE_USERNAME;
const password = import.meta.env.VITE_PASSWORD;
const browserTestMode = import.meta.env.VITE_E2E === 'true';
if (import.meta.env.MODE === 'development' && !browserTestMode && username && password) {
    await churchtoolsClient.post('/login', { username, password });
}

const KEY = import.meta.env.VITE_KEY;
export { KEY };

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 60_000,
        },
    },
});

createApp(App).use(createPinia()).use(VueQueryPlugin, { queryClient }).use(VueKonva).mount('#app');
