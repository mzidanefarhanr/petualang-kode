import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {requireAdmin} from '@/lib/access';
import {getPool} from '@/lib/db';
import {errorResponse} from '@/lib/http/errors';
import {endAdminLiveSession} from '@/server/live-sessions';

export async function POST(
    _request: Request,
    context: {params: Promise<{session_id: string}>}
) {
    try {
        const admin = requireAdmin(await auth());
        const {session_id} = await context.params;
        const ended = await endAdminLiveSession(getPool(), admin.id, session_id);
        return NextResponse.json({session: ended});
    } catch (error) {
        return errorResponse(error);
    }
}
