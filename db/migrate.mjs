import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

const {Client} = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exit(1);
}

const client = new Client({connectionString});

try {
    await client.connect();
    await client.query(`
        create table if not exists schema_migrations (
            versi text primary key,
            diterapkan_pada timestamptz not null default now()
        )
    `);

    const appliedResult = await client.query('select versi from schema_migrations');
    const applied = new Set(appliedResult.rows.map(r => r.versi));

    const files = (await fs.readdir(migrationsDir))
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        if (applied.has(file)) {
            console.log(`Lewati (sudah diterapkan): ${file}`);
            continue;
        }
        const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
        await client.query('begin');
        try {
            await client.query(sql);
            await client.query('insert into schema_migrations (versi) values ($1)', [file]);
            await client.query('commit');
            console.log(`Diterapkan: ${file}`);
        } catch (err) {
            await client.query('rollback');
            throw err;
        }
    }
} catch (error) {
    console.error('Migrasi gagal:', error.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
