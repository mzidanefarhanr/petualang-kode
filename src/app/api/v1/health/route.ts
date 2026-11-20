import {NextResponse} from 'next/server';
import {getPool} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const {rows} = await getPool().query('select now() as server_time');
        return NextResponse.json({
            status: 'ok',
            server_time: rows[0]?.server_time
        });
    } catch {
        return NextResponse.json(
            {
                status: 'error',
                error: {
                    kode: 'DB_TIDAK_TERHUBUNG',
                    pesan: 'Koneksi database sedang tidak tersedia.'
                }
            },
            {status: 503}
        );
    }
}
