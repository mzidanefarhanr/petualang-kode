/*
 * Seed akun guru untuk pengembangan/pengujian (bukan produksi).
 *
 * Jalankan: npm run db:seed
 * Variabel opsional: SEED_GURU_EMAIL, SEED_GURU_PASSWORD, SEED_GURU_NAMA.
 */
import {createRequire} from 'node:module';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const {Client} = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exit(1);
}

const email = (process.env.SEED_GURU_EMAIL || 'guru@example.test').trim().toLowerCase();
const password = process.env.SEED_GURU_PASSWORD || 'rahasia123';
const nama = process.env.SEED_GURU_NAMA || 'Guru Uji';

const client = new Client({connectionString});

try {
    await client.connect();
    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
        `insert into teachers (email, password_hash, nama)
         values ($1, $2, $3)
         on conflict (email) do update set password_hash = excluded.password_hash, nama = excluded.nama`,
        [email, passwordHash, nama]
    );
    console.log(`Akun guru siap: ${email} (kata sandi: ${password}).`);
} catch (error) {
    console.error('Seed gagal:', error.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
