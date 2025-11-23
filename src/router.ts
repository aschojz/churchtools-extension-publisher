import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';
import Publisher from './Publisher.vue';
import Start from './Start.vue';

const routes: RouteRecordRaw[] = [
    {
        path: '/:id(\\d+)',
        name: 'publisher',
        component: Publisher,
        props: true,
    },
    { path: '', name: 'overview', component: Start },
];

export const router = createRouter({
    routes,
    history: createWebHistory(`/ccm/${import.meta.env.VITE_KEY}/`),
    scrollBehavior(to, from, savedPosition) {
        if (to.hash) {
            return { el: to.hash, left: 0, top: 70 };
        } else if (savedPosition) {
            return savedPosition;
        } else if (to.name !== from.name) {
            return { left: 0, top: 0 };
        }
        return {};
    },
});
