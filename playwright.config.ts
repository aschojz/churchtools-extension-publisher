import { defineConfig, devices } from '@playwright/test';

const port = 4174;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://127.0.0.1:${port}/ccm/publisher-e2e/`,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `VITE_KEY=publisher-e2e VITE_E2E=true npm run dev -- --host 127.0.0.1 --port ${port}`,
        url: `http://127.0.0.1:${port}/ccm/publisher-e2e/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
