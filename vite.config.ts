import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import eslintPlugin from 'vite-plugin-eslint';

// https://vitejs.dev/config/
export default ({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    return defineConfig({
        base: `/ccm/${process.env.VITE_KEY}/`,
        plugins: [vue(), eslintPlugin(), tailwindcss()],
        resolve: {
            dedupe: ['vue'],
            alias: {
                // Fix ChurchTools styleguide config reference
                '../tailwind.config.js': path.resolve(__dirname, './tailwind.config.js'),
            },
        },
    });
};
