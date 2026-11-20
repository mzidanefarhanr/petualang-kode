import {Pool, type PoolClient} from 'pg';

export interface Queryable {
    query: (text: string, params?: unknown[]) => Promise<{rows: any[]; rowCount?: number | null}>;
}

const globalForDb = globalThis as unknown as {__petualangPool?: Pool};

export function getPool(): Pool {
    if (!globalForDb.__petualangPool) {
        globalForDb.__petualangPool = new Pool({connectionString: process.env.DATABASE_URL});
    }
    return globalForDb.__petualangPool;
}

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
            // Abaikan kegagalan rollback; lempar error asli.
        }
        throw error;
    } finally {
        client.release();
    }
}
