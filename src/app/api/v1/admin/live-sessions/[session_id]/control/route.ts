import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {controlAdminLiveSession} from '@/server/live-sessions';

export async function PATCH(
    request: Request,
    context: {params: Promise<{session_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {session_id} = await context.params;
        const body = await request.json().catch(() => ({}));
        const state = await controlAdminLiveSession(getPool(), admin.id, session_id, body);
        return NextResponse.json({state});
    } catch (error) {
        return errorResponse(error);
    }
}
