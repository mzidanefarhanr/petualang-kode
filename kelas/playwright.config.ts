import {defineConfig, devices} from '@playwright/test';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Dijalankan dari folder kelas/.
const here = process.cwd();
const editorDir = resolve(here, '..', 'editor');

function readRootEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    const envPath = resolve(here, '..', '.env');
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

const APP_URL = 'http://localhost:3000';
const EDITOR_URL = 'http://localhost:8601';
const AUTH_SECRET = 'e2e-secret-e2e-secret-e2e-secret-32chars';

/*
 * E2E menjalankan kedua aplikasi (kelas + editor) di localhost.
 * Cookie sesi lokalhost dibagi antar port, CORS memakai origin editor.
 */
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
    webServer: [
        {
            command: 'npm run dev',
            cwd: here,
            url: APP_URL,
            reuseExistingServer: false,
            timeout: 180_000,
            env: {
                ...rootEnv,
                NEXT_PUBLIC_APP_URL: APP_URL,
                NEXT_PUBLIC_EDITOR_URL: EDITOR_URL,
                COOKIE_DOMAIN: '',
                AUTH_SECRET,
                MAX_SB3_SIZE_BYTES: '52428800'
            }
        },
        {
            command: 'npm run dev',
            cwd: editorDir,
            url: 'http://localhost:8601',
            reuseExistingServer: false,
            timeout: 180_000,
            env: {
                NEXT_PUBLIC_APP_URL: APP_URL
            }
        }
    ]
});
