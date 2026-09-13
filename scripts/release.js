#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const env = {
    ...process.env,
    // A public package uses the ChurchTools host session, never local login data.
    VITE_KEY: process.env.VITE_KEY || 'publisher-26',
    VITE_BASE_URL: '',
    VITE_USERNAME: '',
    VITE_PASSWORD: '',
    VITE_E2E: 'false',
};

for (const args of [
    ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'],
    ['node_modules/vite/bin/vite.js', 'build'],
    ['scripts/package.js'],
]) {
    const result = spawnSync(process.execPath, args, { cwd: rootDir, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
