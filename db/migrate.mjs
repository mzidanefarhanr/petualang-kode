/*
 * Migration runner untuk db/migrations/*.sql.
 *
 * - Menjalankan migrasi berurutan berdasarkan nama berkas.
 * - Mencatat versi yang berhasil ke tabel schema_migrations (DATABASE.md 4.1).
 * - Tiap migrasi dijalankan dalam satu transaksi.
 * - Migrasi yang sudah tercatat tidak dijalankan ulang.
 *
 * Jalankan: npm run db:migrate   (memakai DATABASE_URL dari .env)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {Client} = require('pg');

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exit(1);
}

const files = fs
    .readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort();

const client = new Client({connectionString});

try {
    await client.connect();

    await client.query(`
        create table if not exists schema_migrations (
          versi text primary key,
          diterapkan_pada timestamptz not null default now()
        );
    `);

    const applied = new Set(
        (await client.query('select versi from schema_migrations')).rows.map(r => r.versi)
    );

    for (const file of files) {
        const versi = file.replace(/\.sql$/, '');
        if (applied.has(versi)) {
            console.log(`lewati   ${versi} (sudah diterapkan)`);
            continue;
        }

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        process.stdout.write(`terapkan ${versi} ... `);

        await client.query('begin');
        try {
            await client.query(sql);
            await client.query('insert into schema_migrations (versi) values ($1)', [versi]);
            await client.query('commit');
            console.log('ok');
        } catch (error) {
            await client.query('rollback');
            throw error;
        }
    }

    console.log('Migrasi selesai.');
} catch (error) {
    console.error('Migrasi gagal:', error.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
