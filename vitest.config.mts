import {defineConfig} from 'vitest/config';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

function loadDotEnv(): Record<string, string> {
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
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (!(key in env) && !(key in process.env)) {
            env[key] = value;
        }
    }
    return env;
}

export default defineConfig(() => {
    const env = loadDotEnv();
    Object.assign(process.env, env);

    return {
        resolve: {
            alias: {
                '@': resolve(process.cwd(), 'src')
            }
        },
        test: {
            environment: 'node',
            include: ['src/**/*.test.ts'],
            env,
            fileParallelism: false,
            testTimeout: 30000,
            hookTimeout: 30000
        }
    };
});
