import {Pool} from 'pg';

/*
 * Satu pool koneksi PostgreSQL untuk seluruh aplikasi.
 * Disimpan di global agar tidak membuat pool baru saat hot reload di mode dev.
 */
const globalForDb = globalThis as unknown as {__kelasPool?: Pool};

export function getPool(): Pool {
    if (!globalForDb.__kelasPool) {
        globalForDb.__kelasPool = new Pool({connectionString: process.env.DATABASE_URL});
    }
    return globalForDb.__kelasPool;
}
