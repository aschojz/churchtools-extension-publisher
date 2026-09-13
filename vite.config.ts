import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default ({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    return defineConfig({
        base: `/ccm/${process.env.VITE_KEY}/`,
        plugins: [vue()],
        build: {
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        if (id.includes('/konva/') || id.includes('/vue-konva/')) {
                            return 'konva';
                        }
                        if (id.includes('/@churchtools/churchtools-client/')) {
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
