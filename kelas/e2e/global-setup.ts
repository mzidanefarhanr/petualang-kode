import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import bcrypt from 'bcryptjs';

/*
 * Menyiapkan database uji sebelum E2E: kosongkan data dan tanam akun guru uji.
 * Memakai DATABASE_URL dari .env (lingkungan pengembangan).
 */
const envPath = resolve(process.cwd(), '..', '.env');

function loadEnv(): void {
    if (!existsSync(envPath)) {
        return;
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
        if (!(key in process.env)) {
            process.env[key] = line.slice(separator + 1).trim();
        }
    }
}

export default async function globalSetup(): Promise<void> {
    loadEnv();

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL tidak tersedia untuk E2E.');
    }

    const pool = new Pool({connectionString: process.env.DATABASE_URL});
    try {
        await pool.query(
            `truncate table
               idempotency_keys, comments, save_intents, submissions, snapshots,
               assignments, invites, class_members, classes, schools, students, teachers
             restart identity cascade`
        );
        const hash = await bcrypt.hash('rahasia123', 10);
        await pool.query(
            `insert into teachers (email, password_hash, nama)
             values ('guru@example.test', $1, 'Guru Uji')`,
            [hash]
        );
    } finally {
        await pool.end();
    }
}
