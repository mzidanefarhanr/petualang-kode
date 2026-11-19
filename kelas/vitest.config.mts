import {defineConfig} from 'vitest/config';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

/*
 * Memuat variabel dari `.env` (root repo) untuk integration test, tanpa
 * menambah dependensi. Nilai yang sudah ada di process.env tidak ditimpa.
 */
function loadDotEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
        if (!existsSync(candidate)) {
            continue;
        }
        for (const raw of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) {
                continue;
            }
            const separator = line.indexOf('=');
            if (separator === -1) {
                continue;
            }
            const key = line.slice(0, separator).trim();
            const value = line.slice(separator + 1).trim();
            if (!(key in env) && !(key in process.env)) {
                env[key] = value;
            }
        }
    }
    return env;
}

export default defineConfig(() => {
    const env = loadDotEnv();
    Object.assign(process.env, env);

    return {
        test: {
            environment: 'node',
            include: ['src/**/*.test.ts'],
            env,
            // Integration test menyentuh database bersama; jalankan berurutan.
            fileParallelism: false,
            testTimeout: 30000,
            hookTimeout: 30000
        }
    };
});
