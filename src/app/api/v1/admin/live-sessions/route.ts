import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {startAdminLiveSession} from '@/server/live-sessions';

export async function POST(request: Request) {
    try {
        const admin = requireAdmin(await auth());
        const body = await request.json().catch(() => ({}));
        const session = await startAdminLiveSession(getPool(), admin.id, body);
        return NextResponse.json({session}, {status: 201});
    } catch (error) {
        return errorResponse(error);
    }
}
