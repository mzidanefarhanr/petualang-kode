import bcrypt from 'bcryptjs';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Pool} from 'pg';

function loadEnv(): Record<string, string> {
    const out: Record<string, string> = {};
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
        return out;
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
        out[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return out;
}

export default async function globalSetup(): Promise<void> {
    const fileEnv = loadEnv();
    const dbUrl =
        process.env.TEST_DATABASE_URL ||
        fileEnv.TEST_DATABASE_URL ||
        process.env.DATABASE_URL ||
        fileEnv.DATABASE_URL;

    if (!dbUrl) {
        throw new Error('TEST_DATABASE_URL / DATABASE_URL tidak tersedia untuk E2E.');
    }

    const pool = new Pool({connectionString: dbUrl});
    try {
        await pool.query(
            `truncate table
                student_stage_progress, live_sessions, stages, lessons, media_assets,
                class_invites, class_members, classes, students, admins
             restart identity cascade`
        );
        const hash = await bcrypt.hash('rahasia123', 10);
        await pool.query(
            `insert into admins (email, password_hash, nama)
             values ('admin@example.test', $1, 'Admin Petualang')`,
            [hash]
        );
    } finally {
        await pool.end();
    }
}
