import {Pool, type PoolClient} from 'pg';

/*
 * Antarmuka minimal yang dibutuhkan lapisan server. Memungkinkan pengujian
 * unit dengan database palsu tanpa PostgreSQL.
 */
export interface Queryable {
    query: (text: string, params?: unknown[]) => Promise<{rows: any[]; rowCount?: number | null}>;
}

const globalForDb = globalThis as unknown as {__kelasPool?: Pool};

export function getPool(): Pool {
    if (!globalForDb.__kelasPool) {
        globalForDb.__kelasPool = new Pool({connectionString: process.env.DATABASE_URL});
    }
    return globalForDb.__kelasPool;
}

/*
 * Menjalankan `fn` dalam satu transaksi bila `db` mendukung koneksi (Pool).
 * Bila tidak (database palsu), `fn` dijalankan langsung tanpa transaksi.
 */
export async function withTransaction<T>(
    db: Queryable,
    fn: (queryable: Queryable) => Promise<T>
): Promise<T> {
    const maybeConnect = (db as {connect?: () => Promise<PoolClient>}).connect;
    if (typeof maybeConnect !== 'function') {
        return fn(db);
    }

    const client = await maybeConnect.call(db);
    try {
        await client.query('begin');
        const result = await fn(client);
        await client.query('commit');
        return result;
    } catch (error) {
        try {
            await client.query('rollback');
        } catch {
            // Abaikan kegagalan rollback; error asli tetap dilempar.
        }
        throw error;
    } finally {
        client.release();
    }
}
