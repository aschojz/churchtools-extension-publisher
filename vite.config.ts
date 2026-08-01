import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default ({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    return defineConfig({
        base: `/ccm/${process.env.VITE_KEY}/`,
        plugins: [vue()],
        resolve: {
            conditions: ['ct-mono-repo', 'browser'],
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        if (id.includes('/konva/') || id.includes('/vue-konva/')) {
                            return 'konva';
                        }
                        if (id.includes('/churchtools/frontend-packages/')) {
                            return 'churchtools';
                        }
                        if (id.includes('/vue/') || id.includes('/@tanstack/')) {
                            return 'vue';
                        }
                    },
                },
            },
        },
    });
};
