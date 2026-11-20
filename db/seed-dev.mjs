/*
 * Seed akun Admin untuk pengembangan/pengujian (bukan produksi).
 *
 * Jalankan: npm run db:seed
 * Variabel opsional: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAMA.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

const {Client} = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL belum diisi.');
    process.exit(1);
}

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.test').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || 'rahasia123';
const nama = process.env.SEED_ADMIN_NAMA || 'Admin Petualang';

const client = new Client({connectionString});

try {
    await client.connect();
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await client.query(
        'select id from admins where lower(email) = lower($1)',
        [email]
    );
    if (existing.rows.length > 0) {
        await client.query(
            'update admins set email = $1, password_hash = $2, nama = $3 where id = $4',
            [email, passwordHash, nama, existing.rows[0].id]
        );
    } else {
        await client.query(
            'insert into admins (email, password_hash, nama) values ($1, $2, $3)',
            [email, passwordHash, nama]
        );
    }
    console.log(`Akun admin siap: ${email} (kata sandi: ${password}).`);
} catch (error) {
    console.error('Seed gagal:', error.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
