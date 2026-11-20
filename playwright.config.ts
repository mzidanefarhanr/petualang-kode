import {defineConfig, devices} from '@playwright/test';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

function readRootEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
        return env;
    }
    for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separator = line.indexOf('=');
        if (separator === -1) {
            continue;
        }
        env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return env;
}

const rootEnv = readRootEnv();
const APP_URL = 'http://localhost:3100';
const AUTH_SECRET = 'e2e-secret-petualang-kode-minimal-32-karakter';
const E2E_DB_URL = rootEnv.TEST_DATABASE_URL || rootEnv.DATABASE_URL;

export default defineConfig({
    testDir: './e2e',
    timeout: 120_000,
    expect: {timeout: 20_000},
    fullyParallel: false,
    workers: 1,
    retries: 0,
    globalSetup: './e2e/global-setup.ts',
    reporter: [['list']],
    use: {
        baseURL: APP_URL,
        actionTimeout: 30_000,
        navigationTimeout: 60_000
    },
    projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
    webServer: {
        command: 'node scripts/server.mjs --production',
        url: APP_URL,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
            ...rootEnv,
            PORT: '3100',
            DATABASE_URL: E2E_DB_URL,
            AUTH_URL: APP_URL,
            AUTH_SECRET,
            MAX_LIVE_STUDENTS: '20'
        }
    }
});
